import { resolve } from "path";
import { defineConfig } from "vite";
import elmPlugin from "vite-plugin-elm";
import travelmAgencyPlugin from "../index";

export default defineConfig({
  plugins: [
    travelmAgencyPlugin({
      generatorMode: "inline",
      elmPath: "generated/InlineTranslations.elm",
    }),
    travelmAgencyPlugin({
      generatorMode: "dynamic",
      elmPath: "generated/DynamicTranslations.elm",
    }),
    elmPlugin({ optimize: process.env.NODE_ENV === "production" }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dynamic: resolve(__dirname, 'dynamic.html')
      }
    }
  }
});
