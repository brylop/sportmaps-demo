/**
 * /explorar mientras el módulo está en rediseño (SHOW_EXPLORE apagado).
 * Varias pantallas todavía enlazan a Explorar («Buscar equipos», «Buscar
 * profesional»…): en vez de la pantalla vieja, un aviso claro y el camino de vuelta.
 */
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExplorarProntoPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-screen-d max-w-page-narrow flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex h-touch w-touch items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold">Explorar llega muy pronto</h1>
      <p className="max-w-prose-ui text-muted-foreground">
        Estamos rehaciendo esta sección para que encuentres escuelas, profes y eventos más fácil.
      </p>
      <Button className="min-h-touch" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        Volver
      </Button>
    </div>
  );
}
