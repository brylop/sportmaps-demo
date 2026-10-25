/**
 * Carnets (acudiente y deportista, V2) — palabras de la pantalla, sin React.
 */
import type { TonoEstado } from '@/components/common/ChipEstado';

export interface CarnetMin {
  status: string;
  is_expired: boolean;
  valid_until: string;
  athlete_name: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function estadoCarnet(c: Pick<CarnetMin, 'status' | 'is_expired'>): { label: string; tono: TonoEstado } {
  if (c.status === 'revoked') return { label: 'Anulado', tono: 'neutro' };
  if (c.is_expired || c.status === 'expired') return { label: 'Vencido', tono: 'peligro' };
  return { label: 'Vigente', tono: 'ok' };
}

function fecha(d: string): string {
  const date = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`;
}

/** «Vence el 31 de diciembre de 2026» / «Venció el …» */
export function venceCarnet(c: Pick<CarnetMin, 'status' | 'is_expired' | 'valid_until'>): string {
  const f = fecha(c.valid_until);
  if (!f) return '';
  return estadoCarnet(c).label === 'Vigente' ? `Vence el ${f}` : `Venció el ${f}`;
}

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;

/** La frase de arriba. */
export function fraseCarnets(cards: CarnetMin[], isAthlete: boolean): { titulo: string; subtitulo: string | null } {
  if (cards.length === 0) return { titulo: isAthlete ? 'Tu carnet' : 'Carnets de tus hijos', subtitulo: null };
  const vencidos = cards.filter((c) => estadoCarnet(c).label !== 'Vigente');
  const tocar = 'Tócalo para verlo en grande o descargarlo.';
  if (vencidos.length === 0) {
    if (cards.length === 1) {
      const quien = isAthlete ? 'Tu carnet' : `El carnet de ${primerNombre(cards[0].athlete_name)}`;
      return { titulo: `${quien} está vigente`, subtitulo: `Muéstralo en la entrada de la escuela. ${tocar}` };
    }
    return { titulo: 'Todos los carnets están vigentes', subtitulo: `Muéstralos en la entrada de la escuela. ${tocar}` };
  }
  if (vencidos.length === 1) {
    const quien = isAthlete && cards.length === 1 ? 'Tu carnet' : `El carnet de ${primerNombre(vencidos[0].athlete_name)}`;
    return { titulo: `${quien} no está vigente`, subtitulo: 'Pídele a la escuela que lo renueve.' };
  }
  return { titulo: `${vencidos.length} carnets no están vigentes`, subtitulo: 'Pídele a la escuela que los renueve.' };
}
