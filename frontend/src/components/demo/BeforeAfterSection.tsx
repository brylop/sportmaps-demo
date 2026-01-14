import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, X } from 'lucide-react';

export function BeforeAfterSection() {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-3xl font-bold">Antes vs Después de SportMaps</h2>
        <p className="text-muted-foreground">Así cambia la gestión de tu academia</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Before */}
        <Card className="border-2 border-destructive/20">
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                <X className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-destructive">Antes (Sin SportMaps)</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Excel desactualizado con pagos atrasados</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>WhatsApp personal mezclado con trabajo</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Gastar $300k/mes en Facebook Ads sin resultados</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>15 horas semanales en tareas administrativas</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>5% deserción por cobros atrasados y desorganización</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Padres llamando a todas horas por dudas</span>
              </li>
            </ul>
            <div className="mt-6 p-4 bg-destructive/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-destructive">Estrés máximo</p>
              <p className="text-sm text-muted-foreground">Crecimiento estancado</p>
            </div>
          </CardContent>
        </Card>

        {/* After */}
        <Card className="border-2 border-primary shadow-lg">
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">Después (Con SportMaps)</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>Dashboard en tiempo real con todos tus datos</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>App profesional para comunicación con padres</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>15K+ padres te encuentran en marketplace sin ads</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>2 horas semanales en admin (13 horas ahorradas)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>98.5% retención con cobro automático</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>Padres consultan todo desde la app 24/7</span>
              </li>
            </ul>
            <div className="mt-6 p-4 bg-primary/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">+40% ingresos</p>
              <p className="text-sm text-muted-foreground">Más tiempo para entrenar</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Testimonial */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="max-w-3xl mx-auto">
            <blockquote className="text-lg italic text-center mb-4">
              "Recuperamos 13 horas semanales que ahora usamos para entrenar mejor. Los ingresos subieron 40% en 3 meses y los padres están felices con la app. SportMaps no es un gasto, es inversión."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl">👨‍🏫</span>
              </div>
              <div>
                <p className="font-semibold">Carlos Rodríguez</p>
                <p className="text-sm text-muted-foreground">Director, Academia Elite FC</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}