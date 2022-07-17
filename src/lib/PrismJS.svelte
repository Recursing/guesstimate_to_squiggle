<script lang="ts">
  import Prism from "prismjs";

  import { onMount } from "svelte";

  export let code: string;
  export let language: "javascript" | "python";

  onMount(() => {
    Prism.highlightAll();
  });
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://tutsplus.github.io/syntax-highlighter-demos/highlighters/Prism/prism_okaidia.css"
  />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/prism.min.js"></script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/components/prism-python.min.js"></script>
  
</svelte:head>

<pre style="user-select:all;"><code class="language-{language}">{code}</code>
</pre>
