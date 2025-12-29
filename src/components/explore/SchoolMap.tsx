import { useEffect, useMemo, useState, useRef } from 'react';
import { Loader2, List, MapIcon, Navigation2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

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
  hoveredSchoolId?: string;
  onSchoolHover?: (schoolId: string | null) => void;
}

// Colombia bounds for map restriction
const COLOMBIA_BOUNDS = {
  north: 13.5,
  south: -4.5,
  west: -82.0,
  east: -66.0,
};

// Default center: Bogotá
const DEFAULT_CENTER: [number, number] = [4.6097, -74.0817];

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

export function SchoolMap({ 
  schools, 
  userLocation, 
  selectedSchoolId, 
  onSchoolSelect,
  hoveredSchoolId,
  onSchoolHover 
}: SchoolMapProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markerClusterRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Filter schools with valid coordinates
  const validSchools = useMemo(() => {
    return schools.filter(school => 
      school.latitude != null && 
      school.longitude != null &&
      !isNaN(school.latitude) &&
      !isNaN(school.longitude) &&
      school.latitude >= -90 && school.latitude <= 90 &&
      school.longitude >= -180 && school.longitude <= 180
    );
  }, [schools]);

  // Schools without valid coordinates
  const schoolsWithoutLocation = useMemo(() => {
    return schools.filter(school => 
      school.latitude == null || 
      school.longitude == null ||
      isNaN(school.latitude!) ||
      isNaN(school.longitude!)
    );
  }, [schools]);

  // Calculate distances if user location is available
  const schoolsWithDistance = useMemo(() => {
    return validSchools
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
  }, [validSchools, userLocation]);

  // Initialize map using vanilla Leaflet with Clustering
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current) setIsLoading(false);
      return;
    }

    let L: any;
    
    const initMap = async () => {
      try {
        L = await import('leaflet');
        await import('leaflet.markercluster');

        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        if (!mapContainerRef.current) return;

        const center: [number, number] = userLocation
          ? [userLocation.lat, userLocation.lng]
          : DEFAULT_CENTER;

        // Create map with bounds restriction
        const southWest = L.latLng(COLOMBIA_BOUNDS.south, COLOMBIA_BOUNDS.west);
        const northEast = L.latLng(COLOMBIA_BOUNDS.north, COLOMBIA_BOUNDS.east);
        const bounds = L.latLngBounds(southWest, northEast);

        const map = L.map(mapContainerRef.current, {
          center,
          zoom: 11,
          maxBounds: bounds,
          maxBoundsViscosity: 1.0,
          minZoom: 5,
          maxZoom: 18,
        });
        
        mapInstanceRef.current = map;

        // Add tile layer with dark mode support
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);

        // Create marker cluster group with custom styling
        const markerCluster = (L as any).markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          disableClusteringAtZoom: 16,
          iconCreateFunction: (cluster: any) => {
            const childCount = cluster.getChildCount();
            let size = 'small';
            if (childCount > 10) size = 'medium';
            if (childCount > 50) size = 'large';
            
            const sizes: Record<string, number> = { small: 36, medium: 44, large: 52 };
            const sizeValue = sizes[size];
            
            return L.divIcon({
              html: `<div style="
                width: ${sizeValue}px;
                height: ${sizeValue}px;
                background: linear-gradient(135deg, #248223 0%, #1a5e19 100%);
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(36, 130, 35, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: ${size === 'large' ? '16px' : size === 'medium' ? '14px' : '12px'};
                font-family: 'Poppins', sans-serif;
              ">${childCount}</div>`,
              className: 'custom-cluster-icon',
              iconSize: L.point(sizeValue, sizeValue),
            });
          },
        });

        markerClusterRef.current = markerCluster;
        map.addLayer(markerCluster);

        // Add user location marker if available
        if (userLocation) {
          const userIcon = L.divIcon({
            className: 'user-marker',
            html: `<div style="
              width: 20px;
              height: 20px;
              background: #3B82F6;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
              animation: pulse 2s infinite;
            "></div>
            <style>
              @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
                70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
                100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
              }
            </style>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup('<div class="text-center font-semibold p-2">📍 Tu ubicación</div>');
        }

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
        markerClusterRef.current = null;
      }
    };
  }, [userLocation]);

  // Update markers when schools change
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstanceRef.current || !markerClusterRef.current) return;

      const L = await import('leaflet');

      // Clear existing markers from cluster
      markerClusterRef.current.clearLayers();
      markersRef.current = [];

      // Create custom icon
      const createIcon = (isSelected: boolean, isHovered: boolean) => {
        const color = isSelected ? '#FB9F1E' : isHovered ? '#FF6B35' : '#248223';
        const scale = isSelected || isHovered ? 1.15 : 1;
        return L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            width: ${36 * scale}px;
            height: ${36 * scale}px;
            background: ${color};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">
            <svg style="transform: rotate(45deg); width: ${16 * scale}px; height: ${16 * scale}px; fill: white;" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>`,
          iconSize: [36 * scale, 36 * scale],
          iconAnchor: [18 * scale, 36 * scale],
          popupAnchor: [0, -36 * scale],
        });
      };

      // Add markers for each school with valid coordinates
      schoolsWithDistance.forEach((school) => {
        const isSelected = school.id === selectedSchoolId;
        const isHovered = school.id === hoveredSchoolId;

        const marker = L.marker([school.latitude!, school.longitude!], {
          icon: createIcon(isSelected, isHovered),
        });

        const sportsHtml = school.sports?.slice(0, 3).map(sport => 
          `<span style="display: inline-block; padding: 2px 8px; font-size: 11px; background: #f3f4f6; border-radius: 12px; margin: 2px;">${sport}</span>`
        ).join('') || '<span style="color: #9ca3af; font-size: 11px;">Sin deportes especificados</span>';

        const distanceHtml = school.distance !== null 
          ? `<div style="display: flex; align-items: center; gap: 4px; color: #6b7280; font-size: 11px; margin-bottom: 8px;">
              📍 ${school.distance.toFixed(1)} km de distancia
            </div>`
          : '';

        const addressHtml = school.address 
          ? `<p style="color: #6b7280; font-size: 11px; margin-bottom: 8px;">${school.address}</p>`
          : '<p style="color: #9ca3af; font-size: 11px; margin-bottom: 8px;">Dirección no especificada</p>';

        const logoHtml = school.logo_url 
          ? `<img src="${school.logo_url}" alt="${school.name}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div style="display: none; width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #24822320 0%, #1a5e1920 100%); align-items: center; justify-content: center; font-size: 20px;">🏫</div>`
          : `<div style="width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #24822320 0%, #1a5e1920 100%); display: flex; align-items: center; justify-content: center; font-size: 20px;">🏫</div>`;

        const popupContent = `
          <div style="min-width: 200px; max-width: 280px; font-family: 'Poppins', sans-serif; padding: 4px;">
            <div style="display: flex; align-items: start; gap: 10px; margin-bottom: 10px;">
              ${logoHtml}
              <div style="flex: 1; min-width: 0;">
                <h3 style="font-weight: 600; font-size: 14px; margin: 0; line-height: 1.3;">${school.name}</h3>
                ${school.verified ? '<span style="font-size: 10px; color: #248223; display: flex; align-items: center; gap: 2px;">✓ Verificada</span>' : ''}
              </div>
            </div>
            ${addressHtml}
            ${school.rating ? `<div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">⭐ <span style="font-weight: 600;">${school.rating.toFixed(1)}</span><span style="color: #9ca3af; font-size: 11px;">/5</span></div>` : ''}
            <div style="margin-bottom: 10px;">${sportsHtml}</div>
            ${distanceHtml}
            <button onclick="window.location.href='/schools/${school.id}'" style="
              width: 100%;
              padding: 8px 16px;
              background: linear-gradient(135deg, #248223 0%, #1a5e19 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              Ver Programas
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 300 });
        marker.on('click', () => onSchoolSelect?.(school.id));
        marker.on('mouseover', () => onSchoolHover?.(school.id));
        marker.on('mouseout', () => onSchoolHover?.(null));
        
        markerClusterRef.current.addLayer(marker);
        markersRef.current.push({ marker, schoolId: school.id });
      });

      // Fit bounds if we have valid schools
      if (schoolsWithDistance.length > 0) {
        const validCoords = schoolsWithDistance.map(s => [s.latitude!, s.longitude!] as [number, number]);
        if (validCoords.length > 1) {
          const L = await import('leaflet');
          const bounds = L.latLngBounds(validCoords);
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
      }
    };

    updateMarkers();
  }, [schoolsWithDistance, selectedSchoolId, hoveredSchoolId, onSchoolSelect, onSchoolHover]);

  // Center on user location
  const centerOnUser = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    }
  };

  // Mobile list view
  const renderListView = () => (
    <div className="h-full overflow-y-auto space-y-3 p-4 bg-background">
      {schoolsWithDistance.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No hay escuelas con ubicación disponible</p>
        </div>
      ) : (
        schoolsWithDistance.map((school) => (
          <div
            key={school.id}
            onClick={() => {
              onSchoolSelect?.(school.id);
              navigate(`/schools/${school.id}`);
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
              school.id === selectedSchoolId 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {school.logo_url ? (
                <img 
                  src={school.logo_url} 
                  alt={school.name}
                  className="w-12 h-12 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                  🏫
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm truncate">{school.name}</h4>
                  {school.verified && (
                    <Badge variant="secondary" className="text-xs shrink-0 bg-primary/10 text-primary">
                      ✓
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {school.address || 'Dirección no especificada'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {school.rating && (
                    <span className="flex items-center gap-1">
                      ⭐ {school.rating.toFixed(1)}
                    </span>
                  )}
                  {school.distance !== null && (
                    <span className="text-muted-foreground">
                      📍 {school.distance.toFixed(1)} km
                    </span>
                  )}
                </div>
                {school.sports && school.sports.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {school.sports.slice(0, 3).map((sport, i) => (
                      <Badge key={i} variant="outline" className="text-xs py-0">
                        {sport}
                      </Badge>
                    ))}
                    {school.sports.length > 3 && (
                      <Badge variant="outline" className="text-xs py-0">
                        +{school.sports.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
      
      {/* Schools without location notice */}
      {schoolsWithoutLocation.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">
            ⚠️ {schoolsWithoutLocation.length} escuela(s) sin ubicación disponible en el mapa
          </p>
        </div>
      )}
    </div>
  );

  // Dynamic height based on device
  const mapHeight = isMobile ? 'h-[50vh]' : 'h-[450px]';

  return (
    <div className="relative">
      {/* Mobile view toggle */}
      {isMobile && (
        <div className="flex gap-2 mb-3">
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
            className="flex-1"
          >
            <MapIcon className="h-4 w-4 mr-2" />
            Mapa
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="flex-1"
          >
            <List className="h-4 w-4 mr-2" />
            Lista ({schoolsWithDistance.length})
          </Button>
        </div>
      )}

      <div className={`relative ${mapHeight} rounded-xl overflow-hidden border border-border shadow-lg`} style={{ zIndex: 0 }}>
        {/* Show list view on mobile when selected */}
        {isMobile && viewMode === 'list' ? (
          renderListView()
        ) : (
          <>
            {/* Map container - always rendered but may be hidden */}
            <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 1 }} />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-muted/90 flex items-center justify-center" style={{ zIndex: 500 }}>
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground font-poppins">Cargando mapa...</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 bg-muted/90 flex items-center justify-center" style={{ zIndex: 500 }}>
                <div className="text-center space-y-3">
                  <p className="text-muted-foreground font-poppins">❌ {error}</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    Reintentar
                  </Button>
                </div>
              </div>
            )}

            {/* Center on user button */}
            {!isLoading && !error && userLocation && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4 shadow-lg bg-background/95 backdrop-blur-sm"
                style={{ zIndex: 400 }}
                onClick={centerOnUser}
                title="Centrar en mi ubicación"
              >
                <Navigation2 className="h-4 w-4" />
              </Button>
            )}

            {/* Distance Legend */}
            {!isLoading && !error && schoolsWithDistance.length > 0 && (
              <div 
                className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border"
                style={{ zIndex: 400 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <p className="text-xs font-semibold text-foreground font-poppins">
                    {validSchools.length} escuelas
                  </p>
                </div>
                {userLocation && (
                  <div className="space-y-1 max-h-[80px] overflow-y-auto">
                    {schoolsWithDistance.slice(0, 4).map((school) => (
                      <div
                        key={school.id}
                        className={`flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors ${
                          school.id === selectedSchoolId ? 'text-primary font-medium' : ''
                        }`}
                        onClick={() => onSchoolSelect?.(school.id)}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: school.id === selectedSchoolId ? '#FB9F1E' : '#248223' }}
                        />
                        <span className="truncate max-w-[90px]">{school.name}</span>
                        <span className="text-muted-foreground">{school.distance?.toFixed(1)}km</span>
                      </div>
                    ))}
                    {schoolsWithDistance.length > 4 && (
                      <p className="text-xs text-muted-foreground">+{schoolsWithDistance.length - 4} más</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Schools without location warning */}
            {!isLoading && !error && schoolsWithoutLocation.length > 0 && (
              <div 
                className="absolute top-4 left-4 bg-amber-50 dark:bg-amber-950/50 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-amber-200 dark:border-amber-800"
                style={{ zIndex: 400 }}
              >
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ {schoolsWithoutLocation.length} sin ubicación
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom CSS for clustering */}
      <style>{`
        .custom-cluster-icon {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important;
        }
        .leaflet-popup-tip {
          box-shadow: 0 3px 14px rgba(0,0,0,0.1) !important;
        }
        .leaflet-popup-close-button {
          color: #6b7280 !important;
          font-size: 20px !important;
          padding: 8px !important;
        }
        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background: transparent !important;
        }
        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}