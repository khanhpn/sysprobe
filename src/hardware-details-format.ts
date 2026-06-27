import type { HardwareDetailsSnapshot } from "./hardware-details.js";

export const formatHardwareDetailsSnapshot = (snapshot: HardwareDetailsSnapshot): string => {
  const lines = ["Hardware Details"];

  Object.values(snapshot.categories).forEach((category) => {
    lines.push(`  ${category.title}:`);

    if (!category.supported) {
      lines.push("    unsupported");
      return;
    }

    category.items.forEach((item) => {
      lines.push(`    ${item.label}: ${String(item.value)}`);
    });
  });

  return lines.join("\n");
};
