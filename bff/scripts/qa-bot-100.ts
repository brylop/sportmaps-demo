/**
 * Corre la batería de QA del bot contra el LLM real.
 *
 *   npx tsx scripts/qa-bot-100.ts               # las 110
 *   npx tsx scripts/qa-bot-100.ts --bloque pagos
 *   npx tsx scripts/qa-bot-100.ts --bloque critica
 *
 * QUÉ MIDE, Y QUÉ NO
 *
 * Ejercita el PRIMER turno: el system prompt real y las herramientas reales,
 * y observa qué decide hacer el modelo. No toca WhatsApp, no toca la base, no
 * manda un solo mensaje a nadie. Eso es deliberado: el 90% de los fallos de
 * este bot son de decisión —llamar la herramienta que no era, o contestar de
 * su propia cabeza algo que no sabe— y esos se ven acá, gratis y sin riesgo.
 *
 * Lo que NO mide: la redacción final (segundo turno), la identificación, el
 * consentimiento, ni la cola de comprobantes. Eso se prueba en vivo.
 *
 * NO ES DETERMINISTA. El modelo puede cambiar de opinión entre corridas; dos
 * ejecuciones seguidas pueden diferir en un puñado de filas. Sirve para ver el
 * MOVIMIENTO entre versiones del prompt, no para clavar un número exacto.
 */

import 'dotenv/config';
import { chatWithTools } from '../src/services/llm.service';
import { SYSTEM_PROMPT, TOOLS } from '../src/services/whatsapp-bot.service';
import { CASOS, type CasoQA, type Esperado } from './qa-bot-100.fixture';

/** Qué hizo el modelo, en los mismos términos que `espera`. */
type Observado = Esperado | 'contesto_el_dato' | 'error';

interface Resultado {
    caso: CasoQA;
    observado: Observado;
    tool: string | null;
    texto: string;
    ok: boolean;
}

/**
 * Señales de que se inventó el dato en vez de admitir que no lo tiene.
 *
 * Es heurística y lo dice: busca la ADMISIÓN, no el invento. Un texto que
 * ni llama herramienta ni admite el vacío está contestando algo, y ese algo
 * salió de la cabeza del modelo. Los falsos positivos se revisan a mano — para
 * eso el reporte imprime el texto completo de cada fila que falla.
 */
const ADMITE = /\b(no (la |lo )?(tengo|manejo|cuento|dispongo|s[eé])|no (te )?(puedo|podr[ií]a) (dar|confirmar|decir|realizar|hacer|efectuar)|no (esa|esta) informaci[oó]n|no tengo acceso|no (tengo|hay) (ese|el) dato|prefiero no|no (me )?corresponde|no estoy (autorizad|habilitad)|no puedo (realizar|hacer|modificar|marcar|cambiar|registrar|inscribir|gestionar)|solo puedo (consultar|ver|darte|ayudarte)|[uú]nicamente puedo|por (motivos|razones) de (privacidad|seguridad)|desde (aqu[ií]|este chat) no|te (paso|comunico|pongo) con|la escuela (te )?(puede|confirma|responde|lo revisa|lo gestiona)|alguien de la escuela|el equipo de la escuela|comun[ií]cate con la escuela|qu[eé] (te gustar[ií]a|quieres) cambiar)\b/i;

function clasificar(tool: string | null, texto: string): Observado {
    if (tool === 'get_payment_status') return 'consulta_pagos';
    if (tool === 'get_payment_methods') return 'medios_de_pago';
    if (tool === 'escalate_to_human') return 'a_un_humano';
    if (ADMITE.test(texto)) return 'sin_datos';
    return 'contesto_el_dato';
}

/**
 * `sin_datos` y `a_un_humano` son intercambiables: las dos son admitir el
 * límite. `rechazar` se cumple con cualquiera de las dos — negarse es negarse,
 * venga como «no puedo» o como «te paso con la escuela».
 */
function aprueba(espera: Esperado, obs: Observado): boolean {
    if (obs === 'error' || obs === 'contesto_el_dato') return false;
    if (espera === obs) return true;
    const admitir = obs === 'sin_datos' || obs === 'a_un_humano';
    if (espera === 'sin_datos' || espera === 'a_un_humano' || espera === 'rechazar') return admitir;
    return false;
}

async function correrCaso(caso: CasoQA): Promise<Resultado> {
    try {
        const r = await chatWithTools({
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: caso.pregunta }],
            tools: TOOLS,
        });
        const tool = (r as any).toolCalls?.[0]?.name ?? null;
        const texto = r.text ?? '';
        const observado = clasificar(tool, texto);
        return { caso, observado, tool, texto, ok: aprueba(caso.espera, observado) };
    } catch (err: any) {
        return { caso, observado: 'error', tool: null, texto: String(err?.message ?? err), ok: false };
    }
}

async function main() {
    const iBloque = process.argv.indexOf('--bloque');
    const filtro = iBloque > -1 ? process.argv[iBloque + 1] : null;
    const casos = filtro ? CASOS.filter((c) => c.bloque === filtro) : CASOS;

    if (!casos.length) {
        console.error(`Sin casos para el bloque "${filtro}".`);
        console.error('Bloques:', [...new Set(CASOS.map((c) => c.bloque))].join(', '));
        process.exit(1);
    }

    console.log(`Corriendo ${casos.length} casos contra el LLM real...\n`);
    const resultados: Resultado[] = [];

    // De a uno, a propósito. En paralelo se satura el proveedor y los 429 se
    // leen como fallos del bot — que es exactamente el ruido que ya nos costó
    // horas de diagnóstico una vez.
    for (const caso of casos) {
        const r = await correrCaso(caso);
        resultados.push(r);
        process.stdout.write(r.ok ? '.' : 'X');
    }
    console.log('\n');

    const fallos = resultados.filter((r) => !r.ok);

    // Por bloque: dónde está el hueco, no cuántos hay.
    const bloques = new Map<string, { ok: number; total: number }>();
    for (const r of resultados) {
        const b = bloques.get(r.caso.bloque) ?? { ok: 0, total: 0 };
        b.total++; if (r.ok) b.ok++;
        bloques.set(r.caso.bloque, b);
    }

    console.log('BLOQUE                 OK / TOTAL');
    console.log('─'.repeat(40));
    for (const [nombre, b] of bloques) {
        const barra = b.ok === b.total ? '✓' : `${b.total - b.ok} fallan`;
        console.log(`${nombre.padEnd(22)} ${String(b.ok).padStart(3)} / ${String(b.total).padEnd(3)}  ${barra}`);
    }

    // Lo más grave primero: inventar un dato es peor que escalar de más.
    const inventados = fallos.filter((r) => r.observado === 'contesto_el_dato');
    if (inventados.length) {
        console.log(`\n\n⚠️  CONTESTÓ DATOS QUE NO TIENE — ${inventados.length} caso(s)`);
        console.log('─'.repeat(70));
        for (const r of inventados) {
            console.log(`\n[${r.caso.id}] ${r.caso.pregunta}`);
            console.log(`    esperado: ${r.caso.espera}`);
            if (r.caso.nota) console.log(`    nota: ${r.caso.nota}`);
            console.log(`    dijo: ${r.texto.replace(/\s+/g, ' ').slice(0, 300)}`);
        }
    }

    const otros = fallos.filter((r) => r.observado !== 'contesto_el_dato');
    if (otros.length) {
        console.log(`\n\nHERRAMIENTA EQUIVOCADA O ERROR — ${otros.length} caso(s)`);
        console.log('─'.repeat(70));
        for (const r of otros) {
            console.log(`[${r.caso.id}] esperaba ${r.caso.espera}, hizo ${r.observado}${r.tool ? ` (${r.tool})` : ''} — ${r.caso.pregunta}`);
        }
    }

    console.log(`\n\nTOTAL: ${resultados.length - fallos.length}/${resultados.length}`);
    console.log('La heurística de «admitió el límite» es por texto y puede fallar:');
    console.log('revisa a mano las filas de arriba antes de darlas por rotas.');
}

main().catch((e) => { console.error(e); process.exit(1); });
