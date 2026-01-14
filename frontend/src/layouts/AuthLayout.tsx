import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
<<<<<<< HEAD
import { ThemeToggle } from "@/components/ThemeToggle";
import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function AuthLayout() {
  const { user, profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-14 flex items-center border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">SportMaps</h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="text-sm text-muted-foreground">
                Bienvenido, {profile?.full_name || user?.email}
=======
import { useCart } from "@/contexts/CartContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearch } from "@/components/global/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Outlet } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

export default function AuthLayout() {
  const { user, profile } = useAuth();
  const { setIsOpen, getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
          {/* Header with sidebar trigger and global search */}
          <header className="h-14 flex items-center border-b px-2 md:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-2 md:gap-4">
            <SidebarTrigger className="flex-shrink-0" />
            
            {/* Global Search - Hidden on mobile, visible on md+ */}
            <div className="hidden md:block flex-1 max-w-md">
              <GlobalSearch placeholder="Buscar escuelas, productos..." />
            </div>
            
            <div className="flex-1 md:hidden overflow-hidden">
              <h1 className="text-base md:text-lg font-semibold truncate">SportMaps</h1>
            </div>
            
            <div className="flex items-center gap-1 md:gap-3">
              {/* Cart Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative h-9 w-9 md:h-10 md:w-10"
                onClick={() => setIsOpen(true)}
              >
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
                {itemCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center p-0 text-[10px] md:text-xs bg-accent text-accent-foreground"
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </Badge>
                )}
              </Button>
              
              <ThemeToggle />
              
              <div className="hidden md:block text-sm text-muted-foreground truncate max-w-[150px]">
                {profile?.full_name || user?.email}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              </div>
            </div>
          </header>

<<<<<<< HEAD
          {/* Main content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
=======
          {/* Main content - with padding for mobile bottom nav */}
          <main className="flex-1 p-3 md:p-4 lg:p-6 overflow-auto pb-24 md:pb-6 w-full max-w-full">
            <div className="w-full max-w-full overflow-x-hidden">
              <Outlet />
            </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}