import { execFile } from "node:child_process";

const SYSTEM_PROFILER_SOURCE = "system_profiler";

const SYSTEM_PROFILER_TYPES = [
  "SPHardwareDataType",
  "SPMemoryDataType",
  "SPNVMeDataType",
  "SPStorageDataType",
  "SPDisplaysDataType",
  "SPPowerDataType",
  "SPUSBDataType",
  "SPBluetoothDataType",
  "SPAudioDataType",
  "SPCameraDataType",
  "SPCardReaderDataType",
  "SPEthernetDataType",
  "SPNetworkDataType",
  "SPThunderboltDataType",
  "SPPrintersDataType",
  "SPPCIDataType",
  "SPSATADataType"
] as const;

const CATEGORY_KEYS = {
  SPHardwareDataType: "hardware",
  SPMemoryDataType: "memory",
  SPNVMeDataType: "nvme",
  SPStorageDataType: "storage",
  SPDisplaysDataType: "graphicsDisplays",
  SPPowerDataType: "power",
  SPUSBDataType: "usb",
  SPBluetoothDataType: "bluetooth",
  SPAudioDataType: "audio",
  SPCameraDataType: "camera",
  SPCardReaderDataType: "cardReader",
  SPEthernetDataType: "ethernet",
  SPNetworkDataType: "network",
  SPThunderboltDataType: "thunderboltUsb4",
  SPPrintersDataType: "printers",
  SPPCIDataType: "pci",
  SPSATADataType: "sata"
} as const;

const CATEGORY_TITLES: Record<HardwareDetailCategoryKey, string> = {
  hardware: "Hardware",
  memory: "Memory",
  nvme: "NVMExpress",
  storage: "Storage",
  graphicsDisplays: "Graphics/Displays",
  power: "Power",
  usb: "USB",
  bluetooth: "Bluetooth",
  audio: "Audio",
  camera: "Camera",
  cardReader: "Card Reader",
  ethernet: "Ethernet",
  network: "Network",
  thunderboltUsb4: "Thunderbolt/USB4",
  printers: "Printers",
  pci: "PCI",
  sata: "SATA"
};

export type HardwareDetailCategoryKey = (typeof CATEGORY_KEYS)[keyof typeof CATEGORY_KEYS];

export interface HardwareDetailItem {
  label: string;
  value: string | number | boolean;
}

export interface HardwareDetailCategory {
  title: string;
  supported: boolean;
  items: HardwareDetailItem[];
}

export type HardwareDetailCategories = Record<HardwareDetailCategoryKey, HardwareDetailCategory>;

export interface HardwareDetailsSnapshot {
  source: typeof SYSTEM_PROFILER_SOURCE;
  categories: HardwareDetailCategories;
  warnings: string[];
}

export const getHardwareDetails = async (): Promise<HardwareDetailsSnapshot> => {
  const categories = createEmptyCategories();
  const output = await execFileOptional("system_profiler", [...SYSTEM_PROFILER_TYPES, "-json", "-detailLevel", "full"]);

  if (output === null) {
    return {
      source: SYSTEM_PROFILER_SOURCE,
      categories,
      warnings: ["Detailed hardware information is unsupported"]
    };
  }

  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;

    for (const profilerType of SYSTEM_PROFILER_TYPES) {
      const categoryKey = CATEGORY_KEYS[profilerType];
      const items = flattenProfilerValue(parsed[profilerType]);
      categories[categoryKey] = {
        ...categories[categoryKey],
        supported: items.length > 0,
        items
      };
    }

    return {
      source: SYSTEM_PROFILER_SOURCE,
      categories,
      warnings: Object.values(categories).some((category) => category.supported)
        ? []
        : ["Detailed hardware information is unsupported"]
    };
  } catch {
    return {
      source: SYSTEM_PROFILER_SOURCE,
      categories,
      warnings: ["Detailed hardware information could not be parsed"]
    };
  }
};

const createEmptyCategories = (): HardwareDetailCategories => {
  return Object.fromEntries(
    Object.values(CATEGORY_KEYS).map((key) => [
      key,
      {
        title: CATEGORY_TITLES[key],
        supported: false,
        items: []
      }
    ])
  ) as unknown as HardwareDetailCategories;
};

const flattenProfilerValue = (value: unknown, prefix = ""): HardwareDetailItem[] => {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return flattenProfilerValue(value[0], prefix);
    }

    return value.flatMap((entry, index) => flattenProfilerValue(entry, prefixForArrayEntry(entry, index, prefix)));
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      if (nestedValue === null || nestedValue === undefined || nestedValue === "") {
        return [];
      }

      const label = joinLabel(prefix, humanizeKey(key));

      if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
        return flattenProfilerValue(nestedValue, label);
      }

      return isPrimitiveValue(nestedValue) ? [{ label, value: nestedValue }] : [];
    });
  }

  if (isPrimitiveValue(value)) {
    return [{ label: prefix || "Value", value }];
  }

  return [];
};

const prefixForArrayEntry = (entry: unknown, index: number, prefix: string): string => {
  const name = isRecord(entry) ? normalizePrimitive(entry._name) : null;
  const itemPrefix = name ?? `Item ${index + 1}`;
  return joinLabel(prefix, itemPrefix);
};

const joinLabel = (prefix: string, label: string): string => {
  return prefix ? `${prefix} ${label}` : label;
};

const humanizeKey = (key: string): string => {
  const aliases: Record<string, string> = {
    _name: "Name",
    machine_name: "Model Name",
    machine_model: "Model Identifier",
    model_number: "Model Number",
    chip_type: "Chip",
    number_processors: "Total Number of Cores",
    physical_memory: "Memory",
    serial_number: "Serial Number",
    platform_UUID: "Hardware UUID",
    os_loader_version: "OS Loader Version",
    boot_rom_version: "System Firmware Version",
    serial_num: "Serial Number",
    smart_status: "SMART Status",
    spdisplays_vram: "VRAM",
    sppci_model: "Model",
    spdisplays_ndrvs: "Display",
    _spdisplays_resolution: "Resolution"
  };

  if (aliases[key]) {
    return aliases[key];
  }

  return key
    .replace(/^sp/i, "")
    .replace(/^_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizePrimitive = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};

const isPrimitiveValue = (value: unknown): value is string | number | boolean => {
  return ["string", "number", "boolean"].includes(typeof value);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const execFileOptional = async (command: string, args: string[]): Promise<string | null> => {
  return await new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
};
