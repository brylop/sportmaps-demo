import { Map, Activity, Users } from "lucide-react";
import FeatureCard from "./FeatureCard";

const Features = () => {
  const features = [
    {
      icon: Map,
      title: "Descubrimiento y Planificación",
      description: "Un lienzo digital donde las rutas de la comunidad se superponen con precisión quirúrgica.",
      details: [
        "Mapa interactivo con clustering inteligente",
        "Creación de rutas con cálculo de elevación en tiempo real", 
        "Visualización detallada con gráficos de perfil",
        "Filtros por desnivel y tipo de terreno",
        "Análisis predictivo del esfuerzo"
      ],
      variant: "discovery" as const
    },
    {
      icon: Activity,
      title: "Rendimiento GPS",
      description: "Seguimiento GPS de alta fidelidad con análisis post-actividad detallado.",
      details: [
        "Grabación con precisión de carrera profesional",
        "Tasa de muestreo optimizada para batería",
        "Segmentación automática de rutas",
        "Visualización de zonas de esfuerzo coloreadas",
        "Anatomía completa de cada actividad"
      ],
      variant: "performance" as const
    },
    {
      icon: Users,
      title: "Comunidad y Social",
      description: "Una capa de información crítica curada por la comunidad de atletas.",
      details: [
        "Puntos de interés verificados por la comunidad",
        "Feed social elegante con visualizaciones",
        "Interacciones rápidas tipo 'Kudos'",
        "Clasificación estricta de POIs",
        "Logística del atleta en tiempo real"
      ],
      variant: "community" as const
    }
  ];

  return (
    <section className="py-20 bg-gradient-elevation">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Módulos de Alto Rendimiento
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Cada módulo está diseñado con la precisión de un instrumento profesional, 
            optimizado para el atleta moderno que busca la excelencia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;