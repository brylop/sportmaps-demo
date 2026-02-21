import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Inbox } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
}

export default function MessagesDetailPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch real messages from the conversation
  const { data: messages, isLoading } = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId || !user?.id) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, content, created_at')
        .or(`sender_id.eq.${conversationId},recipient_id.eq.${conversationId}`)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      // Get profile of the other user
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', conversationId)
        .single();

      return data.map(m => ({
        ...m,
        sender_name: m.sender_id === user.id ? 'Tú' : (profile?.full_name || 'Usuario'),
      })) as Message[];
    },
    enabled: !!conversationId && !!user?.id,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/messages')}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a mensajes
      </Button>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback>
                {messages?.[0]?.sender_name?.slice(0, 2)?.toUpperCase() || 'MS'}
              </AvatarFallback>
            </Avatar>
            {messages?.[0]?.sender_name || 'Conversación'}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner text="Cargando mensajes..." />
            </div>
          )}

          {!isLoading && (!messages || messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Sin mensajes</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No hay mensajes en esta conversación aún. Cuando se inicien interacciones, los mensajes se mostrarán aquí.
              </p>
            </div>
          )}

          {messages?.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                    }`}
                >
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-1">
                      {message.sender_name}
                    </p>
                  )}
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>
    </div>
  );
}
