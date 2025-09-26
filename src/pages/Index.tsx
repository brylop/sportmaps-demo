import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Landing from "@/components/pages/Landing";
import Login from "@/components/pages/Login";
import RoleSelection from "@/components/pages/RoleSelection";
import Dashboard from "@/components/pages/Dashboard";
import Explore from "@/components/pages/Explore";
import Ecosystem from "@/components/pages/Ecosystem";

const Index = () => {
  const [currentPage, setCurrentPage] = useState("landing");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
  };

  const handleRoleSelection = (role: string) => {
    setSelectedRole(role);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "landing":
        return <Landing onNavigate={handleNavigation} />;
      
      case "login":
        return <Login onNavigate={handleNavigation} />;
      
      case "register":
        return (
          <RoleSelection 
            onNavigate={handleNavigation} 
            onRoleSelect={handleRoleSelection}
          />
        );
      
      case "dashboard":
        return <Dashboard onNavigate={handleNavigation} />;
      
      case "explore":
        return <Explore onNavigate={handleNavigation} />;
      
      case "ecosystem":
        return <Ecosystem onNavigate={handleNavigation} />;
      
      // Placeholder pages
      case "about":
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Nuestra Historia</h1>
              <p className="text-muted-foreground mb-6">Página en construcción</p>
              <button 
                onClick={() => handleNavigation("landing")}
                className="text-primary hover:underline"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        );
      
      case "contact":
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Contacto</h1>
              <p className="text-muted-foreground mb-6">Página en construcción</p>
              <button 
                onClick={() => handleNavigation("landing")}
                className="text-primary hover:underline"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        );
      
      default:
        return <Landing onNavigate={handleNavigation} />;
    }
  };

  // Pages that don't need the layout wrapper
  const noLayoutPages = ["explore"];
  
  if (noLayoutPages.includes(currentPage)) {
    return (
      <>
        {renderPage()}
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Layout
        currentPage={currentPage}
        onNavigate={handleNavigation}
        showBackButton={currentPage === "login" || currentPage === "register"}
        backTarget="landing"
      >
        {renderPage()}
      </Layout>
      <Toaster />
    </>
  );
};

export default Index;
