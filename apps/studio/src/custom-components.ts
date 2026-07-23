import { useEffect, useState } from "react";
import type { PageDocument } from "@agidn/document-schema";

export type CustomValueType = "string" | "number" | "boolean" | "enum";
export type CustomSlotValueType = "component" | "component-list" | "text";

export interface CustomComponentVariable {
  id: string;
  name: string;
  type: CustomValueType;
  initialValue: string | number | boolean;
  enumValues?: string[];
  binding?: string;
}

export interface CustomComponentSlot {
  id: string;
  name: string;
  valueType: CustomSlotValueType;
  initialValue: string;
  binding?: string;
}

export interface CustomComponentAsset {
  id: string;
  name: string;
  description: string;
  document: PageDocument;
  variables: CustomComponentVariable[];
  slots: CustomComponentSlot[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "agidn.studio.custom-components";
const CHANGE_EVENT = "agidn:custom-components-change";

function identifier(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function createCustomComponentAsset(): CustomComponentAsset {
  const now = new Date().toISOString();
  const id = identifier("component");
  return {
    id,
    name: "Untitled component",
    description: "",
    document: {
      schemaVersion: "1.0.0",
      id: `${id}_document`,
      kind: "page",
      role: "component-preview",
      name: "Untitled component",
      children: [{
        id: `${id}_root`,
        kind: "layout",
        layout: "stack",
        role: "component-root",
        name: "Component root",
        children: []
      }]
    },
    variables: [],
    slots: [],
    createdAt: now,
    updatedAt: now
  };
}

function isAsset(value: unknown): value is CustomComponentAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<CustomComponentAsset>;
  return typeof asset.id === "string"
    && typeof asset.name === "string"
    && typeof asset.description === "string"
    && Boolean(asset.document)
    && Array.isArray(asset.variables)
    && Array.isArray(asset.slots);
}

export function loadCustomComponents(): CustomComponentAsset[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isAsset) : [];
  } catch {
    return [];
  }
}

export function getCustomComponent(id: string): CustomComponentAsset | undefined {
  return loadCustomComponents().find((asset) => asset.id === id);
}

export function saveCustomComponent(asset: CustomComponentAsset): CustomComponentAsset {
  const saved = { ...structuredClone(asset), updatedAt: new Date().toISOString() };
  const assets = loadCustomComponents();
  const index = assets.findIndex(({ id }) => id === saved.id);
  if (index === -1) assets.push(saved);
  else assets[index] = saved;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return saved;
}

export function removeCustomComponent(id: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadCustomComponents().filter((asset) => asset.id !== id)));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCustomComponents(): readonly CustomComponentAsset[] {
  const [assets, setAssets] = useState(loadCustomComponents);
  useEffect(() => {
    const refresh = (): void => setAssets(loadCustomComponents());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return assets;
}

export function createVariable(): CustomComponentVariable {
  return { id: identifier("variable"), name: "variable", type: "string", initialValue: "" };
}

export function createSlot(): CustomComponentSlot {
  return { id: identifier("slot"), name: "slot", valueType: "component", initialValue: "" };
}
