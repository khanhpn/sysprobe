import { EventEmitter } from "node:events";
import { glob, readFile } from "node:fs/promises";
import si from "systeminformation";

const CPU_TEMPERATURE_SOURCE = "systeminformation.cpuTemperature";
const LINUX_HWMON_SOURCE = "linux.hwmon";

export interface CpuTemperatureSensor {
  supported: boolean;
  main: number | null;
  max: number | null;
  cores: Array<number | null>;
  source: typeof CPU_TEMPERATURE_SOURCE;
}

export interface FanSensor {
  supported: boolean;
  rpm: number | null;
  label: string | null;
  path: string;
  source: typeof LINUX_HWMON_SOURCE;
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
  const cpuTemperature = normalizeCpuTemperature(await si.cpuTemperature());
  const fans = await readLinuxFans();

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
