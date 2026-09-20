import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { MapComponent, isValidPos, calculateHaversineKm } from './MapComponent';

const FUSAGASUGA_CENTER = { lat: 4.3364, lng: -74.3638 };

interface DriverLiveMapProps {
  driverId: string;
  driverName?: string;
  vehicleType?: string;
  isOnline?: boolean;
  origen?: { lat: number; lng: number; address?: string } | null;
  destino?: { lat: number; lng: number; address?: string } | null;
  showRoute?: boolean;
  status?: string;
}

export const DriverLiveMap: React.FC<DriverLiveMapProps> = ({
  driverId,
  driverName = 'Conductor',
  vehicleType = 'carro',
  isOnline = true,
  origen = null,
  destino = null,
  showRoute = false,
  status,
}) => {
  const [position, setPosition] = useState<{ lat: number; lng: number }>(FUSAGASUGA_CENTER);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSavedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // Guardar ubicación en Firestore con throttle inteligente para no saturar base de datos
  const saveLocationToFirestore = useCallback(
    async (lat: number, lng: number) => {
      if (!driverId || !isValidPos({ lat, lng })) return;

      const now = Date.now();
      // Throttle: Guardar si se movió más de 15 metros O han pasado al menos 5 segundos
      if (lastSavedPosRef.current) {
        const movedKm = calculateHaversineKm(lastSavedPosRef.current, { lat, lng });
        const timeSinceLastSave = now - lastSaveTimeRef.current;
        if (movedKm < 0.015 && timeSinceLastSave < 5000) {
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

  // Escuchar ubicación previa guardada en Firestore si no se ha detectado el GPS local
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

  // Rastrear posición GPS del conductor con alta precisión
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoError('La geolocalización no está soportada por el navegador.');
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 2000,
    };

    const handleSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (isValidPos({ lat, lng })) {
        const newPos = { lat, lng };
        setPosition(newPos);
        setGeoError(null);
        saveLocationToFirestore(lat, lng);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation notice:', err.message);
      setGeoError('Buscando señal GPS... Por favor activa la ubicación en tu dispositivo.');
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [saveLocationToFirestore]);

  // Distancia del conductor al objetivo: destino si va en tránsito, o punto de recogida si va hacia el pasajero
  const isEnTransito = status === 'en_transito';
  const targetPoint = isEnTransito ? (destino || origen) : (origen || destino);
  const distanceToTarget =
    targetPoint && isValidPos(targetPoint) && isValidPos(position)
      ? calculateHaversineKm(position, targetPoint)
      : null;

  return (
    <div className="w-full space-y-3 notranslate" translate="no">
      {/* Alerta de GPS si no hay señal */}
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

      {/* Barra de Estado del GPS del Conductor */}
      <div className="flex flex-wrap items-center justify-between bg-slate-900 text-white p-3 rounded-2xl text-xs font-semibold gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border-2 border-slate-900"></span>
          <span>
            {isEnTransito ? 'Ruta a Destino en Vivo' : 'Rastreo GPS en Tiempo Real'} • {driverName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {distanceToTarget !== null && (
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
              📍 {distanceToTarget} km {isEnTransito ? 'al destino' : 'al pasajero'}
            </span>
          )}
          <span className="text-[10px] text-slate-300 font-mono">
            {lastUpdated ? `GPS: ${lastUpdated}` : 'Conectando satélites...'}
          </span>
        </div>
      </div>

      {/* Componente de Mapa OpenStreetMap */}
      <MapComponent
        center={position}
        zoom={15}
        driverPos={position}
        driverName={driverName}
        vehicleType={vehicleType}
        origen={origen || undefined}
        destino={destino || undefined}
        showRoute={showRoute || !!origen}
        className="w-full h-[380px] sm:h-[420px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative"
      />

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
