#!/usr/bin/env node
import { getHardware, getHardwareDetails, getSensors, watchSensors } from "./index.js";
import { formatHardwareDetailsSnapshot } from "./hardware-details-format.js";
import { formatHardwareSnapshot } from "./hardware-format.js";
import { formatSensorsSnapshot, formatSensorsWatchLine } from "./format.js";

const args = process.argv.slice(2);

try {
  if (args[0] === "sensors") {
    console.log(formatSensorsSnapshot(await getSensors()));
  } else if (args[0] === "hardware" && args.includes("--details")) {
    console.log(formatHardwareDetailsSnapshot(await getHardwareDetails()));
  } else if (args[0] === "hardware") {
    console.log(formatHardwareSnapshot(await getHardware()));
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
    console.error("Usage: sysprobe sensors | sysprobe hardware | sysprobe watch --sensors");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
