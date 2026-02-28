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
  const { currentUserRole, isGlobalAdmin, totalBranches, activeBranchId } = useSchoolContext();
  const sidebar = useSidebar();
  const { state } = sidebar;

  if (!profile || !user) return null;

  const isCollapsed = state === 'collapsed';

  // Determine which role to use for navigation generation
  // Priority: 1. Context Role (if inside a school) 2. Global Profile Role
  let navigationRole: UserRole = (profile.role as UserRole) || 'athlete';

  if (currentUserRole) {
    // Map school-specific roles to dashboard generic roles
    switch (currentUserRole) {
      case 'owner':
      case 'super_admin':
        // Owners/Super Admins siempre operan como 'school' en una sede specific.
        // Pueden alternar entre sedes con el SchoolSwitcher.
        navigationRole = 'school';
        break;
      case 'admin':
        navigationRole = 'admin';
        break;
      case 'school_admin':
        navigationRole = 'school_admin';
        break;
      case 'reporter':
        navigationRole = 'reporter';
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

    if (roleToShow === 'owner') return 'Propietario';
    if (roleToShow === 'reporter') return 'Auditoría';

    if (roleToShow === 'school_admin' || roleToShow === 'admin') {
      return isGlobalAdmin ? 'Admin General' : 'Admin Sede';
    }

    const roleLabels: Record<string, string> = {
      athlete: 'Deportista',
      parent: 'Padre',
      coach: 'Entrenador',
      school: 'Escuela',
      staff: 'Staff',
      wellness_professional: 'Bienestar',
      store_owner: 'Tienda',
      super_admin: 'Super Admin',
      viewer: 'Visitante'
    };
    return roleLabels[roleToShow as string] || roleToShow;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-card/50 backdrop-blur-sm">
      <SidebarHeader className="h-16 flex items-center px-4 overflow-hidden">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <Logo size="sm" />
            <span className="font-bold text-lg tracking-tight truncate">SportMaps</span>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <Logo size="sm" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <div className="mb-4">
          {!isCollapsed && (
            <div className="flex flex-col items-center px-2 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <Avatar className="h-16 w-16 mb-2 border-2 border-primary/20 shadow-lg shadow-primary/5">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/30 text-primary font-bold text-xl">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center w-full overflow-hidden">
                <p className="font-bold text-sm truncate px-1">{profile.full_name || user?.email}</p>
                <div className="flex justify-center mt-1">
                  <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/30 text-primary bg-primary/5 bg-opacity-10 backdrop-blur-md">
                    {getRoleBadge()}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* School Switcher Context - Always show for owners/admins or multibranch */}
        {!isCollapsed && (currentUserRole === 'owner' || currentUserRole === 'super_admin' || currentUserRole === 'admin' || currentUserRole === 'school_admin' || totalBranches > 1 || isGlobalAdmin) && (
          <div className="w-full mb-4">
            <SchoolSwitcher />
          </div>
        )}

        {navigationGroups.map((group, groupIdx) => (
          <SidebarGroup key={groupIdx}>
            <SidebarGroupLabel className="text-muted-foreground/50 text-[10px] uppercase tracking-widest font-bold px-4 mb-2">
              {!isCollapsed ? group.title : ''}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item, itemIdx) => (
                  <SidebarMenuItem key={itemIdx}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className="group/menu-button transition-all duration-300 hover:bg-primary/5 active:scale-95"
                    >
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          `flex items-center gap-3 w-full transition-all duration-300 ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon className={`h-4 w-4 transition-transform duration-300 group-hover/menu-button:scale-110 ${isActive ? 'text-primary' : ''}`} />
                            <span className="truncate">{item.title}</span>
                            {item.badge && !isCollapsed && (
                              <Badge className="ml-auto h-4 px-1 min-w-[1.2rem] flex items-center justify-center text-[10px] bg-accent/80 hover:bg-accent">
                                {item.badge}
                              </Badge>
                            )}
                            {isActive && !isCollapsed && (
                              <div className="absolute right-0 w-1 h-5 bg-primary rounded-l-full animate-in fade-in zoom-in duration-300" />
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-3 group-hover:rotate-12 transition-transform" />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
