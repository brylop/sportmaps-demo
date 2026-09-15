/**
 * Alta de WhatsApp: abre el diálogo de Embedded Signup de Meta.
 *
 * F0 del spec `docs/specs/whatsapp-alta-de-escuelas-y-buzon.md`: acá solo se
 * consigue el `code` y la información de sesión. NO se persiste nada todavía —
 * eso es F1.
 *
 * COEXISTENCE SE PIDE ACÁ, con `extras.featureType`. La documentación pública
 * no lo menciona —de hecho dice que se activa solo por configuración— pero el
 * generador del panel («Creador de registro insertado») arma esta URL:
 *
 *     extras={"featureType":"whatsapp_business_app_onboarding",
 *             "sessionInfoVersion":"3","version":"v4",
 *             "features":[{"name":"app_only_install"}]}
 *
 * Sin `featureType`, el diálogo abre igual de bien pero SIN Coexistence: le
 * ofrece a la escuela crear una cuenta nueva en vez de conectar la que ya usa
 * en su celular. Falla hacia el lado silencioso, que es el peor.
 *
 * Los webhooks `history`, `smb_app_state_sync` y `smb_message_echoes` siguen
 * haciendo falta —van suscritos desde el panel— pero no reemplazan a este
 * parámetro.
 *
 * La señal de que todo quedó bien es visual: la pantalla de selección de WABA
 * se reemplaza por una que ofrece conectar la cuenta existente.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2 } from 'lucide-react';

const APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const CONFIG_ID = import.meta.env.VITE_META_ES_CONFIG_ID as string | undefined;
const SDK_VERSION = 'v25.0';

/**
 * ¿Está el alta configurada en este ambiente?
 *
 * Mientras el alta no persista nada (F0), el botón no debe existir para una
 * escuela de verdad: la llevaría por todo el flujo de Meta para que al final
 * no pase nada. Sin las variables el botón no se pinta, y el ambiente se
 * comporta como antes de que esto existiera.
 */
export const ALTA_CONFIGURADA = Boolean(APP_ID && CONFIG_ID);

/** Lo que Meta devuelve por `postMessage` mientras la escuela avanza. */
export interface InfoDeSesion {
    /** `FINISH` en el alta normal; `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` si fue Coexistence. */
    event: string;
    data?: {
        phone_number_id?: string;
        waba_id?: string;
        business_id?: string;
        error_message?: string;
        current_step?: string;
    };
    version?: number;
}

export interface ResultadoDelAlta {
    code: string;
    sesion: InfoDeSesion | null;
    /** true si la escuela conectó su cuenta existente en vez de crear una nueva. */
    esCoexistence: boolean;
}

declare global {
    interface Window {
        FB?: any;
        fbAsyncInit?: () => void;
    }
}

/**
 * Carga el SDK de Meta **bajo demanda**, no al arrancar la app.
 *
 * Ponerlo en el index.html cargaría un script de Facebook en cada página que
 * abre cualquier usuario —incluidos padres y atletas— para una pantalla que
 * usa la escuela una sola vez en su vida.
 */
function cargarSdk(): Promise<void> {
    if (window.FB) return Promise.resolve();

    return new Promise((resolve, reject) => {
        window.fbAsyncInit = () => {
            window.FB.init({
                appId: APP_ID,
                autoLogAppEvents: true,
                xfbml: false,
                version: SDK_VERSION,
            });
            resolve();
        };

        const existente = document.getElementById('meta-sdk');
        if (existente) return;

        const s = document.createElement('script');
        s.id = 'meta-sdk';
        s.src = `https://connect.facebook.net/en_US/sdk.js`;
        s.async = true;
        s.defer = true;
        s.crossOrigin = 'anonymous';
        s.onerror = () => reject(new Error('No se pudo cargar el SDK de Meta.'));
        document.body.appendChild(s);
    });
}

export function ConectarNumero({ onListo }: { onListo: (r: ResultadoDelAlta) => void }) {
    const [abriendo, setAbriendo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // El `postMessage` con la info de sesión llega por un canal distinto al
    // callback del login, y puede llegar ANTES. Se guarda acá para poder
    // juntarlos cuando el código aparezca.
    const sesion = useRef<InfoDeSesion | null>(null);

    useEffect(() => {
        const alMensaje = (e: MessageEvent) => {
            // Sin este filtro, cualquier iframe de la página podría inyectar
            // una sesión falsa.
            if (!e.origin.endsWith('facebook.com')) return;
            try {
                const d = JSON.parse(e.data);
                if (d?.type === 'WA_EMBEDDED_SIGNUP') {
                    sesion.current = d as InfoDeSesion;
                    if (d?.data?.error_message) setError(String(d.data.error_message));
                }
            } catch {
                // Meta manda también mensajes que no son JSON. No es un error.
            }
        };
        window.addEventListener('message', alMensaje);
        return () => window.removeEventListener('message', alMensaje);
    }, []);

    const conectar = useCallback(async () => {
        setError(null);

        if (!APP_ID || !CONFIG_ID) {
            setError('Falta configurar VITE_META_APP_ID y VITE_META_ES_CONFIG_ID.');
            return;
        }

        setAbriendo(true);
        try {
            await cargarSdk();
        } catch (e: any) {
            setError(e?.message ?? 'No se pudo cargar el SDK de Meta.');
            setAbriendo(false);
            return;
        }

        window.FB.login(
            (resp: any) => {
                setAbriendo(false);
                const code = resp?.authResponse?.code;
                if (!code) {
                    // Cerrar el diálogo a mitad de camino es normal, no un fallo.
                    if (sesion.current?.data?.error_message) {
                        setError(String(sesion.current.data.error_message));
                    }
                    return;
                }
                onListo({
                    code,
                    sesion: sesion.current,
                    esCoexistence:
                        sesion.current?.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
                });
            },
            {
                config_id: CONFIG_ID,
                response_type: 'code',
                // Sin esto el SDK devuelve un token de usuario en vez del código
                // de intercambio, y el backend no puede canjearlo.
                override_default_response_type: true,
                // EXACTAMENTE lo que genera el «Creador de registro insertado»
                // del panel con Coexistence activo — ni un campo mas.
                //
                // El ejemplo de la documentacion trae `setup: {}` y yo lo habia
                // copiado de ahi; la URL del panel NO lo lleva, y con el puesto
                // el dialogo abria en blanco. Probado el 2026-09-14: la misma
                // URL sin `setup` funciona y ofrece conectar la cuenta existente.
                extras: {
                    featureType: 'whatsapp_business_app_onboarding',
                    sessionInfoVersion: '3',
                    version: 'v4',
                    features: [{ name: 'app_only_install' }],
                },
            },
        );
    }, [onListo]);

    return (
        <div className="space-y-2">
            <Button onClick={conectar} disabled={abriendo}>
                {abriendo
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Abriendo…</>
                    : <><MessageSquare className="h-4 w-4 mr-2" /> Conectar WhatsApp</>}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
