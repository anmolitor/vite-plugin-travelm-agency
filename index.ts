import fs from "fs/promises";
import path from "path";
import * as T from "travelm-agency";

import { Plugin } from "vite";

const getTranslationFilePaths = async (dir: string) => {
  const files = await fs.readdir(dir);
  return files.map((file) => path.resolve(dir, file));
};

async function runTravelmAgency(
  options: T.Options,
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
}

export default (options: T.Options): Plugin => ({
  name: "travelm-agency-plugin",
  buildStart: async function (this) {
    console.log("Running travelm-agency.");
    const filePaths = await getTranslationFilePaths(options.translationDir);
    filePaths.map((filePath) => {
      this.addWatchFile(filePath);
    });
    await runTravelmAgency(options, filePaths, false);
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
    await runTravelmAgency(options, filePaths, false);
  },
});
