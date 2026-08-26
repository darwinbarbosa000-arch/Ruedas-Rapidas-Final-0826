import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GoogleMap, MarkerF, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import L from 'leaflet';
import { useMapContext } from './MapProvider';

export interface MapPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface MapComponentProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  origen?: MapPoint | null;
  destino?: MapPoint | null;
  driverPos?: MapPoint | null;
  driverName?: string;
  vehicleType?: string;
  mode?: 'origen' | 'destino' | 'view';
  onPointSelect?: (point: MapPoint, mode: 'origen' | 'destino') => void;
  showRoute?: boolean;
  className?: string;
  allowLayerSwitch?: boolean;
}

// Coordenadas predeterminadas de Colombia (Fusagasugá / Región Central)
const DEFAULT_CENTER = { lat: 4.3364, lng: -74.3638 };

// Caché en memoria para evitar saturar servicios públicos de Nominatim y OSRM (Soporte miles de usuarios concurrentes)
const geocodeCache = new Map<string, string>();
const routeCache = new Map<string, { coords: [number, number][]; distanceKm: string; durationMin: string }>();

// Validación ultra-segura de coordenadas
export const isValidPos = (pos: any): pos is { lat: number; lng: number } => {
  return (
    pos !== null &&
    pos !== undefined &&
    typeof pos.lat === 'number' &&
    typeof pos.lng === 'number' &&
    !isNaN(pos.lat) &&
    !isNaN(pos.lng) &&
    pos.lat >= -90 &&
    pos.lat <= 90 &&
    pos.lng >= -180 &&
    pos.lng <= 180
  );
};

// Cálculo matemático de distancia Haversine en kilómetros
export const calculateHaversineKm = (
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

// Generador de emoji representativo del vehículo
export const getVehicleEmoji = (vehicleType?: string): string => {
  if (!vehicleType) return '🚗';
  const typeLower = vehicleType.toLowerCase();
  if (typeLower.includes('moto') || typeLower.includes('motorcycle')) return '🏍️';
  if (typeLower.includes('taxi')) return '🚕';
  if (typeLower.includes('camion') || typeLower.includes('flete') || typeLower.includes('acarreo')) return '🚚';
  if (typeLower.includes('motocarro') || typeLower.includes('mototaxi')) return '🛺';
  return '🚗';
};

// Generador de Icono Leaflet para Conductor (Diseño de Alto Contraste con efecto pulso GPS)
const createDriverLeafletIcon = (vehicleType?: string, label: string = 'Conductor') => {
  const emoji = getVehicleEmoji(vehicleType);

  const html = `
    <div class="driver-marker-container" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
    ">
      <!-- Badge de Conductor -->
      <div style="
        background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
        color: #ffffff;
        padding: 5px 11px;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45), 0 1px 3px rgba(0,0,0,0.3);
        border: 2px solid #ffffff;
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
        letter-spacing: -0.01em;
      ">
        <span style="font-size: 14px; line-height: 1;">${emoji}</span>
        <span style="color: #ffffff; font-size: 11px; font-weight: 800; max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${label}</span>
      </div>

      <!-- Flecha Indicadora -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid #2563eb;
        margin-top: -1px;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));
      "></div>

      <!-- Radar de Pulso GPS Azul -->
      <div style="
        position: relative;
        width: 12px;
        height: 12px;
        margin-top: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background-color: #3b82f6;
          border-radius: 50%;
          opacity: 0.75;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 8px;
          height: 8px;
          background-color: #1d4ed8;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-driver-marker-wrapper',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Generador de Iconos Leaflet para Origen / Destino
const createLocationLeafletIcon = (emoji: string, bgColor: string, label: string, isPickup: boolean = false) => {
  const html = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
    ">
      <div style="
        background: ${bgColor};
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 9999px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid #ffffff;
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 10.5px;
        font-weight: 800;
        white-space: nowrap;
      ">
        <span style="font-size: 12px; line-height: 1;">${emoji}</span>
        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${label}</span>
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid ${bgColor};
        margin-top: -1px;
      "></div>
      ${
        isPickup
          ? `
        <div style="
          width: 8px;
          height: 8px;
          background-color: #10b981;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
          margin-top: 1px;
        "></div>
      `
          : `
        <div style="
          width: 8px;
          height: 8px;
          background-color: #f43f5e;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.4);
          margin-top: 1px;
        "></div>
      `
      }
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-location-marker-wrapper',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const MapComponent: React.FC<MapComponentProps> = ({
  center = DEFAULT_CENTER,
  zoom = 14,
  origen,
  destino,
  driverPos,
  driverName = 'Conductor',
  vehicleType,
  mode = 'view',
  onPointSelect,
  showRoute = true,
  className = 'w-full h-[380px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative',
  allowLayerSwitch = true,
}) => {
  const { isGoogleMaps } = useMapContext();

  // Tipo de mapa OpenStreetMap: 'standard' (OSM Carto/Voyager) o 'satellite' (Esri World Imagery)
  const [tileMode, setTileMode] = useState<'standard' | 'satellite'>('standard');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: string; durationMin: string } | null>(null);

  // Refs de Contenedores y Mapas
  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Capas de Marcadores y Rutas en Leaflet
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Refs de Google Maps
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const googleDirectionsRequestedRef = useRef(false);

  // AbortController para cancelar peticiones pendientes si el usuario hace clics rápidos
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calcular centro efectivo inteligente
  const effectiveCenter = useMemo(() => {
    if (isValidPos(driverPos) && isValidPos(origen)) {
      return {
        lat: (driverPos.lat + origen.lat) / 2,
        lng: (driverPos.lng + origen.lng) / 2,
      };
    }
    if (isValidPos(origen) && isValidPos(destino)) {
      return {
        lat: (origen.lat + destino.lat) / 2,
        lng: (origen.lng + destino.lng) / 2,
      };
    }
    if (isValidPos(origen)) return origen;
    if (isValidPos(driverPos)) return driverPos;
    if (isValidPos(destino)) return destino;
    if (isValidPos(center)) return center;
    return DEFAULT_CENTER;
  }, [driverPos, origen, destino, center]);

  // Geocodificación inversa robusta con caché local y auto-fallback
  const reverseGeocodeSafe = useCallback(async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      // Intento 1: Nominatim OpenStreetMap con timeout corto
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es-CO,es;q=0.9',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          const formatted = parts.slice(0, 3).join(', ').trim();
          if (formatted) {
            geocodeCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      }
    } catch {
      // Si Nominatim falla por rate limit o timeout, pasamos al fallback limpio
    }

    const fallbackAddr = `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    geocodeCache.set(cacheKey, fallbackAddr);
    return fallbackAddr;
  }, []);

  // Cálculo de ruta OSRM con fallback matemático de alta resiliencia
  const fetchRouteSafe = useCallback(
    async (
      originPt: { lat: number; lng: number },
      destPt: { lat: number; lng: number }
    ): Promise<{ coords: [number, number][]; distanceKm: string; durationMin: string }> => {
      const cacheKey = `${originPt.lat.toFixed(4)},${originPt.lng.toFixed(4)}_${destPt.lat.toFixed(4)},${destPt.lng.toFixed(4)}`;
      if (routeCache.has(cacheKey)) {
        return routeCache.get(cacheKey)!;
      }

      // Distancia directa como baseline
      const directDist = calculateHaversineKm(originPt, destPt);
      // Factor de corrección vial en Colombia (rutas curvas urbanas/rurales +25% distancia)
      const roadDistKm = (directDist * 1.25).toFixed(1);
      // Velocidad promedio urbana/rural en Colombia ~26 km/h
      const estMin = Math.max(2, Math.round((Number(roadDistKm) / 26) * 60));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2800);

        const url = `https://router.project-osrm.org/route/v1/driving/${originPt.lng},${originPt.lat};${destPt.lng},${destPt.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            const distKm = (route.distance / 1000).toFixed(1);
            const durMin = Math.max(1, Math.round(route.duration / 60)).toString();

            const result = {
              coords,
              distanceKm: `${distKm} km`,
              durationMin: `${durMin} min`,
            };
            routeCache.set(cacheKey, result);
            return result;
          }
        }
      } catch {
        // Fallback suave sin errores
      }

      // Fallback matemático: Generar línea de interpolación suave entre los dos puntos
      const steps = 10;
      const interpolatedCoords: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = originPt.lat + (destPt.lat - originPt.lat) * t;
        const lng = originPt.lng + (destPt.lng - originPt.lng) * t;
        interpolatedCoords.push([lat, lng]);
      }

      const fallbackResult = {
        coords: interpolatedCoords,
        distanceKm: `${roadDistKm} km`,
        durationMin: `${estMin} min`,
      };
      routeCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    },
    []
  );

  // Inicializar Leaflet Map con verificación anti-doble inicialización y soporte de capas
  useEffect(() => {
    if (isGoogleMaps || !leafletContainerRef.current) return;

    const container = leafletContainerRef.current;

    // Limpiar si existía una instancia previa huérfana en el contenedor DOM
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    try {
      const initialLat = effectiveCenter.lat;
      const initialLng = effectiveCenter.lng;

      const map = L.map(container, {
        center: [initialLat, initialLng],
        zoom: zoom,
        zoomControl: false, // Usamos controles personalizados más elegantes y táctiles
        attributionControl: false,
      });

      // Capa de mosaicos (CartoDB Voyager / OpenStreetMap CDN para alta concurrencia)
      const tileUrl =
        tileMode === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        subdomains: 'abcd',
        maxNativeZoom: 19,
        maxZoom: 20,
        crossOrigin: true,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Grupo de capas para marcadores
      const markerGroup = L.layerGroup().addTo(map);
      markerGroupRef.current = markerGroup;

      leafletMapRef.current = map;

      // InvalidateSize para prevenir pantallas grises al renderizar en tabs o modales
      setTimeout(() => {
        if (leafletMapRef.current) {
          leafletMapRef.current.invalidateSize();
        }
      }, 150);
    } catch (err) {
      console.warn('Error inicializando OpenStreetMap Leaflet:', err);
    }

    // ResizeObserver para mantener el mapa siempre adaptado a cualquier cambio de tamaño de contenedor
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        if (leafletMapRef.current) {
          leafletMapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch {}
        leafletMapRef.current = null;
        markerGroupRef.current = null;
        polylineRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [isGoogleMaps]);

  // Actualizar capa de mosaicos al cambiar entre Estándar y Satelital
  useEffect(() => {
    if (isGoogleMaps || !leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (tileLayerRef.current) {
      try {
        map.removeLayer(tileLayerRef.current);
      } catch {}
    }

    const tileUrl =
      tileMode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const newTileLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxNativeZoom: 19,
      maxZoom: 20,
      crossOrigin: true,
    }).addTo(map);

    // Asegurar que la capa de mosaicos quede al fondo
    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  }, [tileMode, isGoogleMaps]);

  // Manejador de Clics en Leaflet (Selección ágil de origen / destino)
  useEffect(() => {
    if (isGoogleMaps || !leafletMapRef.current) return;
    const map = leafletMapRef.current;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (mode === 'view' || !onPointSelect) return;

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (!isValidPos({ lat, lng })) return;

      setIsGeocoding(true);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const address = await reverseGeocodeSafe(lat, lng);
      setIsGeocoding(false);

      onPointSelect({ lat, lng, address }, mode);
    };

    map.on('click', handleMapClick);
    return () => {
      try {
        map.off('click', handleMapClick);
      } catch {}
    };
  }, [isGoogleMaps, mode, onPointSelect, reverseGeocodeSafe]);

  // Sincronización continua de Marcadores, Conductor en Vivo y Trazado de Ruta
  useEffect(() => {
    if (isGoogleMaps || !leafletMapRef.current || !markerGroupRef.current) return;
    const map = leafletMapRef.current;
    const markerGroup = markerGroupRef.current;

    markerGroup.clearLayers();

    const activeBoundsPoints: [number, number][] = [];

    // 1. Marcador Origen (Punto de Recogida)
    if (isValidPos(origen)) {
      const pickupLabel = origen.address ? origen.address.slice(0, 24) : 'Punto de Recogida';
      const origenIcon = createLocationLeafletIcon('🟢', '#059669', `Recogida: ${pickupLabel}`, true);
      const marker = L.marker([origen.lat, origen.lng], { icon: origenIcon }).addTo(markerGroup);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 2px;">
          <b style="color: #059669;">🟢 PUNTO DE RECOGIDA</b><br/>
          <span style="font-size: 11px; color: #334155;">${origen.address || 'Ubicación de usuario'}</span>
        </div>
      `);
      activeBoundsPoints.push([origen.lat, origen.lng]);
    }

    // 2. Marcador Destino (Punto Final)
    if (isValidPos(destino)) {
      const destLabel = destino.address ? destino.address.slice(0, 24) : 'Destino';
      const destinoIcon = createLocationLeafletIcon('🔴', '#e11d48', `Destino: ${destLabel}`, false);
      const marker = L.marker([destino.lat, destino.lng], { icon: destinoIcon }).addTo(markerGroup);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 2px;">
          <b style="color: #e11d48;">🔴 DESTINO FINAL</b><br/>
          <span style="font-size: 11px; color: #334155;">${destino.address || 'Punto de llegada'}</span>
        </div>
      `);
      activeBoundsPoints.push([destino.lat, destino.lng]);
    }

    // 3. Marcador Conductor en Tiempo Real
    if (isValidPos(driverPos)) {
      const dLabel = driverName || 'Conductor';
      const driverIcon = createDriverLeafletIcon(vehicleType, dLabel);
      const marker = L.marker([driverPos.lat, driverPos.lng], { icon: driverIcon, zIndexOffset: 1000 }).addTo(
        markerGroup
      );
      const emoji = getVehicleEmoji(vehicleType);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 2px;">
          <b style="color: #2563eb;">${emoji} ${dLabel}</b><br/>
          <span style="font-size: 11px; color: #10b981; font-weight: bold;">● GPS en tiempo real</span>
        </div>
      `);
      activeBoundsPoints.push([driverPos.lat, driverPos.lng]);
    }

    // 4. Trazado de Ruta
    if (showRoute) {
      // Definir puntos de ruta: Conductor -> Origen -> Destino
      const startPt = isValidPos(driverPos) ? driverPos : isValidPos(origen) ? origen : null;
      const endPt = isValidPos(destino) ? destino : isValidPos(origen) && startPt !== origen ? origen : null;

      if (startPt && endPt && (startPt.lat !== endPt.lat || startPt.lng !== endPt.lng)) {
        fetchRouteSafe(startPt, endPt).then((res) => {
          if (!leafletMapRef.current || leafletMapRef.current !== map) return;

          setRouteInfo({
            distanceKm: res.distanceKm,
            durationMin: res.durationMin,
          });

          if (polylineRef.current) {
            try {
              map.removeLayer(polylineRef.current);
            } catch {}
          }

          const polyline = L.polyline(res.coords, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          polylineRef.current = polyline;
        });
      } else {
        if (polylineRef.current) {
          try {
            map.removeLayer(polylineRef.current);
          } catch {}
          polylineRef.current = null;
        }
        setRouteInfo(null);
      }
    }

    // Ajustar límites de vista si hay puntos activos
    if (activeBoundsPoints.length > 1) {
      try {
        const bounds = L.latLngBounds(activeBoundsPoints);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      } catch {}
    } else if (activeBoundsPoints.length === 1) {
      map.panTo(activeBoundsPoints[0]);
    }
  }, [isGoogleMaps, origen, destino, driverPos, driverName, vehicleType, showRoute, fetchRouteSafe]);

  // Controles Táctiles y de Centrado de Cámara
  const handleCenterUser = useCallback(() => {
    if (!isValidPos(origen)) return;
    if (isGoogleMaps && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: origen.lat, lng: origen.lng });
      googleMapRef.current.setZoom(16);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([origen.lat, origen.lng], 16, { duration: 0.8 });
    }
  }, [isGoogleMaps, origen]);

  const handleCenterDriver = useCallback(() => {
    if (!isValidPos(driverPos)) return;
    if (isGoogleMaps && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: driverPos.lat, lng: driverPos.lng });
      googleMapRef.current.setZoom(16);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([driverPos.lat, driverPos.lng], 16, { duration: 0.8 });
    }
  }, [isGoogleMaps, driverPos]);

  const handleFitAll = useCallback(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (isValidPos(driverPos)) pts.push(driverPos);
    if (isValidPos(origen)) pts.push(origen);
    if (isValidPos(destino)) pts.push(destino);

    if (pts.length === 0) return;

    if (isGoogleMaps && googleMapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      googleMapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    } else if (leafletMapRef.current) {
      if (pts.length === 1) {
        leafletMapRef.current.flyTo([pts[0].lat, pts[0].lng], 15);
      } else {
        const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
        leafletMapRef.current.fitBounds(bounds, { padding: [45, 45] });
      }
    }
  }, [isGoogleMaps, driverPos, origen, destino]);

  const handleZoomIn = () => {
    if (leafletMapRef.current) leafletMapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (leafletMapRef.current) leafletMapRef.current.zoomOut();
  };

  // Google Maps Directions Callback (Compatibilidad si el usuario activa Google Maps con API Key válida)
  const directionsCallback = useCallback(
    (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
      if (status === 'OK' && result) {
        setDirectionsResponse(result);
        const leg = result.routes[0]?.legs[0];
        if (leg) {
          setRouteInfo({
            distanceKm: leg.distance?.text || '',
            durationMin: leg.duration?.text || '',
          });
        }
      } else {
        googleDirectionsRequestedRef.current = false;
      }
    },
    []
  );

  const routeOrigin = isValidPos(driverPos) ? driverPos : isValidPos(origen) ? origen : null;
  const routeDestination = isValidPos(destino) ? destino : isValidPos(origen) ? origen : null;

  return (
    <div className={`${className} select-none`}>
      {isGoogleMaps ? (
        <GoogleMap
          onLoad={(map) => {
            googleMapRef.current = map;
            if (isValidPos(driverPos) && isValidPos(origen)) {
              const bounds = new google.maps.LatLngBounds();
              bounds.extend({ lat: driverPos.lat, lng: driverPos.lng });
              bounds.extend({ lat: origen.lat, lng: origen.lng });
              if (isValidPos(destino)) bounds.extend({ lat: destino.lat, lng: destino.lng });
              map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
            }
          }}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={effectiveCenter}
          zoom={zoom}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {showRoute && isValidPos(routeOrigin) && isValidPos(routeDestination) && !directionsResponse && (
            <DirectionsService
              options={{
                origin: { lat: routeOrigin.lat, lng: routeOrigin.lng },
                destination: { lat: routeDestination.lat, lng: routeDestination.lng },
                travelMode: google.maps.TravelMode.DRIVING,
              }}
              callback={(result, status) => {
                directionsCallback(result, status);
              }}
            />
          )}

          {directionsResponse && (
            <DirectionsRenderer
              options={{
                directions: directionsResponse,
                suppressMarkers: false,
                polylineOptions: { strokeColor: '#2563EB', strokeWeight: 5, strokeOpacity: 0.85 },
              }}
            />
          )}

          {isValidPos(origen) && (
            <MarkerF
              position={{ lat: origen.lat, lng: origen.lng }}
              title="Origen / Recogida"
              icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }}
            />
          )}

          {isValidPos(destino) && (
            <MarkerF
              position={{ lat: destino.lat, lng: destino.lng }}
              title="Destino"
              icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
            />
          )}

          {isValidPos(driverPos) && (
            <MarkerF
              position={{ lat: driverPos.lat, lng: driverPos.lng }}
              title={driverName}
              icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }}
            />
          )}
        </GoogleMap>
      ) : (
        <div ref={leafletContainerRef} className="w-full h-full z-0" />
      )}

      {/* Botones de Control Flotantes Superiores: Centrado y Vista General */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-[500] pointer-events-auto">
        {isValidPos(origen) && (
          <button
            type="button"
            onClick={handleCenterUser}
            className="bg-white/95 hover:bg-white active:scale-95 text-emerald-800 font-bold text-[10.5px] px-2.5 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm"
          >
            <span>🟢</span>
            <span>Mi Recogida</span>
          </button>
        )}
        {isValidPos(driverPos) && (
          <button
            type="button"
            onClick={handleCenterDriver}
            className="bg-white/95 hover:bg-white active:scale-95 text-blue-800 font-bold text-[10.5px] px-2.5 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm"
          >
            <span>🚙</span>
            <span>Conductor</span>
          </button>
        )}
        {(isValidPos(driverPos) || isValidPos(origen)) && isValidPos(destino) && (
          <button
            type="button"
            onClick={handleFitAll}
            className="bg-white/95 hover:bg-white active:scale-95 text-slate-800 font-bold text-[10.5px] px-2.5 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm"
          >
            <span>🔍</span>
            <span>Ver Todo</span>
          </button>
        )}
      </div>

      {/* Controles Flotantes Superiores Derechos: Cambio de Capa y Zoom */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-[500] pointer-events-auto">
        {allowLayerSwitch && !isGoogleMaps && (
          <div className="bg-white/95 backdrop-blur-sm p-1 rounded-2xl shadow-md border border-slate-200/80 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTileMode('standard')}
              className={`px-2 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer ${
                tileMode === 'standard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗺️ Mapa
            </button>
            <button
              type="button"
              onClick={() => setTileMode('satellite')}
              className={`px-2 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer ${
                tileMode === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛰️ Satelital
            </button>
          </div>
        )}

        {!isGoogleMaps && (
          <div className="flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-slate-200/80 overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Acercar"
              className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-sm border-b border-slate-100 transition-colors cursor-pointer"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Alejar"
              className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-sm transition-colors cursor-pointer"
            >
              −
            </button>
          </div>
        )}
      </div>

      {/* Indicador de Geocodificación en Progreso */}
      {isGeocoding && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl border border-white/10 flex items-center gap-2 z-[500] animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Obteniendo dirección...</span>
        </div>
      )}

      {/* Tarjeta de Resumen de Ruta (Distancia y Tiempo Estimado) */}
      {routeInfo && (
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl text-xs shadow-xl border border-white/10 flex items-center gap-3 z-[500]">
          <div className="flex items-center gap-1.5 font-extrabold text-emerald-400">
            <span>📍</span>
            <span>{routeInfo.distanceKm}</span>
          </div>
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-1.5 font-extrabold text-amber-400">
            <span>⏱️</span>
            <span>{routeInfo.durationMin}</span>
          </div>
        </div>
      )}

      {/* Insignia de OpenStreetMap / Base Tecnológica */}
      <div className="absolute bottom-1 right-2 text-[9px] font-semibold text-slate-500/80 bg-white/70 backdrop-blur-xs px-1.5 py-0.5 rounded-md pointer-events-none z-[400]">
        © OpenStreetMap • CARTO • Esri
      </div>
    </div>
  );
};

export default MapComponent;
