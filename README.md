# sysprobe

A small TypeScript system probe library and CLI for reading CPU temperature and Linux fan RPM sensors.

The package does not require `sudo`, does not control fan speed, and never fakes sensor values. Unsupported readings are reported as `unsupported` in the CLI and as `supported: false` or `null` in the API.

## Features

- Read CPU temperature when supported by the system
- Read Linux fan RPM sensors from `/sys/class/hwmon/*/fan*_input`
- Watch CPU, RAM, temperature, and fan readings in realtime
- CLI support for quick diagnostics
- TypeScript-first API
- Safe fallback behavior for unsupported hardware sensors

## Requirements

- Node.js 24 or newer
- pnpm for local development

Linux fan RPM readings use `/sys/class/hwmon/*/fan*_input`.

CPU temperature readings use `systeminformation.cpuTemperature()`.

Sensor availability depends on the operating system, hardware vendor, drivers, permissions, and whether the sensor data is exposed by the system.

## Installation

```sh
npm install sysprobe
```

Or with pnpm:

```sh
pnpm add sysprobe
```

## CLI

Run a one-time sensor snapshot:

```sh
npx sysprobe sensors
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
npx sysprobe watch --sensors
```

Example output:

```text
CPU: 18.4% | RAM: 61.2% | Temp: 62°C | Fan: 1280 RPM
```

## Library API

```ts
import { getSensors, watchSensors } from "sysprobe";

const snapshot = await getSensors();

console.log(snapshot.cpuTemperature.main);
console.log(snapshot.fans);

const watcher = watchSensors({ intervalMs: 1000 });

watcher.on("data", (snapshot) => {
  console.log(snapshot.cpuUsagePercent, snapshot.ramUsagePercent);
});

watcher.stop();
```

## Sensor Support

CPU temperature and fan speed readings are collected on a best-effort basis.

Not all systems expose temperature or fan sensor data. When a value cannot be read, sysprobe returns an unsupported state instead of fake or unreliable values.

This package is read-only. It does not control fan speed, modify hardware settings, or require `sudo`.

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

## License

MIT
