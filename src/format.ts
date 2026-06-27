import type { SensorsSnapshot, SensorsWatchSnapshot } from "./sensors.js";

export const formatSensorsSnapshot = (snapshot: SensorsSnapshot): string => {
  const lines = [
    "Sensors",
    `  CPU Temp: ${formatTemperature(snapshot.cpuTemperature.main)}`,
    `  CPU Max : ${formatTemperature(snapshot.cpuTemperature.max)}`
  ];

  snapshot.fans.forEach((fan, index) => {
    lines.push(`  Fan ${index + 1}   : ${formatFanRpm(fan.rpm)}`);
  });

  return lines.join("\n");
};

export const formatSensorsWatchLine = (snapshot: SensorsWatchSnapshot): string => {
  const firstFan = snapshot.sensors.fans[0]?.rpm ?? null;

  return [
    `CPU: ${formatPercent(snapshot.cpuUsagePercent)}`,
    `RAM: ${formatPercent(snapshot.ramUsagePercent)}`,
    `Temp: ${formatTemperature(snapshot.sensors.cpuTemperature.main)}`,
    `Fan: ${formatFanRpm(firstFan)}`
  ].join(" | ");
};

const formatTemperature = (value: number | null): string => {
  return value === null ? "unsupported" : `${value}°C`;
};

const formatFanRpm = (value: number | null): string => {
  return value === null ? "unsupported" : `${value} RPM`;
};

const formatPercent = (value: number | null): string => {
  return value === null ? "unsupported" : `${value.toFixed(1)}%`;
};
