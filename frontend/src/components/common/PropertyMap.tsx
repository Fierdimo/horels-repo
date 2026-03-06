/**
 * PropertyMap — read-only map showing a property pin.
 * Uses Leaflet + OpenStreetMap (free, no API key required).
 */
import { useEffect, useRef } from 'react';

let L: typeof import('leaflet');

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

function fixLeafletIcons(leaflet: typeof import('leaflet')) {
  // @ts-ignore
  delete leaflet.Icon.Default.prototype._getIconUrl;
  leaflet.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export default function PropertyMap({ latitude: latProp, longitude: lngProp, name, address }: PropertyMapProps) {
  // Sequelize returns DECIMAL as string — coerce to number
  const latitude  = Number(latProp);
  const longitude = Number(lngProp);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (mapRef.current) return;
    if (!containerRef.current) return;

    import('leaflet').then((leafletModule) => {
      L = leafletModule.default ?? (leafletModule as any);
      fixLeafletIcons(L);

      const map = L.map(containerRef.current!, {
        center: [latitude, longitude],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const popup = [name, address].filter(Boolean).join('<br/>');
      const marker = L.marker([latitude, longitude]).addTo(map);
      if (popup) {
        marker.bindPopup(`<div class="text-sm font-medium">${popup}</div>`, { maxWidth: 220 }).openPopup();
      }

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, name, address]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-gray-200"
      style={{ height: '300px', zIndex: 0 }}
    />
  );
}
