// frontend/src/components/explore/ExploreMapInteractive.tsx
//
// Mapa interactivo del explorar — usa Leaflet + react-leaflet (mismo stack que
// la landing) y consulta datos REALES de Supabase (schools + school_branches +
// school_settings) en lugar de la RPC search_explore_map que esta rota en
// staging (asume columnas s.lat/s.active/s.rating que no existen en el schema
// actual de schools).
//
// Funcionalidades:
//   - Markers tipo academy con color verde SportMaps.
//   - Popup con logo, nombre, deportes, verificacion, boton "Ver perfil".
//   - Filtros por categoria + busqueda + sport + city (props).
//   - User location con boton "centrar en mi".
//   - fitBounds automatico cuando hay markers.

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

// Fix Leaflet default icon (sino salen rotos con bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Colores e iconos por tipo ─────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  academy: '#248223',  // SportMaps green
  trainer: '#6366f1',
  event: '#f43f5e',
  service: '#10b981',
};

const ACADEMY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>`;

function makeIcon(color: string, svg: string = ACADEMY_SVG) {
  return L.divIcon({
    html: `<div style="background:${color};width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:2px solid white;">
      <div style="transform:rotate(45deg);width:18px;height:18px;display:flex;align-items:center;justify-content:center;">${svg}</div>
    </div>`,
    className: 'sm-explore-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

const USER_ICON = L.divIcon({
  html: `<div style="position:relative;"><div style="background:#3b82f6;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div></div>`,
  className: 'sm-user-loc',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SchoolMarker {
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
}

interface ExploreMapInteractiveProps {
  category: ExploreCategory;
  query?: string;
  city?: string;
  sport?: string;
}

// ── Hook que trae las escuelas con lat/lng desde Supabase (sin RPC rota) ─────
function useExploreSchools(filters: {
  query?: string;
  city?: string;
  sport?: string;
}) {
  return useQuery({
    queryKey: ['explore-map-schools', filters],
    queryFn: async (): Promise<SchoolMarker[]> => {
      // JOIN schools + school_branches (lat/lng) + school_settings (public_profile_enabled)
      let queryBuilder = supabase
        .from('school_branches')
        .select(`
          lat,
          lng,
          address,
          school:schools!inner (
            id,
            name,
            description,
            sports,
            logo_url,
            cover_image_url,
            verified,
            is_demo,
            onboarding_status,
            city,
            school_settings!inner ( public_profile_enabled )
          )
        `)
        .eq('is_main', true)
        .eq('status', 'active')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      const { data, error } = await queryBuilder;
      if (error) {
        console.error('[ExploreMap] query error:', error);
        return [];
      }

      const rows = (data || []) as any[];
      const markers: SchoolMarker[] = [];

      for (const row of rows) {
        const s = row.school;
        if (!s) continue;
        // Re-aplicar los mismos filtros que la view school_public_profile
        if (s.is_demo) continue;
        if (s.onboarding_status === 'pending') continue;
        const ss = Array.isArray(s.school_settings) ? s.school_settings[0] : s.school_settings;
        if (!ss?.public_profile_enabled) continue;

        // Filtros adicionales del UI
        if (filters.query && !String(s.name).toLowerCase().includes(filters.query.toLowerCase())) continue;
        if (filters.city && !String(s.city || '').toLowerCase().includes(filters.city.toLowerCase())) continue;
        if (filters.sport) {
          const sportLower = filters.sport.toLowerCase();
          const has = (s.sports || []).some((sp: string) => sp.toLowerCase().includes(sportLower));
          if (!has) continue;
        }

        markers.push({
          id: s.id,
          name: s.name,
          lat: Number(row.lat),
          lng: Number(row.lng),
          city: s.city,
          address: row.address,
          sports: Array.isArray(s.sports) ? s.sports : [],
          logo_url: s.logo_url,
          cover_image_url: s.cover_image_url,
          verified: !!s.verified,
          description: s.description,
        });
      }

      return markers;
    },
    staleTime: 3 * 60 * 1000,
  });
}

// ── MapAutoCenter: re-encuadra cuando cambian los markers ────────────────────
function MapAutoCenter({ markers }: { markers: SchoolMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [markers, map]);
  return null;
}

// ── MapCenterOnUser: vuela a la ubicacion del usuario al activarse ───────────
function MapCenterOnUser({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!userLocation) return;
    map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1.2 });
  }, [userLocation, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export function ExploreMapInteractive({
  category,
  query,
  city,
  sport,
}: ExploreMapInteractiveProps) {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [centerOnUser, setCenterOnUser] = useState(false);

  // Solo cargamos schools por ahora (categoria 'schools' o 'all').
  // Trainers/events se pueden sumar despues con el mismo patron.
  const shouldLoad = category === 'all' || category === 'schools';
  const { data: schools = [], isLoading } = useExploreSchools({ query, city, sport });

  const markers = useMemo(() => (shouldLoad ? schools : []), [shouldLoad, schools]);

  // User geolocation
  const askLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCenterOnUser(true);
      },
      () => {
        // best-effort, no rompemos UI
      },
      { timeout: 5000 },
    );
  };

  const academyIcon = useMemo(() => makeIcon(TYPE_COLORS.academy), []);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border shadow-lg">
      <div className="h-[600px] w-full">
        <MapContainer
          center={[4.6097, -74.0817]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON}>
              <Popup>Tu ubicación</Popup>
            </Marker>
          )}

          {markers.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={academyIcon}>
              <Popup minWidth={240}>
                <div className="space-y-2 max-w-[260px]">
                  {m.cover_image_url && (
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
                      <h4 className="text-sm font-semibold leading-tight">{m.name}</h4>
                      {m.verified && (
                        <span className="text-[10px] text-blue-600 font-medium">
                          ✓ Verificada
                        </span>
                      )}
                    </div>
                  </div>

                  {m.sports.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.sports.slice(0, 4).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {(m.address || m.city) && (
                    <p className="text-[11px] text-muted-foreground">
                      📍 {[m.address, m.city].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/schools/${m.id}`)}
                  >
                    Ver programas
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}

          <MapAutoCenter markers={markers} />
          <MapCenterOnUser userLocation={centerOnUser ? userLocation : null} />
        </MapContainer>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-[500] pointer-events-none">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando escuelas…</p>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
        <div className="px-3 py-1.5 rounded-lg shadow-md bg-white/95 text-xs font-medium border">
          🎓 {markers.length} escuelas
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
  );
}

export default ExploreMapInteractive;
