import { AlertTriangle } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export interface AllergyInfo {
    has_allergies: boolean;
    allergy_type?: string;
    allergy_severity?: string;
    allergy_treatment?: string;
    additional_notes?: string;
}

export function parseAllergyInfo(medicalInfo: string | null | undefined): AllergyInfo | null {
    if (!medicalInfo) return null;

    // Special case for boolean 'true' string flag without JSON structure
    if (medicalInfo === 'true') {
        return { has_allergies: true };
    }

    try {
        const parsed = JSON.parse(medicalInfo);
        if (parsed.has_allergies) return parsed as AllergyInfo;
        return null;
    } catch {
        // Legacy plain text format
        const lowerMedicalInfo = medicalInfo.toLowerCase();
        if (lowerMedicalInfo.includes('alergia') || lowerMedicalInfo.includes('asma') || lowerMedicalInfo.length > 5) {
            // If it has a plain text description of medical info, we treat it as having medical conditions
            // To be safe, if we get raw text that isn't JSON, we display it as a note
            return { has_allergies: true, additional_notes: medicalInfo };
        }
        return null;
    }
}

interface MedicalAlertBadgeProps {
    medicalInfo?: string | null;
}

export function MedicalAlertBadge({ medicalInfo }: MedicalAlertBadgeProps) {
    const allergyInfo = parseAllergyInfo(medicalInfo);

    if (!allergyInfo) return null;

    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <button className="flex-shrink-0 p-1.5 rounded-full bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-help" aria-label="Información médica importante">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 border-orange-200 dark:border-orange-800 z-50">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400">Información Médica</h4>
                    </div>
                    <div className="space-y-1.5 text-sm">
                        {allergyInfo.allergy_type && (
                            <div>
                                <span className="font-medium text-muted-foreground">Condición/Alergia:</span>{' '}
                                <span>{allergyInfo.allergy_type}</span>
                            </div>
                        )}
                        {allergyInfo.allergy_severity && (
                            <div>
                                <span className="font-medium text-muted-foreground">Severidad:</span>{' '}
                                <span className={allergyInfo.allergy_severity.toLowerCase() === 'alta' ? 'text-red-500 font-semibold' : ''}>
                                    {allergyInfo.allergy_severity}
                                </span>
                            </div>
                        )}
                        {allergyInfo.allergy_treatment && (
                            <div>
                                <span className="font-medium text-muted-foreground">Tratamiento:</span>{' '}
                                <span>{allergyInfo.allergy_treatment}</span>
                            </div>
                        )}
                        {allergyInfo.additional_notes && (
                            <div className="pt-1 border-t border-muted">
                                <span className="font-medium text-muted-foreground">Notas:</span>{' '}
                                <span className="text-xs break-words">{allergyInfo.additional_notes}</span>
                            </div>
                        )}
                        {!allergyInfo.allergy_type && !allergyInfo.additional_notes && (
                            <div className="text-muted-foreground italic">
                                Requiere atención médica especial.
                            </div>
                        )}
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
