import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, User } from 'firebase/auth';
import { LeafletMap, MapPoint } from './LeafletMap';
import { marcarViajeCompartidoFinalizado } from '../services/viajeCompartidoService';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
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
  RefreshCw
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

  // Estados para formulario de autenticación obligatoria
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNombre, setAuthNombre] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 1. Escuchar datos del viaje en tiempo real desde Firestore
  useEffect(() => {
    if (!viajeId) return;

    setLoading(true);
    const viajeRef = doc(db, 'viajes', viajeId);
    const shareRef = doc(db, 'viajes_compartidos', viajeId);

    const unsubViaje = onSnapshot(
      viajeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as any;
          setTripData(data);
          setErrorMsg(null);

          // Si el viaje cambia a 'finalizado', actualizar viajes_compartidos.activo = false
          if (data.estado === 'finalizado') {
            marcarViajeCompartidoFinalizado(viajeId);
          }
        } else {
          // Intentar obtener desde viajes_compartidos
          getDoc(shareRef).then((sSnap) => {
            if (sSnap.exists()) {
              setTripData({ id: sSnap.id, ...sSnap.data() });
            } else {
              setErrorMsg('El viaje solicitado no fue encontrado o el enlace ha caducado.');
            }
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Error al escuchar viaje compartido:', err);
        setErrorMsg('Error de sincronización en tiempo real.');
        setLoading(false);
      }
    );

    return () => {
      unsubViaje();
    };
  }, [viajeId]);

  // 2. Escuchar la ubicación GPS en vivo del conductor
  useEffect(() => {
    const conductorId = tripData?.conductorId || tripData?.conductor_id;
    if (!conductorId) return;

    const locRef = doc(db, 'drivers_location', conductorId);
    const unsubLoc = onSnapshot(locRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
          setDriverGps({ lat: data.lat, lng: data.lng });
        }
      }
    });

    return () => {
      unsubLoc();
    };
  }, [tripData?.conductorId, tripData?.conductor_id]);

  // Manejar Login / Registro rápido del contacto de confianza
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
      } else {
        await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword.trim());
        toast.success('¡Cuenta de contacto de confianza creada!');
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

  // Preparar puntos para el mapa OpenStreetMap
  const origenCoords: MapPoint | null = (() => {
    const raw = tripData?.origenCoords || tripData?.origenCoordenadas || tripData?.origen_coords || tripData?.ruta?.origenCoords;
    if (raw && typeof raw.lat === 'number' && typeof raw.lng === 'number' && !isNaN(raw.lat)) {
      return { lat: raw.lat, lng: raw.lng, address: tripData?.origen || tripData?.ruta?.origen || 'Origen' };
    }
    return { lat: 4.3364, lng: -74.3638, address: tripData?.origen || 'Origen' };
  })();

  const destinoCoords: MapPoint | null = (() => {
    const raw = tripData?.destinoCoords || tripData?.destinoCoordenadas || tripData?.destino_coords || tripData?.ruta?.destinoCoords;
    if (raw && typeof raw.lat === 'number' && typeof raw.lng === 'number' && !isNaN(raw.lat)) {
      return { lat: raw.lat, lng: raw.lng, address: tripData?.destino || tripData?.ruta?.destino || 'Destino' };
    }
    return null;
  })();

  const driverPosPoint: MapPoint | null = driverGps || (tripData?.conductorUbicacion && typeof tripData.conductorUbicacion.lat === 'number' ? {
    lat: tripData.conductorUbicacion.lat,
    lng: tripData.conductorUbicacion.lng,
    address: 'Ubicación en tiempo real'
  } : origenCoords);

  const isFinalizado = tripData?.estado === 'finalizado';
  const isCancelado = tripData?.estado === 'cancelado' || tripData?.estado === 'finalizado_cancelado';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Cabecera de Viaje Seguro */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/30 shadow-inner">
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
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Cerrar vista"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
          
          {/* ========================================================= */}
          {/* CASO A: CONTACTO NO LOGUEADO (OBLIGATORIO LOGIN/REGISTRO) */}
          {/* NO MOSTRAR MAPA HASTA ESTAR LOGUEADO                      */}
          {/* ========================================================= */}
          {!currentUser ? (
            <div className="space-y-4 py-2 text-center animate-fadeIn">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border-2 border-amber-200 shadow-sm">
                <Lock size={30} />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  Verificación de Seguridad
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Acceso Restringido a Contacto de Confianza
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto font-medium leading-relaxed">
                  Por protocolos de seguridad y protección al pasajero, debes <strong>iniciar sesión</strong> o <strong>crear una cuenta</strong> para seguir la ruta en tiempo real y visualizar la ubicación del conductor.
                </p>
              </div>

              {/* Selector de modo Login / Registro */}
              <div className="flex bg-slate-100 p-1 rounded-2xl max-w-xs mx-auto border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    authMode === 'login'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    authMode === 'register'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Registrarme
                </button>
              </div>

              {/* Formulario de autenticación rápida */}
              <form onSubmit={handleAuthSubmit} className="space-y-3 max-w-sm mx-auto text-left">
                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Tu Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej: Laura Gómez"
                      value={authNombre}
                      onChange={(e) => setAuthNombre(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="tu@correo.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : authMode === 'login' ? (
                    <>
                      <LogIn size={16} />
                      <span>Ingresar y Ver Mapa Seguro</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Registrarme y Ver Mapa</span>
                    </>
                  )}
                </button>
              </form>

              {onRequestOpenLogin && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestOpenLogin();
                    }}
                    className="text-xs text-slate-500 hover:text-emerald-600 font-bold underline cursor-pointer"
                  >
                    ¿Ya tienes cuenta de Ruedas Rápidas? Inicia sesión aquí
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================= */
            /* CASO B: CONTACTO AUTENTICADO -> MOSTRAR MAPA Y DETALLES   */
            /* ========================================================= */
            <>
              {loading ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw size={32} className="animate-spin text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">Conectando con el GPS del viaje seguro...</p>
                </div>
              ) : errorMsg ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
                  <AlertCircle size={28} className="text-red-500 mx-auto" />
                  <p className="text-xs font-bold text-red-700">{errorMsg}</p>
                </div>
              ) : (
                <div className="space-y-3.5 animate-fadeIn">
                  
                  {/* ESTADO DEL VIAJE */}
                  {isFinalizado ? (
                    <div className="p-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <CheckCircle2 size={22} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">
                          Servicio Completado
                        </span>
                        <h4 className="text-sm font-black text-slate-900 mt-0.5">Viaje finalizado</h4>
                        <p className="text-[11px] text-slate-600 font-medium">El pasajero ha llegado a su destino con total seguridad.</p>
                      </div>
                    </div>
                  ) : isCancelado ? (
                    <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <ShieldAlert size={22} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full inline-block">
                          Servicio Cancelado
                        </span>
                        <h4 className="text-sm font-black text-slate-900 mt-0.5">Viaje no disponible</h4>
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
                            Estado en Vivo
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {tripData?.estado === 'en_camino' ? 'Conductor en camino al punto de recogida' :
                             tripData?.estado === 'llegando' ? 'Conductor en el punto de encuentro' :
                             tripData?.estado === 'en_transito' ? 'En viaje hacia el destino' :
                             tripData?.estado === 'aceptado' ? 'Conductor asignado' :
                             'En curso'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-2 py-1 rounded-lg uppercase tracking-tight font-mono">
                        GPS Activo
                      </span>
                    </div>
                  )}

                  {/* MAPA ACTIVO DE OPENSTREETMAP (LEAFLET) */}
                  <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm h-[260px] sm:h-[300px] w-full">
                    <LeafletMap
                      center={driverPosPoint || origenCoords || { lat: 4.3364, lng: -74.3638 }}
                      zoom={14}
                      origen={origenCoords}
                      destino={destinoCoords}
                      driverPos={driverPosPoint}
                      driverName={tripData?.conductorNombre || tripData?.conductor_nombre || 'Conductor'}
                      mode="view"
                      showRoute={true}
                      className="h-full w-full"
                    />

                    {/* Badge de OpenStreetMap sobre el mapa */}
                    <div className="absolute top-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2 py-1 rounded-lg border border-slate-200 text-[9px] font-bold text-slate-700 shadow-xs flex items-center gap-1 pointer-events-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>OpenStreetMap En Vivo</span>
                    </div>
                  </div>

                  {/* TARJETA COMPACTA: CONDUCTOR, PLACA, ORIGEN Y DESTINO EXACTOS */}
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-3 text-left">
                    
                    {/* Datos del Conductor y Placa */}
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
                            {tripData?.conductorNombre || tripData?.conductor_nombre || 'Conductor asignado'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Placa</p>
                        <span className="text-[11px] font-black bg-indigo-600 text-white px-2.5 py-1 rounded-md uppercase font-mono shadow-2xs">
                          {tripData?.conductorPlaca || tripData?.conductor_placa || 'PENDIENTE'}
                        </span>
                      </div>
                    </div>

                    {/* Origen y Destino Exacto */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin size={12} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                            Punto de Origen Exacto
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
                            Punto de Destino Exacto
                          </span>
                          <p className="font-bold text-slate-800 text-[11px] leading-snug break-words">
                            {tripData?.destino || tripData?.ruta?.destino || 'Punto de entrega'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de seguridad / Emergencia */}
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="tel:123"
                      className="flex-1 py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <PhoneCall size={14} />
                      <span>Línea 123 (Emergencias)</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        toast.success('Información de ruta actualizada');
                      }}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Refrescar"
                    >
                      <RefreshCw size={14} />
                      <span className="hidden sm:inline">Refrescar</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
