import React, { useState } from 'react';
import { EventWizardState, WizardAction } from './WizardTypes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { MapPin } from 'lucide-react';
import { LocationPicker } from '@/components/events/LocationPicker';
import { sanitizeText, sanitizeSlug, sanitizeCity, sanitizeAddress, sanitizePositiveInt } from '@/lib/inputSanitizers';

const SPORTS = ['Porrismo', 'Fútbol', 'Voleibol', 'General'];

interface Props {
  state: EventWizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function Step1EventInfo({ state, dispatch }: Props) {
  const { eventInfo } = state;
  const { toast } = useToast();
  const [showLocation, setShowLocation] = useState(false);

  const update = (field: string, value: string | number) => {
    dispatch({ type: 'UPDATE_EVENT_INFO', payload: { [field]: value } });
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = sanitizeText(e.target.value);
    dispatch({
      type: 'UPDATE_EVENT_INFO',
      payload: { title, slug: generateSlug(title) }
    });
  };

  const handleNext = () => {
    if (!eventInfo.title || !eventInfo.slug || !eventInfo.event_date || !eventInfo.city) {
      toast({ title: 'Error', description: 'Por favor, llena los campos obligatorios: Título, Slug, Fecha y Ciudad.', variant: 'destructive' });
      return;
    }
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre del Evento *</Label>
          <Input value={eventInfo.title} onChange={handleTitleChange} placeholder="Ej. Abierto Mágico 2026" maxLength={150} />
        </div>
        <div className="space-y-2">
          <Label>Deporte *</Label>
          <Select 
            value={eventInfo.sport} 
            onValueChange={(v) => dispatch({ type: 'UPDATE_EVENT_INFO', payload: { sport: v } })}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Slug / URL (único) *</Label>
          <Input value={eventInfo.slug} onChange={e => update('slug', sanitizeSlug(e.target.value))} placeholder="abierto-magico-2026" maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Inscripción</Label>
          <Select 
            value={eventInfo.registration_type} 
            onValueChange={(v) => dispatch({ type: 'UPDATE_EVENT_INFO', payload: { registration_type: v } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="delegation">Por Delegación (Equipos)</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descripción Pública</Label>
        <Textarea value={eventInfo.description} onChange={e => update('description', sanitizeText(e.target.value))} rows={3} placeholder="Detalles del evento..." maxLength={2000} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Fecha del Evento *</Label>
          <Input type="date" value={eventInfo.event_date} onChange={e => update('event_date', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Hora Inicio</Label>
          <Input type="time" value={eventInfo.start_time} onChange={e => update('start_time', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Hora Fin</Label>
          <Input type="time" value={eventInfo.end_time} onChange={e => update('end_time', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ciudad *</Label>
          <Input value={eventInfo.city} onChange={e => update('city', sanitizeCity(e.target.value))} placeholder="Ej. Bogotá" maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label>Dirección</Label>
          <div className="flex gap-2">
            <Input value={eventInfo.address} onChange={e => update('address', sanitizeAddress(e.target.value))} placeholder="Ej. Coliseo Salitre" className="flex-1" maxLength={200} />
            <Button type="button" variant="outline" onClick={() => setShowLocation(true)}>
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Capacidad Estimada (Atletas)</Label>
          <Input value={eventInfo.capacity} onChange={e => update('capacity', Number(sanitizePositiveInt(e.target.value)) || 0)} inputMode="numeric" maxLength={6} />
        </div>
        <div className="space-y-2">
          <Label>Visibilidad</Label>
          <Select 
            value={eventInfo.visibility} 
            onValueChange={(v) => dispatch({ type: 'UPDATE_EVENT_INFO', payload: { visibility: v } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Público (Listado en web)</SelectItem>
              <SelectItem value="private">Privado (Solo con enlace)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showLocation && (
        <LocationPicker
          onSelect={(lat, lng, address) => {
            dispatch({ type: 'UPDATE_EVENT_INFO', payload: { lat, lng, address } });
            setShowLocation(false);
          }}
          onClose={() => setShowLocation(false)}
          initialLat={eventInfo.lat}
          initialLng={eventInfo.lng}
        />
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleNext}>Continuar: Categorías</Button>
      </div>
    </div>
  );
}
