import { defineConfig } from "vite";
import elmPlugin from "vite-plugin-elm";
import travelmAgencyPlugin from "../index";

export default defineConfig({
  plugins: [
    travelmAgencyPlugin({
      devMode: true,
      translationDir: "translations",
      elmPath: "src/Translations.elm",
      generatorMode: "inline",
      i18nArgFirst: false,
      addContentHash: false,
    }),
    elmPlugin({ optimize: process.env.NODE_ENV === "production" }),
  ],
});
