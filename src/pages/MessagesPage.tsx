import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  online: boolean;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  sent: boolean;
}

const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Carlos Rodríguez (Entrenador)',
    lastMessage: 'El entrenamiento de mañana será a las 4 PM',
    timestamp: '10:30',
    unread: 2,
    online: true
  },
  {
    id: '2',
    name: 'Ana Martínez (Coordinadora)',
    lastMessage: 'Necesito que confirmes tu asistencia',
    timestamp: '09:15',
    unread: 1,
    online: true
  },
  {
    id: '3',
    name: 'Equipo Sub-17',
    lastMessage: 'Juan: ¿Alguien tiene balones extra?',
    timestamp: 'Ayer',
    unread: 0,
    online: false
  },
  {
    id: '4',
    name: 'Laura Sánchez',
    lastMessage: 'Gracias por la info!',
    timestamp: 'Ayer',
    unread: 0,
    online: false
  }
];

const mockMessages: Message[] = [
  {
    id: '1',
    senderId: '1',
    content: 'Hola! ¿Cómo estás?',
    timestamp: '10:25',
    sent: false
  },
  {
    id: '2',
    senderId: 'me',
    content: 'Muy bien, gracias. ¿Y tú?',
    timestamp: '10:26',
    sent: true
  },
  {
    id: '3',
    senderId: '1',
    content: 'El entrenamiento de mañana será a las 4 PM',
    timestamp: '10:30',
    sent: false
  },
  {
    id: '4',
    senderId: '1',
    content: 'Por favor confirma tu asistencia',
    timestamp: '10:30',
    sent: false
  }
];

export default function MessagesPage() {
  const [selectedContact, setSelectedContact] = useState<Contact>(mockContacts[0]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = mockContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (messageText.trim()) {
      // Aquí iría la lógica para enviar el mensaje
      console.log('Sending message:', messageText);
      setMessageText('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          Mensajes
        </h1>
        <p className="text-muted-foreground mt-1">
          Comunícate con tu equipo y entrenadores
        </p>
      </div>

      {/* Messages Layout */}
      <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-240px)]">
        {/* Contacts List */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="space-y-1 p-2">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full p-3 rounded-lg text-left transition-colors hover:bg-accent ${
                      selectedContact.id === contact.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback>
                            {contact.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {contact.online && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm truncate">
                            {contact.name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {contact.timestamp}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.lastMessage}
                          </p>
                          {contact.unread > 0 && (
                            <Badge variant="default" className="ml-2 h-5 min-w-5 flex items-center justify-center rounded-full p-1 text-xs">
                              {contact.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-2 flex flex-col">
          {/* Chat Header */}
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedContact.avatar} />
                  <AvatarFallback>
                    {selectedContact.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedContact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedContact.online ? 'En línea' : 'Desconectado'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {mockMessages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.sent ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.sent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.sent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <CardContent className="border-t p-4">
            <div className="flex items-end gap-2">
              <Button variant="ghost" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[60px] max-h-[120px] resize-none pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 bottom-2"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
