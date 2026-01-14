import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeNotifications(onNewNotification?: () => void) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel: RealtimeChannel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification:', payload);
          if (onNewNotification) {
            onNewNotification();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onNewNotification]);
}

export function useRealtimeMessages(onNewMessage?: () => void) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel: RealtimeChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New message:', payload);
          if (onNewMessage) {
            onNewMessage();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onNewMessage]);
}

export function useRealtimeCalendar(onCalendarUpdate?: () => void) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel: RealtimeChannel = supabase
      .channel('calendar-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Calendar event changed:', payload);
          if (onCalendarUpdate) {
            onCalendarUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onCalendarUpdate]);
}
