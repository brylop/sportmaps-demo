import { supabase } from '../config/supabase';

/**
 * Renders a message template by replacing {{variables}} with real payment data.
 *
 * Flow:
 * 1. Fetch the appropriate template (school-specific override or global default)
 * 2. Fetch related data (parent, child, team, school, school_settings)
 * 3. Replace all {{variable}} placeholders with actual values
 */

export interface RenderContext {
    schoolId: string;
    paymentId: string;
    templateType: string;
    channel?: 'whatsapp' | 'email';
    templateId?: string; // optional: use a specific template instead of the default
}

export interface RenderedMessage {
    body: string;
    subject: string | null;
    templateName: string;
    channel: string;
    recipientPhone: string | null;
    recipientEmail: string | null;
    recipientName: string;
}

export async function renderTemplate(ctx: RenderContext): Promise<RenderedMessage> {
    const channel = ctx.channel || 'whatsapp';

    // 1. Get the template
    let template: any;

    if (ctx.templateId) {
        const { data, error } = await supabase
            .from('payment_message_templates')
            .select('*')
            .eq('id', ctx.templateId)
            .single();
        if (error || !data) throw new Error('Plantilla no encontrada');
        template = data;
    } else {
        // Get school-specific first, fall back to global default
        const { data: schoolTpl } = await supabase
            .from('payment_message_templates')
            .select('*')
            .eq('school_id', ctx.schoolId)
            .eq('template_type', ctx.templateType)
            .eq('channel', channel)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .limit(1);

        if (schoolTpl && schoolTpl.length > 0) {
            template = schoolTpl[0];
        } else {
            // Global default
            const { data: globalTpl } = await supabase
                .from('payment_message_templates')
                .select('*')
                .is('school_id', null)
                .eq('template_type', ctx.templateType)
                .eq('channel', channel)
                .eq('is_active', true)
                .eq('is_default', true)
                .limit(1);

            if (!globalTpl || globalTpl.length === 0) {
                throw new Error(`No hay plantilla activa para tipo=${ctx.templateType}, canal=${channel}`);
            }
            template = globalTpl[0];
        }
    }

    // 2. Fetch payment + related data
    const { data: payment, error: payErr } = await supabase
        .from('payments')
        .select('id, amount, due_date, status, parent_id, child_id, team_id, unregistered_athlete_id, school_id, offering_plan_id')
        .eq('id', ctx.paymentId)
        .single();

    if (payErr || !payment) throw new Error('Pago no encontrado');

    const [parentRes, childRes, unregRes, teamRes, schoolRes, settingsRes, planRes] = await Promise.all([
        payment.parent_id
            ? supabase.from('profiles').select('full_name, email, phone').eq('id', payment.parent_id).single()
            : { data: null },
        payment.child_id
            ? supabase.from('children').select('full_name, parent_phone_temp').eq('id', payment.child_id).single()
            : { data: null },
        payment.unregistered_athlete_id
            ? supabase.from('unregistered_athletes').select('full_name, email, phone').eq('id', payment.unregistered_athlete_id).single()
            : { data: null },
        payment.team_id
            ? supabase.from('teams').select('name').eq('id', payment.team_id).single()
            : { data: null },
        supabase.from('schools').select('name').eq('id', payment.school_id).single(),
        supabase.from('school_settings').select('bank_info, nequi_phone, payment_link').eq('school_id', payment.school_id).single(),
        payment.offering_plan_id
            ? supabase.from('offering_plans').select('name').eq('id', payment.offering_plan_id).single()
            : { data: null },
    ]);

    const parent = parentRes.data as any;
    const child = childRes.data as any;
    const unreg = unregRes.data as any;
    const team = teamRes.data as any;
    const school = schoolRes.data as any;
    const settings = settingsRes.data as any;
    const plan = planRes.data as any;

    // Determine contact info
    const recipientName = parent?.full_name || unreg?.full_name || 'Padre/Acudiente';
    const recipientEmail = parent?.email || unreg?.email || null;
    const recipientPhone = parent?.phone || child?.parent_phone_temp || unreg?.phone || null;
    const athleteName = child?.full_name || unreg?.full_name || 'Deportista';

    // Calculate date-related values
    const dueDate = new Date(payment.due_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const diasVencimiento = Math.max(0, diffDays);
    const diasMora = Math.max(0, -diffDays);

    const formatCOP = (n: number) => new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(n);

    const formatDateStr = (d: Date) => d.toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    // Default payment link
    const paymentLink = settings?.payment_link || `https://app.sportmaps.co/my-payments`;

    // 3. Build the variable map
    const vars: Record<string, string> = {
        '{{nombre_padre}}': recipientName,
        '{{nombre_atleta}}': athleteName,
        '{{nombre_escuela}}': school?.name || 'Tu academia',
        '{{monto}}': formatCOP(payment.amount),
        '{{monto_pendiente}}': formatCOP(payment.amount), // TODO: calculate real pending when partial payments exist
        '{{fecha_vencimiento}}': formatDateStr(dueDate),
        '{{dias_vencimiento}}': String(diasVencimiento),
        '{{dias_mora}}': String(diasMora),
        '{{equipo}}': team?.name || plan?.name || '',
        '{{plan}}': plan?.name || team?.name || '',
        '{{banco}}': settings?.bank_info || '',
        '{{nequi}}': settings?.nequi_phone || '',
        '{{link_pago}}': paymentLink,
    };

    // 4. Replace variables in body and subject
    let renderedBody = template.body;
    let renderedSubject = template.subject || null;

    for (const [key, value] of Object.entries(vars)) {
        renderedBody = renderedBody.split(key).join(value);
        if (renderedSubject) {
            renderedSubject = renderedSubject.split(key).join(value);
        }
    }

    return {
        body: renderedBody,
        subject: renderedSubject,
        templateName: template.name,
        channel: template.channel,
        recipientPhone,
        recipientEmail,
        recipientName,
    };
}
