import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Plus, Trophy, Info } from 'lucide-react';
import { useSchoolFeatures } from '@/hooks/useSchoolFeatures';
import { useSportCategories } from '@/hooks/useSportCategories';
import { useSportsCatalog, buscarDeporte } from '@/hooks/useSportsCatalog';

// ============================================================================
// Mis deportes y categorías
//
// Solo tiene sentido para escuelas MULTIDEPORTE: una escuela de un solo deporte
// administra sus categorías dentro de «Crear equipo», que es donde las usa.
// Por eso el ítem del menú aparece condicionado (ver AppSidebar).
//
// Lo que muestra por deporte:
//   · el EJE de categorización (edad, nivel, peso, cinturón o ninguno), que es
//     lo que decide qué datos pide una categoría nueva
//   · las categorías ADOPTADAS: las que la escuela usa hoy
//   · las SUGERIDAS: las que el catálogo oficial ofrece y todavía no adoptó
//
// La distinción importa: «Sub-19» propia y «Sub-20» de FIFA no son lo mismo, y
// mezclarlas sin marca es como se pierde el mapeo.
// ============================================================================

const ETIQUETA_EJE: Record<string, { titulo: string; ayuda: string }> = {
    age:      { titulo: 'Por edad',      ayuda: 'Cada categoría necesita un rango de edad (desde / hasta).' },
    level:    { titulo: 'Por nivel',     ayuda: 'Categorías por destreza. El rango es de 1 a 10.' },
    weight:   { titulo: 'Por peso',      ayuda: 'Cada categoría necesita un rango en kilos.' },
    belt:     { titulo: 'Por cinturón',  ayuda: 'Las categorías se ordenan por grado.' },
    division: { titulo: 'Por división',  ayuda: 'Solo necesita el nombre.' },
    none:     { titulo: 'Sin categorías', ayuda: 'Este deporte no se organiza por categorías.' },
};

function PanelDeporte({ sport, eje }: { sport: string; eje: string }) {
    const { adoptadas, sugeridas, agregar, isLoading } = useSportCategories(sport);
    const { sports } = useSportsCatalog();
    const info = ETIQUETA_EJE[eje] ?? ETIQUETA_EJE.division;
    const pideRango = eje === 'age' || eje === 'weight' || eje === 'level';

    const [nombre, setNombre] = useState('');
    const [min, setMin] = useState('');
    const [max, setMax] = useState('');

    const deporte = useMemo(() => buscarDeporte(sports, sport), [sports, sport]);

    // Las sugeridas vienen del catálogo con su `grupo` de origen
    // (categorias_edad, modalidades, niveles…). Se agrupan para no mezclar
    // "Sub-15" con "Fútbol Playa" en una sola lista.
    const porGrupo = useMemo(() => {
        const m: Record<string, typeof sugeridas> = {};
        for (const c of sugeridas) {
            const g = c.detalle?.grupo ?? 'otras';
            (m[g] ||= []).push(c);
        }
        return m;
    }, [sugeridas]);

    if (eje === 'none') {
        return (
            <p className="text-sm text-muted-foreground py-6">
                {info.ayuda} Si eso cambia, se ajusta el tipo de categorización del deporte.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{info.titulo}</Badge>
                <span className="text-xs text-muted-foreground">{info.ayuda}</span>
                {deporte?.federacion && (
                    <Badge variant="secondary" className="ml-auto">{deporte.federacion}</Badge>
                )}
            </div>

            {/* ── Las que la escuela usa ─────────────────────────────────── */}
            <div>
                <p className="text-sm font-semibold mb-2">
                    En uso <span className="text-muted-foreground font-normal">({adoptadas.length})</span>
                </p>
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : adoptadas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Todavía no usas ninguna. Agrega una abajo o adopta una de las oficiales.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {adoptadas.map((c) => (
                            <Badge
                                key={c.nombre}
                                variant={c.origen === 'propia' ? 'default' : 'secondary'}
                                className="text-sm py-1"
                            >
                                {c.nombre}
                                {c.detalle?.min != null && c.detalle?.max != null && (
                                    <span className="ml-1 opacity-70">{c.detalle.min}-{c.detalle.max}</span>
                                )}
                                {c.origen === 'propia' && <span className="ml-1 opacity-70">· propia</span>}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Las que ofrece el catálogo oficial ─────────────────────── */}
            {Object.keys(porGrupo).length > 0 && (
                <div>
                    <p className="text-sm font-semibold mb-1">Oficiales que todavía no usas</p>
                    <p className="text-xs text-muted-foreground mb-3">
                        Del catálogo de la federación. Agregar una la deja registrada como oficial,
                        no como propia.
                    </p>
                    {Object.entries(porGrupo).map(([grupo, items]) => (
                        <div key={grupo} className="mb-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                                {grupo.replace(/_/g, ' ')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {items.map((c) => (
                                    <Badge key={grupo + c.nombre} variant="outline" className="font-normal">
                                        {c.nombre}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Agregar una propia ─────────────────────────────────────── */}
            <div className="rounded-xl border p-4 space-y-3">
                <p className="text-sm font-semibold">Agregar una categoría</p>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">Nombre</Label>
                        <Input
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder={eje === 'age' ? 'Sub-19' : 'Nombre'}
                            className="w-[180px] h-9"
                        />
                    </div>
                    {pideRango && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs">
                                    {eje === 'age' ? 'Edad desde' : eje === 'weight' ? 'Kg desde' : 'Nivel desde'}
                                </Label>
                                <Input type="number" value={min} onChange={(e) => setMin(e.target.value)} className="w-[110px] h-9" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">
                                    {eje === 'age' ? 'Edad hasta' : eje === 'weight' ? 'Kg hasta' : 'Nivel hasta'}
                                </Label>
                                <Input type="number" value={max} onChange={(e) => setMax(e.target.value)} className="w-[110px] h-9" />
                            </div>
                        </>
                    )}
                    <Button
                        size="sm"
                        disabled={!nombre.trim() || agregar.isPending}
                        onClick={() =>
                            agregar.mutate(
                                {
                                    nombre: nombre.trim(),
                                    min: min === '' ? null : Number(min),
                                    max: max === '' ? null : Number(max),
                                },
                                { onSuccess: () => { setNombre(''); setMin(''); setMax(''); } },
                            )
                        }
                    >
                        {agregar.isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><Plus className="h-4 w-4 mr-1" /> Agregar</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function SchoolSportsPage() {
    const { sports, isLoading } = useSchoolFeatures();

    if (isLoading) {
        return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    }

    if (sports.length === 0) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="py-10 text-center space-y-2">
                        <Info className="h-6 w-6 mx-auto text-muted-foreground" />
                        <p className="font-medium">Todavía no tienes deportes configurados</p>
                        <p className="text-sm text-muted-foreground">
                            Se configuran al crear tus equipos, o los activa el equipo de SportMaps
                            durante la puesta en marcha.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <header>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="h-7 w-7 text-primary" />
                    Deportes y categorías
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Las categorías oficiales vienen del catálogo de cada federación. Puedes agregar
                    las tuyas cuando la oficial no cubra tu caso.
                </p>
            </header>

            <Tabs defaultValue={sports[0]?.sport}>
                <TabsList className="flex-wrap h-auto">
                    {sports.map((s) => (
                        <TabsTrigger key={s.sport} value={s.sport} className="capitalize">
                            {s.sport.replace(/_/g, ' ')}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {sports.map((s) => (
                    <TabsContent key={s.sport} value={s.sport}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg capitalize">{s.sport.replace(/_/g, ' ')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <PanelDeporte sport={s.sport} eje={s.categorization_axis} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
