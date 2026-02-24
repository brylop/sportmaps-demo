import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, X } from 'lucide-react';

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

interface LocationAutocompleteProps {
    value: string;
    onChange: (address: string) => void;
    placeholder?: string;
    className?: string;
}

export function LocationAutocomplete({
    value,
    onChange,
    placeholder = 'Buscar dirección...',
    className,
}: LocationAutocompleteProps) {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync external value
    useEffect(() => {
        setQuery(value);
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchNominatim = useCallback(async (q: string) => {
        if (q.length < 3) {
            setResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const url = `/api/nominatim/search?format=json&q=${encodeURIComponent(q)}&countrycodes=co&limit=5&addressdetails=1`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data: NominatimResult[] = await resp.json();
            setResults(data);
            setShowDropdown(data.length > 0);
        } catch {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleInputChange = (val: string) => {
        setQuery(val);
        onChange(val);

        // Debounce search (800ms to respect Nominatim rate limits)
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchNominatim(val), 800);
    };

    const handleSelect = (result: NominatimResult) => {
        const short = result.display_name.split(',').slice(0, 3).join(',').trim();
        setQuery(short);
        onChange(short);
        setShowDropdown(false);
        setResults([]);
    };

    const handleClear = () => {
        setQuery('');
        onChange('');
        setResults([]);
        setShowDropdown(false);
    };

    return (
        <div ref={wrapperRef} className={`relative ${className || ''}`}>
            <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    value={query}
                    onChange={e => handleInputChange(e.target.value)}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    placeholder={placeholder}
                    className="pl-8 pr-8"
                />
                {isSearching && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!isSearching && query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    {results.map((r) => (
                        <button
                            key={r.place_id}
                            type="button"
                            onClick={() => handleSelect(r)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/60 transition-colors flex items-start gap-2 border-b last:border-b-0 border-border/30"
                        >
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                            <span className="text-muted-foreground leading-tight line-clamp-2">
                                {r.display_name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
