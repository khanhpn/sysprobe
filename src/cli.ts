#!/usr/bin/env node
import { getSensors, watchSensors } from "./index.js";
import { formatSensorsSnapshot, formatSensorsWatchLine } from "./format.js";

const args = process.argv.slice(2);

try {
  if (args[0] === "sensors") {
    console.log(formatSensorsSnapshot(await getSensors()));
  } else if (args[0] === "watch" && args.includes("--sensors")) {
    const watcher = watchSensors();
    const stop = () => watcher.stop();

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);

    watcher.on("data", (snapshot) => {
      console.log(formatSensorsWatchLine(snapshot));
    });

    watcher.on("error", (error) => {
      console.error(error instanceof Error ? error.message : String(error));
    });
  } else {
    console.error("Usage: sysprobe sensors | sysprobe watch --sensors");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
