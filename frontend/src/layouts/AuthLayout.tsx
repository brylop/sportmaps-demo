import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RealtimeNotificationsProvider } from "@/components/RealtimeNotificationsProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalNotificationBell } from "@/components/GlobalNotificationBell";
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
      <RealtimeNotificationsProvider />
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />

        <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <header className="h-14 sm:h-16 flex items-center border-b px-3 sm:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 justify-between sticky top-0 z-50">

            {/* Left: hamburger + school branding */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {/* SidebarTrigger abre el drawer en mobile, colapsa en desktop */}
              <SidebarTrigger className="flex-shrink-0 hover:bg-accent transition-colors h-9 w-9" />

              <div className="h-6 w-[1px] bg-border hidden md:block flex-shrink-0" />

              {/* School Branding — truncado en mobile */}
              {showSchoolBranding && (hasSchool || !isCoach) && (
                <div className="flex items-center gap-2 min-w-0 animate-in fade-in slide-in-from-left-2 duration-500">
                  {schoolLogo ? (
                    <img
                      src={schoolLogo}
                      alt={schoolName}
                      className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg object-contain bg-white p-0.5 sm:p-1 border shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold text-[10px] sm:text-xs flex-shrink-0">
                      {schoolName?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-foreground leading-none truncate max-w-[100px] sm:max-w-[160px]">
                      {schoolName || 'Mi Academia'}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5 hidden sm:block">
                      {currentUserRole?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: notifications + theme + avatar */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2 pr-2 border-r">
                <GlobalNotificationBell />
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-2 sm:gap-3 pl-1">
                {/* Nombre — solo visible en md+ */}
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-semibold text-foreground leading-none">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {profile?.role || 'Usuario'}
                  </span>
                </div>
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-primary/20 hover:border-primary/50 transition-all cursor-pointer">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {(profile?.full_name || 'U').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          {/* ── Main content ───────────────────────────────────────────── */}
          {/* pb-24 en mobile para evitar que el contenido quede detrás de la barra inferior del navegador */}
          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto pb-20 sm:pb-6 w-full max-w-full">
            <div className="w-full max-w-full overflow-x-hidden">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}