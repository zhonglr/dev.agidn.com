import { access } from "node:fs/promises";
import { resolve } from "node:path";

const forbiddenTargets = [
  "examples/golden-pricing",
  "examples/sample-components",
  "apps/preview-host",
  "packages/preview-protocol",
  "apps/studio/src/ComponentWorkbench.tsx",
  "apps/studio/src/component-workbench-navigation.tsx",
  "apps/studio/src/custom-components.ts",
  "tests/contracts/golden-page.test.ts",
  "tests/contracts/studio-custom-components.test.ts"
];

const present = [];
for (const target of forbiddenTargets) {
  try {
    await access(resolve(target));
    present.push(target);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

if (present.length) {
  console.error(`V2 reset boundary violated:\n${present.map((target) => `- ${target}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`V2 reset boundary verified (${forbiddenTargets.length} obsolete targets absent).`);
}
