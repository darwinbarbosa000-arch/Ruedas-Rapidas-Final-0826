import React, { useState, useEffect, useCallback } from 'react';
import { MapComponent, MapPoint } from './MapComponent';

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
  isServiceActive?: boolean;
}

const FUSA_CENTER = { lat: 4.3364, lng: -74.3638 };

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

export const PassengerMap: React.FC<PassengerMapProps> = ({
  onLocationSelect,
  initialOrigen = null,
  initialDestino = null,
  driverPos = null,
  driverName = 'Conductor en camino',
  isServiceActive = false,
}) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>(FUSA_CENTER);
  const [center, setCenter] = useState<{ lat: number; lng: number }>(FUSA_CENTER);
  const [origen, setOrigen] = useState<LocationPoint | null>(initialOrigen);
  const [destino, setDestino] = useState<LocationPoint | null>(initialDestino);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);

  // Función para obtener/actualizar la ubicación GPS en tiempo real
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('La geolocalización no está soportada por tu navegador.');
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
          setUserLocation(userPos);
          setCenter(userPos);

          const autoOrigen: LocationPoint = {
            lat: userLat,
            lng: userLng,
            address: `Ubicación actual (${userLat.toFixed(4)}, ${userLng.toFixed(4)})`,
          };

          setOrigen(autoOrigen);
          setGeoError(null);

          if (onLocationSelect) {
            onLocationSelect({ origen: autoOrigen, destino });
          }
        }
        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        setGeoError('Ubicando por GPS predeterminado...');
        setCenter(FUSA_CENTER);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [destino, onLocationSelect]);

  // Autodetectar ubicación al cargar
  useEffect(() => {
    handleDetectLocation();
  }, []);

  // Al hacer clic en el mapa, fijar/actualizar el destino directamente de forma intuitiva
  const handlePointSelect = (point: MapPoint) => {
    const newDestino: LocationPoint = {
      lat: point.lat,
      lng: point.lng,
      address: point.address || `Destino seleccionado (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`,
    };

    setDestino(newDestino);

    if (onLocationSelect) {
      onLocationSelect({ origen, destino: newDestino });
    }
  };

  return (
    <div className="w-full space-y-3 notranslate" translate="no">
      {/* Alerta de GPS si no está disponible */}
      {geoError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-2xl flex items-center justify-between">
          <span>⚠️ {geoError}</span>
          <button
            type="button"
            onClick={() => handleDetectLocation()}
            className="text-amber-900 font-bold ml-2 underline text-[10px]"
          >
            Reintentar GPS
          </button>
        </div>
      )}

      {/* Contenedor del Mapa con Botón Flotante para Mi Ubicación */}
      <div className="relative w-full rounded-3xl overflow-hidden shadow-lg border border-slate-200">
        <MapComponent
          center={center}
          zoom={15}
          origen={origen}
          destino={destino}
          driverPos={driverPos}
          driverName={driverName}
          mode="destino"
          onPointSelect={handlePointSelect}
          showRoute={true}
          className="w-full h-[380px] relative"
        />

        {/* Botón flotante Uber-style: Mi Ubicación */}
        <button
          type="button"
          onClick={handleDetectLocation}
          title="Centrar en mi ubicación"
          className="absolute top-4 left-4 z-[1000] bg-white text-slate-800 p-2.5 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer active:scale-95"
        >
          <span className={`text-base ${isLocating ? 'animate-spin' : ''}`}>🎯</span>
        </button>

        {/* Badge Informativo estilo InDriver */}
        <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur text-white px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>{isServiceActive ? '🚕 Conductor en Vivo' : '📍 Tocá el mapa para tu destino'}</span>
        </div>
      </div>

      {/* Panel Informativo Estilo Uber/InDriver */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-sm space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></span>
            <span className="w-0.5 h-6 bg-slate-200 my-0.5"></span>
            <span className="w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-sm"></span>
          </div>

          <div className="flex-1 space-y-2 text-xs">
            {/* Origen */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Punto de Recogida (Tu Ubicación)</span>
                <p className="text-slate-900 font-semibold truncate max-w-[240px]">
                  {origen ? origen.address : 'Obteniendo GPS...'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
              >
                Actualizar GPS
              </button>
            </div>

            {/* Destino */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Punto de Destino</span>
              <p className="text-slate-900 font-semibold truncate max-w-[280px]">
                {destino ? destino.address : 'Toca cualquier lugar en el mapa para fijar destino'}
              </p>
            </div>
          </div>
        </div>

        {/* Estado del Conductor si está activo */}
        {(driverPos || isServiceActive) && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚕</span>
              <div>
                <span className="font-bold text-slate-900 block">{driverName}</span>
                <span className="text-[10px] text-indigo-700 font-medium">Ubicación en tiempo real activa</span>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PassengerMap;
