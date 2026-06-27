import { EventEmitter } from "node:events";
declare const CPU_TEMPERATURE_SOURCE = "systeminformation.cpuTemperature";
declare const LINUX_HWMON_SOURCE = "linux.hwmon";
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
export declare const getSensors: () => Promise<SensorsSnapshot>;
export declare const watchSensors: (options?: WatchSensorsOptions) => SensorsWatcher;
export declare const getSensorsWatchSnapshot: () => Promise<SensorsWatchSnapshot>;
export {};
