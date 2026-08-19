import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { daysDiffFromToday, formatDayCO } from '@/lib/dateUtils';

/**
 * Cleans raw payment concept strings like:
 *   "Equipo Equipo - Mensualidad completa, vence dia 10 -- Santiago Robles"
 * Into: "Mensualidad completa, vence dia 10"
 */
function cleanConcept(concept: string | null): string {
    if (!concept) return '';
    let clean = concept;
    // Remove team prefix before any dash separator (-, –, —, --)
    const prefixMatch = clean.match(/^.+?\s[-–—]+\s/);
    if (prefixMatch) {
        clean = clean.substring(prefixMatch[0].length);
    }
    // Remove athlete name suffix after last " -- " or " – " or " — "
    const suffixMatch = clean.match(/^(.+)\s[-–—]+\s[^-–—]+$/);
    if (suffixMatch) {
        clean = suffixMatch[1];
    }
    return clean.trim();
}

export interface PaymentReminder {
    id: string;
    parentId: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    childName: string;
    childId: string;
    teamName: string;
    /** Concepto real del cobro. El correo debe mostrar esto, NO `teamName`. */
    concept: string;
    amount: number;
    dueDate: string;
    status: 'pending' | 'paid' | 'overdue';
    paymentId: string | null;
    daysOverdue: number;
    /**
     * La misma persona YA PAGÓ este periodo en OTRA ficha suya (duplicado de
     * identidad). No se puede excluir sin más porque el match es por nombre, no
     * por documento: se marca, se deja fuera de la preselección y la escuela
     * decide. Es el caso que le mandaba «tienes un pago pendiente» a familias
     * al día en Dynasty.
     */
    posibleDuplicado?: boolean;
    duplicadoMotivo?: string;
}

/** Lo que hace falta de un cobro para escribirle a quien lo debe. */
export interface WhatsAppReminderTarget {
    paymentId: string;
    contactName: string;
    contactPhone: string | null;
    contactEmail?: string | null;
    athleteName: string;
    amount: number;
    dueDate: string;
    status: 'pending' | 'overdue';
}

/**
 * `opened` significa que WhatsApp se abrio con el texto listo — el envio final lo
 * da la persona. No decirle a la escuela "enviado" cuando todavia falta ese clic.
 */
export type ReminderSendResult =
    | { status: 'no_phone' }
    /** Hay un numero guardado, pero no es marcable: hay que corregir la ficha. */
    | { status: 'invalid_phone'; phone: string }
    | { status: 'opened'; usedFallback: boolean };

/**
 * `wa.me` quiere solo digitos con indicativo, y la misma columna guarda de todo:
 * «+573104759194», «+57 310 8642106», «310 475 9194», «(310)475-9194», «03104759194».
 *
 * Devuelve `null` cuando el numero no encaja en ninguna forma marcable — y eso pasa
 * de verdad: en la cartera de Dynasty hay un «33207820654» y un
 * «32021351573505382189», que son DOS celulares pegados en un mismo campo. Antes de
 * distinguirlos, esos se los tragaba `wa.me` y WhatsApp abria diciendo "numero
 * invalido" sin que la escuela supiera que lo que hay que arreglar es la ficha.
 */
export function toWaPhone(raw: string | null | undefined): string | null {
    const trimmed = (raw || '').trim();
    const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');

    // Ya viene en formato internacional; se respeta el indicativo que trae (E.164).
    if (trimmed.startsWith('+') && digits.length >= 11 && digits.length <= 15) return digits;
    // Celular colombiano pelado.
    if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
    // Trae el 57 adelante pero sin el «+».
    if (digits.length === 12 && digits.startsWith('573')) return digits;
    return null;
}

const formatCOP = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

/** El texto que se manda si el BFF de plantillas no responde. */
function fallbackReminderMessage(t: WhatsAppReminderTarget, schoolName?: string | null): string {
    const escuela = schoolName || 'la academia';
    return t.status === 'overdue'
        ? `Hola ${t.contactName}, le informamos que el pago de *${t.athleteName}* en *${escuela}* (${formatCOP(t.amount)}) esta vencido desde el ${formatDayCO(t.dueDate)}. Por favor realice el pago lo antes posible.`
        : `Hola ${t.contactName}, le recordamos que el pago de *${t.athleteName}* en *${escuela}* (${formatCOP(t.amount)}) vence el ${formatDayCO(t.dueDate)}. Gracias por su puntualidad.`;
}

export interface ReminderBatch {
    schoolId: string;
    generatedAt: string;
    totalReminders: number;
    totalAmount: number;
    byStatus: {
        pending: number;
        overdue: number;
    };
    reminders: PaymentReminder[];
}

class PaymentRemindersAPI {
    /**
     * Fetch pending/overdue payments for a school, enriched with parent + child info.
     * This is the core function that generates the reminder list.
     */
    async generateReminders(schoolId: string, branchId?: string | null): Promise<ReminderBatch> {
        // Get all pending/overdue payments with parent + child data
        let query = supabase
            .from('payments')
            .select(`
                id,
                amount,
                due_date,
                status,
                payment_date,
                parent_id,
                child_id,
                team_id,
                unregistered_athlete_id,
                offering_plan_id,
                concept
            `)
            .eq('school_id', schoolId)
            .in('status', ['pending', 'overdue']);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: payments, error } = await query.order('due_date', { ascending: true });

        if (error) throw error;
        if (!payments || payments.length === 0) {
            return {
                schoolId,
                generatedAt: new Date().toISOString(),
                totalReminders: 0,
                totalAmount: 0,
                byStatus: { pending: 0, overdue: 0 },
                reminders: [],
            };
        }

        // Get unique parent/child/unregistered/program IDs
        const parentIds = [...new Set(payments.map(p => p.parent_id).filter(Boolean))];
        const childIds = [...new Set(payments.map(p => p.child_id).filter(Boolean))];
        const unregisteredIds = [...new Set(payments.map(p => p.unregistered_athlete_id).filter(Boolean))];
        const teamIds = [...new Set(payments.map(p => p.team_id).filter(Boolean))];
        const planIds = [...new Set(payments.map(p => p.offering_plan_id).filter(Boolean))];

        // Fetch parent profiles
        const { data: parents } = parentIds.length > 0
            ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', parentIds)
            : { data: [] };

        // Fetch children
        const { data: children } = childIds.length > 0
            ? await supabase.from('children').select('id, full_name, parent_phone_temp').in('id', childIds)
            : { data: [] };

        // Fetch unregistered athletes (adult self-enrolled)
        const { data: unregisteredAthletes } = unregisteredIds.length > 0
            ? await supabase.from('unregistered_athletes').select('id, full_name, email, phone').in('id', unregisteredIds)
            : { data: [] };

        // Fetch teams
        const { data: teamsData } = teamIds.length > 0
            ? await supabase.from('teams').select('id, name').in('id', teamIds)
            : { data: [] };

        // Fetch offering plans
        const { data: plansData } = planIds.length > 0
            ? await supabase.from('offering_plans').select('id, name').in('id', planIds)
            : { data: [] };

        const parentMap = new Map((parents || []).map(p => [p.id, p]));
        const childMap = new Map((children || []).map(c => [c.id, c]));
        const unregisteredMap = new Map((unregisteredAthletes || []).map(u => [u.id, u]));
        const teamMap = new Map((teamsData || []).map(p => [p.id, p]));
        const planMap = new Map((plansData || []).map(p => [p.id, p]));

        // Deduplicate payments with same athlete + amount + due_date
        const seen = new Set<string>();
        const uniquePayments = payments.filter(payment => {
            const athleteKey = payment.child_id || payment.unregistered_athlete_id || payment.parent_id || '';
            const key = `${athleteKey}|${payment.amount}|${payment.due_date}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // ── Guard: no reclamarle a quien YA PAGÓ ese periodo ────────────────
        // Un cobro impago no significa deuda. Puede ser un duplicado del mes que
        // la familia ya pagó — sea en este mismo cobro-sujeto o en la ficha
        // gemela de la misma persona. Sin este cruce, el recordatorio le escribe
        // a familias al día (Dynasty, agosto 2026).
        const { data: pagados } = await supabase
            .from('payments')
            .select('id, child_id, unregistered_athlete_id, user_id, amount, due_date, period_year, period_month, concept')
            .eq('school_id', schoolId)
            .in('status', ['paid', 'partial']);

        const periodoDe = (p: { period_year?: number | null; period_month?: number | null; due_date?: string | null }) =>
            p.period_year && p.period_month
                ? `${p.period_year}-${String(p.period_month).padStart(2, '0')}`
                : (p.due_date || '').slice(0, 7);
        const sujetoDe = (p: { child_id?: string | null; unregistered_athlete_id?: string | null; user_id?: string | null }) =>
            p.child_id || p.unregistered_athlete_id || p.user_id || '';
        // Tokens del nombre sin acentos. Comparar la cadena completa NO alcanza:
        // «Gabriela Núñez» y «Gabriela nuñez osorio» son la misma niña con un
        // apellido de más en una de las dos fichas. Se compara por SUBCONJUNTO.
        const tokensNombre = (s: string) => new Set(
            (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
                .toUpperCase().replace(/[^A-Z\s]/g, ' ').trim()
                .split(/\s+/).filter(t => t.length >= 3),
        );
        // Mismo nombre, o el de uno contenido en el del otro, con 2+ tokens en
        // común. Exigir 2 evita emparejar a cualquiera que comparta un apellido.
        const mismoNombre = (a: Set<string>, b: Set<string>) => {
            if (a.size < 2 || b.size < 2) return false;
            const comunes = [...a].filter(t => b.has(t)).length;
            return comunes >= 2 && (comunes === a.size || comunes === b.size);
        };
        // Matrícula/uniforme/torneo no cancelan la mensualidad ni al revés.
        // OJO: `payment_type` NO sirve para esto — en Dynasty la mensualidad
        // pagada viene como 'one_time' y la duplicada como 'subscription'.
        const esUnicaVez = (c?: string | null) =>
            /matricul|inscripcion|uniforme|torneo|examen|carnet|kit|implement|multa|sancion/
                .test((c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

        // Los mapas de arriba solo cubren los sujetos de los cobros IMPAGOS. La
        // ficha gemela que ya pagó normalmente no está ahí, así que hay que
        // traer sus nombres aparte o el cruce por nombre nunca encuentra nada.
        const pagChildIds = [...new Set((pagados || []).map(q => q.child_id).filter(Boolean))]
            .filter(id => !childMap.has(id as string)) as string[];
        const pagUnregIds = [...new Set((pagados || []).map(q => q.unregistered_athlete_id).filter(Boolean))]
            .filter(id => !unregisteredMap.has(id as string)) as string[];
        const [{ data: pagChildren }, { data: pagUnreg }] = await Promise.all([
            pagChildIds.length
                ? supabase.from('children').select('id, full_name').in('id', pagChildIds)
                : Promise.resolve({ data: [] as any[] }),
            pagUnregIds.length
                ? supabase.from('unregistered_athletes').select('id, full_name').in('id', pagUnregIds)
                : Promise.resolve({ data: [] as any[] }),
        ]);
        const nombrePagado = new Map<string, string>([
            ...[...childMap].map(([id, c]) => [id, (c as any).full_name] as [string, string]),
            ...[...unregisteredMap].map(([id, u]) => [id, (u as any).full_name] as [string, string]),
            ...(pagChildren || []).map(c => [c.id, c.full_name] as [string, string]),
            ...(pagUnreg || []).map(u => [u.id, u.full_name] as [string, string]),
        ]);

        const pagadoPorSujeto = new Set<string>();   // sujeto|periodo
        // Por periodo, los pagados con sus tokens de nombre, para cruzar por
        // subconjunto (no se puede indexar por nombre exacto, ver `mismoNombre`).
        const pagadoPorPeriodo = new Map<string, { sujeto: string; monto: number; toks: Set<string> }[]>();
        for (const q of (pagados || [])) {
            if (esUnicaVez(q.concept)) continue;
            const per = periodoDe(q);
            if (!per) continue;
            const subj = sujetoDe(q);
            if (subj) pagadoPorSujeto.add(`${subj}|${per}`);
            const toks = tokensNombre(nombrePagado.get(subj) || '');
            if (toks.size >= 2) {
                if (!pagadoPorPeriodo.has(per)) pagadoPorPeriodo.set(per, []);
                pagadoPorPeriodo.get(per)!.push({ sujeto: subj, monto: Number(q.amount || 0), toks });
            }
        }

        // Certeza: el MISMO sujeto ya tiene ese periodo pagado → no es deuda,
        // es un duplicado. Se saca de la lista, no se le escribe a nadie.
        const cobrables = uniquePayments.filter(payment => {
            const per = periodoDe(payment as any);
            const subj = sujetoDe(payment as any);
            return !(per && subj && pagadoPorSujeto.has(`${subj}|${per}`));
        });

        const reminders: PaymentReminder[] = cobrables.map(payment => {
            const parent = parentMap.get(payment.parent_id);
            const child = childMap.get(payment.child_id || '');
            const unregistered = unregisteredMap.get(payment.unregistered_athlete_id || '');
            const plan = planMap.get(payment.offering_plan_id || '');
            const team = teamMap.get(payment.team_id || '');
            const daysOverdue = payment.due_date
                ? Math.max(0, daysDiffFromToday(payment.due_date))
                : 0;

            // For unregistered athletes, the athlete IS the contact person
            const contactName = parent?.full_name || unregistered?.full_name || 'Sin nombre';
            const contactEmail = (parent as any)?.email || unregistered?.email || '';
            const contactPhone = (parent as any)?.phone || (child as any)?.parent_phone_temp || unregistered?.phone || '';
            const athleteName = child?.full_name || unregistered?.full_name || 'Sin asignar';

            // Show plan name > cleaned concept
            const programLabel = plan?.name || cleanConcept(payment.concept);

            // Probable: alguien con el MISMO nombre en esta escuela ya pagó ese
            // periodo, pero desde otro sujeto → ficha gemela de la misma persona.
            // El match es por nombre, no por documento, así que no se excluye
            // solo: se marca para que la escuela lo confirme.
            const per = periodoDe(payment as any);
            const subj = sujetoDe(payment as any);
            const misToks = tokensNombre(athleteName);
            const gemelo = per && !esUnicaVez(payment.concept)
                ? (pagadoPorPeriodo.get(per) || []).find(
                    x => x.sujeto !== subj && mismoNombre(misToks, x.toks),
                )
                : undefined;
            const esDuplicado = !!gemelo;

            return {
                id: payment.id,
                parentId: payment.parent_id || payment.unregistered_athlete_id || '',
                parentName: contactName,
                parentEmail: contactEmail,
                parentPhone: contactPhone,
                childName: athleteName,
                childId: payment.child_id || payment.unregistered_athlete_id || '',
                teamName: programLabel,
                concept: payment.concept || programLabel,
                amount: payment.amount,
                dueDate: payment.due_date,
                status: payment.status as 'pending' | 'overdue',
                paymentId: payment.id,
                daysOverdue,
                posibleDuplicado: esDuplicado,
                duplicadoMotivo: esDuplicado
                    ? `${athleteName} ya pagó ${per} en otra de sus fichas ($${gemelo!.monto.toLocaleString('es-CO')}). Revisar antes de reclamar.`
                    : undefined,
            };
        });

        return {
            schoolId,
            generatedAt: new Date().toISOString(),
            totalReminders: reminders.length,
            totalAmount: reminders.reduce((sum, r) => sum + r.amount, 0),
            byStatus: {
                pending: reminders.filter(r => r.status === 'pending').length,
                overdue: reminders.filter(r => r.status === 'overdue').length,
            },
            reminders,
        };
    }

    /**
     * Mark overdue payments in the database (batch update status)
     * Delegated to Postgres RPC for server-side date validation and grace periods
     */
    async markOverduePayments(schoolId: string): Promise<number> {
        const { data, error } = await (supabase as any)
            .rpc('mark_overdue_payments', { p_school_id: schoolId });

        if (error) throw error;
        return (data as number) || 0;
    }

    async getAthletesWithoutPayment(schoolId: string): Promise<{
        athlete_id: string;
        full_name: string;
        athlete_type: string;
        team_name: string | null;
        plan_name: string | null;
        price_monthly: number;
        contact_email: string | null;
        contact_phone: string | null;
    }[]> {
        const { data, error } = await (supabase as any)
            .rpc('get_athletes_without_payment', { p_school_id: schoolId });
        if (error) throw error;
        return data ?? [];
    }

    /**
     * Abre WhatsApp con el recordatorio de UN cobro y lo deja en el historial.
     *
     * Vive aca y no en la pantalla porque lo usan dos (Finanzas y Recordatorios), y
     * las dos partes delicadas no aguantan copia: normalizar el celular a lo que
     * espera `wa.me`, y registrar TAMBIEN cuando la plantilla del BFF falla — si
     * solo se registra el camino feliz, la escuela manda el mensaje y el historial
     * jura que nunca paso.
     */
    async sendWhatsAppReminder(
        target: WhatsAppReminderTarget,
        opts: { schoolId: string; schoolName?: string | null; templateId?: string | null },
    ): Promise<ReminderSendResult> {
        const rawPhone = (target.contactPhone || '').trim();
        if (!rawPhone) return { status: 'no_phone' };
        const phone = toWaPhone(rawPhone);
        if (!phone) return { status: 'invalid_phone', phone: rawPhone };

        let body: string;
        let usedFallback = false;
        try {
            const templateType = target.status === 'overdue' ? 'overdue'
                : daysDiffFromToday(target.dueDate) <= 0 ? 'reminder_due'
                    : 'reminder_before';
            const renderBody: Record<string, string> = {
                payment_id: target.paymentId,
                template_type: templateType,
                channel: 'whatsapp',
            };
            if (opts.templateId && opts.templateId !== 'auto') renderBody.template_id = opts.templateId;

            const { message } = await bffClient.post<{ message: { body: string } }>(
                '/api/v1/templates/render',
                renderBody,
            );
            body = message.body;
        } catch (err) {
            usedFallback = true;
            body = fallbackReminderMessage(target, opts.schoolName);
            console.warn('Plantilla del BFF no disponible, se uso el mensaje por defecto:', err);
        }

        const { data: { user } } = await supabase.auth.getUser();
        await this.logReminder({
            school_id: opts.schoolId,
            payment_id: target.paymentId,
            contact_name: target.contactName,
            contact_email: target.contactEmail || undefined,
            contact_phone: target.contactPhone || undefined,
            amount: target.amount,
            channel: 'whatsapp',
            sent_by: user?.id || '',
        });

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, '_blank');
        return { status: 'opened', usedFallback };
    }

    async logReminder(entry: {
        school_id: string;
        payment_id?: string;
        child_id?: string;
        user_id?: string;
        unregistered_athlete_id?: string;
        contact_name: string;
        contact_email?: string;
        contact_phone?: string;
        amount: number;
        channel: 'whatsapp' | 'email' | 'sms' | 'in_app';
        sent_by: string;
        status?: 'sent' | 'failed';
        error_message?: string;
    }): Promise<void> {
        await (supabase as any).from('payment_reminder_logs').insert(entry);
    }

    async getReminderLogs(schoolId: string, limit = 50): Promise<any[]> {
        const { data } = await (supabase as any)
            .from('payment_reminder_logs')
            .select('*')
            .eq('school_id', schoolId)
            .order('sent_at', { ascending: false })
            .limit(limit);
        return data ?? [];
    }
}

export const paymentRemindersAPI = new PaymentRemindersAPI();
