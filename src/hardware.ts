import si from "systeminformation";

const HARDWARE_SOURCE = "systeminformation";
const STORAGE_SOURCE = "systeminformation.diskLayout+fsSize+blockDevices";

export interface StorageDevice {
  name: string | null;
  type: string | null;
  interfaceType: string | null;
  totalBytes: number | null;
  usedBytes: number | null;
  availableBytes: number | null;
  health: string | null;
  serial: string | null;
  mount: string | null;
  source: typeof STORAGE_SOURCE;
}

export interface GpuDevice {
  vendor: string | null;
  model: string | null;
  bus: string | null;
  vramMb: number | null;
  utilizationPercent: number | null;
  temperatureCelsius: number | null;
  fanSpeedPercent: number | null;
  source: "systeminformation.graphics";
}

export interface DisplayDevice {
  vendor: string | null;
  model: string | null;
  serial: string | null;
  main: boolean;
  builtin: boolean;
  connection: string | null;
  resolution: { width: number | null; height: number | null };
  currentResolution: { width: number | null; height: number | null };
  refreshRateHz: number | null;
  source: "systeminformation.graphics";
}

export interface InputDevice {
  name: string;
  vendor: string | null;
  serial: string | null;
  connection: "usb" | "bluetooth";
  batteryPercent: number | null;
  source: "systeminformation.usb" | "systeminformation.bluetoothDevices";
}

export interface BatteryInfo {
  supported: boolean;
  percent: number | null;
  cycleCount: number | null;
  isCharging: boolean | null;
  acConnected: boolean | null;
  timeRemainingMinutes: number | null;
  designedCapacity: number | null;
  maxCapacity: number | null;
  currentCapacity: number | null;
  capacityUnit: string | null;
  model: string | null;
  manufacturer: string | null;
  serial: string | null;
  source: "systeminformation.battery";
}

export interface HardwareSnapshot {
  storage: StorageDevice[];
  graphics: GpuDevice[];
  gpus: GpuDevice[];
  displays: DisplayDevice[];
  keyboards: InputDevice[];
  mice: InputDevice[];
  trackpads: InputDevice[];
  battery: BatteryInfo;
  warnings: string[];
}

export const getHardware = async (): Promise<HardwareSnapshot> => {
  const [fileSystems, disks, blocks, graphicsData, batteryData, usbDevices, bluetoothDevices] = await Promise.all([
    si.fsSize(),
    si.diskLayout(),
    si.blockDevices(),
    si.graphics(),
    si.battery(),
    si.usb(),
    si.bluetoothDevices()
  ]);

  const storage = normalizeStorage(fileSystems, disks, blocks);
  const gpus = normalizeGpus(graphicsData.controllers);
  const displays = normalizeDisplays(graphicsData.displays);
  const inputDevices = normalizeInputDevices(usbDevices, bluetoothDevices);
  const battery = normalizeBattery(batteryData);
  const warnings = buildWarnings(storage, gpus, displays, inputDevices, battery);

  return {
    storage,
    graphics: gpus,
    gpus,
    displays,
    keyboards: inputDevices.keyboards,
    mice: inputDevices.mice,
    trackpads: inputDevices.trackpads,
    battery,
    warnings
  };
};

const normalizeStorage = (
  fileSystems: Awaited<ReturnType<typeof si.fsSize>>,
  disks: Awaited<ReturnType<typeof si.diskLayout>>,
  blocks: Awaited<ReturnType<typeof si.blockDevices>>
): StorageDevice[] => {
  const physicalDisks = disks.length > 0 ? disks : [];

  if (physicalDisks.length === 0) {
    return fileSystems.map((fileSystem) => storageFromFileSystem(fileSystem, null, null));
  }

  return physicalDisks.map((disk) => {
    const block = blocks.find((candidate) => matchesDisk(candidate, disk)) ?? null;
    const fileSystem = fileSystems.find((candidate) => matchesFileSystem(candidate, disk, block)) ?? null;
    return storageFromFileSystem(fileSystem, disk, block);
  });
};

const storageFromFileSystem = (
  fileSystem: Awaited<ReturnType<typeof si.fsSize>>[number] | null,
  disk: Awaited<ReturnType<typeof si.diskLayout>>[number] | null,
  block: Awaited<ReturnType<typeof si.blockDevices>>[number] | null
): StorageDevice => {
  return {
    name: normalizeString(disk?.name) ?? normalizeString(block?.model) ?? normalizeString(fileSystem?.fs),
    type: normalizeString(disk?.type) ?? normalizeString(block?.physical),
    interfaceType: normalizeString(disk?.interfaceType) ?? normalizeString(block?.protocol),
    totalBytes: normalizeNumber(disk?.size) ?? normalizeNumber(fileSystem?.size) ?? normalizeNumber(block?.size),
    usedBytes: normalizeNumber(fileSystem?.used),
    availableBytes: normalizeNumber(fileSystem?.available),
    health: normalizeString(disk?.smartStatus),
    serial: normalizeString(disk?.serialNum) ?? normalizeString(block?.serial),
    mount: normalizeString(fileSystem?.mount) ?? normalizeString(block?.mount),
    source: STORAGE_SOURCE
  };
};

const matchesDisk = (
  block: Awaited<ReturnType<typeof si.blockDevices>>[number],
  disk: Awaited<ReturnType<typeof si.diskLayout>>[number]
): boolean => {
  return (
    normalizeString(block.device) === normalizeString(disk.device) ||
    normalizeString(block.serial) === normalizeString(disk.serialNum) ||
    normalizeString(block.model) === normalizeString(disk.name)
  );
};

const matchesFileSystem = (
  fileSystem: Awaited<ReturnType<typeof si.fsSize>>[number],
  disk: Awaited<ReturnType<typeof si.diskLayout>>[number],
  block: Awaited<ReturnType<typeof si.blockDevices>>[number] | null
): boolean => {
  return (
    fileSystem.fs.includes(disk.device) ||
    (block !== null && (fileSystem.fs.includes(block.identifier) || fileSystem.mount === block.mount))
  );
};

const normalizeGpus = (controllers: Awaited<ReturnType<typeof si.graphics>>["controllers"]): GpuDevice[] => {
  return controllers.map((controller) => ({
    vendor: normalizeString(controller.vendor),
    model: normalizeString(controller.model ?? controller.name),
    bus: normalizeString(controller.bus),
    vramMb: normalizeNumber(controller.vram ?? controller.memoryTotal),
    utilizationPercent: normalizeNumber(controller.utilizationGpu),
    temperatureCelsius: normalizeNumber(controller.temperatureGpu),
    fanSpeedPercent: normalizeNumber(controller.fanSpeed),
    source: `${HARDWARE_SOURCE}.graphics`
  }));
};

const normalizeDisplays = (displays: Awaited<ReturnType<typeof si.graphics>>["displays"]): DisplayDevice[] => {
  return displays.map((display) => ({
    vendor: normalizeString(display.vendor),
    model: normalizeString(display.model ?? display.deviceName),
    serial: normalizeString(display.serial),
    main: display.main,
    builtin: display.builtin,
    connection: normalizeString(display.connection),
    resolution: {
      width: normalizeNumber(display.resolutionX),
      height: normalizeNumber(display.resolutionY)
    },
    currentResolution: {
      width: normalizeNumber(display.currentResX),
      height: normalizeNumber(display.currentResY)
    },
    refreshRateHz: normalizeNumber(display.currentRefreshRate),
    source: `${HARDWARE_SOURCE}.graphics`
  }));
};

const normalizeInputDevices = (
  usbDevices: Awaited<ReturnType<typeof si.usb>>,
  bluetoothDevices: Awaited<ReturnType<typeof si.bluetoothDevices>>
): Pick<HardwareSnapshot, "keyboards" | "mice" | "trackpads"> => {
  const devices = [
    ...usbDevices.map((device): InputDevice | null => {
      const name = normalizeString(device.name);

      if (name === null || !isInputDeviceName(name)) {
        return null;
      }

      return {
        name,
        vendor: normalizeString(device.vendor) ?? normalizeString(device.manufacturer),
        serial: normalizeString(device.serialNumber),
        connection: "usb",
        batteryPercent: null,
        source: "systeminformation.usb"
      };
    }),
    ...bluetoothDevices.map((device): InputDevice | null => {
      const name = normalizeString(device.name);

      if (name === null || !isInputDeviceName(`${name} ${device.type}`)) {
        return null;
      }

      return {
        name,
        vendor: normalizeString(device.manufacturer),
        serial: normalizeString(device.macDevice),
        connection: "bluetooth",
        batteryPercent: normalizeNumber(device.batteryPercent),
        source: "systeminformation.bluetoothDevices"
      };
    })
  ].filter((device): device is InputDevice => device !== null);

  return {
    keyboards: devices.filter((device) => isKeyboard(device.name)),
    mice: devices.filter((device) => isMouse(device.name)),
    trackpads: devices.filter((device) => isTrackpad(device.name))
  };
};

const normalizeBattery = (battery: Awaited<ReturnType<typeof si.battery>>): BatteryInfo => {
  return {
    supported: battery.hasBattery,
    percent: battery.hasBattery ? normalizeNumber(battery.percent) : null,
    cycleCount: battery.hasBattery ? normalizeNumber(battery.cycleCount) : null,
    isCharging: battery.hasBattery ? battery.isCharging : null,
    acConnected: battery.hasBattery ? battery.acConnected : null,
    timeRemainingMinutes: battery.hasBattery ? normalizeNumber(battery.timeRemaining) : null,
    designedCapacity: battery.hasBattery ? normalizeNumber(battery.designedCapacity) : null,
    maxCapacity: battery.hasBattery ? normalizeNumber(battery.maxCapacity) : null,
    currentCapacity: battery.hasBattery ? normalizeNumber(battery.currentCapacity) : null,
    capacityUnit: battery.hasBattery ? normalizeString(battery.capacityUnit) : null,
    model: battery.hasBattery ? normalizeString(battery.model) : null,
    manufacturer: battery.hasBattery ? normalizeString(battery.manufacturer) : null,
    serial: battery.hasBattery ? normalizeString(battery.serial) : null,
    source: "systeminformation.battery"
  };
};

const buildWarnings = (
  storage: StorageDevice[],
  gpus: GpuDevice[],
  displays: DisplayDevice[],
  inputDevices: Pick<HardwareSnapshot, "keyboards" | "mice" | "trackpads">,
  battery: BatteryInfo
): string[] => {
  const warnings: string[] = [];

  if (storage.length === 0) warnings.push("Storage information is unsupported");
  if (gpus.length === 0) warnings.push("Graphics/GPU information is unsupported");
  if (displays.length === 0) warnings.push("Display information is unsupported");
  if (inputDevices.keyboards.length === 0) warnings.push("Keyboard information is unsupported");
  if (inputDevices.mice.length === 0) warnings.push("Mouse information is unsupported");
  if (inputDevices.trackpads.length === 0) warnings.push("Trackpad information is unsupported");
  if (!battery.supported) warnings.push("Battery information is unsupported");

  return warnings;
};

const isInputDeviceName = (name: string): boolean => {
  return isKeyboard(name) || isMouse(name) || isTrackpad(name);
};

const isKeyboard = (name: string): boolean => {
  return /keyboard/i.test(name);
};

const isMouse = (name: string): boolean => {
  return /mouse/i.test(name);
};

const isTrackpad = (name: string): boolean => {
  return /trackpad|touchpad/i.test(name);
};

const normalizeString = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};

const normalizeNumber = (value: unknown): number | null => {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
};
