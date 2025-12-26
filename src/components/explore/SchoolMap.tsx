import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom SportMaps marker icon (verde #248223)
const createCustomIcon = (isSelected: boolean = false) => {
  const color = isSelected ? '#FB9F1E' : '#248223';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg 
          style="transform: rotate(45deg); width: 18px; height: 18px; fill: white;"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

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
  const R = 6371; // Earth's radius in km
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

// Component to fit bounds
function FitBounds({ schools, userLocation }: { schools: School[]; userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    const validSchools = schools.filter(s => s.latitude && s.longitude);
    if (validSchools.length === 0) return;

    const bounds = L.latLngBounds(
      validSchools.map(s => [s.latitude!, s.longitude!] as [number, number])
    );

    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [schools, userLocation, map]);

  return null;
}

export function SchoolMap({ schools, userLocation, selectedSchoolId, onSchoolSelect }: SchoolMapProps) {
  const navigate = useNavigate();

  // Default center: Bogotá, Colombia
  const defaultCenter: [number, number] = [4.6097, -74.0817];

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

  // User location marker icon
  const userMarkerIcon = L.divIcon({
    className: 'user-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: #3B82F6;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 2px 10px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <div className="relative h-[500px] rounded-xl overflow-hidden border border-border shadow-lg">
      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter}
        zoom={12}
        className="h-full w-full z-0"
        style={{ background: 'hsl(var(--muted))' }}
      >
        {/* OpenStreetMap TileLayer - FREE, no API key needed */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fit bounds to show all schools */}
        <FitBounds schools={schoolsWithDistance} userLocation={userLocation} />

        {/* User location marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userMarkerIcon}>
            <Popup>
              <div className="text-center font-poppins">
                <p className="font-semibold">Tu ubicación</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* School markers */}
        {schoolsWithDistance.map((school) => (
          <Marker
            key={school.id}
            position={[school.latitude!, school.longitude!]}
            icon={createCustomIcon(school.id === selectedSchoolId)}
            eventHandlers={{
              click: () => onSchoolSelect?.(school.id),
            }}
          >
            <Popup>
              <div className="min-w-[200px] font-poppins p-1">
                <div className="flex items-start gap-3 mb-3">
                  {school.logo_url ? (
                    <img
                      src={school.logo_url}
                      alt={school.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-sm leading-tight">{school.name}</h3>
                    {school.verified && (
                      <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary">
                        ✓ Verificada
                      </Badge>
                    )}
                  </div>
                </div>

                {school.rating && (
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-sm">{school.rating.toFixed(1)}</span>
                  </div>
                )}

                {school.sports && school.sports.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {school.sports.slice(0, 3).map((sport) => (
                      <Badge key={sport} variant="outline" className="text-xs">
                        {sport}
                      </Badge>
                    ))}
                  </div>
                )}

                {school.distance !== null && (
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-3">
                    <Navigation className="w-3 h-3" />
                    <span>{school.distance.toFixed(1)} km de distancia</span>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/schools/${school.id}`)}
                >
                  Ver Programas
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Distance Legend */}
      {userLocation && schoolsWithDistance.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border z-[1000]">
          <p className="text-xs font-semibold mb-2 text-foreground">Escuelas cercanas</p>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {schoolsWithDistance.slice(0, 5).map((school) => (
              <div
                key={school.id}
                className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors"
                onClick={() => onSchoolSelect?.(school.id)}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: school.id === selectedSchoolId ? '#FB9F1E' : '#248223' }}
                />
                <span className="truncate max-w-[120px]">{school.name}</span>
                <span className="text-muted-foreground">{school.distance?.toFixed(1)} km</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
