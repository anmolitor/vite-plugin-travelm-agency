import { Elm } from "./src/Main.elm";
// We can get the file paths for our translations in javascript.
// This can be useful e.g. if we want to load the Elm code and the translation file
// in parallel.
import translationMap from "virtual:travelm-agency";

// This demonstrates how to use the file path map to preload the english translations in JS
fetch(translationMap["messages.en"])
  .then((response) => response.json())
  .then((translations) => Elm.Main.init({ flags: translations }));
