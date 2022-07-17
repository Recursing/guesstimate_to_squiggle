<script lang="ts">
  import { random } from "lodash";
  import mermaid from "mermaid";
  import { onMount } from "svelte";
  import pako from "pako";
  import { Buffer } from "buffer";

  export let code: string;
  let mermaidSvg = "";
  let krokiEncoded = "";
  mermaidSvg = mermaid.mermaidAPI.render("asd" + random(0, 2 ** 30), code);

  const data = Buffer.from(code, "utf8");
  const compressed = pako.deflate(data, { level: 9 });
  console.log(code);
  krokiEncoded =
    "https://kroki.io/mermaid/svg/" +
    Buffer.from(compressed)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  onMount(() => {
    mermaid.initialize({
      startOnLoad: false,
      flowchart: { useMaxWidth: false, htmlLabels: true },
    });
  });
</script>

<h2>
  Computation graph:
  <a href={krokiEncoded}>Link</a>
</h2>
<div id="graphDiv">{@html mermaidSvg}</div>
