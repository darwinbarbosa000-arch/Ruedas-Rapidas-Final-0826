import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Navigation } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface EnCaminoMapProps {
  driverId?: string;
  driverName?: string;
  vehicleType?: string;
  driverPos?: LocationPoint | null;
  recogidaPos: LocationPoint;
  destinoPos?: LocationPoint | null;
  estado?: string; // 'EN_CAMINO_A_RECOGIDA' | 'en_camino' | 'aceptado' | 'llegando' | 'EN_VIAJE' | 'en_transito'
  onCenterClick?: () => void;
  className?: string;
  autoSimulateIfOffline?: boolean;
}

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

function getVehicleEmoji(type?: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('moto')) return '🏍️';
  if (t.includes('camion') || t.includes('flete') || t.includes('acarreo')) return '🚚';
  if (t.includes('taxi')) return '🚕';
  return '🚗';
}

// Icono Conductor para Pasajero (100% Inline CSS)
function createPassengerDriverMarkerIcon(
  driverName: string,
  distanceLabel: string,
  vehicleType?: string
): L.DivIcon {
  const safeName = driverName || 'Darwin Barbosa';
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
      <!-- Badge Conductor -->
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
        <span>${safeName}</span>
        <span style="
          background: #0284c7;
          color: #ffffff;
          padding: 1px 6px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 900;
        ">${distanceLabel}</span>
      </div>

      <!-- Flecha azul -->
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

// Icono Punto de Recogida Pulsante (100% Inline CSS)
function createPassengerPickupMarkerIcon(pickupName: string): L.DivIcon {
  const safePickup = pickupName || 'Universidad';

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
      <!-- Floating Label: "Recogida: Universidad" -->
      <div style="
        background: #064e3b;
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 9999px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(5, 150, 105, 0.45);
        border: 2px solid #34d399;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 2px;
      ">
        <span style="font-size: 11px;">📍</span>
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

      <!-- Pulsing Beacon Pin -->
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
          border-radius: 50%;
          background-color: #10b981;
          opacity: 0.75;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #059669;
          border: 2px solid #ffffff;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
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

// Icono Destino Final (Solo en viaje)
function createPassengerDestinationMarkerIcon(destName: string): L.DivIcon {
  const safeDest = destName || 'Destino';

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
      <!-- Badge Destino -->
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
        <span style="font-size: 11px;">🏁</span>
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

      <!-- Pulsing Pin Rojo -->
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
          border-radius: 50%;
          background-color: #f43f5e;
          opacity: 0.75;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #be123c;
          border: 2px solid #ffffff;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
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

// In-memory route cache
const passengerRouteCache = new Map<string, { coords: [number, number][]; distanceKm: number; durationMin: number }>();

export const EnCaminoMap: React.FC<EnCaminoMapProps> = ({
  driverId,
  driverName = 'Darwin Barbosa',
  vehicleType = 'car',
  driverPos: initialDriverPos = null,
  recogidaPos,
  destinoPos = null,
  estado = 'EN_CAMINO_A_RECOGIDA',
  onCenterClick,
  className = 'h-[400px]',
  autoSimulateIfOffline = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const activeBoundsPointsRef = useRef<[number, number][]>([]);

  // ESTADO DE SEGUIMIENTO (Permite exploración libre sin mapa "amarrado")
  const [isFollowing, setIsFollowing] = useState<boolean>(true);

  // Normalizar el estado
  const normalizedEstado = (estado || 'EN_CAMINO_A_RECOGIDA').toLowerCase();
  const isEnViaje =
    normalizedEstado === 'en_viaje' ||
    normalizedEstado === 'en_transito' ||
    normalizedEstado === 'finalizado';
  const isEnCamino = !isEnViaje;

  // Ubicación del conductor con fallback robusto inicial
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number }>(() => {
    if (isValidPos(initialDriverPos)) {
      return { lat: initialDriverPos.lat, lng: initialDriverPos.lng };
    }
    // Inicializar aproximándose a recogida (~500m de distancia)
    if (isValidPos(recogidaPos)) {
      return { lat: recogidaPos.lat + 0.004, lng: recogidaPos.lng - 0.003 };
    }
    return { lat: 4.3364, lng: -74.3638 };
  });

  // Suscribirse al padre si cambia driverPos
  useEffect(() => {
    if (isValidPos(initialDriverPos)) {
      setDriverLocation({ lat: initialDriverPos.lat, lng: initialDriverPos.lng });
    }
  }, [initialDriverPos?.lat, initialDriverPos?.lng]);

  // Target según estado:
  // Si está en camino, el objetivo es recogidaPos
  // Si está en viaje, el objetivo es destinoPos
  const targetDestination = useMemo(() => {
    if (isEnViaje && isValidPos(destinoPos)) {
      return destinoPos;
    }
    return recogidaPos;
  }, [isEnViaje, destinoPos, recogidaPos]);

  // Info de ruta calculada
  const [routeInfo, setRouteInfo] = useState<{
    coords: [number, number][];
    distanceKm: number;
    durationMin: number;
  }>({
    coords: [],
    distanceKm: 0.4,
    durationMin: 1,
  });

  // Suscripción a Firestore 'drivers_location'
  useEffect(() => {
    if (!driverId) return;

    try {
      const docRef = doc(db, 'drivers_location', driverId);
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (isValidPos({ lat: data.lat, lng: data.lng })) {
              setDriverLocation({ lat: data.lat, lng: data.lng });
            }
          }
        },
        (err) => {
          console.warn('Notice listening to driver location via Firestore:', err);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore subscription notice:', err);
    }
  }, [driverId]);

  // Simulación de aproximación suave si no hay señal activa
  useEffect(() => {
    if (!autoSimulateIfOffline) return;

    const interval = setInterval(() => {
      setDriverLocation((curr) => {
        if (!curr || !targetDestination) return curr;

        const dLat = targetDestination.lat - curr.lat;
        const dLng = targetDestination.lng - curr.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        // Si está a menos de 15m, mantener posición
        if (dist < 0.0002) return curr;

        const stepRatio = Math.min(0.04, 0.0002 / (dist || 0.001));
        return {
          lat: curr.lat + dLat * stepRatio,
          lng: curr.lng + dLng * stepRatio,
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [autoSimulateIfOffline, targetDestination]);

  // Fetch OSRM Route
  useEffect(() => {
    if (!isValidPos(driverLocation) || !targetDestination || !isValidPos(targetDestination)) return;

    let isMounted = true;
    const cacheKey = `${driverLocation.lat.toFixed(4)},${driverLocation.lng.toFixed(4)}->${targetDestination.lat.toFixed(4)},${targetDestination.lng.toFixed(4)}`;

    if (passengerRouteCache.has(cacheKey)) {
      setRouteInfo(passengerRouteCache.get(cacheKey)!);
      return;
    }

    const fetchRoute = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${targetDestination.lng},${targetDestination.lat}?overview=full&geometries=geojson`;
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
            passengerRouteCache.set(cacheKey, result);
            setRouteInfo(result);
            return;
          }
        }
      } catch {
        // Fallback
      }

      if (isMounted) {
        const directKm = calculateHaversineKm(driverLocation, targetDestination);
        const roadKm = Math.round(directKm * 1.25 * 10) / 10;
        const estMin = Math.max(1, Math.round((roadKm / 28) * 60));

        const steps = 8;
        const fallbackCoords: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          fallbackCoords.push([
            driverLocation.lat + (targetDestination.lat - driverLocation.lat) * t,
            driverLocation.lng + (targetDestination.lng - driverLocation.lng) * t,
          ]);
        }

        const fallbackResult = {
          coords: fallbackCoords,
          distanceKm: roadKm || 0.4,
          durationMin: estMin || 2,
        };
        passengerRouteCache.set(cacheKey, fallbackResult);
        setRouteInfo(fallbackResult);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [driverLocation.lat, driverLocation.lng, targetDestination]);

  // Inicializar Leaflet 100% Interactivo y LayerGroups
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      try {
        const centerLat = isValidPos(recogidaPos) ? recogidaPos.lat : 4.3364;
        const centerLng = isValidPos(recogidaPos) ? recogidaPos.lng : -74.3638;

        // Leaflet 100% interactivo: drag, scroll, touch, zoom
        const map = L.map(containerRef.current, {
          center: [centerLat, centerLng],
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

        // Capa OpenStreetMap 100% puro gratis
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        });
        osmLayer.addTo(map);

        // LayerGroups dedicados
        const markersGroup = L.layerGroup().addTo(map);
        markersLayerRef.current = markersGroup;

        const routesGroup = L.layerGroup().addTo(map);
        routeLayerRef.current = routesGroup;

        mapRef.current = map;

        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 150);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, 600);
      } catch (e) {
        console.warn('Map initialization error:', e);
      }
    }

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

  const pickupLabel = useMemo(() => {
    return recogidaPos?.name || recogidaPos?.address?.split(',')[0] || 'Universidad';
  }, [recogidaPos?.name, recogidaPos?.address]);

  const destLabel = useMemo(() => {
    return destinoPos?.name || destinoPos?.address?.split(',')[0] || 'Destino Final';
  }, [destinoPos?.name, destinoPos?.address]);

  const formattedDistanceLabel = useMemo(() => {
    return `${routeInfo.distanceKm}km`;
  }, [routeInfo.distanceKm]);

  // SINCRONIZACIÓN DE MARCADORES Y RUTA (Respeta `isFollowing`)
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersLayerRef.current;
    const routesGroup = routeLayerRef.current;

    if (!map || !markersGroup || !routesGroup) return;

    // Limpiar capas previas
    markersGroup.clearLayers();
    routesGroup.clearLayers();

    const activeBoundsPoints: [number, number][] = [];

    // Calcular desplazamiento visual si conductor y recogida están exactamente en el mismo punto
    let driverDrawLat = driverLocation.lat;
    let driverDrawLng = driverLocation.lng;

    if (isEnCamino && isValidPos(recogidaPos) && isValidPos(driverLocation)) {
      const distDirect = calculateHaversineKm(driverLocation, recogidaPos);
      if (distDirect < 0.03) {
        driverDrawLat += 0.00018;
        driverDrawLng += 0.00018;
      }
    }

    // 1. MARCADOR DEL CONDUCTOR
    if (isValidPos({ lat: driverDrawLat, lng: driverDrawLng })) {
      const driverIcon = createPassengerDriverMarkerIcon(driverName, formattedDistanceLabel, vehicleType);
      const marker = L.marker([driverDrawLat, driverDrawLng], {
        icon: driverIcon,
        zIndexOffset: 1200,
        interactive: true,
      });
      marker.addTo(markersGroup);
      activeBoundsPoints.push([driverDrawLat, driverDrawLng]);
    }

    // 2. REGLA ESTRICTA DE ESTADOS:
    if (isEnCamino) {
      // ESTADO EN CAMINO A RECOGIDA:
      // SOLO MOSTRAR 2 MARCADORES: Conductor y Punto de Recogida
      // NUNCA mostrar el marcador de destino en este estado
      if (isValidPos(recogidaPos)) {
        const pickupIcon = createPassengerPickupMarkerIcon(pickupLabel);
        const marker = L.marker([recogidaPos.lat, recogidaPos.lng], {
          icon: pickupIcon,
          zIndexOffset: 900,
          interactive: true,
        });
        marker.addTo(markersGroup);
        activeBoundsPoints.push([recogidaPos.lat, recogidaPos.lng]);
      }
    } else {
      // ESTADO EN VIAJE / TRANSITO:
      // Mostrar destino final
      if (isValidPos(destinoPos)) {
        const destIcon = createPassengerDestinationMarkerIcon(destLabel);
        const marker = L.marker([destinoPos.lat, destinoPos.lng], {
          icon: destIcon,
          zIndexOffset: 950,
          interactive: true,
        });
        marker.addTo(markersGroup);
        activeBoundsPoints.push([destinoPos.lat, destinoPos.lng]);
      }
    }

    // Guardar puntos activos en ref para centrado
    activeBoundsPointsRef.current = activeBoundsPoints;

    // 3. TRAZADO DE RUTA
    const pointsToDraw =
      routeInfo.coords.length >= 2
        ? routeInfo.coords
        : isValidPos(driverLocation) && isValidPos(targetDestination)
        ? ([[driverLocation.lat, driverLocation.lng], [targetDestination.lat, targetDestination.lng]] as [number, number][])
        : [];

    if (pointsToDraw.length >= 2) {
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

      // Animación de dash
      L.polyline(pointsToDraw, {
        color: '#93c5fd',
        weight: 3,
        opacity: 0.9,
        dashArray: '8, 16',
        className: 'animated-route-flow',
      }).addTo(routesGroup);
    }

    // 4. AUTO-FIT BOUNDS CONTROLADO: SOLO cuando isFollowing === true
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
    driverLocation.lat,
    driverLocation.lng,
    driverName,
    formattedDistanceLabel,
    vehicleType,
    isEnCamino,
    recogidaPos.lat,
    recogidaPos.lng,
    pickupLabel,
    destinoPos?.lat,
    destinoPos?.lng,
    destLabel,
    targetDestination,
    routeInfo.coords,
    isFollowing,
  ]);

  // Centrar en ubicación activa y reactivar seguimiento continuo
  const handleCenterOnLocation = useCallback(() => {
    setIsFollowing(true);
    const map = mapRef.current;
    if (!map) return;

    if (onCenterClick) {
      onCenterClick();
    }

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
      map.setView([pts[0][0], pts[0][1]], 16, { animate: true });
    } else if (isValidPos(driverLocation) && isValidPos(recogidaPos)) {
      const bounds = L.latLngBounds([
        [driverLocation.lat, driverLocation.lng],
        [recogidaPos.lat, recogidaPos.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
    } else if (isValidPos(driverLocation)) {
      map.flyTo([driverLocation.lat, driverLocation.lng], 16, { animate: true });
    } else if (isValidPos(recogidaPos)) {
      map.flyTo([recogidaPos.lat, recogidaPos.lng], 16, { animate: true });
    }
  }, [driverLocation, recogidaPos, onCenterClick]);

  return (
    <div className={`relative w-full overflow-hidden rounded-[2rem] bg-slate-50 border border-slate-200/90 shadow-xl ${className} notranslate`} translate="no">
      {/* Contenedor del Mapa Leaflet */}
      <div ref={containerRef} className="w-full h-full min-h-[380px] z-0" />

      {/* BOTÓN FLOTANTE "🎯 Centrar": SOLO se muestra cuando isFollowing === false */}
      {!isFollowing && (
        <button
          type="button"
          onClick={handleCenterOnLocation}
          className="absolute bottom-24 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-blue-700 font-extrabold text-xs shadow-2xl border-2 border-blue-600 transition-all cursor-pointer active:scale-95 animate-pulse"
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

      {/* Botón icono de centrado abajo a la derecha */}
      <button
        type="button"
        onClick={handleCenterOnLocation}
        className={`absolute bottom-24 right-4 z-[400] w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 active:scale-95 shadow-xl border border-slate-200 flex items-center justify-center transition-all cursor-pointer group ${
          !isFollowing ? 'border-blue-400 ring-2 ring-blue-300' : ''
        }`}
        title="Centrar conductor y recogida"
        aria-label="Centrar en mi ubicación"
      >
        <LocateFixed
          size={20}
          className={`${
            isFollowing ? 'text-blue-600' : 'text-slate-400'
          } group-hover:scale-110 transition-transform`}
        />
      </button>

      {/* Barra inferior flotante oscura */}
      <div className="absolute bottom-4 left-4 right-4 z-[400] bg-slate-950/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-4">
        {/* Indicador de estado y nombre */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Navigation size={20} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 truncate">
                {isEnCamino ? 'El conductor va en camino' : 'En viaje a tu destino'}
              </p>
            </div>
            <p className="text-xs font-black text-white truncate mt-0.5">
              {driverName || 'Darwin Barbosa'}
            </p>
          </div>
        </div>

        {/* Métricas calculadas de la ruta real: "📍 1.3 km | ⏱️ 2 min" */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800/80 px-3.5 py-2 rounded-xl shrink-0">
          <span className="text-xs font-black text-amber-400 flex items-center gap-1">
            📍 {routeInfo.distanceKm} km
          </span>
          <span className="text-slate-600 font-bold">|</span>
          <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
            ⏱️ {routeInfo.durationMin} min
          </span>
        </div>
      </div>

      {/* Insignia OpenStreetMap */}
      <div className="absolute top-3 left-3 text-[9px] font-semibold text-slate-600 bg-white/85 backdrop-blur-xs px-2 py-0.5 rounded-md pointer-events-none z-[400] shadow-xs">
        © OpenStreetMap
      </div>
    </div>
  );
};

export default EnCaminoMap;
