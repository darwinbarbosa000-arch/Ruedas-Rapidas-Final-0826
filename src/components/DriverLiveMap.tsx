import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { LocateFixed, Navigation } from 'lucide-react';

const FUSAGASUGA_CENTER = { lat: 4.3364, lng: -74.3638 };

export function isValidPos(pos?: { lat?: number; lng?: number } | null): pos is { lat: number; lng: number } {
  return (
    !!pos &&
    typeof pos.lat === 'number' &&
    typeof pos.lng === 'number' &&
    !isNaN(pos.lat) &&
    !isNaN(pos.lng) &&
    pos.lat !== 0 &&
    pos.lng !== 0
  );
}

export function calculateHaversineKm(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export interface DriverLiveMapProps {
  driverId: string;
  driverName?: string;
  vehicleType?: string;
  isOnline?: boolean;
  driverPos?: { lat: number; lng: number; address?: string } | null;
  origen?: { lat: number; lng: number; address?: string; name?: string } | null;
  destino?: { lat: number; lng: number; address?: string; name?: string } | null;
  showRoute?: boolean;
  status?: string;
}

function getVehicleEmoji(type?: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('moto')) return '🏍️';
  if (t.includes('camion') || t.includes('flete') || t.includes('acarreo')) return '🚚';
  if (t.includes('taxi')) return '🚕';
  return '🚗';
}

// Icono Conductor 100% Inline CSS + iconSize [0, 0] para máxima compatibilidad
function createDriverMarkerIcon(
  driverName: string,
  distanceLabel: string,
  vehicleType?: string
): L.DivIcon {
  const safeName = driverName || 'Conductor';
  const emoji = getVehicleEmoji(vehicleType);

  const html = `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      z-index: 1200;
    ">
      <!-- Badge Conductor (Tú) -->
      <div style="
        background: #0f172a;
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        border: 2px solid #38bdf8;
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
        margin-bottom: 2px;
      ">
        <span style="font-size: 13px;">${emoji}</span>
        <span>${safeName} (Tú)</span>
        <span style="
          background: #0284c7;
          color: #ffffff;
          padding: 1px 6px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 900;
        ">${distanceLabel}</span>
      </div>

      <!-- Flecha azul cielo -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid #38bdf8;
        margin-top: -1px;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
      "></div>

      <!-- Radar de Pulso GPS Conductor -->
      <div style="
        position: relative;
        width: 16px;
        height: 16px;
        margin-top: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background-color: #38bdf8;
          border-radius: 50%;
          opacity: 0.75;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 10px;
          height: 10px;
          background-color: #0284c7;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
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
}

// Icono Punto de Recogida (Pasajero) 100% Inline CSS
function createPickupMarkerIcon(pickupName: string): L.DivIcon {
  const safePickup = pickupName || 'Pasajero';

  const html = `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      z-index: 1100;
    ">
      <!-- Badge Verde Recogida -->
      <div style="
        background: #064e3b;
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(5, 150, 105, 0.45);
        border: 2px solid #34d399;
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
        margin-bottom: 2px;
      ">
        <span style="font-size: 11px;">🟢</span>
        <span>Recogida: ${safePickup}</span>
      </div>

      <!-- Flecha Verde -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid #10b981;
        margin-top: -1px;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
      "></div>

      <!-- Radar de Pulso Verde -->
      <div style="
        position: relative;
        width: 16px;
        height: 16px;
        margin-top: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background-color: #10b981;
          border-radius: 50%;
          opacity: 0.75;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 10px;
          height: 10px;
          background-color: #059669;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-pickup-marker-wrapper',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// Icono Destino Final (Solo en tránsito)
function createDestinationMarkerIcon(destName: string): L.DivIcon {
  const safeDest = destName || 'Destino Final';

  const html = `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      z-index: 1100;
    ">
      <!-- Badge Rojo Destino -->
      <div style="
        background: #881337;
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.45);
        border: 2px solid #fb7185;
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
        margin-bottom: 2px;
      ">
        <span style="font-size: 11px;">🔴</span>
        <span>Destino: ${safeDest}</span>
      </div>

      <!-- Flecha Roja -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid #e11d48;
        margin-top: -1px;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
      "></div>

      <!-- Radar de Pulso Rojo -->
      <div style="
        position: relative;
        width: 16px;
        height: 16px;
        margin-top: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background-color: #f43f5e;
          border-radius: 50%;
          opacity: 0.75;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 10px;
          height: 10px;
          background-color: #be123c;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-dest-marker-wrapper',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// In-memory cache for OSRM routes
const driverRouteCache = new Map<string, { coords: [number, number][]; distanceKm: number; durationMin: number }>();

export const DriverLiveMap: React.FC<DriverLiveMapProps> = ({
  driverId,
  driverName = 'Conductor',
  vehicleType = 'carro',
  isOnline = true,
  driverPos: initialDriverPos = null,
  origen = null,
  destino = null,
  showRoute = true,
  status = 'en_camino',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const activeBoundsPointsRef = useRef<[number, number][]>([]);

  // ESTADO DE SEGUIMIENTO (Permite exploración libre sin mapa "amarrado")
  const [isFollowing, setIsFollowing] = useState<boolean>(true);

  // Posición del conductor en tiempo real
  const [position, setPosition] = useState<{ lat: number; lng: number }>(() => {
    if (isValidPos(initialDriverPos)) {
      return { lat: initialDriverPos.lat, lng: initialDriverPos.lng };
    }
    return FUSAGASUGA_CENTER;
  });

  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSavedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // Normalizar estado
  const isEnTransito = status === 'en_transito' || status === 'EN_VIAJE';

  // Objetivo:
  // Si NO está en tránsito, el conductor va hacia el origen (recogida del pasajero).
  // Si está en tránsito, va hacia el destino.
  const targetPoint = useMemo(() => {
    if (isEnTransito && isValidPos(destino)) {
      return destino;
    }
    if (isValidPos(origen)) {
      return origen;
    }
    return destino && isValidPos(destino) ? destino : null;
  }, [isEnTransito, destino, origen]);

  // Actualizar posición inicial si el padre suministra driverPos
  useEffect(() => {
    if (isValidPos(initialDriverPos)) {
      setPosition({ lat: initialDriverPos.lat, lng: initialDriverPos.lng });
    }
  }, [initialDriverPos?.lat, initialDriverPos?.lng]);

  // Info de la ruta calculada
  const [routeInfo, setRouteInfo] = useState<{
    coords: [number, number][];
    distanceKm: number;
    durationMin: number;
  }>({
    coords: [],
    distanceKm: 0.4,
    durationMin: 1,
  });

  // Guardar ubicación en Firestore con throttle
  const saveLocationToFirestore = useCallback(
    async (lat: number, lng: number) => {
      if (!driverId || !isValidPos({ lat, lng })) return;

      const now = Date.now();
      if (lastSavedPosRef.current) {
        const movedKm = calculateHaversineKm(lastSavedPosRef.current, { lat, lng });
        const timeSinceLastSave = now - lastSaveTimeRef.current;
        if (movedKm < 0.01 && timeSinceLastSave < 3500) {
          return;
        }
      }

      try {
        setIsSaving(true);
        lastSavedPosRef.current = { lat, lng };
        lastSaveTimeRef.current = now;

        const docRef = doc(db, 'drivers_location', driverId);
        await setDoc(
          docRef,
          {
            driverId,
            driverName,
            vehicleType,
            lat,
            lng,
            timestamp: new Date().toISOString(),
            isOnline,
          },
          { merge: true }
        );
        setLastUpdated(new Date().toLocaleTimeString('es-CO'));
      } catch (err) {
        console.warn('Notice saving driver location to Firestore:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [driverId, driverName, vehicleType, isOnline]
  );

  // Escuchar posición guardada en Firestore
  useEffect(() => {
    if (!driverId) return;
    const docRef = doc(db, 'drivers_location', driverId);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (isValidPos({ lat: data.lat, lng: data.lng })) {
            setPosition({ lat: data.lat, lng: data.lng });
            if (data.timestamp) {
              try {
                setLastUpdated(new Date(data.timestamp).toLocaleTimeString('es-CO'));
              } catch {}
            }
          }
        }
      },
      (err) => {
        console.warn('Firestore snapshot notice on drivers_location:', err);
      }
    );
    return () => unsubscribe();
  }, [driverId]);

  // GPS en vivo del dispositivo
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 3000,
    };

    const handleSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (isValidPos({ lat, lng })) {
        setPosition({ lat, lng });
        setGeoError(null);
        saveLocationToFirestore(lat, lng);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation notice:', err.message);
      if (!isValidPos(initialDriverPos)) {
        setGeoError('Buscando señal GPS precisa...');
      }
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [saveLocationToFirestore, initialDriverPos]);

  // Fetch OSRM Route
  useEffect(() => {
    if (!isValidPos(position) || !targetPoint || !isValidPos(targetPoint)) return;

    let isMounted = true;
    const cacheKey = `${position.lat.toFixed(4)},${position.lng.toFixed(4)}->${targetPoint.lat.toFixed(4)},${targetPoint.lng.toFixed(4)}`;

    if (driverRouteCache.has(cacheKey)) {
      setRouteInfo(driverRouteCache.get(cacheKey)!);
      return;
    }

    const fetchRoute = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://router.project-osrm.org/route/v1/driving/${position.lng},${position.lat};${targetPoint.lng},${targetPoint.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data && data.routes && data.routes[0]) {
            const route = data.routes[0];
            const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
            const durationMin = Math.max(1, Math.round(route.duration / 60));

            const result = { coords, distanceKm, durationMin };
            driverRouteCache.set(cacheKey, result);
            setRouteInfo(result);
            return;
          }
        }
      } catch {
        // Fallback interpolado
      }

      if (isMounted) {
        const directKm = calculateHaversineKm(position, targetPoint);
        const roadKm = Math.round(directKm * 1.25 * 10) / 10;
        const estMin = Math.max(1, Math.round((roadKm / 28) * 60));

        const steps = 8;
        const fallbackCoords: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          fallbackCoords.push([
            position.lat + (targetPoint.lat - position.lat) * t,
            position.lng + (targetPoint.lng - position.lng) * t,
          ]);
        }

        const fallbackResult = {
          coords: fallbackCoords,
          distanceKm: roadKm || 0.4,
          durationMin: estMin || 2,
        };
        driverRouteCache.set(cacheKey, fallbackResult);
        setRouteInfo(fallbackResult);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [position.lat, position.lng, targetPoint]);

  // Inicializar Leaflet 100% Interactivo y Capas
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      try {
        const startLat = isValidPos(position) ? position.lat : FUSAGASUGA_CENTER.lat;
        const startLng = isValidPos(position) ? position.lng : FUSAGASUGA_CENTER.lng;

        // Leaflet 100% interactivo: drag, scroll, touch, zoom
        const map = L.map(containerRef.current, {
          center: [startLat, startLng],
          zoom: 15,
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
          keyboard: true,
        });

        // Detectar interacción del usuario para pausar el seguimiento automático
        map.on('dragstart', () => {
          setIsFollowing(false);
        });
        map.on('zoomstart', () => {
          setIsFollowing(false);
        });

        // Capa OpenStreetMap 100% puro y gratis (CERO API KEY, sin marcas de agua)
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        });
        osmLayer.addTo(map);

        // LayerGroups dedicados para marcadores y rutas (100% inmunes a bugs de estado)
        const markersGroup = L.layerGroup().addTo(map);
        markersLayerRef.current = markersGroup;

        const routesGroup = L.layerGroup().addTo(map);
        routeLayerRef.current = routesGroup;

        mapRef.current = map;

        // Invalidate size inmediato y diferido
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 150);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 600);
      } catch (e) {
        console.warn('Driver map init error:', e);
      }
    }

    // ResizeObserver para cambios de tamaño en el modal
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, []);

  // Labels dinámicos
  const pickupLabel = useMemo(() => {
    return origen?.name || origen?.address?.split(',')[0] || 'Pasajero';
  }, [origen?.name, origen?.address]);

  const destLabel = useMemo(() => {
    return destino?.name || destino?.address?.split(',')[0] || 'Destino';
  }, [destino?.name, destino?.address]);

  const formattedDistanceLabel = useMemo(() => {
    return `${routeInfo.distanceKm}km`;
  }, [routeInfo.distanceKm]);

  // SINCRONIZACIÓN DE MARCADORES Y RUTA (Respeta `isFollowing`)
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersLayerRef.current;
    const routesGroup = routeLayerRef.current;

    if (!map || !markersGroup || !routesGroup) return;

    // Limpiar capas previas de forma segura en cada ciclo
    markersGroup.clearLayers();
    routesGroup.clearLayers();

    const activeBoundsPoints: [number, number][] = [];

    // Calcular si el conductor y la recogida están muy cerca (< 30m) para evitar que un pin tape al otro
    let driverDrawLat = position.lat;
    let driverDrawLng = position.lng;

    if (!isEnTransito && isValidPos(origen) && isValidPos(position)) {
      const distDirect = calculateHaversineKm(position, origen);
      if (distDirect < 0.03) {
        driverDrawLat += 0.00018;
        driverDrawLng += 0.00018;
      }
    }

    // 1. MARCADOR DEL CONDUCTOR (Tú)
    if (isValidPos({ lat: driverDrawLat, lng: driverDrawLng })) {
      const driverIcon = createDriverMarkerIcon(driverName, formattedDistanceLabel, vehicleType);
      const marker = L.marker([driverDrawLat, driverDrawLng], {
        icon: driverIcon,
        zIndexOffset: 1200,
        interactive: true,
      });
      marker.addTo(markersGroup);
      activeBoundsPoints.push([driverDrawLat, driverDrawLng]);
    }

    // 2. REGLA ESTRICTA DE ROLES Y ESTADOS:
    if (!isEnTransito) {
      // ESTADO EN CAMINO / RECOGIDA:
      // Mostrar ÚNICAMENTE el marcador de Recogida del Pasajero
      if (isValidPos(origen)) {
        const pickupIcon = createPickupMarkerIcon(pickupLabel);
        const marker = L.marker([origen.lat, origen.lng], {
          icon: pickupIcon,
          zIndexOffset: 900,
          interactive: true,
        });
        marker.addTo(markersGroup);
        activeBoundsPoints.push([origen.lat, origen.lng]);
      }
    } else {
      // ESTADO EN TRÁNSITO (HACIA EL DESTINO):
      // Mostrar ÚNICAMENTE el marcador de Destino Final
      if (isValidPos(destino)) {
        const destIcon = createDestinationMarkerIcon(destLabel);
        const marker = L.marker([destino.lat, destino.lng], {
          icon: destIcon,
          zIndexOffset: 950,
          interactive: true,
        });
        marker.addTo(markersGroup);
        activeBoundsPoints.push([destino.lat, destino.lng]);
      }
    }

    // Guardar puntos activos en ref para centrado
    activeBoundsPointsRef.current = activeBoundsPoints;

    // 3. TRAZADO DE RUTA VIAL
    if (showRoute && targetPoint && isValidPos(targetPoint) && isValidPos(position)) {
      const pointsToDraw =
        routeInfo.coords.length >= 2
          ? routeInfo.coords
          : ([[position.lat, position.lng], [targetPoint.lat, targetPoint.lng]] as [number, number][]);

      // Casing blanco exterior
      L.polyline(pointsToDraw, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routesGroup);

      // Línea azul sólida de 5px
      L.polyline(pointsToDraw, {
        color: '#2563eb',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routesGroup);

      // Flujo animado estilo dash
      L.polyline(pointsToDraw, {
        color: '#93c5fd',
        weight: 3,
        opacity: 0.9,
        dashArray: '8, 16',
        className: 'animated-route-flow',
      }).addTo(routesGroup);
    }

    // 4. AUTO-AJUSTE CONTROLADO: SOLO si el usuario no está explorando libremente
    if (isFollowing) {
      if (activeBoundsPoints.length >= 2) {
        const p1 = activeBoundsPoints[0];
        const p2 = activeBoundsPoints[1];
        const dist = calculateHaversineKm({ lat: p1[0], lng: p1[1] }, { lat: p2[0], lng: p2[1] });

        if (dist > 0.03) {
          try {
            const bounds = L.latLngBounds(activeBoundsPoints);
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: false });
            }
          } catch (e) {
            console.warn('fitBounds notice:', e);
          }
        } else {
          map.setView([p1[0], p1[1]], 16);
        }
      } else if (activeBoundsPoints.length === 1) {
        map.setView(activeBoundsPoints[0], 16);
      }
    }
  }, [
    position.lat,
    position.lng,
    driverName,
    formattedDistanceLabel,
    vehicleType,
    isEnTransito,
    origen?.lat,
    origen?.lng,
    pickupLabel,
    destino?.lat,
    destino?.lng,
    destLabel,
    showRoute,
    targetPoint,
    routeInfo.coords,
    isFollowing,
  ]);

  // Centrar en ubicación activa y reactivar seguimiento
  const handleCenter = useCallback(() => {
    setIsFollowing(true);
    const map = mapRef.current;
    if (!map) return;

    const pts = activeBoundsPointsRef.current;
    if (pts.length >= 2) {
      const dist = calculateHaversineKm({ lat: pts[0][0], lng: pts[0][1] }, { lat: pts[1][0], lng: pts[1][1] });
      if (dist > 0.03) {
        const bounds = L.latLngBounds(pts);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
      } else {
        map.setView([pts[0][0], pts[0][1]], 16, { animate: true });
      }
    } else if (pts.length === 1) {
      map.setView(pts[0], 16, { animate: true });
    } else if (isValidPos(position)) {
      map.setView([position.lat, position.lng], 16, { animate: true });
    }
  }, [position]);

  return (
    <div className="w-full space-y-3 notranslate" translate="no">
      {/* Alerta si no hay señal GPS */}
      {geoError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-2xl flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <span>⚠️</span>
            <span>{geoError}</span>
          </span>
          <button
            type="button"
            onClick={() => setGeoError(null)}
            className="text-amber-800 font-bold ml-2 underline text-[10px] cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Barra de Estado Superior */}
      <div className="flex flex-wrap items-center justify-between bg-slate-950 text-white p-3.5 rounded-2xl text-xs font-semibold gap-2 shadow-md border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border-2 border-slate-950"></span>
          <span className="font-bold text-slate-100">
            {isEnTransito ? 'Ruta a Destino en Vivo' : 'Rastreo GPS en Tiempo Real'} • {driverName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
            📍 {routeInfo.distanceKm} km {isEnTransito ? 'al destino' : 'al pasajero'}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {lastUpdated ? `GPS: ${lastUpdated}` : 'Sincronizando...'}
          </span>
        </div>
      </div>

      {/* Contenedor del Mapa Leaflet Conductor */}
      <div className="relative w-full h-[380px] sm:h-[420px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-100">
        <div ref={containerRef} className="w-full h-full z-0" />

        {/* BOTÓN FLOTANTE "🎯 Centrar": SOLO se muestra cuando isFollowing === false */}
        {!isFollowing && (
          <button
            type="button"
            onClick={handleCenter}
            className="absolute bottom-20 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-blue-700 font-extrabold text-xs shadow-2xl border-2 border-blue-600 transition-all cursor-pointer active:scale-95 animate-pulse"
            style={{
              position: 'absolute',
              bottom: 80,
              right: 16,
              zIndex: 1000,
              background: '#ffffff',
              borderRadius: '9999px',
              padding: '10px 18px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              border: '2px solid #2563eb',
              fontWeight: 800,
              color: '#1e3a8a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="text-base">🎯</span>
            <span>Centrar</span>
          </button>
        )}

        {/* Botón icono de Centrado inferior */}
        <button
          type="button"
          onClick={handleCenter}
          className={`absolute bottom-20 right-4 z-[400] w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 active:scale-95 shadow-xl border border-slate-200 flex items-center justify-center transition-all cursor-pointer group ${
            !isFollowing ? 'border-blue-400 ring-2 ring-blue-300' : ''
          }`}
          title="Centrar conductor y ruta"
          aria-label="Centrar mapa"
        >
          <LocateFixed
            size={20}
            className={`${
              isFollowing ? 'text-blue-600' : 'text-slate-400'
            } group-hover:scale-110 transition-transform`}
          />
        </button>

        {/* Barra inferior flotante oscura */}
        <div className="absolute bottom-3 left-3 right-3 z-[400] bg-slate-950/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <Navigation size={16} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate">
                {isEnTransito ? 'Destino Final' : 'Yendo al Pasajero'}
              </p>
              <p className="text-xs font-black text-white truncate">
                {isEnTransito ? destLabel : pickupLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
            <span className="text-xs font-black text-amber-400">
              📍 {routeInfo.distanceKm} km
            </span>
            <span className="text-slate-600 font-bold">|</span>
            <span className="text-xs font-black text-emerald-400">
              ⏱️ {routeInfo.durationMin} min
            </span>
          </div>
        </div>

        {/* Insignia OpenStreetMap */}
        <div className="absolute top-3 left-3 text-[9px] font-semibold text-slate-600 bg-white/85 backdrop-blur-xs px-2 py-0.5 rounded-md pointer-events-none z-[400] shadow-xs">
          © OpenStreetMap
        </div>
      </div>

      {/* Coordenadas en tiempo real y estado de sincronización */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex items-center justify-between">
        <div>
          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Coordenadas del Vehículo:</span>
          <p className="font-mono text-slate-800 font-bold mt-0.5">
            {isValidPos(position) ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Obteniendo GPS...'}
          </p>
        </div>
        {isSaving ? (
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 animate-pulse">
            Sincronizando...
          </span>
        ) : (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            En Línea
          </span>
        )}
      </div>
    </div>
  );
};

export default DriverLiveMap;
