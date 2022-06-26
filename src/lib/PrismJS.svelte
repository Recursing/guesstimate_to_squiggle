<script lang="ts">
  import Prism from "prismjs";

  import { onMount } from "svelte";

  export let code: string;

  onMount(() => {
    Prism.highlightAll();
  });
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://tutsplus.github.io/syntax-highlighter-demos/highlighters/Prism/prism_okaidia.css"
  />
</svelte:head>

<pre style="user-select:all;"><code class="language-javascript">{code}</code>
</pre>
