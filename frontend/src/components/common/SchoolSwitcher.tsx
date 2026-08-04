import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

/**
 * ⚠️ DESACTIVADO EN TODA LA APP (2026-04-21).
 *
 * Este componente NO esta montado en ningun layout. El import en
 * AppSidebar.tsx esta comentado. Ver el comentario alli para contexto.
 *
 * Razon: el schema actual no tiene enrollments.branch_id y varios
 * enrollments (planes sin team) no se pueden scopear a una sede
 * concreta. Exponer un switch de escuela/sede que no filtra bien es
 * peor que no ofrecerlo — los roles sin multiples escuelas (atletas,
 * padres) ven una opcion que no tiene sentido para ellos.
 *
 * Para reactivar:
 *   1. Aplicar migracion que agregue enrollments.branch_id con
 *      backfill desde teams.branch_id / school_members.branch_id.
 *   2. Confirmar que la columna esta en BD con information_schema.
 *   3. Descomentar el import y el bloque <SchoolSwitcher /> en
 *      AppSidebar.tsx.
 *   4. Ajustar los filtros del BFF en bff/src/routes/session-bookings.ts
 *      para usar enrollments.branch_id directo (hoy usan teams.branch_id
 *      via join, que no aplica a planes sin team).
 *
 * Solo cambia entre schoolIds distintos. Al conmutar pasa branchId=null
 * para que el contexto resuelva la sede natural del usuario.
 */
export const SchoolSwitcher = () => {
    const { schoolId, availableSchools, switchSchool, loading } = useSchoolContext();

    if (loading) {
        return <div className="h-9 w-full animate-pulse rounded-md bg-muted" />;
    }

    // Deduplicar por schoolId: un mismo colegio puede tener varias filas
    // en school_members (owner + branches, etc). Nos quedamos con la
    // entrada mas "global" (branchId=null cuando exista).
    const uniqueSchools = Array.from(
        availableSchools.reduce((map, s) => {
            const existing = map.get(s.schoolId);
            if (!existing || (!s.branchId && existing.branchId)) {
                map.set(s.schoolId, s);
            }
            return map;
        }, new Map<string, typeof availableSchools[number]>()).values(),
    );

    if (uniqueSchools.length === 0) return null;

    // Mono-escuela: mostramos una card estatica (no hay nada que switchear).
    if (uniqueSchools.length === 1) {
        const current = uniqueSchools[0];
        return (
            <div className="flex flex-col gap-1 w-full border rounded-lg p-2 bg-background/50">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="truncate">{current.schoolName}</span>
                </div>
            </div>
        );
    }

    const handleValueChange = (value: string) => {
        // Siempre conmutamos al contexto global del colegio (branchId=null).
        switchSchool(value, null);
    };

    const activeSchoolName = uniqueSchools.find(s => s.schoolId === schoolId)?.schoolName ?? "Seleccionar";

    return (
        <Select value={schoolId ?? undefined} onValueChange={handleValueChange}>
            <SelectTrigger className="w-full h-auto py-2">
                <div className="flex items-center gap-2 text-left">
                    <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-semibold text-sm truncate">
                        {activeSchoolName}
                    </span>
                </div>
            </SelectTrigger>
            <SelectContent>
                {uniqueSchools.map((s) => (
                    <SelectItem key={s.schoolId} value={s.schoolId}>
                        <div className="flex flex-col items-start py-0.5">
                            <span className="font-medium text-sm">{s.schoolName}</span>
                            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-tight">
                                {s.role}
                            </span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
