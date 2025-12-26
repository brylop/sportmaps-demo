import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header with sidebar trigger and global search */}
          <header className="h-14 flex items-center border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-4">
            <SidebarTrigger className="flex-shrink-0" />
            
            {/* Global Search - Hidden on mobile, visible on md+ */}
            <div className="hidden md:block flex-1 max-w-md">
              <GlobalSearch placeholder="Buscar escuelas, productos..." />
            </div>
            
            <div className="flex-1 md:hidden">
              <h1 className="text-lg font-semibold">SportMaps</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Cart Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={() => setIsOpen(true)}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-accent text-accent-foreground"
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </Badge>
                )}
              </Button>
              
              <ThemeToggle />
              
              <div className="hidden sm:block text-sm text-muted-foreground">
                {profile?.full_name || user?.email}
              </div>
            </div>
          </header>

          {/* Main content - with padding for mobile bottom nav */}
          <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}