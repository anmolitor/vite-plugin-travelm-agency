import { defineConfig } from "vite";
import elmPlugin from "vite-plugin-elm";
import travelmAgencyPlugin from "../index";

export default defineConfig({
  plugins: [
    travelmAgencyPlugin({
      generatorMode: "dynamic",
    }),
    elmPlugin({ optimize: process.env.NODE_ENV === "production" }),
  ],
});
