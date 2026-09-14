import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, User } from 'firebase/auth';
import { LeafletMap, MapPoint } from './LeafletMap';
import { marcarViajeCompartidoFinalizado } from '../services/viajeCompartidoService';
import { 
  ShieldCheck, 
  ShieldAlert, 
  MapPin, 
  Car, 
  Navigation, 
  CheckCircle2, 
  AlertCircle, 
  PhoneCall, 
  X, 
  LogIn, 
  UserPlus, 
  Eye, 
  EyeOff,
  RefreshCw,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';

interface ViajeSeguroCompartidoProps {
  viajeId: string;
  currentUser: User | null;
  onClose: () => void;
  onRequestOpenLogin?: () => void;
}

export const ViajeSeguroCompartido: React.FC<ViajeSeguroCompartidoProps> = ({
  viajeId,
  currentUser,
  onClose,
  onRequestOpenLogin,
}) => {
  const [tripData, setTripData] = useState<any>(null);
  const [driverGps, setDriverGps] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para autenticación opcional del contacto de confianza
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNombre, setAuthNombre] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 1. Escuchar datos del viaje en tiempo real desde Firestore (consultando viajes y viajes_compartidos)
  useEffect(() => {
    if (!viajeId) return;

    setLoading(true);
    const viajeRef = doc(db, 'viajes', viajeId);
    const shareRef = doc(db, 'viajes_compartidos', viajeId);

    // Escuchar documento principal de viajes
    const unsubViaje = onSnapshot(
      viajeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as any;
          setTripData((prev: any) => ({ ...prev, ...data }));
          setErrorMsg(null);
          setLoading(false);

          // Si el viaje cambia a 'finalizado', marcar en viajes_compartidos
          if (data.estado === 'finalizado') {
            marcarViajeCompartidoFinalizado(viajeId);
          }
        } else {
          // Si no existe en viajes, buscar en viajes_compartidos
          getDoc(shareRef).then((sSnap) => {
            if (sSnap.exists()) {
              const shareData = { id: sSnap.id, ...sSnap.data() } as any;
              setTripData((prev: any) => ({ ...prev, ...shareData }));
              setErrorMsg(null);
            } else if (!tripData) {
              setErrorMsg('El viaje solicitado no fue encontrado o el enlace ha caducado.');
            }
            setLoading(false);
          }).catch(() => setLoading(false));
        }
      },
      (err) => {
        console.warn('Error al escuchar viaje principal:', err);
        // Fallback a viajes_compartidos si hay restricción de permisos
        getDoc(shareRef).then((sSnap) => {
          if (sSnap.exists()) {
            setTripData({ id: sSnap.id, ...sSnap.data() });
            setErrorMsg(null);
          } else {
            setErrorMsg('Error de sincronización en tiempo real.');
          }
          setLoading(false);
        }).catch(() => {
          setErrorMsg('Error de sincronización en tiempo real.');
          setLoading(false);
        });
      }
    );

    // Escuchar también viajes_compartidos para actualizaciones simultáneas
    const unsubShare = onSnapshot(shareRef, (sSnap) => {
      if (sSnap.exists()) {
        const sData = { id: sSnap.id, ...sSnap.data() } as any;
        setTripData((prev: any) => ({ ...sData, ...prev }));
      }
    }, () => {});

    return () => {
      unsubViaje();
      unsubShare();
    };
  }, [viajeId]);

  // 2. Escuchar la ubicación GPS en vivo del conductor
  useEffect(() => {
    const conductorId = tripData?.conductorId || tripData?.conductor_id;
    if (!conductorId) return;

    const locRef = doc(db, 'drivers_location', conductorId);
    const unsubLoc = onSnapshot(
      locRef, 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
            setDriverGps({ lat: data.lat, lng: data.lng });
          }
        }
      },
      (err) => {
        console.warn('Error al obtener ubicación de conductor:', err);
      }
    );

    return () => unsubLoc();
  }, [tripData?.conductorId, tripData?.conductor_id]);

  // Manejar Login / Registro del contacto de confianza
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword.trim());
        toast.success('¡Sesión verificada exitosamente!');
        setShowAuthDrawer(false);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword.trim());
        toast.success('¡Cuenta creada y vinculada!');
        setShowAuthDrawer(false);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'Error en autenticación. Verifica tus datos.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Contraseña o correo incorrectos.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No existe una cuenta registrada con este correo.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Este correo ya está registrado. Selecciona "Iniciar Sesión".';
      } else if (err.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener mínimo 6 caracteres.';
      }
      toast.error(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Función robusta para parsear coordenadas de cualquier estructura
  const parseCoords = (data: any, prefix: 'origen' | 'destino'): MapPoint | null => {
    if (!data) return null;
    const direct = data[`${prefix}Coords`] || data[`${prefix}Coordenadas`] || data[`${prefix}_coords`] || data.ruta?.[`${prefix}Coords`];
    if (direct) {
      const lat = typeof direct.lat === 'number' ? direct.lat : typeof direct.latitude === 'number' ? direct.latitude : parseFloat(direct.lat || direct.latitude);
      const lng = typeof direct.lng === 'number' ? direct.lng : typeof direct.longitude === 'number' ? direct.longitude : parseFloat(direct.lng || direct.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng, address: data[prefix] || data.ruta?.[prefix] || (prefix === 'origen' ? 'Punto de recogida' : 'Punto de llegada') };
      }
    }

    const flatLat = data[`${prefix}Lat`] || data[`${prefix}_lat`];
    const flatLng = data[`${prefix}Lng`] || data[`${prefix}_lng`];
    if (flatLat && flatLng) {
      const lat = parseFloat(flatLat);
      const lng = parseFloat(flatLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, address: data[prefix] || (prefix === 'origen' ? 'Punto de recogida' : 'Punto de llegada') };
      }
    }

    if (prefix === 'origen') {
      return { lat: 4.3364, lng: -74.3638, address: data?.origen || 'Fusagasugá, Cundinamarca' };
    }
    return null;
  };

  const origenCoords: MapPoint | null = parseCoords(tripData, 'origen');
  const destinoCoords: MapPoint | null = parseCoords(tripData, 'destino');

  // Determinar la posición en vivo del conductor
  const driverPosPoint: MapPoint | null = (() => {
    if (driverGps && typeof driverGps.lat === 'number' && !isNaN(driverGps.lat)) {
      return { lat: driverGps.lat, lng: driverGps.lng, address: 'Conductor en vivo' };
    }
    if (tripData?.conductorUbicacion && typeof tripData.conductorUbicacion.lat === 'number') {
      return { lat: tripData.conductorUbicacion.lat, lng: tripData.conductorUbicacion.lng, address: 'Conductor en vivo' };
    }
    return origenCoords;
  })();

  const isFinalizado = tripData?.estado === 'finalizado';
  const isCancelado = tripData?.estado === 'cancelado' || tripData?.estado === 'finalizado_cancelado';

  const pasajeroNombre = tripData?.pasajero_nombre || tripData?.usuarioNombre || tripData?.pasajeroNombre || 'Pasajero';
  const conductorNombre = tripData?.conductorNombre || tripData?.conductor_nombre || 'Conductor';
  const conductorPlaca = tripData?.conductorPlaca || tripData?.conductor_placa || tripData?.conductorVehiculo?.placa || 'En asignación';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[94vh]">
        
        {/* CABECERA SUPERIOR: MODO CONTACTO DE CONFIANZA */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3.5 sm:p-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/30 shadow-inner shrink-0">
              <ShieldCheck size={24} className="text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Ruedas Rápidas
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight mt-0.5">
                Viaje Seguro en Vivo
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            title="Cerrar vista"
          >
            <X size={18} />
          </button>
        </div>

        {/* BARRA DE IDENTIDAD Y SEGURIDAD */}
        <div className="bg-emerald-50/80 px-4 py-2 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-1.5 truncate">
            <UserCheck size={14} className="text-emerald-700 shrink-0" />
            <span className="font-medium truncate">
              Siguiendo a <strong className="font-black text-emerald-950">{pasajeroNombre}</strong>
            </span>
          </div>

          {currentUser ? (
            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md shrink-0">
              Contacto Verificado
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthDrawer(!showAuthDrawer)}
              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>{showAuthDrawer ? 'Ocultar cuenta' : '¿Tienes cuenta?'}</span>
              {showAuthDrawer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* CONTENIDO PRINCIPAL: MAPA Y DATOS EN TIEMPO REAL */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 text-slate-800">
          
          {/* PANEL OPCIONAL DE LOGIN/REGISTRO (NO BLOQUEA EL MAPA) */}
          {showAuthDrawer && !currentUser && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 animate-fadeIn text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Acceso para Contactos Registrados (Opcional)
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${authMode === 'login' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    Ingresar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${authMode === 'register' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    Registrarme
                  </button>
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    placeholder="tu@correo.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-emerald-500 outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Contraseña"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-emerald-500 outline-none pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {authLoading ? <RefreshCw size={14} className="animate-spin" /> : authMode === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
                  <span>{authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ESTADOS DE CARGA O ERROR */}
          {loading && !tripData ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw size={32} className="animate-spin text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-slate-500">Conectando con el GPS del viaje seguro...</p>
            </div>
          ) : errorMsg && !tripData ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
              <AlertCircle size={28} className="text-red-500 mx-auto" />
              <p className="text-xs font-bold text-red-700">{errorMsg}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Volver
              </button>
            </div>
          ) : (
            <>
              {/* ESTADO EN VIVO DEL SERVICIO */}
              {isFinalizado ? (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">
                      Servicio Completado
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-0.5">Viaje finalizado con éxito</h4>
                    <p className="text-[11px] text-slate-600 font-medium">El pasajero ha llegado a su destino seguro.</p>
                  </div>
                </div>
              ) : isCancelado ? (
                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full inline-block">
                      Servicio Cancelado
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-0.5">Viaje cancelado</h4>
                    <p className="text-[11px] text-slate-600 font-medium">Este servicio ha sido cancelado.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Navigation size={16} className="animate-pulse" />
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 block">
                        Monitoreo en Tiempo Real
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {tripData?.estado === 'en_camino' ? 'Conductor en camino al punto de recogida' :
                         tripData?.estado === 'llegando' ? 'Conductor en el punto de encuentro' :
                         tripData?.estado === 'en_transito' ? 'En viaje seguro hacia el destino' :
                         tripData?.estado === 'aceptado' ? 'Conductor asignado' :
                         'Viaje en curso'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-2 py-1 rounded-lg uppercase tracking-tight font-mono shrink-0">
                    GPS Activo
                  </span>
                </div>
              )}

              {/* MAPA ACTIVO DE OPENSTREETMAP - GARANTIZADO VISIBLE CON ALTO FORZADO */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm h-[300px] sm:h-[340px] w-full min-h-[280px]">
                <LeafletMap
                  center={driverPosPoint || origenCoords || { lat: 4.3364, lng: -74.3638 }}
                  zoom={14}
                  origen={origenCoords}
                  destino={destinoCoords}
                  driverPos={driverPosPoint}
                  driverName={conductorNombre}
                  mode="view"
                  showRoute={true}
                  className="h-full w-full min-h-[280px]"
                />

                {/* Badge de OpenStreetMap sobre el mapa */}
                <div className="absolute top-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm flex items-center gap-1.5 pointer-events-none">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-emerald-700 font-black">OpenStreetMap</span>
                  <span className="text-slate-400">|</span>
                  <span>Ruta en Vivo</span>
                </div>
              </div>

              {/* TARJETA DE DATOS DEL CONDUCTOR Y PLACA */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-3 text-left">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0 font-black">
                      <Car size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                        Conductor Verificado
                      </p>
                      <p className="text-xs font-black text-slate-900 truncate">
                        {conductorNombre}
                      </p>
                      {tripData?.conductorVehiculo?.empresaTaxi && (
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          {tripData.conductorVehiculo.empresaTaxi}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Placa</p>
                    <span className="text-[11px] font-black bg-indigo-600 text-white px-2.5 py-1 rounded-md uppercase font-mono shadow-2xs">
                      {conductorPlaca}
                    </span>
                  </div>
                </div>

                {/* DIRECCIÓN DE ORIGEN Y DESTINO EXACTOS */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                        Punto de Origen (Recogida)
                      </span>
                      <p className="font-bold text-slate-800 text-[11px] leading-snug break-words">
                        {tripData?.origen || tripData?.ruta?.origen || 'Punto de recogida'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                        Punto de Destino (Llegada)
                      </span>
                      <p className="font-bold text-slate-800 text-[11px] leading-snug break-words">
                        {tripData?.destino || tripData?.ruta?.destino || 'Punto de entrega'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTONES DE EMERGENCIA Y ASISTENCIA RÁPIDA */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="tel:123"
                  className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <PhoneCall size={14} />
                  <span>Llamar al 123 (Emergencias)</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('¡Enlace de seguimiento copiado!');
                    }
                  }}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Copiar enlace"
                >
                  <Share2 size={14} />
                  <span className="hidden sm:inline">Compartir</span>
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
