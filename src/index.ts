#!/usr/bin/env node

import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import ignore from "ignore";
import log, { LogLevelDesc } from "loglevel";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

//////////////////////////
// CONST
//////////////////////////

const DEFAULT_LOG_LEVEL = "info";
const EXTENSIONS_TO_PROCESS = [".ts"];
const DEFAULT_IGNORE_FILE = "dist/ node_modules/ bin/";

const ig = getIgnoreConfig();

log.setDefaultLevel(DEFAULT_LOG_LEVEL);

//////////////////////////
// HELPER METHODS
//////////////////////////

function getIgnoreConfig(ignorePath = ".gitignore") {
  let ignoreFile = DEFAULT_IGNORE_FILE;

  try {
    ignoreFile = fsSync.readFileSync(ignorePath, "utf8");
  } catch (error) {
    log.warn(
      `Could not read ${ignorePath}, using default ignore configuration: '${ignoreFile}'`
    );
  }

  return ignore().add(ignoreFile);
}

const isPathIgnored = (filePath: string) =>
  path.resolve(filePath) !== path.resolve("./") &&
  (ig.ignores(filePath) || filePath.includes(".git"));

function resolveRelativePath(basePath: string, relativePath: string): string {
  const baseDir = path.dirname(basePath);
  const resolvedPath = path.resolve(baseDir, relativePath);
  return resolvedPath;
}

function isDirectorySync(filePath: string) {
  try {
    return fsSync.statSync(filePath).isDirectory();
  } catch (error) {
    return false;
  }
}

//////////////////////////
// PROCESSING LOGIC
//////////////////////////

async function processFile(filePath: string) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");

    const updatedData = fileContent.replace(
      /(import|export)\s+({[^}]*}|[^]*?)\s+from\s+['"]((?:\.{1,2}\/)+.*?)['"]/g,
      (match, verb, imports, modulePath) => {
        // Check for directory imports
        const resolvedPath = resolveRelativePath(filePath, modulePath);
        if (isDirectorySync(resolvedPath)) {
          if (
            fsSync.existsSync(path.join(resolvedPath, "index.ts")) ||
            fsSync.existsSync(path.join(resolvedPath, "index.d.ts"))
          ) {
            modulePath = `./${path.join(modulePath, "index.js")}`;
            log.debug("Converted from default dir import:", modulePath);
          } else {
            throw new Error(
              `Could not resolve default import from dir: ${modulePath}, file: ${resolvedPath}`
            );
          }
          // TODO - Process package.json to extract file path?
        }

        const newModulePath = `${
          path.extname(modulePath) ? modulePath : `${modulePath}.js`
        }`;
        return `${verb} ${imports} from "${newModulePath}"`;
      }
    );

    await fs.writeFile(filePath, updatedData, "utf8");
    log.info("FILE updated ->", filePath);
  } catch (error) {
    log.warn(`ERROR: Exception when processing file ${filePath}:`, error);
  }
}

async function processDirectory(directoryPath: string) {
  if (isPathIgnored(directoryPath)) {
    log.debug("DIR [ignored] ->", directoryPath);
    return;
  }

  log.info("DIR ->", directoryPath);
  try {
    for (const file of await fs.readdir(directoryPath)) {
      const filePath = path.join(directoryPath, file);
      await processPath(filePath);
    }
  } catch (error) {
    log.warn(
      `ERROR: Exception when processing directory ${directoryPath}:`,
      error
    );
  }
}

async function processPath(filePath: string) {
  try {
    if ((await fs.stat(filePath)).isDirectory()) {
      await processDirectory(filePath);
    } else if (EXTENSIONS_TO_PROCESS.includes(path.extname(filePath))) {
      await processFile(filePath);
    }
  } catch (error) {
    log.warn(`ERROR: Exception when processing path ${filePath}:`, error);
  }
}

//////////////////////////
// MAIN
//////////////////////////

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .demandCommand(1)
    .option("logLevel", {
      describe: `Log verbosity (default: ${DEFAULT_LOG_LEVEL})`,
      type: "string",
      choices: ["trace", "debug", "info", "warn", "error"],
    })
    .help("h")
    .alias("h", "help")
    .version("v")
    .alias("v", "version").argv;

  if (argv.logLevel) {
    log.setLevel(argv.logLevel as LogLevelDesc);
    log.info(`Using log level`, argv.logLevel);
  }

  const filePath = argv._.pop();
  if (typeof filePath !== "string") {
    throw new Error(`Invalid file path: ${filePath}`);
  }

  await processPath(filePath);
}

main().catch((error) => {
  log.error("ERROR:", error);
});
