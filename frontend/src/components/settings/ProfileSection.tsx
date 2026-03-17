import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Check, ChevronsUpDown, Loader2, Save, User as UserIcon, X } from 'lucide-react';
import { useStorage } from '@/hooks/useStorage';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import sportsData from '@/lib/constants/deportes_globales_categorias.json';

const sportsList = sportsData.deportes.map(s => s.nombre).sort();

interface ProfileSectionProps {
  data: any;
  saving: boolean;
  onSave: (updates: { 
    full_name: string; 
    phone: string; 
    bio: string; 
    date_of_birth?: string | null; 
    sports_interests?: string[] | null;
  }) => Promise<void>;
}

export function ProfileSection({ data, saving, onSave }: ProfileSectionProps) {
  const { profile } = useAuth();
  const { uploadFile, uploading } = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSports, setOpenSports] = useState(false);
  const [formData, setFormData] = useState({
    full_name: data?.profile?.full_name || '',
    phone: data?.profile?.phone || '',
    bio: data?.profile?.bio || '',
    date_of_birth: data?.profile?.date_of_birth || '' as string | null,
    sports_interests: data?.profile?.sports_interests || [] as string[] | null,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    try {
      const publicUrl = await uploadFile(file, 'avatars', profile.id);
      if (publicUrl) {
         await onSave({ ...formData, avatar_url: publicUrl } as any);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            Información Personal
          </CardTitle>
          <CardDescription>
            Actualiza tu información pública y cómo te ven otros usuarios en SportMaps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-muted/50">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-primary/10 transition-transform group-hover:scale-105">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="text-2xl bg-primary/5 text-primary">
                  {formData.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="h-6 w-6" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="font-medium text-lg">{formData.full_name || 'Tu Nombre'}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <p className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full inline-block mt-1 font-medium capitalize">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre Completo</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Ej. Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono de Contacto</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+57 300 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Fecha de Nacimiento</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sports_interests">Intereses Deportivos (Máximo 5)</Label>
              <div className="flex flex-wrap gap-2 mb-2 p-2 min-h-[42px] border rounded-md bg-muted/5">
                {formData.sports_interests && formData.sports_interests.length > 0 ? (
                  formData.sports_interests.map((sport) => (
                    <Badge key={sport} variant="secondary" className="gap-1 px-2 py-1">
                      {sport}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            sports_interests: prev.sports_interests?.filter(s => s !== sport) || []
                          }));
                        }}
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground px-1 py-1">No has seleccionado deportes aún</span>
                )}
              </div>
              
              <Popover open={openSports} onOpenChange={setOpenSports}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSports}
                    className="w-full justify-between"
                    disabled={formData.sports_interests && formData.sports_interests.length >= 5}
                  >
                    {formData.sports_interests && formData.sports_interests.length >= 5 
                      ? "Límite alcanzado (5 deportes)" 
                      : "Añadir deporte..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar deporte..." />
                    <CommandList>
                      <CommandEmpty>No se encontró el deporte.</CommandEmpty>
                      <CommandGroup className="max-h-[200px] overflow-auto">
                        {sportsList.map((sport) => (
                          <CommandItem
                            key={sport}
                            value={sport}
                            onSelect={() => {
                              if (formData.sports_interests && formData.sports_interests.length < 5 && !formData.sports_interests.includes(sport)) {
                                setFormData(prev => ({
                                  ...prev,
                                  sports_interests: [...(prev.sports_interests || []), sport]
                                }));
                              }
                              setOpenSports(false);
                            }}
                            className={cn(
                              "flex items-center justify-between",
                              formData.sports_interests?.includes(sport) && "opacity-50 pointer-events-none"
                            )}
                          >
                            {sport}
                            {formData.sports_interests?.includes(sport) && <Check className="h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-[11px] text-muted-foreground">
                Selecciona hasta 5 deportes que te interesen para personalizar tu experiencia.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Biografía / Descripción</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Cuéntanos un poco sobre ti..."
              className="min-h-[100px] resize-none"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t bg-muted/5 py-4">
          <Button type="submit" disabled={saving || uploading} className="gap-2 shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
