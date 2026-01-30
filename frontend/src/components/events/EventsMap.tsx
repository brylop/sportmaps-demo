import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Event } from '@/types/events';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface EventsMapProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  center?: [number, number];
  zoom?: number;
}

export function EventsMap({ 
  events, 
  onEventClick, 
  center = [4.6097, -74.0817], // Bogotá default
  zoom = 6 
}: EventsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView(center, zoom);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for events with coordinates
    const eventsWithCoords = events.filter(e => e.lat && e.lng);
    
    eventsWithCoords.forEach(event => {
      if (!event.lat || !event.lng) return;

      const formatPrice = (price: number) => {
        if (price === 0) return 'Gratis';
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0
        }).format(price);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short'
        });
      };

      // Custom icon based on sport
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            background: linear-gradient(135deg, #f97316, #f59e0b);
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: 14px;
            ">⚽</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([event.lat, event.lng], { icon: customIcon })
        .addTo(mapInstanceRef.current!);

      // Popup content
      const popupContent = `
        <div style="min-width: 200px; padding: 8px;">
          <h3 style="font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">${event.title}</h3>
          <div style="font-size: 12px; color: #666;">
            <p style="margin: 4px 0;">🏅 ${event.sport}</p>
            <p style="margin: 4px 0;">📅 ${formatDate(event.event_date)} • ${event.start_time.slice(0, 5)}</p>
            <p style="margin: 4px 0;">📍 ${event.city}</p>
            <p style="margin: 4px 0; font-weight: 600; color: #f97316;">💰 ${formatPrice(event.price)}</p>
          </div>
          <button 
            onclick="window.dispatchEvent(new CustomEvent('eventClick', { detail: '${event.slug}' }))"
            style="
              margin-top: 8px;
              background: linear-gradient(135deg, #f97316, #f59e0b);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              width: 100%;
              font-weight: 500;
            "
          >
            Ver detalles
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (eventsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        eventsWithCoords.map(e => [e.lat!, e.lng!] as [number, number])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [events]);

  // Listen for popup button clicks
  useEffect(() => {
    const handleEventClick = (e: CustomEvent) => {
      const slug = e.detail;
      const event = events.find(ev => ev.slug === slug);
      if (event && onEventClick) {
        onEventClick(event);
      }
    };

    window.addEventListener('eventClick', handleEventClick as EventListener);
    return () => window.removeEventListener('eventClick', handleEventClick as EventListener);
  }, [events, onEventClick]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}
