import fs from "fs/promises";
import path from "path";
import { PluginContext } from "rollup";
import * as T from "travelm-agency";

import { Plugin } from "vite";

const getTranslationFilePaths = async (dir: string) => {
  const files = await fs.readdir(dir);
  return files.map((file) => path.resolve(dir, file));
};

type EmitFile = (file: { filename: string; content: string }) => void;

interface Options {
  translationDir: string;
  elmPath: string;
  generatorMode: "inline" | "dynamic";
  i18nArgFirst: boolean;
  addContentHash: boolean;
  jsonPath: string;
  prefixFileIdentifier: boolean;
}

export function travelmAgencyPlugin(options: Partial<Options>): Plugin {
  const translationDir = options.translationDir || "translations";
  const elmPath = options.elmPath || "src/Translations.elm";
  const generatorMode = options.generatorMode || "inline";
  const i18nArgFirst = !!options.i18nArgFirst;
  const addContentHash =
    options.addContentHash === undefined ? true : options.addContentHash;
  const jsonPath = options.jsonPath || "i18n";
  const prefixFileIdentifier = !!options.prefixFileIdentifier;

  const travelmOptions: T.Options =
    generatorMode === "inline"
      ? {
          translationDir,
          elmPath,
          generatorMode,
          i18nArgFirst,
          addContentHash,
          devMode: true,
          prefixFileIdentifier,
        }
      : {
          translationDir,
          elmPath,
          generatorMode,
          i18nArgFirst,
          addContentHash,
          jsonPath,
          devMode: true,
          prefixFileIdentifier,
        };

  const virtualModuleId = "virtual:travelm-agency";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  const jsonFiles = new Map<string, string>();
  const fileNameToReqPaths = new Map<string, string>();

  let triggerReload = () => {};
  let activeLanguage: string | undefined;

  function setActiveLanguage(path: string) {
    const pathSplitByDot = path.split(".");
    activeLanguage = pathSplitByDot[pathSplitByDot.length - 2];
  }

  function isTranslationFileActive(path: string) {
    const pathSplitByDot = path.split(".");
    return activeLanguage === pathSplitByDot[pathSplitByDot.length - 2];
  }

  async function runTravelmAgency(
    translationFilePaths: string[],
    emitFile?: EmitFile
  ) {
    const devMode = emitFile === undefined;
    await T.sendTranslations(translationFilePaths, devMode);
    const responseContent = await T.finishModule({
      ...travelmOptions,
      devMode,
    });

    const shouldBeWritten = await fs
      .readFile(elmPath, {
        encoding: "utf-8",
      })
      .then((data) => data !== responseContent.elmFile)
      .catch(() => true);

    if (shouldBeWritten) {
      await fs.writeFile(elmPath, responseContent.elmFile);
    }

    if (generatorMode === "dynamic") {
      responseContent.optimizedJson.forEach((file) => {
        const expectedRequestPath =
          "/" +
          path.normalize(`${jsonPath}/${file.filename}`).replace(path.sep, "/");
        if (addContentHash) {
          const [identifier, language, _hash, _ext] = file.filename.split(".");
          const fileNameWithoutHash = [identifier, language].join(".");
          const oldReqPath = fileNameToReqPaths.get(fileNameWithoutHash);
          oldReqPath && jsonFiles.delete(oldReqPath);
          fileNameToReqPaths.set(fileNameWithoutHash, expectedRequestPath);
        } else {
          const [identifier, language, _ext] = file.filename.split(".");
          const fileNameWithoutHash = [identifier, language].join(".");
          fileNameToReqPaths.set(fileNameWithoutHash, expectedRequestPath);
        }
        jsonFiles.set(expectedRequestPath, file.content);
        if (emitFile !== undefined) {
          emitFile(file);
        }
      });
    }
  }

  return {
    name: "travelm-agency-plugin",
    buildStart: async function (this: PluginContext) {
      const filePaths = await getTranslationFilePaths(translationDir);
      function emitFile(
        this: PluginContext,
        file: { filename: string; content: string }
      ) {
        if (generatorMode === "inline") {
          throw new Error(
            "We somehow tried to emit a file in inline mode. This should not happen."
          );
        }
        this.emitFile({
          type: "asset",
          fileName: path.join(jsonPath, file.filename),
          source: file.content,
        });
      }
      const emit = this.meta.watchMode ? undefined : emitFile.bind(this);
      await runTravelmAgency(filePaths, emit);
    },
    handleHotUpdate: async function ({ file }) {
      const relativePath = path.relative(path.resolve(translationDir), file);
      if (relativePath.startsWith("..")) {
        return;
      }
      const filePaths = await getTranslationFilePaths(translationDir);
      await runTravelmAgency(filePaths);
      if (isTranslationFileActive(relativePath)) {
        triggerReload();
      }
    },
    resolveId(id) {
      if (id !== virtualModuleId) {
        return;
      }
      return resolvedVirtualModuleId;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return;
      }
      return `export default {
        ${[...fileNameToReqPaths.entries()]
          .map(([key, value]) => `'${key}': '${value}'`)
          .join(",")}
      }`;
    },
    configureServer(server) {
      triggerReload = () => server.ws.send({ type: "full-reload", path: "*" });
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        const i18nFileContent = jsonFiles.get(req.url);
        if (!i18nFileContent) {
          next();
          return;
        }
        setActiveLanguage(req.url);
        res.setHeader("content-type", "application/json");
        res.write(i18nFileContent);
        res.end();
      });
    },
  };
}
