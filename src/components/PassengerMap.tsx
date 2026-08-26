import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapComponent, MapPoint, isValidPos } from './MapComponent';

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
}

export interface LocationSelectData {
  origen: LocationPoint | null;
  destino: LocationPoint | null;
}

interface PassengerMapProps {
  onLocationSelect?: (data: LocationSelectData) => void;
  initialOrigen?: LocationPoint | null;
  initialDestino?: LocationPoint | null;
  driverPos?: LocationPoint | null;
  driverName?: string;
  vehicleType?: string;
  isServiceActive?: boolean;
}

const FUSA_CENTER = { lat: 4.3364, lng: -74.3638 };

// Lugares populares y puntos clave de referencia rápida (Agro / Urbano)
const QUICK_DESTINATIONS = [
  { name: 'Centro / Plaza Mayor', lat: 4.3364, lng: -74.3638 },
  { name: 'Terminal de Transportes', lat: 4.3398, lng: -74.3725 },
  { name: 'Centro de Acopio Italcol', lat: 4.3452, lng: -74.3580 },
  { name: 'Hospital San Rafael', lat: 4.3315, lng: -74.3670 },
  { name: 'Plaza de Mercado / Feria', lat: 4.3340, lng: -74.3610 },
];

export const PassengerMap: React.FC<PassengerMapProps> = ({
  onLocationSelect,
  initialOrigen = null,
  initialDestino = null,
  driverPos = null,
  driverName = 'Conductor en camino',
  vehicleType,
  isServiceActive = false,
}) => {
  const [center, setCenter] = useState<{ lat: number; lng: number }>(FUSA_CENTER);
  const [origen, setOrigen] = useState<LocationPoint | null>(initialOrigen);
  const [destino, setDestino] = useState<LocationPoint | null>(initialDestino);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [selectionMode, setSelectionMode] = useState<'destino' | 'origen'>('destino');

  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  // Función para obtener/actualizar la ubicación GPS en tiempo real con alta precisión
  const handleDetectLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocalización no soportada por el navegador.');
      setIsLocating(false);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        if (isValidPos({ lat: userLat, lng: userLng })) {
          const userPos = { lat: userLat, lng: userLng };
          setCenter(userPos);

          const autoOrigen: LocationPoint = {
            lat: userLat,
            lng: userLng,
            address: origen?.address || `Tu Ubicación GPS (${userLat.toFixed(4)}, ${userLng.toFixed(4)})`,
          };

          setOrigen(autoOrigen);
          setGeoError(null);

          if (onLocationSelectRef.current) {
            onLocationSelectRef.current({ origen: autoOrigen, destino });
          }
        }
        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation notice:', error.message);
        setGeoError('GPS no disponible. Usando ubicación predeterminada.');
        setCenter(FUSA_CENTER);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [destino, origen?.address]);

  // Autodetectar ubicación al montar
  useEffect(() => {
    handleDetectLocation();
  }, []);

  // Al hacer clic en el mapa según el modo seleccionado (destino u origen)
  const handlePointSelect = (point: MapPoint, mode: 'origen' | 'destino') => {
    if (mode === 'origen') {
      const newOrigen: LocationPoint = {
        lat: point.lat,
        lng: point.lng,
        address: point.address || `Punto de Recogida (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`,
      };
      setOrigen(newOrigen);
      setSelectionMode('destino'); // Cambiar automáticamente al siguiente paso: elegir destino

      if (onLocationSelectRef.current) {
        onLocationSelectRef.current({ origen: newOrigen, destino });
      }
    } else {
      const newDestino: LocationPoint = {
        lat: point.lat,
        lng: point.lng,
        address: point.address || `Destino Seleccionado (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`,
      };
      setDestino(newDestino);

      if (onLocationSelectRef.current) {
        onLocationSelectRef.current({ origen, destino: newDestino });
      }
    }
  };

  // Fijar destino rápido desde la lista de puntos clave
  const handleQuickDestinationSelect = (item: { name: string; lat: number; lng: number }) => {
    const newDest: LocationPoint = {
      lat: item.lat,
      lng: item.lng,
      address: item.name,
    };
    setDestino(newDest);
    setCenter({ lat: item.lat, lng: item.lng });

    if (onLocationSelectRef.current) {
      onLocationSelectRef.current({ origen, destino: newDest });
    }
  };

  return (
    <div className="w-full space-y-3 notranslate" translate="no">
      {/* Alerta de GPS si no está disponible */}
      {geoError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-2xl flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <span>⚠️</span>
            <span>{geoError}</span>
          </span>
          <button
            type="button"
            onClick={handleDetectLocation}
            className="text-amber-800 font-bold ml-2 underline text-[10px] hover:text-amber-950 cursor-pointer"
          >
            Reintentar GPS
          </button>
        </div>
      )}

      {/* Selector de Modo de Fijación en el Mapa */}
      <div className="flex items-center justify-between bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setSelectionMode('origen')}
          className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            selectionMode === 'origen'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🟢</span>
          <span>Fijar Recogida</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectionMode('destino')}
          className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            selectionMode === 'destino'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🔴</span>
          <span>Fijar Destino</span>
        </button>
      </div>

      {/* Contenedor del Mapa con OpenStreetMap */}
      <div className="relative w-full rounded-3xl overflow-hidden shadow-lg border border-slate-200">
        <MapComponent
          center={center}
          zoom={15}
          origen={origen}
          destino={destino}
          driverPos={driverPos}
          driverName={driverName}
          vehicleType={vehicleType}
          mode={selectionMode}
          onPointSelect={handlePointSelect}
          showRoute={true}
          className="w-full h-[360px] sm:h-[400px] relative"
        />

        {/* Botón flotante Mi Ubicación */}
        <button
          type="button"
          onClick={handleDetectLocation}
          title="Centrar en mi ubicación GPS"
          className="absolute top-4 left-4 z-[500] bg-white text-slate-800 p-2.5 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer active:scale-95"
        >
          <span className={`text-base ${isLocating ? 'animate-spin' : ''}`}>🎯</span>
        </button>

        {/* Badge Informativo de Estado de Selección */}
        <div className="absolute top-4 right-14 z-[500] bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              selectionMode === 'origen' ? 'bg-emerald-400' : 'bg-rose-400'
            } animate-ping`}
          ></span>
          <span>
            {isServiceActive
              ? '🚕 Conductor en Camino'
              : selectionMode === 'origen'
              ? 'Toca el mapa para Punto de Recogida'
              : 'Toca el mapa para Punto de Destino'}
          </span>
        </div>
      </div>

      {/* Accesos Rápidos a Puntos de Destino Comunes */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block px-1">
          Puntos Frecuentes y de Acopio:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_DESTINATIONS.map((dest, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickDestinationSelect(dest)}
              className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 whitespace-nowrap transition-all active:scale-95 cursor-pointer shrink-0"
            >
              📍 {dest.name}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen Informativo de Recogida y Destino */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-sm space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></span>
            <span className="w-0.5 h-7 bg-slate-200 my-0.5"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-sm"></span>
          </div>

          <div className="flex-1 space-y-2 text-xs min-w-0">
            {/* Punto de Recogida */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Punto de Recogida</span>
                <p className="text-slate-900 font-semibold truncate">
                  {origen ? origen.address : 'Buscando señal GPS...'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectionMode('origen')}
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
              >
                Cambiar
              </button>
            </div>

            {/* Punto de Destino */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Punto de Destino</span>
                <p className="text-slate-900 font-semibold truncate">
                  {destino ? destino.address : 'Toca el mapa o selecciona un punto frecuente'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectionMode('destino')}
                className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors shrink-0"
              >
                Cambiar
              </button>
            </div>
          </div>
        </div>

        {/* Estado del Conductor Asignado en Tiempo Real */}
        {(driverPos || isServiceActive) && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">🚕</span>
              <div className="min-w-0">
                <span className="font-bold text-slate-900 block truncate">{driverName}</span>
                <span className="text-[10px] text-indigo-700 font-semibold">Ubicación GPS transmitida en vivo</span>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PassengerMap;
