import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, Phone, Users, CheckCircle2 } from 'lucide-react';
import { GENERIC_SPORT_IMAGE, initialsOf, sportImage } from '@/lib/sportImages';
import type { PublicSchoolLayoutProps } from './PublicSchoolClassicLayout';

/**
 * Layout "Minimal" — sin hero de portada grande, header compacto centrado,
 * paleta reducida (blanco/gris + color de marca) y secciones en acordeón en
 * vez de tabs o scroll largo. Ver docs/specs/perfil-publico-plantillas.md
 * (Fase 3). Mismos datos que Clásica, pensado para cargar rápido.
 */
export function PublicSchoolMinimalLayout({ school, facilities, slug, onAction }: PublicSchoolLayoutProps) {
    return (
        <div className="min-h-screen bg-white pb-20" data-layout="minimal">
            {/* Header compacto */}
            <div className="border-b">
                <div className="container mx-auto px-4 py-10 flex flex-col items-center text-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center overflow-hidden text-lg font-bold text-white uppercase">
                        {school.logo_url
                            ? <img src={school.logo_url} alt={`Logo de ${school.name}`} className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            : initialsOf(school.name)}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{school.name}</h1>
                    <p className="text-sm text-muted-foreground max-w-md">{school.description}</p>
                    <Badge variant="outline" className="gap-1">
                        <MapPin className="w-3 h-3" /> {school.city}
                    </Badge>
                    <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => onAction('Inscribirse')}>Inscribirse</Button>
                        <Button size="sm" variant="outline" onClick={() => onAction('Contactar')}>
                            <Mail className="mr-1.5 h-3.5 w-3.5" /> Contactar
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 max-w-2xl py-8 space-y-6">
                {/* Barra de contacto compacta */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground border-b pb-6">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {school.address}, {school.city}</span>
                    <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {school.phone}</span>
                    <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {school.email}</span>
                    <span>www.sportmaps.app/s/{slug}</span>
                </div>

                <Accordion type="single" collapsible defaultValue="equipos" className="w-full">
                    <AccordionItem value="equipos">
                        <AccordionTrigger className="text-base font-semibold">
                            Equipos {(school.teams ?? []).length > 0 && <Badge variant="secondary" className="ml-2">{(school.teams ?? []).length}</Badge>}
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                            {(school.teams ?? []).map((prog: any, idx: number) => (
                                <Card key={idx} className="overflow-hidden">
                                    <div className="flex gap-3 p-3">
                                        <img
                                            src={prog.image_url || sportImage(prog.sport, prog.name)}
                                            alt={prog.name}
                                            className="h-16 w-16 rounded-lg object-cover shrink-0"
                                            onError={(e) => {
                                                const img = e.currentTarget;
                                                if (img.src !== GENERIC_SPORT_IMAGE) img.src = GENERIC_SPORT_IMAGE;
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="font-semibold text-sm">{prog.name}</p>
                                                <Badge variant="secondary" className="shrink-0 text-xs">{prog.age}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{prog.schedule}</p>
                                            {prog.price && <p className="text-xs font-bold text-primary mt-1">{prog.price}</p>}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            {(school.teams ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground py-4 text-center">No hay equipos publicados por el momento</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="instalaciones">
                        <AccordionTrigger className="text-base font-semibold">
                            Instalaciones {facilities.length > 0 && <Badge variant="secondary" className="ml-2">{facilities.length}</Badge>}
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                            {facilities.map((facility) => (
                                <Card key={facility.id}>
                                    <CardHeader className="py-3">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-sm">{facility.name}</CardTitle>
                                            <Badge variant={facility.status === 'available' ? 'default' : 'secondary'} className="text-xs">
                                                {facility.status === 'available' ? 'Disponible' : 'Ocupado'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="py-0 pb-3 text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" /> Capacidad: {facility.capacity} personas
                                    </CardContent>
                                    <CardFooter className="pb-3">
                                        <Button size="sm" variant="outline" className="w-full" onClick={() => onAction('Reservar Espacio')}>Solicitar Reserva</Button>
                                    </CardFooter>
                                </Card>
                            ))}
                            {facilities.length === 0 && (
                                <p className="text-sm text-muted-foreground py-4 text-center">No hay instalaciones públicas visibles por el momento</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="servicios">
                        <AccordionTrigger className="text-base font-semibold">
                            Servicios {(school.services ?? []).length > 0 && <Badge variant="secondary" className="ml-2">{(school.services ?? []).length}</Badge>}
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                            {(school.services ?? []).map((service: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                        <div>
                                            <p className="font-medium text-sm">{service.title}</p>
                                            <p className="text-xs text-muted-foreground">{service.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-sm text-primary shrink-0">{service.price}</span>
                                </div>
                            ))}
                            {(school.services ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground py-4 text-center">No hay servicios publicados por el momento</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="entrenadores">
                        <AccordionTrigger className="text-base font-semibold">
                            Entrenadores {(school.staff ?? []).length > 0 && <Badge variant="secondary" className="ml-2">{(school.staff ?? []).length}</Badge>}
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2">
                            {(school.staff ?? []).map((member: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 p-2">
                                    <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-xs font-bold text-primary">{initialsOf(member.name)}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.role}</p>
                                    </div>
                                </div>
                            ))}
                            {(school.staff ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground py-4 text-center">No hay entrenadores publicados por el momento</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}
