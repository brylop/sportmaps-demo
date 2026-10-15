import { useEffect, useMemo, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BranchDot } from './BranchChip';

/**
 * Selector de sede para el owner / admin global (multisede S1 —
 * docs/specs/multisede-selector-y-sede-del-atleta.md).
 *
 * - Solo aparece si la escuela activa tiene MÁS DE UNA sede activa y el usuario
 *   administra toda la escuela (isGlobalAdmin). Un admin o coach «de sede» ya
 *   viene fijado a su sede por la membresía y no lo ve.
 * - «Todas» = activeBranchId null. Elegir una sede llama a
 *   switchSchool(schoolId, branchId), y todo lo que filtra por activeBranchId
 *   (deportistas, cobros, contabilidad, dashboard, equipos) se reacomoda.
 * - Recuerda la última sede elegida POR USUARIO y POR ESCUELA en localStorage y
 *   la restaura al cargar (decisión 3.2 del spec: la última elegida, con
 *   «Todas» siempre a un clic). La clave lleva el user id para que en un equipo
 *   compartido no herede la sede de otra persona.
 *
 * Hasta 3 sedes: control segmentado «Todas / Suba / Norte». Con más, un Select
 * (los segmentos no caben en el ancho del menú lateral ni en el celular).
 */

const ALL = 'all';
const ADMIN_ROLES = new Set(['owner', 'super_admin', 'admin', 'school_admin', 'school']);

const storageKey = (userId: string, schoolId: string) => `sm:active-branch:${userId}:${schoolId}`;

function readStored(userId: string, schoolId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId, schoolId));
  } catch {
    return null;
  }
}

function writeStored(userId: string, schoolId: string, value: string) {
  try {
    localStorage.setItem(storageKey(userId, schoolId), value);
  } catch { /* localStorage no disponible (modo privado, bloqueado) */ }
}

export function BranchSelector({ className }: { className?: string }) {
  const { user } = useAuth();
  const { schoolId, isGlobalAdmin, currentUserRole, branches, activeBranchId, switchSchool } = useSchoolContext();

  const activeBranches = useMemo(
    () => branches.filter((b) => (b.status ?? 'active') !== 'inactive'),
    [branches],
  );
  const canSwitch = !!schoolId && !!user && isGlobalAdmin
    && ADMIN_ROLES.has(String(currentUserRole ?? '')) && activeBranches.length > 1;

  // Restaurar la última sede elegida (una vez por escuela).
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!canSwitch || !schoolId || !user) return;
    if (restoredFor.current === schoolId) return;
    const stored = readStored(user.id, schoolId);
    if (!stored || stored === ALL) {
      restoredFor.current = schoolId;
      return;
    }
    // `branches` se recarga async al cambiar de escuela: si todavía son las de
    // la escuela anterior, el id guardado no aparece y se reintenta en el
    // siguiente render. Si la sede se borró o se inactivó, queda en «Todas».
    if (activeBranches.some((b) => b.id === stored)) {
      restoredFor.current = schoolId;
      if (stored !== activeBranchId) switchSchool(schoolId, stored);
    }
  }, [canSwitch, schoolId, user, activeBranches, activeBranchId, switchSchool]);

  if (!canSwitch || !schoolId || !user) return null;

  const current = activeBranchId ?? ALL;
  const choose = (value: string) => {
    if (value === current) return;
    writeStored(user.id, schoolId, value);
    restoredFor.current = schoolId;
    switchSchool(schoolId, value === ALL ? null : value);
  };

  const options = [{ id: ALL, name: 'Todas' }, ...activeBranches.map((b) => ({ id: b.id, name: b.name }))];

  if (activeBranches.length > 3) {
    return (
      <div className={cn('w-full', className)}>
        <Select value={current} onValueChange={choose}>
          <SelectTrigger className="h-9 text-xs" aria-label="Sede">
            <MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Sede" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="flex items-center gap-2">
                  <BranchDot branchId={o.id === ALL ? null : o.id} branches={branches} />
                  {o.id === ALL ? 'Todas las sedes' : o.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 px-1 mb-1">
        <MapPin className="h-3 w-3" aria-hidden /> Sede
      </p>
      <div
        role="radiogroup"
        aria-label="Sede"
        className="flex w-full rounded-lg border border-border/60 bg-muted/50 p-0.5 gap-0.5"
      >
        {options.map((o) => {
          const selected = o.id === current;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(o.id)}
              title={o.id === ALL ? 'Todas las sedes' : o.name}
              className={cn(
                'flex-1 min-w-0 h-9 inline-flex items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
              )}
            >
              <BranchDot branchId={o.id === ALL ? null : o.id} branches={branches} />
              <span className="truncate">{o.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
