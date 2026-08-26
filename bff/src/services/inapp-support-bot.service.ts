/**
 * inapp-support-bot.service — MOD-21 S1: el bot de soporte in-app.
 *
 * No es un bot nuevo: reusa `chatWithTools()` (`llm.service.ts`) y el mismo
 * patrón de orquestación que `whatsapp-bot.service.ts` (identificar → intent
 * → tool → redactar → entregar), con dos diferencias a favor del canal in-app
 * (spec `docs/specs/soporte-in-app-chat-y-bot.md` §2):
 *
 *   1. Sin paso de identificación: el usuario llega con JWT (requestScopedRPC
 *      resuelve `requester_id` desde el token, no desde un OTP por WhatsApp).
 *   2. Modo siempre "auto" para las 4 tools de este archivo — todas son de
 *      solo lectura o de escalación, ninguna toca dinero ni inscripciones
 *      (decisión #3 de la spec: assisted queda reservado para S3 en
 *      adelante). El interruptor global es `ai_enabled` en
 *      `whatsapp_settings`... salvo que S1 in-app no tiene tabla de settings
 *      propia todavía — se lee la fila global (integration_id NULL) si
 *      existe; si no hay ninguna, el bot queda encendido por defecto.
 *
 * Regla de cero alucinaciones, heredada literal: el bot NUNCA responde datos
 * sin que una tool haya tenido éxito. Si la tool falla, escala; jamás
 * improvisa.
 *
 * Si el humano ya escribió en el hilo (existe un support_messages con
 * author_type='agent'), el bot se queda callado — no le pisa la conversación
 * a un agente que ya tomó el caso. Eso se resuelve solo, no hay bandera.
 */

import { supabase } from '../config/supabase';
import { chatWithTools, type LlmMessage, type LlmTool } from './llm.service';
import { buildUserState } from './support-diagnosis.service';
import { helpArticles, type HelpArticle, type ContentBlock } from '../data/help-articles';

// ─── Tools (spec §5) ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente de soporte de SportMaps, respondiendo por el chat in-app a un usuario YA IDENTIFICADO (no necesitas verificar quién es).
Reglas estrictas:
- Responde SIEMPRE en español, cordial y breve — es un chat, no un correo.
- NUNCA inventes datos. Si preguntan por el estado de su cuenta/inscripción, usa get_my_state. Si preguntan por pagos, saldos o mensualidades, usa get_payment_status. Si preguntan cómo hacer algo en la plataforma, usa search_help_articles.
- Tú SOLO consultas y explicas. No puedes ejecutar ninguna acción que modifique datos (reenviar enlaces, cambiar cobros, reinscribir). Si el usuario necesita una acción así, o si no puedes resolverlo, usa escalate_to_human.
- Formatea montos en pesos colombianos (COP) y fechas en formato legible.
- No repitas preguntas ya identificadas; el usuario ya está autenticado.`;

const TOOLS: LlmTool[] = [
    {
        name: 'get_my_state',
        description: 'Diagnóstico del propio usuario: si puede entrar, en qué escuela(s) está inscrito, invitaciones pendientes. Úsala cuando pregunte "¿por qué no puedo entrar?", "¿estoy inscrito?", "¿en qué escuela estoy?" o similar.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_payment_status',
        description: 'Pagos pendientes o vencidos del usuario en su escuela activa. Úsala cuando pregunte por pagos, mensualidades, saldos o vencimientos.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'search_help_articles',
        description: 'Busca en la base de artículos de ayuda de SportMaps (cómo hacer X en la plataforma). Úsala para preguntas de "cómo hago...", "dónde encuentro...", tutoriales o guías de uso.',
        parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Términos de búsqueda, en español' } },
            required: ['query'],
        },
    },
    {
        name: 'escalate_to_human',
        description: 'Pasa la conversación a una persona del equipo de soporte. Úsala cuando no puedas resolver la duda, cuando se necesite una acción que tú no puedes hacer, o cuando el usuario lo pida explícitamente.',
        parameters: {
            type: 'object',
            properties: { reason: { type: 'string', description: 'Motivo breve de la escalación' } },
            required: [],
        },
    },
];

// ─── Entrada principal ──────────────────────────────────────────────────────

export interface RunSupportBotTurnParams {
    ticketId: string;
    requesterId: string;
    /** school_id informativo resuelto por support_open_ticket(), puede ser null. */
    schoolId: string | null;
}

export async function runSupportBotTurn(params: RunSupportBotTurnParams): Promise<void> {
    // El humano ya tomó el hilo: el bot no interrumpe (§8, riesgo "el bot
    // afirmando cosas falsas" se evita también no dejándolo hablar encima
    // de un agente real).
    const { count: agentCount } = await supabase
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_id', params.ticketId)
        .eq('author_type', 'agent');
    if ((agentCount || 0) > 0) return;

    if (!(await botEnabled())) return;

    const { data: historyRows } = await supabase
        .from('support_messages')
        .select('author_type, body')
        .eq('ticket_id', params.ticketId)
        .order('created_at', { ascending: true })
        .limit(20);

    const messages: LlmMessage[] = (historyRows || []).map((m: any) => ({
        role: m.author_type === 'user' ? 'user' : 'assistant',
        content: m.body,
    }));
    if (!messages.length) return; // nada que responder

    let first;
    try {
        first = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: TOOLS });
    } catch (err: any) {
        console.error('[inapp-support-bot] LLM error:', err?.message);
        await postBotMessageAndEscalate(params.ticketId, 'llm_error');
        return;
    }

    if (!first.toolCalls?.length) {
        await postBotMessage(params.ticketId, first.text || '¿Puedes contarme un poco más sobre lo que necesitas?');
        await setStatus(params.ticketId, 'bot_handled');
        return;
    }

    const call = first.toolCalls[0];

    if (call.name === 'escalate_to_human') {
        await postBotMessageAndEscalate(params.ticketId, String((call.args as any)?.reason || 'user_request'));
        return;
    }

    let toolResult: unknown;
    let toolFailed = false;

    if (call.name === 'get_my_state') {
        try {
            toolResult = await buildUserState({ userId: params.requesterId, scope: 'self' });
        } catch {
            toolFailed = true;
        }
    } else if (call.name === 'get_payment_status') {
        if (!params.schoolId) {
            toolResult = [];
        } else {
            const { data, error } = await supabase.rpc('wa_get_payment_status', {
                p_parent_id: params.requesterId,
                p_school_id: params.schoolId,
            });
            if (error) {
                console.error('[inapp-support-bot] wa_get_payment_status error:', error);
                toolFailed = true;
            } else {
                toolResult = data;
            }
        }
    } else if (call.name === 'search_help_articles') {
        toolResult = searchHelpArticles(String((call.args as any)?.query || ''));
    } else {
        toolFailed = true; // tool desconocida → escalar, nunca improvisar
    }

    if (toolFailed) {
        await postBotMessageAndEscalate(params.ticketId, 'tool_error');
        return;
    }

    messages.push({ role: 'assistant', content: `Llamando ${call.name}` });
    messages.push({ role: 'tool', toolName: call.name, content: JSON.stringify(toolResult) });

    let final;
    try {
        final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: TOOLS });
    } catch {
        await postBotMessage(params.ticketId, fallbackText(call.name, toolResult));
        await setStatus(params.ticketId, 'bot_handled');
        return;
    }

    await postBotMessage(params.ticketId, final.text || fallbackText(call.name, toolResult));
    await setStatus(params.ticketId, 'bot_handled');
}

// ─── Interruptor global ─────────────────────────────────────────────────────
// Reusa whatsapp_settings como flag global (fila con integration_id NULL) en
// vez de crear una tabla propia solo para un booleano. Si no existe fila, el
// bot queda encendido por defecto (fail-open a "responde", no a "no
// responde" — S0 ya garantiza que un humano ve todo lo que el bot no pudo).
async function botEnabled(): Promise<boolean> {
    const { data } = await supabase
        .from('whatsapp_settings')
        .select('ai_enabled')
        .is('integration_id', null)
        .maybeSingle();
    return (data as any)?.ai_enabled !== false;
}

// ─── Entrega ─────────────────────────────────────────────────────────────────
// El bot no tiene auth.uid() (no es una sesión de Postgres autenticada), así
// que no puede pasar por support_post_message() (que decide author_type por
// caller). Escribe directo con el cliente de service role — mismo patrón que
// whatsapp-bot.service.ts usa para whatsapp_message_drafts.

async function postBotMessage(ticketId: string, body: string): Promise<void> {
    await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        author_type: 'bot',
        author_id: null,
        body,
    });
}

async function setStatus(ticketId: string, status: 'bot_handled' | 'waiting_human'): Promise<void> {
    await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
}

async function postBotMessageAndEscalate(ticketId: string, reason: string): Promise<void> {
    await postBotMessage(
        ticketId,
        'Voy a pasar tu caso con una persona del equipo de soporte para ayudarte mejor. En breve te responden por acá mismo. 🙌',
    );
    await setStatus(ticketId, 'waiting_human');
    console.info('[inapp-support-bot] escalado', { ticketId, reason });
}

// ─── search_help_articles ───────────────────────────────────────────────────

function extractPlainText(blocks: ContentBlock[]): string {
    return blocks
        .map((b) => {
            switch (b.type) {
                case 'p':
                case 'h2':
                case 'h3':
                case 'quote':
                case 'callout':
                    return b.content;
                case 'ul':
                case 'ol':
                    return b.items.join(' ');
                case 'table':
                    return [b.headers.join(' '), ...b.rows.map((r) => r.join(' '))].join(' ');
                case 'cta':
                    return `${b.title} ${b.description}`;
                default:
                    return '';
            }
        })
        .join(' ');
}

interface HelpSearchResult {
    slug: string;
    title: string;
    excerpt: string;
    snippet: string;
}

/**
 * Búsqueda por solapamiento de palabras — nada de embeddings, es un corpus
 * de ~2.300 líneas y no vale la pena la infraestructura. Pondera título 3x,
 * excerpt 2x, cuerpo 1x.
 */
function searchHelpArticles(query: string, limit = 3): HelpSearchResult[] {
    const terms = query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(/\W+/)
        .filter((t) => t.length > 2);

    if (!terms.length) return [];

    const norm = (s: string) =>
        s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');

    const scored = helpArticles.map((a: HelpArticle) => {
        const title = norm(a.title);
        const excerpt = norm(a.excerpt);
        const body = norm(extractPlainText(a.body));
        let score = 0;
        for (const t of terms) {
            if (title.includes(t)) score += 3;
            if (excerpt.includes(t)) score += 2;
            if (body.includes(t)) score += 1;
        }
        return { article: a, score, body };
    });

    return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ article, body }) => ({
            slug: article.slug,
            title: article.title,
            excerpt: article.excerpt,
            snippet: body.slice(0, 400),
        }));
}

function fallbackText(toolName: string, result: unknown): string {
    if (toolName === 'search_help_articles') {
        const list = result as HelpSearchResult[];
        if (!list.length) return 'No encontré un artículo de ayuda sobre eso. Voy a pasar tu caso con el equipo.';
        return `Encontré esto que puede ayudarte:\n${list.map((r) => `• ${r.title}`).join('\n')}`;
    }
    if (toolName === 'get_payment_status') {
        const list = Array.isArray(result) ? result : [];
        if (!list.length) return 'No tienes pagos pendientes en este momento. ¡Estás al día! ✅';
        return `Estos son tus pagos pendientes:\n${list
            .slice(0, 5)
            .map((p: any) => `• ${p.concept}: $${Number(p.saldo || 0).toLocaleString('es-CO')} — vence ${p.due_date}`)
            .join('\n')}`;
    }
    return 'Ya tengo la información, dame un segundo para responderte.';
}
