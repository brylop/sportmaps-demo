/**
 * SupportChatButton — FAB global del soporte in-app (MOD-21).
 * Montado en AuthLayout: visible en toda la app autenticada, cualquier rol.
 */
import { useState } from "react";
import { MapiAvatar } from "@/components/brand/MapiAvatar";
import { SupportChatModal } from "@/components/support/SupportChatModal";
import { useFabSoporteOculto } from "@/lib/supportFab";

export function SupportChatButton() {
    const [isOpen, setIsOpen] = useState(false);
    // El buzón de WhatsApp la oculta: tapaba el botón «Enviar» (lib/supportFab).
    const oculto = useFabSoporteOculto();

    return (
        <>
            {!oculto && (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-14 h-14 bg-background ring-2 ring-primary rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 overflow-hidden"
                aria-label="Abrir chat con Mapi, el asistente de SportMaps"
            >
                <MapiAvatar className="w-full h-full" />
            </button>
            )}

            <SupportChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
