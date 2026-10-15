import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fingerprint } from 'lucide-react';

interface ZkPinFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Texto debajo del campo cuando ya hay un ID asociado (edición). */
  currentPin?: number | null;
}

/** Solo dígitos, hasta 8 (el lector acepta hasta 9; el BFF valida 1–99.999.999). */
export const sanitizeZkPin = (raw: string): string => raw.replace(/\D/g, '').slice(0, 8);

/** `zk_pin` listo para el BFF: número entero, o null si el campo está vacío. */
export const zkPinToPayload = (raw: string): number | null => {
  const t = raw.trim();
  return t === '' ? null : Number(t);
};

/**
 * ID del torniquete (ZKTeco). Reemplaza al «Dorsal» en las escuelas con
 * `registrationZkPinEnabled` (Dreamers, Academia Superior).
 */
export function ZkPinField({ value, onChange, id = 'zkPin', currentPin }: ZkPinFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
        ID del torniquete (ZKTeco)
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="Ej: 602"
        maxLength={8}
        value={value}
        onChange={e => onChange(sanitizeZkPin(e.target.value))}
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        Es el número con el que el deportista queda registrado en el torniquete: conecta su
        ingreso con SportMaps y permite controlar el acceso. Si ya tiene su ID, escríbelo aquí
        y quedará asociado desde ya, sin tener que enrolarlo después. Debe ser único en la escuela.
      </p>
      {currentPin != null && (
        <p className="text-[11px] text-muted-foreground">
          ID actual asociado: <strong>{currentPin}</strong>
        </p>
      )}
    </div>
  );
}
