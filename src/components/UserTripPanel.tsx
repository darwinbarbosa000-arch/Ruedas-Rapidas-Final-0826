import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface UserTripPanelProps {
  trip?: {
    id: string;
    status?: string;
    estado?: string;
    conductorId?: string;
    conductorNombre?: string;
    driverName?: string;
    calificado?: boolean;
    fecha_aceptacion?: string;
    tiempo_llegada?: number;
    [key: string]: any;
  };
  driverLocation?: LocationPoint | string | null;
  destination?: LocationPoint | string | null;
  promisedMinutes?: number;
  startTime?: string;
  onSendRating?: (tripId: string, rating: number, comment: string | null) => Promise<void>;
}

export default function UserTripPanel({
  trip,
  driverLocation,
  destination,
  promisedMinutes = 5,
  startTime,
  onSendRating
}: UserTripPanelProps) {
  const [etaMinutes, setEtaMinutes] = useState<number>(promisedMinutes || 5);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastCallRef = useRef<number>(0);

  const tripId = trip?.id;
  const tripStatus = trip?.status || trip?.estado;
  const driverDisplayName = trip?.driverName || trip?.conductorNombre || 'tu conductor';

  const labels: Record<number, string> = {
    1: 'MUY MALO',
    2: 'MALO',
    3: 'REGULAR',
    4: 'MUY BUENO',
    5: 'EXCELENTE'
  };

  // REGLA CLAVE: Solo mostrar si es menor a 3
  const needsComment = rating > 0 && rating < 3;
  const canSubmit = rating > 0 && (!needsComment || comment.trim().length >= 10);

  useEffect(() => {
    // 1. SOLO SI EL VIAJE FINALIZÓ
    if (!tripId || tripStatus !== 'finalizado') return;

    // 2. REVISAR SI YA CALIFICAMOS ESTE VIAJE EN LOCALSTORAGE
    try {
      const ratedTrips = JSON.parse(localStorage.getItem('ratedTrips') || '[]');
      const alreadyRated = ratedTrips.includes(tripId);

      // 3. SI NO LO HEMOS CALIFICADO Y NO ESTÁ ABIERTO, ABRIRLO
      if (!alreadyRated && !showRatingModal) {
        setShowRatingModal(true);
      }
    } catch (e) {
      console.error("Error reading ratedTrips from localStorage", e);
    }
  }, [tripStatus, tripId, showRatingModal]);

  const handleSubmit = async () => {
    if (!canSubmit || !tripId) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const commentToSend = needsComment ? comment.trim() : null;

    try {
      if (onSendRating) {
        await onSendRating(tripId, rating, commentToSend || '');
      } else {
        await fetch('/api/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId, rating, comment: commentToSend })
        }).catch(() => {});
      }

      // 4. GUARDAR QUE YA CALIFICAMOS ESTE VIAJE
      const ratedTrips = JSON.parse(localStorage.getItem('ratedTrips') || '[]');
      if (!ratedTrips.includes(tripId)) {
        ratedTrips.push(tripId);
        localStorage.setItem('ratedTrips', JSON.stringify(ratedTrips));
      }

      setShowRatingModal(false);
    } catch (err: any) {
      console.error('Error enviando calificación:', err);
      setErrorMsg('No se pudo guardar la calificación. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    // Si cierra sin enviar, igual marcarlo para que no salga 2 veces
    if (tripId) {
      try {
        const ratedTrips = JSON.parse(localStorage.getItem('ratedTrips') || '[]');
        if (!ratedTrips.includes(tripId)) {
          ratedTrips.push(tripId);
          localStorage.setItem('ratedTrips', JSON.stringify(ratedTrips));
        }
      } catch (e) {
        console.error("Error updating localStorage", e);
      }
    }
    setShowRatingModal(false);
  };

  const calculateETA = async () => {
    if (!driverLocation || !destination || !(window as any).google || !(window as any).google.maps) {
      return;
    }

    // SOLO CADA 10 MINUTOS (600,000 ms)
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

  return (
    <>
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

      {/* MODAL ÚNICO DE CALIFICACIÓN */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-slate-100">
            
            <div className="flex justify-end mb-2">
              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                ⭐ OBLIGATORIO
              </span>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-slate-900">
              Califica tu Servicio
            </h2>
            <p className="text-gray-500 text-center mb-5 text-sm">
              Cuéntanos tu experiencia con {driverDisplayName}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ESTRELLAS */}
            <div className="flex justify-center gap-3 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition transform hover:scale-110 active:scale-95 p-1"
                >
                  <svg
                    className={`w-10 h-10 transition ${
                      rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'
                    }`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>

            {/* LABEL */}
            {rating > 0 && (
              <p
                className="text-center text-sm font-bold mb-4 tracking-wide"
                style={{ color: rating < 3 ? '#DC2626' : '#D97706' }}
              >
                {labels[rating]}
              </p>
            )}

            {/* COMENTARIO - SOLO RENDERIZA SI < 3 */}
            {needsComment && (
              <div className="animate-fadeIn mb-4">
                <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-2">
                  <span>¿QUÉ PODEMOS MEJORAR?</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Mín. 10 caracteres)
                  </span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Cuéntanos brevemente qué ocurrió para ayudarnos a mejorar..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {comment.trim().length < 10 && rating > 0 && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Por favor escribe al menos 10 caracteres ({comment.trim().length}/10).
                  </p>
                )}
              </div>
            )}

            {/* ACCIONES */}
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md ${
                  canSubmit && !isSubmitting
                    ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Enviar Calificación</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Omitir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { UserTripPanel };
