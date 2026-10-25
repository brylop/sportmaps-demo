/**
 * Felicitar a un deportista (B1, `give_kudos`). Hoja desde abajo: tres frases
 * de un toque o un mensaje propio (máx. 200). Una por deportista al día: si la
 * base responde KUDOS_DAILY_LIMIT se avisa «Ya lo felicitaste hoy».
 *
 * El envío espera 8 s con «Deshacer» (useAccionConDeshacer): el aviso a la
 * familia no se puede recoger una vez sale.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { primerNombre } from './coachV2Logic';
import { FRASES_FELICITAR, type ObjetivoFelicitar } from './felicitar';

interface Props {
  objetivo: ObjetivoFelicitar | null;
  onClose: () => void;
  /** El profe confirmó: la pantalla programa el envío con Deshacer. */
  onEnviar: (objetivo: ObjetivoFelicitar, mensaje: string) => void;
}

export function FelicitarSheet({ objetivo, onClose, onEnviar }: Props) {
  const [msg, setMsg] = useState('');
  const nombre = objetivo ? primerNombre(objetivo.nombre) || objetivo.nombre : '';
  const limpio = msg.trim();

  return (
    <Drawer open={!!objetivo} onOpenChange={(o) => { if (!o) { setMsg(''); onClose(); } }}>
      <DrawerContent className="max-h-sheet font-poppins">
        <div className="mx-auto flex w-full max-w-page-narrow flex-col gap-4 overflow-y-auto px-gutter pb-6">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-xl font-bold">Felicitar a {nombre}</DrawerTitle>
            <DrawerDescription className="text-xs">
              Le llega a su familia y, si tiene cuenta, a {nombre}. Una por deportista al día.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Frases listas">
            {FRASES_FELICITAR.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={msg === f}
                onClick={() => setMsg(f)}
                className={cn(
                  'min-h-touch rounded-xl border-2 px-3.5 py-2.5 text-left text-sm font-medium transition-transform active:scale-[0.97] motion-reduce:active:scale-100',
                  msg === f ? 'border-primary bg-primary/10' : 'border-border bg-card',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <Textarea
              aria-label="Escribe tu mensaje"
              placeholder="O escribe tu mensaje"
              maxLength={200}
              value={msg}
              onChange={(e) => setMsg(e.target.value.slice(0, 200))}
              className="min-h-touch resize-none rounded-xl"
              rows={3}
            />
            <span className="self-end text-xs text-muted-foreground">{msg.length} / 200</span>
          </div>
          <Button
            className="h-14 rounded-2xl text-base font-semibold"
            disabled={!limpio || !objetivo}
            onClick={() => {
              if (!objetivo || !limpio) return;
              onEnviar(objetivo, limpio);
              setMsg('');
            }}
          >
            Enviar a la familia
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

