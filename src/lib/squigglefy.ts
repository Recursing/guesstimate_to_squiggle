interface Metric {
  id: string;
  name: string;
}

interface Guesstimate {
  metric: string;
  guesstimateType: "FUNCTION" | "LOGNORMAL" | "NORMAL" | "UNIFORM" | "POINT" | "DATA";
  expression: string | null;
  description: string;
  data?: readonly number[];
}

type GraphNode = Metric & Guesstimate;

interface Data {
  graph: {
    metrics: readonly Metric[];
    guesstimates: readonly Guesstimate[];
  };
}

export function getSquiggleCode(data: Data): string {
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
    let name = node.name.toLowerCase().replaceAll(/[^\w]/g, "_").slice(0, 20);
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
    graphNodes.set(node.id, node);
  });

  const dependencies = new Map<string, Set<string>>();

  graphNodes.forEach((node) => {
    dependencies.set(node.id, new Set());
    switch (node.guesstimateType) {
      case "POINT":
        break;
      case "DATA":
        node.expression = `fromSamples(${JSON.stringify(node.data)})`;
        break;
      case "UNIFORM": {
        const values = /^\[(.*),(.*)\]$/.exec(node.expression || "")!;
        if (values) node.expression = `uniform(${values[1]}, ${values[2]})`;
        break;
      }
      case "NORMAL": // TODO, for now convert to lognormal
      case "LOGNORMAL": {
        const values = /^\[(.*),(.*)\]$/.exec(node.expression || "")!;
        if (values) node.expression = `${values[1]} to ${values[2]}`;
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
        node.expression = expression;
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
      return `${node.name} = ${node.expression} // ${node.description}`;
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
