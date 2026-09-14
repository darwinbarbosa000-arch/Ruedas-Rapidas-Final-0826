import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, LocateFixed, MapPin } from 'lucide-react';

// Iconos personalizados de Leaflet con diseño limpio y alta visibilidad
const createCustomIcon = (emoji: string, bgColor: string = '#10B981', label?: string) => {
  const html = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      user-select: none;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    ">
      <div style="
        background-color: ${bgColor};
        color: white;
        padding: 5px 9px;
        border-radius: 16px;
        border: 2px solid #ffffff;
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      ">
        <span style="font-size: 14px; line-height: 1;">${emoji}</span>
        ${label ? `<span style="letter-spacing: -0.2px;">${label}</span>` : ''}
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid ${bgColor};
        margin-top: -1px;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-pin',
    iconSize: [120, 44],
    iconAnchor: [60, 44],
    popupAnchor: [0, -44],
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
  className = 'h-full w-full min-h-[280px]',
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

  // Función para re-centrar la vista en el conductor o en la ruta
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;

    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) {
      map.flyTo([driverPos.lat, driverPos.lng], 16, { animate: true, duration: 1 });
      return;
    }

    const points: [number, number][] = [];
    if (origen && !isNaN(origen.lat)) points.push([origen.lat, origen.lng]);
    if (destino && !isNaN(destino.lat)) points.push([destino.lat, destino.lng]);
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (points.length === 1) {
      map.flyTo(points[0], 15);
    }
  };

  // Inicializar mapa de OpenStreetMap con Leaflet
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      try {
        const initialLat = center && !isNaN(center.lat) ? center.lat : FUSA_DEFAULT.lat;
        const initialLng = center && !isNaN(center.lng) ? center.lng : FUSA_DEFAULT.lng;

        const map = L.map(containerRef.current, {
          center: [initialLat, initialLng],
          zoom: zoom,
          zoomControl: false, // Usamos controles personalizados o añadimos zoom arriba a la derecha
        });

        // Controles de zoom compactos arriba a la derecha
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Capa de tiles OpenStreetMap estándar
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        }).addTo(map);

        mapRef.current = map;

        // Leaflet requiere invalidateSize tras el renderizado de contenedores dinámicos/modales
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 100);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 400);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 1000);
      } catch (e) {
        console.warn('LeafletMap init error:', e);
      }
    }

    // Observer para recalcular dimensiones automáticamente ante cualquier redimensionamiento del modal
    const currentContainer = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && currentContainer) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(currentContainer);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
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

  // Manejar clics en el mapa para seleccionar origen/destino si aplica
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

  // Actualizar marcadores, conductor en vivo y polilínea de ruta
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Asegurar tamaño válido de mapa
    map.invalidateSize();

    // 1. Actualizar Marcador de Origen
    if (origen && typeof origen.lat === 'number' && !isNaN(origen.lat) && typeof origen.lng === 'number' && !isNaN(origen.lng)) {
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

    // 2. Actualizar Marcador de Destino
    if (destino && typeof destino.lat === 'number' && !isNaN(destino.lat) && typeof destino.lng === 'number' && !isNaN(destino.lng)) {
      if (!destinoMarkerRef.current) {
        destinoMarkerRef.current = L.marker([destino.lat, destino.lng], {
          icon: createCustomIcon('🔴', '#E11D48', 'Destino'),
        }).addTo(map);
      } else {
        destinoMarkerRef.current.setLatLng([destino.lat, destino.lng]);
      }
      destinoMarkerRef.current.bindPopup(`<b>🔴 Punto de Llegada</b><br/>${destino.address || 'Destino'}`);
    } else if (destinoMarkerRef.current) {
      map.removeLayer(destinoMarkerRef.current);
      destinoMarkerRef.current = null;
    }

    // 3. Actualizar Marcador del Conductor en Tiempo Real
    if (driverPos && typeof driverPos.lat === 'number' && !isNaN(driverPos.lat) && typeof driverPos.lng === 'number' && !isNaN(driverPos.lng)) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], {
          icon: createCustomIcon('🚕', '#2563EB', driverName),
          zIndexOffset: 1000, // Siempre visible por encima
        }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
      }
      driverMarkerRef.current.bindPopup(`<b>🚕 Conductor en Vivo</b><br/>${driverName}`);
    } else if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }

    // 4. Trazar línea de ruta y encuadrar
    if (showRoute) {
      const points: [number, number][] = [];
      if (driverPos && !isNaN(driverPos.lat)) points.push([driverPos.lat, driverPos.lng]);
      if (origen && !isNaN(origen.lat)) points.push([origen.lat, origen.lng]);
      if (destino && !isNaN(destino.lat)) points.push([destino.lat, destino.lng]);

      if (points.length >= 2) {
        if (!polylineRef.current) {
          polylineRef.current = L.polyline(points, {
            color: '#10B981',
            weight: 4,
            opacity: 0.85,
            dashArray: '6, 8',
          }).addTo(map);
        } else {
          polylineRef.current.setLatLngs(points);
        }

        try {
          const bounds = L.latLngBounds(points);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          }
        } catch (e) {
          console.warn('fitBounds error:', e);
        }
      } else if (points.length === 1) {
        map.panTo(points[0]);
      }
    }
  }, [origen, destino, driverPos, driverName, showRoute]);

  // Centrar mapa dinámicamente si cambia el centro explícito
  useEffect(() => {
    if (mapRef.current && center && typeof center.lat === 'number' && !isNaN(center.lat) && typeof center.lng === 'number' && !isNaN(center.lng)) {
      mapRef.current.panTo([center.lat, center.lng]);
    }
  }, [center?.lat, center?.lng]);

  return (
    <div className="relative w-full h-full min-h-[280px] bg-slate-100 overflow-hidden">
      {/* Contenedor del mapa Leaflet con dimensiones forzadas */}
      <div 
        ref={containerRef} 
        className={`w-full h-full min-h-[280px] ${className}`} 
        style={{ width: '100%', height: '100%', minHeight: '280px' }} 
      />

      {/* Botón flotante para centrar la vista */}
      <button
        type="button"
        onClick={handleRecenter}
        className="absolute bottom-3 right-3 z-[400] bg-white hover:bg-slate-50 text-slate-800 p-2 rounded-xl shadow-md border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5 text-[10px] font-bold cursor-pointer"
        title="Centrar ruta"
      >
        <LocateFixed size={14} className="text-emerald-600" />
        <span className="hidden sm:inline">Centrar</span>
      </button>

      {geocoding && (
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 shadow-lg border border-slate-200 flex items-center gap-2 z-[400]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          Obteniendo dirección...
        </div>
      )}
    </div>
  );
};
