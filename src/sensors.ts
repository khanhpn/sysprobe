import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { glob, readFile } from "node:fs/promises";
import si from "systeminformation";

const CPU_TEMPERATURE_SOURCE = "systeminformation.cpuTemperature";
const LINUX_HWMON_SOURCE = "linux.hwmon";
const MACOS_CPU_TEMP_SOURCE = "macos.osx-cpu-temp";
const MACOS_SMC_SOURCE = "macos.smc";

export interface CpuTemperatureSensor {
  supported: boolean;
  main: number | null;
  max: number | null;
  cores: Array<number | null>;
  source: typeof CPU_TEMPERATURE_SOURCE | typeof LINUX_HWMON_SOURCE | typeof MACOS_CPU_TEMP_SOURCE;
}

export interface FanSensor {
  supported: boolean;
  rpm: number | null;
  label: string | null;
  path: string;
  source: typeof LINUX_HWMON_SOURCE | typeof MACOS_SMC_SOURCE;
}

export interface SensorsSnapshot {
  cpuTemperature: CpuTemperatureSensor;
  fans: FanSensor[];
  warnings: string[];
}

export interface WatchSensorsOptions {
  intervalMs?: number;
  signal?: AbortSignal;
}

export interface SensorsWatchSnapshot {
  cpuUsagePercent: number | null;
  ramUsagePercent: number | null;
  sensors: SensorsSnapshot;
}

export interface SensorsWatcher extends EventEmitter {
  stop(): void;
}

export const getSensors = async (): Promise<SensorsSnapshot> => {
  const warnings: string[] = [];
  const cpuTemperature = await readCpuTemperature();
  const fans = await readFans();

  if (!cpuTemperature.supported) {
    warnings.push("CPU temperature is unsupported");
  }

  if (fans.length === 0) {
    warnings.push("Fan sensors are unsupported");
  }

  return {
    cpuTemperature,
    fans,
    warnings
  };
};

const readCpuTemperature = async (): Promise<CpuTemperatureSensor> => {
  const systeminformationTemperature = normalizeCpuTemperature(await si.cpuTemperature());

  if (systeminformationTemperature.supported) {
    return systeminformationTemperature;
  }

  return (await readLinuxHwmonTemperature()) ?? (await readMacosCpuTemperature()) ?? systeminformationTemperature;
};

const readFans = async (): Promise<FanSensor[]> => {
  const linuxFans = await readLinuxFans();
  return linuxFans.length > 0 ? linuxFans : await readMacosSmcFans();
};

export const watchSensors = (options: WatchSensorsOptions = {}): SensorsWatcher => {
  const intervalMs = Math.max(100, options.intervalMs ?? 1_000);
  const watcher = new EventEmitter() as SensorsWatcher;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const stop = () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const poll = async () => {
    try {
      watcher.emit("data", await getSensorsWatchSnapshot());
    } catch (error) {
      watcher.emit("error", error);
    } finally {
      if (!stopped) {
        timer = setTimeout(poll, intervalMs);
      }
    }
  };

  watcher.stop = stop;
  options.signal?.addEventListener("abort", stop, { once: true });
  queueMicrotask(() => void poll());

  return watcher;
};

export const getSensorsWatchSnapshot = async (): Promise<SensorsWatchSnapshot> => {
  const [load, memory, sensors] = await Promise.all([si.currentLoad(), si.mem(), getSensors()]);
  const ramUsagePercent =
    memory.total > 0 ? roundToOneDecimal(((memory.total - memory.available) / memory.total) * 100) : null;

  return {
    cpuUsagePercent: normalizeSensorNumber(roundToOneDecimal(load.currentLoad)),
    ramUsagePercent,
    sensors
  };
};

const normalizeCpuTemperature = (value: Awaited<ReturnType<typeof si.cpuTemperature>>): CpuTemperatureSensor => {
  const main = normalizeSensorNumber(value?.main);
  const max = normalizeSensorNumber(value?.max);
  const rawCores = Array.isArray(value?.cores) ? value.cores : [];
  const cores = rawCores.map(normalizeSensorNumber);

  return {
    supported: main !== null || max !== null || cores.some((core) => core !== null),
    main,
    max,
    cores,
    source: CPU_TEMPERATURE_SOURCE
  };
};

const readLinuxFans = async (): Promise<FanSensor[]> => {
  const fanPaths: string[] = [];

  try {
    for await (const path of glob("/sys/class/hwmon/*/fan*_input")) {
      fanPaths.push(path);
    }
  } catch {
    return [];
  }

  const fans = await Promise.all(fanPaths.map(readLinuxFan));
  return fans.filter((fan): fan is FanSensor => fan !== null);
};

const readLinuxHwmonTemperature = async (): Promise<CpuTemperatureSensor | null> => {
  const tempPaths: string[] = [];

  try {
    for await (const path of glob("/sys/class/hwmon/*/temp*_input")) {
      tempPaths.push(path);
    }
  } catch {
    return null;
  }

  const readings = (await Promise.all(tempPaths.map(readLinuxHwmonTemperatureValue))).filter(
    (reading): reading is number => reading !== null
  );

  if (readings.length === 0) {
    return null;
  }

  const main = readings[0] ?? null;
  const max = readings.reduce((highest, reading) => Math.max(highest, reading), readings[0]);

  return {
    supported: true,
    main,
    max,
    cores: [],
    source: LINUX_HWMON_SOURCE
  };
};

const readLinuxHwmonTemperatureValue = async (path: string): Promise<number | null> => {
  const rawValue = normalizeSensorNumber(await readOptionalFile(path));

  if (rawValue === null) {
    return null;
  }

  return rawValue > 1_000 ? rawValue / 1_000 : rawValue;
};

const readLinuxFan = async (path: string): Promise<FanSensor | null> => {
  const rpm = normalizeSensorNumber(await readOptionalFile(path));

  if (rpm === null) {
    return null;
  }

  return {
    supported: true,
    rpm,
    label: await readFanLabel(path),
    path,
    source: LINUX_HWMON_SOURCE
  };
};

const readFanLabel = async (path: string): Promise<string | null> => {
  const labelPath = path.replace(/_input$/, "_label");
  const label = await readOptionalFile(labelPath);
  return label === null || label === "" ? null : label;
};

const readMacosCpuTemperature = async (): Promise<CpuTemperatureSensor | null> => {
  const output = await execFileOptional("osx-cpu-temp", []);
  const temperature = normalizeSensorNumber(output?.match(/-?\d+(?:\.\d+)?/)?.[0]);

  if (temperature === null) {
    return null;
  }

  return {
    supported: true,
    main: temperature,
    max: temperature,
    cores: [],
    source: MACOS_CPU_TEMP_SOURCE
  };
};

const readMacosSmcFans = async (): Promise<FanSensor[]> => {
  const fans = await Promise.all(
    Array.from({ length: 8 }, async (_, index): Promise<FanSensor | null> => {
      const key = `F${index}Ac`;
      const output = await execFileOptional("smc", ["-k", key, "-r"]);
      const rpm = normalizeSensorNumber(output?.match(/-?\d+(?:\.\d+)?(?=\s*$)/m)?.[0]);

      if (rpm === null) {
        return null;
      }

      return {
        supported: true,
        rpm,
        label: `Fan ${index + 1}`,
        path: `smc:${key}`,
        source: MACOS_SMC_SOURCE
      };
    })
  );

  return fans.filter((fan): fan is FanSensor => fan !== null);
};

const execFileOptional = async (command: string, args: string[]): Promise<string | null> => {
  return await new Promise((resolve) => {
    execFile(command, args, (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
};

const readOptionalFile = async (path: string): Promise<string | null> => {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return null;
  }
};

const normalizeSensorNumber = (value: unknown): number | null => {
  if (value === -1 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const roundToOneDecimal = (value: number): number => {
  return Math.round(value * 10) / 10;
};
