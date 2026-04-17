import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainerContext } from '@/hooks/useTrainerContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Search, Mail, Phone, Calendar, UserPlus } from 'lucide-react';

import { StudentTypeSelector } from '@/components/students/StudentTypeSelector';
import { CreateChildModal } from '@/components/students/CreateChildModal';
import { CreateAdultAthleteModal } from '@/components/students/CreateAdultAthleteModal';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

interface Client {
  enrollment_id: string;
  athleteId: string;
  clientType: 'adult' | 'child' | 'unregistered';
  status: string;
  created_at: string;
  plan_id: string | null;
  profile: any;
  child: any;
}

export default function TrainerClients() {
  const { session } = useAuth();
  const { trainerSchoolId } = useTrainerContext();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showCreateChildModal, setShowCreateChildModal] = useState(false);
  const [showCreateAdultModal, setShowCreateAdultModal] = useState(false);

  const fetchClients = useCallback(async () => {
    if (!trainerSchoolId || !session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/clients`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error();
      setClients(await res.json());
    } catch (err) {
      console.error('[TrainerClients] Error fetching clients');
    } finally {
      setLoading(false);
    }
  }, [session, trainerSchoolId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filtered = clients.filter(c => {
    const p = c.clientType === 'adult' ? c.profile : c.child;
    const name = p?.full_name || '';
    const email = c.clientType === 'adult' ? (c.profile?.email || '') : '';
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Clientes</h1>
          <p className="text-muted-foreground text-sm">Clientes activos en tu workspace</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="secondary" className="gap-1.5 h-9">
            <Users className="h-3 w-3" />
            {clients.length} activos
          </Badge>
          <Button size="sm" onClick={() => setShowTypeSelector(true)} className="h-9">
            <UserPlus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Agregar Cliente</span>
            <span className="sm:hidden">Agregar</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No hay clientes aún</p>
            <p className="text-sm text-muted-foreground mt-1">Cuando alguien se inscriba a uno de tus planes, aparecerá aquí.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(client => {
            const p = (client.clientType === 'adult' || client.clientType === 'unregistered') ? client.profile : client.child;
            const name = p?.full_name || 'Desconocido';
            const email = (client.clientType === 'adult' || client.clientType === 'unregistered') ? p?.email : null;
            const phone = (client.clientType === 'adult' || client.clientType === 'unregistered') ? p?.phone : null;
            return (
              <Card 
                key={client.enrollment_id} 
                className="border-border/50 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer"
                onClick={() => {
                  if (!client.athleteId) {
                    console.error('athleteId is null for enrollment:', client.enrollment_id);
                    return;
                  }
                  navigate(`/trainer/clients/${client.athleteId}?type=${client.clientType}`);
                }}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                    {p && p.avatar_url ? (
                       <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" />
                    ) : ( 
                       name.substring(0, 2).toUpperCase() 
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {email}
                        </span>
                      )}
                      {phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {phone}
                        </span>
                      )}
                      {client.clientType === 'child' && (
                        <Badge variant="secondary" className="text-[10px]">Niño/a</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10">
                      Activo
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(client.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <StudentTypeSelector
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelectAdult={() => {
          setShowTypeSelector(false);
          setShowCreateAdultModal(true);
        }}
        onSelectChild={() => {
          setShowTypeSelector(false);
          setShowCreateChildModal(true);
        }}
      />
      
      {trainerSchoolId && (
        <CreateChildModal
          open={showCreateChildModal}
          onClose={() => setShowCreateChildModal(false)}
          onSuccess={() => {
            setShowCreateChildModal(false);
            fetchClients();
          }}
          schoolId={trainerSchoolId}
        />
      )}

      {trainerSchoolId && (
        <CreateAdultAthleteModal
          open={showCreateAdultModal}
          onClose={() => setShowCreateAdultModal(false)}
          onSuccess={() => {
            setShowCreateAdultModal(false);
            fetchClients();
          }}
          schoolId={trainerSchoolId}
        />
      )}

    </div>
  );
}
