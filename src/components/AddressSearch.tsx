import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AddressResult {
  place_name: string;
  center: [number, number];
  context?: Array<{ id: string; text: string }>;
}

interface AddressSearchProps {
  mapboxToken: string;
  onSelect: (result: {
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    lat: number;
    lng: number;
  }) => void;
}

const AddressSearch = ({ mapboxToken, onSelect }: AddressSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3 || !mapboxToken) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${mapboxToken}&country=au&types=address&limit=5`
      );
      const data = await res.json();
      setResults(data.features || []);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapboxToken]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: AddressResult) => {
    const getContext = (prefix: string) =>
      result.context?.find(c => c.id.startsWith(prefix))?.text || '';

    setQuery(result.place_name);
    setShowResults(false);
    onSelect({
      address: result.place_name,
      suburb: getContext('locality') || getContext('place'),
      state: getContext('region'),
      postcode: getContext('postcode'),
      lat: result.center[1],
      lng: result.center[0],
    });
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
          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => handleSelect(result)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm text-foreground">{result.place_name}</span>
            </button>
          ))}
        </div>
      )}

      {!mapboxToken && (
        <p className="mt-2 text-xs text-destructive">
          Mapbox token required. Add your token to enable address search.
        </p>
      )}
    </div>
  );
};

export default AddressSearch;
