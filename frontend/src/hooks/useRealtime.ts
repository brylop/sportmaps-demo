import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeNotifications(onNewNotification?: () => void) {
  const { user } = useAuth();
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-changes-${user.id}`)
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
          callbackRef.current?.();
        }
      )
      .subscribe();

    return () => {
      const cleanup = async () => {
        await supabase.removeChannel(channel);
      };
      cleanup();
    };
  }, [user]);
}

export function useRealtimeMessages(onNewMessage?: () => void) {
  const { user } = useAuth();
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-changes-${user.id}`)
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
          callbackRef.current?.();
        }
      )
      .subscribe();

    return () => {
      const cleanup = async () => {
        await supabase.removeChannel(channel);
      };
      cleanup();
    };
  }, [user]);
}

export function useRealtimeCalendar(onCalendarUpdate?: () => void) {
  const { user } = useAuth();
  const callbackRef = useRef(onCalendarUpdate);
  callbackRef.current = onCalendarUpdate;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`calendar-changes-${user.id}`)
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
          callbackRef.current?.();
        }
      )
      .subscribe();

    return () => {
      const cleanup = async () => {
        await supabase.removeChannel(channel);
      };
      cleanup();
    };
  }, [user]);
}
