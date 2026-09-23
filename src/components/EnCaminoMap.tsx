import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Navigation, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface LocationCoord {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface EnCaminoMapProps {
  driverId?: string;
  driverName?: string;
  vehicleType?: string;
  driverPos?: LocationCoord | null;
  recogidaPos: LocationCoord;
  destinoPos?: LocationCoord | null;
  estado?: 'EN_CAMINO_A_RECOGIDA' | 'EN_CAMINO' | 'en_camino' | 'aceptado' | 'llegando' | 'EN_VIAJE' | 'en_transito' | string;
  onCenterClick?: () => void;
  className?: string;
  autoSimulateIfOffline?: boolean;
}

// In-memory cache for OSRM routes to guarantee rapid rendering without repeated network calls
const osrmRouteCache = new Map<string, { coords: [number, number][]; distanceKm: number; durationMin: number }>();

// Helper: Calculate bearing / heading in degrees between two coordinates
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  if (Math.abs(from.lat - to.lat) < 0.000001 && Math.abs(from.lng - to.lng) < 0.000001) {
    return 0;
  }
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Helper: Haversine distance formula in km
export function calculateHaversineKm(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371;
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
}

// Create Uber-style animated car Leaflet DivIcon with heading rotation and dynamic label
function createDriverCarIcon(driverName: string, distanceLabel: string, headingDeg: number): L.DivIcon {
  const safeName = driverName || 'Darwin Barbosa';
  const labelText = `${safeName} - ${distanceLabel}`;

  const html = `
    <div class="relative flex flex-col items-center select-none pointer-events-auto" style="transform: translate(-50%, -50%);">
      <!-- Floating Label: "Darwin Barbosa - 0.4km" -->
      <div style="
        background: #0f172a;
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 9999px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
        border: 1.5px solid #38bdf8;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        transform: translateY(-2px);
      ">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #38bdf8; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span>${labelText}</span>
      </div>

      <!-- Rotating Vehicle Body -->
      <div style="
        width: 44px;
        height: 44px;
        transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        transform: rotate(${Math.round(headingDeg)}deg);
        filter: drop-shadow(0 6px 10px rgba(15, 23, 42, 0.4));
      ">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <!-- Vehicle Outer Shadow/Glow -->
          <ellipse cx="24" cy="24" rx="14" ry="18" fill="#0284c7" fill-opacity="0.25" />
          
          <!-- Car Body (Top-down view) -->
          <rect x="14" y="8" width="20" height="32" rx="8" fill="#1e293b" stroke="#f8fafc" stroke-width="2" />
          
          <!-- Windshield Front -->
          <path d="M16 17C16 15 18 13 24 13C30 13 32 15 32 17L31 21H17L16 17Z" fill="#38bdf8" />
          
          <!-- Roof -->
          <rect x="17" y="21" width="14" height="10" rx="2.5" fill="#0f172a" />
          
          <!-- Rear Window -->
          <path d="M17 31H31L30 34C30 35 28 36 24 36C20 36 18 35 18 34L17 31Z" fill="#0284c7" />
          
          <!-- Headlights -->
          <rect x="15" y="8" width="4" height="2" rx="1" fill="#fef08a" />
          <rect x="29" y="8" width="4" height="2" rx="1" fill="#fef08a" />
          
          <!-- Taillights -->
          <rect x="15" y="38" width="4" height="1.5" rx="0.75" fill="#ef4444" />
          <rect x="29" y="38" width="4" height="1.5" rx="0.75" fill="#ef4444" />
          
          <!-- Center Hood Accent -->
          <line x1="24" y1="9" x2="24" y2="12" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'en-camino-driver-icon',
    iconSize: [160, 80],
    iconAnchor: [80, 52],
  });
}

// Create Pulsing Green Pickup Pin Leaflet DivIcon: "Recogida: Universidad"
function createPickupPulsingIcon(pickupName: string): L.DivIcon {
  const safePickup = pickupName || 'Universidad';
  const labelText = `Recogida: ${safePickup}`;

  const html = `
    <div class="relative flex flex-col items-center select-none pointer-events-none" style="transform: translate(-50%, -100%);">
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
        box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4);
        border: 1.5px solid #34d399;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 4px;
      ">
        <span style="font-size: 11px;">📍</span>
        <span>${labelText}</span>
      </div>

      <!-- Pulsing Beacon Pin -->
      <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
        <!-- Pulsing radar wave -->
        <span style="
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: rgba(16, 185, 129, 0.35);
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></span>

        <!-- Secondary ring -->
        <span style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid rgba(16, 185, 129, 0.6);
        "></span>

        <!-- Solid central pin dot -->
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #10b981;
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'en-camino-pickup-icon',
    iconSize: [180, 70],
    iconAnchor: [90, 70],
  });
}

export const EnCaminoMap: React.FC<EnCaminoMapProps> = ({
  driverId,
  driverName = 'Darwin Barbosa',
  vehicleType = 'car',
  driverPos: initialDriverPos = null,
  recogidaPos,
  destinoPos = null,
  estado = 'EN_CAMINO_A_RECOGIDA',
  onCenterClick,
  className = 'w-full h-full min-h-[380px]',
  autoSimulateIfOffline = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Markers & Polyline references
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinoMarkerRef = useRef<L.Marker | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const routeSolidRef = useRef<L.Polyline | null>(null);
  const routeDashRef = useRef<L.Polyline | null>(null);

  // Live Driver Location state
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(() => {
    if (initialDriverPos && !isNaN(initialDriverPos.lat) && !isNaN(initialDriverPos.lng)) {
      return { lat: initialDriverPos.lat, lng: initialDriverPos.lng };
    }
    // Fallback: 1.3 km offset from pickup if not yet loaded
    return {
      lat: recogidaPos.lat + 0.008,
      lng: recogidaPos.lng - 0.007,
    };
  });

  const prevDriverLocationRef = useRef<{ lat: number; lng: number } | null>(driverLocation);
  const [heading, setHeading] = useState<number>(45);

  // Real route metrics calculated via OSRM
  const [routeInfo, setRouteInfo] = useState<{
    coords: [number, number][];
    distanceKm: number;
    durationMin: number;
  }>({
    coords: [],
    distanceKm: 1.3,
    durationMin: 2,
  });

  // State normalization
  const normalizedEstado = (estado || 'EN_CAMINO_A_RECOGIDA').toUpperCase();
  const isEnCamino =
    normalizedEstado === 'EN_CAMINO' ||
    normalizedEstado === 'EN_CAMINO_A_RECOGIDA' ||
    normalizedEstado === 'ACEPTADO' ||
    normalizedEstado === 'LLEGANDO';
  const isEnViaje = normalizedEstado === 'EN_VIAJE' || normalizedEstado === 'EN_TRANSITO';

  // 1. REQUERIMIENTO 1: SUSCRIPCIÓN A LA UBICACIÓN DEL CONDUCTOR (cada 3 segundos vía WebSocket / Firestore / Simulator)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let unsubscribeFirestore: (() => void) | null = null;
    let fallbackInterval: any = null;

    // A. Intentar WebSocket si el entorno lo provee
    if (typeof window !== 'undefined' && driverId) {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/driver/${driverId}`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
              setDriverLocation((prev) => {
                if (prev) {
                  const newHeading = calculateBearing(prev, { lat: data.lat, lng: data.lng });
                  if (newHeading !== 0) setHeading(newHeading);
                  prevDriverLocationRef.current = prev;
                }
                return { lat: data.lat, lng: data.lng };
              });
            }
          } catch {
            // Safe ignore ws malformed packets
          }
        };

        ws.onerror = () => {
          // Fallback silently to Firestore
        };
      } catch {
        // Fallback silently
      }
    }

    // B. Suscripción en tiempo real a Firestore doc 'drivers_location'
    if (driverId) {
      try {
        const docRef = doc(db, 'drivers_location', driverId);
        unsubscribeFirestore = onSnapshot(
          docRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (typeof data.lat === 'number' && typeof data.lng === 'number' && !isNaN(data.lat)) {
                setDriverLocation((prev) => {
                  if (prev) {
                    const newHeading = calculateBearing(prev, { lat: data.lat, lng: data.lng });
                    if (newHeading !== 0) setHeading(newHeading);
                    prevDriverLocationRef.current = prev;
                  }
                  return { lat: data.lat, lng: data.lng };
                });
              }
            }
          },
          (err) => {
            console.warn('Notice listening to driver location via Firestore:', err);
          }
        );
      } catch (err) {
        console.warn('Firestore subscription notice:', err);
      }
    }

    // C. Si no hay señal activa o para pruebas/demostración, actualización suave cada 3 segundos
    if (autoSimulateIfOffline) {
      let stepIndex = 0;
      fallbackInterval = setInterval(() => {
        setDriverLocation((curr) => {
          if (!curr) return { lat: recogidaPos.lat + 0.009, lng: recogidaPos.lng - 0.007 };

          // Calcular vector hacia el objetivo (recogida si está en camino, destino si está en viaje)
          const target = isEnViaje && destinoPos ? destinoPos : recogidaPos;
          const dLat = target.lat - curr.lat;
          const dLng = target.lng - curr.lng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          // Si ya está muy cerca (< 20 metros), mantener en posición con leve deriva
          if (dist < 0.0003) {
            return curr;
          }

          // Mover un paso cada 3 segundos a velocidad realista de conducción (~30 km/h)
          const stepRatio = Math.min(0.08, 0.00035 / (dist || 0.001));
          const nextLat = curr.lat + dLat * stepRatio;
          const nextLng = curr.lng + dLng * stepRatio;

          const newBearing = calculateBearing(curr, { lat: nextLat, lng: nextLng });
          if (newBearing !== 0) {
            setHeading(newBearing);
          }
          prevDriverLocationRef.current = curr;
          stepIndex++;

          return { lat: nextLat, lng: nextLng };
        });
      }, 3000);
    }

    return () => {
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [driverId, autoSimulateIfOffline, isEnViaje, destinoPos, recogidaPos]);

  // Si llega initialDriverPos externo explícito y es válido, sincronizar
  useEffect(() => {
    if (initialDriverPos && typeof initialDriverPos.lat === 'number' && !isNaN(initialDriverPos.lat)) {
      setDriverLocation((prev) => {
        if (prev) {
          const newBearing = calculateBearing(prev, initialDriverPos);
          if (newBearing !== 0) setHeading(newBearing);
          prevDriverLocationRef.current = prev;
        }
        return { lat: initialDriverPos.lat, lng: initialDriverPos.lng };
      });
    }
  }, [initialDriverPos?.lat, initialDriverPos?.lng]);

  // 2. CÁLCULO DE RUTA CON OSRM Y useMemo
  // Define punto objetivo: en EN_CAMINO es ESTRICTAMENTE recogidaPos. Solo en EN_VIAJE es destinoPos.
  const targetDestination = useMemo(() => {
    if (isEnViaje && destinoPos && !isNaN(destinoPos.lat) && !isNaN(destinoPos.lng)) {
      return destinoPos;
    }
    return recogidaPos;
  }, [isEnViaje, destinoPos, recogidaPos]);

  // Memoized fetcher para OSRM
  useEffect(() => {
    if (!driverLocation || !targetDestination) return;

    let isMounted = true;
    const cacheKey = `${driverLocation.lat.toFixed(4)},${driverLocation.lng.toFixed(4)}->${targetDestination.lat.toFixed(4)},${targetDestination.lng.toFixed(4)}`;

    if (osrmRouteCache.has(cacheKey)) {
      const cached = osrmRouteCache.get(cacheKey)!;
      setRouteInfo(cached);
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
            osrmRouteCache.set(cacheKey, result);
            setRouteInfo(result);
            return;
          }
        }
      } catch {
        // Fallback a cálculo matemático si OSRM está temporalmente saturado
      }

      if (isMounted) {
        const directKm = calculateHaversineKm(driverLocation, targetDestination);
        const roadKm = Math.round(directKm * 1.25 * 10) / 10;
        const estMin = Math.max(1, Math.round((roadKm / 26) * 60));

        // Interpolar línea recta suave de 8 puntos
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
        osrmRouteCache.set(cacheKey, fallbackResult);
        setRouteInfo(fallbackResult);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [driverLocation?.lat, driverLocation?.lng, targetDestination?.lat, targetDestination?.lng]);

  // Formatear distancia para el label del conductor: ej. "0.4km"
  const formattedDistanceLabel = useMemo(() => {
    return `${routeInfo.distanceKm}km`;
  }, [routeInfo.distanceKm]);

  // Formatear dirección / nombre de recogida: ej. "Recogida: Universidad"
  const pickupLabel = useMemo(() => {
    return recogidaPos.name || recogidaPos.address || 'Universidad';
  }, [recogidaPos.name, recogidaPos.address]);

  // 3. INICIALIZACIÓN DEL MAPA LEAFLET (Modo Mapa Claro, sin satelital, sin controles invasivos)
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      try {
        const startLat = driverLocation?.lat || recogidaPos.lat;
        const startLng = driverLocation?.lng || recogidaPos.lng;

        const map = L.map(containerRef.current, {
          center: [startLat, startLng],
          zoom: 15,
          zoomControl: false, // Sin botones flotantes que tapen el mapa
          attributionControl: false,
        });

        // Capa de mapa claro de alto contraste (CartoDB Positron / OSM Light)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);

        mapRef.current = map;

        // Invalidate size con delay para adaptarse al modal o contenedor
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

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  // 4. ACTUALIZAR MARCADORES Y RUTA SEGÚN EL ESTADO
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // A. MARCADOR DE RECOGIDA: Pin verde pulsante, label "Recogida: Universidad", NO arrastrable
    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = L.marker([recogidaPos.lat, recogidaPos.lng], {
        icon: createPickupPulsingIcon(pickupLabel),
        draggable: false,
        zIndexOffset: 800,
      }).addTo(map);
    } else {
      pickupMarkerRef.current.setLatLng([recogidaPos.lat, recogidaPos.lng]);
      pickupMarkerRef.current.setIcon(createPickupPulsingIcon(pickupLabel));
    }

    // B. MARCADOR DEL CONDUCTOR: Icono de carro con rotación de heading y label "Darwin Barbosa - 0.4km"
    if (driverLocation && !isNaN(driverLocation.lat) && !isNaN(driverLocation.lng)) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], {
          icon: createDriverCarIcon(driverName, formattedDistanceLabel, heading),
          draggable: false,
          zIndexOffset: 1200,
        }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
        driverMarkerRef.current.setIcon(createDriverCarIcon(driverName, formattedDistanceLabel, heading));
      }
    }

    // C. REQUERIMIENTO ESTRICTO: NUNCA mostrar el marcador de Destino ni la ruta hacia el destino cuando estado == EN_CAMINO
    if (isEnCamino) {
      // Ocultar marcador de destino
      if (destinoMarkerRef.current) {
        map.removeLayer(destinoMarkerRef.current);
        destinoMarkerRef.current = null;
      }
    } else if (isEnViaje && destinoPos && !isNaN(destinoPos.lat) && !isNaN(destinoPos.lng)) {
      // Solo mostrar marcador de destino en estado EN_VIAJE
      if (!destinoMarkerRef.current) {
        const destIcon = L.divIcon({
          html: `
            <div class="flex flex-col items-center select-none pointer-events-none" style="transform: translate(-50%, -100%);">
              <div style="background: #991b1b; color: white; padding: 4px 9px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1.5px solid #f87171; box-shadow: 0 4px 10px rgba(0,0,0,0.3); margin-bottom: 2px;">
                🏁 Destino: ${destinoPos.name || destinoPos.address || 'Final'}
              </div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: #dc2626; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
            </div>
          `,
          className: 'en-camino-dest-icon',
          iconSize: [160, 60],
          iconAnchor: [80, 60],
        });

        destinoMarkerRef.current = L.marker([destinoPos.lat, destinoPos.lng], {
          icon: destIcon,
          draggable: false,
        }).addTo(map);
      } else {
        destinoMarkerRef.current.setLatLng([destinoPos.lat, destinoPos.lng]);
      }
    }

    // D. REQUERIMIENTO 4: TRAZAR RUTA (Línea azul sólida de 5px, con borde blanco y animación dash)
    const pointsToDraw = routeInfo.coords.length >= 2 
      ? routeInfo.coords 
      : driverLocation 
      ? [[driverLocation.lat, driverLocation.lng], [targetDestination.lat, targetDestination.lng]] as [number, number][]
      : [];

    if (pointsToDraw.length >= 2) {
      // Capa 1: Borde blanco (Casing)
      if (!routeCasingRef.current) {
        routeCasingRef.current = L.polyline(pointsToDraw, {
          color: '#ffffff',
          weight: 9,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routeCasingRef.current.setLatLngs(pointsToDraw);
      }

      // Capa 2: Línea azul sólida de 5px
      if (!routeSolidRef.current) {
        routeSolidRef.current = L.polyline(pointsToDraw, {
          color: '#2563eb', // Azul sólido
          weight: 5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        routeSolidRef.current.setLatLngs(pointsToDraw);
      }

      // Capa 3: Animación de dash para indicar dirección
      if (!routeDashRef.current) {
        routeDashRef.current = L.polyline(pointsToDraw, {
          color: '#93c5fd', // Azul celeste luminoso
          weight: 3,
          opacity: 0.9,
          dashArray: '8, 16',
          className: 'animated-route-flow',
        }).addTo(map);
      } else {
        routeDashRef.current.setLatLngs(pointsToDraw);
      }

      // E. REQUERIMIENTO 3: AUTO-FIT BOUNDS con padding: 80
      try {
        const boundsPoints: [number, number][] = [];
        if (driverLocation) boundsPoints.push([driverLocation.lat, driverLocation.lng]);
        boundsPoints.push([recogidaPos.lat, recogidaPos.lng]);

        const bounds = L.latLngBounds(boundsPoints);
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [80, 80],
            maxZoom: 17,
            animate: true,
          });
        }
      } catch (e) {
        console.warn('fitBounds notice:', e);
      }
    }
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    heading,
    driverName,
    formattedDistanceLabel,
    recogidaPos.lat,
    recogidaPos.lng,
    pickupLabel,
    isEnCamino,
    isEnViaje,
    destinoPos,
    targetDestination,
    routeInfo.coords,
  ]);

  // Botón ÚNICO de centrar en mi ubicación abajo a la derecha
  const handleCenterOnLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (onCenterClick) {
      onCenterClick();
    }

    if (driverLocation && recogidaPos) {
      const bounds = L.latLngBounds([
        [driverLocation.lat, driverLocation.lng],
        [recogidaPos.lat, recogidaPos.lng],
      ]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17, animate: true });
    } else if (driverLocation) {
      map.flyTo([driverLocation.lat, driverLocation.lng], 16, { animate: true });
    } else {
      map.flyTo([recogidaPos.lat, recogidaPos.lng], 16, { animate: true });
    }
  }, [driverLocation, recogidaPos, onCenterClick]);

  return (
    <div className={`relative w-full overflow-hidden rounded-[2rem] bg-slate-50 border border-slate-200/90 shadow-xl ${className}`}>
      {/* Contenedor del Mapa Leaflet */}
      <div ref={containerRef} className="w-full h-full min-h-[380px] z-0" />

      {/* REQUERIMIENTO 3: QUITA TODOS LOS BOTONES FLOTANTES. DEJA SOLO 1 CONTROL: CENTRAR EN MI UBICACIÓN ABAJO A LA DERECHA */}
      <button
        type="button"
        onClick={handleCenterOnLocation}
        className="absolute bottom-24 right-4 z-[400] w-12 h-12 rounded-2xl bg-white hover:bg-slate-50 active:scale-95 text-slate-800 shadow-xl border border-slate-200 flex items-center justify-center transition-all cursor-pointer group"
        title="Centrar conductor y recogida"
        aria-label="Centrar en mi ubicación"
      >
        <LocateFixed size={20} className="text-blue-600 group-hover:scale-110 transition-transform" />
      </button>

      {/* REQUERIMIENTO 3: BARRA INFERIOR FLOTANTE OSCURA: "📍 1.3 km | ⏱️ 2 min" CALCULADA DESDE LA RUTA REAL */}
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
    </div>
  );
};

export default EnCaminoMap;
