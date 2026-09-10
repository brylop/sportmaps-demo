/**
 * InvoiceIdentifiers — los identificadores largos de un documento electrónico
 * (CUFE, código de referencia) con su botón de copiar.
 *
 * Vive en su propio archivo porque lo usan DOS pantallas: la tabla de facturas
 * (InvoicingTab) y el diálogo de anulación, que tiene que mostrar el CUFE de la
 * nota crédito recién emitida. Copiarlo de un archivo al otro dejaría dos
 * versiones del mismo botón, y la que se queda vieja es siempre la que el
 * usuario tiene delante cuando el portapapeles falla.
 */

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

/**
 * Botón de copiar para valores largos (CUFE de 96 caracteres, reference_code).
 *
 * `navigator.clipboard` no existe en http ni en algunos WebView, y ahí la
 * promesa revienta: se avisa en vez de que el clic no haga nada y el admin
 * crea que copió el CUFE que va a pegar en el portal de la DIAN.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
    const { toast } = useToast();
    const [copiado, setCopiado] = useState(false);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1500);
        } catch {
            toast({
                title: 'No se pudo copiar',
                description: `Selecciona el ${label} y cópialo a mano.`,
                variant: 'destructive',
            });
        }
    };

    return (
        <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0"
            title={`Copiar ${label}`}
            aria-label={`Copiar ${label}`}
            onClick={copiar}
        >
            {copiado
                ? <Check className="h-3 w-3 text-emerald-600" />
                : <Copy className="h-3 w-3 text-muted-foreground" />}
        </Button>
    );
}

/**
 * CUFE: el identificador legal con el que la escuela consulta el documento en
 * el portal de la DIAN. Son 96 caracteres, así que se muestra truncado con
 * `title` para verlo completo y un botón para copiarlo; pintarlo entero
 * ensancharía la tabla y forzaría scroll horizontal en toda la pantalla.
 */
export function CufeLine({ cufe, className }: { cufe: string; className?: string }) {
    return (
        <span className="flex items-center gap-1">
            <span
                className={`font-mono text-[10px] text-muted-foreground truncate max-w-[9rem] ${className ?? ''}`}
                title={cufe}
            >
                CUFE {cufe}
            </span>
            <CopyButton value={cufe} label="CUFE" />
        </span>
    );
}
