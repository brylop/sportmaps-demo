import { useState } from 'react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

const BRAND_GREEN: [number, number, number] = [26, 97, 24]; // #1a6118, mismo verde que executivePdf.tsx

const DAY_TYPE_LABEL: Record<string, string> = {
    descanso: 'Descanso',
    entrenamiento: 'Entrenamiento',
    partido: 'Partido',
    regenerativo: 'Regenerativo',
    activacion: 'Activación',
};

interface MesocycleExportButtonProps {
    mesocycleId: string;
    mesocycle: {
        starts_on: string;
        ends_on: string;
        general_objective?: string | null;
        game_model?: string | null;
    };
    teamName: string;
}

function formatDateLabel(dateStr: string) {
    return format(new Date(`${dateStr}T12:00:00`), "d 'de' MMMM", { locale: es });
}

function slugifyForFilename(value: string) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

function addHeader(doc: jsPDF, teamName: string, dateRangeLabel: string) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BRAND_GREEN);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(teamName, 15, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(dateRangeLabel, pageWidth - 15, 15, { align: 'right' });
}

function addFooter(doc: jsPDF, pageNum: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 14, pageWidth - 15, pageHeight - 14);
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('SportMaps · Mesociclo de entrenamiento', 15, pageHeight - 9);
    doc.text(`Página ${pageNum}`, pageWidth - 15, pageHeight - 9, { align: 'right' });
}

export function MesocycleExportButton({ mesocycleId, mesocycle, teamName }: MesocycleExportButtonProps) {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);

    async function handleExport() {
        setIsGenerating(true);
        try {
            const { data: microcycles, error: microcyclesError } = await (supabase as any)
                .from('training_microcycles')
                .select('*')
                .eq('mesocycle_id', mesocycleId)
                .order('number', { ascending: true });
            if (microcyclesError) throw microcyclesError;

            const microcycleIds = (microcycles || []).map((mc: any) => mc.id);
            const { data: days, error: daysError } = microcycleIds.length > 0
                ? await (supabase as any)
                    .from('training_microcycle_days')
                    .select('*')
                    .in('microcycle_id', microcycleIds)
                    .order('day_date', { ascending: true })
                : { data: [], error: null };
            if (daysError) throw daysError;

            const dayIds = (days || []).map((d: any) => d.id);
            const { data: dbSessions, error: sessionsError } = dayIds.length > 0
                ? await (supabase as any)
                    .from('training_sessions')
                    .select('*')
                    .in('microcycle_day_id', dayIds)
                : { data: [], error: null };
            if (sessionsError) throw sessionsError;

            const sessionsByDayId = new Map<string, any[]>();
            (dbSessions || []).forEach((s: any) => {
                if (!s.microcycle_day_id) return;
                const list = sessionsByDayId.get(s.microcycle_day_id) || [];
                list.push(s);
                sessionsByDayId.set(s.microcycle_day_id, list);
            });

            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const rangeLabel = `${formatDateLabel(mesocycle.starts_on)} – ${formatDateLabel(mesocycle.ends_on)}`;
            let page = 1;

            addHeader(doc, teamName, rangeLabel);
            doc.setTextColor(30, 30, 30);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Mesociclo de Entrenamiento', 15, 38);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(90, 90, 90);
            doc.text(rangeLabel, 15, 45);
            let cursorY = 45;
            if (mesocycle.general_objective) {
                cursorY += 8;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(60, 60, 60);
                doc.text('Objetivo general', 15, cursorY);
                cursorY += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(40, 40, 40);
                const objectiveLines = doc.splitTextToSize(mesocycle.general_objective, pageWidth - 30);
                doc.text(objectiveLines, 15, cursorY);
                cursorY += objectiveLines.length * 4.5;
            }
            if (mesocycle.game_model) {
                cursorY += 6;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(60, 60, 60);
                doc.text('Modelo de juego', 15, cursorY);
                cursorY += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(40, 40, 40);
                const gameModelLines = doc.splitTextToSize(mesocycle.game_model, pageWidth - 30);
                doc.text(gameModelLines, 15, cursorY);
                cursorY += gameModelLines.length * 4.5;
            }

            let y = cursorY + 12;
            const ensureSpace = (needed: number) => {
                if (y + needed > pageHeight - 18) {
                    addFooter(doc, page);
                    doc.addPage(); page++;
                    addHeader(doc, teamName, rangeLabel);
                    y = 38;
                }
            };

            (microcycles || []).forEach((mc: any) => {
                ensureSpace(16);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(30, 30, 30);
                doc.text(`Semana ${mc.number ?? ''}`.trim(), 15, y);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(110, 110, 110);
                doc.text(`${formatDateLabel(mc.starts_on)} – ${formatDateLabel(mc.ends_on)}`, pageWidth - 15, y, { align: 'right' });
                y += 3;
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.3);
                doc.line(15, y, pageWidth - 15, y);
                y += 6;

                const mcDays = (days || []).filter((d: any) => d.microcycle_id === mc.id);
                if (mcDays.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9);
                    doc.setTextColor(150, 150, 150);
                    doc.text('Sin días cargados en esta semana.', 15, y);
                    y += 10;
                }

                mcDays.forEach((day: any) => {
                    const daySessions = sessionsByDayId.get(day.id) || [];
                    ensureSpace(14);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9.5);
                    doc.setTextColor(40, 40, 40);
                    const dayLabel = format(new Date(`${day.day_date}T12:00:00`), 'EEE d MMM', { locale: es });
                    doc.text(dayLabel, 15, y);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80, 80, 80);
                    doc.text(DAY_TYPE_LABEL[day.day_type] || day.day_type, 48, y);

                    const metaParts: string[] = [];
                    if (day.planned_rpe != null) metaParts.push(`RPE ${day.planned_rpe}`);
                    if (day.planned_minutes != null) metaParts.push(`${day.planned_minutes} min`);
                    if (metaParts.length > 0) {
                        doc.setTextColor(120, 120, 120);
                        doc.setFontSize(8.5);
                        doc.text(metaParts.join(' · '), pageWidth - 15, y, { align: 'right' });
                    }
                    y += 5;

                    if (day.focus) {
                        ensureSpace(6);
                        doc.setFont('helvetica', 'italic');
                        doc.setFontSize(8.5);
                        doc.setTextColor(110, 110, 110);
                        const focusLines = doc.splitTextToSize(day.focus, pageWidth - 34);
                        doc.text(focusLines, 19, y);
                        y += focusLines.length * 4;
                    }

                    daySessions.forEach((session: any) => {
                        if (!session.objectives) return;
                        ensureSpace(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8.5);
                        doc.setTextColor(60, 60, 60);
                        const objectiveLines = doc.splitTextToSize(`• ${session.objectives}`, pageWidth - 34);
                        doc.text(objectiveLines, 19, y);
                        y += objectiveLines.length * 4;
                    });

                    y += 4;
                });

                y += 6;
            });

            addFooter(doc, page);

            const filename = `mesociclo-${slugifyForFilename(teamName)}-${mesocycle.starts_on}.pdf`;
            doc.save(filename);
        } catch (error: any) {
            toast({
                title: 'No se pudo generar el PDF',
                description: error?.message || 'Ocurrió un error al armar el mesociclo.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={isGenerating}>
            <Download className="w-3.5 h-3.5" />
            {isGenerating ? 'Generando...' : 'Exportar PDF'}
        </Button>
    );
}
