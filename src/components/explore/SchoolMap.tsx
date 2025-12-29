import { useEffect, useMemo, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';

interface School {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  sports?: string[] | null;
  logo_url?: string | null;
  verified?: boolean | null;
}

interface SchoolMapProps {
  schools: School[];
  userLocation: { lat: number; lng: number } | null;
  selectedSchoolId?: string;
  onSchoolSelect?: (schoolId: string) => void;
}

// Haversine formula to calculate distance in km
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function SchoolMap({ schools, userLocation, selectedSchoolId, onSchoolSelect }: SchoolMapProps) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate distances if user location is available
  const schoolsWithDistance = useMemo(() => {
    return schools
      .filter(school => school.latitude && school.longitude)
      .map(school => ({
        ...school,
        distance: userLocation
          ? calculateDistance(
              userLocation.lat,
              userLocation.lng,
              school.latitude!,
              school.longitude!
            )
          : null,
      }))
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }, [schools, userLocation]);

  // Initialize map using vanilla Leaflet
  useEffect(() => {
    // Skip if no container or already initialized
    if (!mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current) setIsLoading(false);
      return;
    }

    let L: any;
    
    const initMap = async () => {
      try {
        L = await import('leaflet');

        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Ensure container still exists
        if (!mapContainerRef.current) return;

        const defaultCenter: [number, number] = userLocation
          ? [userLocation.lat, userLocation.lng]
          : [4.6097, -74.0817]; // Bogotá

        // Create map instance
        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 11,
        });
        
        mapInstanceRef.current = map;

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Add user location marker if available
        if (userLocation) {
          const userIcon = L.divIcon({
            className: 'user-marker',
            html: `<div style="
              width: 18px;
              height: 18px;
              background: #3B82F6;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup('<div class="text-center font-semibold">Tu ubicación</div>');
        }

        // Force size recalculation after a short delay
        setTimeout(() => {
          map.invalidateSize();
        }, 100);

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading map:', err);
        setError('No se pudo cargar el mapa');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation]);

  // Update markers when schools change
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstanceRef.current) return;

      const L = await import('leaflet');

      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Create custom icon
      const createIcon = (isSelected: boolean) => {
        const color = isSelected ? '#FB9F1E' : '#248223';
        return L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            width: 36px;
            height: 36px;
            background: ${color};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg style="transform: rotate(45deg); width: 16px; height: 16px; fill: white;" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });
      };

      // Add markers for each school
      schoolsWithDistance.forEach((school) => {
        if (!school.latitude || !school.longitude) return;

        const marker = L.marker([school.latitude, school.longitude], {
          icon: createIcon(school.id === selectedSchoolId),
        });

        const sportsHtml = school.sports?.slice(0, 3).map(sport => 
          `<span class="inline-block px-2 py-0.5 text-xs bg-gray-100 rounded mr-1 mb-1">${sport}</span>`
        ).join('') || '';

        const distanceHtml = school.distance !== null 
          ? `<div class="flex items-center gap-1 text-gray-500 text-xs mb-2">
              <span>📍 ${school.distance.toFixed(1)} km</span>
            </div>`
          : '';

        const popupContent = `
          <div style="min-width: 180px; font-family: Poppins, sans-serif; padding: 4px;">
            <div style="display: flex; align-items: start; gap: 8px; margin-bottom: 8px;">
              ${school.logo_url 
                ? `<img src="${school.logo_url}" alt="${school.name}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" />`
                : `<div style="width: 40px; height: 40px; border-radius: 8px; background: #24822320; display: flex; align-items: center; justify-content: center;">📍</div>`
              }
              <div style="flex: 1;">
                <h3 style="font-weight: bold; font-size: 14px; margin: 0;">${school.name}</h3>
                ${school.verified ? '<span style="font-size: 10px; color: #248223;">✓ Verificada</span>' : ''}
              </div>
            </div>
            ${school.rating ? `<div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">⭐ <span style="font-weight: 600;">${school.rating.toFixed(1)}</span></div>` : ''}
            ${sportsHtml ? `<div style="margin-bottom: 8px;">${sportsHtml}</div>` : ''}
            ${distanceHtml}
            <button onclick="window.location.href='/schools/${school.id}'" style="
              width: 100%;
              padding: 6px 12px;
              background: #248223;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
            ">Ver Programas</button>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => onSchoolSelect?.(school.id));
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [schoolsWithDistance, selectedSchoolId, onSchoolSelect]);

  return (
    <div className="relative h-[400px] rounded-xl overflow-hidden border border-border shadow-lg">
      {/* Map container - always rendered */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-[500]">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground font-poppins">Cargando mapa...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-[500]">
          <p className="text-muted-foreground font-poppins">{error}</p>
        </div>
      )}

      {/* Distance Legend */}
      {!isLoading && !error && userLocation && schoolsWithDistance.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border z-[1000]">
          <p className="text-xs font-semibold mb-2 text-foreground font-poppins">Escuelas cercanas</p>
          <div className="space-y-1 max-h-[100px] overflow-y-auto">
            {schoolsWithDistance.slice(0, 5).map((school) => (
              <div
                key={school.id}
                className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors"
                onClick={() => onSchoolSelect?.(school.id)}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: school.id === selectedSchoolId ? '#FB9F1E' : '#248223' }}
                />
                <span className="truncate max-w-[100px]">{school.name}</span>
                <span className="text-muted-foreground">{school.distance?.toFixed(1)} km</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
