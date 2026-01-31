
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, Phone, Globe, Calendar, Users, Star, Clock, CheckCircle2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useSchoolFacilities } from '@/hooks/useSchoolData';
import { useToast } from '@/hooks/use-toast';

// Helper to convert hex to HSL for Tailwind variables
function hexToHSL(hex: string) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `${h} ${s}% ${l}%`;
}

// Mock data for demo fallback
const DEMO_SCHOOL_DATA = {
    name: "Academia Deportiva Los Tigres",
    description: "Formando campeones desde 2010. Somos la academia líder en formación integral deportiva, con instalaciones de primera clase y un equipo de entrenadores certificados.",
    banner_url: "https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&q=80&w=2000",
    logo_url: "", // Will use initials
    branding: {
        primaryColor: "#E11D48", // Example: Rose-600 (User can change this)
        secondaryColor: "#1e293b"
    },
    address: "Av. Principal #123-45",
    city: "Bogotá",
    email: "contacto@lostigres.com",
    phone: "+57 300 123 4567",
    services: [
        { title: "Entrenamiento Personalizado", description: "Clases 1 a 1 para mejorar técnica", price: "$50.000/hora" },
        { title: "Torneos Mensuales", description: "Competencia interna y externa", price: "Incluido" },
        { title: "Evaluación Nutricional", description: "Seguimiento trimestral", price: "$80.000" },
        { title: "Tienda Deportiva", description: "Venta de uniformes y equipos", price: "Varios" }
    ],
    programs: [
        { name: "Fútbol Base", age: "5-10 años", schedule: "Lun-Mie-Vie" },
        { name: "Fútbol Juvenil", age: "11-15 años", schedule: "Mar-Jue-Sab" },
        { name: "Alto Rendimiento", age: "16+ años", schedule: "Todos los días" }
    ],
    staff: [
        { name: "Carlos Ruiz", role: "Director Técnico", exp: "15 años" },
        { name: "Ana María Polo", role: "Preparadora Física", exp: "8 años" }
    ]
};

export default function PublicSchoolPage() {
    const { slug } = useParams();
    const { toast } = useToast();

    // Use existing hook specifically for facilities, which now supports mock fallback
    const { facilities, isLoading: isLoadingFacilities } = useSchoolFacilities();

    // Fetch school main info (mocking public access or actual fetch)
    const { data: school, isLoading: isLoadingSchool } = useQuery({
        queryKey: ['public-school', slug],
        queryFn: async () => {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 800));

            // In a real implementation: fetch by slug from 'schools' table
            // const { data, error } = await supabase.from('schools').select('*').eq('slug', slug).single();
            // For Demo: Return demo data always
            return DEMO_SCHOOL_DATA;
        }
    });

    const handleAction = (action: string) => {
        toast({
            title: "Acción Demo",
            description: `La acción "${action}" enviaría al usuario al proceso de registro o contacto.`
        });
    };

    if (isLoadingSchool || isLoadingFacilities) {
        return <LoadingSpinner fullScreen text="Cargando perfil de la academia..." />;
    }

    if (!school) return <div>Escuela no encontrada</div>;

    // Calculate dynamic styles based on school branding
    const customStyles = school.branding ? {
        '--primary': hexToHSL(school.branding.primaryColor),
        '--primary-foreground': '0 0% 100%', // Assume white text on primary for now
    } as React.CSSProperties : {};

    return (
        <div className="min-h-screen bg-gray-50 pb-20" style={customStyles}>
            {/* Hero Section */}
            <div className="relative h-[400px] w-full overflow-hidden">
                <div className="absolute inset-0 bg-black/60 z-10" />
                <img
                    src={school.banner_url}
                    alt="School Banner"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 z-20 container mx-auto px-4 flex flex-col justify-end pb-12 text-white">
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
                        <div className="h-24 w-24 md:h-32 md:w-32 rounded-xl bg-primary flex items-center justify-center border-4 border-white shadow-xl text-4xl font-bold uppercase transition-colors duration-500">
                            {school.name.substring(0, 2)}
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                                    <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                                    Academia Verificada
                                </Badge>
                                <Badge variant="outline" className="text-white border-white/40">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {school.city}
                                </Badge>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{school.name}</h1>
                            <p className="text-lg md:text-xl text-gray-200 max-w-2xl text-shadow-md">
                                {school.description}
                            </p>
                        </div>
                        <div className="flex gap-3 mt-4 md:mt-0">
                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-lg border-2 border-transparent hover:border-white/20" onClick={() => handleAction('Inscribirse')}>
                                Inscribirse Ahora
                            </Button>
                            <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/40 backdrop-blur-sm" onClick={() => handleAction('Contactar')}>
                                <Mail className="mr-2 h-4 w-4" />
                                Contactar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 -mt-8 relative z-30">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Info & Contact */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información de Contacto</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    <span>{school.address}, {school.city}</span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                                    <Phone className="h-5 w-5 text-primary" />
                                    <span>{school.phone}</span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                                    <Mail className="h-5 w-5 text-primary" />
                                    <span>{school.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
                                    <Globe className="h-5 w-5 text-primary" />
                                    <span>www.sportmaps.app/s/{slug}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-50/50 border-blue-100">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <Clock className="w-5 h-5" /> Horarios de Atención
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Lunes - Viernes</span>
                                    <span className="font-medium">8:00 AM - 8:00 PM</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Sábados</span>
                                    <span className="font-medium">9:00 AM - 5:00 PM</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Domingos</span>
                                    <span className="font-medium">Cerrado</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Tabs (Programs, Facilities, etc) */}
                    <div className="lg:col-span-2 space-y-6">
                        <Tabs defaultValue="programs" className="w-full">
                            <TabsList className="w-full justify-start h-auto p-1 bg-white border rounded-xl mb-6 shadow-sm overflow-x-auto">
                                <TabsTrigger value="programs" className="py-3 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Programas</TabsTrigger>
                                <TabsTrigger value="facilities" className="py-3 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Instalaciones</TabsTrigger>
                                <TabsTrigger value="services" className="py-3 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Servicios</TabsTrigger>
                                <TabsTrigger value="staff" className="py-3 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Entrenadores</TabsTrigger>
                            </TabsList>

                            <TabsContent value="programs" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                                <div className="grid md:grid-cols-2 gap-4">
                                    {school.programs.map((prog: any, idx: number) => (
                                        <Card key={idx} className="overflow-hidden hover:shadow-lg transition-all group border-l-4 border-l-primary/0 hover:border-l-primary">
                                            <CardHeader className="bg-muted/30 pb-3">
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{prog.name}</CardTitle>
                                                    <Badge variant="secondary">{prog.age}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-4 space-y-3">
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    Programa integral de desarrollo técnico y táctico para jóvenes deportistas.
                                                </p>
                                                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                                    <Calendar className="h-4 w-4" />
                                                    {prog.schedule}
                                                </div>
                                            </CardContent>
                                            <CardFooter className="bg-muted/10 border-t pt-4">
                                                <Button className="w-full group-hover:bg-primary" variant="secondary" onClick={() => handleAction('Inscribir Programa')}>Ver Detalle</Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="facilities" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="grid md:grid-cols-2 gap-4">
                                    {facilities.map((facility) => (
                                        <Card key={facility.id} className="overflow-hidden hover:shadow-lg transition-all group">
                                            <div className="h-48 bg-muted relative">
                                                {/* Placeholder image based on type */}
                                                <img
                                                    src={facility.type.includes('Piscina')
                                                        ? 'https://images.unsplash.com/photo-1576435728678-368297b5d3c6?auto=format&fit=crop&q=80&w=800'
                                                        : 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&q=80&w=800'}
                                                    alt={facility.name}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                />
                                                <div className="absolute top-2 right-2">
                                                    <Badge variant={facility.status === 'available' ? 'default' : 'secondary'} className="shadow-sm">
                                                        {facility.status === 'available' ? 'Disponible' : 'Ocupado'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardHeader>
                                                <CardTitle className="flex justify-between items-center text-lg">
                                                    {facility.name}
                                                </CardTitle>
                                                <CardDescription>{facility.type}</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                                    <Users className="w-4 h-4" /> Capacidad: {facility.capacity} personas
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2">{facility.description || "Espacio profesional equipado para el alto rendimiento."}</p>
                                            </CardContent>
                                            <CardFooter>
                                                <Button className="w-full" variant="outline" onClick={() => handleAction('Reservar Espacio')}>Solicitar Reserva</Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                    {facilities.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                                            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            No hay instalaciones públicas visibles por el momento
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="services" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid gap-4">
                                    {school.services.map((service: any, idx: number) => (
                                        <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-6 bg-white border rounded-xl hover:shadow-md transition-shadow">
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
                                                <Button size="sm" onClick={() => handleAction('Solicitar Servicio')}>Solicitar Info</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="staff" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid md:grid-cols-2 gap-6">
                                    {school.staff.map((member: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-4 p-4 border rounded-lg bg-white shadow-sm">
                                            <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                                <span className="text-xl font-bold text-slate-500">{member.name[0]}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold">{member.name}</h4>
                                                <p className="text-primary text-sm font-medium">{member.role}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Exp: {member.exp}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
}
