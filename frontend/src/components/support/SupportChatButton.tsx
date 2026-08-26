/**
 * SupportChatButton — FAB global del soporte in-app (MOD-21).
 * Montado en AuthLayout: visible en toda la app autenticada, cualquier rol.
 */
import { useState } from "react";
import { Headset } from "lucide-react";
import { SupportChatModal } from "@/components/support/SupportChatModal";

export function SupportChatButton() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Abrir chat de soporte"
            >
                <Headset className="w-6 h-6" />
            </button>

            <SupportChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
