/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
    readonly VITE_WOMPI_PUBLIC_KEY: string
    readonly VITE_SENTRY_DSN?: string
    readonly VITE_SENTRY_ENVIRONMENT?: string
    readonly VITE_DEMO_SCHOOL_EMAIL?: string
    readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
