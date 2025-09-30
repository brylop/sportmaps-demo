import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Landing from "@/components/pages/Landing";
import Login from "@/components/pages/Login";
import RoleSelection from "@/components/pages/RoleSelection";
import AthleteRegister from "@/components/pages/AthleteRegister";
import CoachRegister from "@/components/pages/CoachRegister";
import SchoolRegister from "@/components/pages/SchoolRegister";
import Dashboard from "@/components/pages/Dashboard";
import Explore from "@/components/pages/Explore";
import Ecosystem from "@/components/pages/Ecosystem";
import Contact from "@/components/pages/Contact";
import SchoolSearch from "@/components/pages/SchoolSearch";
import Shop from "@/components/pages/Shop";
import Wellness from "@/components/pages/Wellness";
import UserProfile from "@/components/pages/UserProfile";

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
      
      case "role-selection":
        return (
          <RoleSelection 
            onNavigate={handleNavigation} 
            onRoleSelect={handleRoleSelection}
          />
        );
      
      case "athlete-register":
        return <AthleteRegister onNavigate={handleNavigation} />;
      
      case "coach-register":
        return <CoachRegister onNavigate={handleNavigation} />;
      
      case "school-register":
        return <SchoolRegister onNavigate={handleNavigation} />;
      
      case "register":
        return (
          <RoleSelection 
            onNavigate={handleNavigation} 
            onRoleSelect={handleRoleSelection}
          />
        );
      
      case "dashboard":
        return <Dashboard onNavigate={handleNavigation} />;
      
      case "profile":
        return <UserProfile onNavigate={handleNavigation} />;
      
      case "explore":
        return <Explore onNavigate={handleNavigation} />;
      
      case "schoolsearch":
        return <SchoolSearch onNavigate={handleNavigation} />;
      
      case "shop":
        return <Shop onNavigate={handleNavigation} />;
      
      case "wellness":
        return <Wellness onNavigate={handleNavigation} />;
      
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
        return <Contact onNavigate={handleNavigation} />;
      
      default:
        return <Landing onNavigate={handleNavigation} />;
    }
  };

  // Pages that don't need the layout wrapper
  const noLayoutPages = [
    "explore", 
    "role-selection", 
    "athlete-register", 
    "coach-register", 
    "school-register",
    "dashboard",
    "profile",
    "schoolsearch",
    "shop",
    "wellness"
  ];
  
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
