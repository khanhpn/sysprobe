import { describe, expect, test } from "vitest";

import { formatSensorsSnapshot, formatSensorsWatchLine } from "../src/format.js";
import type { SensorsSnapshot, SensorsWatchSnapshot } from "../src/index.js";

describe("sensor CLI formatting", () => {
  test("formats sysprobe sensors as human-readable sensor rows", () => {
    const snapshot: SensorsSnapshot = {
      cpuTemperature: {
        supported: true,
        main: 62,
        max: 71,
        cores: [],
        source: "systeminformation.cpuTemperature"
      },
      fans: [
        {
          supported: true,
          rpm: 1280,
          label: null,
          path: "/sys/class/hwmon/hwmon0/fan1_input",
          source: "linux.hwmon"
        },
        {
          supported: true,
          rpm: 940,
          label: null,
          path: "/sys/class/hwmon/hwmon0/fan2_input",
          source: "linux.hwmon"
        }
      ],
      warnings: []
    };

    expect(formatSensorsSnapshot(snapshot)).toBe(
      ["Sensors", "  CPU Temp: 62°C", "  CPU Max : 71°C", "  Fan 1   : 1280 RPM", "  Fan 2   : 940 RPM"].join("\n")
    );
  });

  test("formats sysprobe watch --sensors as a one-line status", () => {
    const snapshot: SensorsWatchSnapshot = {
      cpuUsagePercent: 18.4,
      ramUsagePercent: 61.2,
      sensors: {
        cpuTemperature: {
          supported: true,
          main: 62,
          max: 71,
          cores: [],
          source: "systeminformation.cpuTemperature"
        },
        fans: [
          {
            supported: true,
            rpm: 1280,
            label: null,
            path: "/sys/class/hwmon/hwmon0/fan1_input",
            source: "linux.hwmon"
          }
        ],
        warnings: []
      }
    };

    expect(formatSensorsWatchLine(snapshot)).toBe("CPU: 18.4% | RAM: 61.2% | Temp: 62°C | Fan: 1280 RPM");
  });
});
