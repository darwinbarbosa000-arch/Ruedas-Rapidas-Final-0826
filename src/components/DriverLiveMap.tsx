import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { MapComponent } from './MapComponent';

const FUSAGASUGA_CENTER = { lat: 4.3364, lng: -74.3638 };

interface DriverLiveMapProps {
  driverId: string;
  driverName?: string;
  isOnline?: boolean;
  origen?: { lat: number; lng: number; address?: string } | null;
  destino?: { lat: number; lng: number; address?: string } | null;
  showRoute?: boolean;
}

const isValidPos = (pos: any): pos is { lat: number; lng: number } => {
  return (
    pos !== null &&
    pos !== undefined &&
    typeof pos.lat === 'number' &&
    typeof pos.lng === 'number' &&
    !isNaN(pos.lat) &&
    !isNaN(pos.lng)
  );
};

export const DriverLiveMap: React.FC<DriverLiveMapProps> = ({
  driverId,
  driverName = 'Conductor',
  isOnline = true,
  origen = null,
  destino = null,
  showRoute = false,
}) => {
  // Inicializar con Fusagasugá como centro regional predeterminado (Base ItalBusiness)
  const [position, setPosition] = useState<{ lat: number; lng: number }>(FUSAGASUGA_CENTER);

  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // Guardar ubicación en Firestore sólo cuando hay coordenadas GPS reales
  const saveLocationToFirestore = useCallback(
    async (lat: number, lng: number) => {
      if (!driverId || !isValidPos({ lat, lng })) return;
      try {
        setIsSaving(true);
        const docRef = doc(db, 'drivers_location', driverId);
        await setDoc(
          docRef,
          {
            driverId,
            driverName,
            lat,
            lng,
            timestamp: new Date().toISOString(),
            isOnline,
          },
          { merge: true }
        );
        setLastUpdated(new Date().toLocaleTimeString('es-CO'));
      } catch (err) {
        console.error('Error al guardar ubicación de conductor en Firestore:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [driverId, driverName, isOnline]
  );

  // Cargar primero la ubicación guardada en Firestore si existe
  useEffect(() => {
    if (!driverId) return;
    const docRef = doc(db, 'drivers_location', driverId);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (isValidPos({ lat: data.lat, lng: data.lng })) {
          setPosition({ lat: data.lat, lng: data.lng });
          if (data.timestamp) {
            try {
              setLastUpdated(new Date(data.timestamp).toLocaleTimeString('es-CO'));
            } catch {
              // ignore date parse error
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, [driverId]);

  // Rastrear posición GPS del dispositivo con alta precisión e inmediata adquisición
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('La geolocalización no está soportada por tu navegador.');
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000,
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
      console.warn('Geolocation error:', err.message);
      setGeoError('Obteniendo señal GPS... Asegúrate de permitir el acceso a tu ubicación.');
    };

    // Obtener la posición actual de inmediato
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);

    // Iniciar rastreo continuo
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      geoOptions
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [saveLocationToFirestore]);

  return (
    <div className="w-full space-y-3 notranslate" translate="no">
      {/* Alerta de error si existe */}
      {geoError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-2xl flex items-center justify-between">
          <span>⚠️ {geoError}</span>
          <button
            type="button"
            onClick={() => setGeoError(null)}
            className="text-amber-900 font-bold ml-2 underline text-[10px]"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Estado del Riego GPS */}
      <div className="flex items-center justify-between bg-slate-900 text-white p-3 rounded-2xl text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse border-2 border-slate-900"></span>
          <span>Rastreo GPS en Tiempo Real ({driverName})</span>
        </div>
        <div className="text-[10px] text-slate-300 font-mono">
          {lastUpdated ? `Actualizado: ${lastUpdated}` : 'Conectando GPS...'}
        </div>
      </div>

      {/* Componente de mapa unificado para conductor (muestra sólo ubicación del conductor y punto de recogida del cliente) */}
      <MapComponent
        center={position}
        zoom={15}
        driverPos={position}
        driverName={driverName}
        origen={origen || undefined}
        destino={null}
        showRoute={showRoute || !!origen}
        className="w-full h-[380px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative"
      />

      {/* Coordenadas en tiempo real */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Tu Posición GPS Actual:</span>
          <p className="font-mono text-slate-800 font-bold mt-0.5">
            {isValidPos(position) ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : 'Obteniendo GPS...'}
          </p>
        </div>
        {isSaving && (
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            Sincronizando...
          </span>
        )}
      </div>
    </div>
  );
};

export default DriverLiveMap;
