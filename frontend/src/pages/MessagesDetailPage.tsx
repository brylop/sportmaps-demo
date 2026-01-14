import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Paperclip, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { FileUpload } from '@/components/common/FileUpload';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useRealtimeMessages } from '@/hooks/useRealtime';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    full_name: string;
  };
}

export default function MessagesDetailPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [showAttachment, setShowAttachment] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Demo data for now
  const demoMessages: Message[] = [
    {
      id: '1',
      sender_id: 'other-user',
      content: 'Hola! ¿Cómo va el entrenamiento?',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      sender: { full_name: 'Carlos Rodríguez' }
    },
    {
      id: '2',
      sender_id: user?.id || '',
      content: 'Muy bien! Los chicos están progresando mucho',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      sender: { full_name: 'Tú' }
    },
    {
      id: '3',
      sender_id: 'other-user',
      content: 'Excelente! ¿Podrías enviarme el reporte de asistencia?',
      created_at: new Date(Date.now() - 900000).toISOString(),
      sender: { full_name: 'Carlos Rodríguez' }
    }
  ];

  const [messages, setMessages] = useState<Message[]>(demoMessages);

  // Real-time updates
  useRealtimeMessages(() => {
    // Refetch messages when new one arrives
    queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // This would send to actual database
      const newMsg: Message = {
        id: Date.now().toString(),
        sender_id: user?.id || '',
        content,
        created_at: new Date().toISOString(),
        sender: { full_name: 'Tú' }
      };
      
      return newMsg;
    },
    onSuccess: (newMsg) => {
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      toast({
        title: '✅ Mensaje enviado',
        description: 'Tu mensaje ha sido enviado',
      });
    }
  });

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
              <AvatarFallback>CR</AvatarFallback>
            </Avatar>
            Carlos Rodríguez
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-1">
                      {message.sender.full_name}
                    </p>
                  )}
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString('es-ES', {
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

        <div className="border-t p-4 space-y-2">
          {showAttachment && (
            <div className="mb-2">
              <FileUpload
                bucket="medical-documents"
                accept="image/*,.pdf,.doc,.docx"
                maxSizeMB={10}
                onUploadComplete={(url) => {
                  toast({
                    title: '✅ Archivo adjunto',
                    description: 'Archivo listo para enviar',
                  });
                  setShowAttachment(false);
                }}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowAttachment(!showAttachment)}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Input
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sendMessageMutation.isPending}
            />
            
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
