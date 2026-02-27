import React from 'react';
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, MapPin } from "lucide-react";

export const SchoolSwitcher = () => {
    const { schoolId, activeBranchId, availableSchools, switchSchool, loading, totalBranches, isGlobalAdmin, branches } = useSchoolContext();

    if (loading) {
        return <div className="h-9 w-full animate-pulse rounded-md bg-muted" />;
    }

    if (!availableSchools || availableSchools.length === 0 || (availableSchools.length === 1 && totalBranches <= 1)) return null;

    // Use a composite key to handle same school with different branches
    const currentKey = `${schoolId}:${activeBranchId || 'all'}`;

    const handleValueChange = (value: string) => {
        const [targetSchoolId, targetBranchId] = value.split(':');
        switchSchool(targetSchoolId, targetBranchId === 'all' ? null : targetBranchId);
    };

    if (availableSchools.length === 1 && totalBranches <= 1) {
        const current = availableSchools[0];
        return (
            <div className="flex flex-col gap-1 w-full border rounded-lg p-2 bg-background/50">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="truncate">{current.schoolName}</span>
                </div>
                {current.branchId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                        <MapPin className="h-3 w-3" />
                        <span>Sede: {current.branchId.slice(0, 8)}...</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Select value={currentKey} onValueChange={handleValueChange}>
            <SelectTrigger className="w-full h-auto py-2">
                <div className="flex items-center gap-2 text-left">
                    <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm truncate">
                            {availableSchools.find(s => s.schoolId === schoolId)?.schoolName || "Seleccionar"}
                        </span>
                        {activeBranchId ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-2 w-2" />
                                Vista Sede
                            </span>
                        ) : (
                            <span className="text-[10px] text-muted-foreground">Admin General</span>
                        )}
                    </div>
                </div>
            </SelectTrigger>
            <SelectContent>
                {availableSchools.map((s) => {
                    // Si es la escuela actual, es admin global y tiene múltiples sedes
                    if (s.schoolId === schoolId && isGlobalAdmin && totalBranches > 1) {
                        return (
                            <React.Fragment key={s.schoolId}>
                                <SelectItem value={`${s.schoolId}:all`} className="font-semibold text-primary">
                                    <div className="flex flex-col items-start py-0.5">
                                        <span className="font-medium text-sm">{s.schoolName}</span>
                                        <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground font-bold tracking-tight">
                                            <span>Admin General</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-0.5">
                                                Todas las sedes
                                            </span>
                                        </div>
                                    </div>
                                </SelectItem>
                                {branches.map(b => (
                                    <SelectItem key={`${s.schoolId}:${b.id}`} value={`${s.schoolId}:${b.id}`} className="ml-4 border-l-2 border-border pl-2 rounded-none">
                                        <div className="flex flex-col items-start py-0.5">
                                            <span className="font-medium text-sm">{b.name}</span>
                                            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground font-bold tracking-tight">
                                                <span className="text-primary flex items-center gap-0.5">
                                                    <MapPin className="h-2 w-2" />
                                                    Vista Sede
                                                </span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </React.Fragment>
                        );
                    }

                    // Comportamiento normal para otras escuelas o cuando no es global admin
                    return (
                        <SelectItem
                            key={`${s.schoolId}:${s.branchId || 'all'}`}
                            value={`${s.schoolId}:${s.branchId || 'all'}`}
                        >
                            <div className="flex flex-col items-start py-0.5">
                                <span className="font-medium text-sm">{s.schoolName}</span>
                                <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground font-bold tracking-tight">
                                    <span>{s.role}</span>
                                    {s.branchId && (
                                        <>
                                            <span>•</span>
                                            <span className="text-primary flex items-center gap-0.5">
                                                <MapPin className="h-2 w-2" />
                                                SEDE
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};
