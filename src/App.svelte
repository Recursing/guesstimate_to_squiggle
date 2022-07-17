<script lang="ts">
  import {
    getSquiggleCode,
    getPythonCode,
    GuesstimateData,
    getMermaidDag,
  } from "./lib/squigglefy";
  import PrismJs from "./lib/PrismJS.svelte";
  import PlaygroundLink from "./lib/PlaygroundLink.svelte";
  import Mermaid from "./lib/Mermaid.svelte";

  let code: Promise<{
    squiggle: string;
    python: string;
    mermaid: string;
  }> | null = null;
  let guessTimateUrl = "";

  async function getGuesstimateData(
    guessTimateUrl: string
  ): Promise<GuesstimateData> {
    const pattern = /^https:\/\/www.getguesstimate.com\/models\/(\d+)$/;

    let matches = pattern.exec(guessTimateUrl.trim());
    if (!matches) {
      throw Error("Invalid URL: " + guessTimateUrl);
    }
    const id = matches[1];
    const response = await fetch(`https://salty-horse-89.deno.dev/${id}`, {
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/json",
      },
    });

    return { ...(await response.json()), url: guessTimateUrl };
  }

  async function getCode() {
    const guesstimateData = await getGuesstimateData(guessTimateUrl);
    if (!guesstimateData) {
      throw Error("Error fetching guesstimate model: no data");
    }
    const python = getPythonCode(guesstimateData);

    // Format python code with black
    const response = await fetch(
      "https://1rctyledh3.execute-api.us-east-1.amazonaws.com/dev",
      {
        headers: {
          accept: "*/*",
          "content-type": "application/json",
        },
        body: JSON.stringify({ source: python }),
        method: "POST",
        credentials: "omit",
      }
    ).then((response) => response.json());
    return {
      squiggle: getSquiggleCode(guesstimateData),
      python: response.formatted_code,
      mermaid: getMermaidDag(guesstimateData),
    };
  }

  function handleClick() {
    code = getCode();
  }
</script>

<main>
  <h1>Guesstimate to Python and Squiggle</h1>
  <input
    bind:value={guessTimateUrl}
    placeholder="https://www.getguesstimate.com/models/1234"
  />
  <button on:click={handleClick}> Convert </button>

  {#if code}
    {#await code}
      <p>Loading guesstimate model...</p>
    {:then code}
      <h1>Python code:</h1>
      <a href="https://colab.research.google.com/#create=true">
        Create new Colab notebook
      </a>
      <PrismJs code={code.python} language="python" />
      <Mermaid code={code.mermaid} />
      <h1>Squiggle code:</h1>
      <PrismJs code={code.squiggle} language="javascript" />
      <PlaygroundLink code={code.squiggle} />
    {:catch error}
      <p style="color: red">
        {error.message}
      </p>
    {/await}
  {/if}
</main>

<style>
  :root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }

  main {
    text-align: center;
    padding: 1em;
    margin: 0 auto;
  }

  h1 {
    margin: 2rem auto;
  }

  input,
  button {
    padding: 0.4em;
    margin: 0 0 0.5em 0;
    box-sizing: border-box;
    border: 1px solid #ccc;
    border-radius: 2px;
  }

  input {
    width: 40ch;
  }
</style>
