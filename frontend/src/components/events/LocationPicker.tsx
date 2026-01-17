import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, X, MapPin } from 'lucide-react';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  onSelect: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
  initialLat?: number;
  initialLng?: number;
}

export function LocationPicker({ onSelect, onClose, initialLat, initialLng }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  // Default center (Colombia)
  const defaultCenter: [number, number] = [initialLat || 4.6097, initialLng || -74.0817];
  const defaultZoom = initialLat ? 15 : 6;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView(defaultCenter, defaultZoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add initial marker if we have coordinates
    if (initialLat && initialLng) {
      const marker = L.marker([initialLat, initialLng]).addTo(map);
      markerRef.current = marker;
      setSelectedLocation({
        lat: initialLat,
        lng: initialLng,
        address: 'Ubicación seleccionada'
      });
    }

    // Click handler to place marker
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Add new marker
      const marker = L.marker([lat, lng]).addTo(map);
      markerRef.current = marker;

      // Reverse geocode
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
        );
        const data = await response.json();
        const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedLocation({ lat, lng, address });
      } catch (error) {
        setSelectedLocation({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=co&limit=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lon);

        // Center map
        mapInstanceRef.current.setView([latNum, lngNum], 15);

        // Add marker
        if (markerRef.current) {
          markerRef.current.remove();
        }
        const marker = L.marker([latNum, lngNum]).addTo(mapInstanceRef.current);
        markerRef.current = marker;

        setSelectedLocation({ lat: latNum, lng: lngNum, address: display_name });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation.lat, selectedLocation.lng, selectedLocation.address);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Seleccionar ubicación
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar dirección..."
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Map */}
      <div 
        ref={mapRef} 
        className="w-full h-64 rounded-lg border mb-4"
      />

      {/* Selected location */}
      {selectedLocation && (
        <div className="bg-muted p-3 rounded-lg mb-4">
          <p className="text-sm font-medium">Ubicación seleccionada:</p>
          <p className="text-sm text-muted-foreground truncate">{selectedLocation.address}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={!selectedLocation}>
          Confirmar ubicación
        </Button>
      </div>
    </Card>
  );
}
