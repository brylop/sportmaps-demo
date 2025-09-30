import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
  SidebarHeader
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getNavigationByRole } from '@/config/navigation';
import { UserRole } from '@/types/dashboard';
import Logo from './Logo';

export function AppSidebar() {
  const { user, profile, signOut } = useAuth();
  const { state } = useSidebar();
  
  if (!profile) return null;

  const isCollapsed = state === 'collapsed';
  const navigationGroups = getNavigationByRole(profile.role as UserRole);

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  const getRoleBadge = () => {
    const roleLabels: Record<string, string> = {
      athlete: 'Deportista',
      parent: 'Padre',
      coach: 'Entrenador',
      school: 'Escuela',
      wellness_professional: 'Bienestar',
      store_owner: 'Tienda',
      admin: 'Admin'
    };
    return roleLabels[profile.role] || profile.role;
  };

  return (
    <Sidebar collapsible="icon" className={isCollapsed ? 'w-14' : 'w-60'}>
      {/* Header with Logo */}
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          {!isCollapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              SportMaps
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* User Profile Section */}
        {!isCollapsed && (
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.full_name || user?.email}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {getRoleBadge()}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        {navigationGroups.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex}>
            {!isCollapsed && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink
                          to={item.href}
                          end
                          className={({ isActive }) =>
                            `flex items-center gap-3 transition-colors ${
                              isActive
                                ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                            }`
                          }
                        >
                          <Icon className="h-4 w-4" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1">{item.title}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.badge}
                                </Badge>
                              )}
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer with Sign Out */}
      <SidebarFooter className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
