import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

// Iconos personalizados de Leaflet con SVG / Emojis de alta resolución
const createCustomIcon = (emoji: string, bgColor: string = '#10B981', label?: string) => {
  const html = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
    ">
      <div style="
        background-color: ${bgColor};
        color: white;
        padding: 6px 10px;
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid white;
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: sans-serif;
        font-size: 12px;
        font-weight: bold;
        white-space: nowrap;
      ">
        <span>${emoji}</span>
        ${label ? `<span>${label}</span>` : ''}
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${bgColor};
        margin-top: -1px;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export interface MapPoint {
  lat: number;
  lng: number;
  address?: string;
}

interface LeafletMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  origen?: MapPoint | null;
  destino?: MapPoint | null;
  driverPos?: MapPoint | null;
  driverName?: string;
  mode?: 'origen' | 'destino' | 'view';
  onPointSelect?: (point: MapPoint, mode: 'origen' | 'destino') => void;
  showRoute?: boolean;
  className?: string;
}

const FUSA_DEFAULT = { lat: 4.3364, lng: -74.3638 };

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = FUSA_DEFAULT,
  zoom = 14,
  origen,
  destino,
  driverPos,
  driverName = 'Conductor',
  mode = 'view',
  onPointSelect,
  showRoute = true,
  className = 'h-[380px] w-full rounded-3xl overflow-hidden shadow-lg border border-slate-200',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const origenMarkerRef = useRef<L.Marker | null>(null);
  const destinoMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [geocoding, setGeocoding] = useState(false);

  // Reverse geocoding gratis con Nominatim
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: {
          'Accept-Language': 'es-CO,es;q=0.9',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 3).join(', ');
        }
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
    return `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current && containerRef.current) {
      try {
        const initialCenter = center && !isNaN(center.lat) ? [center.lat, center.lng] as [number, number] : [FUSA_DEFAULT.lat, FUSA_DEFAULT.lng] as [number, number];
        const map = L.map(containerRef.current, {
          center: initialCenter,
          zoom: zoom,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
      } catch (e) {
        console.warn('LeafletMap init error:', e);
      }
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('Error removing LeafletMap:', e);
        }
        mapRef.current = null;
        origenMarkerRef.current = null;
        destinoMarkerRef.current = null;
        driverMarkerRef.current = null;
        polylineRef.current = null;
      }
    };
  }, []);

  // Manejar clics en el mapa para seleccionar origen/destino
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (mode === 'view' || !onPointSelect) return;

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setGeocoding(false);

      onPointSelect({ lat, lng, address }, mode);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mode, onPointSelect, reverseGeocode]);

  // Actualizar marcadores y centro
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Actualizar Origen
    if (origen && !isNaN(origen.lat) && !isNaN(origen.lng)) {
      if (!origenMarkerRef.current) {
        origenMarkerRef.current = L.marker([origen.lat, origen.lng], {
          icon: createCustomIcon('🟢', '#059669', 'Origen'),
        }).addTo(map);
      } else {
        origenMarkerRef.current.setLatLng([origen.lat, origen.lng]);
      }
      origenMarkerRef.current.bindPopup(`<b>🟢 Punto de Recogida</b><br/>${origen.address || 'Origen'}`);
    } else if (origenMarkerRef.current) {
      map.removeLayer(origenMarkerRef.current);
      origenMarkerRef.current = null;
    }

    // Actualizar Destino
    if (destino && !isNaN(destino.lat) && !isNaN(destino.lng)) {
      if (!destinoMarkerRef.current) {
        destinoMarkerRef.current = L.marker([destino.lat, destino.lng], {
          icon: createCustomIcon('🔴', '#E11D48', 'Destino'),
        }).addTo(map);
      } else {
        destinoMarkerRef.current.setLatLng([destino.lat, destino.lng]);
      }
      destinoMarkerRef.current.bindPopup(`<b>🔴 Punto de LLegada</b><br/>${destino.address || 'Destino'}`);
    } else if (destinoMarkerRef.current) {
      map.removeLayer(destinoMarkerRef.current);
      destinoMarkerRef.current = null;
    }

    // Actualizar Conductor
    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], {
          icon: createCustomIcon('🚕', '#2563EB', driverName),
        }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
      }
      driverMarkerRef.current.bindPopup(`<b>🚕 Conductor en Vivo</b><br/>${driverName}`);
    } else if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }

    // Trazar línea de ruta si aplica
    if (showRoute) {
      const points: [number, number][] = [];
      if (driverPos && !isNaN(driverPos.lat)) points.push([driverPos.lat, driverPos.lng]);
      if (origen && !isNaN(origen.lat)) points.push([origen.lat, origen.lng]);
      if (destino && !isNaN(destino.lat)) points.push([destino.lat, destino.lng]);

      if (points.length >= 2) {
        if (!polylineRef.current) {
          polylineRef.current = L.polyline(points, {
            color: '#059669',
            weight: 5,
            opacity: 0.8,
            dashArray: '8, 8',
          }).addTo(map);
        } else {
          polylineRef.current.setLatLngs(points);
        }

        // Ajustar zoom para mostrar todos los puntos
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [origen, destino, driverPos, driverName, showRoute]);

  // Centrar mapa dinámicamente si cambia el centro
  useEffect(() => {
    if (mapRef.current && center && !isNaN(center.lat) && !isNaN(center.lng)) {
      mapRef.current.panTo([center.lat, center.lng]);
    }
  }, [center]);

  return (
    <div className="relative w-full">
      <div ref={containerRef} className={className} />
      {geocoding && (
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 shadow-lg border border-slate-200 flex items-center gap-2 z-[1000]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          Obteniendo dirección...
        </div>
      )}
    </div>
  );
};
