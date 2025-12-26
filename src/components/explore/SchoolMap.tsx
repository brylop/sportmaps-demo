import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Navigation, Loader2 } from 'lucide-react';
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

export function SchoolMap({ schools, userLocation, selectedSchoolId, onSchoolSelect }: SchoolMapProps) {
  const navigate = useNavigate();
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Lazy load Leaflet to avoid SSR and React context issues
  useEffect(() => {
    let mounted = true;
    
    const loadMap = async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        
        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        const { MapContainer, TileLayer, Marker, Popup, useMap } = await import('react-leaflet');

        // Create the map component
        const InternalMap = () => {
          const defaultCenter: [number, number] = userLocation 
            ? [userLocation.lat, userLocation.lng] 
            : [4.6097, -74.0817]; // Bogotá

          // Custom marker icon
          const createCustomIcon = (isSelected: boolean = false) => {
            const color = isSelected ? '#FB9F1E' : '#248223';
            return L.divIcon({
              className: 'custom-marker',
              html: `
                <div style="
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
                  <svg 
                    style="transform: rotate(45deg); width: 16px; height: 16px; fill: white;"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 36],
              popupAnchor: [0, -36],
            });
          };

          const userMarkerIcon = L.divIcon({
            className: 'user-marker',
            html: `
              <div style="
                width: 18px;
                height: 18px;
                background: #3B82F6;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
              "></div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          return (
            <MapContainer
              center={defaultCenter}
              zoom={11}
              className="h-full w-full"
              style={{ background: 'hsl(var(--muted))' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userMarkerIcon}>
                  <Popup>
                    <div className="text-center font-poppins">
                      <p className="font-semibold">Tu ubicación</p>
                    </div>
                  </Popup>
                </Marker>
              )}

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
                    <div className="min-w-[180px] font-poppins p-1">
                      <div className="flex items-start gap-2 mb-2">
                        {school.logo_url ? (
                          <img
                            src={school.logo_url}
                            alt={school.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-primary" />
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
                        <div className="flex flex-wrap gap-1 mb-2">
                          {school.sports.slice(0, 3).map((sport) => (
                            <Badge key={sport} variant="outline" className="text-xs">
                              {sport}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {school.distance !== null && (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                          <Navigation className="w-3 h-3" />
                          <span>{school.distance.toFixed(1)} km</span>
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
          );
        };

        if (mounted) {
          setMapComponent(() => InternalMap);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading map:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadMap();
    
    return () => {
      mounted = false;
    };
  }, [schoolsWithDistance, userLocation, selectedSchoolId, onSchoolSelect, navigate]);

  if (isLoading) {
    return (
      <div className="relative h-[400px] rounded-xl overflow-hidden border border-border shadow-lg bg-muted/50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  if (!MapComponent) {
    return (
      <div className="relative h-[400px] rounded-xl overflow-hidden border border-border shadow-lg bg-muted/50 flex items-center justify-center">
        <p className="text-muted-foreground">No se pudo cargar el mapa</p>
      </div>
    );
  }

  return (
    <div className="relative h-[400px] rounded-xl overflow-hidden border border-border shadow-lg">
      <MapComponent />

      {/* Distance Legend */}
      {userLocation && schoolsWithDistance.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border z-[1000]">
          <p className="text-xs font-semibold mb-2 text-foreground">Escuelas cercanas</p>
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
