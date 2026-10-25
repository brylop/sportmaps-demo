/** Felicitar (B1): frases, destinatario y el envío por `give_kudos` (lib/api/v2Contratos). */
import { toast } from 'sonner';
import { darFelicitacion, type SujetoDeportista } from '@/lib/api/v2Contratos';
import { primerNombre } from './coachV2Logic';

export const FRASES_FELICITAR = [
  'Gran actitud hoy en el entreno.',
  'Se nota cuánto has mejorado.',
  'Fuiste el mejor compañero del equipo.',
];

export interface ObjetivoFelicitar {
  clave: string;
  nombre: string;
  childId: string | null;
  userId: string | null;
  /** Ficha sin cuenta (unregistered_athletes): también se puede felicitar. */
  unregisteredId?: string | null;
}

export function sujetoFelicitar(o: ObjetivoFelicitar): SujetoDeportista | null {
  if (o.childId) return { childId: o.childId };
  if (o.userId) return { athleteUserId: o.userId };
  if (o.unregisteredId) return { unregisteredAthleteId: o.unregisteredId };
  return null;
}

/** Llama a give_kudos. Devuelve 'ok' | 'limite' | 'error'. */
export async function enviarFelicitacion(schoolId: string, o: ObjetivoFelicitar, mensaje: string): Promise<'ok' | 'limite' | 'error'> {
  const sujeto = sujetoFelicitar(o);
  if (!sujeto) return 'error';
  const r = await darFelicitacion(schoolId, sujeto, mensaje);
  if (r.codigo === 'KUDOS_DAILY_LIMIT') return 'limite';
  return r.error || r.noDisponible ? 'error' : 'ok';
}

/** Aviso tras el envío real (después de los 8 s). */
export function avisarResultadoFelicitacion(r: 'ok' | 'limite' | 'error', nombre: string) {
  if (r === 'limite') toast.info(`Ya felicitaste a ${primerNombre(nombre)} hoy. Mañana puedes otra vez.`);
  else if (r === 'error') toast.error(`No pudimos enviar la felicitación a ${primerNombre(nombre)}. Intenta de nuevo.`);
}
