import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Zap, Shield, Globe } from "lucide-react";

const TechSpecs = () => {
  const specs = [
    {
      icon: Database,
      title: "PostGIS & Normalización",
      description: "Arquitectura geoespacial de alto rendimiento",
      features: [
        "Geometría LineString & Point optimizada",
        "Índices GiST para consultas sub-segundo",
        "JSONB para métricas acumuladas",
        "Normalización estricta de datos"
      ]
    },
    {
      icon: Zap,
      title: "Procesamiento Asíncrono", 
      description: "Jobs en background para máximo rendimiento",
      features: [
        "Cálculo de desnivel automático",
        "Procesamiento de tracks GPS",
        "Generación de métricas de rendimiento",
        "Liberación inmediata del usuario"
      ]
    },
    {
      icon: Shield,
      title: "API Rate Limiting",
      description: "Protección y calidad de servicio garantizada",
      features: [
        "Limitación estricta de llamadas",
        "Prevención de abusos del sistema",
        "JWT (JSON Web Token) seguro",
        "Autenticación robusta"
      ]
    },
    {
      icon: Globe,
      title: "Consultas Espaciales",
      description: "Búsquedas geográficas de precisión élite",
      features: [
        "BBOX Query para filtros espaciales",
        "ST_DWithin para radios geográficos",
        "Optimización de consultas complejas",
        "Escalabilidad comprobada"
      ]
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Arquitectura de Precisión Técnica
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Cada componente del sistema está diseñado para la <span className="text-primary font-semibold">escala</span> y 
            el <span className="text-secondary font-semibold">rendimiento</span>, utilizando las mejores prácticas 
            de la ingeniería de software deportivo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {specs.map((spec, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <spec.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{spec.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{spec.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {spec.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 mr-3 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechSpecs;