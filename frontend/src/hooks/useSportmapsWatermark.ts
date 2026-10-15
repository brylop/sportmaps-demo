// frontend/src/hooks/useSportmapsWatermark.ts
//
// ¿Las piezas que genera la escuela llevan «Powered by SportMaps»? Siempre,
// salvo marca blanca: solo la escuela con la app NATIVA de marca blanca
// (entitlements.appNativa, espejo de school_has_native_app()) puede apagarlo,
// y solo si lo apagó en branding_settings.show_sportmaps_watermark. Misma regla
// que BrandingSettingsForm (puedeApagarWatermark) y que los recibos/carnets
// (show_sportmaps_watermark !== false). Logo y colores propios NO es marca blanca.
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';

/** Regla pura (testeable): true = lleva «Powered by SportMaps». */
export function showsSportmapsWatermark(hasNativeWhitelabel: boolean, showSetting: boolean | null | undefined): boolean {
    return !(hasNativeWhitelabel && showSetting === false);
}

export function useSportmapsWatermark(): boolean {
    const { schoolBranding } = useSchoolContext();
    const { appNativa } = useEntitlements();
    return showsSportmapsWatermark(appNativa, schoolBranding?.branding_settings?.show_sportmaps_watermark);
}
