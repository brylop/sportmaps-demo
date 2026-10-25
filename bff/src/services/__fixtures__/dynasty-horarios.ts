/**
 * teams.schedule reales de Dynasty (consulta puntual 2026-10-24). Sin datos
 * personales. Sirven para probar la inferencia de equipo por horario.
 */
import type { HorarioEquipo } from '../attendance-team-inference';

const C = 'Coliseo Dynasty DC';
const NIDO = 'Cancha externa Nido del Colibrí';
const ASO = 'Cancha externa Asoalsacia';
const f = (day: number, time: string, end: string, place: string, group?: string) => ({ day, time, end, place, ...(group ? { group } : {}) });

export const HORARIOS_DYNASTY: HorarioEquipo[] = [
    { team_id: 'INF-F', team_name: 'INFANTIL FEMENINO', schedule: [f(1, '18:30', '20:30', C), f(3, '18:30', '20:30', C), f(6, '11:00', '13:00', C), f(0, '11:00', '13:00', C)] },
    { team_id: 'INF-M', team_name: 'INFANTIL MASCULINO', schedule: [f(2, '18:30', '20:30', C), f(4, '18:30', '20:30', C), f(6, '07:00', '09:00', C), f(0, '08:00', '10:00', ASO)] },
    { team_id: 'INTER', team_name: 'INTERMEDIO', schedule: [
        f(1, '16:00', '18:00', C, 'Origen'), f(3, '16:00', '18:00', C, 'Origen'), f(5, '16:00', '18:00', C, 'Origen'), f(6, '07:00', '09:00', C, 'Origen'), f(0, '09:30', '11:30', ASO, 'Origen'),
        f(2, '16:00', '18:00', NIDO, 'Evolución'), f(4, '16:00', '18:00', C, 'Evolución'), f(6, '09:30', '11:30', ASO, 'Evolución'), f(0, '07:00', '09:00', C, 'Evolución'),
    ] },
    { team_id: 'JUV-F', team_name: 'JUVENIL MAYORES FEMENINO', schedule: null },
    { team_id: 'JUV-M', team_name: 'JUVENIL MAYORES MASCULINO', schedule: [f(2, '20:00', '22:00', C), f(5, '20:00', '22:00', C)] },
    { team_id: 'MEN-F', team_name: 'MENORES FEMENINO', schedule: [
        f(2, '17:00', '19:00', NIDO, 'White'), f(4, '17:00', '19:00', C, 'White'), f(6, '09:30', '11:30', ASO, 'White'), f(0, '07:00', '09:00', C, 'White'),
        f(2, '18:30', '20:30', C, 'Selección'), f(4, '18:30', '20:30', C, 'Selección'), f(5, '18:30', '20:30', C, 'Selección'),
    ] },
    { team_id: 'MEN-M', team_name: 'MENORES MASCULINO', schedule: [f(2, '16:00', '18:00', C), f(4, '16:00', '18:00', NIDO), f(6, '09:30', '11:30', C), f(0, '09:30', '11:30', ASO)] },
    { team_id: 'MINI', team_name: 'MINIVOLLEY BENJAMINES', schedule: [f(1, '17:00', '19:00', C), f(3, '17:00', '19:00', C), f(6, '08:00', '10:00', C), f(0, '08:00', '10:00', C)] },
    { team_id: 'N-ERA', team_name: 'NUEVA ERA', schedule: [f(2, '17:00', '19:00', C), f(3, '17:00', '19:00', NIDO), f(5, '16:00', '18:00', C), f(0, '09:30', '11:30', C)] },
    { team_id: 'SEN', team_name: 'SENIORS', schedule: [f(1, '20:00', '22:00', C), f(4, '20:00', '22:00', C)] },
];
