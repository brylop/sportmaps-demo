import React from 'react';
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ChevronsUpDown } from "lucide-react";

export const SchoolSwitcher = () => {
    const { schoolId, availableSchools, switchSchool, loading } = useSchoolContext();

    // If loading or no multiple options, we might render a static badge or nothing.
    // However, showing the current school name is always goodcontext.
    if (loading) {
        return <div className="h-9 w-[200px] animate-pulse rounded-md bg-muted" />;
    }

    // If only 1 school (or 0), we just display it as static text or a disabled valid-looking selector
    if (availableSchools.length <= 1) {
        const current = availableSchools[0];
        if (!current) return null;

        return (
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md">
                <Building2 className="h-4 w-4" />
                <span className="truncate max-w-[150px]">{current.schoolName}</span>
                <span className="text-xs text-muted-foreground ml-auto uppercase border px-1 rounded">
                    {current.role === 'school_admin' ? 'Admin' : current.role}
                </span>
            </div>
        );
    }

    return (
        <Select value={schoolId || ''} onValueChange={switchSchool}>
            <SelectTrigger className="w-[240px]">
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <SelectValue placeholder="Seleccionar Escuela" />
                </div>
            </SelectTrigger>
            <SelectContent>
                {availableSchools.map((s) => (
                    <SelectItem key={s.schoolId} value={s.schoolId}>
                        <div className="flex flex-col items-start text-left">
                            <span className="font-medium">{s.schoolName}</span>
                            <span className="text-xs text-muted-foreground uppercase">{s.role === 'school_admin' ? 'Administrador' : s.role}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
