import { beforeEach, describe, expect, test, vi } from "vitest";

const execFile = vi.fn();
const fsSize = vi.fn();
const diskLayout = vi.fn();
const blockDevices = vi.fn();
const graphics = vi.fn();
const battery = vi.fn();
const usb = vi.fn();
const bluetoothDevices = vi.fn();

vi.mock("systeminformation", () => ({
  default: {
    fsSize,
    diskLayout,
    blockDevices,
    graphics,
    battery,
    usb,
    bluetoothDevices
  }
}));

vi.mock("node:child_process", () => ({
  execFile
}));

describe("getHardware", () => {
  beforeEach(() => {
    execFile.mockReset();
    fsSize.mockReset();
    diskLayout.mockReset();
    blockDevices.mockReset();
    graphics.mockReset();
    battery.mockReset();
    usb.mockReset();
    bluetoothDevices.mockReset();
  });

  test("returns detailed macOS system_profiler hardware categories when available", async () => {
    const { getHardwareDetails } = await import("../src/index.js");

    execFile.mockImplementation((command, args, _options, callback) => {
      expect(command).toBe("system_profiler");
      expect(args).toContain("-json");
      callback(
        null,
        JSON.stringify({
          SPHardwareDataType: [
            {
              machine_name: "MacBook Air",
              machine_model: "Mac14,15",
              model_number: "Z18L00047SA/A",
              chip_type: "Apple M2",
              number_processors: "8",
              physical_memory: "16 GB",
              serial_number: "SERIAL123",
              platform_UUID: "UUID123"
            }
          ],
          SPMemoryDataType: [{ dimm_size: "16 GB", dimm_type: "LPDDR5" }],
          SPNVMeDataType: [{ _name: "APPLE SSD", size: "251 GB", serial_num: "SSD123", smart_status: "Verified" }],
          SPDisplaysDataType: [
            {
              sppci_model: "Apple M2",
              spdisplays_vram: "1536 MB",
              spdisplays_ndrvs: [{ _name: "Color LCD", _spdisplays_resolution: "2560 x 1664 Retina" }]
            }
          ],
          SPUSBDataType: [{ _name: "USB Keyboard", manufacturer: "KeyCo" }]
        }),
        ""
      );
    });

    const details = await getHardwareDetails();

    expect(details.source).toBe("system_profiler");
    expect(details.categories.hardware.items[0]).toMatchObject({
      label: "Model Name",
      value: "MacBook Air"
    });
    expect(details.categories.nvme.items[0]).toMatchObject({
      label: "Name",
      value: "APPLE SSD"
    });
    expect(details.categories.graphicsDisplays.items).toEqual(
      expect.arrayContaining([
        { label: "Model", value: "Apple M2" },
        { label: "Display Name", value: "Color LCD" }
      ])
    );
    expect(details.categories.usb.items[0]).toMatchObject({
      label: "Name",
      value: "USB Keyboard"
    });
    expect(details.warnings).toEqual([]);
  });

  test("returns storage, graphics, displays, input devices, gpu, and battery information", async () => {
    const { getHardware } = await import("../src/index.js");

    fsSize.mockResolvedValueOnce([
      {
        fs: "/dev/disk3s1",
        type: "apfs",
        size: 1_000,
        used: 400,
        available: 600,
        use: 40,
        mount: "/",
        rw: true
      }
    ]);
    diskLayout.mockResolvedValueOnce([
      {
        device: "/dev/disk3",
        type: "SSD",
        name: "Apple SSD",
        vendor: "Apple",
        size: 1_000,
        serialNum: "SSD123",
        interfaceType: "NVMe",
        smartStatus: "Verified",
        temperature: 41
      }
    ]);
    blockDevices.mockResolvedValueOnce([
      {
        name: "disk3s1",
        identifier: "disk3s1",
        type: "part",
        fsType: "apfs",
        mount: "/",
        size: 1_000,
        physical: "SSD",
        uuid: "uuid",
        label: "Macintosh HD",
        model: "Apple SSD",
        serial: "SSD123",
        removable: false,
        protocol: "NVMe",
        device: "/dev/disk3"
      }
    ]);
    graphics.mockResolvedValueOnce({
      controllers: [
        {
          vendor: "Apple",
          model: "Apple M3",
          bus: "Built-In",
          vram: 0,
          vramDynamic: true,
          utilizationGpu: 18,
          temperatureGpu: 55
        }
      ],
      displays: [
        {
          vendor: "Apple",
          vendorId: null,
          model: "Color LCD",
          productionYear: null,
          serial: "DISPLAY123",
          deviceName: "Built-in Retina Display",
          displayId: "1",
          main: true,
          builtin: true,
          connection: "Internal",
          sizeX: 14,
          sizeY: 9,
          pixelDepth: 30,
          resolutionX: 3024,
          resolutionY: 1964,
          currentResX: 1512,
          currentResY: 982,
          positionX: 0,
          positionY: 0,
          currentRefreshRate: 120
        }
      ]
    });
    battery.mockResolvedValueOnce({
      hasBattery: true,
      cycleCount: 42,
      isCharging: false,
      voltage: 12,
      designedCapacity: 100,
      maxCapacity: 94,
      currentCapacity: 61,
      capacityUnit: "Wh",
      percent: 65,
      timeRemaining: 180,
      acConnected: true,
      type: "Li-ion",
      model: "Battery",
      manufacturer: "Apple",
      serial: "BAT123"
    });
    usb.mockResolvedValueOnce([
      {
        id: 1,
        bus: 1,
        deviceId: 2,
        name: "USB Keyboard",
        type: "Human Interface Device",
        removable: true,
        vendor: "KeyCo",
        manufacturer: "KeyCo",
        maxPower: "100mA",
        serialNumber: "KEY123"
      }
    ]);
    bluetoothDevices.mockResolvedValueOnce([
      {
        device: "mouse",
        name: "Magic Mouse",
        macDevice: "00:11",
        macHost: "22:33",
        batteryPercent: 80,
        manufacturer: "Apple",
        type: "Mouse",
        connected: true
      },
      {
        device: "trackpad",
        name: "Magic Trackpad",
        macDevice: "00:44",
        macHost: "22:33",
        batteryPercent: 72,
        manufacturer: "Apple",
        type: "Trackpad",
        connected: true
      }
    ]);

    const hardware = await getHardware();

    expect(hardware.storage[0]).toMatchObject({
      name: "Apple SSD",
      totalBytes: 1_000,
      usedBytes: 400,
      availableBytes: 600,
      health: "Verified",
      serial: "SSD123",
      source: "systeminformation.diskLayout+fsSize+blockDevices"
    });
    expect(hardware.gpus[0]).toMatchObject({
      model: "Apple M3",
      vendor: "Apple",
      utilizationPercent: 18,
      temperatureCelsius: 55,
      source: "systeminformation.graphics"
    });
    expect(hardware.graphics).toEqual(hardware.gpus);
    expect(hardware.displays[0]).toMatchObject({
      model: "Color LCD",
      resolution: { width: 3024, height: 1964 },
      currentResolution: { width: 1512, height: 982 },
      refreshRateHz: 120,
      serial: "DISPLAY123"
    });
    expect(hardware.battery).toMatchObject({
      supported: true,
      percent: 65,
      cycleCount: 42,
      serial: "BAT123"
    });
    expect(hardware.keyboards[0]).toMatchObject({ name: "USB Keyboard", serial: "KEY123" });
    expect(hardware.mice[0]).toMatchObject({ name: "Magic Mouse", batteryPercent: 80 });
    expect(hardware.trackpads[0]).toMatchObject({ name: "Magic Trackpad", batteryPercent: 72 });
    expect(hardware.warnings).toEqual([]);
  });
});
