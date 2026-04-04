import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AddressSearchProps {
  onSelect: (result: {
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    lat: number;
    lng: number;
  }) => void;
}

const AddressSearch = ({ onSelect }: AddressSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (window.google?.maps?.places) {
      serviceRef.current = new google.maps.places.AutocompleteService();
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, []);

  // Retry init when google becomes available
  useEffect(() => {
    if (serviceRef.current) return;
    const interval = setInterval(() => {
      if (window.google?.maps?.places) {
        serviceRef.current = new google.maps.places.AutocompleteService();
        geocoderRef.current = new google.maps.Geocoder();
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3 || !serviceRef.current) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await serviceRef.current.getPlacePredictions({
        input: q,
        componentRestrictions: { country: 'au' },
        types: ['address'],
      });
      setResults(response?.predictions || []);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    setQuery(prediction.description);
    setShowResults(false);

    if (!geocoderRef.current) return;

    try {
      const response = await geocoderRef.current.geocode({ placeId: prediction.place_id });
      const result = response.results[0];
      if (!result) return;

      const getComponent = (type: string) =>
        result.address_components.find(c => c.types.includes(type))?.long_name || '';

      onSelect({
        address: result.formatted_address,
        suburb: getComponent('locality') || getComponent('sublocality'),
        state: getComponent('administrative_area_level_1'),
        postcode: getComponent('postal_code'),
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
      });
    } catch {
      // Geocode failed silently
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search your property address..."
          className="h-12 rounded-xl border-border bg-card pl-11 pr-10 text-base shadow-card transition-shadow focus:shadow-card-hover"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-card shadow-elevated">
          {results.map((prediction) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm text-foreground">{prediction.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressSearch;
