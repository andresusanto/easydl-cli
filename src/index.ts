#!/usr/bin/env node

import EasyDL from "easydl";
import * as utils from "easydl/dist/utils";
import path from "path";
import inquirer from "inquirer";
import program from "commander";
import figlet from "figlet";
import chalk from "chalk";
import formatBytes from "pretty-bytes";
import formatTime from "pretty-ms";
import { MultiBar, Presets, SingleBar } from "cli-progress";

let url: string | null = null;
let saveLocation: string | null = "";
let connections: number = 5;
let chunkSize: number = 0;
let cleanMode = false;

program
  .name("dl")
  .usage("url [destination file/folder] [options]")
  .version("1.0.0")
  .description(
    "Easily download files with built-in support for resume and parallel downloads."
  )
  .arguments("[url] [save location]")
  .option("--chunk-size <number>", "Chunk size in bytes", parseInt)
  .option(
    "-c, --connections <number>",
    "Number of parallel connections",
    parseInt
  )
  .option(
    "-C, --clean [location]",
    "Clean the given directory from chunk files. Defaults to active directory"
  )
  .action((_url, save, options) => {
    url = _url;
    saveLocation = save;
    if (options && options.connections) {
      connections = options.connections;
    }
    if (options && options["chunk-size"]) {
      chunkSize = options["chunk-size"];
    }
    if (options && options.clean !== undefined) {
      cleanMode = options.clean;
    }
  })
  .parse(process.argv);

(async () => {
  if (cleanMode) {
    if (cleanMode !== true && saveLocation) {
      console.log(
        chalk.bold.red("ERROR: "),
        "Ambigious cleaning request. Could not decide which one to be cleaned:",
        chalk.bold(saveLocation),
        "or",
        chalk.bold(cleanMode),
        ". Please remove one of them to continue."
      );
      process.exit(1);
    }

    console.log(chalk.red(figlet.textSync("EasyDL")));
    if (url) console.log(chalk.bold.green("URL:"), url);
    if (saveLocation) console.log(chalk.bold.green("LOC:"), saveLocation);
    console.log(
      chalk.bold.yellow("NOTICE: "),
      chalk.bold("Running with clean mode")
    );

    const dir =
      cleanMode !== true ? cleanMode : path.resolve(saveLocation || "./");

    const { clean } = await inquirer.prompt([
      {
        name: "clean",
        type: "confirm",
        message: `[Clean Mode] Are you sure want to clean "${dir}"?`,
      },
    ]);

    if (clean) {
      const files = await utils.clean(dir);
      for (let file of files) {
        console.log("Removed file", file);
      }
      console.log(`${dir} is cleaned successfully`);

      if (!url) process.exit(0);
    } else {
      process.exit(0);
    }
  }

  if (!url) {
    console.log(chalk.red(figlet.textSync("EasyDL")));
    program.help();
  }

  const completeStringParts = Presets.rect.barCompleteChar.repeat(40);
  const incompleteStringParts = Presets.rect.barIncompleteChar.repeat(40);
  const completeStringTotal = Presets.shades_classic.barCompleteChar.repeat(40);
  const incompleteStringTotal = Presets.shades_classic.barIncompleteChar.repeat(
    40
  );

  const refProgress: SingleBar[] = [];
  const multibar = new MultiBar({
    clearOnComplete: false,
    format: (options, params, payload) => {
      const { id, text, total, speed, groupStart, groupEnd } = payload;
      if (text) return text;

      const completeStr = total ? completeStringTotal : completeStringParts;
      const incompleteStr = total
        ? incompleteStringTotal
        : incompleteStringParts;
      const completeSize = Math.round(
        params.progress * <number>options.barsize
      );
      const incompleteSize = <number>options.barsize - completeSize;
      const completeBarText = completeStr.substr(0, completeSize);
      const completeBar = total
        ? chalk.green(completeBarText)
        : completeBarText;
      const bar = `${completeBar}${incompleteStr.substr(0, incompleteSize)}`;

      let eta = "N/A";
      let speedTxt = "N/A";
      const value = formatBytes(params.value);
      const percent = (params.progress * 100).toFixed(2);

      const etaVal = params.eta * 1000;
      if (etaVal === etaVal) eta = formatTime(etaVal);
      if (speed !== Infinity && speed === speed) speedTxt = formatBytes(speed);

      if (total)
        return ` |${bar} ${percent}% | ETA: ${eta} | ${value} | ${speedTxt}/s`;

      return `#${id} |${bar} ${percent}% | ${speedTxt}/s${
        groupEnd ? ` | Chunk #${groupStart}-${groupEnd}` : ""
      }`;
    },
  });

  let error: Error | null = null;
  let finalPath: string = saveLocation;
  const friendlyFileName = path.posix.basename(url);
  await new EasyDL(url, saveLocation || "./", {
    reportInterval: 300,
    chunkSize: chunkSize
      ? chunkSize
      : (size) => {
          return Math.min(size / 10, 10 * 1024 * 1024);
        },
    connections,
  })
    .on("metadata", ({ chunks, size, savedFilePath }) => {
      finalPath = savedFilePath;
      multibar.create(0, 0, {
        text: `Downloading ${chalk.bold(friendlyFileName)} ${
          size ? `(${formatBytes(size)}) ` : ""
        }...`,
      });

      if (chunks.length > 10) {
        const groupSize = Math.floor(chunks.length / 10);
        const rem = chunks.length % 10;
        let k = 0;
        for (let i = 0; i < 10; i += 1) {
          let n = i < rem ? groupSize + 1 : groupSize;
          let bytes = 0;
          const groupStart = k;
          for (let j = 0; j < n; j += 1) {
            bytes += chunks[k];
            k += 1;
          }
          refProgress.push(
            multibar.create(bytes, 0, {
              id: i,
              speed: 0,
              groupStart,
              groupEnd: k,
            })
          );
        }
      } else {
        for (let i = 0; i < chunks.length; i += 1) {
          refProgress.push(multibar.create(chunks[i], 0, { id: i, speed: 0 }));
        }
      }
      multibar.create(0, 0, { text: " " });
      multibar.create(0, 0, { text: chalk.bold.green("TOTAL") });
      refProgress.push(multibar.create(size, 0, { total: true, speed: 0 }));
      multibar.create(0, 0, { text: " " });
    })
    .on("progress", ({ total, details }) => {
      if (details.length > 10) {
        const groupSize = Math.floor(details.length / 10);
        const rem = details.length % 10;
        let k = 0;
        for (let i = 0; i < 10; i += 1) {
          let n = i < rem ? groupSize + 1 : groupSize;
          let bytes = 0;
          let totalSpeed = 0;
          const groupStart = k;
          for (let j = 0; j < n; j += 1) {
            bytes += <number>details[k].bytes;
            totalSpeed += <number>details[k].speed;
            k += 1;
          }
          refProgress[i].update(bytes, {
            id: i,
            speed: totalSpeed,
            groupStart,
            groupEnd: k,
          });
        }
      } else {
        for (let i = 0; i < details.length; i += 1) {
          const detail = details[i];
          refProgress[i].update(<number>detail.bytes, {
            id: i,
            speed: <number>detail.speed,
          });
        }
      }
      refProgress[refProgress.length - 1].update(<number>total.bytes, {
        total: true,
        speed: <number>total.speed,
      });
    })
    .on("error", (err) => {
      error = err;
    })
    .wait();

  multibar.stop();

  if (!error) {
    console.log(chalk.bold("Done!"), "file saved to:");
    console.log(finalPath);
  } else {
    console.log(chalk.red(figlet.textSync("EasyDL")));
    console.log("");
    console.log(chalk.bold.redBright("ERROR:"), (error as Error).message);
  }
})();
