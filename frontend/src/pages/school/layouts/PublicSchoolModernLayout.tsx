import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, Phone, Globe, Calendar, Users, Star, Clock, CheckCircle2 } from 'lucide-react';
import { DEFAULT_BANNER, GENERIC_SPORT_IMAGE, initialsOf, sportImage } from '@/lib/sportImages';
import type { PublicSchoolLayoutProps } from './PublicSchoolClassicLayout';

const SECTIONS = [
    { id: 'equipos', label: 'Equipos' },
    { id: 'instalaciones', label: 'Instalaciones' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'entrenadores', label: 'Entrenadores' },
];

/**
 * Layout "Moderna" — hero partido 50/50 (texto+CTA a la izquierda, imagen a
 * la derecha, sin overlay oscuro) y secciones en scroll continuo con
 * navegación sticky en vez de tabs. Ver docs/specs/perfil-publico-plantillas.md
 * (Fase 2). Mismos datos que Clásica, solo cambia la composición.
 */
export function PublicSchoolModernLayout({ school, facilities, slug, onAction }: PublicSchoolLayoutProps) {
    return (
        <div className="min-h-screen bg-white pb-20" data-layout="modern">
            {/* Hero partido */}
            <div className="grid md:grid-cols-2 min-h-[420px]">
                <div className="flex flex-col justify-center gap-4 px-6 md:px-12 py-16 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary text-white border-0">
                            <Star className="w-3 h-3 mr-1 fill-white" /> Academia Verificada
                        </Badge>
                        <Badge variant="outline">
                            <MapPin className="w-3 h-3 mr-1" /> {school.city}
                        </Badge>
                    </div>
                    <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center overflow-hidden text-xl font-bold text-white uppercase shadow-md">
                        {school.logo_url
                            ? <img src={school.logo_url} alt={`Logo de ${school.name}`} className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            : initialsOf(school.name)}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">{school.name}</h1>
                    <p className="text-base md:text-lg text-muted-foreground max-w-md">{school.description}</p>
                    <div className="flex gap-3 pt-2">
                        <Button size="lg" onClick={() => onAction('Inscribirse')}>Inscribirse Ahora</Button>
                        <Button size="lg" variant="outline" onClick={() => onAction('Contactar')}>
                            <Mail className="mr-2 h-4 w-4" /> Contactar
                        </Button>
                    </div>
                </div>
                <div className="hidden md:block relative overflow-hidden">
                    <img
                        src={school.banner_url || DEFAULT_BANNER}
                        alt={`Portada de ${school.name}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            const img = e.currentTarget;
                            if (img.src !== DEFAULT_BANNER) img.src = DEFAULT_BANNER;
                        }}
                    />
                </div>
            </div>

            {/* Nav sticky por sección */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
                <div className="container mx-auto px-4 flex gap-1 overflow-x-auto">
                    {SECTIONS.map(s => (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-primary whitespace-nowrap border-b-2 border-transparent hover:border-primary transition-colors"
                        >
                            {s.label}
                        </a>
                    ))}
                </div>
            </div>

            <div className="container mx-auto px-4 py-10 space-y-16">
                {/* Contacto + horarios */}
                <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Información de Contacto</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <MapPin className="h-4 w-4 text-primary shrink-0" /> {school.address}, {school.city}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Phone className="h-4 w-4 text-primary shrink-0" /> {school.phone}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Mail className="h-4 w-4 text-primary shrink-0" /> {school.email}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Globe className="h-4 w-4 text-primary shrink-0" /> www.sportmaps.app/s/{slug}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50/50 border-blue-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary text-lg">
                                <Clock className="w-4 h-4" /> Horarios de Atención
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Lunes - Viernes</span><span className="font-medium">8:00 AM - 8:00 PM</span></div>
                            <div className="flex justify-between"><span>Sábados</span><span className="font-medium">9:00 AM - 5:00 PM</span></div>
                            <div className="flex justify-between"><span>Domingos</span><span className="font-medium">Cerrado</span></div>
                        </CardContent>
                    </Card>
                </div>

                {/* Equipos */}
                <section id="equipos" className="scroll-mt-20 space-y-4">
                    <h2 className="text-2xl font-bold">Equipos</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {(school.teams ?? []).map((prog: any, idx: number) => (
                            <Card key={idx} className="overflow-hidden hover:shadow-lg transition-all group">
                                <div className="h-36 bg-muted overflow-hidden">
                                    <img
                                        src={prog.image_url || sportImage(prog.sport, prog.name)}
                                        alt={prog.name}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                            const img = e.currentTarget;
                                            if (img.src !== GENERIC_SPORT_IMAGE) img.src = GENERIC_SPORT_IMAGE;
                                        }}
                                    />
                                </div>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <CardTitle className="text-lg">{prog.name}</CardTitle>
                                            {prog.sport && <CardDescription>{prog.sport}</CardDescription>}
                                        </div>
                                        <Badge variant="secondary" className="shrink-0">{prog.age}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 pt-0">
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {prog.description || 'Programa integral de desarrollo técnico y táctico.'}
                                    </p>
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                        <Calendar className="h-4 w-4" /> {prog.schedule}
                                    </div>
                                    {prog.price && <div className="text-sm font-bold text-primary">{prog.price}</div>}
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" variant="secondary" onClick={() => onAction('Inscribir Programa')}>Ver Detalle</Button>
                                </CardFooter>
                            </Card>
                        ))}
                        {(school.teams ?? []).length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                No hay equipos publicados por el momento
                            </div>
                        )}
                    </div>
                </section>

                {/* Instalaciones */}
                <section id="instalaciones" className="scroll-mt-20 space-y-4">
                    <h2 className="text-2xl font-bold">Instalaciones</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {facilities.map((facility) => (
                            <Card key={facility.id} className="overflow-hidden hover:shadow-lg transition-all group">
                                <div className="h-36 bg-muted relative">
                                    <img
                                        src={sportImage(facility.type, facility.name, facility.description)}
                                        alt={facility.name}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                            const img = e.currentTarget;
                                            if (img.src !== GENERIC_SPORT_IMAGE) img.src = GENERIC_SPORT_IMAGE;
                                        }}
                                    />
                                    <div className="absolute top-2 right-2">
                                        <Badge variant={facility.status === 'available' ? 'default' : 'secondary'}>
                                            {facility.status === 'available' ? 'Disponible' : 'Ocupado'}
                                        </Badge>
                                    </div>
                                </div>
                                <CardHeader>
                                    <CardTitle className="text-lg">{facility.name}</CardTitle>
                                    <CardDescription>{facility.type}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                        <Users className="w-4 h-4" /> Capacidad: {facility.capacity} personas
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{facility.description || 'Espacio profesional equipado para el alto rendimiento.'}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" variant="outline" onClick={() => onAction('Reservar Espacio')}>Solicitar Reserva</Button>
                                </CardFooter>
                            </Card>
                        ))}
                        {facilities.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                No hay instalaciones públicas visibles por el momento
                            </div>
                        )}
                    </div>
                </section>

                {/* Servicios */}
                <section id="servicios" className="scroll-mt-20 space-y-4">
                    <h2 className="text-2xl font-bold">Servicios</h2>
                    <div className="grid gap-4">
                        {(school.services ?? []).map((service: any, idx: number) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-6 bg-muted/30 border rounded-xl hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4 mb-4 sm:mb-0">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{service.title}</h3>
                                        <p className="text-muted-foreground">{service.description}</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <span className="font-bold text-lg text-primary">{service.price}</span>
                                    <Button size="sm" onClick={() => onAction('Solicitar Servicio')}>Solicitar Info</Button>
                                </div>
                            </div>
                        ))}
                        {(school.services ?? []).length === 0 && (
                            <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                No hay servicios publicados por el momento
                            </div>
                        )}
                    </div>
                </section>

                {/* Entrenadores */}
                <section id="entrenadores" className="scroll-mt-20 space-y-4">
                    <h2 className="text-2xl font-bold">Entrenadores</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {(school.staff ?? []).map((member: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                                <div className="h-14 w-14 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                    <span className="text-lg font-bold text-primary">{initialsOf(member.name)}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold">{member.name}</h4>
                                    <p className="text-primary text-sm font-medium">{member.role}</p>
                                    {member.exp && <p className="text-xs text-muted-foreground mt-1">Exp: {member.exp}</p>}
                                </div>
                            </div>
                        ))}
                        {(school.staff ?? []).length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                No hay entrenadores publicados por el momento
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
