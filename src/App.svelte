<script lang="ts">
  import { getSquiggleCode } from "./lib/squigglefy";
  import PrismJs from "./lib/PrismJS.svelte";
  import PlaygroundLink from "./lib/PlaygroundLink.svelte";

  let squiggleCode: Promise<string> | null = null;
  let guessTimateUrl = "";

  async function getGuesstimateData(guessTimateUrl: string) {
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

    return await response.json();
  }

  async function squigglify() {
    const guesstimateData = await getGuesstimateData(guessTimateUrl);
    if (!guesstimateData) {
      throw Error("Error fetching guesstimate model: no data");
    }
    return getSquiggleCode(guesstimateData);
  }

  function handleClick() {
    squiggleCode = squigglify();
  }
</script>

<main>
  <h1>Guesstimate to Squiggle</h1>
  <input
    bind:value={guessTimateUrl}
    placeholder="https://www.getguesstimate.com/models/1234"
  />
  <button on:click={handleClick}> Squigglify </button>

  {#if squiggleCode}
    {#await squiggleCode}
      <p>Loading guesstimate model...</p>
    {:then code}
      <PrismJs {code} />
      <PlaygroundLink {code} />
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
