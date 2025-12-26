import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, ShieldCheck, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function SportMapsFooter() {
  return (
    <footer className="bg-muted/50 border-t font-poppins">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* 1. Identidad y Redes Sociales Oficiales */}
          <div className="space-y-6">
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-2">
                <img 
                  src="/sportmaps-logo.png" 
                  alt="SportMaps" 
                  className="h-10 w-auto"
                />
                <span className="text-xl font-bold text-foreground">
                  SportMaps
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Revolucionando el sistema deportivo. Conectamos atletas, escuelas y profesionales en un ecosistema tecnológico unificado.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SocialBtn icon={Facebook} href="https://facebook.com/sportmaps" label="Facebook" />
              <SocialBtn icon={Instagram} href="https://instagram.com/sportmaps" label="Instagram" />
              <SocialBtn icon={Twitter} href="https://twitter.com/sportmaps" label="Twitter" />
              <SocialBtn icon={Linkedin} href="https://linkedin.com/company/sportmaps" label="LinkedIn" />
            </div>
          </div>

          {/* 2. Soluciones del Ecosistema */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold text-lg">Ecosistema</h4>
            <ul className="space-y-3">
              <FooterLink text="Para Atletas" href="/register?role=athlete" />
              <FooterLink text="Para Padres" href="/register?role=parent" />
              <FooterLink text="Para Entrenadores" href="/register?role=coach" />
              <FooterLink text="Para Escuelas" href="/register?role=school" />
              <FooterLink text="Para Profesionales Wellness" href="/register?role=wellness" />
            </ul>
          </div>

          {/* 3. SportMaps Tech */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold text-lg">SportMaps Tech</h4>
            <ul className="space-y-3">
              <FooterLink text="Marketplace" href="/shop" />
              <FooterLink text="Explorar Escuelas" href="/explore" />
              <FooterLink text="Blog Deportivo" href="/blog" />
              <FooterLink text="Centro de Ayuda" href="/help" />
              <FooterLink text="Zona de Partners" href="/partners" isHighlighted />
            </ul>
          </div>

          {/* 4. Contacto & Soporte Global */}
          <div className="space-y-4">
            <h4 className="text-foreground font-semibold text-lg">Contacto & Legal</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">
                  Bogotá D.C., Colombia<br />
                  <span className="text-xs text-muted-foreground/70">Sede Global Latam</span>
                </span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                <a 
                  href="mailto:contacto@sportmaps.co" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  contacto@sportmaps.co
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                <a 
                  href="tel:+573128463555" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  +57 (312) 846-3555
                </a>
              </li>
              <li className="flex items-center gap-4 mt-4">
                <FooterLink text="Términos" href="/terms" isLegal />
                <FooterLink text="Privacidad" href="/privacy" isLegal />
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Inferior */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground text-center md:text-left">
            © 2025 SportMaps Technology S.A.S. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Sitio Seguro SSL & Pagos Protegidos por SportMaps Pay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Sub-componentes
function FooterLink({ 
  text, 
  href = "#", 
  isLegal = false,
  isHighlighted = false 
}: { 
  text: string; 
  href?: string;
  isLegal?: boolean;
  isHighlighted?: boolean;
}) {
  return (
    <li className={isLegal ? "inline" : ""}>
      <Link
        to={href}
    className={`text-sm transition-colors ${
      isHighlighted 
        ? "text-primary hover:text-primary/80 font-medium" 
        : isLegal
          ? "text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          : "text-muted-foreground hover:text-foreground"
    }`}
      >
        {text}
      </Link>
    </li>
  );
}

function SocialBtn({ 
  icon: Icon, 
  href, 
  label 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  href: string; 
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all"
    >
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <Icon className="h-4 w-4" />
      </a>
    </Button>
  );
}
