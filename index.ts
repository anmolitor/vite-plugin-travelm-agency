import fs from "fs/promises";
import path from "path";
import * as T from "travelm-agency";

import { Plugin } from "vite";

const getTranslationFilePaths = async (dir: string) => {
  const files = await fs.readdir(dir);
  return files.map((file) => path.resolve(dir, file));
};

export default (options: T.Options): Plugin => {
  const jsonFiles = new Map<string, string>();
  let triggerReload = () => {};

  async function runTravelmAgency(
    translationFilePaths: string[],
    devMode: boolean
  ) {
    await T.sendTranslations(translationFilePaths, devMode);
    const responseContent = await T.finishModule({ ...options, devMode });

    const shouldBeWritten = await fs
      .readFile(options.elmPath, {
        encoding: "utf-8",
      })
      .then((data) => data !== responseContent.elmFile)
      .catch(() => true);

    if (shouldBeWritten) {
      await fs.writeFile(options.elmPath, responseContent.elmFile);
    }

    if (options.generatorMode === "dynamic") {
      responseContent.optimizedJson.forEach(
        (file) => {
          const expectedRequestPath =
            "/" +
            path
              .normalize(`${options.jsonPath}/${file.filename}`)
              .replace(path.sep, "/");
          jsonFiles.set(expectedRequestPath, file.content);
        }
        //   this.emitFile({
        //     fileName: path.join(options.jsonPath, file.filename),
        //     source: file.content,
        //     type: "asset",
        //   })
      );
    }
  }

  return {
    name: "travelm-agency-plugin",
    buildStart: async function (this) {
      const filePaths = await getTranslationFilePaths(options.translationDir);
      await runTravelmAgency(filePaths, false);
    },
    handleHotUpdate: async function ({ file }) {
      const relativePath = path.relative(
        path.resolve(options.translationDir),
        file
      );
      if (relativePath.startsWith("..")) {
        return;
      }
      const filePaths = await getTranslationFilePaths(options.translationDir);
      await runTravelmAgency(filePaths, false);
      triggerReload();
    },
    load(this, id, options) {
      console.log("LOADING", id, options);
    },
    configureServer(server) {
      console.log("CONFIGURE SERVER");
      triggerReload = () => server.ws.send({ type: "full-reload", path: "*" });
      server.middlewares.use((req, res, next) => {
        console.log(req.url, jsonFiles);
        const i18nFileContent = req.url && jsonFiles.get(req.url);
        if (i18nFileContent) {
          console.log("FOUND!");
          res.write(i18nFileContent);
          res.end();
          return;
        }
        next();
      });
    },
  };
};
