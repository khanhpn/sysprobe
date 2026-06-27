# sysprobe

A small TypeScript system probe library and CLI for reading CPU temperature and Linux fan RPM sensors.

The package does not require `sudo`, does not control fan speed, and never fakes sensor values. Unsupported readings are reported as `unsupported` in the CLI and as `supported: false` or `null` in the API.

## Features

- Read CPU temperature when supported by the system
- Read Linux fan RPM sensors from `/sys/class/hwmon/*/fan*_input`
- Read storage, graphics/GPU, display, input device, and battery information
- Watch CPU, RAM, temperature, and fan readings in realtime
- CLI support for quick diagnostics
- TypeScript-first API
- Safe fallback behavior for unsupported hardware sensors

## Requirements

- Node.js 24 or newer
- pnpm for local development

CPU temperature readings use `systeminformation.cpuTemperature()` first. If that is unsupported, sysprobe tries Linux hwmon temperature files from `/sys/class/hwmon/*/temp*_input`, then the optional macOS `osx-cpu-temp` command.

Fan RPM readings use Linux `/sys/class/hwmon/*/fan*_input` files first. If no Linux fan sensors are available, sysprobe tries the optional macOS `smc` command.

Optional macOS helpers are not bundled. Install compatible helper commands separately if you want macOS temperature or fan support:

```sh
brew install osx-cpu-temp
# install an `smc` command compatible with: smc -k F0Ac -r
```

If those commands are unavailable, macOS temperature and fan values remain `unsupported`.

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

Read hardware details:

```sh
npx sysprobe hardware
```

Example output:

```text
Hardware
  Storage:
    1. Apple SSD | total: 953.9 GiB | used: 381.5 GiB | free: 572.4 GiB | health: Verified | serial: SSD123
  GPU:
    1. Apple Apple M3 | vram: unknown | temp: 55°C
  Displays:
    1. Color LCD | 1512x982 | 120 Hz | serial: DISPLAY123
  Battery: 65%
  Keyboards: USB Keyboard
  Mice: Magic Mouse
  Trackpads: Magic Trackpad
```

Read detailed macOS-style hardware categories when `system_profiler` is available:

```sh
npx sysprobe hardware --details
```

This includes categories such as Hardware, Memory, NVMExpress, Storage, Graphics/Displays, Power, USB, Bluetooth, Audio, Camera, Card Reader, Ethernet, Network, Thunderbolt/USB4, Printers, PCI, and SATA.

## Library API

```ts
import { getHardware, getSensors, watchSensors } from "sysprobe";

const snapshot = await getSensors();
const hardware = await getHardware();

console.log(snapshot.cpuTemperature.main);
console.log(snapshot.fans);
console.log(hardware.storage);
console.log(hardware.gpus);
console.log(hardware.displays);

const watcher = watchSensors({ intervalMs: 1000 });

watcher.on("data", (snapshot) => {
  console.log(snapshot.cpuUsagePercent, snapshot.ramUsagePercent);
});

watcher.stop();
```

## Sensor Support

CPU temperature and fan speed readings are collected on a best-effort basis.

Hardware details are collected from `systeminformation` providers such as `fsSize()`, `diskLayout()`, `blockDevices()`, `graphics()`, `battery()`, `usb()`, and `bluetoothDevices()`.

Detailed hardware categories are collected from macOS `system_profiler -json` when available.

Not all systems expose temperature, fan, storage health, serial numbers, input devices, or battery data. When a value cannot be read, sysprobe returns `null`, `unknown`, or an unsupported state instead of fake or unreliable values.

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
