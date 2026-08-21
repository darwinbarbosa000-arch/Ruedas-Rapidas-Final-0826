import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { MapComponent } from './MapComponent';

const FUSAGASUGA_CENTER = { lat: 4.3364, lng: -74.3638 };

export interface RidePoint {
  lat?: number;
  lng?: number;
  address?: string;
}

interface RideTrackerProps {
  driverId: string;
  driverName?: string;
  vehicleType?: string;
  passengerPoint?: RidePoint | null;
  destinationPoint?: RidePoint | null;
}

const isValidPos = (pos: any): boolean => {
  return (
    pos !== null &&
    pos !== undefined &&
    typeof pos.lat === 'number' &&
    typeof pos.lng === 'number' &&
    !isNaN(pos.lat) &&
    !isNaN(pos.lng)
  );
};

export const RideTracker: React.FC<RideTrackerProps> = ({
  driverId,
  driverName = 'Conductor',
  vehicleType,
  passengerPoint = null,
  destinationPoint = null,
}) => {
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Escuchar ubicación del conductor en Firestore en tiempo real
  useEffect(() => {
    if (!driverId) return;

    const docRef = doc(db, 'drivers_location', driverId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.lat !== undefined && data.lng !== undefined) {
            const lat = Number(data.lat);
            const lng = Number(data.lng);
            if (isValidPos({ lat, lng })) {
              const newDriverPos = { lat, lng };
              setDriverLocation(newDriverPos);
              setLastUpdated(data.timestamp ? new Date(data.timestamp).toLocaleTimeString('es-CO') : new Date().toLocaleTimeString('es-CO'));
            }
          }
        }
      },
      (err) => {
        console.error('Error al escuchar ubicación de conductor:', err);
      }
    );

    return () => unsubscribe();
  }, [driverId]);

  // Distancia y Tiempo Estimado de Llegada (ETA del conductor al objetivo: destino si va en tránsito, o punto de recogida)
  const isEnTransito = !!(destinationPoint && isValidPos(destinationPoint));
  const targetPoint = isEnTransito ? destinationPoint : passengerPoint;
  const targetLat = targetPoint?.lat;
  const targetLng = targetPoint?.lng;

  let etaMins = 0;
  let distKm = 0;

  if (isValidPos(driverLocation) && typeof targetLat === 'number' && typeof targetLng === 'number' && !isNaN(targetLat) && !isNaN(targetLng)) {
    const R = 6371; // km
    const dLat = (targetLat - driverLocation!.lat) * (Math.PI / 180);
    const dLon = (targetLng - driverLocation!.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(driverLocation!.lat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distRaw = R * c;
    distKm = Math.round((distRaw > 0 ? distRaw : 0.5) * 10) / 10;
    etaMins = Math.max(1, Math.round((distKm / 20) * 60));
  } else {
    distKm = 1.2;
    etaMins = 3;
  }

  // Determinar centro por defecto del mapa
  const mapCenter = isValidPos(driverLocation) && driverLocation
    ? driverLocation
    : passengerPoint && typeof passengerPoint.lat === 'number' && typeof passengerPoint.lng === 'number'
    ? { lat: passengerPoint.lat, lng: passengerPoint.lng }
    : FUSAGASUGA_CENTER;

  const validOrigen = passengerPoint && typeof passengerPoint.lat === 'number' && typeof passengerPoint.lng === 'number'
    ? { lat: passengerPoint.lat, lng: passengerPoint.lng, address: passengerPoint.address }
    : null;

  const validDestino = destinationPoint && typeof destinationPoint.lat === 'number' && typeof destinationPoint.lng === 'number'
    ? { lat: destinationPoint.lat, lng: destinationPoint.lng, address: destinationPoint.address }
    : null;

  return (
    <div className="w-full space-y-3 notranslate" translate="no">
      {/* Banner de Tiempo de Llegada y Estado en Vivo */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-md border border-white/10 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold text-xs tracking-tight text-emerald-400 truncate">
              {driverName ? `Conductor ${driverName}` : 'Conductor'} {isEnTransito ? 'en trayecto a tu destino' : 'en camino a tu ubicación'}
            </span>
          </div>
          <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0">
            {lastUpdated ? `GPS: ${lastUpdated}` : 'GPS Activo'}
          </span>
        </div>

        {/* Tarjetas Compactas de ETA & Distancia */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-base">
              ⏱️
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase text-emerald-300 tracking-wider block leading-none">Llegada Est.</span>
              <p className="text-sm sm:text-base font-black text-white font-mono leading-tight mt-0.5">
                ~{etaMins} <span className="text-[10px] font-sans font-bold text-emerald-300">min</span>
              </p>
            </div>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-base">
              📍
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase text-indigo-300 tracking-wider block leading-none">
                {isEnTransito ? 'Dist. a Destino' : 'Dist. a Conductor'}
              </span>
              <p className="text-sm sm:text-base font-black text-white font-mono leading-tight mt-0.5">
                {distKm} <span className="text-[10px] font-sans font-bold text-indigo-300">KM</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta si falta ubicación GPS del conductor */}
      {!driverLocation && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-2xl flex items-center gap-2">
          <span>📡 Esperando señal GPS del conductor en tiempo real...</span>
        </div>
      )}

      {/* Componente de mapa unificado con mayor área de visualización */}
      <MapComponent
        center={mapCenter}
        zoom={14}
        origen={validOrigen}
        destino={validDestino}
        driverPos={driverLocation}
        driverName={driverName}
        vehicleType={vehicleType}
        showRoute={true}
        className="w-full h-[380px] sm:h-[430px] rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative"
      />
    </div>
  );
};

export default RideTracker;
