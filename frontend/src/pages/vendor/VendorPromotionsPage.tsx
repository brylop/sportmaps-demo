import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag, Percent, Gift, Calendar, ArrowLeft, Sparkles } from 'lucide-react';

export default function VendorPromotionsPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-muted/30 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/vendor/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Tag className="h-6 w-6 text-primary" />
                            Promociones
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Crea descuentos, cupones y campañas para tu tienda.
                        </p>
                    </div>
                </div>

                <Card className="border-dashed">
                    <CardHeader className="text-center pt-10">
                        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-xl">Próximamente</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                            Estamos terminando el módulo de promociones. Pronto podrás crear descuentos por categoría,
                            cupones con código, ofertas por tiempo limitado y combos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 max-w-3xl mx-auto">
                            {[
                                {
                                    icon: Percent,
                                    title: 'Descuentos %',
                                    desc: 'Aplica % a productos, categorías o vendor entero.',
                                },
                                {
                                    icon: Tag,
                                    title: 'Cupones',
                                    desc: 'Códigos con uso único, fecha de expiración y monto mínimo.',
                                },
                                {
                                    icon: Gift,
                                    title: 'Combos',
                                    desc: '2x1, 3x2, paquetes de productos relacionados.',
                                },
                                {
                                    icon: Calendar,
                                    title: 'Ofertas flash',
                                    desc: 'Promociones temporales con countdown.',
                                },
                                {
                                    icon: Sparkles,
                                    title: 'Envío gratis',
                                    desc: 'Compra mínima para activar envío gratis.',
                                },
                                {
                                    icon: Tag,
                                    title: 'Etiquetas',
                                    desc: 'Marca productos como "Nuevo", "Oferta", "Más vendido".',
                                },
                            ].map((f, i) => {
                                const Icon = f.icon;
                                return (
                                    <div key={i} className="rounded-lg border bg-card p-4 text-left">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon className="h-4 w-4 text-primary" />
                                            <h3 className="text-sm font-semibold">{f.title}</h3>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-2">
                            <Badge variant="secondary">Disponible próximamente</Badge>
                            <Button variant="outline" onClick={() => navigate('/vendor/dashboard')}>
                                Volver al dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
