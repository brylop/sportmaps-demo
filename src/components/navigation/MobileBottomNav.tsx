import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, MessageSquare, User, Compass } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navigationItems = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/explore', label: 'Explorar', icon: Compass },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/messages', label: 'Mensajes', icon: MessageSquare },
  { href: '/profile', label: 'Perfil', icon: User },
];

export function MobileBottomNav() {
  const { profile } = useAuth();
  const location = useLocation();

  // Solo mostrar para atletas y padres
  if (!profile || !['athlete', 'parent'].includes(profile.role)) {
    return null;
  }

  // No mostrar en páginas de auth o landing
  if (['/', '/login', '/register'].includes(location.pathname)) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'relative p-1.5 rounded-full transition-all duration-200',
                isActive && 'bg-primary/10'
              )}>
                <Icon className={cn(
                  'h-5 w-5 transition-transform',
                  isActive && 'scale-110'
                )} />
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FB9F1E] rounded-full" />
                )}
              </div>
              <span className={cn(
                'text-[10px] font-poppins font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
