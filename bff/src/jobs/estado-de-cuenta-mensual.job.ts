/**
 * estado-de-cuenta-mensual.job — el estado de cuenta por familia, una vez al
 * mes, el primer día hábil desde que open_month crea los cobros del mes, a las
 * 8:00 COT. Toda la lógica (y el porqué) vive en services/estado-de-cuenta.service.
 *
 * Se programa de 8 a 12 en días hábiles: el tick de las 8:00 es el que manda;
 * los siguientes solo recogen lo que haya quedado (BFF dormido o reiniciado a
 * las 8, una escuela que abrió el mes a mano a media mañana). La idempotencia
 * por familia y mes, y la marca de corrida por escuela, viven en la base: los
 * tres BFF corren este mismo cron y solo uno manda a cada familia.
 */

import { runEstadoDeCuentaMensual } from '../services/estado-de-cuenta.service';

export async function runEstadoDeCuentaMensualJob(ahora: Date = new Date()) {
    return runEstadoDeCuentaMensual(ahora);
}
