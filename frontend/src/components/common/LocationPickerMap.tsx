/**
 * LocationPickerMap — interactive map for selecting/confirming property location.
 * Uses Leaflet + OpenStreetMap (free, no API key) and Nominatim for geocoding.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Leaflet is loaded dynamically to avoid SSR issues
let L: typeof import('leaflet');

interface LatLng {
  lat: number;
  lng: number;
}

interface LocationPickerMapProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  onChange: (lat: number, lng: number) => void;
}

// Fix Leaflet default icon paths when bundled with Vite
function fixLeafletIcons(leaflet: typeof import('leaflet')) {
  // @ts-ignore
  delete leaflet.Icon.Default.prototype._getIconUrl;
  leaflet.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/** Call Nominatim to geocode a free-text query */
async function geocodeAddress(query: string): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es,en', 'User-Agent': 'HotelsApp/1.0' },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('Nominatim geocode error:', e);
  }
  return null;
}

export default function LocationPickerMap({
  latitude: latitudeProp,
  longitude: longitudeProp,
  address,
  city,
  region,
  country,
  onChange,
}: LocationPickerMapProps) {
  // Sequelize returns DECIMAL as string — coerce to number
  const latitude  = latitudeProp  != null ? Number(latitudeProp)  : null;
  const longitude = longitudeProp != null ? Number(longitudeProp) : null;
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [hasLocation, setHasLocation] = useState(!!(latitude && longitude));

  const defaultCenter: LatLng = { lat: 40.4168, lng: -3.7038 }; // Madrid as default

  // Initialize map once
  useEffect(() => {
    if (mapRef.current) return; // already initialized
    if (!mapContainerRef.current) return;

    import('leaflet').then((leafletModule) => {
      L = leafletModule.default ?? (leafletModule as any);
      fixLeafletIcons(L);

      const initialCenter: LatLng =
        latitude && longitude ? { lat: latitude, lng: longitude } : defaultCenter;

      const map = L.map(mapContainerRef.current!, {
        center: [initialCenter.lat, initialCenter.lng],
        zoom: latitude && longitude ? 14 : 5,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add marker if coords already exist
      if (latitude && longitude) {
        const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }

      // Click on map → place/move marker
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onChange(pos.lat, pos.lng);
          });
          markerRef.current = marker;
        }
        onChange(lat, lng);
        setHasLocation(true);
        setGeocodeError(null);
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // intentionally empty — runs once

  // Update marker when external lat/lng changes (e.g. after geocoding)
  useEffect(() => {
    if (!mapRef.current || !L) return;
    if (!latitude || !longitude) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      const marker = L.marker([latitude, longitude], { draggable: true }).addTo(mapRef.current);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }
    mapRef.current.setView([latitude, longitude], 14);
    setHasLocation(true);
  }, [latitude, longitude]);

  const handleGeocode = useCallback(async () => {
    const query = [address, city, region, country].filter(Boolean).join(', ');
    if (!query.trim()) {
      setGeocodeError(t('map.geocodeEmptyError', 'Fill in address, city, or country first'));
      return;
    }
    setIsGeocoding(true);
    setGeocodeError(null);
    const result = await geocodeAddress(query);
    setIsGeocoding(false);
    if (result) {
      onChange(result.lat, result.lng);
    } else {
      setGeocodeError(t('map.geocodeNotFound', 'Could not find this address. Try clicking on the map.'));
    }
  }, [address, city, region, country, onChange, t]);

  const handleClear = () => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setHasLocation(false);
    onChange(0, 0);
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleGeocode}
          disabled={isGeocoding}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isGeocoding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {t('map.geocodeButton', 'Find on map')}
        </button>

        {hasLocation && latitude && longitude && (
          <>
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5" />
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              title={t('map.clearLocation', 'Clear location')}
            >
              <X className="h-3.5 w-3.5" />
              {t('map.clearLocation', 'Clear')}
            </button>
          </>
        )}
      </div>

      {geocodeError && (
        <p className="text-xs text-red-600">{geocodeError}</p>
      )}

      <p className="text-xs text-gray-500">
        {t('map.clickHint', 'Click on the map or drag the pin to set the exact location')}
      </p>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ height: '300px', zIndex: 0 }}
      />
    </div>
  );
}
