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
  defaultLanguage: string;
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
  const htmls = new Map<string, string>();

  let triggerReload = () => {};
  let activeLanguage: string | undefined;

  function isTranslationFileActive(path: string) {
    const pathSplitByDot = path.split(".");
    return activeLanguage === pathSplitByDot[pathSplitByDot.length - 2];
  }

  async function runTravelmAgency(
    translationFilePaths: string[],
    emitFile?: EmitFile
  ) {
    const devMode = emitFile === undefined;
    const makeSureDirExists = fs.mkdir(path.dirname(elmPath), {
      recursive: true,
    });
    const travelmAgency = T.createInstance();
    await travelmAgency.sendTranslations(translationFilePaths, devMode);
    const responseContent = await travelmAgency.finishModule({
      ...travelmOptions,
      devMode,
    });
    await makeSureDirExists;

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

  let languages: Set<String> | undefined;

  function getLanguages(): Set<String> {
    if (languages) {
      return languages;
    }
    const temp = new Set(
      Array.from(fileNameToReqPaths.keys())
        .map((filename) => filename.split("."))
        .map((segments) => segments[segments.length - 1])
    );
    languages = temp;

    return temp;
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
    transformIndexHtml: {
      order: "pre",
      handler(html, { path: htmlPath }) {
        const regexp = /__TRAVELM_AGENCY_([^_]*(_[^_]+)*)__/g;
        const matches = Array.from(html.matchAll(regexp));
        if (matches.length == 0) {
          return;
        }
        const languages = getLanguages();

        const baseDir = path.dirname(htmlPath);
        let defaultHtml = "";

        for (const language of languages.keys()) {
          let langFileName = path.join(
            baseDir,
            `${language}/${path.basename(htmlPath)}`
          );
          let newHtml = "";
          let lastIndex = 0;

          for (const match of matches) {
            newHtml += html.slice(lastIndex, match.index);
            const bundleName = match[1];
            const reqPath = fileNameToReqPaths.get(`${bundleName}.${language}`);
            if (!reqPath) {
              throw new Error(
                `Unknown bundleName/language '${bundleName}'/'${language}'. Correct syntax is __TRAVELM_AGENCY_bundleName__.`
              );
            }
            const json = jsonFiles.get(reqPath);
            if (!json) {
              throw new Error(
                `Could not find generated json for path ${reqPath}`
              );
            }
            newHtml += json;
            lastIndex = match.index + match[0].length;
          }

          newHtml += html.slice(lastIndex);

          if (language === (activeLanguage ?? options.defaultLanguage)) {
            defaultHtml = newHtml;
          } else {
            htmls.set(langFileName, newHtml);
          }
        }

        if (defaultHtml === "") {
          const someLanguage = languages.keys().next();
          throw new Error(
            `Please set the "defaultLanguage" plugin option to one of your languages, e.g. to '${someLanguage}'`
          );
        }

        return defaultHtml;
      },
    },
    async generateBundle(this: PluginContext) {
      htmls.forEach((html, path) => {
        this.emitFile({
          type: "asset",
          fileName: path.slice(1), // remove leading slash
          source: html,
        });
      });
    },
    configureServer(server) {
      triggerReload = () => server.ws.send({ type: "full-reload", path: "*" });
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        const i18nFileContent = jsonFiles.get(req.url);
        if (i18nFileContent) {
          const pathSplitByDot = req.url.split(".");
          activeLanguage = pathSplitByDot[pathSplitByDot.length - 2];
          res.setHeader("content-type", "application/json");
          res.write(i18nFileContent);
          res.end();
          return;
        }

        if (req.url.endsWith(".html")) {
          const pathSplitBySlash = req.url.split("/");
          const language = pathSplitBySlash[pathSplitBySlash.length - 2];
          if (getLanguages().has(language)) {
            req.url = req.url.replace("/" + language + "/", "/");
            activeLanguage = language;
          }
        }

        next();
      });
    },
  };
}
