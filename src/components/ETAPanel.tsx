import React, { useEffect, useState, useRef } from 'react';
import { Clock, Navigation, MapPin } from 'lucide-react';

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface ETAPanelProps {
  driverLocation?: LocationPoint | string | null;
  destination?: LocationPoint | string | null;
  role?: 'user' | 'driver' | 'conductor' | 'pasajero' | string;
  promisedMinutes?: number;
  className?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function ETAPanel({
  driverLocation,
  destination,
  role = 'user',
  promisedMinutes = 5,
  className = ''
}: ETAPanelProps) {
  const [etaMinutes, setEtaMinutes] = useState<number>(promisedMinutes || 5);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const lastCallRef = useRef<number>(0);

  const calculateETA = async () => {
    if (!driverLocation || !destination || !window.google || !window.google.maps) {
      return;
    }

    // SOLO CADA 10 MINUTOS (600,000 ms)
    const now = Date.now();
    if (now - lastCallRef.current < 600000 && lastCallRef.current !== 0) {
      return;
    }
    lastCallRef.current = now;

    try {
      setIsLoading(true);
      const directionsService = new window.google.maps.DirectionsService();
      
      const originParam = typeof driverLocation === 'object' && 'lat' in driverLocation
        ? new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng)
        : driverLocation;

      const destParam = typeof destination === 'object' && 'lat' in destination
        ? new window.google.maps.LatLng(destination.lat, destination.lng)
        : destination;

      const result = await directionsService.route({
        origin: originParam,
        destination: destParam,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date()
        }
      });

      if (result && result.routes && result.routes[0] && result.routes[0].legs && result.routes[0].legs[0]) {
        const leg = result.routes[0].legs[0];
        const durationValue = leg.duration_in_traffic?.value || leg.duration?.value || 0;
        const durationInMinutes = Math.max(1, Math.round(durationValue / 60));
        setEtaMinutes(durationInMinutes);
      }
    } catch (error) {
      console.error('Error calculando ETA:', error);
      if (promisedMinutes) {
        setEtaMinutes(promisedMinutes);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // CALCULA AL INICIO Y CADA 10 MIN
  useEffect(() => {
    calculateETA();
    const interval = setInterval(calculateETA, 600000);
    return () => clearInterval(interval);
  }, [driverLocation, destination]);

  useEffect(() => {
    if (promisedMinutes && lastCallRef.current === 0) {
      setEtaMinutes(promisedMinutes);
    }
  }, [promisedMinutes]);

  const isDriver = role === 'driver' || role === 'conductor';

  return (
    <div
      id="eta-panel-container"
      className={`bg-white border border-emerald-100/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm transition-all duration-300 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            {isDriver ? <Navigation className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isDriver ? 'Tiempo Estimado de Ruta' : 'Llegada Estimada'}
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                ~{etaMinutes}
              </span>
              <span className="text-sm font-semibold text-slate-600">
                {etaMinutes === 1 ? 'minuto' : 'minutos'}
              </span>
              {isLoading && (
                <span className="text-[10px] text-emerald-600 animate-pulse font-medium ml-1">
                  (actualizando...)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-200/50">
            <MapPin className="w-3 h-3 text-emerald-600" />
            Tráfico en vivo
          </span>
          <p className="text-[10px] text-slate-400 mt-1">
            Sin contador regresivo
          </p>
        </div>
      </div>
    </div>
  );
}
