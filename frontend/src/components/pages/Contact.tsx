import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Phone, User, MessageSquare, Send, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(100, { message: "El nombre debe tener menos de 100 caracteres" }),
  email: z.string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "El email debe tener menos de 255 caracteres" }),
  subject: z.string()
    .trim()
    .min(3, { message: "El asunto debe tener al menos 3 caracteres" })
    .max(200, { message: "El asunto debe tener menos de 200 caracteres" }),
  message: z.string()
    .trim()
    .min(10, { message: "El mensaje debe tener al menos 10 caracteres" })
    .max(1000, { message: "El mensaje debe tener menos de 1000 caracteres" })
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactProps {
  onNavigate: (page: string) => void;
}

export default function Contact({ onNavigate }: ContactProps) {
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema)
  });

  const onSubmit = (data: ContactFormData) => {
    // Encode data for WhatsApp
    const message = encodeURIComponent(
      `*Nuevo mensaje de contacto*\n\n` +
      `*Nombre:* ${data.name}\n` +
      `*Email:* ${data.email}\n` +
      `*Asunto:* ${data.subject}\n\n` +
      `*Mensaje:*\n${data.message}`
    );
    
    // Open WhatsApp with pre-filled message
    window.open(`https://wa.me/573128463555?text=${message}`, '_blank');
    
    toast({
      title: "¡Mensaje enviado!",
      description: "Se abrirá WhatsApp para completar el envío.",
    });
    
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Contáctanos
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              ¿Tienes alguna pregunta o sugerencia? Estamos aquí para ayudarte
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div className="space-y-6">
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Información de Contacto
                  </CardTitle>
                  <CardDescription>
                    Puedes comunicarte con nosotros a través de los siguientes medios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <User className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">Nombre</h3>
                      <p className="text-muted-foreground">Brayan Steven Lopez Romero</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <Mail className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">Email</h3>
                      <a 
                        href="mailto:brylop71@gmail.com" 
                        className="text-primary hover:underline"
                      >
                        brylop71@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <Phone className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">Teléfono / WhatsApp</h3>
                      <a 
                        href="https://wa.me/573128463555" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        +57 312 846 3555
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <MapPin className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">Ubicación</h3>
                      <p className="text-muted-foreground">Colombia</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Horario de Atención
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Lunes - Viernes:</span>
                      <span className="text-muted-foreground">8:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Sábados:</span>
                      <span className="text-muted-foreground">9:00 AM - 2:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Domingos:</span>
                      <span className="text-muted-foreground">Cerrado</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Envíanos un Mensaje</CardTitle>
                <CardDescription>
                  Completa el formulario y nos pondremos en contacto contigo lo antes posible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo *</Label>
                    <Input
                      id="name"
                      placeholder="Tu nombre completo"
                      {...register("name")}
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      {...register("email")}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Asunto *</Label>
                    <Input
                      id="subject"
                      placeholder="¿Sobre qué quieres hablar?"
                      {...register("subject")}
                      className={errors.subject ? "border-destructive" : ""}
                    />
                    {errors.subject && (
                      <p className="text-sm text-destructive">{errors.subject.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensaje *</Label>
                    <Textarea
                      id="message"
                      placeholder="Escribe tu mensaje aquí..."
                      rows={5}
                      {...register("message")}
                      className={errors.message ? "border-destructive" : ""}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive">{errors.message.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" size="lg">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensaje
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Al enviar, se abrirá WhatsApp para completar el envío de tu mensaje
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Back button */}
          <div className="text-center mt-12">
            <Button
              variant="outline"
              onClick={() => onNavigate("landing")}
              size="lg"
            >
              Volver al Inicio
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
