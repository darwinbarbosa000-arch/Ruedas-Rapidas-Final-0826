import React, { useState, useEffect, useRef } from 'react';

export interface CountdownTimerProps {
  startTime?: string;
  promisedMinutes?: number;
  onTimeUp?: () => void;
  driverLocation?: any;
  destination?: any;
}

/**
 * Panel ETA estático (sin cuenta regresiva segundo a segundo)
 * Se actualiza periódicamente vía Google Directions API cada 10 minutos.
 */
export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  startTime,
  promisedMinutes = 5,
  driverLocation,
  destination
}) => {
  const [etaMinutes, setEtaMinutes] = useState<number>(promisedMinutes || 5);
  const lastCallRef = useRef<number>(0);

  const calculateETA = async () => {
    if (!driverLocation || !destination || !(window as any).google || !(window as any).google.maps) {
      return;
    }

    const now = Date.now();
    if (now - lastCallRef.current < 600000 && lastCallRef.current !== 0) {
      return;
    }
    lastCallRef.current = now;

    try {
      const directionsService = new (window as any).google.maps.DirectionsService();
      const originParam = typeof driverLocation === 'object' && 'lat' in driverLocation
        ? new (window as any).google.maps.LatLng(driverLocation.lat, driverLocation.lng)
        : driverLocation;

      const destParam = typeof destination === 'object' && 'lat' in destination
        ? new (window as any).google.maps.LatLng(destination.lat, destination.lng)
        : destination;

      const result = await directionsService.route({
        origin: originParam,
        destination: destParam,
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date() }
      });

      if (result?.routes?.[0]?.legs?.[0]) {
        const leg = result.routes[0].legs[0];
        const durationValue = leg.duration_in_traffic?.value || leg.duration?.value || 0;
        const durationInMinutes = Math.max(1, Math.round(durationValue / 60));
        setEtaMinutes(durationInMinutes);
      }
    } catch (error) {
      console.error("Error ETA", error);
      if (promisedMinutes) {
        setEtaMinutes(promisedMinutes);
      }
    }
  };

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

  return (
    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <p className="text-sm text-blue-600 font-semibold">LLEGA EN</p>
            <p className="text-3xl font-bold text-blue-700">~{etaMinutes} min</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">PROMETIDO</p>
          <p className="text-sm font-semibold text-gray-800">{promisedMinutes} min</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">Se actualiza cada 10 min</p>
      <div className="mt-3 h-2 bg-blue-200 rounded-full">
        <div className="h-2 bg-blue-600 rounded-full" style={{ width: '70%' }}></div>
      </div>
    </div>
  );
};

export default CountdownTimer;
