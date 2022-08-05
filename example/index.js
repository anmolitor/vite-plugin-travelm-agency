import { Elm } from "./src/Main.elm";

fetch("/i18n/messages.en.json")
  .then((response) => response.json())
  .then((translations) => Elm.Main.init({ flags: translations }));
