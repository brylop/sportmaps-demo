import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, Phone, Globe, Calendar, Users, Clock, CheckCircle2 } from 'lucide-react';
import { DEFAULT_BANNER, GENERIC_SPORT_IMAGE, initialsOf, sportImage } from '@/lib/sportImages';
import type { PublicSchoolLayoutProps } from './PublicSchoolClassicLayout';

/**
 * Layout "Revista" — portada a sangre completa tipo editorial (badges de
 * deporte superpuestos, tipografía grande) y grid asimétrico para equipos
 * (el primero destacado, el resto en columna). Ver
 * docs/specs/perfil-publico-plantillas.md (Fase 3). Mismos datos que
 * Clásica, pensado para escuelas con buenas fotos.
 */
export function PublicSchoolMagazineLayout({ school, facilities, slug, onAction }: PublicSchoolLayoutProps) {
    const teams = school.teams ?? [];
    const [featuredTeam, ...restTeams] = teams;

    return (
        <div className="min-h-screen bg-white pb-20" data-layout="magazine">
            {/* Portada editorial */}
            <div className="relative h-[520px] w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                <img
                    src={school.banner_url || DEFAULT_BANNER}
                    alt={`Portada de ${school.name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const img = e.currentTarget;
                        if (img.src !== DEFAULT_BANNER) img.src = DEFAULT_BANNER;
                    }}
                />
                <div className="absolute inset-0 z-20 container mx-auto px-4 flex flex-col justify-end pb-10 text-white">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {(school.teams ?? []).slice(0, 4).map((t: any, i: number) => t.sport && (
                            <Badge key={i} className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm">
                                {t.sport}
                            </Badge>
                        ))}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none">{school.name}</h1>
                    <p className="text-lg md:text-xl text-gray-200 max-w-2xl mt-3">{school.description}</p>
                    <div className="flex items-center gap-4 mt-6">
                        <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center border-2 border-white overflow-hidden text-base font-bold uppercase">
                            {school.logo_url
                                ? <img src={school.logo_url} alt={`Logo de ${school.name}`} className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                : initialsOf(school.name)}
                        </div>
                        <Button size="lg" onClick={() => onAction('Inscribirse')}>Inscribirse Ahora</Button>
                        <Button size="lg" variant="outline" className="bg-white/10 border-white/40 text-white hover:bg-white/20" onClick={() => onAction('Contactar')}>
                            <Mail className="mr-2 h-4 w-4" /> Contactar
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12 space-y-16">
                {/* Equipos: destacado + grid */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-black tracking-tight">Equipos</h2>
                    {teams.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            No hay equipos publicados por el momento
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-3 gap-6">
                            {featuredTeam && (
                                <Card className="md:col-span-2 overflow-hidden group">
                                    <div className="h-64 bg-muted overflow-hidden">
                                        <img
                                            src={featuredTeam.image_url || sportImage(featuredTeam.sport, featuredTeam.name)}
                                            alt={featuredTeam.name}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            onError={(e) => {
                                                const img = e.currentTarget;
                                                if (img.src !== GENERIC_SPORT_IMAGE) img.src = GENERIC_SPORT_IMAGE;
                                            }}
                                        />
                                    </div>
                                    <CardHeader>
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <CardTitle className="text-2xl">{featuredTeam.name}</CardTitle>
                                                {featuredTeam.sport && <CardDescription>{featuredTeam.sport}</CardDescription>}
                                            </div>
                                            <Badge variant="secondary" className="shrink-0">{featuredTeam.age}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <p className="text-muted-foreground">{featuredTeam.description || 'Programa integral de desarrollo técnico y táctico.'}</p>
                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                            <Calendar className="h-4 w-4" /> {featuredTeam.schedule}
                                        </div>
                                        {featuredTeam.price && <div className="text-sm font-bold text-primary">{featuredTeam.price}</div>}
                                    </CardContent>
                                    <CardFooter>
                                        <Button variant="secondary" onClick={() => onAction('Inscribir Programa')}>Ver Detalle</Button>
                                    </CardFooter>
                                </Card>
                            )}
                            <div className="space-y-4">
                                {restTeams.slice(0, 3).map((prog: any, idx: number) => (
                                    <Card key={idx} className="overflow-hidden group">
                                        <div className="flex gap-3">
                                            <div className="h-24 w-24 bg-muted overflow-hidden shrink-0">
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
                                            <div className="py-2 pr-3 min-w-0">
                                                <p className="font-semibold text-sm truncate">{prog.name}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-1">{prog.schedule}</p>
                                                {prog.price && <p className="text-xs font-bold text-primary mt-1">{prog.price}</p>}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Información de Contacto</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 text-muted-foreground"><MapPin className="h-4 w-4 text-primary shrink-0" /> {school.address}, {school.city}</div>
                            <div className="flex items-center gap-3 text-muted-foreground"><Phone className="h-4 w-4 text-primary shrink-0" /> {school.phone}</div>
                            <div className="flex items-center gap-3 text-muted-foreground"><Mail className="h-4 w-4 text-primary shrink-0" /> {school.email}</div>
                            <div className="flex items-center gap-3 text-muted-foreground"><Globe className="h-4 w-4 text-primary shrink-0" /> www.sportmaps.app/s/{slug}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50/50 border-blue-100">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-primary text-lg"><Clock className="w-4 h-4" /> Horarios de Atención</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Lunes - Viernes</span><span className="font-medium">8:00 AM - 8:00 PM</span></div>
                            <div className="flex justify-between"><span>Sábados</span><span className="font-medium">9:00 AM - 5:00 PM</span></div>
                            <div className="flex justify-between"><span>Domingos</span><span className="font-medium">Cerrado</span></div>
                        </CardContent>
                    </Card>
                </div>

                {/* Instalaciones */}
                <section className="space-y-6">
                    <h2 className="text-3xl font-black tracking-tight">Instalaciones</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {facilities.map((facility) => (
                            <Card key={facility.id} className="overflow-hidden hover:shadow-lg transition-all group">
                                <div className="h-40 bg-muted relative">
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
                <section className="space-y-6">
                    <h2 className="text-3xl font-black tracking-tight">Servicios</h2>
                    <div className="grid gap-4">
                        {(school.services ?? []).map((service: any, idx: number) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-6 bg-muted/20 border rounded-xl hover:shadow-md transition-shadow">
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
                <section className="space-y-6">
                    <h2 className="text-3xl font-black tracking-tight">Entrenadores</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {(school.staff ?? []).map((member: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-4 p-4 border rounded-lg bg-muted/10 shadow-sm">
                                <div className="h-16 w-16 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                    <span className="text-xl font-bold text-primary">{initialsOf(member.name)}</span>
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
