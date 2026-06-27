import { beforeEach, describe, expect, test, vi } from "vitest";

const cpuTemperature = vi.fn();
const glob = vi.fn();
const readFile = vi.fn();

vi.mock("systeminformation", () => ({
  default: {
    cpuTemperature
  }
}));

vi.mock("node:fs/promises", () => ({
  glob,
  readFile
}));

describe("getSensors", () => {
  beforeEach(() => {
    cpuTemperature.mockReset();
    glob.mockReset();
    readFile.mockReset();
  });

  test("normalizes unsupported CPU temperature sentinel values", async () => {
    const { getSensors } = await import("../src/index.js");

    for (const value of [-1, null, undefined]) {
      cpuTemperature.mockResolvedValueOnce({ main: value, cores: [] });
      glob.mockReturnValueOnce([]);

      const sensors = await getSensors();

      expect(sensors.cpuTemperature.supported).toBe(false);
      expect(sensors.cpuTemperature.main).toBeNull();
      expect(sensors.cpuTemperature.max).toBeNull();
      expect(sensors.cpuTemperature.cores).toEqual([]);
      expect(sensors.cpuTemperature.source).toBe("systeminformation.cpuTemperature");
      expect(sensors.warnings).toContain("CPU temperature is unsupported");
    }
  });

  test("normalizes empty CPU temperature arrays without fake values", async () => {
    const { getSensors } = await import("../src/index.js");

    cpuTemperature.mockResolvedValueOnce({ main: 47, cores: [] });
    glob.mockReturnValueOnce([]);

    const sensors = await getSensors();

    expect(sensors.cpuTemperature).toEqual({
      supported: true,
      main: 47,
      max: null,
      cores: [],
      source: "systeminformation.cpuTemperature"
    });
  });

  test("reads Linux fan RPM values and labels from hwmon", async () => {
    const { getSensors } = await import("../src/index.js");

    cpuTemperature.mockResolvedValueOnce({ main: 51, cores: [50, -1, null, 49] });
    glob.mockReturnValueOnce(["/sys/class/hwmon/hwmon0/fan1_input"]);
    readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("fan1_input")) return "1240\n";
      if (path.endsWith("fan1_label")) return "CPU Fan\n";
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });

    const sensors = await getSensors();

    expect(sensors.cpuTemperature.cores).toEqual([50, null, null, 49]);
    expect(sensors.fans).toEqual([
      {
        supported: true,
        rpm: 1240,
        label: "CPU Fan",
        path: "/sys/class/hwmon/hwmon0/fan1_input",
        source: "linux.hwmon"
      }
    ]);
  });

  test("does not throw when Linux fan files do not exist", async () => {
    const { getSensors } = await import("../src/index.js");

    cpuTemperature.mockResolvedValueOnce({ main: 51, cores: [50] });
    glob.mockReturnValueOnce(["/sys/class/hwmon/hwmon0/fan1_input"]);
    readFile.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));

    const sensors = await getSensors();

    expect(sensors.fans).toEqual([]);
    expect(sensors.warnings).toContain("Fan sensors are unsupported");
  });
});
