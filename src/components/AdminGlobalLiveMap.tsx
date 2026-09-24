import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Navigation, 
  Car, 
  MapPin, 
  Radio, 
  Search, 
  Phone, 
  MessageCircle, 
  Maximize2,
  RefreshCw,
  Layers,
  Compass
} from 'lucide-react';

const FUSAGASUGA_CENTER = { lat: 4.3364, lng: -74.3638 };

interface AdminGlobalLiveMapProps {
  drivers: any[];
  trips: any[];
  onSelectDriver?: (driver: any) => void;
  onSelectTrip?: (trip: any) => void;
}

export const AdminGlobalLiveMap: React.FC<AdminGlobalLiveMapProps> = ({
  drivers = [],
  trips = [],
  onSelectDriver,
  onSelectTrip,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);

  const [filterMode, setFilterMode] = useState<'todos' | 'en_linea' | 'en_viaje'>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'driver' | 'trip'; data: any } | null>(null);

  // Conductores activos y con posición válida o aproximada en Fusagasugá
  const validDrivers = useMemo(() => {
    return drivers.map((d, index) => {
      let lat = d.lat || d.ubicacion?.lat || d.pos?.lat || d.posicion?.lat || d.coords?.lat;
      let lng = d.lng || d.ubicacion?.lng || d.pos?.lng || d.posicion?.lng || d.coords?.lng;

      // Si no tiene posición GPS exacta registrada en tiempo real, generamos un offset cercano al centro de Fusagasugá
      // basado en un hash determinista de su id para poder visualizarlo en el radar operativo
      if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0) {
        const hash = (d.id || `${index}`).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const angle = (hash % 360) * (Math.PI / 180);
        const radius = 0.005 + ((hash % 100) / 100) * 0.025; // 500m a 2.5km
        lat = FUSAGASUGA_CENTER.lat + radius * Math.cos(angle);
        lng = FUSAGASUGA_CENTER.lng + radius * Math.sin(angle) * 1.2;
      }

      const isOnline = d.activo === true || d.online === true || d.en_linea === true;
      const isInTrip = isOnline && (d.enViaje || d.ocupado || d.viajeActivoId);

      return {
        ...d,
        computedLat: lat,
        computedLng: lng,
        isOnline,
        isInTrip,
      };
    });
  }, [drivers]);

  // Viajes en curso con coordenadas
  const activeTrips = useMemo(() => {
    return trips.filter(t => 
      t.estado === 'en_curso' || 
      t.estado === 'aceptado' || 
      t.estado === 'llegando' || 
      t.estado === 'iniciado' ||
      t.estado === 'solicitado'
    );
  }, [trips]);

  // Filtrado reactivo de conductores
  const filteredDrivers = useMemo(() => {
    return validDrivers.filter(d => {
      if (filterMode === 'en_linea' && !d.isOnline) return false;
      if (filterMode === 'en_viaje' && !d.isInTrip) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = (d.nombre || d.name || '').toLowerCase().includes(term);
        const matchPlate = (d.vehiculo?.placa || '').toLowerCase().includes(term);
        const matchType = (d.vehiculo?.tipo || '').toLowerCase().includes(term);
        return matchName || matchPlate || matchType;
      }
      return true;
    });
  }, [validDrivers, filterMode, searchTerm]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [FUSAGASUGA_CENTER.lat, FUSAGASUGA_CENTER.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // Capa de mapa CartoDB Positron moderna y limpia
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      const routesGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersGroup;
      routesLayerRef.current = routesGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Actualizar marcadores reactivamente
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    const routesGroup = routesLayerRef.current;
    if (!map || !markersGroup || !routesGroup) return;

    markersGroup.clearLayers();
    routesGroup.clearLayers();

    // 1. Dibujar Conductores
    filteredDrivers.forEach(driver => {
      const isOnline = driver.isOnline;
      const isInTrip = driver.isInTrip;
      const vehicleType = (driver.vehiculo?.tipo || 'carro').toLowerCase();

      let bgColor = 'bg-slate-400 border-slate-600';
      let ringColor = 'ring-slate-300';
      let statusLabel = 'Desconectado';

      if (isInTrip) {
        bgColor = 'bg-amber-500 border-amber-700';
        ringColor = 'ring-amber-300';
        statusLabel = 'En Viaje';
      } else if (isOnline) {
        bgColor = 'bg-emerald-500 border-emerald-700';
        ringColor = 'ring-emerald-300';
        statusLabel = 'Disponible';
      }

      let iconEmoji = '🚗';
      if (vehicleType.includes('moto')) iconEmoji = '🏍️';
      else if (vehicleType.includes('taxi')) iconEmoji = '🚕';
      else if (vehicleType.includes('camion') || vehicleType.includes('flete')) iconEmoji = '🚚';

      const customIcon = L.divIcon({
        className: 'custom-driver-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${isOnline ? `<div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: ${isInTrip ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
            <div style="
              width: 32px; 
              height: 32px; 
              border-radius: 50%; 
              background: ${isInTrip ? '#f59e0b' : isOnline ? '#10b981' : '#64748b'}; 
              border: 2.5px solid white; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.25); 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 15px;
            ">
              ${iconEmoji}
            </div>
            <div style="
              position: absolute; 
              bottom: -18px; 
              background: #0f172a; 
              color: white; 
              font-family: monospace; 
              font-weight: 900; 
              font-size: 9px; 
              padding: 1px 4px; 
              border-radius: 4px; 
              white-space: nowrap; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              ${driver.vehiculo?.placa || 'FLOTA'}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([driver.computedLat, driver.computedLng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedEntity({ type: 'driver', data: driver });
        if (onSelectDriver) onSelectDriver(driver);
      });

      marker.addTo(markersGroup);
    });

    // 2. Dibujar viajes en curso si tienen coordenadas de origen / destino
    activeTrips.forEach(trip => {
      const origLat = trip.origen?.lat || trip.origenLat;
      const origLng = trip.origen?.lng || trip.origenLng;
      const destLat = trip.destino?.lat || trip.destinoLat;
      const destLng = trip.destino?.lng || trip.destinoLng;

      if (origLat && origLng) {
        const pickupIcon = L.divIcon({
          className: 'pickup-marker',
          html: `
            <div style="
              width: 22px; 
              height: 22px; 
              border-radius: 50%; 
              background: #3b82f6; 
              border: 2px solid white; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              color: white; 
              font-size: 10px; 
              font-weight: bold; 
              box-shadow: 0 2px 8px rgba(59,130,246,0.5);
            ">
              A
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const pMarker = L.marker([origLat, origLng], { icon: pickupIcon });
        pMarker.on('click', () => setSelectedEntity({ type: 'trip', data: trip }));
        pMarker.addTo(markersGroup);
      }

      if (destLat && destLng) {
        const destIcon = L.divIcon({
          className: 'dest-marker',
          html: `
            <div style="
              width: 22px; 
              height: 22px; 
              border-radius: 50%; 
              background: #ef4444; 
              border: 2px solid white; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              color: white; 
              font-size: 10px; 
              font-weight: bold; 
              box-shadow: 0 2px 8px rgba(239,68,68,0.5);
            ">
              B
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const dMarker = L.marker([destLat, destLng], { icon: destIcon });
        dMarker.on('click', () => setSelectedEntity({ type: 'trip', data: trip }));
        dMarker.addTo(markersGroup);
      }

      // Línea de ruta entre origen y destino si ambos existen
      if (origLat && origLng && destLat && destLng) {
        L.polyline([[origLat, origLng], [destLat, destLng]], {
          color: trip.estado === 'en_curso' ? '#10b981' : '#f59e0b',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.8,
        }).addTo(routesGroup);
      }
    });
  }, [filteredDrivers, activeTrips, onSelectDriver]);

  const handleCenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([FUSAGASUGA_CENTER.lat, FUSAGASUGA_CENTER.lng], 14, { animate: true });
    }
  };

  const onlineCount = drivers.filter(d => (d.activo || d.online || d.en_linea) && !d.bloqueado && d.aprobado !== false).length;
  const inTripCount = drivers.filter(d => (d.activo || d.online || d.en_linea) && (d.enViaje || d.ocupado)).length;
  const availableCount = Math.max(0, onlineCount - inTripCount);

  return (
    <div className="relative w-full h-[760px] rounded-[2.5rem] overflow-hidden border border-slate-200/90 shadow-xl bg-slate-900 flex flex-col">
      {/* Barra Superior Flotante: Métricas en Vivo & Filtros */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pointer-events-none">
        {/* Pills de métricas */}
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/80 shadow-2xl text-white pointer-events-auto">
          <div className="flex items-center gap-2 border-r border-slate-700/80 pr-3">
            <Radio size={14} className="text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">Radar GPS</span>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              {availableCount} Libres
            </span>
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              {inTripCount} En Viaje
            </span>
            <span className="text-blue-400 flex items-center gap-1">
              <Navigation size={12} />
              {activeTrips.length} Servicios
            </span>
          </div>
        </div>

        {/* Buscador & Filtros de mapa */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap justify-end">
          <div className="relative bg-slate-950/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar conductor o placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-white text-xs pl-9 pr-3 py-2 w-48 sm:w-56 focus:outline-none placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-2xl flex items-center gap-1">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'en_linea', label: 'En Línea' },
              { id: 'en_viaje', label: 'En Viaje' },
            ].map(tab => (
              <button
                key={`map-filter-${tab.id}`}
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleCenterMap}
            className="p-2.5 bg-slate-950/85 backdrop-blur-md hover:bg-slate-800 text-white rounded-2xl border border-slate-700/80 shadow-2xl transition-all cursor-pointer active:scale-95"
            title="Centrar en Fusagasugá"
          >
            <Compass size={18} />
          </button>
        </div>
      </div>

      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0" />

      {/* Drawer / Tarjeta flotante de detalle si se selecciona un conductor o viaje */}
      {selectedEntity && (
        <div className="absolute bottom-5 left-5 right-5 sm:right-auto sm:w-96 z-[1000] bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shrink-0">
                {selectedEntity.type === 'driver' ? '🚗' : '📍'}
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {selectedEntity.type === 'driver' ? 'Conductor en Flota' : 'Servicio en Tiempo Real'}
                </span>
                <h4 className="text-sm font-black text-slate-900 mt-1 truncate">
                  {selectedEntity.type === 'driver'
                    ? selectedEntity.data.nombre || selectedEntity.data.name || 'Conductor'
                    : `Viaje #${selectedEntity.data.id?.slice(0, 8)}`}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setSelectedEntity(null)}
              className="text-slate-400 hover:text-slate-700 p-1 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          {selectedEntity.type === 'driver' && (
            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Placa</span>
                <span className="font-black text-slate-800 bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-md">
                  {selectedEntity.data.vehiculo?.placa || 'SN-PLACA'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Tipo de Vehículo:</span>
                <span className="font-bold text-slate-800 uppercase">{selectedEntity.data.vehiculo?.tipo || 'Carro'}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Estado Operativo:</span>
                <span className={`font-black ${selectedEntity.data.isInTrip ? 'text-amber-600' : selectedEntity.data.isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {selectedEntity.data.isInTrip ? '🟡 Ocupado / En Viaje' : selectedEntity.data.isOnline ? '🟢 En Línea / Disponible' : '⚪ Desconectado'}
                </span>
              </div>
              {selectedEntity.data.telefono && (
                <div className="pt-2 flex items-center gap-2">
                  <a
                    href={`https://wa.me/${selectedEntity.data.telefono.replace(/\D/g, '')}?text=Hola+desde+la+Central+de+Ruedas+Rápidas.`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle size={13} />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${selectedEntity.data.telefono}`}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                    title="Llamar"
                  >
                    <Phone size={14} />
                  </a>
                </div>
              )}
            </div>
          )}

          {selectedEntity.type === 'trip' && (
            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-black">Ruta:</p>
                <p className="font-medium truncate"><strong className="text-emerald-700">A:</strong> {selectedEntity.data.origen?.address || selectedEntity.data.origen?.name || 'Origen'}</p>
                <p className="font-medium truncate"><strong className="text-rose-700">B:</strong> {selectedEntity.data.destino?.address || selectedEntity.data.destino?.name || 'Destino'}</p>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Tarifa:</span>
                <span className="font-mono font-black text-emerald-600 text-sm">
                  ${(selectedEntity.data.precio || selectedEntity.data.valor || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Estado:</span>
                <span className="font-black text-indigo-600 uppercase">{selectedEntity.data.estado || 'En curso'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminGlobalLiveMap;
