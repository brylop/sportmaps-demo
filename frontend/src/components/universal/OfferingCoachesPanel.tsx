import { useOfferingCoaches } from '@/hooks/useOfferingCoaches';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, UserPlus, Users, Loader2, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

export function OfferingCoachesPanel({ offeringId }: { offeringId: string }) {
  const { assigned, available, isLoading, assign, remove, isAssigning, isRemoving } = useOfferingCoaches(offeringId);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssigned = useMemo(() => {
    if (!searchQuery) return assigned;
    return assigned.filter((a: any) => 
      a.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assigned, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-6 justify-center bg-muted/10 rounded-xl border border-dashed border-muted-foreground/10">
        <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
        <span className="text-xs text-muted-foreground font-medium tracking-tight">Obteniendo staff autorizado...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {/* Header & Stats */}
      <div className="flex items-end justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 shadow-sm">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="text-[12px] font-bold text-foreground tracking-tight">
              Gestión de Staff
            </h4>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Entrenadores habilitados para este plan específico
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary" className="px-2 py-0 h-5 text-[10px] font-bold bg-muted/50 text-muted-foreground border-none">
            {assigned.length} {assigned.length === 1 ? 'COACH' : 'COACHES'}
          </Badge>
        </div>
      </div>

      {/* Buscador (Solo si hay más de 4 coaches) */}
      {assigned.length > 4 && (
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-focus-within:text-primary/60 transition-colors" />
          <Input 
            placeholder="Buscar por nombre..." 
            className="h-8 pl-8 text-[11px] bg-muted/20 border-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Contenedor Grilla con Scroll */}
      <div className="relative">
        <div className={`
          grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar
          ${assigned.length === 0 ? 'flex items-center justify-center p-8 bg-muted/10 rounded-2xl border-2 border-dashed border-muted-foreground/5' : ''}
        `}>
          {assigned.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center opacity-60">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                <Users className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground">Sin restricciones</p>
                <p className="text-[10px] text-muted-foreground/70">Todos los coaches de la escuela pueden dictar este plan</p>
              </div>
            </div>
          ) : filteredAssigned.length === 0 ? (
            <div className="col-span-full py-6 text-center text-[11px] text-muted-foreground italic bg-muted/5 rounded-xl border border-muted-foreground/5">
              No se encontraron coincidencias para "{searchQuery}"
            </div>
          ) : (
            filteredAssigned.map((a: any) => (
              <div 
                key={a.id} 
                className="group flex items-center justify-between p-2 rounded-xl bg-background border border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center text-[12px] font-bold text-primary shadow-inner">
                      {a.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-foreground/90 truncate leading-none mb-0.5">{a.full_name}</p>
                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Entrenador</p>
                  </div>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  disabled={isRemoving}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all disabled:opacity-30 group-hover:bg-muted/50"
                  title="Revocar acceso"
                >
                  {isRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))
          )}
        </div>
        {/* Sombra de scroll si hay muchos */}
        {assigned.length > 6 && <div className="absolute bottom-0 left-0 right-1 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />}
      </div>

      {/* Agregar nuevo — Footer Styling */}
      {available.length > 0 && (
        <div className="pt-2">
          <div className="p-3 rounded-2xl bg-secondary/30 border border-muted-foreground/5 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Autorizar nuevo integrante</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                  <SelectTrigger className="h-9 text-[11px] bg-background border-muted-foreground/10 focus:ring-primary/20 transition-all rounded-xl shadow-sm">
                    <SelectValue placeholder="Seleccionar de la escuela..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-muted-foreground/10 shadow-2xl">
                    {available.map((c: any) => (
                      <SelectItem key={c.id} value={c.id} className="text-[11px] py-2 cursor-pointer focus:bg-primary/5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold">
                            {c.full_name?.charAt(0).toUpperCase()}
                          </div>
                          {c.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="h-9 px-5 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-50 font-bold rounded-xl shrink-0"
                disabled={!selectedCoach || isAssigning}
                onClick={() => {
                  assign(selectedCoach);
                  setSelectedCoach('');
                }}
              >
                {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span className="text-[10px] uppercase tracking-wide">Autorizar</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
