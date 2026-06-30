// frontend/src/components/explore/ExploreMapInteractive.tsx
//
// Mapa interactivo del explorar — Leaflet + react-leaflet + Supabase directo.
// v2 (junio 2026): filtros por tipo (escuela/club/instituto/federacion/asociacion),
// colores distintos por tipo, leyenda con counts, stats por categoría.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ExploreCategory } from '@/hooks/useExplorarGlobal';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Tipos visibles en el mapa ────────────────────────────────────────────────
type EntityType = 'academy' | 'club' | 'institute' | 'federation' | 'association' | 'facility';

// Pin colors + emoji por tipo
const TYPE_META: Record<EntityType, { color: string; emoji: string; label: string; group: 'schools' | 'gov' | 'facility' }> = {
  academy:     { color: '#248223', emoji: '🎓', label: 'Escuelas',      group: 'schools' },
  club:        { color: '#0ea5e9', emoji: '⚽', label: 'Clubes',        group: 'schools' },
  institute:   { color: '#8b5cf6', emoji: '🏛️', label: 'Institutos',    group: 'gov' },
  federation:  { color: '#f59e0b', emoji: '🏅', label: 'Federaciones',  group: 'gov' },
  association: { color: '#ef4444', emoji: '🤝', label: 'Asociaciones',  group: 'gov' },
  facility:    { color: '#64748b', emoji: '🏟️', label: 'Instalaciones', group: 'facility' },
};

function makeIcon(type: EntityType) {
  const meta = TYPE_META[type];
  return L.divIcon({
    html: `<div style="background:${meta.color};width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:2px solid white;">
      <div style="transform:rotate(45deg);font-size:14px;line-height:1;">${meta.emoji}</div>
    </div>`,
    className: 'sm-explore-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

const USER_ICON = L.divIcon({
  html: `<div style="background:#3b82f6;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div>`,
  className: 'sm-user-loc',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ── Marker shape ─────────────────────────────────────────────────────────────
interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  address: string | null;
  sports: string[];
  logo_url: string | null;
  cover_image_url: string | null;
  verified: boolean;
  description: string | null;
  schoolType: EntityType;
  phone: string | null;
  email: string | null;
}

interface ExploreMapInteractiveProps {
  category: ExploreCategory;
  query?: string;
  city?: string;
  sport?: string;
}

// ── Hook: trae TODAS las entidades (escuelas + clubes + gobierno) ────────────
function useExploreSchools(filters: { query?: string; city?: string; sport?: string }) {
  return useQuery({
    queryKey: ['explore-map-all-entities', filters],
    queryFn: async (): Promise<MapMarker[]> => {
      const { data: schoolsData, error } = await supabase
        .from('schools')
        .select('id, name, description, sports, logo_url, cover_image_url, verified, city, school_type, phone, email, is_demo, onboarding_status')
        .eq('is_demo', false)
        .neq('onboarding_status', 'pending');

      if (error) {
        console.error('[ExploreMap] schools error:', error);
        return [];
      }

      const ids = (schoolsData || []).map((s: any) => s.id);
      if (!ids.length) return [];

      const [branchesRes, settingsRes] = await Promise.all([
        supabase
          .from('school_branches')
          .select('school_id, lat, lng, address, is_main, status')
          .in('school_id', ids)
          .eq('is_main', true)
          .eq('status', 'active')
          .not('lat', 'is', null)
          .not('lng', 'is', null),
        supabase
          .from('school_settings')
          .select('school_id, public_profile_enabled')
          .in('school_id', ids)
          .eq('public_profile_enabled', true),
      ]);

      const branchBy = new Map<string, any>();
      (branchesRes.data || []).forEach((b: any) => {
        if (!branchBy.has(b.school_id)) branchBy.set(b.school_id, b);
      });
      const publicIds = new Set<string>((settingsRes.data || []).map((s: any) => s.school_id));

      const out: MapMarker[] = [];
      for (const s of schoolsData as any[]) {
        if (!publicIds.has(s.id)) continue;
        const b = branchBy.get(s.id);
        if (!b) continue;

        const q = (filters.query || '').toLowerCase();
        if (q && !String(s.name || '').toLowerCase().includes(q)) continue;
        const c = (filters.city || '').toLowerCase();
        if (c && !String(s.city || '').toLowerCase().includes(c)) continue;
        const sp = (filters.sport || '').toLowerCase();
        if (sp && !(s.sports || []).some((x: string) => String(x).toLowerCase().includes(sp))) continue;

        const rawType = String(s.school_type || 'academy').toLowerCase();
        const schoolType: EntityType = (['academy','club','institute','federation','association'] as const)
          .includes(rawType as any) ? (rawType as EntityType) : 'academy';

        out.push({
          id: s.id,
          name: s.name,
          lat: Number(b.lat),
          lng: Number(b.lng),
          city: s.city,
          address: b.address,
          sports: Array.isArray(s.sports) ? s.sports : [],
          logo_url: s.logo_url,
          cover_image_url: s.cover_image_url,
          verified: !!s.verified,
          description: s.description,
          schoolType,
          phone: s.phone,
          email: s.email,
        });
      }
      console.log(`[ExploreMap] ${out.length} markers de ${schoolsData?.length || 0} schools (todos los tipos)`);
      return out;
    },
    staleTime: 3 * 60 * 1000,
  });
}

function MapAutoCenter({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [markers, map]);
  return null;
}

function MapCenterOnUser({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!userLocation) return;
    map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1.2 });
  }, [userLocation, map]);
  return null;
}

export function ExploreMapInteractive({ category, query, city, sport }: ExploreMapInteractiveProps) {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [centerOnUser, setCenterOnUser] = useState(false);

  // Filtro de tipos visibles — todos activos por default
  const [enabledTypes, setEnabledTypes] = useState<Record<EntityType, boolean>>({
    academy: true,
    club: true,
    institute: true,
    federation: true,
    association: true,
    facility: true,
  });

  const { data: all = [], isLoading } = useExploreSchools({ query, city, sport });

  // Marker count por tipo (para mostrar en leyenda incluso si está apagado)
  const countsByType = useMemo(() => {
    const c: Record<EntityType, number> = { academy: 0, club: 0, institute: 0, federation: 0, association: 0, facility: 0 };
    all.forEach((m) => { c[m.schoolType] = (c[m.schoolType] || 0) + 1; });
    return c;
  }, [all]);

  const markers = useMemo(
    () => all.filter((m) => enabledTypes[m.schoolType]),
    [all, enabledTypes],
  );

  // Iconos memo por tipo
  const icons = useMemo(() => ({
    academy: makeIcon('academy'),
    club: makeIcon('club'),
    institute: makeIcon('institute'),
    federation: makeIcon('federation'),
    association: makeIcon('association'),
    facility: makeIcon('facility'),
  }), []);

  const askLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCenterOnUser(true);
      },
      () => {},
      { timeout: 5000 },
    );
  };

  const toggleType = (t: EntityType) => setEnabledTypes((p) => ({ ...p, [t]: !p[t] }));

  return (
    <div className="space-y-3">
      {/* Filtros por tipo (chips) */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_META) as EntityType[]).map((t) => {
          const meta = TYPE_META[t];
          const active = enabledTypes[t];
          const count = countsByType[t] || 0;
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              disabled={count === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active && count > 0
                  ? 'border-transparent shadow-sm text-white'
                  : 'bg-white text-muted-foreground border-border hover:border-foreground/30'
              } ${count === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              style={active && count > 0 ? { background: meta.color } : undefined}
              title={`${meta.label}: ${count}`}
            >
              <span aria-hidden>{meta.emoji}</span>
              <span>{meta.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                active && count > 0 ? 'bg-white/25' : 'bg-muted'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-border shadow-lg">
        <div className="h-[600px] w-full">
          <MapContainer center={[4.6097, -74.0817]} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON}>
                <Popup>Tu ubicación</Popup>
              </Marker>
            )}

            {markers.map((m) => {
              const meta = TYPE_META[m.schoolType];
              const isGov = meta.group === 'gov';
              const isFacility = meta.group === 'facility';
              const isInfoOnly = isGov || isFacility;
              return (
                <Marker key={m.id} position={[m.lat, m.lng]} icon={icons[m.schoolType]}>
                  <Popup minWidth={240}>
                    <div className="space-y-2 max-w-[260px]">
                      {m.cover_image_url && !isInfoOnly && (
                        <img
                          src={m.cover_image_url}
                          alt={m.name}
                          className="w-full h-28 object-cover rounded-md"
                          onError={(e) => ((e.currentTarget.style.display = 'none'))}
                        />
                      )}
                      <div className="flex items-start gap-2">
                        {m.logo_url && (
                          <img
                            src={m.logo_url}
                            alt=""
                            className="w-9 h-9 rounded-md object-cover border bg-white"
                            onError={(e) => ((e.currentTarget.style.display = 'none'))}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase text-white"
                              style={{ background: meta.color }}
                            >
                              {meta.emoji} {meta.label.slice(0, -1)}
                            </span>
                            {m.verified && (
                              <span className="text-[10px] text-blue-600 font-medium">✓ Verif.</span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold leading-tight">{m.name}</h4>
                        </div>
                      </div>

                      {m.sports.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.sports.slice(0, 4).map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      )}

                      {(m.address || m.city) && (
                        <p className="text-[11px] text-muted-foreground">
                          📍 {[m.address, m.city].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {isGov && m.phone && (
                        <p className="text-[11px] text-muted-foreground">📞 {m.phone}</p>
                      )}
                      {isGov && m.email && (
                        <p className="text-[11px] text-muted-foreground truncate">✉️ {m.email}</p>
                      )}

                      {isFacility ? (
                        <p className="text-[10px] text-muted-foreground italic border-t pt-1.5">
                          Instalación deportiva — información pública (sin programas asociados).
                        </p>
                      ) : isGov ? (
                        <p className="text-[10px] text-muted-foreground italic border-t pt-1.5">
                          Entidad gubernamental — solo información pública.
                        </p>
                      ) : (
                        <Button size="sm" className="w-full" onClick={() => navigate(`/schools/${m.id}`)}>
                          Ver programas
                        </Button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            <MapAutoCenter markers={markers} />
            <MapCenterOnUser userLocation={centerOnUser ? userLocation : null} />
          </MapContainer>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-[500] pointer-events-none">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Cargando entidades deportivas…</p>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 z-[1000]">
          <div className="px-3 py-1.5 rounded-lg shadow-md bg-white/95 text-xs font-medium border">
            📍 {markers.length} / {all.length} visibles
          </div>
        </div>

        {!userLocation && (
          <div className="absolute bottom-3 left-3 z-[1000]">
            <Button size="sm" variant="secondary" className="shadow-lg gap-1.5" onClick={askLocation}>
              <Navigation className="h-3.5 w-3.5" />
              Mi ubicación
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExploreMapInteractive;
