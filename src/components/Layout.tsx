import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowLeft } from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  showBackButton?: boolean;
  backTarget?: string;
  darkMode?: boolean;
}

const Layout = ({ 
  children, 
  currentPage, 
  onNavigate, 
  showBackButton = false, 
  backTarget = "landing",
  darkMode = false 
}: LayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const handleNavigation = (target: string) => {
    onNavigate(target);
    setMobileMenuOpen(false);
  };

  const bgClass = darkMode ? "bg-background-dark text-text-dark-primary" : "bg-background text-foreground";
  const headerClass = darkMode ? "bg-background-dark/80" : "bg-background/80";

  return (
    <div className={`min-h-screen ${bgClass}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-background z-50 p-6 md:hidden">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3 text-2xl font-bold">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                SM
              </div>
              <h1 className="tracking-tight">SportMaps</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <nav className="flex flex-col gap-6">
            <button 
              className="text-left text-lg font-medium hover:text-primary transition-colors"
              onClick={() => handleNavigation("landing")}
            >
              Inicio
            </button>
            <button 
              className="text-left text-lg font-medium hover:text-primary transition-colors"
              onClick={() => handleNavigation("ecosystem")}
            >
              Ecosistema
            </button>
            <button 
              className="text-left text-lg font-medium hover:text-primary transition-colors"
              onClick={() => handleNavigation("explore")}
            >
              Explorar
            </button>
            <button 
              className="text-left text-lg font-medium hover:text-primary transition-colors"
              onClick={() => handleNavigation("about")}
            >
              Nuestra Historia
            </button>
            <button 
              className="text-left text-lg font-medium hover:text-primary transition-colors"
              onClick={() => handleNavigation("contact")}
            >
              Contacto
            </button>
            <div className="flex flex-col gap-4 mt-8">
              <Button 
                variant="hero" 
                size="lg" 
                className="justify-center"
                onClick={() => handleNavigation("register")}
              >
                Registrarse
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="justify-center"
                onClick={() => handleNavigation("login")}
              >
                Iniciar sesión
              </Button>
            </div>
          </nav>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 ${headerClass} backdrop-blur-sm border-b border-border`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Back Button */}
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleNavigation(backTarget)}
                className="md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            {/* Logo */}
            <div className="flex items-center gap-6">
              <button 
                className="flex items-center gap-3 text-xl md:text-2xl font-bold hover:opacity-80 transition-opacity"
                onClick={() => handleNavigation("landing")}
              >
                <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  SM
                </div>
                <h1 className="tracking-tight">SportMaps</h1>
              </button>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  className="font-medium hover:text-primary transition-colors"
                  onClick={() => handleNavigation("landing")}
                >
                  Inicio
                </button>
                <button 
                  className="font-medium hover:text-primary transition-colors"
                  onClick={() => handleNavigation("ecosystem")}
                >
                  Ecosistema
                </button>
                <button 
                  className="font-medium hover:text-primary transition-colors"
                  onClick={() => handleNavigation("explore")}
                >
                  Explorar
                </button>
                <button 
                  className="font-medium hover:text-primary transition-colors"
                  onClick={() => handleNavigation("about")}
                >
                  Nuestra Historia
                </button>
                <button 
                  className="font-medium hover:text-primary transition-colors"
                  onClick={() => handleNavigation("contact")}
                >
                  Contacto
                </button>
              </nav>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-2">
              {currentPage !== "register" && currentPage !== "login" && (
                <>
                  <Button 
                    variant="hero" 
                    size="sm" 
                    className="hidden md:flex"
                    onClick={() => handleNavigation("register")}
                  >
                    Registrarse
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="hidden md:flex"
                    onClick={() => handleNavigation("login")}
                  >
                    Iniciar sesión
                  </Button>
                </>
              )}
              
              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleMobileMenu}
                className="md:hidden"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default Layout;