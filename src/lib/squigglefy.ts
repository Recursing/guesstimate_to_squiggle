import { identity, values } from "lodash";

interface Metric {
  readonly id: string;
  readonly name: string;
}

interface Guesstimate {
  readonly metric: string;
  readonly guesstimateType:
    | "FUNCTION"
    | "LOGNORMAL"
    | "NORMAL"
    | "UNIFORM"
    | "POINT"
    | "DATA";
  expression: string | null;
  readonly description: string;
  readonly data?: readonly number[];
}

type GraphNode = Metric & Guesstimate;

export interface GuesstimateData {
  readonly url: string;
  readonly graph: {
    readonly metrics: readonly Metric[];
    readonly guesstimates: readonly Guesstimate[];
  };
}

interface NodeToCode {
  POINT: (value: string) => string;
  DATA: (value: readonly number[]) => string;
  UNIFORM: (low: string, high: string) => string;
  NORMAL: (low: string, high: string) => string;
  LOGNORMAL: (low: string, high: string) => string;
  FUNCTION: (value: string) => string;
  assignment: (node: GraphNode) => string;
}

export function getCode(
  data: GuesstimateData,
  translation: NodeToCode
): string {
  const graph = data.graph;

  const metrics: readonly Metric[] = graph.metrics;
  const guesstimates: readonly Guesstimate[] = graph.guesstimates;

  const metricsById = new Map<string, Metric>(metrics.map((m) => [m.id, m]));

  const graphNodes = new Map<string, GraphNode>();
  const names = new Set<string>();
  guesstimates.map((g) => {
    const metric = metricsById.get(g.metric);
    if (!metric) {
      throw Error("metric not found" + g.metric);
    }
    const node = {
      ...metric,
      ...g,
    };
    node.description = node.name as typeof node.description;
    let name = node.name
      .toLowerCase()
      .replaceAll("%", " perc ")
      .replaceAll(/\s+/g, " ")
      .replaceAll(/[^\w]/g, "_")
      .slice(0, 30);
    if (!name) {
      name = "_";
    }
    if (name[0] >= "0" && name[0] <= "9") {
      name = "_" + name;
    }
    if (names.has(name)) {
      let counter = 2;
      name = name + "_" + counter;
      while (names.has(name)) {
        name = name + "_" + counter;
        counter += 1;
      }
    }
    node.name = name;
    names.add(node.name);
    graphNodes.set(node.id, structuredClone(node));
  });

  const dependencies = new Map<string, Set<string>>();

  graphNodes.forEach((node) => {
    dependencies.set(node.id, new Set());
    switch (node.guesstimateType) {
      case "POINT":
        node.expression = translation.POINT(node.expression);
        break;
      case "DATA":
        node.expression = translation.DATA(node.data);
        break;
      case "UNIFORM": {
        const values = /^\[(.*),(.*)\]$/.exec(node.expression || "")!;
        if (values) node.expression = translation.UNIFORM(values[1], values[2]);
        break;
      }
      case "NORMAL": {
        let values = /^\[(.*),(.*)\]$/.exec(node.expression || "");
        values ||= /^(.*)to(.*)$/.exec(node.expression || "");
        if (values)
          node.expression = translation.NORMAL(
            values[1].trim(),
            values[2].trim()
          );
        break;
      }
      case "LOGNORMAL": {
        let values = /^\[(.*),(.*)\]$/.exec(node.expression || "");
        values ||= /^(.*)to(.*)$/.exec(node.expression || "");
        if (values)
          node.expression = translation.LOGNORMAL(
            values[1].trim(),
            values[2].trim()
          );
        break;
      }
      case "FUNCTION": {
        let expression = (node.expression || "").slice(1);
        graphNodes.forEach((otherNode) => {
          const { id, name } = otherNode;
          const regex = new RegExp(`\\$\\{metric:${id}\\}`, "g");
          if (regex.test(expression)) {
            dependencies.get(node.id)!.add(id);
          }
          expression = expression.replace(regex, `${name}`);
        });
        node.expression = translation.FUNCTION(expression);
        break;
      }
    }
  });

  return topoSort(dependencies)
    .map((id) => {
      const node = graphNodes.get(id)!;
      if (!node.expression) {
        return "";
      }
      return translation.assignment(node);
    })
    .filter((line) => line)
    .join("\n");
}

function topoSort(dependencies: Map<string, Set<string>>): string[] {
  const sorted: string[] = [];
  const visited: Set<string> = new Set();
  const visit = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    if (!dependencies.has(id)) {
      throw Error("Broken dependencies: " + JSON.stringify(dependencies));
    }
    dependencies.get(id).forEach((dep) => visit(dep));
    sorted.push(id);
  };
  for (let id of dependencies.keys()) {
    visit(id);
  }
  return sorted;
}

const squiggleCode: NodeToCode = {
  POINT: identity,
  DATA: (data) => `fromSamples(${JSON.stringify(data)})`,
  UNIFORM: (low, high) => `uniform(${low}, ${high})`,
  NORMAL: (low, high) => `${low} to ${high}`, // TODO, for now convert to lognormal
  LOGNORMAL: (low, high) => `${low} to ${high}`,
  FUNCTION: identity,
  assignment: (node) =>
    `${node.name} = ${node.expression} // ${node.description}`,
};

function expandNum(text: string): string {
  return text
    .replace("K", " * 1_000")
    .replace("M", " * 1_000_000")
    .replace("B", " * 1_000_000_000");
}

const pythonReplacements = {
  "min(": "np.minimum(",
  "max(": "np.maximum(",
};
const pythonCode: NodeToCode = {
  POINT: identity,
  DATA: (data) => `np.array(${JSON.stringify(data)})`,
  UNIFORM: (low, high) => `make_uniform(${expandNum(low)}, ${expandNum(high)})`,
  NORMAL: (low, high) => `make_normal(${expandNum(low)}, ${expandNum(high)})`,
  LOGNORMAL: (low, high) =>
    `make_lognormal(${expandNum(low)}, ${expandNum(high)})`,
  FUNCTION: (expression) => {
    for (let [key, value] of Object.entries(pythonReplacements)) {
      expression = expression.replaceAll(key, value);
    }
    return expression;
  },
  assignment: (node) =>
    `\n# ${node.description}\n` +
    `${node.name} = ${node.expression}` +
    (node.guesstimateType === "POINT" ? "" : `\nshow(${node.name})`),
};

export function getSquiggleCode(data: GuesstimateData): string {
  const initialCode = `// Generated from ${data.url}\n`;
  return initialCode + getCode(data, squiggleCode);
}

export function getPythonCode(data: GuesstimateData): string {
  const initialCode = `
# Generated from ${data.url}

import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import norm
import inspect

def make_uniform(perc_5, perc_95):
  assert perc_95 > perc_5
  size = (perc_95 - perc_5) / 0.9
  minimum = perc_5 - size * 0.05
  maximum = minimum + size
  return np.random.uniform(minimum, maximum, 1_000_000)

def make_normal(perc_5, perc_95):
  # Copied from https://forum.effectivealtruism.org/posts/tvTqRtMLnJiiuAep5/
  assert perc_95 > perc_5
  mean = (perc_5 + perc_95) / 2
  stdev = (perc_95 - perc_5) / (norm.ppf(0.95) - norm.ppf(0.05))
  return np.random.normal(mean, stdev, 1_000_000)

def make_lognormal(perc_5, perc_95):
  assert perc_5 > 0
  assert perc_95 > 0
  return np.exp(make_normal(np.log(perc_5), np.log(perc_95)))

def show(dist):
  title_lines = []
  frame = inspect.currentframe()
  name = [name for name, val in frame.f_back.f_locals.items() if val is dist]
  if name:
    title_lines.append(name[0])
  title_lines.append(f"mean: {np.mean(dist):,.2f}")
  title_lines.append(f"stdev: {np.std(dist):,.2f}")
  five, ninetyfive = np.quantile(dist,[0.05, 0.95])
  title_lines.append(f"5% — 95%: {five:,.2f} — {ninetyfive:,.2f}")
  plt.title("\\n".join(title_lines))
  plt.hist(dist, bins=100)
  plt.show()


`;
  return initialCode + getCode(data, pythonCode);
}
