# @khanh/sysprobe

A small TypeScript system probe library and CLI for reading CPU temperature and Linux fan RPM sensors.

The package does not require `sudo`, does not control fan speed, and never fakes sensor values. Unsupported readings are reported as `unsupported` in the CLI and as `supported: false` or `null` in the API.

## Requirements

- Node.js 24 or newer
- pnpm for local development

Linux fan RPM readings use `/sys/class/hwmon/*/fan*_input`. CPU temperature readings use `systeminformation.cpuTemperature()`.

## CLI

Run a one-time sensor snapshot:

```sh
npx @khanh/sysprobe sensors
```

Example output:

```text
Sensors
  CPU Temp: 62°C
  CPU Max : 71°C
  Fan 1   : 1280 RPM
  Fan 2   : 940 RPM
```

Watch CPU, RAM, temperature, and the first fan once per second:

```sh
npx @khanh/sysprobe watch --sensors
```

Example output:

```text
CPU: 18.4% | RAM: 61.2% | Temp: 62°C | Fan: 1280 RPM
```

## Library API

```ts
import { getSensors, watchSensors } from "@khanh/sysprobe";

const snapshot = await getSensors();
console.log(snapshot.cpuTemperature.main);
console.log(snapshot.fans);

const watcher = watchSensors({ intervalMs: 1000 });
watcher.on("data", (snapshot) => {
  console.log(snapshot.cpuUsagePercent, snapshot.ramUsagePercent);
});

watcher.stop();
```

## Development

Install dependencies:

```sh
pnpm install
```

Run unit tests:

```sh
pnpm test
```

Run linting and formatting checks:

```sh
pnpm lint
pnpm format:check
```

Build the package:

```sh
pnpm build
```
