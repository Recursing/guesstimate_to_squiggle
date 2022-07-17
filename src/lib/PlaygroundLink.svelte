<script lang="ts">
  import { deflate } from "pako";
  import { fromByteArray } from "base64-js";
  export let code: string;

  const HASH_PREFIX = "#code=";

  const text = JSON.stringify({
    showSummary: true,
    initialSquiggleString: code,
  });
  const compressed = deflate(text, { level: 9 });
  const hash = HASH_PREFIX + encodeURIComponent(fromByteArray(compressed));
  const encodedUrl =
    "https://deploy-preview-840--squiggle-documentation.netlify.app/playground" +
    hash;
</script>

<h2>
  <a href={encodedUrl}>Squiggle playground Link</a>
</h2>
