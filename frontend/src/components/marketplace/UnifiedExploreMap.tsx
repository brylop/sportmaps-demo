import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Navigation, Stethoscope, Trophy, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ExploreCategory } from '@/hooks/useExplorarGlobal';
import 'leaflet/dist/leaflet.css';

interface MapMarker {
  id: string;
  item_type: 'service' | 'event' | 'school';
  name: string;
  lat: number;
  lng: number;
  price: number;
  // Service fields
  service_type?: string;
  vendor_name?: string;
  vendor_slug?: string;
  vendor_city?: string;
  vendor_verified?: boolean;
  vendor_logo?: string;
  duration_minutes?: number;
  // Event fields
  event_date?: string;
  event_time?: string;
  event_type?: string;
  sport?: string;
  city?: string;
  capacity?: number;
  slug?: string;
  registrations_open?: boolean;
  // School fields
  sports?: string[];
  rating?: number;
  review_count?: number;
  logo_url?: string;
  verified?: boolean;
}

interface UnifiedExploreMapProps {
  category: ExploreCategory;
  query?: string;
  city?: string;
  sport?: string;
  serviceType?: string;
  onServiceClick?: (marker: MapMarker) => void;
}

// Marker colors per type
const MARKER_COLORS = {
  service: { bg: '#10b981', border: '#059669', emoji: '🩺' },  // emerald
  event:   { bg: '#f59e0b', border: '#d97706', emoji: '🏆' },  // amber
  school:  { bg: '#3b82f6', border: '#2563eb', emoji: '🎓' },  // blue
};

const formatPrice = (price: number) => {
  if (price === 0) return 'Gratis';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);
};

export function UnifiedExploreMap({
  category, query, city, sport, serviceType, onServiceClick,
}: UnifiedExploreMapProps) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Layer visibility
  const [layers, setLayers] = useState({
    services: true,
    events: true,
    schools: true,
  });

  // Fetch map markers
  const { data: mapData, isLoading } = useQuery({
    queryKey: ['explore-map', category, query, city, sport, serviceType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_explore_map', {
        p_category: category === 'products' ? 'all' : category,
        p_query: query || null,
        p_city: city || null,
        p_sport: sport || null,
        p_service_type: serviceType || null,
      });
      if (error) throw error;
      return data as { markers: MapMarker[]; counts: Record<string, number> };
    },
    staleTime: 3 * 60 * 1000,
  });

  const markers: MapMarker[] = mapData?.markers || [];
  const counts = mapData?.counts || { services: 0, events: 0, schools: 0 };

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // silently ignore errors
      { timeout: 5000 }
    );
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let mounted = true;

    const initMap = async () => {
      const L = await import('leaflet');

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      if (!mounted || !mapContainerRef.current) return;

      const defaultCenter: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [4.6097, -74.0817]; // Bogota

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: userLocation ? 12 : 6,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // User location marker
      if (userLocation) {
        const userIcon = L.divIcon({
          className: 'user-location-marker',
          html: `<div style="
            width: 16px; height: 16px;
            background: #3B82F6;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup('<b>Tu ubicación</b>');
      }

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      setIsMapReady(true);
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setIsMapReady(false);
      }
    };
  }, [userLocation]);

  // Update markers when data or layers change
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const updateMarkers = async () => {
      const L = await import('leaflet');

      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const visibleMarkers = markers.filter(m => {
        if (m.item_type === 'service' && !layers.services) return false;
        if (m.item_type === 'event' && !layers.events) return false;
        if (m.item_type === 'school' && !layers.schools) return false;
        return true;
      });

      visibleMarkers.forEach((item) => {
        if (!item.lat || !item.lng) return;

        const colors = MARKER_COLORS[item.item_type];

        const icon = L.divIcon({
          className: `explore-marker explore-marker-${item.item_type}`,
          html: `<div style="
            width: 34px; height: 34px;
            background: ${colors.bg};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            border: 2.5px solid white;
          ">
            <span style="transform: rotate(45deg); font-size: 14px;">${colors.emoji}</span>
          </div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34],
        });

        const marker = L.marker([item.lat, item.lng], { icon })
          .addTo(mapInstanceRef.current);

        // Build popup per type
        let popupHtml = '';

        if (item.item_type === 'service') {
          popupHtml = `
            <div style="min-width: 200px; font-family: system-ui, sans-serif; padding: 4px;">
              <div style="display: flex; gap: 8px; align-items: start; margin-bottom: 6px;">
                ${item.vendor_logo
                  ? `<img src="${item.vendor_logo}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;" />`
                  : `<div style="width:36px;height:36px;border-radius:8px;background:${colors.bg}20;display:flex;align-items:center;justify-content:center;">🩺</div>`
                }
                <div>
                  <h4 style="font-weight:600;font-size:13px;margin:0;">${item.name}</h4>
                  <p style="font-size:11px;color:#666;margin:2px 0;">${item.vendor_name || ''}</p>
                </div>
              </div>
              <p style="font-size:11px;color:#666;margin:2px 0;">📍 ${item.vendor_city || ''}</p>
              ${item.duration_minutes ? `<p style="font-size:11px;color:#666;margin:2px 0;">⏱ ${item.duration_minutes} min</p>` : ''}
              <p style="font-size:13px;font-weight:600;color:${colors.bg};margin:6px 0;">${formatPrice(item.price)}</p>
              <button onclick="window.dispatchEvent(new CustomEvent('exploreMapAction', { detail: JSON.stringify({type:'service', id:'${item.id}'}) }))"
                style="width:100%;padding:6px;background:${colors.bg};color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500;">
                Reservar cita
              </button>
            </div>`;
        } else if (item.item_type === 'event') {
          const dateStr = item.event_date
            ? new Date(item.event_date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
            : '';
          popupHtml = `
            <div style="min-width: 200px; font-family: system-ui, sans-serif; padding: 4px;">
              <h4 style="font-weight:600;font-size:13px;margin:0 0 4px;">${item.name}</h4>
              <p style="font-size:11px;color:#666;margin:2px 0;">🏅 ${item.sport || item.event_type || ''}</p>
              <p style="font-size:11px;color:#666;margin:2px 0;">📅 ${dateStr} ${item.event_time ? '• ' + String(item.event_time).slice(0, 5) : ''}</p>
              <p style="font-size:11px;color:#666;margin:2px 0;">📍 ${item.city || ''}</p>
              ${item.capacity ? `<p style="font-size:11px;color:#666;margin:2px 0;">👥 ${item.capacity} cupos</p>` : ''}
              <p style="font-size:13px;font-weight:600;color:${colors.bg};margin:6px 0;">${formatPrice(item.price)}</p>
              <button onclick="window.dispatchEvent(new CustomEvent('exploreMapAction', { detail: JSON.stringify({type:'event', slug:'${item.slug || item.id}'}) }))"
                style="width:100%;padding:6px;background:${colors.bg};color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500;">
                Ver evento
              </button>
            </div>`;
        } else if (item.item_type === 'school') {
          const sportsHtml = item.sports?.slice(0, 3).map(s =>
            `<span style="display:inline-block;padding:1px 6px;font-size:10px;background:#f0f0f0;border-radius:4px;margin:1px;">${s}</span>`
          ).join('') || '';
          popupHtml = `
            <div style="min-width: 200px; font-family: system-ui, sans-serif; padding: 4px;">
              <div style="display: flex; gap: 8px; align-items: start; margin-bottom: 6px;">
                ${item.logo_url
                  ? `<img src="${item.logo_url}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;" />`
                  : `<div style="width:36px;height:36px;border-radius:8px;background:${colors.bg}20;display:flex;align-items:center;justify-content:center;">🎓</div>`
                }
                <div>
                  <h4 style="font-weight:600;font-size:13px;margin:0;">${item.name}</h4>
                  ${item.verified ? '<span style="font-size:10px;color:#3b82f6;">✓ Verificada</span>' : ''}
                </div>
              </div>
              ${item.rating ? `<p style="font-size:11px;margin:2px 0;">⭐ ${Number(item.rating).toFixed(1)} ${item.review_count ? `(${item.review_count})` : ''}</p>` : ''}
              ${sportsHtml ? `<div style="margin:4px 0;">${sportsHtml}</div>` : ''}
              <button onclick="window.dispatchEvent(new CustomEvent('exploreMapAction', { detail: JSON.stringify({type:'school', id:'${item.id}'}) }))"
                style="width:100%;padding:6px;background:${colors.bg};color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500;margin-top:6px;">
                Ver programas
              </button>
            </div>`;
        }

        marker.bindPopup(popupHtml);
        markersRef.current.push(marker);
      });

      // Fit bounds
      if (visibleMarkers.length > 0) {
        const L2 = await import('leaflet');
        const bounds = L2.latLngBounds(
          visibleMarkers.map(m => [m.lat, m.lng] as [number, number])
        );
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    };

    updateMarkers();
  }, [markers, layers, isMapReady]);

  // Handle popup actions
  useEffect(() => {
    const handleAction = (e: CustomEvent) => {
      try {
        const detail = JSON.parse(e.detail);
        if (detail.type === 'service') {
          const item = markers.find(m => m.id === detail.id);
          if (item && onServiceClick) onServiceClick(item);
        } else if (detail.type === 'event') {
          navigate(`/event/${detail.slug}`);
        } else if (detail.type === 'school') {
          navigate(`/schools/${detail.id}`);
        }
      } catch { /* ignore parse errors */ }
    };

    window.addEventListener('exploreMapAction', handleAction as EventListener);
    return () => window.removeEventListener('exploreMapAction', handleAction as EventListener);
  }, [markers, navigate, onServiceClick]);

  const toggleLayer = useCallback((layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border shadow-lg">
      {/* Map container */}
      <div ref={mapContainerRef} className="h-[500px] w-full" />

      {/* Loading overlay */}
      {(isLoading || !isMapReady) && (
        <div className="absolute inset-0 bg-muted/60 flex items-center justify-center z-[500]">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando mapa...</p>
          </div>
        </div>
      )}

      {/* Layer toggles (top-right) */}
      {isMapReady && (
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
          <button
            onClick={() => toggleLayer('services')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all ${
              layers.services ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white/90 text-muted-foreground border-border'
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Profesionales
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-white/20">{counts.services}</Badge>
          </button>
          <button
            onClick={() => toggleLayer('events')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all ${
              layers.events ? 'bg-amber-500 text-white border-amber-600' : 'bg-white/90 text-muted-foreground border-border'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            Eventos
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-white/20">{counts.events}</Badge>
          </button>
          <button
            onClick={() => toggleLayer('schools')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all ${
              layers.schools ? 'bg-blue-500 text-white border-blue-600' : 'bg-white/90 text-muted-foreground border-border'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Escuelas
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-white/20">{counts.schools}</Badge>
          </button>
        </div>
      )}

      {/* "Near me" button (bottom-left) */}
      {isMapReady && !userLocation && (
        <div className="absolute bottom-3 left-3 z-[1000]">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-1.5"
            onClick={() => {
              navigator.geolocation?.getCurrentPosition(
                (pos) => {
                  setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  mapInstanceRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 13);
                },
                () => {},
              );
            }}
          >
            <Navigation className="h-3.5 w-3.5" />
            Cerca de mi
          </Button>
        </div>
      )}

      {/* Legend (bottom-right) */}
      {isMapReady && markers.length > 0 && (
        <div className="absolute bottom-3 right-3 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg border text-[11px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span style={{ color: MARKER_COLORS.service.bg }}>●</span> Profesional</span>
            <span className="flex items-center gap-1"><span style={{ color: MARKER_COLORS.event.bg }}>●</span> Evento</span>
            <span className="flex items-center gap-1"><span style={{ color: MARKER_COLORS.school.bg }}>●</span> Escuela</span>
          </div>
        </div>
      )}
    </div>
  );
}
