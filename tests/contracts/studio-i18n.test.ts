import { readFileSync } from "node:fs";
import ts from "typescript";
import { catalogs, catalogLeafKeys, isStudioLocale, resolveStudioLocale, translate } from "../../apps/studio/src/i18n/runtime.js";
import type { MessageKey, StudioLocale } from "../../apps/studio/src/i18n.js";

const localeEntries = Object.entries(catalogs) as [StudioLocale, (typeof catalogs)[StudioLocale]][];

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]!).sort();
}

describe("Studio i18n", () => {
  it("keeps every locale structurally aligned with the English source catalog", () => {
    const expectedKeys = catalogLeafKeys(catalogs["en-US"]);
    for (const [locale, catalog] of localeEntries) {
      expect(catalogLeafKeys(catalog), locale).toEqual(expectedKeys);
      for (const key of expectedKeys) {
        const typedKey = key as MessageKey;
        expect(placeholders(translate(locale, typedKey)), `${locale}:${key}`).toEqual(placeholders(translate("en-US", typedKey)));
      }
    }
  });

  it("validates configured locales and interpolates named values", () => {
    expect(isStudioLocale("zh-CN")).toBe(true);
    expect(isStudioLocale("zh")).toBe(false);
    expect(resolveStudioLocale(undefined, "invalid", "zh-CN")).toBe("zh-CN");
    expect(resolveStudioLocale(undefined, "invalid")).toBe("en-US");
    expect(translate("zh-CN", "common.revision", { revision: 12 })).toBe("版本 12");
    expect(translate("en-US", "components.removeSaved", { name: "Hero" })).toBe("Remove Hero");
  });

  it("provides localized display metadata for every Golden Catalog control", () => {
    const source = JSON.parse(readFileSync(new URL("../../examples/golden-pricing/components.json", import.meta.url), "utf8")) as {
      components: Record<string, {
        displayName?: Record<string, string>;
        props: Record<string, { displayName?: Record<string, string> }>;
        slots: Record<string, { displayName?: Record<string, string> }>;
        variants: string[];
        variantDisplayNames?: Record<string, Record<string, string>>;
      }>;
    };
    for (const [componentName, component] of Object.entries(source.components)) {
      expect(component.displayName?.["en-US"], `${componentName} English displayName`).toBeTruthy();
      expect(component.displayName?.["zh-CN"], `${componentName} Chinese displayName`).toBeTruthy();
      for (const [propName, prop] of Object.entries(component.props)) {
        expect(prop.displayName?.["en-US"], `${componentName}.${propName} English displayName`).toBeTruthy();
        expect(prop.displayName?.["zh-CN"], `${componentName}.${propName} Chinese displayName`).toBeTruthy();
      }
      for (const [slotName, slot] of Object.entries(component.slots)) {
        expect(slot.displayName?.["en-US"], `${componentName}.${slotName} English displayName`).toBeTruthy();
        expect(slot.displayName?.["zh-CN"], `${componentName}.${slotName} Chinese displayName`).toBeTruthy();
      }
      for (const variant of component.variants) {
        expect(component.variantDisplayNames?.[variant]?.["en-US"], `${componentName}.${variant} English variant`).toBeTruthy();
        expect(component.variantDisplayNames?.[variant]?.["zh-CN"], `${componentName}.${variant} Chinese variant`).toBeTruthy();
      }
    }
  });

  it("does not leave raw English UI literals in Studio JSX", () => {
    const files = [
      "../../apps/studio/src/App.tsx",
      "../../apps/studio/src/CommandPalette.tsx",
      "../../apps/studio/src/panels.tsx",
      "../../apps/studio/src/canvas/CanvasViewport.tsx"
    ];
    const allowedText = new Set(["AGIDN Studio", "English", "PageDocument 1.0.0", "UTF-8", "TypeScript"]);
    const violations: string[] = [];
    for (const relativePath of files) {
      const url = new URL(relativePath, import.meta.url);
      const source = readFileSync(url, "utf8");
      const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node)) {
          const value = node.text.replaceAll(/\s+/g, " ").trim();
          if (/[A-Za-z]{2}/.test(value) && !allowedText.has(value)) violations.push(`${relativePath}: JSX text “${value}”`);
        }
        if (ts.isJsxAttribute(node) && ["aria-label", "placeholder", "title"].includes(node.name.getText(file)) && node.initializer && ts.isStringLiteral(node.initializer)) {
          violations.push(`${relativePath}: ${node.name.getText(file)}="${node.initializer.text}"`);
        }
        if (ts.isJsxAttribute(node) && node.name.getText(file) === "content" && node.initializer && ts.isStringLiteral(node.initializer)) {
          violations.push(`${relativePath}: content="${node.initializer.text}"`);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
      expect(source, `${relativePath} must store user-facing errors as message descriptors`).not.toMatch(/set(?:Preview)?Error\(\s*["'`][A-Za-z]/);
    }
    expect(violations).toEqual([]);
  });
});
