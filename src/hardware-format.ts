import type { HardwareSnapshot } from "./hardware.js";

export const formatHardwareSnapshot = (snapshot: HardwareSnapshot): string => {
  const lines = ["Hardware"];

  lines.push("  Storage:");
  snapshot.storage.forEach((storage, index) => {
    lines.push(
      `    ${index + 1}. ${storage.name ?? "unknown"} | total: ${formatBytes(storage.totalBytes)} | used: ${formatBytes(
        storage.usedBytes
      )} | free: ${formatBytes(storage.availableBytes)} | health: ${storage.health ?? "unknown"} | serial: ${
        storage.serial ?? "unknown"
      }`
    );
  });

  lines.push("  GPU:");
  snapshot.gpus.forEach((gpu, index) => {
    lines.push(
      `    ${index + 1}. ${gpu.vendor ?? "unknown"} ${gpu.model ?? "unknown"} | vram: ${formatMegabytes(
        gpu.vramMb
      )} | temp: ${formatTemperature(gpu.temperatureCelsius)}`
    );
  });

  lines.push("  Displays:");
  snapshot.displays.forEach((display, index) => {
    lines.push(
      `    ${index + 1}. ${display.model ?? "unknown"} | ${formatResolution(display.currentResolution)} | ${
        display.refreshRateHz ?? "unknown"
      } Hz | serial: ${display.serial ?? "unknown"}`
    );
  });

  lines.push(`  Battery: ${snapshot.battery.supported ? `${snapshot.battery.percent ?? "unknown"}%` : "unsupported"}`);
  lines.push(`  Keyboards: ${snapshot.keyboards.map((device) => device.name).join(", ") || "unsupported"}`);
  lines.push(`  Mice: ${snapshot.mice.map((device) => device.name).join(", ") || "unsupported"}`);
  lines.push(`  Trackpads: ${snapshot.trackpads.map((device) => device.name).join(", ") || "unsupported"}`);

  return lines.join("\n");
};

const formatBytes = (value: number | null): string => {
  if (value === null) return "unknown";
  const gibibytes = value / 1024 ** 3;
  return `${gibibytes.toFixed(1)} GiB`;
};

const formatMegabytes = (value: number | null): string => {
  return value === null ? "unknown" : `${value} MB`;
};

const formatTemperature = (value: number | null): string => {
  return value === null ? "unknown" : `${value}°C`;
};

const formatResolution = (resolution: { width: number | null; height: number | null }): string => {
  return resolution.width === null || resolution.height === null
    ? "unknown"
    : `${resolution.width}x${resolution.height}`;
};
