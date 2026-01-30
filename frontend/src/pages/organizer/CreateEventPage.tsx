import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, MapPin, DollarSign, Users, Loader2 } from 'lucide-react';
import { SPORT_OPTIONS, EVENT_TYPE_OPTIONS, COLOMBIAN_CITIES } from '@/types/events';
import type { EventFormData } from '@/types/events';
import { LocationPicker } from '@/components/events/LocationPicker';

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { createEvent, loading } = useEvents();
  const { toast } = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    sport: '',
    event_type: 'tournament',
    event_date: '',
    start_time: '',
    end_time: '',
    address: '',
    city: '',
    lat: undefined,
    lng: undefined,
    capacity: 50,
    price: 0,
    contact_phone: '',
    contact_email: '',
    notes: ''
  });

  const handleChange = (field: keyof EventFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setFormData(prev => ({ ...prev, lat, lng, address }));
    setShowLocationPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.sport || !formData.event_date || !formData.start_time || !formData.city) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios',
        variant: 'destructive'
      });
      return;
    }

    const event = await createEvent(formData);
    if (event) {
      navigate(`/organizer/event/${event.id}`);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Crear Nuevo Evento</h1>
          <p className="text-muted-foreground">Completa la información de tu evento deportivo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Nombre del evento *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Ej: Torneo Sub-12 Copa Bogotá"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sport">Deporte *</Label>
                <Select value={formData.sport} onValueChange={(v) => handleChange('sport', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un deporte" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORT_OPTIONS.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="event_type">Tipo de evento *</Label>
                <Select value={formData.event_type} onValueChange={(v) => handleChange('event_type', v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe tu evento, reglas, requisitos, etc."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Date & Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fecha y Hora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="event_date">Fecha *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => handleChange('event_date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div>
                <Label htmlFor="start_time">Hora inicio *</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleChange('start_time', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="end_time">Hora fin</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleChange('end_time', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="city">Ciudad *</Label>
              <Select value={formData.city} onValueChange={(v) => handleChange('city', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {COLOMBIAN_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="address">Dirección</Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Dirección del evento"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLocationPicker(true)}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
              {formData.lat && formData.lng && (
                <p className="text-xs text-muted-foreground mt-1">
                  Coordenadas: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
                </p>
              )}
            </div>

            {showLocationPicker && (
              <LocationPicker
                onSelect={handleLocationSelect}
                onClose={() => setShowLocationPicker(false)}
                initialLat={formData.lat}
                initialLng={formData.lng}
              />
            )}
          </CardContent>
        </Card>

        {/* Capacity & Price */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Capacidad y Precio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="capacity">Capacidad máxima</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => handleChange('capacity', parseInt(e.target.value) || 50)}
                />
              </div>

              <div>
                <Label htmlFor="price">Precio (COP)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.price}
                    onChange={(e) => handleChange('price', parseInt(e.target.value) || 0)}
                    className="pl-9"
                    placeholder="0 = Gratis"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información de Contacto</CardTitle>
            <CardDescription>Opcional - para que los participantes puedan contactarte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_phone">Teléfono</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                  placeholder="+57 300 123 4567"
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                  placeholder="contacto@evento.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas adicionales</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Información adicional, requisitos especiales, etc."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/organizer/home')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="min-w-32">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creando...
              </>
            ) : (
              'Crear Evento'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
