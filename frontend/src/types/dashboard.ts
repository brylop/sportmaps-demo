// Dashboard Types - Centralized type definitions
export type UserRole = 'athlete' | 'parent' | 'coach' | 'school' | 'wellness_professional' | 'store_owner' | 'admin' | 'organizer';

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  location?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'accent';
}

export interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  variant?: 'default' | 'outline' | 'hero' | 'orange';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success';
  read?: boolean;
}

export interface DashboardConfig {
  role: UserRole;
  title: string;
  description: string;
  stats: StatCardProps[];
  activities?: ActivityItem[];
  quickActions?: QuickAction[];
  notifications?: NotificationItem[];
}
