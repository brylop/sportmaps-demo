import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { SchoolSwitcher } from '@/components/common/SchoolSwitcher';
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
  const { currentUserRole } = useSchoolContext(); // Get the role relative to current school
  const { state } = useSidebar();

  if (!profile) return null;

  const isCollapsed = state === 'collapsed';

  // Determine which role to use for navigation generation
  // Priority: 1. Context Role (if inside a school) 2. Global Profile Role
  let navigationRole: UserRole = profile.role as UserRole;

  if (currentUserRole) {
    // Map school-specific roles to dashboard generic roles
    switch (currentUserRole) {
      case 'owner':
      case 'admin':
      case 'school_admin':
        navigationRole = 'school';
        break;
      case 'super_admin':
        navigationRole = 'admin';
        break;
      case 'coach':
      case 'staff':
        navigationRole = 'coach';
        break;
      case 'parent':
        navigationRole = 'parent';
        break;
      case 'athlete':
        navigationRole = 'athlete';
        break;
      default:
        // Keep profile role or default to athlete
        break;
    }
  }

  const navigationGroups = getNavigationByRole(navigationRole);

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
    // Show the context role if available, otherwise global
    const roleToShow = currentUserRole || profile.role;

    const roleLabels: Record<string, string> = {
      athlete: 'Deportista',
      parent: 'Padre',
      coach: 'Entrenador',
      school: 'Escuela',
      school_admin: 'Admin Sede',
      owner: 'Dueño',
      admin: 'Admin', // School Admin
      staff: 'Staff',
      wellness_professional: 'Bienestar',
      store_owner: 'Tienda',
      super_admin: 'Super Admin',
      viewer: 'Visitante'
    };
    return roleLabels[roleToShow as string] || roleToShow;
  };

  return (
    <Sidebar collapsible="icon" className={isCollapsed ? 'w-14' : 'w-64 transition-all duration-300'}>
      {/* Header with Logo */}
      <SidebarHeader className="border-b px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-2 mb-3">
          <Logo size="sm" />
          {!isCollapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              SportMaps
            </span>
          )}
        </div>

        {/* School Switcher Context */}
        {!isCollapsed && (
          <div className="w-full">
            <SchoolSwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* User Profile Section */}
        {!isCollapsed && (
          <div className="px-4 py-4 border-b bg-muted/10">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">
                  {profile.full_name || user?.email}
                </p>
                <Badge variant={currentUserRole ? "default" : "secondary"} className="text-[10px] px-2 py-0 h-5 mt-1">
                  {getRoleBadge()}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="py-2">
          {navigationGroups.map((group, groupIndex) => (
            <SidebarGroup key={groupIndex} className="px-2">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                  {group.title}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href} className="mb-1">
                        <SidebarMenuButton asChild tooltip={item.title} className="h-9 hover:bg-muted/50 transition-colors">
                          <NavLink
                            to={item.href}
                            end
                            className={({ isActive }) =>
                              `flex items-center gap-3 w-full h-full px-2 rounded-md ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                              }`
                            }
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 truncate">{item.title}</span>
                                {item.badge && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto">
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
        </div>
      </SidebarContent>

      {/* Footer with Sign Out */}
      <SidebarFooter className="border-t p-2 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className={`w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
