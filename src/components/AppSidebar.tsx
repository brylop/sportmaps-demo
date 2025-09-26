import { useState } from "react";
import { 
  Home, 
  Users, 
  Calendar, 
  Trophy, 
  BarChart3, 
  Settings, 
  UserPlus,
  Shield,
  Bell,
  LogOut
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Menu items by role
const getMenuItems = (role: string) => {
  const baseItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Calendario", url: "/calendar", icon: Calendar },
    { title: "Estadísticas", url: "/stats", icon: BarChart3 },
  ];

  const roleSpecificItems = {
    player: [
      { title: "Mi Perfil", url: "/profile", icon: Users },
      { title: "Mis Equipos", url: "/my-teams", icon: Trophy },
    ],
    coach: [
      { title: "Mis Equipos", url: "/teams", icon: Users },
      { title: "Jugadores", url: "/players", icon: UserPlus },
      { title: "Partidos", url: "/matches", icon: Trophy },
    ],
    parent: [
      { title: "Mis Hijos", url: "/children", icon: Users },
      { title: "Actividades", url: "/activities", icon: Calendar },
    ],
    admin: [
      { title: "Usuarios", url: "/admin/users", icon: Shield },
      { title: "Clubs", url: "/admin/clubs", icon: Users },
      { title: "Sistema", url: "/admin/system", icon: Settings },
    ],
  };

  return [...baseItems, ...(roleSpecificItems[role as keyof typeof roleSpecificItems] || [])];
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  if (!profile) return null;

  const menuItems = getMenuItems(profile.role);
  const isActive = (path: string) => currentPath === path;
  const isExpanded = menuItems.some((item) => isActive(item.url));

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  const handleSignOut = async () => {
    await signOut();
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      className={isCollapsed ? "w-14" : "w-60"}
      collapsible="icon"
    >
      <SidebarContent>
        {/* User Profile Section */}
        {!isCollapsed && (
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url || ""} />
                <AvatarFallback>
                  {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.full_name || profile.email}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {profile.role}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => getNavClass({ isActive })}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions */}
        <SidebarGroup>
          <SidebarGroupLabel>Acciones</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/notifications" className={({ isActive }) => getNavClass({ isActive })}>
                    <Bell className="h-4 w-4" />
                    {!isCollapsed && <span>Notificaciones</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/settings" className={({ isActive }) => getNavClass({ isActive })}>
                    <Settings className="h-4 w-4" />
                    {!isCollapsed && <span>Configuración</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Sign Out */}
      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}