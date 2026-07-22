/// <reference types="vite/client" />

interface ImportMetaEnv { readonly VITE_STUDIO_LOCALE?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
interface Window { __AGIDN_STUDIO_CONFIG__?: { locale?: "en-US" | "zh-CN" } }
