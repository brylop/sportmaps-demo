import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Outlet } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AuthLayout() {
  const { user, profile } = useAuth();
  const { schoolId, schoolName, currentUserRole } = useSchoolContext();
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchoolLogo = async () => {
      if (schoolId) {
        const { data } = await supabase
          .from('schools')
          .select('logo_url')
          .eq('id', schoolId)
          .maybeSingle();
        if (data?.logo_url) setSchoolLogo(data.logo_url);
      }
    };
    fetchSchoolLogo();
  }, [schoolId]);

  const showSchoolBranding = ['owner', 'admin', 'school_admin', 'school', 'coach'].includes(currentUserRole || '');
  const isCoach = currentUserRole === 'coach';
  const hasSchool = !!schoolId;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />

        <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
          {/* Custom Premium Header */}
          <header className="h-16 flex items-center border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 justify-between sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="flex-shrink-0 hover:bg-accent transition-colors" />

              <div className="h-8 w-[1px] bg-border hidden md:block" />

              {/* School Branding Section */}
              {showSchoolBranding && (hasSchool || !isCoach) && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500">
                  {schoolLogo ? (
                    <img
                      src={schoolLogo}
                      alt={schoolName}
                      className="h-9 w-9 rounded-lg object-contain bg-white p-1 border shadow-sm"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold text-xs">
                      {schoolName?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground leading-none">
                      {schoolName || 'Mi Academia'}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">
                      {currentUserRole?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Theme and User Section */}
              <div className="flex items-center gap-2 pr-2 border-r">
                <ThemeToggle />
              </div>

              <div className="flex items-center gap-3 pl-1">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-semibold text-foreground leading-none">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {profile?.role || 'Usuario'}
                  </span>
                </div>
                <Avatar className="h-9 w-9 border-2 border-primary/20 hover:border-primary/50 transition-all cursor-pointer">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {(profile?.full_name || 'U').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          {/* Main content - with padding for mobile bottom nav */}
          <main className="flex-1 p-3 md:p-4 lg:p-6 overflow-auto pb-24 md:pb-6 w-full max-w-full">
            <div className="w-full max-w-full overflow-x-hidden">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}