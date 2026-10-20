/**
 * QA de SportBot (chat de soporte in-app) contra el LLM REAL.
 *
 *   npx tsx scripts/qa-sportbot.ts            (desde bff/)
 *
 * Corre `generarRespuesta()` —el mismo ciclo que producción: contexto del
 * usuario, mapa de la app, tools, redacción— con las preguntas reales que el
 * bot respondió mal entre el 31-ago y el 5-oct (análisis 2026-10-06), cada una
 * con el usuario real que la hizo. Solo LEE la base (contexto, estado, pagos);
 * no escribe en ningún ticket ni le manda nada a nadie.
 *
 * NO ES DETERMINISTA: sirve para ver si el bot redacta y da la ruta, no para
 * clavar un número. Las verificaciones son heurísticas de lo que NO debe
 * pasar (lista de manuales, "dame un segundo", "si eres coach…") más una
 * palabra que la respuesta correcta tiene que traer.
 *
 * CUESTA: usa las mismas llaves que los bots de producción (Claude primero si
 * hay ANTHROPIC_API_KEY; si no, Gemini/Groq). El 2026-10-06 tres corridas
 * seguidas agotaron la cuota diaria de Groq y tumbaron el bot de Dynasty. Una
 * corrida cuando haga falta, nunca en bucle ni en CI.
 */

import 'dotenv/config';
import { generarRespuesta } from '../src/services/inapp-support-bot.service';
import { construirContextoSportBot } from '../src/services/sportbot-contexto.service';
import { helpArticles } from '../src/data/help-articles';

const SLUGS = new Set(helpArticles.map((a) => a.slug));
const PAUSA_MS = Number(process.env.QA_PAUSA_MS) || 10_000;

interface Caso {
    quien: string;
    userId: string;
    schoolId: string;
    pregunta: string;
    /** Al menos una de estas (sin tildes, minúsculas) debe aparecer en la respuesta. */
    debeMencionar: string[];
}

const COACH_CARMEL = { userId: '967cfc55-0ce4-45ac-9ecd-5ba4c5a28413', schoolId: '374a6716-af42-4745-afe1-8d089153e01b' };
const COACH_CARMEL_2 = { userId: '43d07884-188a-45a5-9fef-5935647211c9', schoolId: '374a6716-af42-4745-afe1-8d089153e01b' };
const ESCUELA_DEMO = { userId: '6e1eaeec-daa6-4bd0-a12e-8b9de37a899a', schoolId: '25a123f0-6d57-48a4-9800-7b1531d61cd2' };
const ATLETA_FENIX = { userId: 'b81c3484-914b-4288-ab5b-95234513ce5a', schoolId: '26bfb68e-87d4-4792-a1bb-3c65ef5358ce' };

const CASOS: Caso[] = [
    { quien: 'coach', ...COACH_CARMEL, pregunta: 'quiero editar el nombre de mi equipo, quiero que quede 2011-2012-2013', debeMencionar: ['editar equipo', 'lapiz'] },
    { quien: 'coach', ...COACH_CARMEL, pregunta: 'Cuál es la ruta exacta para editar el nombre de un equipo ya creado?', debeMencionar: ['equipos'] },
    { quien: 'coach', ...COACH_CARMEL, pregunta: 'COMO SE HACE LA ASITENCIA', debeMencionar: ['asistencia'] },
    { quien: 'coach', ...COACH_CARMEL_2, pregunta: 'Hola necesito que me habilites a subir un plan de entreno para arqueros,gracias', debeMencionar: ['plan', 'entren'] },
    { quien: 'coach', ...COACH_CARMEL_2, pregunta: 'hice mesociclo y despues iba a subir el plan del 4 de octubre y no tenia opcion', debeMencionar: ['sesion', 'mesociclo', 'semana'] },
    { quien: 'escuela', ...ESCUELA_DEMO, pregunta: 'ASISTENCIAS', debeMencionar: ['asistencia'] },
    { quien: 'escuela', ...ESCUELA_DEMO, pregunta: 'CREAR PAGOS', debeMencionar: ['pago', 'cobro'] },
    { quien: 'escuela', ...ESCUELA_DEMO, pregunta: 'ENTRENADORES', debeMencionar: ['staff', 'entrenador', 'coach'] },
    { quien: 'escuela', ...ESCUELA_DEMO, pregunta: 'FACTURACION ELECTRONICA', debeMencionar: ['factura'] },
    { quien: 'escuela', ...ESCUELA_DEMO, pregunta: 'QR', debeMencionar: ['qr'] },
    { quien: 'atleta', ...ATLETA_FENIX, pregunta: 'Cómo puedo eliminar un hijo registrado? registré 2 hijos y solo tengo 1', debeMencionar: ['hijo', 'escuela', 'soporte', 'equipo'] },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const PROHIBIDO: [RegExp, string][] = [
    [/encontre esto que puede ayudarte/, 'lista de manuales'],
    [/dame un segundo/, 'promesa vacía'],
    [/si eres (coach|director|entrenador|administrador|padre|acudiente)/, 'no sabe quién es'],
    [/\bvos\b|\bche\b/, 'voseo'],
];

async function main() {
    let ok = 0;
    for (const c of CASOS) {
        const ctx = await construirContextoSportBot(c.userId, c.schoolId);
        const t0 = Date.now();
        const r = await generarRespuesta([{ role: 'user', content: c.pregunta }], ctx, {
            ticketId: 'qa', requesterId: c.userId, schoolId: c.schoolId,
        });
        const ms = Date.now() - t0;
        const texto = r.tipo === 'texto' ? r.texto : `[ESCALA: ${r.motivo}]`;
        const n = norm(texto);
        const fallas = PROHIBIDO.filter(([re]) => re.test(n)).map(([, m]) => m);
        if (r.tipo === 'escalar' && /llm_error|respuesta_vacia|tool_error/.test(r.motivo)) fallas.push(`no respondió (${r.motivo})`);
        if (r.tipo === 'texto' && !c.debeMencionar.some((k) => n.includes(k))) fallas.push(`no menciona ${c.debeMencionar.join('/')}`);
        if (/\/ayuda\/[a-z0-9-]+/.test(texto) && !texto.match(/\/ayuda\/[a-z0-9-]+/g)!.every((l) => SLUGS.has(l.slice(7)))) fallas.push('link inventado');
        if (/abre (el )?chat de soporte|escribe a soporte/.test(n)) fallas.push('lo manda al chat donde ya está');
        const pasa = fallas.length === 0;
        if (pasa) ok++;

        console.log(`\n${pasa ? '✅' : '❌'} [${c.quien} · ${ctx.rolesVisibles.join('/')} · ${ctx.escuelaActiva}] ${c.pregunta}`);
        console.log(`   tools: ${r.tools.join(', ') || '—'} · ${ms} ms${fallas.length ? ` · FALLA: ${fallas.join('; ')}` : ''}`);
        console.log(texto.split('\n').map((l) => `   │ ${l}`).join('\n'));
        // Si Claude falla, el respaldo Groq tiene tope de 8.000 tokens/minuto
        // en nuestra cuenta: sin pausa, la batería mide el tope y no el bot.
        await new Promise((r) => setTimeout(r, PAUSA_MS));
    }
    console.log(`\n${ok}/${CASOS.length} pasan.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
