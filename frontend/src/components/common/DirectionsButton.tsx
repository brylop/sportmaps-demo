import { Button } from '@/components/ui/button';
import { Navigation, MapPin } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DirectionsButtonProps {
  latitude: number;
  longitude: number;
  placeName?: string;
  address?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function DirectionsButton({
  latitude,
  longitude,
  placeName = 'Destino',
  address,
  variant = 'default',
  size = 'default',
  className = '',
  showLabel = true,
}: DirectionsButtonProps) {
  const destination = address 
    ? encodeURIComponent(address) 
    : `${latitude},${longitude}`;

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openWaze = () => {
    const url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openAppleMaps = () => {
    const url = `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant}
          size={size}
          className={`gap-2 font-poppins font-semibold ${className}`}
          style={{ backgroundColor: variant === 'default' ? '#FB9F1E' : undefined }}
        >
          <Navigation className="h-4 w-4" />
          {showLabel && 'Cómo llegar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={openGoogleMaps} className="cursor-pointer gap-2">
          <img 
            src="https://www.google.com/images/branding/product/1x/maps_48dp.png" 
            alt="Google Maps" 
            className="h-5 w-5"
          />
          <span className="font-poppins">Google Maps</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openWaze} className="cursor-pointer gap-2">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/1/18/Waze_logo.svg" 
            alt="Waze" 
            className="h-5 w-5"
          />
          <span className="font-poppins">Waze</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openAppleMaps} className="cursor-pointer gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <span className="font-poppins">Apple Maps</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
