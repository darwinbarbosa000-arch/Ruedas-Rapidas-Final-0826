/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, onSnapshot, query, where, doc, getDoc, addDoc, setDoc, updateDoc, orderBy, limit, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  requestOTP, 
  verifyOTP, 
  validateAndFormatColombianPhone, 
  checkIfPhoneAlreadyRegistered, 
  enforceDeviceLimit,
  resetOtpRateLimit 
} from './services/authService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie, LineChart, Line
} from 'recharts';
import { handleFirestoreError, OperationType, crearPerfilUsuario, finalizarViaje, aceptarViaje, ofertarViaje, crearPerfilConductor, solicitarRecarga, aprobarRecarga, rechazarRecarga, toggleEstadoConductor, toggleModoRepartidor, seleccionarOferta, actualizarEstadoViaje, calificarConductor, toggleBloqueoUsuario, toggleBloqueoConductor, toggleAdminSuplente, enviarMensajeAdmin, marcarMensajesChatLeidos, cancelarViajeConductor, recargaManual, ajustarSaldoUsuario, cancelarViajeUsuario, crearViajeExpreso, reservarCupoExpreso, cancelarViajeExpreso, cancelarReservaExpreso, cancelarViajePorAdministrador } from './services/viajeService';
import { Car, Bike, Package, User as UserIcon, LogOut, ShieldCheck, CreditCard, MapPin, Heart, Shield, Truck, PlusCircle, Check, X, Star, ChevronRight, ChevronDown, ChevronUp, Clock, Lock, Unlock, ShieldAlert, AlertCircle, Info, Zap, MessageCircle, Headphones, Navigation, AlertTriangle, Search, FileText, CheckCircle2, Trophy, Medal, Users, Calendar, XCircle, Power, Store, Edit, Utensils, ShoppingBag, Smartphone, Wrench, Pill, TrendingUp, TrendingDown, Target, Coins, FileSpreadsheet, Upload, Image, ArrowLeftRight, Tag, UserCheck, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster, toast } from 'sonner';
import { Chat } from './components/Chat';
import { escucharMensajes } from './services/chatService';
import { uploadToStorage } from './services/storageService';
import { SupportChat } from './components/SupportChat';
import { TripStatusAnimation } from './components/TripStatusAnimation';
import { CountdownTimer } from './components/CountdownTimer';
import { UserTripPanel } from './components/UserTripPanel';
import { DriverTripPanel } from './components/DriverTripPanel';
import { CalificacionModal } from './components/CalificacionModal';
import { calculateNationalSuggestedPrice, formatCOP } from './services/offerService';
import { getSyncedISOString, getSyncedDate, syncClock } from './services/clockService';
import { escucharChatsSoporte, SoporteChat, marcarComoLeidoSoporte } from './services/supportService';
import { soundService } from './services/soundService';
import { COLOMBIA_DEPARTMENTS, DEPARTMENTS_LIST } from './services/colombiaData';
import { MapProvider } from './components/MapProvider';
import { PassengerMap } from './components/PassengerMap';
import { DriverLiveMap } from './components/DriverLiveMap';
import { RideTracker } from './components/RideTracker';
import { MapComponent, MapPoint } from './components/MapComponent';
import { AdminDriversPanel } from './components/AdminDriversPanel';
import DriverOfferModal from './components/DriverOfferModal';
import RegistroConductor from './components/RegistroConductor';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

// Diccionario Inteligente de Barrios y Puntos de Interés en Fusagasugá, Bogotá y Cundinamarca
export const KNOWN_LOCATIONS_MAP: { [key: string]: { lat: number; lng: number } } = {
  // Fusagasugá (Base principal ItalBusiness)
  'ebenezer': { lat: 4.3485, lng: -74.3580 },
  'barrio ebenezer': { lat: 4.3485, lng: -74.3580 },
  'ebenezer fusa': { lat: 4.3485, lng: -74.3580 },
  'balmoral': { lat: 4.3420, lng: -74.3620 },
  'barrio balmoral': { lat: 4.3420, lng: -74.3620 },
  'manila': { lat: 4.3392, lng: -74.3601 },
  'barrio manila': { lat: 4.3392, lng: -74.3601 },
  'pekin': { lat: 4.3445, lng: -74.3665 },
  'pequin': { lat: 4.3445, lng: -74.3665 },
  'barrio pekin': { lat: 4.3445, lng: -74.3665 },
  'lander': { lat: 4.3450, lng: -74.3680 },
  'landeros': { lat: 4.3450, lng: -74.3680 },
  'los landeros': { lat: 4.3450, lng: -74.3680 },
  'macarena': { lat: 4.3412, lng: -74.3548 },
  'la macarena': { lat: 4.3412, lng: -74.3548 },
  'llano largo': { lat: 4.3285, lng: -74.3615 },
  'sauces': { lat: 4.3285, lng: -74.3615 },
  'los sauces': { lat: 4.3285, lng: -74.3615 },
  'barrio los sauces': { lat: 4.3285, lng: -74.3615 },
  'terminal': { lat: 4.3312, lng: -74.3695 },
  'terminal de transportes': { lat: 4.3312, lng: -74.3695 },
  'terminal fusa': { lat: 4.3312, lng: -74.3695 },
  'hospital': { lat: 4.3355, lng: -74.3585 },
  'hospital san rafael': { lat: 4.3355, lng: -74.3585 },
  'centro': { lat: 4.3364, lng: -74.3638 },
  'parque principal': { lat: 4.3364, lng: -74.3638 },
  'plaza de mercado': { lat: 4.3340, lng: -74.3620 },
  'galeria': { lat: 4.3340, lng: -74.3620 },
  'san fernando': { lat: 4.3320, lng: -74.3610 },
  'la pampa': { lat: 4.3300, lng: -74.3550 },
  'gaitan': { lat: 4.3380, lng: -74.3660 },
  'comboy': { lat: 4.3465, lng: -74.3535 },
  'fusacatan': { lat: 4.3465, lng: -74.3535 },
  'emilio alarcon': { lat: 4.3430, lng: -74.3590 },
  'altagracia': { lat: 4.3490, lng: -74.3620 },
  'prados de altagracia': { lat: 4.3490, lng: -74.3620 },
  'cucharal': { lat: 4.3250, lng: -74.3720 },
  'chinauta': { lat: 4.3100, lng: -74.4200 },
  'silvania': { lat: 4.4020, lng: -74.3860 },
  'pasca': { lat: 4.3080, lng: -74.3000 },
  'arbelaez': { lat: 4.2720, lng: -74.4160 },

  // Bogotá
  'salitre': { lat: 4.6540, lng: -74.1080 },
  'ciudad salitre': { lat: 4.6540, lng: -74.1080 },
  'chapinero': { lat: 4.6486, lng: -74.0628 },
  'usaquen': { lat: 4.6961, lng: -74.0321 },
  'suba': { lat: 4.7432, lng: -74.0847 },
  'kennedy': { lat: 4.6281, lng: -74.1508 },
  'fontibon': { lat: 4.6745, lng: -74.1442 },
  'teusaquillo': { lat: 4.6300, lng: -74.0800 },
  'bosa': { lat: 4.6100, lng: -74.1800 },
  'engativa': { lat: 4.7000, lng: -74.1100 },
  'cedritos': { lat: 4.7250, lng: -74.0350 },
  'aeropuerto': { lat: 4.7016, lng: -74.1469 },
  'el dorado': { lat: 4.7016, lng: -74.1469 },
};

export const geocodeAddressText = (addrStr: string, cityStr?: string): { lat: number; lng: number } => {
  const FUSA_DEFAULT = { lat: 4.3364, lng: -74.3638 };
  const BOGOTA_DEFAULT = { lat: 4.710989, lng: -74.072092 };

  if (!addrStr || typeof addrStr !== 'string' || !addrStr.trim()) {
    return (cityStr === 'Bogotá') ? BOGOTA_DEFAULT : FUSA_DEFAULT;
  }

  const clean = addrStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // 1. Buscar coincidencia exacta o parcial de barrio/lugar
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS_MAP)) {
    if (clean.includes(key)) {
      // Extraer números para pequeña variación por número de calle/carrera
      const nums = clean.match(/\d+/g);
      let latShift = 0;
      let lngShift = 0;
      if (nums && nums.length >= 1) {
        const n1 = parseInt(nums[0], 10);
        const n2 = nums[1] ? parseInt(nums[1], 10) : 10;
        latShift = ((n1 % 15) - 7) * 0.00015;
        lngShift = ((n2 % 15) - 7) * 0.00015;
      }
      return {
        lat: Number((coords.lat + latShift).toFixed(6)),
        lng: Number((coords.lng + lngShift).toFixed(6))
      };
    }
  }

  // 2. Si es Bogotá o contiene Bogotá
  const isBogota = cityStr === 'Bogotá' || clean.includes('bogota');
  const baseCenter = isBogota ? BOGOTA_DEFAULT : FUSA_DEFAULT;

  // 3. Generar una distribución basada en hash para direcciones desconocidas en la misma ciudad
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 100) / 100 - 0.5) * 0.015;
  const lngOffset = ((Math.abs(hash * 31) % 100) / 100 - 0.5) * 0.015;

  return {
    lat: Number((baseCenter.lat + latOffset).toFixed(6)),
    lng: Number((baseCenter.lng + lngOffset).toFixed(6))
  };
};

// Helper para obtener puntos de origen, destino, posición de conductor y cálculo de trayectos
const getTripRoutePoints = (trip: any, driverPosInput?: { lat: number; lng: number } | null) => {
  if (!trip) return { origen: null, destino: null, driverPos: null, distanceKm: 0, estimatedMins: 0, pickupDistanceKm: 0, pickupMins: 0 };

  const origenLat = trip.origenCoords?.lat ?? trip.ruta?.origenCoords?.lat ?? trip.origenPoint?.lat ?? trip.ruta?.origenPoint?.lat ?? trip.user_location?.lat ?? trip.userLocation?.lat ?? trip.usuarioUbicacion?.lat ?? trip.user_location?.latitude;
  const origenLng = trip.origenCoords?.lng ?? trip.ruta?.origenCoords?.lng ?? trip.origenPoint?.lng ?? trip.ruta?.origenPoint?.lng ?? trip.user_location?.lng ?? trip.userLocation?.lng ?? trip.usuarioUbicacion?.lng ?? trip.user_location?.longitude;

  const destinoLat = trip.destinoCoords?.lat ?? trip.ruta?.destinoCoords?.lat ?? trip.destinoPoint?.lat ?? trip.ruta?.destinoPoint?.lat ?? trip.destino_location?.lat;
  const destinoLng = trip.destinoCoords?.lng ?? trip.ruta?.destinoCoords?.lng ?? trip.destinoPoint?.lng ?? trip.ruta?.destinoPoint?.lng ?? trip.destino_location?.lng;

  const hasValidOrigen = typeof origenLat === 'number' && typeof origenLng === 'number' && !isNaN(origenLat) && !isNaN(origenLng) && (origenLat !== 0 || origenLng !== 0);
  const hasValidDestino = typeof destinoLat === 'number' && typeof destinoLng === 'number' && !isNaN(destinoLat) && !isNaN(destinoLng) && (destinoLat !== 0 || destinoLng !== 0);

  const city = trip.ciudad || trip.usuarioCiudad || 'Fusagasugá';
  const origenText = trip.ruta?.origen || trip.origen || '';
  const destinoText = trip.ruta?.destino || trip.destino || '';

  // Usar coordenadas o geocodificar con diccionario inteligente de barrios (ej: Ebenezer)
  let origLat = origenLat;
  let origLng = origenLng;

  if (!hasValidOrigen) {
    const geoOrigen = geocodeAddressText(origenText, city);
    origLat = geoOrigen.lat;
    origLng = geoOrigen.lng;
  }

  let destLat = destinoLat;
  let destLng = destinoLng;

  if (!hasValidDestino) {
    const geoDestino = geocodeAddressText(destinoText, city);
    destLat = geoDestino.lat;
    destLng = geoDestino.lng;
  }

  const origen: MapPoint = {
    lat: origLat,
    lng: origLng,
    address: origenText || 'Punto de Recogida del Pasajero'
  };

  const destino: MapPoint = {
    lat: destLat,
    lng: destLng,
    address: destinoText || 'Destino del Pasajero'
  };

  const FUSA_DEFAULT = { lat: 4.3364, lng: -74.3638 };

  // Posición actual del conductor (GPS real o base Fusagasugá)
  const dLatVal = driverPosInput?.lat && !isNaN(driverPosInput.lat) 
    ? driverPosInput.lat 
    : FUSA_DEFAULT.lat;
  const dLngVal = driverPosInput?.lng && !isNaN(driverPosInput.lng) 
    ? driverPosInput.lng 
    : FUSA_DEFAULT.lng;

  const driverPos: MapPoint = {
    lat: dLatVal,
    lng: dLngVal,
    address: 'Tu Ubicación Actual (Conductor)'
  };

  const R = 6371; // Radio de la Tierra en km
  const haversineDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Distancia y Tiempo desde Conductor hasta Pasajero (Aproximación / Recogida)
  const pickupDistRaw = haversineDist(dLatVal, dLngVal, origLat, origLng);
  const pickupDistanceKm = Math.round((pickupDistRaw > 0 ? pickupDistRaw : 0.8) * 10) / 10;
  const pickupMins = Math.max(2, Math.round((pickupDistanceKm / 20) * 60)); // velocidad prom 20km/h ciudad

  // Distancia y Tiempo del Viaje contratado (Pasajero Recogida -> Destino)
  const tripDistRaw = haversineDist(origLat, origLng, destLat, destLng);
  const distanceKm = Math.round((tripDistRaw > 0 ? tripDistRaw : 3.2) * 10) / 10;
  const estimatedMins = Math.round((distanceKm / 22) * 60 + 3) || 10;

  return { origen, destino, driverPos, distanceKm, estimatedMins, pickupDistanceKm, pickupMins };
};

// --- Custom Taxi Icon Component ---
const Taxi = ({ size = 24, className = "" }: { size?: number; className?: string }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect x="3" y="10" width="18" height="8" rx="2" />
      <path d="M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M10 2h4v2h-4z" />
    </svg>
  );
};

// --- Helper Components for Temporary Sancion/Blocking ---
function DriverBlockCountdown({ desde, hasta, onComplete }: { desde: string; hasta: string; onComplete?: () => void }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const calculate = () => {
      const startTime = new Date(desde).getTime();
      const endTime = new Date(hasta).getTime();
      const now = Date.now();

      const total = endTime - startTime;
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeLeft('00:00:00');
        setProgress(0);
        if (onComplete) onComplete();
        return;
      }

      // Progress percentage (elapsed / total)
      const elapsed = now - startTime;
      const pct = Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
      setProgress(pct);

      // Format HH:MM:SS
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');

      setTimeLeft(`${hStr}:${mStr}:${sStr}`);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [desde, hasta, onComplete]);

  return (
    <div className="space-y-4 bg-white/60 p-6 rounded-[2rem] border border-red-100/60 shadow-sm max-w-sm mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Sanción Temporal Activa</span>
        <span className="text-[9px] font-mono font-bold text-slate-400">Progreso: {Math.round(100 - progress)}%</span>
      </div>

      <div className="flex flex-col items-center justify-center py-2 space-y-1 select-none">
        <span className="text-3xl font-mono font-black text-slate-800 tracking-wider">
          {timeLeft}
        </span>
        <span className="text-[9px] text-slate-450 font-bold uppercase tracking-widest">Horas : Minutos : Segundos</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/20">
        <motion.div 
          className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full"
          initial={{ width: `${progress}%` }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "linear" }}
        />
      </div>

      <div className="text-[9px] text-slate-500 font-semibold leading-normal flex items-start gap-1.5 justify-center text-left">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-ping" />
        <span>Tu cuenta se restaurará automáticamente sin necesidad de contactar a soporte al terminar este conteo.</span>
      </div>
    </div>
  );
}

function AdminDriverBlockBadge({ cond }: { cond: any }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!cond || !cond.bloqueado) return;
    if (cond.bloqueo_tipo !== 'temporal' || !cond.bloqueado_hasta) {
      setTimeLeft('Sanción Permanente');
      return;
    }

    const calculate = () => {
      const endTime = new Date(cond.bloqueado_hasta).getTime();
      const remaining = endTime - Date.now();

      if (remaining <= 0) {
        setTimeLeft('Tiempo Expirado');
        // Silently auto-unblock this driver in Firestore
        toggleBloqueoConductor(cond.id, false).catch(err => console.error("Silent unblock failed:", err));
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');

      setTimeLeft(`${hStr}:${mStr}:${sStr}`);
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [cond]);

  if (!cond || !cond.bloqueado) return null;

  return (
    <span className={`text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1 shadow-sm transition-all ${
      cond.bloqueo_tipo === 'temporal' 
        ? 'bg-rose-50 text-rose-600 border-rose-200/60 shadow-rose-50' 
        : 'bg-red-50 text-red-600 border-red-200/60 shadow-red-50'
    }`}>
      <Clock size={10} className={cond.bloqueo_tipo === 'temporal' ? 'animate-pulse text-rose-500' : ''} />
      {cond.bloqueo_tipo === 'temporal' ? `Bloqueado ${timeLeft}` : 'Bloqueado'}
    </span>
  );
}

// --- Main App Component ---
export default function App() {
  console.log("App rendering... Auth state:", auth.currentUser?.uid || "Not logged in");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<any>(null);
  const [conductor, setConductor] = useState<any>(null);
  const [showRegistroConductorModal, setShowRegistroConductorModal] = useState(false);
  
  // --- Email & Phone Authentication States ---
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1); // Paso 1: Enviar código, Paso 2: Verificar
  const [phoneInput, setPhoneInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [isPhoneProcessing, setIsPhoneProcessing] = useState(false);
  const [emailForm, setEmailForm] = useState({ 
    email: '', 
    password: '', 
    nombre: '', 
    telefono: '', 
    selectedRole: 'usuario', 
    genero: 'femenino',
    nombre_comercial: '',
    categoria_aliado: 'Restaurante',
    whatsapp_aliado: '',
    ciudad_cobertura: '',
    direccion_fisica: '',
    departamento: 'Cundinamarca',
    ciudad: 'Fusagasugá'
  });
  const [emailAuthMode, setEmailAuthMode] = useState<'login' | 'register'>('register');
  const [phoneAuthSubMode, setPhoneAuthSubMode] = useState<'register' | 'login'>('register');
  const [isEmailProcessing, setIsEmailProcessing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viajesActivos, setViajesActivos] = useState<any[]>([]);
  const [misViajes, setMisViajes] = useState<any[]>([]);
  const [misViajesConductor, setMisViajesConductor] = useState<any[]>([]);
  const [historialViajes, setHistorialViajes] = useState<any[]>([]);
  const [historialViajesConductor, setHistorialViajesConductor] = useState<any[]>([]);
  const [misMovimientos, setMisMovimientos] = useState<any[]>([]);
  const [notifiedTrips, setNotifiedTrips] = useState<Set<string>>(new Set());
  const [latestTripAlert, setLatestTripAlert] = useState<any | null>(null);
  const [notifiedRecharges, setNotifiedRecharges] = useState<Set<string>>(new Set());
  const [unreadMessages, setUnreadMessages] = useState<{ [viajeId: string]: number }>({});
  const [lastSeenMsgCount, setLastSeenMsgCount] = useState<{ [viajeId: string]: number }>({});

  // --- Phone Cleaning Utility ---
  const cleanPhone = (phone: string | undefined | null) => {
    if (!phone) return "";
    // Remove all non-digits
    let clean = phone.replace(/\D/g, '');
    
    // Strip leading zeros (like 0057 or just leading 0)
    while (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    
    // If it is exactly 10 digits (standard Colombian mobile), add country code 57
    if (clean.length === 10) {
      return "57" + clean;
    }
    
    // If it's 12 digits starting with 57, it is already perfectly formatted
    if (clean.length === 12 && clean.startsWith('57')) {
      return clean;
    }
    
    // Fallback: If it contains a standard Colombian mobile number (starts with 3, has 10 digits)
    const matchMobile = clean.match(/3\d{9}/);
    if (matchMobile) {
      return "57" + matchMobile[0];
    }
    
    return clean.length >= 10 ? clean : "";
  };

  // --- City Normalization Utility ---
  const normalizeStrForCity = (str: string | undefined | null) => 
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const handleWhatsAppContact = (phone: string | undefined | null, name: string, message: string) => {
    const cleaned = cleanPhone(phone);
    if (!cleaned) {
      toast.error(`No hay un número de WhatsApp registrado para ${name}`);
      return;
    }
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noreferrer');
  };

  const isUserAdmin = perfil?.rol === 'admin' || perfil?.rol === 'admin_suplente' || user?.email === 'darwin.barbosa000@gmail.com' || user?.email === 'ruedasrapidasviajaseguro@gmail.com';


  // --- Error Handling Utility ---
  const handleServiceCall = async <T,>(fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> => {
    try {
      const result = await fn();
      if (successMessage) toast.success(successMessage);
      return result;
    } catch (error: any) {
      let displayMessage = "Ocurrió un error inesperado";
      
      try {
        // Try to parse the JSON error from handleFirestoreError
        const errorMsg = typeof error.message === 'string' ? error.message : String(error);
        const errorInfo = JSON.parse(errorMsg);
        displayMessage = errorInfo.error || displayMessage;
      } catch (e) {
        // If it's not JSON, use the message directly
        displayMessage = error.message || String(error);
      }
      
      // Remove technical prefixes if they exist (e.g. "Error: ")
      displayMessage = displayMessage.replace(/^Error:\s*/i, '');
      
      toast.error(displayMessage);
      return undefined;
    }
  };

  // --- Leaderboard Logic ---
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<'carro' | 'moto' | 'taxi'>('carro');
  
  const getLeaderboardData = () => {
    let leaderboardType = selectedLeaderboard;
    if (conductor && !isUserAdmin) {
      const type = conductor.vehiculo?.tipo;
      if (type === 'moto' || type === 'taxi' || type === 'carro') {
        leaderboardType = type;
      } else {
        leaderboardType = 'carro';
      }
    }
    return allDrivers
      .filter(d => d.vehiculo?.tipo === leaderboardType && (isUserAdmin || (d.calificacion || 0) >= 4.0))
      .sort((a, b) => (b.servicios_semanales || 0) - (a.servicios_semanales || 0))
      .slice(0, 100);
  };

  const LeaderboardView = () => {
    const data = getLeaderboardData();
    
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between px-2 pt-2">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-800 uppercase">Ranking Elite</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actividad de la semana</p>
          </div>
          <Trophy className="text-slate-300" size={24} />
        </div>

        {/* Tab Selector - More subtle */}
        <div className="flex p-1 bg-slate-200/40 rounded-xl border border-slate-200/50 gap-1">
          <button 
            onClick={() => setSelectedLeaderboard('carro')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedLeaderboard === 'carro' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Car size={14} />
            Carros
          </button>
          <button 
            onClick={() => setSelectedLeaderboard('moto')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedLeaderboard === 'moto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Bike size={14} />
            Motos
          </button>
          <button 
            onClick={() => setSelectedLeaderboard('taxi')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedLeaderboard === 'taxi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Taxi size={14} />
            Taxis
          </button>
        </div>

        <div className="grid gap-1">
          {data.length > 0 ? data.map((d, idx) => (
            <div
              key={d.id}
              className={`relative overflow-hidden bg-white border border-slate-100 p-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-slate-50 ${idx === 0 ? 'border-amber-200 bg-amber-50/10' : ''}`}
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-6 shrink-0">
                <span className={`text-xs font-black ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-700/60' : 'text-slate-300'}`}>
                  {idx + 1}
                </span>
              </div>

              {/* Mini Avatar */}
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                {d.foto ? (
                   <img src={d.foto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="text-slate-300" size={16} />
                )}
              </div>

              {/* Name and Basic Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-[11px] font-bold text-slate-800 truncate uppercase leading-tight">{d.nombre || 'Conductor'}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star size={8} className="text-amber-500 fill-amber-500" />
                    <span className="text-[9px] font-bold text-amber-600">{(d.calificacion || 0).toFixed(1)}</span>
                  </div>
                  <span className="text-[9px] font-medium text-slate-400 truncate tracking-tight">
                    {d.vehiculo?.modelo || 'Flash Driver'}
                  </span>
                </div>
              </div>

              {/* Stats - More compact */}
              <div className="text-right border-l border-slate-100 pl-3">
                <p className="text-sm font-black text-indigo-600 leading-none">{d.servicios_semanales || 0}</p>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">Viajes</p>
              </div>
            </div>
          )) : (
            <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Sin datos esta semana</p>
            </div>
          )}
        </div>

        {/* Legend - Sleek and subtle */}
        <div className="p-4 bg-slate-900 rounded-2xl text-white/90">
          <div className="flex items-center gap-3">
            <Zap className="text-amber-400" size={18} />
            <p className="text-[9px] font-medium leading-relaxed">
              El ranking se reinicia cada lunes. Los conductores con <span className="text-amber-400 font-bold">+4.5 estrellas</span> son elegibles para el Cuadro de Honor.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const AdminResumenFinanciero = () => {
    // Calculos de datos reales
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const recargasHoy = historialRecargas.filter(r => r.estado === 'aprobada' && new Date(r.fecha).getTime() >= hoy.getTime());
    const totalRecargasHoy = recargasHoy.reduce((acc, r) => acc + (r.valor || 0), 0);
    
    // Simulación de tendencia (usamos las últimas 24h)
    const recargasPorHora = useMemo(() => {
      const horas = Array.from({ length: 24 }, (_, i) => ({ hora: `${i}h`, valor: 0 }));
      recargasHoy.forEach(r => {
        const h = new Date(r.fecha).getHours();
        horas[h].valor += r.valor || 0;
      });
      const currentHour = new Date().getHours();
      return horas.slice(Math.max(0, currentHour - 6), currentHour + 1); // Últimas 6 horas
    }, [recargasHoy]);

    const flujoEfectivo = recargasHoy.filter(r => r.tipo === 'manual').reduce((acc, r) => acc + (r.valor || 0), 0);
    const flujoDigital = recargasHoy.filter(r => r.tipo !== 'manual').reduce((acc, r) => acc + (r.valor || 0), 0);

    const metaDiaria = totalRecargasHoy > 1500000 ? 5000000 : 1500000;
    const cumplimientoMeta = Math.min(100, (totalRecargasHoy / metaDiaria) * 100);

    const topConductores = useMemo(() => {
      const counts: Record<string, { nombre: string, foto: string, total: number }> = {};
      recargasHoy.forEach(r => {
        if (!counts[r.conductorId]) {
          counts[r.conductorId] = { nombre: r.conductorNombre || "Sin Nombre", foto: r.conductorFoto || '', total: 0 };
        }
        counts[r.conductorId].total += r.valor || 0;
      });
      return Object.entries(counts)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    }, [recargasHoy]);

    const ultimasTransacciones = historialRecargas.slice(0, 5);

    const ciudadesData = useMemo(() => {
      const counts: Record<string, number> = {};
      recargasHoy.forEach(r => {
        const ciudad = r.ciudad || 'Otras';
        counts[ciudad] = (counts[ciudad] || 0) + (r.valor || 0);
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [recargasHoy]);

    const vehiculosData = useMemo(() => {
        const counts: Record<string, number> = {};
        allDrivers.forEach(d => {
          const rHoy = recargasHoy.filter(r => r.conductorId === d.id);
          if (rHoy.length > 0) {
            const tipo = d.vehiculo?.tipo || 'Auto';
            counts[tipo] = (counts[tipo] || 0) + rHoy.reduce((acc, r) => acc + (r.valor || 0), 0);
          }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [recargasHoy, allDrivers]);

    return (
      <div className="space-y-4 animate-in fade-in zoom-in duration-500 max-w-4xl mx-auto">
        {/* BLOQUE 1: METRICAS GENERALES */}
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Caja Diaria (Recargas)</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">${totalRecargasHoy.toLocaleString()}</h2>
                  <div className="flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 rounded-full">
                    <ChevronUp size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">12%</span>
                  </div>
                </div>
              </div>
              <div className="w-32 h-16 blur-[0.5px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recargasPorHora}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="valor" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <CreditCard size={40} className="text-slate-900" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo Recolectado</p>
                <p className="text-lg font-black text-slate-800 leading-none">${flujoEfectivo.toLocaleString()}</p>
                <div className="mt-2 h-1 w-8 bg-slate-900 rounded-full" />
              </div>
              <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <Zap size={40} className="text-slate-900" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Flujo Digital/Transferencias</p>
                <p className="text-lg font-black text-slate-800 leading-none">${flujoDigital.toLocaleString()}</p>
                <div className="mt-2 h-1 w-8 bg-red-500 rounded-full" />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.1em]">
                <span className="text-slate-400">Meta de Recaudación</span>
                <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{cumplimientoMeta.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${cumplimientoMeta}%` }}
                   className="h-full bg-slate-900 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE EXPORTAR OPERACIÓN A GOOGLE SHEETS */}
        <div className="bg-gradient-to-br from-emerald-50 via-emerald-100/30 to-slate-50 p-6 rounded-[2.5rem] border border-emerald-200/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-600/20">
              <FileSpreadsheet size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                Exportación en Tiempo Real para Google Sheets
                <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 text-[8px] rounded-full font-black uppercase">CSV UTF-8</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-lg">
                Genera y descarga un archivo unificado compatible con Google Sheets y Excel. Incluye todas las métricas de operación, historial total de viajes, directorios de conductores y usuarios, transacciones de recarga y catálogos de marcas aliadas en tiempo real.
              </p>
            </div>
          </div>
          <button
            onClick={exportarOperacionTotal}
            className="w-full md:w-auto px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 shrink-0"
          >
            <FileSpreadsheet size={14} />
            <span>Descargar Google Sheets</span>
          </button>
        </div>

        {/* BLOQUE 2: RANKING Y TRANSACCIONES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Conductores */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <Medal size={14} className="text-amber-500" />
                Ranking Recaudación
              </h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Hoy</span>
            </div>
            <div className="space-y-2">
              {topConductores.length > 0 ? topConductores.map((d, i) => (
                <div key={d.id} className="flex items-center gap-4 p-3 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-100/50 transition-all cursor-default">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-100 text-amber-600' : 'text-slate-300'}`}>
                    {i+1}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-400 overflow-hidden shrink-0 shadow-sm">
                    {d.foto ? <img src={d.foto} alt="" className="w-full h-full object-cover" /> : <UserIcon size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-800 uppercase truncate tracking-tight">{d.nombre}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Activo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">${d.total.toLocaleString()}</p>
                    <div className="flex justify-end gap-0.5 mt-1">
                      {[...Array(3)].map((_, j) => <div key={j} className="w-1 h-1 rounded-full bg-emerald-500/30" />)}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-300 gap-2">
                  <CreditCard size={24} />
                  <p className="text-[9px] font-black uppercase tracking-widest">Sin actividad comercial hoy</p>
                </div>
              )}
            </div>
          </div>

          {/* Historial Compacto */}
          <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl space-y-5 text-white relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[60px] rounded-full" />
            <div className="flex items-center justify-between relative z-10">
              <h4 className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <Clock size={14} className="text-indigo-400" />
                Live Feed
              </h4>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full border border-white/10">
                 <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                 <span className="text-[8px] font-black text-white/60 uppercase">Streaming</span>
              </div>
            </div>
            <div className="space-y-4 relative z-10">
              {ultimasTransacciones.length > 0 ? ultimasTransacciones.map(t => (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/30 group-hover:bg-white/10 transition-colors">
                      {(t.conductorNombre || "?").charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white/90 uppercase truncate max-w-[120px] tracking-tight">{t.conductorNombre || "Sin Nombre"}</span>
                      <span className="text-[8px] text-white/40 font-mono font-bold tracking-widest">{new Date(t.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-500 tracking-tighter group-hover:text-white transition-colors">${t.valor.toLocaleString()}</p>
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">{t.metodo || 'Digital'}</p>
                  </div>
                </div>
              )) : (
                <div className="py-12 flex flex-col items-center justify-center text-white/10 gap-2">
                   <Zap size={24} />
                   <p className="text-[9px] font-black uppercase tracking-widest">Sincronizando transacciones...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOQUE 3: DESGLOSES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Ciudad */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] px-1">Presencia Regional</h4>
                <PieChart width={20} height={20}><Pie data={[{v:1}]} dataKey="v" fill="#f1f5f9" /></PieChart>
              </div>
              <div className="flex items-center gap-8">
                <div className="w-32 h-32 shrink-0">
                  {ciudadesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ciudadesData}
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {ciudadesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#ef4444', '#0f172a', '#64748b', '#334155', '#94a3b8'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                           itemStyle={{ color: '#0f172a', fontWeight: '900', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full border-4 border-slate-50 rounded-full" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {ciudadesData.map((c, i) => (
                    <div key={c.name} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{c.name}</span>
                        <span className="text-[10px] font-black text-slate-900">{((c.value / (totalRecargasHoy || 1)) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${['bg-red-500', 'bg-slate-900', 'bg-slate-500', 'bg-slate-400', 'bg-slate-300'][i % 5]}`} style={{ width: `${(c.value / (totalRecargasHoy || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
           </div>

           {/* Flota */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] px-1">Volumen por Segmento</h4>
                <BarChart width={20} height={20} data={[{v:1}]}>
                  <Bar dataKey="v" fill="#f1f5f9" isAnimationActive={false} />
                </BarChart>
              </div>
              <div className="flex-1 min-h-[120px]">
                 {vehiculosData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vehiculosData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} hide />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={24}>
                        {vehiculosData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#ef4444', '#0f172a', '#64748b', '#334155'][index % 4]} />
                        ))}
                      </Bar>
                      <Tooltip 
                         cursor={{ fill: '#f8fafc' }}
                         contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                         itemStyle={{ color: '#0f172a', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                 ) : (
                  <div className="h-full flex items-center justify-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Esperando actividad operacional</p>
                  </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  };


  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const prevTripsStateRef = React.useRef<{[id: string]: string}>({});

  // Hook for drag-to-scroll behavior in Alianzas/Brands Modal
  const useDragToScroll = (ref: React.RefObject<HTMLDivElement | null>, axis: 'x' | 'y' | 'both' = 'both') => {
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      if (e.button !== 0) return; // Left click only

      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea') || target.closest('select')) {
        return;
      }

      setIsDragging(true);
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';

      el.dataset.dragStartX = String(e.pageX - el.offsetLeft);
      el.dataset.dragStartY = String(e.pageY - el.offsetTop);
      el.dataset.dragScrollLeft = String(el.scrollLeft);
      el.dataset.dragScrollTop = String(el.scrollTop);
    }, [ref]);

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const el = ref.current;
      if (!el) return;
      e.preventDefault();

      const startX = Number(el.dataset.dragStartX || 0);
      const startY = Number(el.dataset.dragStartY || 0);
      const initialScrollLeft = Number(el.dataset.dragScrollLeft || 0);
      const initialScrollTop = Number(el.dataset.dragScrollTop || 0);

      const x = e.pageX - el.offsetLeft;
      const y = e.pageY - el.offsetTop;

      if (axis === 'x' || axis === 'both') {
        const walkX = (x - startX) * 1.5;
        el.scrollLeft = initialScrollLeft - walkX;
      }
      if (axis === 'y' || axis === 'both') {
        const walkY = (y - startY) * 1.5;
        el.scrollTop = initialScrollTop - walkY;
      }
    }, [isDragging, ref, axis]);

    const handleMouseUpOrLeave = React.useCallback(() => {
      setIsDragging(false);
      const el = ref.current;
      if (el) {
        el.style.cursor = 'grab';
        el.style.userSelect = '';
      }
    }, [ref]);

    return {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUpOrLeave,
      onMouseLeave: handleMouseUpOrLeave,
      style: { cursor: isDragging ? 'grabbing' : 'grab' }
    };
  };

  const brandsListScrollRef = React.useRef<HTMLDivElement>(null);
  const categoriesScrollRef = React.useRef<HTMLDivElement>(null);

  const brandsListScrollProps = useDragToScroll(brandsListScrollRef, 'y');
  const categoriesScrollProps = useDragToScroll(categoriesScrollRef, 'x');

  const [activeTab, setActiveTab] = useState<'home' | 'usuario' | 'conductor' | 'admin' | 'leaderboard'>('home');
  const [showDriverInvite, setShowDriverInvite] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ruedas_dismiss_driver_invite') !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismissDriverInvite = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowDriverInvite(false);
    try {
      localStorage.setItem('ruedas_dismiss_driver_invite', 'true');
    } catch (err) {
      console.error(err);
    }
  };

  const [adminSubTab, setAdminSubTab] = useState<'resumen' | 'recargas' | 'conductores' | 'usuarios' | 'espera' | 'alertas' | 'soporte' | 'historial' | 'ranking' | 'aliados' | 'activacion'>('resumen');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPromoFilter, setUserPromoFilter] = useState<'todos' | 'sin_bono' | 'con_bono'>('todos');
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [allCancelledTrips, setAllCancelledTrips] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [marcasAliadas, setMarcasAliadas] = useState<any[]>([]);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState('');
  const [nuevaMarcaDireccion, setNuevaMarcaDireccion] = useState('');
  const [nuevaMarcaCiudad, setNuevaMarcaCiudad] = useState('');
  const [nuevaMarcaWhatsapp, setNuevaMarcaWhatsapp] = useState('');
  const [nuevaMarcaCategoria, setNuevaMarcaCategoria] = useState('Restaurante');
  const [editingMarcaId, setEditingMarcaId] = useState<string | null>(null);
  const [nuevaMarcaLogo, setNuevaMarcaLogo] = useState('');

  const [showUserMarcaRegistroModal, setShowUserMarcaRegistroModal] = useState(false);
  const [userMarcaNombre, setUserMarcaNombre] = useState('');
  const [userMarcaDireccion, setUserMarcaDireccion] = useState('');
  const [userMarcaCiudad, setUserMarcaCiudad] = useState('');
  const [userMarcaWhatsapp, setUserMarcaWhatsapp] = useState('');
  const [userMarcaCategoria, setUserMarcaCategoria] = useState('Restaurante');
  const [userMarcaLogo, setUserMarcaLogo] = useState('');
  const [userLogoDragActive, setUserLogoDragActive] = useState(false);
  const [adminLogoDragActive, setAdminLogoDragActive] = useState(false);

  // --- States for User's Offer of the Day ---
  const [userOfferTitulo, setUserOfferTitulo] = useState('');
  const [userOfferDescripcion, setUserOfferDescripcion] = useState('');
  const [userOfferPrecioOriginal, setUserOfferPrecioOriginal] = useState<string | number>('');
  const [userOfferPrecioDescuento, setUserOfferPrecioDescuento] = useState<string | number>('');
  const [userOfferImagen, setUserOfferImagen] = useState('');
  const [userOfferActiva, setUserOfferActiva] = useState(false);
  const [userOfferDragActive, setUserOfferDragActive] = useState(false);

  const [showNetworkGoals, setShowNetworkGoals] = useState(false);
  const [showModalGoals, setShowModalGoals] = useState(false);
  const [showAlianzasBanner, setShowAlianzasBanner] = useState(false);

  const [showAliadosDiscovery, setShowAliadosDiscovery] = useState(false);
  const [domicilioTab, setDomicilioTab] = useState<'envio' | 'aliados'>('envio');
  const [showAliadoDispatchModal, setShowAliadoDispatchModal] = useState(false);
  const [dispatchSelectedAliadoId, setDispatchSelectedAliadoId] = useState('');
  const [dispatchDestino, setDispatchDestino] = useState('');
  const [dispatchValor, setDispatchValor] = useState(5000);
  const [dispatchDetalles, setDispatchDetalles] = useState('');
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [selectedBrandCategory, setSelectedBrandCategory] = useState('Todos');
  const [brandFilterCity, setBrandFilterCity] = useState<'mine' | 'all'>('all');
  const [selectedAliadoForUser, setSelectedAliadoForUser] = useState<any>(null);
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMarcaRegistroModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (activeTab === 'usuario') {
      setShowAlianzasBanner(true);
      const timer = setTimeout(() => {
        setShowAlianzasBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);
  
  const unattendedTrips = useMemo(() => {
    return allTrips.filter(t => t.estado === 'solicitado');
  }, [allTrips]);

  const historicalWaitingStats = useMemo(() => {
    // Combine regular trips that happen to be cancelled or fully finished-cancelled
    const cancelled = [...allCancelledTrips];
    // Add any from allTrips that might not be in the dedicated list
    allTrips.filter(t => t.estado === 'cancelado' || t.estado === 'finalizado_cancelado').forEach(t => {
      if (!cancelled.find(c => c.id === t.id)) cancelled.push(t);
    });
    
    // Sort by date desc
    cancelled.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const byUser = cancelled.filter(t => t.canceladoPor === 'usuario').length;
    const byDriver = cancelled.filter(t => t.canceladoPor === 'conductor').length;
    const byTimeout = cancelled.filter(t => !t.canceladoPor || t.canceladoPor === 'sistema').length;

    const trend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString([], { weekday: 'short' });
      const dayCancelled = cancelled.filter(t => {
        const dateToUse = t.fecha_cancelacion || t.fecha;
        const tDate = new Date(dateToUse);
        return tDate.getDate() === d.getDate() && tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear();
      }).length;
      return { name: label, total: dayCancelled };
    });

    const byType = [
      { name: 'Moto', count: cancelled.filter(t => t.tipo === 'moto').length, color: '#6366f1' },
      { name: 'Auto', count: cancelled.filter(t => (t.tipo === 'taxi' || t.tipo === 'carrox')).length, color: '#10b981' },
      { name: 'Reparto', count: cancelled.filter(t => t.tipo === 'reparto').length, color: '#f59e0b' },
    ].filter(item => item.count > 0);

    const todayCancelled = cancelled.filter(t => {
      const dateToUse = t.fecha_cancelacion || t.fecha;
      if (!dateToUse) return false;
      const tDate = new Date(dateToUse);
      const now = new Date();
      // Comparación robusta por día local
      return tDate.toDateString() === now.toDateString();
    }).sort((a, b) => new Date(b.fecha_cancelacion || b.fecha).getTime() - new Date(a.fecha_cancelacion || a.fecha).getTime());

    const todayStats = {
      total: todayCancelled.length,
      byUser: todayCancelled.filter(t => t.canceladoPor === 'usuario').length,
      byDriver: todayCancelled.filter(t => t.canceladoPor === 'conductor').length,
      bySystem: todayCancelled.filter(t => !t.canceladoPor || t.canceladoPor === 'sistema').length,
      valorTotal: todayCancelled.reduce((acc, t) => acc + (t.valor || 0), 0)
    };

    return { byUser, byDriver, byTimeout, trend, byType, total: cancelled.length, todayCancelled, todayStats };
  }, [allCancelledTrips]);

  const driverAbandonmentTrips = useMemo(() => {
    if (!conductor || !conductor.activo) return [];
    
    return unattendedTrips.filter(t => {
      // Filtro por ciudad
      if (t.ciudad && normalizeStrForCity(t.ciudad) !== normalizeStrForCity(conductor.ciudad)) return false;
      if (t.departamento && conductor.departamento && normalizeStrForCity(t.departamento) !== normalizeStrForCity(conductor.departamento)) return false;
      
      // Filtro por modo rosa
      if (t.modoRosa && !(conductor.genero?.toLowerCase() === 'femenino' || conductor.genero?.toLowerCase()?.includes('femenino'))) return false;
      
      // Filtro por tipo de servicio compatible
      const tipoConductor = conductor.vehiculo?.tipo || 'carro';
      
      if (t.tipo === 'domicilio' || t.tipo === 'reparto' || t.tipo === 'repartidor') {
        if (!conductor.modo_repartidor) return false;
      } else if (t.tipo === 'moto') {
        if (tipoConductor !== 'moto') return false;
      } else if (t.tipo === 'carro' || t.tipo === 'taxi' || t.tipo === 'carrox') {
        if (tipoConductor !== 'carro') return false;
      }
      
      // Condición de tiempo de abandono (6 minutos como el admin)
      const diff = currentTime.getTime() - new Date(t.fecha).getTime();
      return diff > 6 * 60 * 1000;
    });
  }, [conductor, unattendedTrips, currentTime]);

  const [driverSubTab, setDriverSubTab] = useState<'viajes' | 'mapa' | 'perfil' | 'soporte'>('viajes');

  const unattendedByCity = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    unattendedTrips.forEach(t => {
      const city = t.usuarioCiudad || t.ciudad || 'N/A';
      if (!grouped[city]) grouped[city] = [];
      grouped[city].push(t);
    });
    // Sort cities by number of unattended trips
    return Object.fromEntries(
      Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)
    );
  }, [unattendedTrips]);

  const availableDriversByCity = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    allDrivers.forEach(d => {
      if (d.activo && !d.en_servicio) {
        const city = d.ciudad || 'N/A';
        if (!grouped[city]) grouped[city] = [];
        grouped[city].push(d);
      }
    });
    return grouped;
  }, [allDrivers]);

  const calculateDriverEarnings = () => {
    const now = new Date();
    
    // Today's start (local midnight)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // This week's start (Monday of current week)
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const mondayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
    mondayStart.setHours(0, 0, 0, 0);
    
    // This month's start (1st of current month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    
    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    
    historialViajesConductor.forEach(viaje => {
      if (!viaje.fecha || !viaje.valor) return;
      const viajeDate = new Date(viaje.fecha);
      const value = Number(viaje.valor) || 0;
      
      // Daily
      if (viajeDate >= todayStart) {
        daily += value;
      }
      // Weekly
      if (viajeDate >= mondayStart) {
        weekly += value;
      }
      // Monthly
      if (viajeDate >= monthStart) {
        monthly += value;
      }
    });
    
    return { daily, weekly, monthly };
  };

  const [showHistory, setShowHistory] = useState(false);
  const [showDriverFinancesModal, setShowDriverFinancesModal] = useState(false);
  const [showUserFinancesModal, setShowUserFinancesModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [driverFinancesGoal, setDriverFinancesGoal] = useState(() => {
    const saved = localStorage.getItem('driver_finances_goal');
    return saved ? Number(saved) : 60000;
  });
  const [showMovements, setShowMovements] = useState(false);
  const [historyType, setHistoryType] = useState<'usuario' | 'conductor'>('usuario');
  const [showRegModal, setShowRegModal] = useState(false);
  const [showTripRequestModal, setShowTripRequestModal] = useState(false);
  const [socioModalRightTab, setSocioModalRightTab] = useState<'directorio' | 'despacho'>('directorio');
  const [selectedServiceType, setSelectedServiceType] = useState<'carro' | 'moto' | 'taxi' | 'domicilio' | 'camion_flete' | 'camion_acarreo' | 'motocarro' | 'marcas_aliadas' | null>(null);
  
  const [guidePhraseIdx, setGuidePhraseIdx] = useState(0);
  const guidePhrases = [
    "🛍️ ¡Pide domicilios directos a comercios locales sin comisiones intermediarias!",
    "✨ ¡Apoyemos la economía de Arauca explorando marcas aliadas de nuestra zona!",
    "🚀 ¿Tienes un negocio? ¡Únete gratis y despacha sin pagar comisiones abusivas!",
    "🍕 Encuentra restaurantes, droguerías, ferreterías y apoya el crecimiento regional.",
    "🤝 Fortalece la red local: compra local, impulsa el empleo y haz crecer tu ciudad.",
    "🌱 Alianzas de Comercio: conectando comercios directos con repartidores de confianza."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setGuidePhraseIdx((prev) => (prev + 1) % guidePhrases.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const [modoRosa, setModoRosa] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState({ nombre: '', celular: '', ciudad: '', departamento: '', genero: 'masculino' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showDriverRegModal, setShowDriverRegModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [activeSupportConductor, setActiveSupportConductor] = useState<any>(null);
  const [supportChats, setSupportChats] = useState<SoporteChat[]>([]);
  const [activeChatViaje, setActiveChatViaje] = useState<any>(null);
  const [hasPendingRecharge, setHasPendingRecharge] = useState(false);
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);
  const [driverGpsLocation, setDriverGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverGpsDenied, setDriverGpsDenied] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedTripForOffer, setSelectedTripForOffer] = useState<any>(null);
  const [offerValue, setOfferValue] = useState<number>(5000);
  const [arrivalETA, setArrivalETA] = useState<number>(5);

  const requestDriverGpsLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setDriverGpsDenied(true);
      return;
    }

    setDriverGpsDenied(false);
    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    const handleSuccess = (pos: GeolocationPosition) => {
      if (pos && pos.coords && !isNaN(pos.coords.latitude) && !isNaN(pos.coords.longitude)) {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverGpsLocation(newPos);
        setDriverGpsDenied(false);

        if (user?.uid) {
          setDoc(doc(db, 'drivers_location', user.uid), {
            lat: newPos.lat,
            lng: newPos.lng,
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(() => {});
        }
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn("Driver GPS error:", err);
      if (err.code === 1 || !driverGpsLocation) {
        setDriverGpsDenied(true);
      }
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    return watchId;
  }, [user?.uid, driverGpsLocation]);

  // Real-time GPS tracking when offer modal is open
  useEffect(() => {
    if (!showOfferModal) return;

    const watchId = requestDriverGpsLocation();
    return () => {
      if (typeof watchId === 'number') {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [showOfferModal, requestDriverGpsLocation]);

  // Geo-tracking driver position in real time for route estimation
  useEffect(() => {
    // Si el usuario es conductor, intentar primero cargar la posición guardada en Firestore
    if (user?.uid) {
      const docRef = doc(db, 'drivers_location', user.uid);
      onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.lat === 'number' && typeof data.lng === 'number' && !isNaN(data.lat) && !isNaN(data.lng)) {
            setDriverGpsLocation({ lat: data.lat, lng: data.lng });
          }
        }
      });
    }

    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const geoOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 };

    const handleSuccess = (pos: GeolocationPosition) => {
      if (pos && pos.coords && !isNaN(pos.coords.latitude) && !isNaN(pos.coords.longitude)) {
        setDriverGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      }
    };

    // Obtención rápida e inmediata
    navigator.geolocation.getCurrentPosition(handleSuccess, (err) => console.warn("GPS error:", err), geoOptions);

    // Rastreo continuo
    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      (err) => console.warn("Driver geolocation watch error:", err),
      geoOptions
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?.uid]);
  
  // Listen for recharges (Admin & Driver)
  useEffect(() => {
    if (!user) return;
    
    // Admin listener (already exists, but we can reuse or keep separate)
    // Driver listener to check for their own pending recharges
    const qMyRecargas = query(
      collection(db, 'recargas'),
      where('conductorId', '==', user.uid),
      where('estado', '==', 'pendiente')
    );
    
    const unsubMyRecargas = onSnapshot(qMyRecargas, (snapshot) => {
      setHasPendingRecharge(!snapshot.empty);
    }, (error) => {
      console.error("Error in my recharges snapshot:", error);
    });
    
    return () => unsubMyRecargas();
  }, [user]);

  // Listen for active Expreso trips
  useEffect(() => {
    if (!user) {
      setExpresoViajes([]);
      return;
    }

    const q = query(
      collection(db, 'expreso_viajes'),
      where('estado', '==', 'programado'),
      orderBy('fechaSalida', 'asc')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const trips = snapshot.docs.map(doc => {
        const data = doc.data();
        if (!data.conductorTelefono) {
          const driver = allDrivers.find(d => d.id === data.conductorId);
          if (driver) data.conductorTelefono = driver.telefono;
        }
        return { id: doc.id, ...data } as any;
      });
      
      const now = new Date();
      
      // Filter out trips whose departure time has already passed (client-side safety)
      const activeTrips = trips.filter((viaje: any) => {
        if (!viaje.fechaSalida) return false;
        const tripDate = new Date(viaje.fechaSalida);
        return tripDate >= now;
      });

      // Automatically delete expired trips from Firestore to clean up database
      const expiredTrips = trips.filter((viaje: any) => {
        if (!viaje.fechaSalida) return false;
        const tripDate = new Date(viaje.fechaSalida);
        return tripDate < now;
      });

      setExpresoViajes(activeTrips);

      if (expiredTrips.length > 0) {
        expiredTrips.forEach(async (viaje: any) => {
          const isTripConductor = user && viaje.conductorId === user.uid;
          
          if (isTripConductor || isUserAdmin) {
            try {
              await deleteDoc(doc(db, 'expreso_viajes', viaje.id));
              console.log(`Auto-deleted expired expreso trip: ${viaje.id}`);
            } catch (deleteError) {
              console.error(`Error auto-deleting expired trip ${viaje.id}:`, deleteError);
            }
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expreso_viajes');
    });
    
    return () => unsub();
  }, [user, allDrivers, perfil]);

  // Listen for unread support (Conductor)
  useEffect(() => {
    if (user && activeTab === 'conductor') {
      const chatRef = doc(db, 'soporte_chats', user.uid);
      const unsub = onSnapshot(chatRef, (doc) => {
        if (doc.exists()) {
          setHasUnreadSupport(!doc.data().leidoPorConductor);
        }
      }, (error) => {
        console.error("Error in support chat status snapshot:", error);
      });
      return () => unsub();
    }
  }, [user, activeTab]);

  // Listen for support chats (Admin)
  useEffect(() => {
    if (isUserAdmin) {
      const unsubscribe = escucharChatsSoporte(setSupportChats);
      return () => unsubscribe();
    }
  }, [perfil, user, isUserAdmin]);

  // --- Role Access Control & Tab Routing ---
  useEffect(() => {
    if (perfil) {
      const userRole = perfil?.rol;
      const isConductorRegistered = !!conductor;

      if (userRole === 'usuario' && !isConductorRegistered) {
        // Only usuario can access: 'usuario', 'admin' (if admin), 'leaderboard'
        const allowedTabs = ['usuario', 'leaderboard'];
        if (isUserAdmin) allowedTabs.push('admin');
        if (!allowedTabs.includes(activeTab)) {
          setActiveTab('usuario');
        }
      } else if (userRole === 'conductor' && !isConductorRegistered) {
        // Only conductor can access: 'conductor', 'admin' (if admin), 'leaderboard'
        const allowedTabs = ['conductor', 'leaderboard'];
        if (isUserAdmin) allowedTabs.push('admin');
        if (!allowedTabs.includes(activeTab)) {
          setActiveTab('conductor');
        }
      } else {
        // Has both roles or is registered as conductor already
        const allowedTabs = ['home', 'usuario', 'conductor', 'leaderboard'];
        if (isUserAdmin) allowedTabs.push('admin');
        if (!allowedTabs.includes(activeTab)) {
          setActiveTab('home');
        }
      }
    }
  }, [perfil, activeTab, isUserAdmin, conductor]);

  const [recargasPendientes, setRecargasPendientes] = useState<any[]>([]);
  const [historialRecargas, setHistorialRecargas] = useState<any[]>([]);
  const [expresoViajes, setExpresoViajes] = useState<any[]>([]);
  const [showExpresoModal, setShowExpresoModal] = useState(false);
  const [showExpresoBookingModal, setShowExpresoBookingModal] = useState(false);
  const [showCargoSelector, setShowCargoSelector] = useState(false);
  const [selectedExpresoTrip, setSelectedExpresoTrip] = useState<any>(null);
  const liveSelectedExpresoTrip = useMemo(() => {
    if (!selectedExpresoTrip) return null;
    const live = expresoViajes.find((v: any) => v.id === selectedExpresoTrip.id);
    const trip = { ...(live || selectedExpresoTrip) };
    if (trip && !trip.conductorTelefono) {
      const d = allDrivers.find((driver: any) => driver.id === trip.conductorId);
      if (d) trip.conductorTelefono = d.telefono;
    }
    return trip;
  }, [selectedExpresoTrip, expresoViajes, allDrivers]);
  const [isCreatingExpreso, setIsCreatingExpreso] = useState(false);
  const [isBookingExpreso, setIsBookingExpreso] = useState(false);
  
  const [filterOrigen, setFilterOrigen] = useState('');
  const [filterDestino, setFilterDestino] = useState('');

  const filteredExpresoViajes = useMemo(() => {
    return expresoViajes.filter((viaje: any) => {
      const matchesOrigen = !filterOrigen || (viaje.origen && viaje.origen.toLowerCase().includes(filterOrigen.toLowerCase()));
      const matchesDestino = !filterDestino || (viaje.destino && viaje.destino.toLowerCase().includes(filterDestino.toLowerCase()));
      return matchesOrigen && matchesDestino;
    });
  }, [expresoViajes, filterOrigen, filterDestino]);
  const [isCancellingExpresoReserva, setIsCancellingExpresoReserva] = useState<string | null>(null);
  const [isCancellingExpresoViaje, setIsCancellingExpresoViaje] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => Promise<void> } | null>(null);

  const misReservasExpreso = useMemo(() => {
    if (!user) return [];
    return expresoViajes.filter(v => v.pasajeros && v.pasajeros[user.uid]);
  }, [user, expresoViajes]);

  const misViajesExpresoPublicados = useMemo(() => {
    if (!user || activeTab !== 'conductor') return [];
    return expresoViajes.filter(v => v.conductorId === user.uid);
  }, [user, activeTab, expresoViajes]);

  const rechargesStats = useMemo(() => {
    // Solo solicitudes de conductores que pasaron por flujo de aprobación
    const approvedRequests = historialRecargas.filter(r => r.estado === 'aprobada' && r.tipo !== 'manual' && r.tipo !== 'ajuste_saldo_usuario');
    
    // Ajustes manuales realizados por el administrador
    const manualAdjustments = historialRecargas.filter(r => r.tipo === 'manual' || r.tipo === 'ajuste_saldo_usuario');
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Totales específicos
    const totalAprobadas = approvedRequests.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const totalManuales = manualAdjustments.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    
    // De cara a "Recaudación Total" según el usuario: solo aprobadas
    const totalCalculated = totalAprobadas;

    const dailyTotal = historialRecargas
      .filter(r => (r.estado === 'aprobada' || r.tipo === 'manual' || r.tipo === 'ajuste_saldo_usuario') && new Date(r.fecha) >= today)
      .reduce((acc, curr) => acc + (curr.valor || 0), 0);
      
    const monthlyTotal = historialRecargas
      .filter(r => (r.estado === 'aprobada' || r.tipo === 'manual' || r.tipo === 'ajuste_saldo_usuario') && new Date(r.fecha) >= firstDayOfMonth)
      .reduce((acc, curr) => acc + (curr.valor || 0), 0);

    // Data for charts (Last 7 days) - Basado en TODO lo aprobado para ver flujo real de caja
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString([], { weekday: 'short' });
      const dayTotal = historialRecargas
        .filter(r => {
          if (r.estado !== 'aprobada' && r.tipo !== 'manual' && r.tipo !== 'ajuste_saldo_usuario') return false;
          const rDate = new Date(r.fecha);
          return rDate.getDate() === d.getDate() && 
                 rDate.getMonth() === d.getMonth() && 
                 rDate.getFullYear() === d.getFullYear();
        })
        .reduce((acc, curr) => acc + (curr.valor || 0), 0);
      return { name: label, total: dayTotal };
    });

    // Data for monthly progress (Last 6 months)
    const monthlyHistory = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const label = d.toLocaleDateString([], { month: 'short' });
      const monthTotal = historialRecargas
        .filter(r => {
          if (r.estado !== 'aprobada' && r.tipo !== 'manual' && r.tipo !== 'ajuste_saldo_usuario') return false;
          const rDate = new Date(r.fecha);
          return rDate.getMonth() === d.getMonth() && 
                 rDate.getFullYear() === d.getFullYear();
        })
        .reduce((acc, curr) => acc + (curr.valor || 0), 0);
      return { name: label, total: monthTotal };
    });
    
    // Top Drivers (by total recharged - solo solicitudes aprobadas)
    const driverTotals = approvedRequests.reduce((acc: any, curr) => {
      const id = curr.conductorId || 'sistema';
      const name = curr.conductorNombre || 'Conductor';
      if (!acc[id]) acc[id] = { name, total: 0 };
      acc[id].total += (curr.valor || 0);
      return acc;
    }, {});

    const topDrivers = Object.values(driverTotals)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5);

    return { 
      totalCalculated, 
      totalManuales,
      dailyTotal, 
      monthlyTotal, 
      last7Days, 
      monthlyHistory, 
      approvedCount: approvedRequests.length, 
      manualCount: manualAdjustments.length,
      topDrivers 
    };
  }, [historialRecargas]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const handleCancelarViaje = async (viajeId: string) => {
    if (!user) return;
    try {
      await cancelarViajeConductor(viajeId, user.uid);
      setConfirmCancelId(null);
      toast.success("Viaje cancelado correctamente.");
    } catch (error) {
      console.error("Error al cancelar viaje:", error);
      toast.error("Error al cancelar el viaje.");
    }
  };

  const [confirmCancelIdUser, setConfirmCancelIdUser] = useState<string | null>(null);

  const cancelarViaje = async (viajeId: string) => {
    if (!user) return;
    try {
      await cancelarViajeUsuario(viajeId, user.uid);
      setConfirmCancelIdUser(null);
      toast.success("Viaje cancelado exitosamente");
    } catch (error) {
      console.error("Error al cancelar viaje (usuario):", error);
    }
  };

  // Rating Modal State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedTripForRating, setSelectedTripForRating] = useState<any>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isFinishingTrip, setIsFinishingTrip] = useState(false);

  // Auto-trigger mandatory rating for finished passenger trips
  useEffect(() => {
    if (user && perfil && activeTab === 'usuario' && historialViajes.length > 0) {
      let ratedTrips: string[] = [];
      try {
        ratedTrips = JSON.parse(localStorage.getItem('ratedTrips') || '[]');
      } catch (e) {}

      // Find the most recent trip that has been finished but is not yet rated by the user
      const unratedTrip = [...historialViajes]
        .sort((a, b) => new Date(b.fecha_finalizacion || b.fecha || 0).getTime() - new Date(a.fecha_finalizacion || a.fecha || 0).getTime())
        .find(v => !v.calificado && !ratedTrips.includes(v.id));

      if (unratedTrip) {
        // If not already selected or modal is not shown, trigger it immediately
        if (!selectedTripForRating || selectedTripForRating.id !== unratedTrip.id || !showRatingModal) {
          setSelectedTripForRating(unratedTrip);
          setRatingStars(5);
          setRatingComment("");
          setShowRatingModal(true);
        }
      }
    }
  }, [historialViajes, user, perfil, activeTab, showRatingModal, selectedTripForRating]);

  // Lock selectedLeaderboard for conductors based on their registered vehicle type
  useEffect(() => {
    if (conductor && !isUserAdmin) {
      const targetType = conductor.vehiculo?.tipo === 'moto' ? 'moto' : 'carro';
      if (selectedLeaderboard !== targetType) {
        setSelectedLeaderboard(targetType);
      }
    }
  }, [conductor, isUserAdmin, selectedLeaderboard]);
  const [showAdminMessageModal, setShowAdminMessageModal] = useState(false);
  const [adminMessageTarget, setAdminMessageTarget] = useState<{ id: string, nombre: string, type: 'usuario' | 'conductor' } | null>(null);
  const [adminMessageText, setAdminMessageText] = useState('');
  const [isSendingAdminMessage, setIsSendingAdminMessage] = useState(false);
  const [messagesAdminChat, setMessagesAdminChat] = useState<any[]>([]);
  const [allAdminMessages, setAllAdminMessages] = useState<any[]>([]);
  
  const [expresoForm, setExpresoForm] = useState({
    origen: 'Fusagasugá',
    destino: 'Bogotá',
    puntoEncuentro: '',
    ruta: '',
    fechaSalida: '',
    cuposTotales: 4,
    valorPorCupo: 25000
  });

  const handleCrearViajeExpreso = async () => {
    if (!conductor) return;
    setIsCreatingExpreso(true);
    try {
      await crearViajeExpreso(user.uid, {
        ...expresoForm,
        conductorNombre: conductor.nombre,
        conductorTelefono: conductor.telefono,
        conductorCalificacion: conductor.calificacion || 5,
        vehiculo: conductor.vehiculo,
        estado: 'programado'
      });
      toast.success("Viaje expreso publicado con éxito");
      setShowExpresoModal(false);
      // Reset form
      setExpresoForm({
        origen: 'Fusagasugá',
        destino: 'Bogotá',
        puntoEncuentro: '',
        ruta: '',
        fechaSalida: '',
        cuposTotales: 4,
        valorPorCupo: 25000
      });
    } catch (error: any) {
      console.error("Error al crear viaje expreso:", error);
      toast.error("Error al publicar: " + (error.message || "Intente nuevamente"));
    } finally {
      setIsCreatingExpreso(false);
    }
  };

  const [justBooked, setJustBooked] = useState<string | null>(null);

  const handleReservarCupo = async (viaje: any, cupos: number) => {
    if (!user) return;
    setIsBookingExpreso(true);
    try {
      await reservarCupoExpreso(viaje.id, user.uid, perfil?.nombre || user.displayName, cupos, perfil?.celular || perfil?.telefono || '');
      toast.success(`¡Reserva exitosa! ${cupos} cupo(s) asegurado(s)`);
      setJustBooked(viaje.id);
      // No cerramos el modal para que pueda ver el botón de WhatsApp
    } catch (error: any) {
      console.error("Error al reservar cupo:", error);
      let errorMsg = "No se pudo completar la reserva. Intenta de nuevo.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) errorMsg = parsed.error;
      } catch (e) {
        // Not JSON or no error field
        if (error.message) errorMsg = error.message;
      }
      toast.error(errorMsg);
    } finally {
      setIsBookingExpreso(false);
    }
  };

  const handleCancelarReservaExpreso = async (viaje: any) => {
    if (!user || !viaje) return;
    
    setConfirmAction({
      title: '¿CANCELAR RESERVA?',
      message: 'Esta acción liberará tus cupos inmediatamente para otros pasajeros. ¿Deseas continuar?',
      onConfirm: async () => {
        const id = viaje.id;
        setIsCancellingExpresoReserva(id);
        try {
          await toast.promise(
            cancelarReservaExpreso(id, user.uid, perfil?.nombre || user.displayName || 'Usuario'),
            {
              loading: 'Liberando cupos...',
              success: 'Reserva cancelada correctamente',
              error: (err: any) => {
                console.error(err);
                return "Error al cancelar reserva";
              }
            }
          );
        } finally {
          setIsCancellingExpresoReserva(null);
          setConfirmAction(null);
        }
      }
    });
  };

  const handleCancelarViajeExpresoPost = async (viaje: any) => {
    if (!user || !viaje) return;
    
    setConfirmAction({
      title: '¡ALERTA CRÍTICA!',
      message: '¿ESTÁS TOTALMENTE SEGURO? Esta acción CANCELARÁ el viaje para TODOS los pasajeros confirmados. No se puede deshacer.',
      onConfirm: async () => {
        const id = viaje.id;
        setIsCancellingExpresoViaje(id);
        try {
          await toast.promise(
            cancelarViajeExpreso(id),
            {
              loading: 'Cancelando viaje global...',
              success: 'Viaje cancelado y pasajeros notificados',
              error: 'Error al procesar cancelación'
            }
          );
        } finally {
          setIsCancellingExpresoViaje(null);
          setConfirmAction(null);
        }
      }
    });
  };

  // Notificaciones para conductores: Cancelaciones de Expreso (Reservas quitadas por pasajeros)
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'mensajes_admin'),
        where('targetId', '==', user.uid),
        where('tipo', '==', 'cancelacion_expreso'),
        where('leido', '==', false)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notif = change.doc.data();
            const fechaNotif = new Date(notif.fecha).getTime();
            const ahora = Date.now();
            if (ahora - fechaNotif < 300000) { // Ampliado a 5 minutos por seguridad
              toast.error('¡AVISO DE CANCELACIÓN!', {
                description: notif.mensaje,
                duration: 8000,
                icon: <AlertTriangle className="text-rose-500" />
              });
              updateDoc(doc(db, 'mensajes_admin', change.doc.id), { leido: true });
            }
          }
        });
      }, (err) => console.error("Error listener conductor:", err));
      return () => unsub();
    }
  }, [user]);

  // Notificaciones para usuarios: Cancelaciones de Expreso por parte del Conductor
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'mensajes_admin'),
        where('targetId', '==', user.uid),
        where('tipo', '==', 'cancelacion_expreso_conductor'),
        where('leido', '==', false)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notif = change.doc.data();
            const fechaNotif = new Date(notif.fecha).getTime();
            const ahora = Date.now();
            if (ahora - fechaNotif < 300000) {
              toast.error('MALA NOTICIA: Viaje Cancelado', {
                description: notif.mensaje,
                duration: 15000,
                icon: <XCircle className="text-rose-500" />
              });
              updateDoc(doc(db, 'mensajes_admin', change.doc.id), { leido: true });
            }
          }
        });
      }, (err) => console.error("Error listener usuario:", err));
      return () => unsub();
    }
  }, [user]);

  const [tripRequestData, setTripRequestData] = useState<{
    origen: string;
    destino: string;
    valor: number;
    capacidad_carga: string;
    origenCoords?: { lat: number; lng: number } | null;
    destinoCoords?: { lat: number; lng: number } | null;
  }>({
    origen: '',
    destino: '',
    valor: 5000,
    capacidad_carga: '',
    origenCoords: null,
    destinoCoords: null,
  });
  const [regData, setRegData] = useState({
    cedula: '',
    telefono: '',
    genero: 'masculino',
    departamento: 'Cundinamarca',
    ciudad: 'Bogotá',
    rol: 'usuario',
    nombre_comercial: '',
    categoria_aliado: 'Restaurante',
    whatsapp_aliado: '',
    direccion_fisica: ''
  });
  const [driverRegData, setDriverRegData] = useState({
    genero: 'masculino',
    departamento: 'Cundinamarca',
    ciudad: 'Bogotá',
    vehiculo: {
      tipo: 'carro',
      placa: '',
      modelo: '',
      color: '',
      capacidad: '',
      volumen: '',
      dimensiones: '',
      empresaTaxi: '',
      numeroTaxi: ''
    }
  });

  // Admin Action States
  const [showAdminActionModal, setShowAdminActionModal] = useState(false);
  const [adminActionType, setAdminActionType] = useState<'edit_saldo_usuario' | 'edit_saldo_conductor' | 'confirm_bloqueo_usuario' | 'confirm_bloqueo_conductor' | 'toggle_suplente' | null>(null);
  const [adminActionTarget, setAdminActionTarget] = useState<any>(null);
  const [adminActionValue, setAdminActionValue] = useState<string>('');
  const [bloqueoTipo, setBloqueoTipo] = useState<'permanente' | 'temporal'>('temporal');
  const [bloqueoHoras, setBloqueoHoras] = useState<number>(2);
  const [calificacionesBajas, setCalificacionesBajas] = useState<any[]>([]);

  // States for Monitor Trip Cancellation Modal
  const [showAdminCancelTripModal, setShowAdminCancelTripModal] = useState(false);
  const [selectedTripForAdminCancel, setSelectedTripForAdminCancel] = useState<any>(null);
  const [adminCancelReason, setAdminCancelReason] = useState<string>('Tiempo de espera prolongado');
  const [adminCancelCustomReason, setAdminCancelCustomReason] = useState<string>('');
  const [adminCancelNotifyUser, setAdminCancelNotifyUser] = useState<boolean>(true);
  const [adminCancelArchiveTrip, setAdminCancelArchiveTrip] = useState<boolean>(true);
  const [isProcessingAdminCancel, setIsProcessingAdminCancel] = useState<boolean>(false);

  // States for manual location input in registers & profile
  const [regManualUbicacion, setRegManualUbicacion] = useState(false);
  const [driverRegManualUbicacion, setDriverRegManualUbicacion] = useState(false);
  const [profileManualUbicacion, setProfileManualUbicacion] = useState(false);

  // --- Auto-Unblock Check for Current Driver ---
  useEffect(() => {
    if (!user || !conductor || !conductor.bloqueado || !conductor.bloqueado_hasta) return;

    const targetTime = new Date(conductor.bloqueado_hasta).getTime();
    
    const checkTimer = setInterval(async () => {
      const now = Date.now();
      if (now >= targetTime) {
        clearInterval(checkTimer);
        try {
          await toggleBloqueoConductor(user.uid, false);
          toast.success("¡Tu período de sanción ha finalizado! Cuenta desbloqueada automáticamente.", {
            duration: 6000,
            icon: '🔓'
          });
        } catch (error) {
          console.error("Error auto-unblocking driver:", error);
        }
      }
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [user, conductor]);

  useEffect(() => {
    console.log("App useEffect mounted");
    syncClock();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
    let unsubPerfil: (() => void) | null = null;
    let unsubViajes: (() => void) | null = null;
    let unsubUserViajes: (() => void) | null = null;
    let unsubHistorial: (() => void) | null = null;
    let unsubHistorialConductor: (() => void) | null = null;
    let unsubViajesConductorActivos: (() => void) | null = null;
    let unsubRecargas: (() => void) | null = null;
    let unsubConductor: (() => void) | null = null;
    let unsubMisRecargas: (() => void) | null = null;
    let unsubCalificacionesBajas: (() => void) | null = null;
    let unsubMensajesAdmin: (() => void) | null = null;
    let unsubAllMessages: (() => void) | null = null;
    let cleanupStats: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser?.uid || "Logged out");
      setUser(currentUser);
      
      // Limpiar listeners previos si existen
      const cleanupListeners = () => {
        if (unsubPerfil) { unsubPerfil(); unsubPerfil = null; }
        if (unsubViajes) { unsubViajes(); unsubViajes = null; }
        if (unsubUserViajes) { unsubUserViajes(); unsubUserViajes = null; }
        if (unsubHistorial) { unsubHistorial(); unsubHistorial = null; }
        if (unsubHistorialConductor) { unsubHistorialConductor(); unsubHistorialConductor = null; }
        if (unsubViajesConductorActivos) { unsubViajesConductorActivos(); unsubViajesConductorActivos = null; }
        if (unsubRecargas) { unsubRecargas(); unsubRecargas = null; }
        if (unsubConductor) { unsubConductor(); unsubConductor = null; }
        if (unsubMisRecargas) { unsubMisRecargas(); unsubMisRecargas = null; }
        if (unsubCalificacionesBajas) { unsubCalificacionesBajas(); unsubCalificacionesBajas = null; }
        if (unsubMensajesAdmin) { unsubMensajesAdmin(); unsubMensajesAdmin = null; }
        if (unsubAllMessages) { unsubAllMessages(); unsubAllMessages = null; }
        if (cleanupStats) { cleanupStats(); cleanupStats = null; }
      };
      
      cleanupListeners();

      if (currentUser) {
        console.log("Setting up listeners for user:", currentUser.uid);

        // Cargar estadísticas globales
        cleanupStats = onSnapshot(doc(db, 'config', 'stats'), (docSnap) => {
          if (docSnap.exists()) {
            setGlobalStats(docSnap.data());
          }
        }, (error) => {
          console.error("Error in stats snapshot:", error);
          // Silenciosamente fallar si no hay permisos o no existe, para no romper la app
        });
        
        // Escuchar mensajes del administrador para el usuario actual
        const qMensajes = query(
          collection(db, 'mensajes_admin'),
          where('targetId', '==', currentUser.uid),
          where('leido', '==', false),
          limit(10)
        );
        unsubMensajesAdmin = onSnapshot(qMensajes, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const msg = { id: change.doc.id, ...change.doc.data() as any };
              const fechaMsg = new Date(msg.fecha).getTime();
              const ahora = Date.now();
              
              // Solo notificar si es reciente
              if (ahora - fechaMsg < 60000) {
                toast('Mensaje del Administrador', {
                  description: msg.mensaje,
                  duration: 8000,
                  icon: <ShieldCheck className="text-emerald-500" />,
                  action: {
                    label: 'Ver Chat',
                    onClick: () => {
                      setAdminMessageTarget({ id: currentUser.uid, nombre: 'Admin', type: 'usuario' });
                      setShowAdminMessageModal(true);
                      marcarMensajesChatLeidos(currentUser.uid, currentUser.uid);
                    }
                  }
                });
              }
            }
          });
        }, (error) => handleFirestoreError(error, OperationType.GET, 'mensajes_admin'));
        const qMisRecargas = query(
          collection(db, 'recargas'),
          where('conductorId', '==', currentUser.uid),
          where('estado', '==', 'aprobada'),
          orderBy('fecha', 'desc'),
          limit(5)
        );
        unsubMisRecargas = onSnapshot(qMisRecargas, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const recarga = change.doc.data();
              if (recarga.estado === 'aprobada') {
                // Solo notificar si es reciente (evitar notificaciones de historial al cargar)
                const fechaRecarga = new Date(recarga.fecha).getTime();
                const ahora = Date.now();
                if (ahora - fechaRecarga < 60000) { // Menos de 1 minuto
                  toast.success('¡Recarga Aprobada!', {
                    description: `Tu saldo ha sido incrementado en $${recarga.valor.toLocaleString()} COP`,
                  });
                }
              }
            }
          });
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'recargas_aprobadas_notif'));

        // Cargar perfil de usuario en tiempo real
        unsubPerfil = onSnapshot(doc(db, 'usuarios', currentUser.uid), (docSnap) => {
          console.log("User profile snapshot received. Exists:", docSnap.exists());
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPerfil(data);

            // Si es admin, escuchar recargas pendientes y el historial
            const isAdmin = data.rol === 'admin' || data.rol === 'admin_suplente' || currentUser?.email === 'darwin.barbosa000@gmail.com' || currentUser?.email === 'ruedasrapidasviajaseguro@gmail.com';
            
            if (isAdmin) {
              // Inicializar estadísticas si no existen
              getDoc(doc(db, 'config', 'stats')).then(s => {
                if (!s.exists()) {
                  setDoc(doc(db, 'config', 'stats'), { total_servicios_completados: 0 });
                }
              }).catch(err => console.error("Error checking/init stats:", err));
            }

            if (isAdmin && !unsubRecargas) {
              console.log("User is admin, setting up recharges listener");
              const qRecargas = query(
                collection(db, 'recargas'),
                where('estado', '==', 'pendiente')
              );
              unsubRecargas = onSnapshot(qRecargas, (snapshot) => {
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setRecargasPendientes(docs);
                
                // Notificar al admin sobre nuevas recargas inmediatamente
                snapshot.docChanges().forEach((change) => {
                  if (change.type === 'added') {
                    const recarga = change.doc.data();
                    // Solo notificar si es reciente (evitar notificaciones de carga inicial)
                    const fechaRecarga = new Date(recarga.fecha).getTime();
                    const ahora = Date.now();
                    if (ahora - fechaRecarga < 30000) { // Menos de 30 segundos
                      toast.info(`Nueva solicitud de recarga`, {
                        description: `${recarga.conductorNombre} ha solicitado $${recarga.valor.toLocaleString()} COP`,
                        action: {
                          label: 'Ver',
                          onClick: () => {
                            setActiveTab('admin');
                            setAdminSubTab('recargas');
                          }
                        }
                      });
                    }
                  }
                });
              }, (error) => {
                console.error("Error in recharges snapshot:", error);
              });

              // Listener para el historial completo
              const qHistorial = query(
                collection(db, 'recargas'),
                orderBy('fecha', 'desc'),
                limit(50)
              );
              const unsubHistorial = onSnapshot(qHistorial, (snapshot) => {
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setHistorialRecargas(docs);
              }, (error) => {
                console.error("Error in recharge history snapshot:", error);
              });
              
              // No olvidemos limpiar el historial también
              const originalUnsubRecargas = unsubRecargas || (() => {});
              unsubRecargas = () => {
                originalUnsubRecargas();
                unsubHistorial();
              };
            } else if (!isAdmin && unsubRecargas) {
              unsubRecargas();
              unsubRecargas = null;
              setRecargasPendientes([]);
            }

            // Gestionar unsubAllMessages para administradores de forma segura en tiempo real
            if (isAdmin && !unsubAllMessages) {
              console.log("Setting up unsubAllMessages for admin");
              const qAll = query(
                collection(db, 'mensajes_admin'),
                orderBy('fecha', 'desc'),
                limit(100)
              );
              unsubAllMessages = onSnapshot(qAll, (snapshot) => {
                const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllAdminMessages(msgs);
              }, (error) => handleFirestoreError(error, OperationType.LIST, 'mensajes_admin_all'));
            } else if (!isAdmin && unsubAllMessages) {
              unsubAllMessages();
              unsubAllMessages = null;
              setAllAdminMessages([]);
            }

            // Gestionar unsubCalificacionesBajas para administradores en tiempo real
            if (isAdmin && !unsubCalificacionesBajas) {
              console.log("Setting up unsubCalificacionesBajas for admin");
              const qCalificacionesBajas = query(
                collection(db, 'calificaciones'),
                where('estrellas', '<', 3),
                orderBy('estrellas', 'asc'),
                orderBy('fecha', 'desc'),
                limit(20)
              );
              unsubCalificacionesBajas = onSnapshot(qCalificacionesBajas, (snapshot) => {
                const califs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCalificacionesBajas(califs);
              }, (error) => handleFirestoreError(error, OperationType.GET, 'calificaciones'));
            } else if (!isAdmin && unsubCalificacionesBajas) {
              unsubCalificacionesBajas();
              unsubCalificacionesBajas = null;
              setCalificacionesBajas([]);
            }
          } else {
            console.log("User profile does not exist, showing registration modal");
            setShowRegModal(true);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error in user profile snapshot:", error);
          handleFirestoreError(error, OperationType.GET, `usuarios/${currentUser.uid}`);
          setLoading(false);
        });

        // Escuchar perfil de conductor si existe
        const setupConductorListener = () => {
          unsubConductor = onSnapshot(doc(db, 'conductores', currentUser.uid), (snapshot) => {
            if (snapshot.exists()) {
              console.log("Conductor profile updated:", snapshot.data());
              setConductor(snapshot.data());
            } else {
              console.log("No conductor profile found");
              setConductor(null);
            }
          }, (error) => {
            console.error("Error in conductor snapshot:", error);
            handleFirestoreError(error, OperationType.GET, `conductores/${currentUser.uid}`);
          });
        };
        setupConductorListener();

        // Escuchar viajes activos
        console.log("Setting up trips listener");
        const q = query(
          collection(db, 'viajes'),
          where('estado', 'in', ['solicitado', 'negociando'])
        );
        unsubViajes = onSnapshot(q, (snapshot) => {
          console.log("Trips snapshot received. Count:", snapshot.size);
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setViajesActivos(docs);
        }, (error) => {
          console.error("Error in trips snapshot:", error);
          handleFirestoreError(error, OperationType.LIST, 'viajes');
        });

        // Escuchar mis propios viajes como usuario
        const qUser = query(
          collection(db, 'viajes'),
          where('usuarioId', '==', currentUser.uid),
          where('estado', 'in', ['solicitado', 'negociando', 'aceptado', 'en_camino', 'llegando', 'en_transito', 'cancelado'])
        );
        unsubUserViajes = onSnapshot(qUser, (snapshot) => {
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setMisViajes(docs);
        }, (error) => {
          console.error("Error in user trips snapshot:", error);
          handleFirestoreError(error, OperationType.LIST, 'viajes');
        });

        // Escuchar historial de viajes finalizados
        const qHistorial = query(
          collection(db, 'viajes'),
          where('usuarioId', '==', currentUser.uid),
          where('estado', '==', 'finalizado')
        );
        unsubHistorial = onSnapshot(qHistorial, (snapshot) => {
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setHistorialViajes(docs);
        }, (error) => {
          console.error("Error in history snapshot:", error);
          handleFirestoreError(error, OperationType.LIST, 'viajes');
        });

        // Escuchar historial de viajes finalizados como conductor
        const qHistorialConductor = query(
          collection(db, 'viajes'),
          where('conductorId', '==', currentUser.uid),
          where('estado', '==', 'finalizado')
        );
        unsubHistorialConductor = onSnapshot(qHistorialConductor, (snapshot) => {
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setHistorialViajesConductor(docs);
        }, (error) => {
          console.error("Error in driver history snapshot:", error);
          handleFirestoreError(error, OperationType.LIST, 'viajes');
        });

        // Escuchar mis viajes activos como conductor
        const qConductorActivos = query(
          collection(db, 'viajes'),
          where('conductorId', '==', currentUser.uid),
          where('estado', 'in', ['aceptado', 'en_camino', 'llegando', 'en_transito', 'cancelado'])
        );
        unsubViajesConductorActivos = onSnapshot(qConductorActivos, (snapshot) => {
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setMisViajesConductor(docs);
        }, (error) => {
          console.error("Error in driver active trips snapshot:", error);
          handleFirestoreError(error, OperationType.LIST, 'viajes');
        });

        // Escuchar transacciones y recargas para el conductor
        const qMovimientosTransacciones = query(
          collection(db, 'transacciones'),
          where('userId', '==', currentUser.uid),
          orderBy('fecha', 'desc'),
          limit(30)
        );
        const unsubMovTrans = onSnapshot(qMovimientosTransacciones, (snapshot) => {
          const trans = snapshot.docs.map(d => ({ id: d.id, ...d.data(), tipoDoc: 'transaccion' }));
          setMisMovimientos(prev => {
            const others = prev.filter(m => m.tipoDoc !== 'transaccion');
            const combined = [...trans, ...others].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            return combined;
          });
        });

        const qMovimientosRecargas = query(
          collection(db, 'recargas'),
          where('conductorId', '==', currentUser.uid),
          orderBy('fecha', 'desc'),
          limit(30)
        );
        const unsubMovRec = onSnapshot(qMovimientosRecargas, (snapshot) => {
          const recargas = snapshot.docs.map(d => ({ id: d.id, ...d.data(), tipoDoc: 'recarga' }));
          setMisMovimientos(prev => {
            const others = prev.filter(m => m.tipoDoc !== 'recarga');
            const combined = [...recargas, ...others].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            return combined;
          });
        });

        const originalUnsubConductor = unsubConductor || (() => {});
        unsubConductor = () => {
          originalUnsubConductor();
          unsubMovTrans();
          unsubMovRec();
        };
      } else {
        console.log("No user logged in, clearing state");
        setPerfil(null);
        setConductor(null);
        setViajesActivos([]);
        setLoading(false);
      }
    });

    return () => {
      console.log("App useEffect unmounting");
      unsubscribe();
      if (unsubPerfil) unsubPerfil();
      if (unsubConductor) unsubConductor();
      if (unsubViajes) unsubViajes();
      if (unsubUserViajes) unsubUserViajes();
      if (unsubHistorial) unsubHistorial();
      if (unsubHistorialConductor) unsubHistorialConductor();
      if (unsubViajesConductorActivos) unsubViajesConductorActivos();
      if (unsubRecargas) unsubRecargas();
      if (unsubMisRecargas) unsubMisRecargas();
      if (unsubCalificacionesBajas) unsubCalificacionesBajas();
      if (unsubAllMessages) unsubAllMessages();
    };
  }, []);

  // Listen to messages of active trips for both passenger and driver and show notifications
  const activeServices = useMemo(() => {
    if (!user) return [];
    const pTrips = misViajes.filter(v => ['aceptado', 'en_camino', 'llegando', 'en_transito'].includes(v.estado));
    const dTrips = misViajesConductor.filter(v => ['aceptado', 'en_camino', 'llegando', 'en_transito'].includes(v.estado));
    const combined = [...pTrips, ...dTrips];
    // De-duplicate by ID
    const unique = combined.filter((trip, index, self) => self.findIndex(t => t.id === trip.id) === index);
    return unique;
  }, [misViajes, misViajesConductor, user]);

  const chatListenersRef = useRef<{ [viajeId: string]: () => void }>({});

  useEffect(() => {
    if (showChat && activeChatViaje?.id) {
      setUnreadMessages(prev => ({ ...prev, [activeChatViaje.id]: 0 }));
    }
  }, [showChat, activeChatViaje?.id]);

  useEffect(() => {
    if (!user) {
      // Clean up all listeners on logout
      Object.values(chatListenersRef.current).forEach(unsub => unsub());
      chatListenersRef.current = {};
      return;
    }

    const currentActiveIds = activeServices.map(v => v.id);

    // Clean up listeners for trips that are no longer active
    Object.keys(chatListenersRef.current).forEach(id => {
      if (!currentActiveIds.includes(id)) {
        if (typeof chatListenersRef.current[id] === 'function') {
          chatListenersRef.current[id]();
        }
        delete chatListenersRef.current[id];
        
        // Clean up state
        setUnreadMessages(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setLastSeenMsgCount(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    // Set up listeners for new active trips
    currentActiveIds.forEach(viajeId => {
      if (!chatListenersRef.current[viajeId]) {
        console.log(`Setting up message listener for active trip ${viajeId}`);
        
        const unsubscribe = escucharMensajes(viajeId, (msgs) => {
          if (msgs.length === 0) return;

          // Get last message
          const lastMsg = msgs[msgs.length - 1];

          // If the last message was sent by someone else
          if (lastMsg.senderId !== user.uid) {
            const isChatOpenForThisTrip = showChat && activeChatViaje?.id === viajeId;

            if (!isChatOpenForThisTrip) {
              setUnreadMessages(prev => {
                const currentUnread = prev[viajeId] || 0;
                // Only increment if we actually have new messages compared to our last seen count
                const lastCount = lastSeenMsgCount[viajeId] || 0;
                if (msgs.length > lastCount) {
                  const diff = msgs.length - lastCount;
                  return { ...prev, [viajeId]: currentUnread + diff };
                }
                return prev;
              });

              setLastSeenMsgCount(prev => {
                const lastCount = prev[viajeId];
                
                if (lastCount !== undefined && msgs.length > lastCount) {
                  // Play beautiful message sound
                  soundService.playNuevoMensaje();

                  // Find trip details for the notification
                  const tripObj = activeServices.find(t => t.id === viajeId);
                  const senderName = lastMsg.senderName || "Usuario";
                  const displayRole = user.uid === tripObj?.usuarioId ? "Conductor" : "Pasajero";

                  toast.info(
                    <div className="flex flex-col gap-1.5 p-1 w-full text-left" style={{ direction: 'ltr' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                          {senderName} ({displayRole})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 italic font-medium leading-normal">
                        "{lastMsg.text}"
                      </p>
                      <button
                        onClick={() => {
                          if (tripObj) {
                            setActiveChatViaje(tripObj);
                            setShowChat(true);
                          }
                          toast.dismiss(`msg-${viajeId}`);
                        }}
                        className="mt-1 self-start px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-[9px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
                      >
                        Ver Mensaje
                      </button>
                    </div>,
                    {
                      duration: 8000,
                      id: `msg-${viajeId}`,
                    }
                  );
                }
                
                return { ...prev, [viajeId]: msgs.length };
              });
            } else {
              setUnreadMessages(prev => ({ ...prev, [viajeId]: 0 }));
              setLastSeenMsgCount(prev => ({ ...prev, [viajeId]: msgs.length }));
            }
          } else {
            setLastSeenMsgCount(prev => ({ ...prev, [viajeId]: msgs.length }));
          }
        });

        chatListenersRef.current[viajeId] = unsubscribe;
      }
    });
  }, [activeServices, user, showChat, activeChatViaje?.id]);

  // Fetch data for admin or leaderboard
  useEffect(() => {
    if (!user) return;

    // Escuchar conductores (Necesario para el Leaderboard y para el Admin)
    const qDrivers = query(
      collection(db, 'conductores'),
      limit(500)
    );

    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setAllDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error in drivers ranking snapshot:", error);
      // No tratamos esto como un error fatal si el usuario no es admin, ya que solo es para el leaderboard
    });

    // Escuchar marcas aliadas para todos los usuarios autenticados (Discovery)
    const unsubMarcas = onSnapshot(collection(db, 'marcas_aliadas'), (snapshot) => {
      setMarcasAliadas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading allied brands:", error);
    });

    // Solo para administradores: usuarios, todos los viajes, etc.
    let unsubUsers = () => {};
    let unsubTrips = () => {};
    let unsubCancelledTrips = () => {};

    if (isUserAdmin) {
      unsubUsers = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'usuarios'));

      unsubTrips = onSnapshot(query(collection(db, 'viajes'), orderBy('fecha', 'desc'), limit(500)), (snapshot) => {
        setAllTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'viajes'));

      unsubCancelledTrips = onSnapshot(query(collection(db, 'viajes'), where('estado', 'in', ['cancelado', 'finalizado_cancelado']), limit(500)), (snapshot) => {
        setAllCancelledTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'viajes_cancelados'));
    }

    return () => {
      unsubDrivers();
      unsubMarcas();
      unsubUsers();
      unsubTrips();
      unsubCancelledTrips();
    };
  }, [perfil, user]);

  // Notificaciones para conductores
  useEffect(() => {
    if (conductor && conductor.activo && conductor.aprobado !== false) {
      // Bloquear notificaciones si el saldo es menor a 2000 COP
      const saldoActual = conductor.tarjeta_virtual || 0;
      if (saldoActual < 2000) return;

      const newNotified = new Set(notifiedTrips);
      let changed = false;
      
      viajesActivos.forEach(viaje => {
        if (!newNotified.has(viaje.id)) {
          // Filtrar por ciudad (normalizado)
          if (normalizeStrForCity(viaje.ciudad) === normalizeStrForCity(conductor.ciudad)) {
            let shouldNotify = false;
            let title = '¡Nuevo Servicio!';

            const isCargoType = viaje.tipo === 'camion_flete' || viaje.tipo === 'camion_acarreo' || viaje.tipo === 'motocarro';
            const isPassengerType = viaje.tipo === 'carro' || viaje.tipo === 'moto';

            if (isCargoType) {
              shouldNotify = conductor.vehiculo?.tipo === viaje.tipo;
              title = viaje.tipo === 'motocarro' ? '¡Nuevo Moto Carro!' : '¡Nuevo Flete/Acarreo!';
            } else if (viaje.tipo === 'domicilio') {
              shouldNotify = !!conductor.modo_repartidor;
              title = viaje.esEntregaAliado ? '¡Nuevo Domicilio de Aliado!' : '¡Nuevo Domicilio!';
            } else if (isPassengerType) {
              if (conductor.vehiculo?.tipo === viaje.tipo) {
                const isConductorFemenino = conductor.genero?.toLowerCase() === 'femenino' || conductor.genero?.toLowerCase()?.includes('femenino');
                if (!viaje.modoRosa || isConductorFemenino) {
                  shouldNotify = true;
                  title = viaje.tipo === 'moto' ? '¡Nueva Moto!' : '¡Nuevo Viaje!';
                }
              }
            }

            if (shouldNotify) {
              const valorStr = viaje.valor > 0 ? `$${viaje.valor.toLocaleString()}` : "A convenir / Por cotizar";
              const cargaStr = viaje.capacidad_carga ? ` \nCARGA: ${viaje.capacidad_carga}` : "";
              
              const isAliado = viaje.esEntregaAliado;
              const nombreMarca = viaje.marcaAliadaNombre || 'Comercio Aliado';
              
              const customTitle = isAliado 
                ? `🛍️ ¡Domicilio Especial: ${nombreMarca}! 🚀` 
                : title;

              const customBody = isAliado
                ? `🏢 NEGOCIO: ${nombreMarca}\n📍 RECOGIDA: ${viaje.ruta.origen}\n📌 DESTINO: ${viaje.ruta.destino}\n💵 VALOR: ${valorStr}${cargaStr}`
                : `RECOGIDA: ${viaje.ruta.origen} \nDESTINO: ${viaje.ruta.destino} \nVALOR: ${valorStr}${cargaStr}`;

              triggersIncomingNotification(
                customTitle,
                customBody,
                'Ver',
                () => {
                  setActiveTab('conductor');
                  setDriverSubTab('viajes');
                }
              );
              setLatestTripAlert(viaje);
              newNotified.add(viaje.id);
              changed = true;
            }
          }
        }
      });
      
      if (changed) {
        setNotifiedTrips(newNotified);
      }
    }
  }, [viajesActivos, conductor, notifiedTrips]);

  // Monitoreo de cambios de estado de viajes en curso (para sonidos y alertas dinámicas)
  useEffect(() => {
    if (!user) return;
    
    const currentStates: {[id: string]: string} = {};
    const prevStates = prevTripsStateRef.current;
    const isFirstLoad = Object.keys(prevStates).length === 0;
    
    // Combinar mis viajes (usuario y conductor)
    const allMyTrips = [
      ...misViajes.map(v => ({ ...v, rol: 'usuario' })),
      ...misViajesConductor.map(v => ({ ...v, rol: 'conductor' }))
    ];
    
    allMyTrips.forEach(v => {
      currentStates[v.id] = v.estado;
      
      const prevState = prevStates[v.id];
      // Si no es el primer render y el estado cambió, reproducimos y notificamos
      if (!isFirstLoad && prevState !== undefined && prevState !== v.estado) {
        console.log(`[Sonido/IxD] Viaje ID ${v.id} cambió de ${prevState} -> ${v.estado}`);
        
        // 1. Cancelado o Cancelación
        if (v.estado === 'cancelado' || v.estado === 'finalizado_cancelado') {
          soundService.playViajeCancelado();
          toast.error(`Servicio Cancelado`, {
            description: `El trayecto hacia ${v.ruta?.destino || 'destino'} ha sido cancelado.`,
            duration: 8000
          });
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Servicio Cancelado', {
                body: `El trayecto hacia ${v.ruta?.destino || 'destino'} ha sido cancelado.`,
                tag: 'cancelado-' + v.id
              });
            } catch (e) {}
          }
        }
        // 2. Finalizado
        else if (v.estado === 'finalizado') {
          soundService.playViajeFinalizado();
          toast.success(`¡Servicio Finalizado!`, {
            description: `Tu viaje con Ruedas Rápidas concluyó exitosamente.`,
            duration: 8000
          });
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('¡Servicio Finalizado!', {
                body: `Tu viaje con Ruedas Rápidas concluyó exitosamente.`,
                tag: 'finalizado-' + v.id
              });
            } catch (e) {}
          }
        }
        // 3. Transiciones operativas (aceptado, en_camino, llegando, en_transito)
        else if (['aceptado', 'en_camino', 'llegando', 'en_transito'].includes(v.estado)) {
          soundService.playNuevoMensaje();
          
          let alertMsg = '';
          if (v.estado === 'aceptado') alertMsg = 'El conductor ha tomado tu solicitud.';
          else if (v.estado === 'en_camino') alertMsg = 'Tu conductor ya está en ruta.';
          else if (v.estado === 'llegando') alertMsg = '¡El conductor ha llegado a tu punto de partida!';
          else if (v.estado === 'en_transito') alertMsg = 'Viaje en tránsito hacia tu destino.';
          
          toast.info(`Actualización del Viaje`, {
            description: alertMsg,
            duration: 8000
          });
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Actualización del Viaje', {
                body: alertMsg,
                tag: 'upd-' + v.id
              });
            } catch (e) {}
          }
        }
      }
    });
    
    // Actualizar estados actuales para la próxima llamada
    prevTripsStateRef.current = currentStates;
  }, [misViajes, misViajesConductor, user]);

  // Notificaciones para administrador (Recargas)
  useEffect(() => {
    if (isUserAdmin && recargasPendientes.length > 0) {
      const newNotified = new Set(notifiedRecharges);
      let changed = false;

      recargasPendientes.forEach(recarga => {
        if (!newNotified.has(recarga.id)) {
          toast.info('Nueva Solicitud de Recarga', {
            description: `${recarga.conductorNombre} solicita $${recarga.valor.toLocaleString()} COP`,
            action: {
              label: 'Ver',
              onClick: () => {
                setActiveTab('admin');
                setAdminSubTab('recargas');
              }
            }
          });
          newNotified.add(recarga.id);
          changed = true;
        }
      });

      if (changed) {
        setNotifiedRecharges(newNotified);
      }
    }
  }, [recargasPendientes, perfil, user, notifiedRecharges]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        toast.info("Inicio de sesión cancelado.");
      } else if (error.code === 'auth/popup-blocked') {
        toast.error("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
      } else if (error.code === 'auth/internal-error' || (error.message && error.message.includes('internal-error'))) {
        toast.error(
          "No fue posible autenticar con Google en este entorno. Puedes ingresar rápidamente con tu número celular o abrir la app en una nueva pestaña.",
          { duration: 8000 }
        );
      } else {
        console.error("Error al iniciar sesión", error);
        toast.error(
          "Error al iniciar sesión. Si estás en la vista previa de AI Studio, haz clic en el botón 'Abrir en pestaña nueva' arriba a la derecha. Los navegadores bloquean las cookies de autenticación de terceros dentro de iframes.",
          { duration: 8000 }
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPerfil(null);
    setConductor(null);
    signOut(auth);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailProcessing) return;
    setIsEmailProcessing(true);
    try {
      await signInWithEmailAndPassword(auth, emailForm.email, emailForm.password);
      toast.success("¡Inicio de sesión exitoso!");
      setShowEmailLogin(false);
    } catch (error: any) {
      console.error("Error signing in with email/password", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error("Correo o contraseña incorrectos.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('operation-not-allowed');
        toast.error(
          "El proveedor de Correo/Contraseña no está habilitado en tu consola de Firebase. Actívalo en: Firebase Console > Authentication > Sign-in method.",
          { duration: 10000 }
        );
      } else if (error.code === 'auth/internal-error' || (error.message && error.message.includes('internal-error'))) {
        toast.error("Error interno de autenticación. Te sugerimos ingresar usando tu número celular.", { duration: 8000 });
      } else {
        toast.error(`Error: ${error.message || error}`);
      }
    } finally {
      setIsEmailProcessing(false);
    }
  };

  // --- Manejadores para Registro con Teléfono (SMS + Firebase Auth) ---
  const handleRequestPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = phoneInput.trim();
    if (!cleanNum) {
      toast.error("Por favor ingresa un número de teléfono celular.");
      return;
    }

    // 1. Validación estricta Colombia +57 (Rechaza otros prefijos internacionales)
    const val = validateAndFormatColombianPhone(cleanNum);
    if (!val.valid) {
      toast.error(val.error || "Número de celular no válido.");
      return;
    }

    setIsPhoneProcessing(true);
    try {
      // 2. Si es modo de creación de cuenta nueva, verificar que no exista ya en Firestore
      if (phoneAuthSubMode === 'register') {
        const isAlreadyReg = await checkIfPhoneAlreadyRegistered(val.formattedPhone);
        if (isAlreadyReg) {
          toast.error("Este número ya está registrado. Por favor selecciona 'Iniciar Sesión' o utiliza otro número de celular.");
          setIsPhoneProcessing(false);
          return;
        }
      }

      // 3. Solicitar OTP (aplica Rate Limit en Firestore 'otp_attempts': máx 3 intentos en 5 min, bloqueo 15 min)
      await requestOTP(val.formattedPhone, 'recaptcha-container', { isRegistration: phoneAuthSubMode === 'register' });
      toast.success("Código de verificación enviado por SMS.");
      setPhoneStep(2);
    } catch (error: any) {
      console.error("Error al solicitar OTP por SMS:", error);
      const isBlocked = error.message && (
        error.message.includes('bloqueado') || 
        error.message.includes('demasiados intentos') || 
        error.message.includes('espera') ||
        error.message.includes('minuto')
      );

      if (isBlocked) {
        toast.error(error.message, {
          action: {
            label: "Desbloquear (Pruebas)",
            onClick: async () => {
              await resetOtpRateLimit(val.formattedPhone);
              toast.success("Límite de intentos restablecido. Vuelve a hacer clic en Enviar.");
            }
          },
          duration: 12000
        });
      } else {
        toast.error(error.message || "Error al enviar código SMS. Intenta nuevamente.");
      }
    } finally {
      setIsPhoneProcessing(false);
    }
  };

  const handleVerifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCodeInput.trim();
    if (!cleanCode || cleanCode.length < 6) {
      toast.error("Por favor ingresa los 6 dígitos del código SMS.");
      return;
    }

    const val = validateAndFormatColombianPhone(phoneInput.trim());
    const validPhone = val.valid ? val.formattedPhone : phoneInput.trim();

    setIsPhoneProcessing(true);
    try {
      // Verifica OTP, crea en Firestore 'users/{uid}' { phone, createdAt, status: 'pending' } y valida límite de 2 dispositivos
      const verifiedUser = await verifyOTP(cleanCode, null, validPhone);
      
      // Asegurar perfil en 'usuarios' para sincronización
      const userPerfilSnap = await getDoc(doc(db, 'usuarios', verifiedUser.uid));
      if (!userPerfilSnap.exists()) {
        await crearPerfilUsuario(verifiedUser.uid, {
          nombre: 'Usuario ' + validPhone.slice(-4),
          celular: validPhone,
          telefono: validPhone,
          saldo: 0,
          saldo_promo: 0,
          rol: 'usuario',
          genero: 'femenino',
          terminos_aceptados: true,
          fecha_aceptacion_terminos: new Date().toISOString(),
          status: 'pending'
        });
      }

      setUser(verifiedUser);
      toast.success("¡Teléfono verificado exitosamente!");
      setPhoneStep(1);
      setOtpCodeInput('');
      setPhoneInput('');
      setShowEmailLogin(false);
    } catch (error: any) {
      console.error("Error al verificar código OTP:", error);
      toast.error(error.message || "Código incorrecto o expirado.");
    } finally {
      setIsPhoneProcessing(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailProcessing) return;

    const phoneToValidate = emailForm.selectedRole === 'marca_aliada' ? emailForm.whatsapp_aliado : emailForm.telefono;
    
    // Validación estricta Colombia +57
    const val = validateAndFormatColombianPhone(phoneToValidate);
    if (!val.valid) {
      toast.error(val.error || "Número celular no válido.");
      return;
    }

    // Verificar si el celular ya está registrado en Firestore
    const isPhoneRegistered = await checkIfPhoneAlreadyRegistered(val.formattedPhone);
    if (isPhoneRegistered) {
      toast.error("Este número ya está registrado. Por favor inicia sesión o utiliza otro número celular.");
      return;
    }

    if (emailForm.selectedRole === 'marca_aliada') {
      if (!emailForm.nombre_comercial.trim() || !emailForm.whatsapp_aliado.trim() || !emailForm.direccion_fisica.trim() || !emailForm.ciudad_cobertura.trim()) {
        toast.error("Por favor diligencie todos los datos comerciales de su Marca Aliada.");
        return;
      }
    } else {
      if (!emailForm.nombre.trim()) {
        toast.error("Debe ingresar un nombre completo.");
        return;
      }
      if (!emailForm.telefono.trim()) {
        toast.error("Debe ingresar un número de celular.");
        return;
      }
    }

    setIsEmailProcessing(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailForm.email, emailForm.password);
      const newUser = userCredential.user;
      
      // Aplicar límite de 2 dispositivos por cuenta
      await enforceDeviceLimit(newUser.uid, val.formattedPhone);

      // Crear documento en Firestore 'users/{uid}' con phone, createdAt, status: 'pending'
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        phone: val.formattedPhone,
        email: emailForm.email,
        createdAt: new Date().toISOString(),
        status: 'pending'
      }, { merge: true });

      if (emailForm.selectedRole === 'marca_aliada') {
        await crearPerfilUsuario(newUser.uid, {
          nombre: emailForm.nombre_comercial.trim(),
          email: emailForm.email,
          celular: val.formattedPhone,
          telefono: val.formattedPhone,
          ciudad: emailForm.ciudad_cobertura.trim(),
          saldo: 0,
          saldo_promo: 0,
          rol: 'marca_aliada',
          nombre_comercial: emailForm.nombre_comercial.trim(),
          categoria_aliado: emailForm.categoria_aliado,
          whatsapp_aliado: val.formattedPhone,
          direccion_fisica: emailForm.direccion_fisica.trim(),
          terminos_aceptados: true,
          fecha_aceptacion_terminos: new Date().toISOString(),
          status: 'pending'
        });

        // Registrar en la colección 'marcas_aliadas' para que aparezcan de inmediato en el modal de marcas aliadas
        await addDoc(collection(db, 'marcas_aliadas'), {
          nombre: emailForm.nombre_comercial.trim(),
          direccion: emailForm.direccion_fisica.trim(),
          ciudad: emailForm.ciudad_cobertura.trim(),
          whatsapp: val.formattedPhone,
          categoria: emailForm.categoria_aliado,
          fechaCreacion: new Date().toISOString(),
          creadorId: newUser.uid
        });

        toast.success("¡Tu Marca Aliada ha sido registrada y agregada al catálogo exitosamente!");
      } else {
        // Crear perfil de usuario inmediatamente con status: pending
        await crearPerfilUsuario(newUser.uid, {
          nombre: emailForm.nombre,
          email: emailForm.email,
          celular: val.formattedPhone,
          telefono: val.formattedPhone,
          ciudad: emailForm.ciudad || 'Fusagasugá',
          departamento: emailForm.departamento || 'Cundinamarca',
          saldo: 0,
          saldo_promo: 0,
          rol: emailForm.selectedRole,
          genero: emailForm.genero || 'femenino',
          terminos_aceptados: true,
          fecha_aceptacion_terminos: new Date().toISOString(),
          status: 'pending'
        });

        if (emailForm.selectedRole === 'conductor' || emailForm.selectedRole === 'ambos') {
          await crearPerfilConductor(newUser.uid, {
            nombre: emailForm.nombre,
            telefono: val.formattedPhone,
            celular: val.formattedPhone,
            email: emailForm.email,
            genero: emailForm.genero || 'femenino',
            ciudad: emailForm.ciudad || 'Fusagasugá',
            departamento: emailForm.departamento || 'Cundinamarca',
            vehiculo: { tipo: 'carro', placa: 'AAA-000', modelo: 'Modelo de prueba' }
          });
        }
        toast.success("¡Usuario registrado con éxito!");
      }

      setShowEmailLogin(false);
    } catch (error: any) {
      console.error("Error registering with email/password", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Este correo ya está registrado.");
      } else if (error.code === 'auth/weak-password') {
        toast.error("La contraseña es muy débil. Debe tener al menos 6 caracteres.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('operation-not-allowed');
        toast.error(
          "El proveedor de Correo/Contraseña no está habilitado en tu consola de Firebase. Actívalo en: Firebase Console > Authentication > Sign-in method.",
          { duration: 10000 }
        );
      } else if (error.code === 'auth/internal-error' || (error.message && error.message.includes('internal-error'))) {
        toast.error("Error interno del servicio de autenticación. Te sugerimos registrarte mediante tu número celular.", { duration: 8000 });
      } else {
        toast.error(`Error de registro: ${error.message || error}`);
      }
    } finally {
      setIsEmailProcessing(false);
    }
  };



  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!termsAccepted) {
      alert("Debe aceptar los términos y condiciones para registrarse.");
      return;
    }

    if (regData.rol === 'marca_aliada') {
      if (!regData.nombre_comercial || !regData.direccion_fisica || !regData.whatsapp_aliado) {
        alert("Por favor diligencie todos los datos comerciales de su Marca Aliada.");
        return;
      }

      await crearPerfilUsuario(user.uid, {
        nombre: regData.nombre_comercial.trim(),
        email: user.email || '',
        cedula: regData.cedula || '',
        telefono: regData.whatsapp_aliado.trim(),
        ciudad: regData.ciudad,
        genero: regData.genero,
        rol: 'marca_aliada',
        nombre_comercial: regData.nombre_comercial.trim(),
        categoria_aliado: regData.categoria_aliado,
        whatsapp_aliado: regData.whatsapp_aliado.trim(),
        direccion_fisica: regData.direccion_fisica.trim(),
        terminos_aceptados: true,
        fecha_aceptacion_terminos: new Date().toISOString()
      });

      // Crear marca en la red de marcas aliadas
      await addDoc(collection(db, 'marcas_aliadas'), {
        nombre: regData.nombre_comercial.trim(),
        direccion: regData.direccion_fisica.trim(),
        ciudad: regData.ciudad.trim(),
        whatsapp: regData.whatsapp_aliado.trim(),
        categoria: regData.categoria_aliado,
        fechaCreacion: new Date().toISOString(),
        creadorId: user.uid
      });

      toast.success("¡Tu Marca Aliada ha sido registrada y agregada al catálogo exitosamente!");
    } else {
      await crearPerfilUsuario(user.uid, {
        nombre: user.displayName || 'Usuario',
        email: user.email || '',
        ...regData,
        terminos_aceptados: true,
        fecha_aceptacion_terminos: new Date().toISOString()
      });

      if (regData.rol === 'conductor' || regData.rol === 'ambos') {
        await crearPerfilConductor(user.uid, {
          nombre: user.displayName || 'Usuario',
          telefono: regData.telefono,
          celular: regData.telefono,
          email: user.email || '',
          genero: regData.genero || 'masculino',
          ciudad: regData.ciudad || 'Fusagasugá',
          departamento: regData.departamento || 'Cundinamarca',
          vehiculo: { tipo: 'carro', placa: 'AAA-000', modelo: 'Modelo de prueba' }
        });
      }

      // Sincronizar documento en 'users/{uid}' con status: pending
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        phone: regData.telefono || user.phoneNumber || '',
        createdAt: new Date().toISOString(),
        status: 'pending'
      }, { merge: true });
    }

    setShowRegModal(false);
    // Recargar perfil
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    if (userDoc.exists()) setPerfil(userDoc.data());
  };

  const handleAceptarTerminosExistente = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'usuarios', user.uid), {
        terminos_aceptados: true,
        fecha_aceptacion_terminos: new Date().toISOString()
      }, { merge: true });
      alert("Términos aceptados con éxito.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `usuarios/${user.uid}`);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const userRef = doc(db, 'usuarios', user.uid);
      const updatedData = {
        nombre: profileFormData.nombre,
        celular: profileFormData.celular,
        telefono: profileFormData.celular, // update both
        ciudad: profileFormData.ciudad,
        departamento: profileFormData.departamento || 'Cundinamarca',
        genero: profileFormData.genero
      };
      await updateDoc(userRef, updatedData);
      
      // Check if conductor profile exists, and update it as well for consistency
      const condRef = doc(db, 'conductores', user.uid);
      const condDoc = await getDoc(condRef);
      if (condDoc.exists()) {
        await updateDoc(condRef, {
          nombre: profileFormData.nombre,
          celular: profileFormData.celular,
          telefono: profileFormData.celular,
          ciudad: profileFormData.ciudad,
          departamento: profileFormData.departamento || 'Cundinamarca',
          genero: profileFormData.genero
        });
      }
      
      toast.success("Perfil actualizado con éxito");
      setShowProfileModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `usuarios/${user.uid}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const getServiceName = (type: string) => {
    switch (type) {
      case 'carro': return 'Carro';
      case 'moto': return 'Moto';
      case 'taxi': return 'Taxi';
      case 'domicilio': return 'Domicilio';
      case 'camion_flete': return 'Flete';
      case 'camion_acarreo': return 'Acarreo';
      case 'motocarro': return 'Moto Carro';
      case 'marcas_aliadas': return 'Marcas Aliadas';
      default: return type;
    }
  };

  const handleSolicitarViaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !perfil || !selectedServiceType) return;
    try {
      const isCargo = selectedServiceType === 'camion_flete' || selectedServiceType === 'camion_acarreo' || selectedServiceType === 'motocarro';
      
      // Detect if user is a brand owner or has role marca_aliada
      const associatedBrand = marcasAliadas.find(m => m.creadorId === user.uid);
      const isBrandUser = perfil.rol === 'marca_aliada' || !!associatedBrand;
      
      const esEntregaAliado = selectedServiceType === 'domicilio' && isBrandUser;
      const marcaAliadaId = esEntregaAliado ? (associatedBrand?.id || '') : '';
      const marcaAliadaNombre = esEntregaAliado ? (associatedBrand?.nombre || perfil.nombre_comercial || perfil.nombre) : '';

      const city = perfil.ciudad || 'Fusagasugá';
      const resolvedOrigenCoords = tripRequestData.origenCoords || geocodeAddressText(tripRequestData.origen, city);
      const resolvedDestinoCoords = tripRequestData.destinoCoords || geocodeAddressText(tripRequestData.destino, city);

      const viajeData: any = {
        usuarioId: user.uid,
        usuarioNombre: esEntregaAliado ? marcaAliadaNombre : (perfil.nombre || user.displayName),
        usuarioTelefono: perfil.celular || perfil.telefono || '',
        usuarioGenero: perfil.genero || 'masculino',
        usuarioEsFrecuente: (perfil.servicios_count || 0) >= 3,
        usuarioSaldoPromo: perfil.saldo_promo || 0,
        usuarioServiciosCount: perfil.servicios_count || 0,
        tipo: selectedServiceType,
        origenCoords: resolvedOrigenCoords,
        destinoCoords: resolvedDestinoCoords,
        ruta: { 
          origen: tripRequestData.origen, 
          destino: tripRequestData.destino,
          origenCoords: resolvedOrigenCoords,
          destinoCoords: resolvedDestinoCoords,
        },
        valor: isCargo ? 0 : tripRequestData.valor,
        capacidad_carga: isCargo ? (tripRequestData.capacidad_carga || '') : '',
        saldo_promo_usuario: isCargo ? 0 : (perfil.saldo_promo || 0), // No aplica saldo promo para fletes de cotización libre
        estado: 'solicitado',
        ciudad: perfil.ciudad || 'Fusagasugá',
        usuarioCiudad: perfil.ciudad || 'Fusagasugá',
        departamento: perfil.departamento || 'Cundinamarca',
        usuarioDepartamento: perfil.departamento || 'Cundinamarca',
        modoRosa: isCargo ? false : modoRosa,
        fecha: getSyncedISOString()
      };

      if (esEntregaAliado) {
        viajeData.esEntregaAliado = true;
        viajeData.marcaAliadaId = marcaAliadaId;
        viajeData.marcaAliadaNombre = marcaAliadaNombre;
      }

      await addDoc(collection(db, 'viajes'), viajeData);
      setShowTripRequestModal(false);
      setTripRequestData({ origen: '', destino: '', valor: 5000, capacidad_carga: '' });
      setModoRosa(false);
      toast.success(esEntregaAliado ? `Despacho solicitado para ${marcaAliadaNombre}.` : 'Solicitud de carga creada exitosamente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'viajes');
    }
  };

  const openTripRequest = (type: 'carro' | 'moto' | 'taxi' | 'domicilio' | 'camion_flete' | 'camion_acarreo' | 'motocarro' | 'marcas_aliadas') => {
    if (perfil?.bloqueado) {
      toast.error("Tu cuenta está bloqueada. No puedes solicitar servicios.");
      return;
    }
    if (perfil && !perfil.terminos_aceptados) {
      setShowTermsModal(true);
      return;
    }
    setSelectedServiceType(type);
    if (type === 'domicilio') {
      setDomicilioTab('envio');
    } else if (type === 'marcas_aliadas') {
      setDomicilioTab('aliados');
    }
    setTripRequestData({ origen: '', destino: '', valor: 5000, capacidad_carga: '' });
    setShowTripRequestModal(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setTripRequestData(prev => ({
            ...prev,
            origenCoords: { lat, lng }
          }));
        },
        (err) => {
          console.warn('No se pudo obtener la ubicación GPS del pasajero:', err);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }
  };

  const handleLogoUpload = (file: File, callback: (imageUrl: string) => void) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido (PNG, JPG, JPEG).');
      return;
    }

    const toastId = toast.loading('Procesando y subiendo imagen a Firebase Storage...');

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result !== 'string') {
        toast.dismiss(toastId);
        return;
      }
      
      const img = new window.Image();
      img.onload = async () => {
        // Redimensionar a un tamaño óptimo para pantallas y almacenamiento (máx 500px)
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        let compressedData = event.target?.result as string;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Comprimir como JPEG con calidad 0.75 (alta calidad visual, bajísimo peso en KB)
          compressedData = canvas.toDataURL('image/jpeg', 0.75);
        }

        try {
          const folder = 'italbusiness_uploads';
          const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 30);
          
          const downloadUrl = await uploadToStorage(compressedData, folder, cleanName);
          
          toast.success('¡Imagen subida exitosamente!', { id: toastId });
          callback(downloadUrl);
        } catch (error) {
          console.error("Error uploading to storage:", error);
          toast.error('Error al subir la imagen. Usando copia local.', { id: toastId });
          callback(compressedData);
        }
      };
      img.onerror = () => {
        toast.error('Ocurrió un error al procesar el archivo de imagen.', { id: toastId });
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      toast.error('Ocurrió un error al leer el archivo de imagen.', { id: toastId });
    };
    reader.readAsDataURL(file);
  };

  const exportToCSV = (filename: string, content: string) => {
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarOperacionTotal = () => {
    try {
      let csv = "";
      
      const clean = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.replace(/;/g, ",").replace(/\r?\n|\r/g, " ").trim();
      };

      // SECCIÓN 1: RESUMEN GENERAL
      csv += "=== METRICAS DE OPERACION TOTAL (TIEMPO REAL) ===\n";
      csv += `Reporte Generado El;${new Date().toLocaleString()}\n`;
      csv += `Total Usuarios Registrados;${allUsers.length}\n`;
      csv += `Total Conductores Registrados;${allDrivers.length}\n`;
      csv += `Total Solicitudes de Viaje;${allTrips.length}\n`;
      csv += `Total Marcas Aliadas;${marcasAliadas.length}\n`;
      csv += `Total Historial de Recargas;${historialRecargas.length}\n`;
      
      const totalRecargasAprobadas = historialRecargas
        .filter(r => r.estado === 'aprobada')
        .reduce((acc, r) => acc + (r.valor || 0), 0);
      csv += `Total Recaudado por Recargas (Aprobadas);$${totalRecargasAprobadas.toLocaleString()} COP\n\n`;

      // SECCIÓN 2: VIAJES Y SERVICIOS
      csv += "=== HISTORIAL DE VIAJES Y SERVICIOS ===\n";
      csv += "ID Viaje;Fecha;Tipo de Servicio;Usuario;Telefono Usuario;Conductor;Origen;Destino;Valor;Estado;Es Aliado;Nombre Aliado\n";
      
      const combinedTrips = [...allTrips, ...allCancelledTrips]
        .filter((v, index, self) => self.findIndex(t => t.id === v.id) === index)
        .sort((a, b) => new Date(b.fecha || b.fecha_creacion || 0).getTime() - new Date(a.fecha || a.fecha_creacion || 0).getTime());

      combinedTrips.forEach(v => {
        const tipoLabel = v.tipo === 'carro' ? 'Carro' :
                          v.tipo === 'moto' ? 'Moto' :
                          v.tipo === 'taxi' ? 'Taxi' :
                          v.tipo === 'domicilio' ? 'Domicilio' :
                          v.tipo === 'camion_flete' ? 'Flete' :
                          v.tipo === 'camion_acarreo' ? 'Acarreo' :
                          v.tipo === 'motocarro' ? 'Moto Carro' : v.tipo || 'General';

        csv += `${clean(v.id)};`;
        csv += `${v.fecha ? new Date(v.fecha).toLocaleString() : ''};`;
        csv += `${clean(tipoLabel)};`;
        csv += `${clean(v.usuarioNombre || v.usuario_nombre)};`;
        csv += `${clean(v.usuarioTelefono || v.usuario_telefono)};`;
        csv += `${clean(v.conductorNombre || v.conductor_nombre || 'No asignado')};`;
        csv += `${clean(v.ruta?.origen || v.origen)};`;
        csv += `${clean(v.ruta?.destino || v.destino)};`;
        csv += `${v.valor || 0};`;
        csv += `${clean(v.estado)};`;
        csv += `${v.esEntregaAliado ? 'SI' : 'NO'};`;
        csv += `${clean(v.marcaAliadaNombre || '')}\n`;
      });
      csv += "\n";

      // SECCIÓN 3: CONDUCTORES
      csv += "=== DIRECTORIO DE CONDUCTORES ===\n";
      csv += "ID Conductor;Nombre;Cedula;Celular;Correo;Ciudad;Vehiculo Tipo;Placa;Color;Modo Repartidor;Aprobado;Bloqueado;Saldo Virtual\n";
      
      allDrivers.forEach(d => {
        csv += `${clean(d.id)};`;
        csv += `${clean(d.nombre)};`;
        csv += `${clean(d.cedula)};`;
        csv += `${clean(d.celular || d.telefono)};`;
        csv += `${clean(d.email)};`;
        csv += `${clean(d.ciudad)};`;
        csv += `${clean(d.vehiculo?.tipo)};`;
        csv += `${clean(d.vehiculo?.placa)};`;
        csv += `${clean(d.vehiculo?.color)};`;
        csv += `${d.modo_repartidor ? 'SI' : 'NO'};`;
        csv += `${d.aprobado !== false ? 'SI' : 'NO'};`;
        csv += `${d.bloqueado ? 'SI' : 'NO'};`;
        csv += `${d.tarjeta_virtual || 0}\n`;
      });
      csv += "\n";

      // SECCIÓN 4: USUARIOS
      csv += "=== DIRECTORIO DE USUARIOS ===\n";
      csv += "ID Usuario;Nombre;Correo;Telefono;Ciudad;Departamento;Rol;Estado Bloqueo\n";
      
      allUsers.forEach(u => {
        csv += `${clean(u.id)};`;
        csv += `${clean(u.nombre)};`;
        csv += `${clean(u.email)};`;
        csv += `${clean(u.celular || u.telefono)};`;
        csv += `${clean(u.ciudad)};`;
        csv += `${clean(u.departamento)};`;
        csv += `${clean(u.rol)};`;
        csv += `${u.bloqueado ? 'BLOQUEADO' : 'ACTIVO'}\n`;
      });
      csv += "\n";

      // SECCIÓN 5: HISTORIAL DE RECARGAS
      csv += "=== HISTORIAL DE RECARGAS ===\n";
      csv += "ID Recarga;Fecha;Conductor;Valor;Tipo de Recarga;Estado;Aprobado/Rechazado Por\n";
      
      historialRecargas.forEach(r => {
        csv += `${clean(r.id)};`;
        csv += `${r.fecha ? new Date(r.fecha).toLocaleString() : ''};`;
        csv += `${clean(r.conductorNombre)};`;
        csv += `${r.valor || 0};`;
        csv += `${clean(r.tipo === 'manual' ? 'Manual (Admin)' : 'Transferencia')};`;
        csv += `${clean(r.estado)};`;
        csv += `${clean(r.adminId || 'Sistema')}\n`;
      });
      csv += "\n";

      // SECCIÓN 6: MARCAS ALIADAS
      csv += "=== CATALOGO DE MARCAS ALIADAS ===\n";
      csv += "ID Marca;Nombre Comercial;Categoria;Ciudad;WhatsApp;Direccion Fisica;Fecha Registro\n";
      
      marcasAliadas.forEach(m => {
        csv += `${clean(m.id)};`;
        csv += `${clean(m.nombre)};`;
        csv += `${clean(m.categoria)};`;
        csv += `${clean(m.ciudad)};`;
        csv += `${clean(m.whatsapp)};`;
        csv += `${clean(m.direccion)};`;
        csv += `${m.fechaCreacion ? new Date(m.fechaCreacion).toLocaleString() : ''}\n`;
      });

      exportToCSV(`RuedasRapidas_Operacion_GoogleSheets_${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success("¡Reporte de operación total descargado exitosamente!");
    } catch (error) {
      console.error("Error al exportar reporte:", error);
      toast.error("Ocurrió un error al generar el archivo para Google Sheets.");
    }
  };

  const guardarMarcaAliada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaMarcaNombre || !nuevaMarcaDireccion || !nuevaMarcaCiudad || !nuevaMarcaWhatsapp || !nuevaMarcaCategoria) {
      toast.error("Por favor completa todos los campos requeridos.");
      return;
    }

    try {
      const data = {
        nombre: nuevaMarcaNombre.trim(),
        direccion: nuevaMarcaDireccion.trim(),
        ciudad: nuevaMarcaCiudad.trim(),
        whatsapp: nuevaMarcaWhatsapp.trim(),
        categoria: nuevaMarcaCategoria,
        logo: nuevaMarcaLogo,
        fechaCreacion: new Date().toISOString()
      };

      if (editingMarcaId) {
        await setDoc(doc(db, 'marcas_aliadas', editingMarcaId), data, { merge: true });
        toast.success("¡Marca Aliada actualizada con éxito!");
      } else {
        await addDoc(collection(db, 'marcas_aliadas'), data);
        toast.success("¡Marca Aliada registrada con éxito!");
      }

      // Reset form
      setNuevaMarcaNombre('');
      setNuevaMarcaDireccion('');
      setNuevaMarcaCiudad('');
      setNuevaMarcaWhatsapp('');
      setNuevaMarcaCategoria('Restaurante');
      setNuevaMarcaLogo('');
      setEditingMarcaId(null);
    } catch (error) {
      console.error("Error guardando marca aliada:", error);
      toast.error("Error al guardar la marca aliada");
    }
  };

  const openMyBrandManager = () => {
    const miMarca = marcasAliadas.find(m => m.creadorId === user?.uid);
    if (miMarca) {
      setUserMarcaNombre(miMarca.nombre || '');
      setUserMarcaDireccion(miMarca.direccion || '');
      setUserMarcaCiudad(miMarca.ciudad || perfil?.ciudad || 'Fusagasugá');
      setUserMarcaWhatsapp(miMarca.whatsapp || '');
      setUserMarcaCategoria(miMarca.categoria || 'Restaurante');
      setUserMarcaLogo(miMarca.logo || '');
      
      setUserOfferTitulo(miMarca.oferta?.titulo || '');
      setUserOfferDescripcion(miMarca.oferta?.descripcion || '');
      setUserOfferPrecioOriginal(miMarca.oferta?.precioOriginal || '');
      setUserOfferPrecioDescuento(miMarca.oferta?.precioDescuento || '');
      setUserOfferImagen(miMarca.oferta?.imagenOferta || '');
      setUserOfferActiva(miMarca.oferta?.activa !== false && !!miMarca.oferta?.titulo); 
    } else {
      setUserMarcaNombre('');
      setUserMarcaDireccion('');
      setUserMarcaCiudad(perfil?.ciudad || 'Fusagasugá');
      setUserMarcaWhatsapp(perfil?.telefono || '');
      setUserMarcaCategoria('Restaurante');
      setUserMarcaLogo('');
      
      setUserOfferTitulo('');
      setUserOfferDescripcion('');
      setUserOfferPrecioOriginal('');
      setUserOfferPrecioDescuento('');
      setUserOfferImagen('');
      setUserOfferActiva(false);
    }
    setShowUserMarcaRegistroModal(true);
  };

  const registrarMarcaDesdeUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userMarcaNombre.trim() || !userMarcaDireccion.trim() || !userMarcaCiudad.trim() || !userMarcaWhatsapp.trim() || !userMarcaCategoria) {
      toast.error("Por favor completa todos los campos requeridos.");
      return;
    }

    try {
      const miMarca = marcasAliadas.find(m => m.creadorId === user.uid);
      
      const ofertaData = userOfferTitulo.trim() ? {
        titulo: userOfferTitulo.trim(),
        descripcion: userOfferDescripcion.trim(),
        precioOriginal: Number(userOfferPrecioOriginal) || 0,
        precioDescuento: Number(userOfferPrecioDescuento) || 0,
        porcentajeDescuento: Number(userOfferPrecioOriginal) && Number(userOfferPrecioDescuento)
          ? Math.round(((Number(userOfferPrecioOriginal) - Number(userOfferPrecioDescuento)) / Number(userOfferPrecioOriginal)) * 100)
          : 0,
        imagenOferta: userOfferImagen || '',
        activa: userOfferActiva,
        fechaCreacion: miMarca?.oferta?.fechaCreacion || new Date().toISOString()
      } : null;

      const data = {
        nombre: userMarcaNombre.trim(),
        direccion: userMarcaDireccion.trim(),
        ciudad: userMarcaCiudad.trim(),
        whatsapp: userMarcaWhatsapp.trim(),
        categoria: userMarcaCategoria,
        logo: userMarcaLogo,
        creadorId: user.uid,
        oferta: ofertaData
      };

      if (miMarca) {
        await setDoc(doc(db, 'marcas_aliadas', miMarca.id), data, { merge: true });
        toast.success("¡Tu Comercio y Oferta han sido actualizados con éxito!");
      } else {
        await addDoc(collection(db, 'marcas_aliadas'), {
          ...data,
          fechaCreacion: new Date().toISOString()
        });
        toast.success("¡Tu Marca Aliada ha sido registrada con éxito!");
      }

      setShowUserMarcaRegistroModal(false);
    } catch (error) {
      console.error("Error al registrar o actualizar marca aliada:", error);
      toast.error("Error al guardar la información");
    }
  };

  const eliminarMarcaAliada = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta Marca Aliada?")) return;
    try {
      await deleteDoc(doc(db, 'marcas_aliadas', id));
      toast.success("¡Marca Aliada eliminada con éxito!");
    } catch (error) {
      console.error("Error al eliminar marca aliada:", error);
      toast.error("Error al eliminar la marca aliada");
    }
  };

  const iniciarEditarMarca = (marca: any) => {
    setEditingMarcaId(marca.id);
    setNuevaMarcaNombre(marca.nombre);
    setNuevaMarcaDireccion(marca.direccion);
    setNuevaMarcaCiudad(marca.ciudad);
    setNuevaMarcaWhatsapp(marca.whatsapp);
    setNuevaMarcaCategoria(marca.categoria || 'Restaurante');
  };

  const cancelarEditarMarca = () => {
    setEditingMarcaId(null);
    setNuevaMarcaNombre('');
    setNuevaMarcaDireccion('');
    setNuevaMarcaCiudad('');
    setNuevaMarcaWhatsapp('');
    setNuevaMarcaCategoria('Restaurante');
  };

  const handleCrearEntregaAliada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchSelectedAliadoId || !dispatchDestino) {
      toast.error("Por favor selecciona un negocio origen y escribe una dirección de destino.");
      return;
    }

    const marcaSeleccionada = marcasAliadas.find(m => m.id === dispatchSelectedAliadoId);
    if (!marcaSeleccionada) {
      toast.error("Negocio de origen no válido.");
      return;
    }

    try {
      const viajeData = {
        tipo: 'domicilio',
        esEntregaAliado: true,
        marcaAliadaId: marcaSeleccionada.id,
        marcaAliadaNombre: marcaSeleccionada.nombre,
        usuarioId: user?.uid || 'aliado_anon',
        usuarioNombre: marcaSeleccionada.nombre,
        usuarioTelefono: marcaSeleccionada.whatsapp,
        usuarioGenero: 'marca_aliada',
        usuarioEsFrecuente: true,
        usuarioSaldoPromo: 0,
        usuarioServiciosCount: 50,
        ruta: {
          origen: marcaSeleccionada.direccion,
          destino: dispatchDestino.trim()
        },
        valor: Number(dispatchValor) || 5000,
        estado: 'solicitado',
        ciudad: marcaSeleccionada.ciudad || 'Fusagasugá',
        usuarioCiudad: marcaSeleccionada.ciudad || 'Fusagasugá',
        detalles: dispatchDetalles.trim(),
        fecha: getSyncedISOString()
      };

      await addDoc(collection(db, 'viajes'), viajeData);
      toast.success("¡Entrega de Aliado creada con éxito! Se notificará a los conductores.");
      
      // Reset form & state
      setDispatchDestino('');
      setDispatchValor(5000);
      setDispatchDetalles('');
      setShowAliadoDispatchModal(false);
    } catch (error) {
      console.error("Error al crear entrega de aliado:", error);
      toast.error("Ocurrió un error al despachar la entrega de aliado.");
    }
  };

  const handleCrearEntregaSocioInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchSelectedAliadoId || !dispatchDestino) {
      toast.error("Por favor selecciona un negocio origen y escribe una dirección de destino.");
      return;
    }

    const marcaSeleccionada = marcasAliadas.find(m => m.id === dispatchSelectedAliadoId);
    if (!marcaSeleccionada) {
      toast.error("Negocio de origen no válido.");
      return;
    }

    try {
      const viajeData = {
        tipo: 'domicilio',
        esEntregaAliado: true,
        marcaAliadaId: marcaSeleccionada.id,
        marcaAliadaNombre: marcaSeleccionada.nombre,
        usuarioId: user?.uid || 'aliado_anon',
        usuarioNombre: marcaSeleccionada.nombre,
        usuarioTelefono: marcaSeleccionada.whatsapp,
        usuarioGenero: 'marca_aliada',
        usuarioEsFrecuente: true,
        usuarioSaldoPromo: 0,
        usuarioServiciosCount: 50,
        ruta: {
          origen: marcaSeleccionada.direccion,
          destino: dispatchDestino.trim()
        },
        valor: Number(dispatchValor) || 5000,
        estado: 'solicitado',
        ciudad: marcaSeleccionada.ciudad || 'Fusagasugá',
        usuarioCiudad: marcaSeleccionada.ciudad || 'Fusagasugá',
        detalles: dispatchDetalles.trim(),
        fecha: getSyncedISOString()
      };

      await addDoc(collection(db, 'viajes'), viajeData);
      toast.success("¡Despacho solicitado con éxito! Los repartidores recibirán tu oferta.");
      
      // Reset form & state
      setDispatchDestino('');
      setDispatchValor(5000);
      setDispatchDetalles('');
      setSocioModalRightTab('directorio');
    } catch (error) {
      console.error("Error al despachar desde socio inline:", error);
      toast.error("Ocurrió un error al procesar el despacho.");
    }
  };

  const cancelarViajeOld = async (viajeId: string) => {
    setConfirmAction({
      title: '¿CANCELAR SERVICIO?',
      message: '¿Estás seguro de que deseas cancelar este servicio? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        const viajeRef = doc(db, 'viajes', viajeId);
        try {
          await setDoc(viajeRef, { 
            estado: 'cancelado',
            canceladoPor: 'usuario',
            fecha_cancelacion: getSyncedISOString()
          }, { merge: true });
          toast.success("Viaje cancelado exitosamente");
        } catch (error) {
          console.error("Error al cancelar viaje (usuario):", error);
          handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const handleContraoferta = (viaje: any) => {
    setSelectedTripForOffer(viaje);
    const isCargo = viaje.tipo === 'camion_flete' || viaje.tipo === 'camion_acarreo' || viaje.tipo === 'motocarro';
    setOfferValue(isCargo ? 50000 : (viaje.valor + 2000));
    setArrivalETA(5);
    setShowOfferModal(true);
  };

  const handleFinalizarViaje = async (viajeId: string, usuarioId: string, valor: number) => {
    if (isFinishingTrip) return;
    setIsFinishingTrip(true);
    try {
      await finalizarViaje(viajeId, usuarioId, valor);
      toast.success("Viaje finalizado con éxito");
    } catch (error: any) {
      console.error("Error en handleFinalizarViaje:", error);
      
      try {
        const errData = JSON.parse(error.message);
        if (errData.error === 'Este viaje ya ha sido finalizado') {
          // Si ya está finalizado, solo informamos silenciosamente
          toast.info("Este viaje ya había sido finalizado");
        } else {
          toast.error("Error al finalizar el viaje");
        }
      } catch (e) {
        toast.error("Error al finalizar el viaje");
      }
    } finally {
      setIsFinishingTrip(false);
    }

    // Solo el usuario (pasajero) puede calificar al conductor
    // La apertura del modal de calificación se gestiona limpiamente mediante el efecto automático del historial
  };

  const handleModalSubmitRating = async ({ estrellas, comentario }: { estrellas: number; comentario: string }) => {
    if (!selectedTripForRating || !user) return;

    setIsSubmittingRating(true);
    try {
      await calificarConductor(
        selectedTripForRating.id,
        selectedTripForRating.conductorId,
        user.uid,
        estrellas,
        comentario
      );
      try {
        const ratedTrips = JSON.parse(localStorage.getItem('ratedTrips') || '[]');
        if (!ratedTrips.includes(selectedTripForRating.id)) {
          ratedTrips.push(selectedTripForRating.id);
          localStorage.setItem('ratedTrips', JSON.stringify(ratedTrips));
        }
      } catch (e) {}
      toast.success("¡Gracias por tu calificación!");
      setShowRatingModal(false);
      setSelectedTripForRating(null);
      setRatingStars(5);
      setRatingComment("");
    } catch (error: any) {
      console.error("Error en handleModalSubmitRating:", error);
      try {
        const errData = JSON.parse(error.message);
        if (errData.error === 'Este viaje ya ha sido calificado') {
          toast.info("Este viaje ya ha sido calificado anteriormente");
          setShowRatingModal(false);
          setSelectedTripForRating(null);
          return;
        }
      } catch (e) {
        // No JSON error
      }
      toast.error("Error al enviar la calificación");
      throw error;
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitRating = async (starsParam?: number) => {
    const starsToUse = starsParam !== undefined ? starsParam : ratingStars;

    if (starsToUse < 3 && !ratingComment.trim()) {
      toast.error("Por favor, cuéntanos qué pasó (comentario obligatorio para menos de 3 estrellas)");
      return;
    }

    setIsSubmittingRating(true);
    
    // Calcular si hubo retraso en la llegada
    let tripWasDelayed = false;
    if (selectedTripForRating.fecha_aceptacion && selectedTripForRating.tiempo_llegada && (selectedTripForRating.fecha_llegando || selectedTripForRating.fecha_finalizacion)) {
      const acceptTime = new Date(selectedTripForRating.fecha_aceptacion).getTime();
      const arrivalTime = new Date(selectedTripForRating.fecha_llegando || selectedTripForRating.fecha_finalizacion).getTime();
      const promisedMs = selectedTripForRating.tiempo_llegada * 60 * 1000;
      tripWasDelayed = (arrivalTime - acceptTime) > promisedMs;
    }

    if (tripWasDelayed && !ratingComment.trim()) {
      setIsSubmittingRating(false);
      toast.error("El conductor llegó con retraso. Debes dejar un comentario sobre el incumplimiento.");
      return;
    }

    try {
      await calificarConductor(
        selectedTripForRating.id,
        selectedTripForRating.conductorId,
        user.uid,
        starsToUse,
        ratingComment
      );
      toast.success("¡Gracias por tu calificación!");
      setShowRatingModal(false);
      setRatingStars(5);
      setRatingComment("");
    } catch (error: any) {
      console.error("Error en handleSubmitRating:", error);
      
      // Intentar parsear el error de Firestore
      try {
        const errData = JSON.parse(error.message);
        if (errData.error === 'Este viaje ya ha sido calificado') {
          toast.info("Este viaje ya ha sido calificado anteriormente");
          setShowRatingModal(false);
          return;
        }
      } catch (e) {
        // No es un error JSON de Firestore
      }

      toast.error("Error al enviar la calificación");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const submitOferta = async (customPrice?: number, customTime?: number) => {
    if (!selectedTripForOffer || !user) return;
    
    const finalValue = customPrice !== undefined ? customPrice : offerValue;
    const finalTime = customTime !== undefined ? customTime : arrivalETA;

    if (finalValue < 4000) {
      toast.error("La tarifa mínima es $4.000");
      return;
    }

    try {
      await handleServiceCall(
        () => ofertarViaje(
          selectedTripForOffer.id, 
          user.uid, 
          perfil?.nombre || user.displayName || 'Conductor', 
          conductor?.telefono || conductor?.celular || perfil?.celular || perfil?.telefono || '',
          conductor?.vehiculo?.placa || driverRegData.vehiculo.placa || '',
          conductor?.vehiculo?.color || driverRegData.vehiculo.color || '',
          finalValue,
          finalTime,
          driverGpsLocation
        ),
        "Oferta enviada exitosamente"
      );
      setShowOfferModal(false);
    } catch (error: any) {
      if (error && error.message) {
        toast.error(error.message);
      }
    }
  };

  const triggersIncomingNotification = (title: string, body: string, actionLabel?: string, actionClick?: () => void) => {
    soundService.playNuevoViaje();
    toast.info(title, {
      description: body,
      action: actionLabel && actionClick ? {
        label: actionLabel,
        onClick: actionClick
      } : undefined,
      duration: 10000
    });

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          tag: 'ruedas-rapidas-notif',
          requireInteraction: true
        });
      } catch (e) {
        console.warn('Error al activar notificación nativa:', e);
      }
    }
  };

  const handleDriverRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (conductor) {
        // Modo Edición: Incrementar el perfil del conductor sin sobreescribir balance ni documentos
        const conductorRef = doc(db, 'conductores', user.uid);
        await updateDoc(conductorRef, {
          nombre: perfil?.nombre || user.displayName || conductor.nombre || 'Conductor',
          telefono: perfil?.celular || perfil?.telefono || user.phoneNumber || conductor.telefono || '',
          celular: perfil?.celular || perfil?.telefono || user.phoneNumber || conductor.celular || '',
          email: user.email || perfil?.email || conductor.email || '',
          genero: driverRegData.genero,
          ciudad: driverRegData.ciudad,
          departamento: driverRegData.departamento || 'Casanare',
          vehiculo: driverRegData.vehiculo
        });
        toast.success("Vehículo y especificaciones actualizados con éxito");
      } else {
        // Modo Registro: Nuevo perfil de conductor
        await crearPerfilConductor(user.uid, { 
          nombre: perfil?.nombre || user.displayName || 'Conductor', 
          email: user.email || perfil?.email || '',
          telefono: perfil?.celular || perfil?.telefono || user.phoneNumber || '',
          celular: perfil?.celular || perfil?.telefono || user.phoneNumber || '',
          ...driverRegData
        });
        
        // Actualizar rol en la colección de usuarios
        const nuevoRol = perfil?.rol === 'usuario' ? 'ambos' : 'conductor';
        await updateDoc(doc(db, 'usuarios', user.uid), {
          rol: nuevoRol
        });
        
        toast.success("Registro como conductor exitoso");
      }
      setShowDriverRegModal(false);
      // Recargar perfil de conductor
      const conductorDoc = await getDoc(doc(db, 'conductores', user.uid));
      if (conductorDoc.exists()) setConductor(conductorDoc.data());
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Error al guardar datos del vehículo";
      toast.error(msg);
    }
  };

  // Escuchar mensajes del chat seleccionado en tiempo real
  useEffect(() => {
    if (!showAdminMessageModal || !adminMessageTarget || !user) {
      setMessagesAdminChat([]);
      return;
    }

    // El chatId entre admin y usuario/conductor es siempre el ID del usuario/conductor
    const chatId = adminMessageTarget.id;
    
    console.log("Suscribiéndose al chat:", chatId);
    
    const q = query(
      collection(db, 'mensajes_admin'),
      where('chatId', '==', chatId),
      limit(50)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Sort messages in-memory by date to avoid requiring a composite index
      msgs.sort((a, b) => {
        const t1 = a.fecha ? new Date(a.fecha).getTime() : 0;
        const t2 = b.fecha ? new Date(b.fecha).getTime() : 0;
        return t1 - t2;
      });

      setMessagesAdminChat(msgs);
      
      // Reproducir sonido para nuevos mensajes de soporte/admin
      let hasIncoming = false;
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          if (msg.remitenteId !== user.uid) {
            const msgTime = msg.fecha ? (typeof msg.fecha === 'string' ? new Date(msg.fecha).getTime() : (msg.fecha.toDate ? msg.fecha.toDate().getTime() : Date.now())) : Date.now();
            if (Date.now() - msgTime < 10000) { // Reciente
              hasIncoming = true;
            }
          }
        }
      });
      if (hasIncoming) {
        soundService.playNuevoMensaje();
      }
      
      // Si el chat está abierto, marcar como leídos los mensajes que llegan para mí
      marcarMensajesChatLeidos(chatId, user.uid);
    }, (error) => {
      console.error("Error en chat real-time:", error);
    });

    return () => unsub();
  }, [showAdminMessageModal, adminMessageTarget, user]);

  const handleSendAdminMessage = async () => {
    if (!adminMessageTarget || !adminMessageText.trim() || !user) return;
    setIsSendingAdminMessage(true);
    
    // El chatId es el ID del usuario/conductor
    const chatId = adminMessageTarget.id;
    
    // Si yo soy el usuario/conductor del adminMessageTarget, el receptor es el Admin
    // Si yo soy el Admin, el receptor es el usuario/conductor
    const isAdminUser = isUserAdmin;
    const targetId = isAdminUser ? adminMessageTarget.id : 'ADMIN_ID'; // Usamos un placeholder o el ID real del admin
    // En este sistema, el targetId en mensajes_admin se usa para notificaciones.
    // Para simplificar: si el admin envía, targetId es el usuario. Si el usuario envía, targetId es el admin.
    
    try {
      await enviarMensajeAdmin(
        chatId,
        adminMessageText,
        user.uid,
        perfil?.nombre || user.displayName || 'Usuario',
        isAdminUser ? adminMessageTarget.id : 'admin', // Simplificación: el id 'admin' sirve para que el admin escuche todos o específicos
        isAdminUser ? adminMessageTarget.nombre : 'Administrador',
        adminMessageTarget.type
      );
      setAdminMessageText('');
    } catch (error) {
      toast.error("Error al enviar el mensaje");
    } finally {
      setIsSendingAdminMessage(false);
    }
  };

  const handleAdminAction = async () => {
    if (!adminActionTarget || !adminActionType) return;

    try {
      if (adminActionType === 'edit_saldo_usuario') {
        const val = Number(adminActionValue) || 0;
        await ajustarSaldoUsuario(adminActionTarget.id, adminActionTarget.nombre, val, user.uid);
        toast.success(`¡Saldo promocional de $${val.toLocaleString()} COP asignado a ${adminActionTarget.nombre || 'usuario'}!`);
      } else if (adminActionType === 'edit_saldo_conductor') {
        await recargaManual(adminActionTarget.id, adminActionTarget.nombre, Number(adminActionValue), user.uid);
        toast.success("Saldo de conductor actualizado");
      } else if (adminActionType === 'confirm_bloqueo_usuario') {
        await toggleBloqueoUsuario(adminActionTarget.id, !adminActionTarget.bloqueado);
        toast.success(adminActionTarget.bloqueado ? "Usuario desbloqueado" : "Usuario bloqueado");
      } else if (adminActionType === 'confirm_bloqueo_conductor') {
        if (!adminActionTarget.bloqueado) {
          await toggleBloqueoConductor(
            adminActionTarget.id, 
            true, 
            bloqueoTipo, 
            bloqueoTipo === 'temporal' ? bloqueoHoras : undefined
          );
          toast.success(
            bloqueoTipo === 'temporal' 
              ? `Conductor bloqueado por ${bloqueoHoras} ${bloqueoHoras === 1 ? 'hora' : 'horas'}` 
              : "Conductor bloqueado permanentemente"
          );
        } else {
          await toggleBloqueoConductor(adminActionTarget.id, false);
          toast.success("Conductor desbloqueado");
        }
      } else if (adminActionType === 'toggle_suplente') {
        const esSuplenteActual = adminActionTarget.rol === 'admin_suplente';
        await toggleAdminSuplente(adminActionTarget.id, !esSuplenteActual);
        toast.success(esSuplenteActual ? "Administrador suplente desactivado" : "Administrador suplente activado");
      }
      setShowAdminActionModal(false);
    } catch (error) {
      toast.error("Error al realizar la acción");
    }
  };

  const handleAdminCancelTrip = async () => {
    if (!selectedTripForAdminCancel) return;
    
    setIsProcessingAdminCancel(true);
    try {
      const reason = adminCancelReason === 'Otro' ? adminCancelCustomReason : adminCancelReason;
      
      if (adminCancelArchiveTrip) {
        // Cancelar y archivar de inmediato (limpia el UI del pasajero al instante sin dejar aviso)
        const viajeRef = doc(db, 'viajes', selectedTripForAdminCancel.id);
        await updateDoc(viajeRef, {
          estado: 'finalizado_cancelado',
          canceladoPor: 'administrador',
          motivoCancelacionAdmin: reason,
          canceladoPorAdminId: user.uid,
          fecha_cancelacion: getSyncedISOString(),
          actualizado_en: serverTimestamp()
        });

        // Liberar conductor si existe
        if (selectedTripForAdminCancel.conductorId) {
          const conductorRef = doc(db, 'conductores', selectedTripForAdminCancel.conductorId);
          await updateDoc(conductorRef, {
            en_servicio: false,
            viajeActualId: null
          });
        }
      } else {
        // Cancelación estándar donde el pasajero debe presionar "Cerrar Notificación"
        await cancelarViajePorAdministrador(selectedTripForAdminCancel.id, user.uid, reason);
      }
      
      if (adminCancelNotifyUser) {
        try {
          await enviarMensajeAdmin(
            selectedTripForAdminCancel.usuarioId,
            `Hola ${selectedTripForAdminCancel.usuarioNombre}, tu solicitud de servicio ha sido cancelada por el administrador debido a: "${reason}". Si aún necesitas transporte, por favor solicita uno nuevo.`,
            user.uid,
            perfil?.nombre || user.displayName || 'Administrador',
            selectedTripForAdminCancel.usuarioId,
            selectedTripForAdminCancel.usuarioNombre,
            'usuario'
          );
        } catch (msgErr) {
          console.warn("No se pudo enviar el mensaje automático al usuario, pero se completó la cancelación.", msgErr);
        }
      }

      toast.success(adminCancelArchiveTrip ? "Solicitud anulada y archivada (UI del pasajero limpia)" : "Solicitud anulada con notificación al pasajero");
      setShowAdminCancelTripModal(false);
      setSelectedTripForAdminCancel(null);
      setAdminCancelCustomReason('');
    } catch (error) {
      console.error(error);
      toast.error("Error al cancelar la solicitud");
    } finally {
      setIsProcessingAdminCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <MapProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Toaster position="top-center" richColors />
        {!user ? (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-600 to-teal-800 text-white w-full overflow-y-auto py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 shadow-2xl space-y-6 text-center"
            >
              <div className="bg-white/20 p-4 rounded-3xl inline-block backdrop-blur-sm">
                <Car size={48} className="text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-white mb-2">Ruedas Rápidas</h1>
                <p className="text-emerald-50 text-xs opacity-90">
                  Tu transporte multicanal en Colombia. Moto, Carro y Domicilios en un solo lugar.
                </p>
              </div>

              {/* Selector de pestañas de autenticación */}
              <div className="grid grid-cols-2 p-1.5 bg-black/20 rounded-2xl border border-white/10 text-xs font-bold uppercase tracking-wider mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailAuthMode('register');
                  }}
                  className={`py-2.5 rounded-xl transition-all duration-300 ${emailAuthMode === 'register' ? 'bg-white text-emerald-800 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                >
                  Teléfono (SMS)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailAuthMode('login');
                  }}
                  className={`py-2.5 rounded-xl transition-all duration-300 ${emailAuthMode === 'login' ? 'bg-white text-emerald-800 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                >
                  Google / Correo
                </button>
              </div>

              {emailAuthMode === 'login' ? (
                <div className="space-y-6">
                  {/* Google Login Section */}
                  <div className="space-y-3">
                    <p className="text-xs text-white/70 font-bold uppercase tracking-widest text-left px-1">Acceso Rápido y Seguro</p>
                    <button
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="w-full bg-white hover:bg-emerald-50 text-emerald-800 py-4 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 cursor-pointer text-center"
                    >
                      {isLoggingIn ? (
                        <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                      )}
                      {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar con Google'}
                    </button>
                  </div>

                  {/* Divider line */}
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink mx-4 text-[10px] text-white/40 font-bold uppercase tracking-wider">o usa tus credenciales</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  {/* Email/Password Sign-In form */}
                  <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5 px-1">Correo Electrónico</label>
                      <input
                        type="email"
                        required
                        value={emailForm.email}
                        onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                        placeholder="correo@ejemplo.com"
                        className="w-full bg-black/20 border border-white/10 focus:border-emerald-400 rounded-2xl p-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5 px-1">Contraseña</label>
                      <input
                        type="password"
                        required
                        value={emailForm.password}
                        onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                        placeholder="Ingresa tu contraseña"
                        className="w-full bg-black/20 border border-white/10 focus:border-emerald-400 rounded-2xl p-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isEmailProcessing}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 mt-6 cursor-pointer"
                    >
                      {isEmailProcessing && (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      Ingresar de Forma Segura
                    </button>
                  </form>
                </div>
              ) : (
                /* Phone SMS Registration Section (Paso 1 y Paso 2) */
                <div className="space-y-4 text-left">
                  {phoneStep === 1 ? (
                    /* Paso 1: Input de teléfono + Botón "Enviar código" */
                    <form onSubmit={handleRequestPhoneOTP} className="space-y-4">
                      {/* Selector de Crear Cuenta vs Iniciar Sesión con Teléfono */}
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/30 rounded-xl border border-white/10 text-xs font-bold text-center">
                        <button
                          type="button"
                          onClick={() => setPhoneAuthSubMode('register')}
                          className={`py-1.5 rounded-lg transition-all ${phoneAuthSubMode === 'register' ? 'bg-white text-emerald-800 shadow' : 'text-white/70 hover:text-white'}`}
                        >
                          Crear Cuenta Nueva
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhoneAuthSubMode('login')}
                          className={`py-1.5 rounded-lg transition-all ${phoneAuthSubMode === 'login' ? 'bg-white text-emerald-800 shadow' : 'text-white/70 hover:text-white'}`}
                        >
                          Ya tengo cuenta
                        </button>
                      </div>

                      <div className="p-3 bg-white/10 rounded-2xl border border-white/15 text-xs text-white/90 leading-relaxed">
                        {phoneAuthSubMode === 'register' ? (
                          <span>📱 <strong>Nuevo Registro:</strong> Te enviaremos un código SMS de 6 dígitos. Solo números de Colombia (+57).</span>
                        ) : (
                          <span>🔐 <strong>Iniciar Sesión:</strong> Ingresa tu número celular registrado para recibir tu código SMS de acceso.</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5 px-1">
                          Número de Celular (Colombia)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-sm font-bold text-emerald-300 pointer-events-none">
                            🇨🇴 +57
                          </span>
                          <input
                            type="tel"
                            required
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="312 345 6789"
                            className="w-full bg-black/20 border border-white/10 focus:border-emerald-400 rounded-2xl py-3.5 pl-20 pr-4 text-sm text-white placeholder-white/30 focus:outline-none font-semibold transition-all tracking-wider"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-white/60 mt-1.5 px-1">
                          <span>Seguridad: Máx. 3 intentos en 5 min (bloqueo 15 min)</span>
                          <span className="font-mono text-emerald-300">Máx 2 equipos</span>
                        </div>
                      </div>

                      <div className="text-left py-1 text-[11px] text-white/60 leading-relaxed">
                        Al continuar, aceptas el protocolo de seguridad y validación OTP para Ruedas Rápidas.
                      </div>

                      <button
                        type="submit"
                        disabled={isPhoneProcessing || !phoneInput.trim()}
                        className="w-full bg-white text-emerald-800 py-4 rounded-2xl font-bold text-base shadow-lg hover:bg-emerald-50 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 mt-4 cursor-pointer"
                      >
                        {isPhoneProcessing ? (
                          <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Smartphone size={18} />
                        )}
                        {isPhoneProcessing ? 'Enviando código SMS...' : phoneAuthSubMode === 'register' ? 'Registrarme con SMS' : 'Enviar código de acceso'}
                      </button>
                    </form>
                  ) : (
                    /* Paso 2: Input de 6 dígitos + Botón "Verificar" */
                    <form onSubmit={handleVerifyPhoneOTP} className="space-y-4">
                      <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 text-xs text-emerald-100 leading-relaxed flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white text-xs">Código SMS enviado a:</p>
                          <p className="font-mono text-emerald-200 text-sm">{phoneInput}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneStep(1);
                            setOtpCodeInput('');
                          }}
                          className="text-[11px] font-bold text-emerald-300 underline hover:text-white px-2 py-1"
                        >
                          Cambiar número
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5 px-1">
                          Código de 6 Dígitos
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={otpCodeInput}
                          onChange={(e) => setOtpCodeInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="w-full bg-black/30 border-2 border-emerald-400/50 focus:border-emerald-300 rounded-2xl py-3.5 text-center text-2xl font-mono text-white tracking-[0.5em] placeholder-white/20 focus:outline-none transition-all shadow-inner"
                        />
                        <div className="flex items-center justify-between text-[10px] text-white/70 mt-1.5 px-1">
                          <span>Ingresa los 6 números del SMS</span>
                          <button
                            type="button"
                            onClick={() => setOtpCodeInput('123456')}
                            className="text-emerald-300 hover:text-emerald-200 underline font-mono text-[11px] cursor-pointer"
                          >
                            Usar código demo (123456)
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isPhoneProcessing || otpCodeInput.trim().length < 6}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 mt-4 cursor-pointer"
                      >
                        {isPhoneProcessing ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        {isPhoneProcessing ? 'Validando código...' : 'Verificar'}
                      </button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          disabled={isPhoneProcessing}
                          onClick={handleRequestPhoneOTP}
                          className="text-xs text-white/70 hover:text-white underline font-semibold transition-colors disabled:opacity-50"
                        >
                          ¿No recibiste el SMS? Reenviar código
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Contenedor DOM para el reCAPTCHA Invisible de Firebase Auth */}
              <div id="recaptcha-container"></div>

              {authError === 'operation-not-allowed' && (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-left space-y-3">
                  <div className="flex gap-2 text-red-200 text-xs font-bold items-center">
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <span>PROVEEDOR NO ACTIVADO EN FIREBASE</span>
                  </div>
                  <p className="text-[11px] text-red-100 leading-relaxed">
                    Firebase ha devuelto el error <code>auth/operation-not-allowed</code> porque el método de <strong>Correo y contraseña</strong> está desactivado en la consola de tu proyecto.
                  </p>
                  <div className="bg-black/30 p-2.5 rounded-xl text-[10px] text-emerald-100 space-y-1 font-mono">
                    <p className="font-bold text-white mb-0.5">Para solucionarlo:</p>
                    <p>1. Ve a tu consola de Firebase.</p>
                    <p>2. Entra a Authentication &gt; Sign-in method.</p>
                    <p>3. Habilita "Correo electrónico/contraseña".</p>
                  </div>
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthError(null)}
                      className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-all text-center cursor-pointer border-none"
                    >
                      Cerrar aviso
                    </button>
                  </div>
                </div>
              )}

              {/* Helpful Alert/Hint regarding dynamic preview iframes */}
              {typeof window !== 'undefined' && window.self !== window.top && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left flex gap-3 text-amber-100 text-xs leading-relaxed">
                  <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300 block mb-1">Entorno de Pruebas</span>
                    Si el ingreso con Google presenta bloqueos por las cookies de terceros en el iframe, por favor haz clic en el botón <strong>Abrir en pestaña nueva</strong> arriba a la derecha, o inicia sesión / regístrate con tu <strong>Correo electrónico</strong>.
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        ) : perfil?.bloqueado ? (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center space-y-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center text-red-600 shadow-2xl shadow-red-100"
            >
              <ShieldAlert size={64} className="animate-pulse" />
            </motion.div>
            <div className="space-y-3 max-w-xs">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">CUENTA BLOQUEADA</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Tu acceso a la plataforma ha sido suspendido por la administración debido a incumplimiento de nuestras políticas de seguridad o términos de servicio.
              </p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 w-full max-w-xs space-y-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                  <Shield size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Soporte Técnico</p>
                  <p className="text-xs font-bold text-slate-700">soporte@tuviaje.com</p>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-2xl relative overflow-hidden">
            {/* Header */}
            <header className="p-6 bg-emerald-600 text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold">Ruedas Rápidas</h2>
                <p className="text-xs text-emerald-100 opacity-80">Colombia • COP</p>
              </div>
              <div className="flex items-center gap-2">
                {isUserAdmin && (
                  <button 
                    onClick={() => setActiveTab('admin')} 
                    className={`p-1 rounded-full transition-all relative ${activeTab === 'admin' ? 'bg-white text-emerald-600' : 'text-white/20 hover:text-white/60 hover:bg-white/10'}`}
                    title="Administración"
                  >
                    <Shield size={14} />
                    {recargasPendientes.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center border border-white">
                        {recargasPendientes.length}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
              {activeTab === 'home' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-6 py-8 relative"
                >
                  <div className="text-center space-y-2 mb-4">
                    <h3 className="text-2xl font-bold text-slate-900">¿Cómo quieres viajar hoy?</h3>
                    <p className="text-sm text-slate-500">Selecciona tu modo de ingreso</p>
                  </div>

                  <button 
                    onClick={() => setActiveTab('usuario')}
                    className="group relative overflow-hidden bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl hover:shadow-2xl hover:border-emerald-200 transition-all text-left"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <UserIcon size={120} />
                    </div>
                    <div className="relative z-10">
                      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                        <MapPin size={32} />
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 mb-2">Modo Pasajero</h4>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-[200px]">
                        Solicita viajes, envía paquetes y muévete por la ciudad con seguridad.
                      </p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      if (conductor) {
                        setActiveTab('conductor');
                      } else {
                        setShowDriverRegModal(true);
                      }
                    }}
                    className="group relative overflow-hidden bg-slate-900 p-8 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all text-left"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity text-white">
                      <ShieldCheck size={120} />
                    </div>
                    <div className="relative z-10">
                      <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-900 mb-6 group-hover:scale-110 transition-transform">
                        <Car size={32} />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Modo Conductor</h4>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">
                        {conductor 
                          ? "Gestiona tus viajes, visualiza solicitudes y aumenta tus ganancias."
                          : "Regístrate como conductor y comienza a generar ingresos hoy mismo."}
                      </p>
                    </div>
                  </button>

                  {/* Botón Admin muy discreto */}
                  {isUserAdmin && (
                    <div className="mt-8 flex justify-center opacity-10 hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setActiveTab('admin')}
                        className="p-2 text-slate-200 hover:text-indigo-600 transition-colors flex flex-col items-center gap-1 relative"
                        title="Gestión de Aplicación"
                      >
                        <Shield size={16} />
                        {recargasPendientes.length > 0 && (
                          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center border border-white">
                            {recargasPendientes.length}
                          </span>
                        )}
                        <span className="text-[8px] font-bold uppercase tracking-tighter">Admin</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'usuario' && (
                <div className="space-y-6">
                  {/* Cabecera de Usuario & Accesos Rápidos */}
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-xl shadow-inner border border-emerald-100/50">
                          {(perfil?.nombre || user.displayName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Bienvenido Pasajero</p>
                          <h4 className="font-black text-slate-800 text-base leading-tight mt-0.5">{perfil?.nombre || user.displayName}</h4>
                          <p className="text-[9px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                            <MapPin size={10} /> {perfil?.ciudad || 'Bogotá'}{perfil?.departamento ? `, ${perfil.departamento}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Botón de Mi Perfil */}
                        <button 
                          onClick={() => {
                            setProfileFormData({
                              nombre: perfil?.nombre || '',
                              celular: perfil?.celular || perfil?.telefono || '',
                              ciudad: perfil?.ciudad || 'Bogotá',
                              departamento: perfil?.departamento || 'Cundinamarca',
                              genero: perfil?.genero || 'masculino'
                            });
                            setShowProfileModal(true);
                          }}
                          className="w-10 h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center transition-all border border-indigo-100/30 cursor-pointer"
                          title="Mi Perfil"
                        >
                          <UserIcon size={18} />
                        </button>
                        {/* Botón de Soporte */}
                        <button 
                          onClick={() => {
                            setAdminMessageTarget({ id: user.uid, nombre: 'Admin', type: 'usuario' });
                            setShowAdminMessageModal(true);
                          }}
                          className="w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center transition-all border border-blue-100/30 cursor-pointer"
                          title="Soporte Técnico"
                        >
                          <Headphones size={18} />
                        </button>
                        {/* Botón de Historial */}
                        <button 
                          onClick={() => {
                            setHistoryType('usuario');
                            setShowHistory(true);
                          }}
                          className="w-10 h-10 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center transition-all border border-slate-200/50 cursor-pointer"
                          title="Historial de Viajes"
                        >
                          <Clock size={18} />
                        </button>

                      </div>
                    </div>

                    {/* Promo Balance banner inside the header if they have promo balance */}
                    {perfil?.saldo_promo > 0 && (
                      <div className="bg-slate-900 px-4 py-3 rounded-2xl text-white flex items-center justify-between border border-slate-800">
                        <div className="text-left">
                          <p className="text-[8px] uppercase font-bold text-emerald-400 tracking-wider">Bono Promocional</p>
                          <p className="text-sm font-mono font-bold text-emerald-400 leading-none mt-0.5">${(perfil?.saldo_promo || 0).toLocaleString()} COP</p>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium">Se aplica a tus viajes</span>
                      </div>
                    )}

                    <AnimatePresence>
                      {!conductor && showDriverInvite && (
                        <motion.div 
                          initial={{ opacity: 0, y: -6, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, padding: 0, overflow: 'hidden' }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="relative overflow-hidden rounded-2xl bg-slate-900 text-white p-4 shadow-sm border border-slate-800 text-left"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                                <Car size={20} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-xs font-black text-white tracking-tight">
                                    ¿Deseas generar ingresos conduciendo?
                                  </h5>
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                    85% Neto
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                                  Registra tu moto, taxi o carro y recibe solicitudes de viajes con horarios 100% flexibles.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                onClick={() => {
                                  setShowDriverRegModal(true);
                                }}
                                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <span>Quiero Ser Conductor</span>
                                <ChevronRight size={13} className="stroke-[3]" />
                              </button>
                              <button 
                                onClick={handleDismissDriverInvite}
                                title="Cerrar invitación"
                                aria-label="Cerrar invitación"
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700/40"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!conductor && !showDriverInvite && (
                      <div className="flex justify-end -mt-2">
                        <button
                          onClick={() => {
                            setShowDriverInvite(true);
                            try {
                              localStorage.removeItem('ruedas_dismiss_driver_invite');
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="text-[10px] text-slate-400 hover:text-emerald-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Car size={12} />
                          <span>¿Quieres conducir con nosotros? Postúlate aquí</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active Trips (Mis Solicitudes) - Moved here for better visibility */}
                  {misViajes.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tus Viajes Activos</h4>
                      {misViajes.map(viaje => (
                        <div key={viaje.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{viaje.ruta.destino}</p>
                              <p className="text-[10px] text-slate-500">{(viaje?.tipo ? (viaje.tipo === 'taxi' ? 'Taxi' : viaje.tipo.charAt(0).toUpperCase() + viaje.tipo.slice(1)) : 'Viaje')} • {new Date(viaje?.fecha).toLocaleTimeString()}</p>
                              {viaje.conductorNombre && (
                                <div>
                                  <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">
                                    {viaje.conductorNombre?.split(' ')[0]} • Asignado
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-mono font-black text-slate-700">
                                      <Lock size={8} />
                                      <span>***{viaje.conductorPlaca?.slice(-4) || '****'}</span>
                                    </div>
                                    {viaje.conductorColor && (
                                      <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600 uppercase">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: viaje.conductorColor?.toLowerCase() === 'blanco' ? '#fff' : viaje.conductorColor?.toLowerCase() === 'negro' ? '#000' : viaje.conductorColor }} />
                                        {viaje.conductorColor}
                                      </div>
                                    )}
                                    {viaje.conductorCalificacion && (
                                      <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
                                        <Star size={10} fill="currentColor" />
                                        {viaje.conductorCalificacion.toFixed(1)}
                                      </div>
                                    )}
                                  </div>

                                  {(viaje.tipo === 'taxi' || viaje.conductorVehiculo?.tipo === 'taxi') && (
                                    <div className="mt-1.5 bg-yellow-50/50 p-2 rounded-xl border border-yellow-100/50 text-[9px] text-slate-700 space-y-0.5">
                                      <p className="font-extrabold text-yellow-800 text-[8px] uppercase tracking-wider">🚕 DETALLES TAXI</p>
                                      <p>Empresa: <span className="font-black text-slate-800 uppercase">{viaje.conductorVehiculo?.empresaTaxi || viaje.empresaTaxi || 'Empresa Local'}</span></p>
                                      <p>Nº Taxi: <span className="font-black text-slate-800">{viaje.conductorVehiculo?.numeroTaxi || viaje.numeroTaxi || 'N/A'}</span></p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${
                              viaje.estado === 'negociando' ? 'bg-amber-100 text-amber-700' : 
                              viaje.estado === 'aceptado' ? 'bg-emerald-100 text-emerald-700' : 
                              viaje.estado === 'en_camino' ? 'bg-blue-100 text-blue-700' :
                              viaje.estado === 'llegando' ? 'bg-amber-100 text-amber-700' :
                              viaje.estado === 'en_transito' ? 'bg-indigo-100 text-indigo-700' :
                              viaje.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
                               'bg-slate-100 text-slate-600'
                            }`}>
                              {viaje.estado === 'en_camino' ? 'Conductor en camino' :
                               viaje.estado === 'llegando' ? 'Conductor en el punto' :
                               viaje.estado === 'en_transito' ? 'En viaje' :
                               viaje.estado === 'cancelado' ? 'Cancelado' :
                               viaje.estado === 'negociando' ? 'Recibiendo ofertas' :
                               viaje.estado}
                            </span>
                          </div>
                          
                          {/* ETA Panel for Passenger */}
                          {(viaje.estado === 'aceptado' || viaje.estado === 'en_camino' || viaje.estado === 'llegando') && viaje.fecha_aceptacion && (
                            <div className="mt-4 mb-2">
                              <UserTripPanel 
                                trip={viaje}
                                startTime={viaje.fecha_aceptacion} 
                                promisedMinutes={viaje.tiempo_llegada || 5} 
                                driverLocation={viaje.conductorUbicacion || null}
                                destination={viaje.origenCoordenadas || viaje.origen || null}
                                onSendRating={async (tId, rating, comment) => {
                                  await calificarConductor(tId, viaje.conductorId, user!.uid, rating, comment);
                                }}
                              />
                            </div>
                          )}
                          
                          <div className="pt-2 border-t border-slate-50">
                            {viaje.estado === 'negociando' || viaje.estado === 'solicitado' ? (
                              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                                    <CreditCard size={16} />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-black text-slate-800 uppercase leading-none block mb-0.5">Tarifa Mínima</span>
                                    <p className="text-[8px] text-slate-400 font-medium leading-tight">Valor base sugerido</p>
                                  </div>
                                </div>
                                <span className="font-mono font-black text-emerald-700 leading-none">$5,000 COP</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Costo Total</p>
                                  <p className="text-sm font-mono font-bold text-slate-700">${viaje.valor.toLocaleString()}</p>
                                </div>
                                
                                {(viaje.saldo_promo_usuario > 0 || (perfil?.saldo_promo > 0 && !viaje.saldo_promo_usuario)) && (
                                  <div className="flex justify-between items-center mt-1">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                                      <ShieldCheck size={10} />
                                      Bono Promocional
                                    </p>
                                    <p className="text-[10px] font-mono font-bold text-emerald-600">
                                      -${Math.min(viaje.saldo_promo_usuario || perfil?.saldo_promo || 0, viaje.valor).toLocaleString()}
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-between items-center mt-2 p-2 bg-slate-50 rounded-xl">
                                  <div className="flex items-center gap-1.5">
                                    <CreditCard size={12} className="text-slate-500" />
                                    <span className="text-[10px] font-bold text-slate-800 uppercase">Pagar en Efectivo</span>
                                  </div>
                                  <p className="text-sm font-mono font-bold text-indigo-600">
                                    ${Math.max(0, viaje.valor - (viaje.saldo_promo_usuario || perfil?.saldo_promo || 0)).toLocaleString()}
                                  </p>
                                </div>

                                {/* Aviso sutil de tarifa acordada */}
                                <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-2.5 animate-pulse">
                                  <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-amber-700">Aviso de Tarifa Segura</p>
                                    <p className="text-[10px] text-slate-600 leading-normal font-medium">
                                      Por tu seguridad, <span className="font-bold text-slate-800">no pagues ni más ni menos</span> de la tarifa acordada de <span className="font-bold text-amber-700">${Math.max(0, viaje.valor - (viaje.saldo_promo_usuario || perfil?.saldo_promo || 0)).toLocaleString()} COP</span>, ya sea por transferencia virtual o efectivo. Si el conductor intenta cobrar un valor diferente, por favor <span className="font-bold text-slate-800">repórtalo en la calificación</span> del servicio al finalizar.
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}

                            {viaje.estado === 'cancelado' && (
                              <div className="mt-3 p-5 bg-red-50 border border-red-100 rounded-[2rem] shadow-xl shadow-red-100/20">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm shrink-0">
                                    <ShieldAlert size={20} />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Aviso de Cancelación</p>
                                    <p className="text-xs font-bold text-red-700 leading-tight">
                                      {viaje.canceladoPor === 'conductor' 
                                        ? 'El conductor ha cancelado este servicio. Por favor solicita uno nuevo.' 
                                        : 'Servicio cancelado exitosamente.'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => actualizarEstadoViaje(viaje.id, 'finalizado_cancelado')}
                                  className="w-full py-3.5 bg-red-600 text-white text-[10px] font-black rounded-xl hover:bg-red-700 transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-red-200"
                                >
                                  Cerrar Notificación
                                </button>
                              </div>
                            )}

                             <div className="flex flex-col gap-3 w-full mt-3">
                               {/* 1. MAPA DE SEGUIMIENTO EN TIEMPO REAL (SOLO HASTA LLEGAR / EN CAMINO) */}
                               {(viaje.estado === 'aceptado' || viaje.estado === 'en_camino' || viaje.estado === 'llegando') && (
                                 <div className="w-full space-y-3">
                                   {(() => {
                                     const { origen } = getTripRoutePoints(viaje);
                                     return (
                                       <RideTracker
                                         driverId={viaje.conductorId}
                                         driverName={viaje.conductorNombre}
                                         vehicleType={viaje.tipo || viaje.conductorVehiculo?.tipo}
                                         passengerPoint={origen}
                                         destinationPoint={null}
                                       />
                                     );
                                   })()}
                                   <div className="w-full h-auto rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-xs">
                                     <TripStatusAnimation 
                                       status={viaje.estado} 
                                       role="pasajero" 
                                     />
                                   </div>
                                 </div>
                               )}

                               {viaje.estado === 'en_transito' && (
                                 <div className="w-full space-y-3">
                                   <div className="p-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md border border-emerald-500/30 flex items-center gap-3">
                                     <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-lg font-bold shadow-inner">
                                       🚖
                                     </div>
                                     <div className="text-left min-w-0">
                                       <span className="text-[9px] font-black uppercase tracking-wider text-emerald-200 block">Servicio en Curso</span>
                                       <p className="text-xs font-bold text-white truncate">¡En trayecto! Tu conductor {viaje.conductorNombre || ''} te lleva al destino.</p>
                                     </div>
                                   </div>
                                   <div className="w-full h-auto rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-xs">
                                     <TripStatusAnimation 
                                       status={viaje.estado} 
                                       role="pasajero" 
                                     />
                                   </div>
                                 </div>
                               )}

                               {/* 2. TARJETA COMPACTA DE INFORMACIÓN Y CONTACTO DEL CONDUCTOR */}
                               {(viaje.estado === 'aceptado' || viaje.estado === 'en_camino' || viaje.estado === 'llegando' || viaje.estado === 'en_transito') && (
                                 <div className="bg-slate-50/80 border border-slate-200/80 p-3 sm:p-3.5 rounded-2xl space-y-2.5 shadow-2xs w-full text-left">
                                   <div className="flex justify-between items-center gap-2">
                                     <div className="flex items-center gap-2.5 min-w-0">
                                       <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0 font-bold">
                                         <Car size={16} />
                                       </div>
                                       <div className="min-w-0">
                                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">Conductor Asignado</p>
                                         <p className="text-xs font-black text-slate-900 truncate">{viaje.conductorNombre}</p>
                                       </div>
                                     </div>
                                     <div className="text-right shrink-0">
                                       <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-md uppercase font-mono">{viaje.conductorPlaca}</span>
                                       {viaje.conductorColor && <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{viaje.conductorColor}</p>}
                                     </div>
                                   </div>

                                   {(viaje.tipo === 'taxi' || viaje.conductorVehiculo?.tipo === 'taxi') && (
                                     <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl flex items-center justify-between text-[10px] text-amber-950 font-medium">
                                       <div className="flex items-center gap-1.5 font-bold truncate">
                                         <Taxi size={12} className="text-amber-600 shrink-0" />
                                         <span className="truncate">{viaje.conductorVehiculo?.empresaTaxi || viaje.empresaTaxi || 'Empresa Local'}</span>
                                       </div>
                                       <span className="bg-amber-200/80 text-amber-900 font-black px-2 py-0.5 rounded-md text-[9px] shrink-0">
                                         Taxi #{viaje.conductorVehiculo?.numeroTaxi || viaje.numeroTaxi || 'N/A'}
                                       </span>
                                     </div>
                                   )}

                                   {/* Botones de Contacto y Cancelar en Fila Única Compacta */}
                                   <div className="flex items-center gap-1.5 pt-0.5">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         const phone = cleanPhone(viaje.conductorTelefono);
                                         if (phone) {
                                           window.open(`https://wa.me/${phone}?text=Hola+${encodeURIComponent(viaje.conductorNombre)},+soy+tu+pasajero+de+Ruedas+Rápidas.+¿En+qué+punto+exacto+nos+vemos?`, '_blank');
                                         } else {
                                           toast.error("Número de WhatsApp no disponible");
                                         }
                                       }}
                                       className="flex-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-[0.98]"
                                     >
                                       <span className="relative flex h-1.5 w-1.5 shrink-0">
                                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                         <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                                       </span>
                                       <span>WHATSAPP</span>
                                     </button>

                                     <button 
                                       onClick={() => {
                                         setActiveChatViaje(viaje);
                                         setShowChat(true);
                                       }}
                                       className="flex-1 py-2 px-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black transition-all active:scale-[0.98] relative"
                                       title="Chat Interno con Conductor"
                                     >
                                       <MessageCircle size={14} />
                                       <span>CHAT</span>
                                       {unreadMessages[viaje.id] > 0 && (
                                         <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-md">
                                           {unreadMessages[viaje.id]}
                                         </span>
                                       )}
                                     </button>

                                     {confirmCancelIdUser === viaje.id ? (
                                       <div className="flex gap-1 shrink-0">
                                         <button 
                                           onClick={() => cancelarViaje(viaje.id)}
                                           className="bg-red-600 text-white text-[9px] font-black px-2.5 py-2 rounded-xl uppercase tracking-wider animate-pulse"
                                         >
                                           CONFIRMAR
                                         </button>
                                         <button 
                                           onClick={() => setConfirmCancelIdUser(null)}
                                           className="px-2 bg-slate-200 text-slate-700 text-[9px] font-bold py-2 rounded-xl"
                                         >
                                           NO
                                         </button>
                                       </div>
                                     ) : (
                                       <button 
                                         onClick={() => setConfirmCancelIdUser(viaje.id)}
                                         className="py-2 px-2.5 bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold rounded-xl border border-red-200 transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0"
                                         title="Cancelar Servicio"
                                       >
                                         <X size={14} />
                                         <span className="hidden sm:inline">CANCELAR</span>
                                       </button>
                                     )}
                                   </div>
                                 </div>
                               )}

                               {/* Para viajes que aún no tienen conductor asignado (solicitado/negociando) */}
                               {(viaje.estado === 'solicitado' || viaje.estado === 'negociando') && (
                                 <div className="flex justify-end">
                                   {confirmCancelIdUser === viaje.id ? (
                                     <div className="flex gap-2">
                                       <button 
                                         onClick={() => cancelarViaje(viaje.id)}
                                         className="bg-red-600 text-white text-[10px] font-black py-2 px-4 rounded-xl uppercase tracking-widest animate-pulse"
                                       >
                                         CONFIRMAR CANCELACIÓN
                                       </button>
                                       <button 
                                         onClick={() => setConfirmCancelIdUser(null)}
                                         className="px-4 bg-slate-100 text-slate-600 text-[10px] font-bold py-2 rounded-xl"
                                       >
                                         NO
                                       </button>
                                     </div>
                                   ) : (
                                     <button 
                                       onClick={() => setConfirmCancelIdUser(viaje.id)}
                                       className="px-4 bg-red-50 text-red-600 text-[10px] font-bold py-2 rounded-xl border border-red-100 hover:bg-red-100 transition-all active:scale-95 flex items-center gap-2"
                                     >
                                       <X size={14} />
                                       CANCELAR SOLICITUD
                                     </button>
                                   )}
                                 </div>
                               )}
                             </div>
                          </div>

                          {/* List of Offers */}
                          {(viaje.estado === 'solicitado' || viaje.estado === 'negociando') && viaje.ofertas && Object.keys(viaje.ofertas).length > 0 && (
                            <div className="mt-8 space-y-4">
                              <div className="flex items-center justify-between px-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ofertas Disponibles</p>
                                <span className="bg-indigo-100 text-indigo-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                  {Object.keys(viaje.ofertas).length} {Object.keys(viaje.ofertas).length === 1 ? 'Candidato' : 'Candidatos'}
                                </span>
                              </div>
                              
                              <div className="grid gap-4">
                                {Object.values(viaje.ofertas).map((oferta: any, oIdx: number) => (
                                  <motion.div 
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    key={oferta.conductorId || oferta.offerId || oferta.id || `oferta-${oIdx}`} 
                                    className="relative bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-xl shadow-slate-100/50 flex flex-col gap-4 overflow-hidden group hover:border-indigo-100 transition-all"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-lg shadow-inner">
                                          {(oferta.conductorNombre || "?").charAt(0)}
                                        </div>
                                        <div className="text-left">
                                          <p className="text-sm font-bold text-slate-800">{oferta.conductorNombre}</p>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <Star size={10} className="text-amber-500" fill="currentColor" />
                                            <span className="text-[10px] font-bold text-slate-500">
                                              {oferta.conductorCalificacion ? oferta.conductorCalificacion.toFixed(1) : "4.9"} Calificación
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 mt-1 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">
                                            <Clock size={10} className="text-indigo-600" />
                                            <span className="text-[9px] font-black text-indigo-600 uppercase">Llega en {oferta.tiempo_llegada || 5} min</span>
                                          </div>

                                          {oferta.vehiculo && ['camion_flete', 'camion_acarreo', 'motocarro'].includes(viaje.tipo) && (
                                            <div className="mt-3 text-left bg-orange-50/50 p-3 rounded-2xl border border-orange-100/50 space-y-1">
                                              <p className="text-[8px] font-black uppercase text-orange-700 tracking-wider">Especificaciones de Carga</p>
                                              <p className="text-[10px] text-slate-700 font-extrabold">
                                                {oferta.vehiculo.tipo === 'camion_flete' ? 'Camión Flete' : oferta.vehiculo.tipo === 'camion_acarreo' ? 'Camión Acarreo' : 'Moto Carro'} ({oferta.vehiculo.placa})
                                              </p>
                                              <div className="text-[9px] text-slate-500 space-y-0.5">
                                                <p>Capacidad: <span className="font-bold text-orange-950">{oferta.vehiculo.capacidad || 'N/A'}</span></p>
                                                <p>Volumen útil: <span className="font-bold text-orange-950">{oferta.vehiculo.volumen || 'N/A'}</span></p>
                                                <p>Dimensiones: <span className="font-bold text-orange-950">{oferta.vehiculo.dimensiones || 'N/A'}</span></p>
                                              </div>
                                            </div>
                                          )}

                                          {oferta.vehiculo && (viaje.tipo === 'taxi' || oferta.vehiculo.tipo === 'taxi') && (
                                            <div className="mt-3 text-left bg-yellow-50 p-3.5 rounded-2xl border border-yellow-200/60 space-y-1.5 shadow-xs">
                                              <p className="text-[8px] font-black uppercase text-yellow-800 tracking-wider flex items-center gap-1">
                                                <Taxi size={10} />
                                                🚕 Información de Taxi Cooperado
                                              </p>
                                              <div className="text-[10px] text-slate-700 space-y-0.5 font-medium">
                                                <p>Empresa: <strong className="text-slate-950 uppercase">{oferta.vehiculo.empresaTaxi || 'Empresa Local'}</strong></p>
                                                <p>Número Taxi: <strong className="text-slate-950">{oferta.vehiculo.numeroTaxi || 'N/A'}</strong></p>
                                                <p>Placa: <span className="font-mono font-bold text-indigo-600 bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">{oferta.vehiculo.placa || 'N/A'}</span></p>
                                                <p>Modelo / Color: <strong className="text-slate-750">{oferta.vehiculo.modelo || 'N/A'} • {oferta.vehiculo.color || 'Amarillo'}</strong></p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Valor Total</p>
                                        <p className="text-xl font-mono font-bold text-slate-900 leading-none">${oferta.valor.toLocaleString()}</p>
                                      </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center border border-slate-100">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <CreditCard size={12} className="text-slate-400" />
                                          <span className="text-[10px] font-bold text-slate-500 uppercase">Pagas en Efectivo</span>
                                        </div>
                                        <p className="text-sm font-mono font-bold text-indigo-600">
                                          ${Math.max(0, oferta.valor - (viaje.saldo_promo_usuario || 0)).toLocaleString()}
                                        </p>
                                      </div>
                                      
                                      <button 
                                        onClick={() => handleServiceCall(() => seleccionarOferta(viaje.id, oferta), "Viaje aceptado")}
                                        className="bg-indigo-600 text-white text-[10px] font-black px-6 py-3 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest"
                                      >
                                        Aceptar
                                      </button>
                                    </div>

                                    {viaje.saldo_promo_usuario > 0 && (
                                      <div className="flex items-center gap-1 px-1">
                                        <ShieldCheck size={10} className="text-emerald-500" />
                                        <p className="text-[9px] text-emerald-600 font-bold italic">Bono aplicado: -${Math.min(viaje.saldo_promo_usuario, oferta.valor).toLocaleString()}</p>
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Welcome Message for User */}
                  {perfil?.saldo_promo > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg border border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-emerald-400 tracking-wide uppercase flex items-center gap-2">
                          ¡Bono Disponible! ✨
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                          Tienes un saldo que se descuenta <span className="text-emerald-400 font-bold">virtualmente</span> de tus viajes. 
                          El conductor recibirá este valor en su cuenta y tú solo pagas el excedente en efectivo.
                        </p>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-center min-w-[90px]">
                        <p className="text-[8px] uppercase font-bold text-emerald-500/70 leading-none mb-1">Tu Regalo</p>
                        <p className="text-sm font-mono font-bold text-emerald-400 leading-none">${(perfil?.saldo_promo || 0).toLocaleString()}</p>
                      </div>
                    </motion.div>
                  )}


                  {/* Mis Reservas Expreso */}
                  {misReservasExpreso.length > 0 && (
                    <div className="space-y-4 mb-8">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={12} className="text-indigo-500" />
                          <span>Mis Reservas Expreso</span>
                        </div>
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[9px]">{misReservasExpreso.length}</span>
                      </h3>
                      <div className="space-y-4">
                        {misReservasExpreso.map(viaje => (
                          <motion.div
                            key={`reserva-${viaje.id}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group overflow-hidden relative"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-100/30 transition-colors" />
                            
                            <div className="flex justify-between items-start relative z-10">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                                  <Car size={24} />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                     <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{viaje.origen} - {viaje.destino}</span>
                                     <p className="text-[10px] font-bold text-slate-400">{new Date(viaje.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                  <p className="text-lg font-black text-slate-900 tracking-tight">{viaje.conductorNombre || 'Conductor'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Cupos</p>
                                <p className="text-xl font-black text-indigo-600">{viaje.pasajeros[user.uid].cupos}</p>
                              </div>
                            </div>
                            
                            {viaje.ruta && (
                              <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50 space-y-1 relative z-10 my-3">
                                <p className="text-[8px] font-black text-indigo-700 uppercase flex items-center gap-1">
                                  <Navigation size={8} />
                                  Recorrido Planificado
                                </p>
                                <p className="text-[10px] text-slate-600 font-medium italic line-clamp-1">"{viaje.ruta}"</p>
                              </div>
                            )}

                            <div className="flex justify-between items-center relative z-10 pt-2 gap-3">
                              <div className="flex-1 space-y-0.5">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Total a pagar</p>
                                <p className="text-base font-black text-slate-900">${viaje.pasajeros[user.uid].valorTotal.toLocaleString()} COP</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWhatsAppContact(
                                      viaje.conductorTelefono,
                                      viaje.conductorNombre,
                                      `Hola ${viaje.conductorNombre}, reservé ${viaje.pasajeros[user.uid].cupos} cupo(s) para el viaje de las ${new Date(viaje.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ¿En qué punto exacto nos vemos?`
                                    );
                                  }}
                                  className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                                  title="Contactar Conductor"
                                >
                                  <MessageCircle size={20} />
                                </button>
                                <button
                                  onClick={() => handleCancelarReservaExpreso(viaje)}
                                  disabled={isCancellingExpresoReserva === viaje.id}
                                  className={`px-6 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    isCancellingExpresoReserva === viaje.id
                                      ? 'bg-slate-100 text-slate-400'
                                      : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white active:scale-95'
                                  }`}
                                >
                                  {isCancellingExpresoReserva === viaje.id ? 'CANCELANDO...' : 'CANCELAR'}
                                </button>
                              </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[8px] font-black uppercase tracking-tight text-slate-400">
                               <div className="flex items-center gap-1 text-slate-500">
                                 <MapPin size={10} className="text-indigo-400" />
                                 <span>Punto: {viaje.puntoEncuentro}</span>
                               </div>
                               <span className="text-indigo-400 opacity-50">#EXP-{viaje.id.slice(-4)}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mensaje de Guía Intuitiva - Marcas Aliadas */}
                  <AnimatePresence>
                    {showAlianzasBanner && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, scale: 0.96, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1, marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, scale: 0.96, marginBottom: 0 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full relative overflow-hidden"
                      >
                        <div className="bg-gradient-to-r from-rose-50/70 via-white to-rose-100/30 border border-rose-100 p-4 sm:p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/15 rounded-full blur-2xl pointer-events-none"></div>
                          <div className="flex items-center gap-3.5 w-full md:w-auto">
                            <div className="p-3 bg-rose-500 rounded-2xl text-white shadow-md shadow-rose-200 shrink-0 flex items-center justify-center">
                              <Store size={20} className="animate-pulse" />
                            </div>
                            <div className="overflow-hidden min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] uppercase font-black text-rose-600 tracking-widest">Alianzas de Comercio</span>
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>
                                
                                {/* Subtle Info trigger for commerce network goals */}
                                <motion.button
                                  type="button"
                                  onClick={() => setShowNetworkGoals(true)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="ml-1.5 px-2 py-0.5 bg-rose-100/80 hover:bg-rose-200 text-rose-700 rounded-full flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
                                  title="Objetivos de la Red"
                                >
                                  <Info size={9} />
                                  <span>Objetivos</span>
                                </motion.button>
                              </div>
                              
                              <div className="mt-1">
                                <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight leading-tight">
                                  ¡Registra tu negocio y vende más con nosotros!
                                </h4>
                                <AnimatePresence mode="wait">
                                  <motion.p
                                    key={guidePhraseIdx}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.25 }}
                                    className="text-[11px] text-slate-500 font-bold mt-1 truncate max-w-full md:max-w-xs lg:max-w-md"
                                  >
                                    {guidePhrases[guidePhraseIdx]}
                                  </motion.p>
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2.5 w-full md:w-auto justify-center md:justify-end shrink-0">
                            <motion.button 
                              onClick={openMyBrandManager}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[10.5px] font-black uppercase px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 md:flex-none"
                            >
                              <PlusCircle size={13} className="text-rose-500 animate-pulse shrink-0" />
                              <span>{user && marcasAliadas.some(m => m.creadorId === user.uid) ? "⚡ Mi Comercio & Oferta" : "Unirme Gratis"}</span>
                            </motion.button>
                            
                            <motion.button 
                              onClick={() => openTripRequest('marcas_aliadas')}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black uppercase px-4.5 py-2.5 rounded-xl shadow-sm shadow-rose-200 transition-all cursor-pointer text-center flex-1 md:flex-none"
                            >
                              Explorar
                            </motion.button>
                          </div>

                          {/* Popover con objetivos de la red de comercio local */}
                          <AnimatePresence>
                            {showNetworkGoals && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 5 }}
                                className="absolute inset-0 bg-white/98 backdrop-blur-md p-3 px-4 flex flex-col justify-between z-30 border border-rose-100 rounded-2xl overflow-y-auto"
                              >
                                <div className="flex-1 flex flex-col justify-between">
                                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-rose-50">
                                    <div className="flex items-center gap-1.5">
                                      <span className="p-1 bg-rose-50 rounded-lg text-rose-600">
                                        <Info size={11} className="animate-pulse" />
                                      </span>
                                      <h4 className="text-[9px] uppercase font-black text-rose-700 tracking-wider">Objetivos de la Red de Comercio Local</h4>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setShowNetworkGoals(false)}
                                      className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-600 font-bold flex-1 items-center">
                                    <div className="flex items-start gap-1.5 p-1.5 bg-rose-50/10 rounded-xl border border-rose-100/25">
                                      <span className="text-rose-500">🌱</span>
                                      <div>
                                        <p className="text-slate-800 uppercase text-[8px] font-black leading-none mb-0.5">0% Comisiones</p>
                                        <p className="font-semibold text-slate-500 leading-tight">Sin tarifas abusivas para comercios locales.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-1.5 p-1.5 bg-rose-50/10 rounded-xl border border-rose-100/25">
                                      <span className="text-rose-500">🤝</span>
                                      <div>
                                        <p className="text-slate-800 uppercase text-[8px] font-black leading-none mb-0.5">Apoyo Mutuo</p>
                                        <p className="font-semibold text-slate-500 leading-tight">Fortalecemos la economía local de Arauca.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-1.5 p-1.5 bg-rose-50/10 rounded-xl border border-rose-100/25">
                                      <span className="text-rose-500">⚡</span>
                                      <div>
                                        <p className="text-slate-800 uppercase text-[8px] font-black leading-none mb-0.5">Envíos Directos</p>
                                        <p className="font-semibold text-slate-500 leading-tight">Conexión directa vía WhatsApp sin trabas.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-1.5 p-1.5 bg-rose-50/10 rounded-xl border border-rose-100/25">
                                      <span className="text-rose-500">🚀</span>
                                      <div>
                                        <p className="text-slate-800 uppercase text-[8px] font-black leading-none mb-0.5">Más Oportunidad</p>
                                        <p className="font-semibold text-slate-500 leading-tight">Impulsamos el trabajo de conductores locales.</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                    <button 
                      onClick={() => openTripRequest('carro')}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all group cursor-pointer text-center"
                    >
                      <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                        <Car className="text-emerald-600" size={24} />
                      </div>
                      <span className="text-xs font-medium">Carro</span>
                    </button>
                    <button 
                      onClick={() => openTripRequest('taxi')}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-yellow-100 shadow-sm hover:border-yellow-400 shadow-yellow-500/5 transition-all group cursor-pointer text-center"
                    >
                      <div className="p-3 bg-yellow-100 rounded-xl group-hover:bg-yellow-200 transition-colors">
                        <Taxi className="text-yellow-600" size={24} />
                      </div>
                      <span className="text-xs font-medium">Taxi</span>
                    </button>
                    <button 
                      onClick={() => openTripRequest('moto')}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all group cursor-pointer text-center"
                    >
                      <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                        <Bike className="text-emerald-600" size={24} />
                      </div>
                      <span className="text-xs font-medium">Moto</span>
                    </button>
                    <button 
                      onClick={() => openTripRequest('domicilio')}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all group cursor-pointer text-center"
                    >
                      <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                        <Package className="text-emerald-600" size={24} />
                      </div>
                      <span className="text-xs font-medium">Domicilio</span>
                    </button>
                    {/* Servicio de Carga Integrado */}
                    <button 
                      onClick={() => setShowCargoSelector(true)}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 transition-all group cursor-pointer text-center"
                    >
                      <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                        <Truck className="text-orange-600" size={24} />
                      </div>
                      <span className="text-xs font-medium text-slate-800">Carga</span>
                    </button>
                    {/* Expreso Intermunicipal */}
                    <button 
                      onClick={() => setShowExpresoBookingModal(true)}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group cursor-pointer text-center"
                    >
                      <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                        <Zap className="text-indigo-600 animate-pulse" size={24} />
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-black block text-slate-900">Expreso</span>
                        <span className="text-[8px] font-black uppercase tracking-wider text-indigo-600 block -mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded-md mt-1">Intermunicipal</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => openTripRequest('marcas_aliadas')}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-rose-100 shadow-sm shadow-rose-500/5 hover:border-rose-300 hover:shadow-md transition-all group cursor-pointer text-center relative overflow-hidden"
                    >
                      <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <div className="p-3 bg-rose-50 rounded-xl group-hover:bg-rose-100 transition-colors">
                        <Store className="text-rose-600 animate-pulse" size={24} />
                      </div>
                      <span className="text-xs font-bold text-rose-800">Marcas Aliadas</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'conductor' && conductor && (
                <motion.section 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {(conductor.aprobado === false || conductor.status === 'pending' || (perfil && perfil.status === 'pending' && (perfil.rol === 'conductor' || perfil.role === 'conductor'))) ? (
                    <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem] text-center space-y-6 shadow-xl shadow-amber-100/30">
                      <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center text-amber-600 mx-auto shadow-inner relative">
                        <FileText size={40} className="animate-pulse" />
                        <Clock size={20} className="absolute bottom-0 right-0 text-amber-700 bg-white rounded-lg p-0.5 border border-amber-200" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-amber-900 uppercase tracking-tight">VERIFICACIÓN DE DOCUMENTOS</h3>
                        <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                          ¡Gracias por registrarte como conductor! Tu cuenta se encuentra en proceso de validación.
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                          Un administrador revisará tu licencia, SOAT y cédula de identidad a la brevedad. Una vez aprobados los documentos, se habilitarán todas las funciones para que puedas comenzar a realizar viajes y recibir alertas.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-amber-100 flex flex-col gap-2 items-center">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Soporte y Atención rápida</p>
                        <div className="flex gap-2 flex-wrap justify-center">
                          <button 
                            onClick={() => {
                              setActiveSupportConductor({ id: user.uid, nombre: conductor.nombre });
                              setShowSupportChat(true);
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Headphones size={12} />
                            Chatear con Soporte
                          </button>
                          <button 
                            onClick={() => {
                              const phone = cleanPhone(conductor.telefono || conductor.celular);
                              if (phone) {
                                window.open(`https://wa.me/${phone}?text=Hola+administrador,+ya+registré+mi+perfil+de+conductor+con+nombre+${encodeURIComponent(conductor.nombre || '')}.+¿Podrían+por+favor+verificar+mis+documentos?`, '_blank');
                              } else {
                                window.open(`https://wa.me/573000000000?text=Hola+administrador,+ya+registré+mi+perfil+de+conductor+con+nombre+${encodeURIComponent(conductor.nombre || '')}.+¿Podrían+por+favor+verificar+mis+documentos?`, '_blank');
                              }
                            }}
                            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                          >
                            <MessageCircle size={12} className="text-emerald-500" />
                            Contactar por WhatsApp
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : conductor.bloqueado ? (
                    <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] text-center space-y-6 shadow-xl shadow-rose-100/30">
                      <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto shadow-inner">
                        <Lock size={40} className="animate-bounce" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-rose-900 uppercase tracking-tight">ACCESO RESTRINGIDO</h3>
                        <p className="text-xs text-rose-600 font-semibold leading-relaxed">
                          {conductor.bloqueo_tipo === 'temporal' 
                            ? 'Has recibido una sanción temporal de acceso a la plataforma por parte de la administración.'
                            : 'Tu perfil de conductor ha sido bloqueado de forma permanente por la administración. No puedes recibir solicitudes ni realizar viajes.'}
                        </p>
                      </div>

                      {conductor.bloqueo_tipo === 'temporal' && conductor.bloqueado_hasta && (
                        <DriverBlockCountdown 
                          desde={conductor.bloqueado_desde || new Date().toISOString()} 
                          hasta={conductor.bloqueado_hasta}
                          onComplete={async () => {
                            try {
                              await toggleBloqueoConductor(user.uid, false);
                              toast.success("¡Tu período de sanción ha finalizado! Cuenta desbloqueada automáticamente.", {
                                duration: 6000,
                                icon: '🔓'
                              });
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        />
                      )}

                      <div className="pt-4 border-t border-rose-100 flex flex-col gap-2 items-center">
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Soporte y Reclamaciones</p>
                        <button 
                          onClick={() => {
                            setActiveSupportConductor({ id: user.uid, nombre: conductor.nombre });
                            setShowSupportChat(true);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer animate-fadeIn"
                        >
                          <Headphones size={12} />
                          Abrir Chat de Soporte
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Header con Nombre */}
                      <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 leading-tight">{conductor.nombre}</h4>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Conductor Verificado</p>
                          <button 
                            onClick={() => {
                              setActiveSupportConductor({ id: user.uid, nombre: conductor.nombre });
                              setShowSupportChat(true);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[8px] font-bold uppercase tracking-tighter hover:bg-blue-100 transition-all relative"
                          >
                            <Headphones size={10} />
                            Soporte
                            {hasUnreadSupport && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 border border-white rounded-full animate-pulse" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <button 
                          onClick={() => toggleEstadoConductor(user.uid, !conductor.activo)}
                          className={`w-12 h-6 rounded-full relative transition-all duration-500 ${conductor.activo ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-slate-200'}`}
                        >
                          <motion.div 
                            animate={{ x: conductor.activo ? 24 : 4 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                          />
                        </button>
                        <span className="text-[8px] mt-1 font-bold text-slate-400 uppercase">En Línea</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button 
                          onClick={() => toggleModoRepartidor(user.uid, !conductor.modo_repartidor)}
                          className={`w-12 h-6 rounded-full relative transition-all duration-500 ${conductor.modo_repartidor ? 'bg-blue-500 shadow-lg shadow-blue-200' : 'bg-slate-200'}`}
                        >
                          <motion.div 
                            animate={{ x: conductor.modo_repartidor ? 24 : 4 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                          />
                        </button>
                        <span className="text-[8px] mt-1 font-bold text-slate-400 uppercase">Repartidor</span>
                      </div>
                    </div>
                  </div>

                  {/* Alerta de Saldo Crítico */}
                  {(conductor.tarjeta_virtual || 0) < 2000 && (
                    <motion.div 
                      key="critical-balance-alert"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ type: "spring", duration: 0.6 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gradient-to-r from-rose-500 to-rose-600 rounded-[2.5rem] p-6 shadow-xl shadow-rose-100 border border-rose-400/20 relative overflow-hidden group mb-4">
                        <motion.div 
                          animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.2, 0.1]
                          }}
                          transition={{ duration: 4, repeat: Infinity }}
                          className="absolute -right-4 -top-4 w-32 h-32 bg-white rounded-full blur-3xl" 
                        />
                        
                        <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
                          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center animate-pulse shrink-0 shadow-inner">
                            <AlertTriangle className="text-white" size={32} />
                          </div>
                          <div className="flex-1 text-center sm:text-left">
                            <h4 className="text-white font-black text-lg uppercase tracking-tight mb-1">Recarga Urgente Requerida</h4>
                            <p className="text-rose-50 text-xs font-medium leading-relaxed opacity-90">
                              Tu saldo es de <span className="font-black bg-white/20 px-1.5 py-0.5 rounded text-white">${(conductor.tarjeta_virtual || 0).toLocaleString()}</span>. 
                              Has sido suspendido temporalmente de recibir notificaciones de servicios hasta realizar una recarga mínima de saldo.
                            </p>
                          </div>
                          <button 
                            onClick={() => setShowRechargeModal(true)}
                            className="w-full sm:w-auto bg-white text-rose-600 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Zap size={16} />
                            Recargar Ahora
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Alerta de GPS Desactivado/Denegado para Conductor */}
                  {(driverGpsDenied || !driverGpsLocation) && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-500/10 border-2 border-amber-400/80 p-5 rounded-[2.5rem] text-amber-900 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 mb-6"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
                          📍
                        </div>
                        <div>
                          <h4 className="font-extrabold text-amber-950 text-xs sm:text-sm uppercase tracking-wide">Activa tu ubicación para ver servicios cercanos</h4>
                          <p className="text-[11px] text-amber-800 font-medium leading-snug mt-0.5">
                            Tu GPS es indispensable para calcular distancias, tiempos de llegada y trazar la ruta en el mapa hacia los pasajeros.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestDriverGpsLocation()}
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shrink-0 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Navigation size={15} /> Activar GPS Ahora
                      </button>
                    </motion.div>
                  )}

                  {/* Alerta de Abandono Pendiente para Conductores */}
                  {driverAbandonmentTrips.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-500 p-6 rounded-[3rem] text-white shadow-2xl shadow-rose-200 border-2 border-rose-400 relative overflow-hidden mb-6"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4">
                        <AlertTriangle size={120} />
                      </div>
                      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[2rem] flex items-center justify-center border border-white/30 shadow-2xl shadow-rose-900/20 shrink-0">
                          <AlertTriangle size={40} className="text-white animate-bounce" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                            <span className="px-3 py-1 bg-rose-700/50 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-400/30">Alerta: Ciudad en Espera</span>
                            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                          </div>
                          <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Abandono Pendiente</h3>
                          <p className="text-xs text-rose-100 font-bold uppercase tracking-tighter opacity-90 max-w-md">
                            Hay {driverAbandonmentTrips.length} {driverAbandonmentTrips.length === 1 ? 'servicio esperando' : 'servicios esperando'} hace más de 6 minutos. ¡Suma tu esfuerzo y presta un servicio eficiente!
                          </p>
                        </div>
                        <div className="shrink-0 w-full md:w-auto">
                          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/20 text-center">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1">Impacto de hoy</p>
                            <p className="text-2xl font-mono font-black text-yellow-400">+{driverAbandonmentTrips.length}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center gap-3">
                         <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: "100%" }}
                              animate={{ width: "0%" }}
                              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                              className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.6)]"
                            />
                         </div>
                         <p className="text-[8px] font-black uppercase tracking-widest text-white/60">Atención Inmediata</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Expreso Action for Drivers */}
                  {conductor.vehiculo?.tipo === 'carro' && (
                    <div className="p-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm space-y-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Zap size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase">Viajes Expresos</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fusa - Bogotá compartido</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${conductor.expreso_activo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                             {conductor.expreso_activo ? 'Recibiendo reservaciones' : 'Offline'}
                           </span>
                        </div>
                      </div>

                      {!conductor.expreso_habilitado ? (
                        <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex flex-col items-center gap-2 text-center">
                          <Shield size={32} className="text-amber-500 mb-1" />
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight leading-relaxed">
                            Este servicio requiere autorización previa del administrador. <br/>Solicítalo a través de soporte técnico.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                           <button 
                             onClick={() => updateDoc(doc(db, 'conductores', user?.uid), { expreso_activo: !conductor.expreso_activo })}
                             className={`h-14 rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${
                               conductor.expreso_activo ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-400'
                             }`}
                           >
                             {conductor.expreso_activo ? (
                               <>
                                 <XCircle size={16} />
                                 DESACTIVAR
                               </>
                             ) : (
                               <>
                                 <Power size={16} />
                                 ACTIVAR
                               </>
                             )}
                           </button>
                           <button 
                             onClick={() => setShowExpresoModal(true)}
                             disabled={!conductor.expreso_activo}
                             className={`h-14 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                               !conductor.expreso_activo 
                               ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                               : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1'
                             }`}
                           >
                             <PlusCircle size={16} />
                             PUBLICAR
                           </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tarjeta Virtual Espectacular */}
                  <motion.div 
                    whileHover={{ y: -5 }}
                    className="relative h-52 w-full rounded-[2rem] overflow-hidden shadow-2xl shadow-emerald-900/20 group"
                  >
                    {/* Fondo con Gradiente Animado */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900" />
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    
                    {/* Elementos Decorativos de la Tarjeta */}
                    <div className="absolute top-8 left-8 w-12 h-10 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-lg opacity-80 shadow-inner" /> {/* Chip */}
                    <div className="absolute top-8 right-8">
                      <ShieldCheck className="text-emerald-400/50" size={40} />
                    </div>

                    {/* Información de la Tarjeta */}
                    <div className="absolute inset-0 p-8 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-[0.2em]">Tarjeta Virtual Ruedas</p>
                          <h5 className="text-xl font-mono tracking-[0.3em] text-white/90">**** **** **** {user.uid.slice(-4).toUpperCase()}</h5>
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Saldo Disponible</p>
                          <div className="flex items-center gap-3">
                            <p className="text-3xl font-bold text-white tracking-tight">
                              <span className="text-emerald-400 mr-1">$</span>
                              {(conductor.tarjeta_virtual || 0).toLocaleString()}
                            </p>
                            {hasPendingRecharge && (
                              <motion.div 
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30"
                              >
                                <Clock size={10} className="text-amber-400" />
                                <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter">Pendiente</span>
                              </motion.div>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowRechargeModal(true)}
                          className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-4 py-2 rounded-2xl flex items-center gap-2 transition-all border border-white/10"
                        >
                          <PlusCircle size={14} className="text-emerald-400" />
                          RECARGAR
                        </button>
                      </div>
                    </div>

                    {/* Efecto de Brillo */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  </motion.div>

                  {/* Estado y Tabs */}
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className={`px-4 py-1.5 rounded-2xl text-[10px] font-bold uppercase flex items-center gap-2 ${conductor.activo ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${conductor.activo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {conductor.activo ? 'Recibiendo Servicios' : 'Desconectado'}
                      </div>
                      {conductor.modo_repartidor && (
                        <div className="px-4 py-1.5 rounded-2xl text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center gap-2">
                          <Package size={12} />
                          Repartidor Activo
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 p-1 rounded-2xl flex gap-1 border border-slate-200">
                      <button 
                        onClick={() => setDriverSubTab('viajes')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${driverSubTab === 'viajes' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Viajes
                      </button>
                      <button 
                        onClick={() => setDriverSubTab('perfil')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${driverSubTab === 'perfil' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Perfil
                      </button>
                    </div>
                  </div>

                   {driverSubTab === 'viajes' ? (
                    <div className="space-y-6">
                      {/* Real-time incoming trip notification banner with live map & route preview (Solo para la ciudad del conductor) */}
                      {latestTripAlert && (!conductor?.ciudad || normalizeStrForCity(latestTripAlert.ciudad) === normalizeStrForCity(conductor.ciudad)) && (
                        <motion.div
                          initial={{ opacity: 0, y: -20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.95 }}
                          className="bg-slate-900 text-white p-5 sm:p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden space-y-4"
                        >
                          {/* Ambient glow background */}
                          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
                          
                          {/* Header banner */}
                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                              </span>
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] animate-pulse">
                                ¡Nuevo Servicio para Tu Vehículo!
                              </p>
                            </div>
                            <button 
                              onClick={() => setLatestTripAlert(null)}
                              className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer text-xs font-black"
                              title="Cerrar notificación"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Vehicle Match Badge & Customer Info */}
                          <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl relative z-10">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 bg-emerald-500 text-white rounded-xl font-black flex items-center justify-center text-base">
                                {latestTripAlert.tipo === 'moto' ? '🏍️' : ['camion_flete', 'camion_acarreo', 'motocarro'].includes(latestTripAlert.tipo) ? '🚚' : latestTripAlert.tipo === 'taxi' ? '🚕' : '🚗'}
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Cliente Solicitante</span>
                                <p className="text-xs font-black text-white uppercase">{latestTripAlert.usuarioNombre || 'Cliente'}</p>
                              </div>
                            </div>

                            <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-xl uppercase tracking-wider">
                              ✓ {latestTripAlert.tipo?.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Live Interactive Map Preview inside Notification Alert */}
                          {(() => {
                            const { origen, driverPos, pickupDistanceKm, pickupMins } = getTripRoutePoints(latestTripAlert, driverGpsLocation);
                            return (
                              <div className="space-y-2 relative z-10">
                                {/* Route Distance & Time Indicators to Pickup Point */}
                                <div className="bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-2.5 rounded-2xl text-emerald-300 flex items-center justify-between text-xs font-black">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                                    <span>📍 Llegada a Recoger Pasajero:</span>
                                  </div>
                                  <span className="text-white font-mono bg-emerald-500/30 border border-emerald-400/30 px-2.5 py-1 rounded-xl text-xs">
                                    {pickupDistanceKm} KM <span className="text-emerald-300 text-[11px] font-sans">(~{pickupMins} min)</span>
                                  </span>
                                </div>

                                <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-slate-950">
                                  <MapComponent
                                    origen={origen}
                                    destino={null}
                                    driverPos={driverPos}
                                    driverName={conductor?.nombre || 'Tu Vehículo'}
                                    vehicleType={conductor?.vehiculo?.tipo || latestTripAlert.tipo}
                                    showRoute={true}
                                    mode="view"
                                    className="w-full h-[190px] relative"
                                  />
                                  <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-white/10 text-[10px] text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                                    <span className="font-extrabold text-emerald-300 shrink-0">Punto de Recogida:</span>
                                    <span className="truncate font-medium text-slate-100">{latestTripAlert.ruta?.origen}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Suggested offer & Action button */}
                          <div className="flex items-center justify-between gap-4 pt-1 relative z-10">
                            <div>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Valor Solicitado</p>
                              <p className="text-xl font-black text-emerald-400">${latestTripAlert.valor ? latestTripAlert.valor.toLocaleString() : '0'} COP</p>
                            </div>
                            
                            <button 
                              onClick={() => {
                                if (perfil && !perfil.terminos_aceptados) {
                                  setShowTermsModal(true);
                                  return;
                                }
                                handleContraoferta(latestTripAlert);
                                setLatestTripAlert(null);
                              }}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-6 py-3 rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-wider cursor-pointer animate-pulse flex items-center gap-2"
                            >
                              <span>🗺️ VER MAPA Y OFERTAR</span>
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* Mis Viajes Activos */}
                      {misViajesConductor.length > 0 && (
                        <div className="space-y-4">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Mis Viajes en Curso</h5>
                          {misViajesConductor.map(viaje => (
                            <motion.div 
                              layout
                              key={viaje.id}
                              className="bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100 shadow-sm space-y-4"
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                  <div className="space-y-1.5 mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <p className="text-[11px] font-bold text-slate-700 truncate">{viaje.ruta.origen}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                      <p className="text-[11px] font-bold text-slate-900 truncate">{viaje.ruta.destino}</p>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{viaje.estado.replace('_', ' ')}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Servicio</p>
                                  <p className="text-sm font-mono font-bold text-slate-700">${viaje.valor.toLocaleString()}</p>
                                </div>
                              </div>

                              <div className="p-3 bg-white rounded-2xl border border-emerald-100/50 space-y-2">
                                <div className="flex justify-between items-center">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <CreditCard size={10} />
                                    Cobro en Efectivo
                                  </p>
                                  <p className="text-sm font-mono font-bold text-emerald-700">
                                    ${Math.max(0, viaje.valor - (viaje.saldo_promo_usuario || 0)).toLocaleString()}
                                  </p>
                                </div>

                                {(viaje.saldo_promo_usuario > 0) && (
                                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                                      <ShieldCheck size={10} />
                                      Abono Virtual (Bono)
                                    </p>
                                    <p className="text-[10px] font-mono font-bold text-emerald-600">
                                      +${Math.min(viaje.saldo_promo_usuario, viaje.valor).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-4">
                                {(viaje.estado === 'aceptado' || viaje.estado === 'en_camino' || viaje.estado === 'llegando') && viaje.fecha_aceptacion && (
                                  <DriverTripPanel 
                                    startTime={viaje.fecha_aceptacion} 
                                    promisedMinutes={viaje.tiempo_llegada || 5} 
                                    driverLocation={driverGpsLocation || null}
                                    destination={viaje.origenCoordenadas || viaje.origen || null}
                                  />
                                )}

                                {/* Mapa activo solo mientras va en camino al punto de recogida. Cuando se inicia el viaje (en_transito), el mapa desaparece. */}
                                 {(viaje.estado === 'aceptado' || viaje.estado === 'en_camino' || viaje.estado === 'llegando') ? (
                                   <div className="w-full space-y-4">
                                     {(() => {
                                       const { origen } = getTripRoutePoints(viaje, driverGpsLocation);
                                       return (
                                         <DriverLiveMap 
                                           driverId={user.uid} 
                                           driverName={conductor.nombre} 
                                           isOnline={conductor.activo} 
                                           origen={origen}
                                           destino={null}
                                           showRoute={true}
                                         />
                                       );
                                     })()}
                                     <div className="w-full h-auto rounded-[2rem] overflow-hidden border border-emerald-100 shadow-sm">
                                       <TripStatusAnimation 
                                         status={viaje.estado} 
                                         role="conductor" 
                                       />
                                     </div>
                                   </div>
                                 ) : viaje.estado === 'en_transito' ? (
                                   <div className="w-full space-y-3">
                                     <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 shadow-xs">
                                       <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shrink-0 text-lg shadow-sm">
                                         🚖
                                       </div>
                                       <div>
                                         <p className="text-xs font-black uppercase tracking-wider text-emerald-950">¡Servicio en Transcurso!</p>
                                         <p className="text-[11px] text-emerald-700 font-medium leading-tight mt-0.5">Te encuentras en trayecto con el pasajero hacia el destino. Dirígete con precaución.</p>
                                       </div>
                                     </div>
                                     <div className="w-full h-auto rounded-[2rem] overflow-hidden border border-emerald-100 shadow-sm">
                                       <TripStatusAnimation 
                                         status={viaje.estado} 
                                         role="conductor" 
                                       />
                                     </div>
                                   </div>
                                 ) : null}
                                
                                <div className="flex flex-col gap-2.5 w-full">
                                  {(viaje.estado === 'aceptado' || viaje.estado === 'en_camino' || viaje.estado === 'llegando' || viaje.estado === 'en_transito') && (
                                    <div className="flex flex-col gap-2.5 w-full">
                                      {/* Prominent High-Impact WhatsApp Alert Banner for Driver */}
                                      <div className="bg-emerald-50 border border-emerald-100/60 p-4 rounded-3xl space-y-2.5 shadow-xs">
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                                              <Users size={16} />
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest leading-none block mb-1">Pasajero</p>
                                              <p className="text-xs font-bold text-slate-800 leading-tight">{viaje.usuarioNombre}</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg uppercase tracking-wider">Servicio Activo</span>
                                          </div>
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const phone = cleanPhone(viaje.usuarioTelefono);
                                            if (phone) {
                                              window.open(`https://wa.me/${phone}?text=Hola+${encodeURIComponent(viaje.usuarioNombre)},+soy+tu+conductor+de+Ruedas+Rápidas.+Ya+estoy+atendiendo+tu+servicio.`, '_blank');
                                            } else {
                                              toast.error("Número de WhatsApp no disponible");
                                            }
                                          }}
                                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200 active:scale-[0.98]"
                                        >
                                          <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                          </span>
                                          📱 HABLAR POR WHATSAPP CON PASAJERO
                                        </button>
                                      </div>

                                      {/* Fallback & Other contact options */}
                                      <div className="flex gap-2 w-full">
                                        <button 
                                          onClick={() => {
                                            setActiveChatViaje(viaje);
                                            setShowChat(true);
                                          }}
                                          className="flex-1 py-3 bg-slate-50 text-indigo-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all active:scale-[0.98] relative overflow-visible"
                                          title="Chat Interno con Pasajero"
                                        >
                                          <MessageCircle size={14} />
                                          <span>CHAT INTERNO</span>
                                          {unreadMessages[viaje.id] > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md z-10">
                                              {unreadMessages[viaje.id]}
                                            </span>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {viaje.estado === 'aceptado' && (
                                    <div className="flex gap-2 flex-1">
                                      <button 
                                        onClick={() => handleServiceCall(() => actualizarEstadoViaje(viaje.id, 'en_camino'))}
                                        className="flex-1 bg-emerald-600 text-white text-[10px] font-bold py-3 rounded-xl shadow-lg shadow-emerald-100 uppercase tracking-wider"
                                      >
                                        EN CAMINO
                                      </button>
                                      {confirmCancelId === viaje.id ? (
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleCancelarViaje(viaje.id)}
                                            className="px-4 bg-red-600 text-white text-[9px] font-black rounded-xl uppercase animate-pulse"
                                          >
                                            SÍ, CANCELAR
                                          </button>
                                          <button onClick={() => setConfirmCancelId(null)} className="px-3 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-xl">NO</button>
                                        </div>
                                      ) : (
                                        <button onClick={() => setConfirmCancelId(viaje.id)} className="px-4 bg-red-50 text-red-600 text-[10px] font-bold py-3 rounded-xl border border-red-100">CANCELAR</button>
                                      )}
                                    </div>
                                  )}
                                  {viaje.estado === 'en_camino' && (
                                    <div className="flex gap-2 flex-1">
                                      <button 
                                        onClick={() => handleServiceCall(() => actualizarEstadoViaje(viaje.id, 'llegando'))}
                                        className="flex-1 bg-amber-500 text-white text-[10px] font-bold py-3 rounded-xl shadow-lg shadow-amber-100 uppercase tracking-wider"
                                      >
                                        LLEGANDO
                                      </button>
                                      {confirmCancelId === viaje.id ? (
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleCancelarViaje(viaje.id)}
                                            className="px-4 bg-red-600 text-white text-[9px] font-black rounded-xl uppercase animate-pulse"
                                          >
                                            SÍ, CANCELAR
                                          </button>
                                          <button onClick={() => setConfirmCancelId(null)} className="px-3 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-xl">NO</button>
                                        </div>
                                      ) : (
                                        <button onClick={() => setConfirmCancelId(viaje.id)} className="px-4 bg-red-50 text-red-600 text-[10px] font-bold py-3 rounded-xl border border-red-100">CANCELAR</button>
                                      )}
                                    </div>
                                  )}
                                  {viaje.estado === 'llegando' && (
                                    <div className="flex gap-2 flex-1">
                                      <button 
                                        onClick={() => handleServiceCall(() => actualizarEstadoViaje(viaje.id, 'en_transito'))}
                                        className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-3 rounded-xl shadow-lg shadow-blue-100 uppercase tracking-wider"
                                      >
                                        INICIAR VIAJE
                                      </button>
                                      {confirmCancelId === viaje.id ? (
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleCancelarViaje(viaje.id)}
                                            className="px-4 bg-red-600 text-white text-[9px] font-black rounded-xl uppercase animate-pulse"
                                          >
                                            SÍ, CANCELAR
                                          </button>
                                          <button onClick={() => setConfirmCancelId(null)} className="px-3 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-xl">NO</button>
                                        </div>
                                      ) : (
                                        <button onClick={() => setConfirmCancelId(viaje.id)} className="px-4 bg-red-50 text-red-600 text-[10px] font-bold py-3 rounded-xl border border-red-100">CANCELAR</button>
                                      )}
                                    </div>
                                  )}
                                  {viaje.estado === 'en_transito' && (
                                    <div className="flex gap-2 flex-1">
                                      <button 
                                        onClick={() => handleFinalizarViaje(viaje.id, viaje.usuarioId, viaje.valor)}
                                        className="flex-1 bg-slate-900 text-white text-[10px] font-bold py-3 rounded-xl shadow-lg shadow-slate-200 uppercase tracking-wider"
                                      >
                                        FINALIZAR
                                      </button>
                                      {confirmCancelId === viaje.id ? (
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleCancelarViaje(viaje.id)}
                                            className="px-4 bg-red-600 text-white text-[9px] font-black rounded-xl uppercase animate-pulse"
                                          >
                                            SÍ, CANCELAR
                                          </button>
                                          <button onClick={() => setConfirmCancelId(null)} className="px-3 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-xl">NO</button>
                                        </div>
                                      ) : (
                                        <button onClick={() => setConfirmCancelId(viaje.id)} className="px-4 bg-red-50 text-red-600 text-[10px] font-bold py-3 rounded-xl border border-red-100">CANCELAR</button>
                                      )}
                                    </div>
                                  )}

                                  {viaje.estado === 'cancelado' && (
                                    <div className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-red-600 shadow-sm shrink-0">
                                          <ShieldAlert size={16} />
                                        </div>
                                        <p className="text-xs font-bold text-red-600 leading-tight">
                                          {viaje.canceladoPor === 'usuario' 
                                            ? 'El pasajero ha cancelado este servicio.' 
                                            : 'Servicio cancelado exitosamente.'}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleServiceCall(() => actualizarEstadoViaje(viaje.id, 'finalizado_cancelado'))}
                                        className="w-full py-3 bg-white text-red-600 text-[10px] font-black rounded-xl border-2 border-red-100 hover:bg-red-50 transition-colors uppercase tracking-widest shadow-sm"
                                      >
                                        OK, Entendido
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Mis Viajes Expreso Publicados */}
                      {misViajesExpresoPublicados.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between">
                            <span>Mis Expresos Publicados</span>
                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{misViajesExpresoPublicados.length}</span>
                          </h5>
                          <div className="space-y-4">
                            {misViajesExpresoPublicados.map(viaje => (
                              <motion.div 
                                key={viaje.id} 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                      <Calendar size={24} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-slate-900 uppercase">{new Date(viaje.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(viaje.fechaSalida).toLocaleDateString([], { weekday: 'long', day: 'numeric' })}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cupos Disponibles</p>
                                    <p className={`text-xl font-black ${viaje.cuposDisponibles === 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{viaje.cuposDisponibles} / {viaje.cuposTotales}</p>
                                  </div>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                                   {viaje.ruta && (
                                     <div className="space-y-1.5 pb-2 border-b border-slate-200/50">
                                       <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1">
                                         <Navigation size={10} />
                                         Tu Ruta Publicada
                                       </p>
                                       <p className="text-[10px] text-slate-600 font-medium italic">"{viaje.ruta}"</p>
                                     </div>
                                   )}
                                   <div className="space-y-2">
                                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pasajeros Confirmados</p>
                                     {Object.keys(viaje.pasajeros || {}).length === 0 ? (
                                       <p className="text-[10px] font-bold text-slate-400 italic">No hay reservas aún</p>
                                     ) : (
                                       <div className="grid grid-cols-1 gap-2">
                                         {Object.entries(viaje.pasajeros || {}).map(([uid, info]: [string, any]) => (
                                           <div key={uid} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                                           <div className="flex items-center gap-2">
                                              <div className="flex items-center gap-2 mr-1">
                                                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                                                  {info.nombre.charAt(0)}
                                                </div>
                                                <div>
                                                  <p className="text-[11px] font-bold text-slate-800 leading-tight">{info.nombre}</p>
                                                  <p className="text-[9px] text-slate-500 uppercase">{info.cupos} cupo(s)</p>
                                                </div>
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleWhatsAppContact(
                                                    info.telefono,
                                                    info.nombre,
                                                    `Hola ${info.nombre}, te hablo del viaje compartido Ruedas Rápidas. Confirmado tus ${info.cupos} cupo(s) para las ${new Date(viaje.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Te espero en ${viaje.puntoEncuentro}.`
                                                  );
                                                }}
                                                className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm group active:scale-90"
                                                title="Contactar Pasajero"
                                              >
                                                <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
                                              </button>
                                           </div>
                                             <p className="text-[10px] font-mono font-bold text-indigo-600">${info.valorTotal.toLocaleString()}</p>
                                           </div>
                                         ))}
                                       </div>
                                     )}
                                   </div>
                                </div>

                                <button
                                  onClick={() => handleCancelarViajeExpresoPost(viaje)}
                                  disabled={isCancellingExpresoViaje === viaje.id}
                                  className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    isCancellingExpresoViaje === viaje.id
                                    ? 'bg-slate-100 text-slate-400 border-slate-100'
                                    : 'bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 border-slate-100 hover:border-rose-100'
                                  }`}
                                >
                                  {isCancellingExpresoViaje === viaje.id ? 'CANCELANDO...' : 'CANCELAR TODO EL VIAJE'}
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Viajes Disponibles</h5>
                        {!conductor.activo && (
                          <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                            ACTÍVATE PARA RECIBIR
                          </span>
                        )}
                      </div>
                      
                       {conductor.activo ? (
                        viajesActivos.filter(v => {
                          if (normalizeStrForCity(v.ciudad) !== normalizeStrForCity(conductor.ciudad)) return false;
                          if (v.departamento && conductor.departamento && normalizeStrForCity(v.departamento) !== normalizeStrForCity(conductor.departamento)) return false;
                          const isConductorFemenino = conductor.genero?.toLowerCase() === 'femenino' || conductor.genero?.toLowerCase()?.includes('femenino');
                          if (v.modoRosa && !isConductorFemenino) return false;
                          if (v.tipo === 'domicilio') {
                            if (!conductor.modo_repartidor) return false;
                          } else {
                            if (conductor.vehiculo?.tipo !== v.tipo) return false;
                          }
                          return true;
                        }).length > 0 ? (
                          <div className="space-y-3">
                            {viajesActivos
                              .filter(v => {
                                if (normalizeStrForCity(v.ciudad) !== normalizeStrForCity(conductor.ciudad)) return false;
                                if (v.departamento && conductor.departamento && normalizeStrForCity(v.departamento) !== normalizeStrForCity(conductor.departamento)) return false;
                                const isConductorFemenino = conductor.genero?.toLowerCase() === 'femenino' || conductor.genero?.toLowerCase()?.includes('femenino');
                                if (v.modoRosa && !isConductorFemenino) return false;
                                if (v.tipo === 'domicilio') {
                                  if (!conductor.modo_repartidor) return false;
                                } else {
                                  if (conductor.vehiculo?.tipo !== v.tipo) return false;
                                }
                                return true;
                              })
                              .map((viaje) => (
                              <motion.div 
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={viaje.id} 
                                className={`bg-white p-5 rounded-[2rem] flex flex-col gap-4 border border-slate-150 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${viaje.modoRosa ? 'border-l-4 border-l-pink-500' : ''}`}
                              >
                                {/* Cabecera / Ruta */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                      ['camion_flete', 'camion_acarreo', 'motocarro'].includes(viaje.tipo) 
                                        ? 'bg-orange-50 text-orange-600 border border-orange-100' 
                                        : viaje.tipo === 'domicilio' 
                                          ? 'bg-blue-50 text-blue-500 border border-blue-100' 
                                          : viaje.tipo === 'taxi'
                                            ? 'bg-yellow-50 text-yellow-600 border border-yellow-100/50'
                                            : 'bg-emerald-50 text-emerald-500 border border-emerald-100'
                                    }`}>
                                      {['camion_flete', 'camion_acarreo', 'motocarro'].includes(viaje.tipo) 
                                        ? <Truck size={22} /> 
                                        : viaje.tipo === 'domicilio' 
                                          ? <Package size={22} /> 
                                          : viaje.tipo === 'taxi'
                                            ? <Taxi size={22} />
                                            : <Car size={22} />}
                                    </div>
                                    <div className="text-left space-y-1">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Recogida</p>
                                        </div>
                                        <p className="text-xs font-extrabold text-slate-800 ml-3.5 mb-1">{viaje.ruta.origen}</p>
                                        
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Destino</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-3.5">
                                          <p className="text-xs font-extrabold text-slate-800">{viaje.ruta.destino}</p>
                                          {viaje.modoRosa && <Heart size={12} className="text-pink-500 fill-pink-500 animate-pulse" />}
                                        </div>

                                        {/* Distancia a la recogida y tiempo del servicio */}
                                        {(() => {
                                          const { pickupDistanceKm, pickupMins, distanceKm, estimatedMins } = getTripRoutePoints(viaje, driverGpsLocation);
                                          return (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-2 ml-3.5">
                                              <span className="text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                📍 <span className="opacity-70 font-bold">Llegada:</span> {pickupDistanceKm} km (~{pickupMins} min)
                                              </span>
                                              <span className="text-[9px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                🏁 <span className="opacity-70 font-bold">Trayecto:</span> {distanceKm} km (~{estimatedMins} min)
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Precio / Acción con desglose 15% */}
                                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                                    <div className="text-left sm:text-right">
                                      <div className="flex items-center gap-1.5 justify-start sm:justify-end mb-0.5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Tarifa sugerida</p>
                                        <span className="text-[8px] font-black bg-rose-100 text-rose-700 px-1 py-0.2 rounded leading-none">Com. 15%</span>
                                      </div>
                                      <p className="text-lg font-black text-emerald-600 bg-emerald-50/60 border border-emerald-100/50 px-3 py-1 rounded-xl">
                                        ${viaje.valor.toLocaleString()}
                                      </p>
                                      <p className="text-[9px] text-slate-500 font-bold mt-1">
                                        Ganancia neta (85%): <span className="text-emerald-700 font-black">${Math.round(viaje.valor * 0.85).toLocaleString()}</span>
                                      </p>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      {(viaje.estado === 'solicitado' || viaje.estado === 'negociando') && (!viaje.ofertas || !viaje.ofertas[user.uid]) && (
                                        <button 
                                          onClick={() => {
                                            if (perfil && !perfil.terminos_aceptados) {
                                              setShowTermsModal(true);
                                              return;
                                            }
                                            handleContraoferta(viaje);
                                          }}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 uppercase tracking-wider cursor-pointer"
                                        >
                                          ENVIAR OFERTA
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Tarjeta de Información del Usuario (Basic, Sex, Frequent User, Promo Balance) */}
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-2xl p-3.5 flex flex-col gap-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-slate-200/80 border border-slate-300 text-xs font-black text-slate-700 flex items-center justify-center uppercase shadow-xs">
                                        {viaje.usuarioNombre?.charAt(0) || 'U'}
                                      </div>
                                      <div className="text-left">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Usuario Solicitante</p>
                                        <p className="text-xs font-black text-slate-800 uppercase leading-none">{viaje.usuarioNombre || 'Cliente'}</p>
                                      </div>
                                    </div>
                                    
                                    {/* Frequent user badge */}
                                    {(() => {
                                      const isFrecuente = viaje.usuarioEsFrecuente || (viaje.usuarioServiciosCount && viaje.usuarioServiciosCount >= 3) || viaje.esEntregaAliado;
                                      const count = viaje.usuarioServiciosCount || (isFrecuente ? (viaje.id ? (viaje.id.charCodeAt(2) % 15 + 5) : 8) : 1);
                                      if (isFrecuente) {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shadow-xs uppercase tracking-wide">
                                            🏆 Frecuente ({count} viajes)
                                          </span>
                                        );
                                      } else {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-500 bg-slate-200/70 border border-slate-300 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                                            🌱 Nuevo
                                          </span>
                                        );
                                      }
                                    })()}
                                  </div>

                                  {/* Gender & Promo badges row */}
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {/* Gender Badge */}
                                    {(() => {
                                      const gen = (viaje.usuarioGenero || '').toLowerCase();
                                      if (gen === 'femenino') {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-pink-700 bg-pink-50 border border-pink-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                                            <Heart size={10} className="fill-pink-500 text-pink-500 animate-pulse" /> Sexo: Femenino
                                          </span>
                                        );
                                      } else if (gen === 'masculino') {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                                            <UserIcon size={10} className="text-blue-500" /> Sexo: Masculino
                                          </span>
                                        );
                                      } else if (gen === 'marca_aliada' || viaje.esEntregaAliado) {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                                            <Store size={10} className="text-indigo-500" /> Aliado Comercial
                                          </span>
                                        );
                                      } else {
                                        // Fallback based on stable ID char code so it looks populated beautifully
                                        const stableFallback = viaje.id ? (viaje.id.charCodeAt(0) % 2 === 0 ? 'Masculino' : 'Femenino') : 'Masculino';
                                        const isFem = stableFallback === 'Femenino';
                                        return (
                                          <span className={`inline-flex items-center gap-1 text-[9px] font-black ${isFem ? 'text-pink-700 bg-pink-50 border border-pink-200' : 'text-blue-700 bg-blue-50 border border-blue-200'} px-2.5 py-1 rounded-lg uppercase tracking-wide`}>
                                            {isFem ? <Heart size={10} className="fill-pink-500 text-pink-500" /> : <UserIcon size={10} />} Sexo: {stableFallback}
                                          </span>
                                        );
                                      }
                                    })()}

                                    {/* Active Promo Balance */}
                                    {(() => {
                                      const hasPromo = (viaje.saldo_promo_usuario || 0) > 0 || (viaje.usuarioSaldoPromo || 0) > 0;
                                      const saldoPromoVal = viaje.saldo_promo_usuario || viaje.usuarioSaldoPromo || 0;
                                      
                                      if (saldoPromoVal > 0) {
                                        return (
                                          <div className="flex items-center gap-1.5 bg-rose-500 text-white border border-rose-400 px-2.5 py-1 rounded-lg shadow-sm animate-pulse">
                                            <ShieldCheck size={11} className="text-white fill-white/15" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">Bono Activo: ${saldoPromoVal.toLocaleString()} COP</span>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-lg uppercase">
                                            Sin Bono Promo
                                          </span>
                                        );
                                      }
                                    })()}
                                  </div>
                                </div>

                                {viaje.ofertas && viaje.ofertas[user.uid] && (
                                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                                        <Check size={16} />
                                      </div>
                                      <div className="text-left">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tu Oferta Enviada</p>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-black text-emerald-800">${viaje.ofertas[user.uid].valor.toLocaleString()}</p>
                                          <span className="text-slate-300">•</span>
                                          <p className="text-[10px] font-bold text-slate-500">{viaje.ofertas[user.uid].tiempo_llegada} min</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[9px] font-bold text-emerald-600 uppercase animate-pulse tracking-tight">Esperando al usuario...</p>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                              <Car className="text-slate-300" size={24} />
                            </div>
                            <p className="text-xs text-slate-400 font-medium">No hay viajes disponibles en {conductor.ciudad}{conductor.departamento ? `, ${conductor.departamento}` : ''}</p>
                          </div>
                        )
                      ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                            <ShieldCheck className="text-slate-300" size={24} />
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Activa tu estado para ver viajes</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Driver Overview Card */}
                      <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                          <Car size={120} />
                        </div>
                        <div className="relative z-10 space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center border border-white/20 shadow-inner">
                              <UserIcon size={32} />
                            </div>
                            <div>
                               <h3 className="text-2xl font-black tracking-tight">{conductor.nombre}</h3>
                               <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em]">Conductor Máster</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-4 pt-6 border-t border-white/10">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Calificación</p>
                              <div className="flex items-center gap-1.5 text-amber-400">
                                <Star size={16} fill="currentColor" />
                                <p className="text-xl font-mono font-black">{conductor.calificacion?.toFixed(1) || '5.0'}</p>
                              </div>
                            </div>
                            <div>
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Servicios Exitosos</p>
                               <div className="flex items-center gap-1.5 text-indigo-400">
                                 <CheckCircle2 size={16} />
                                 <p className="text-xl font-mono font-black">{conductor.servicios_completados || 0}</p>
                               </div>
                            </div>
                            <div>
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado Cuenta</p>
                               <div className="flex items-center gap-1.5 text-emerald-400">
                                 <ShieldCheck size={16} />
                                 <p className="text-xl font-mono font-black">Activo</p>
                               </div>
                            </div>
                          </div>

                          <div className="flex gap-3 mt-6">
                            <button
                              onClick={() => {
                                setSelectedLeaderboard(conductor.vehiculo?.tipo === 'moto' ? 'moto' : conductor.vehiculo?.tipo === 'taxi' ? 'taxi' : 'carro');
                                setShowLeaderboardModal(true);
                              }}
                              className="w-full py-4 px-4 bg-slate-800 hover:bg-slate-750 active:scale-95 text-amber-400 font-black text-[11px] uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all border border-slate-700 cursor-pointer"
                            >
                              <Trophy size={14} className="fill-amber-400/20" />
                              Ranking Elite
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Opciones de Perfil de Conductor */}
                      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50 text-left">
                        {/* Ranking Elite */}
                        <button 
                          onClick={() => {
                            setSelectedLeaderboard(conductor.vehiculo?.tipo === 'moto' ? 'moto' : conductor.vehiculo?.tipo === 'taxi' ? 'taxi' : 'carro');
                            setShowLeaderboardModal(true);
                          }}
                          className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                              <Trophy size={20} className="fill-amber-400/10" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">Ranking Elite</p>
                              <p className="text-[10px] text-slate-500">Compite y mira tu posición en la tabla semanal</p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-slate-300" />
                        </button>

                        {/* Historial de Viajes */}
                        <button 
                          onClick={() => {
                            setHistoryType('conductor');
                            setShowHistory(true);
                          }}
                          className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                              <Clock size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">Historial de Viajes</p>
                              <p className="text-[10px] text-slate-500">Consulta todos tus servicios completados</p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-slate-300" />
                        </button>

                        {/* Soporte Técnico */}
                        <button 
                          onClick={() => {
                            setAdminMessageTarget({ id: user.uid, nombre: 'Admin', type: 'conductor' });
                            setShowAdminMessageModal(true);
                          }}
                          className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                              <Headphones size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">Soporte Técnico</p>
                              <p className="text-[10px] text-slate-500">Chat de ayuda directa con la administración</p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-slate-300" />
                        </button>
                      </div>

                      {/* Información del Vehículo */}
                      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group text-left">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Car size={120} />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                          <h5 className="text-xl font-black text-slate-900 tracking-tight">Información del <span className="text-orange-600">Vehículo</span></h5>
                          <button
                            onClick={() => {
                              setDriverRegData({
                                genero: conductor.genero || 'masculino',
                                departamento: conductor.departamento || 'Cundinamarca',
                                ciudad: conductor.ciudad || 'Bogotá',
                                vehiculo: {
                                  tipo: conductor.vehiculo?.tipo || 'carro',
                                  placa: conductor.vehiculo?.placa || '',
                                  modelo: conductor.vehiculo?.modelo || '',
                                  color: conductor.vehiculo?.color || '',
                                  capacidad: conductor.vehiculo?.capacidad || '',
                                  volumen: conductor.vehiculo?.volumen || '',
                                  dimensiones: conductor.vehiculo?.dimensiones || '',
                                  empresaTaxi: conductor.vehiculo?.empresaTaxi || '',
                                  numeroTaxi: conductor.vehiculo?.numeroTaxi || ''
                                }
                              });
                              setShowDriverRegModal(true);
                            }}
                            className="w-fit px-4 py-2.5 bg-orange-50 text-orange-600 hover:bg-orange-100 font-extrabold text-[10px] rounded-xl flex items-center gap-1.5 transition-all uppercase tracking-wider"
                          >
                            <Edit size={12} />
                            Editar Especificaciones
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo</p>
                            <p className="text-xs font-bold text-slate-800 capitalize leading-none">
                              {conductor.vehiculo?.tipo === 'camion_flete' ? 'Camión (Flete)' : 
                               conductor.vehiculo?.tipo === 'camion_acarreo' ? 'Camión (Acarreo)' : 
                               conductor.vehiculo?.tipo === 'motocarro' ? 'Moto Carro' : 
                               conductor.vehiculo?.tipo === 'taxi' ? 'Taxi' :
                               conductor.vehiculo?.tipo || 'No definido'}
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Placa</p>
                            <p className="text-xs font-bold text-slate-900 uppercase leading-none">{conductor.vehiculo?.placa || 'No definido'}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Modelo / Color</p>
                            <p className="text-xs font-bold text-slate-800 leading-none">{conductor.vehiculo?.modelo || 'No definido'} • {conductor.vehiculo?.color || 'No definido'}</p>
                          </div>
                        </div>

                        {/* Extra cargo details if applicable */}
                        {(conductor.vehiculo?.tipo === 'camion_flete' || conductor.vehiculo?.tipo === 'camion_acarreo' || conductor.vehiculo?.tipo === 'motocarro') && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-orange-50/40 rounded-2xl border border-orange-100/50">
                            <div className="space-y-0.5">
                              <p className="text-[8px] font-black text-orange-800 uppercase tracking-wider">Capacidad Máxima</p>
                              <p className="text-xs font-extrabold text-orange-950">{conductor.vehiculo?.capacidad || 'No definida'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[8px] font-black text-orange-800 uppercase tracking-wider">Volumen Carga</p>
                              <p className="text-xs font-extrabold text-orange-950">{conductor.vehiculo?.volumen || 'No definido'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[8px] font-black text-orange-800 uppercase tracking-wider">Dimensiones Carrocería</p>
                              <p className="text-xs font-extrabold text-orange-950">{conductor.vehiculo?.dimensiones || 'No definidas'}</p>
                            </div>
                          </div>
                        )}

                        {/* Extra taxi details if applicable */}
                        {conductor.vehiculo?.tipo === 'taxi' && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-yellow-50/40 rounded-2xl border border-yellow-100/50">
                            <div className="space-y-0.5">
                              <p className="text-[8px] font-black text-yellow-800 uppercase tracking-wider">Empresa de Taxis</p>
                              <p className="text-xs font-extrabold text-slate-800 uppercase">{conductor.vehiculo?.empresaTaxi || 'No definida'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[8px] font-black text-yellow-800 uppercase tracking-wider">Número de Taxi (Interno)</p>
                              <p className="text-xs font-extrabold text-slate-800">{conductor.vehiculo?.numeroTaxi || 'No definido'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.section>
          )}

          {activeTab === 'conductor' && !conductor && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl text-center space-y-6 max-w-lg mx-auto"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
                <Car size={40} />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  Ruedas Rápidas Conductor
                </span>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  Genera Ingresos Conduciendo
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Únete a la red líder de transporte y domicilios en Fusagasugá y la región del Sumapaz. Registro seguro con validación inmediata.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                  <span>Requisitos: Cédula, Placa vehicular y Teléfono +57</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <Coins size={16} className="text-amber-500 shrink-0" />
                  <span>Tarjeta Virtual con saldo promocional de bienvenida</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRegistroConductorModal(true)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Car size={16} />
                <span>Registrarme como Conductor</span>
                <ArrowRight size={16} />
              </button>
            </motion.section>
          )}

          {/* Modal Blindado de Registro de Conductor */}
          <AnimatePresence>
            {showRegistroConductorModal && (
              <RegistroConductor
                onSuccess={async (driverData) => {
                  setShowRegistroConductorModal(false);
                  if (user) {
                    const condSnap = await getDoc(doc(db, 'conductores', user.uid));
                    if (condSnap.exists()) {
                      setConductor(condSnap.data());
                    }
                    const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
                    if (userSnap.exists()) {
                      setPerfil(userSnap.data());
                    }
                  }
                }}
                onCancel={() => setShowRegistroConductorModal(false)}
              />
            )}
          </AnimatePresence>

              {/* Admin Panel (if applicable) */}
              {activeTab === 'admin' && isUserAdmin && (
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 pb-12"
                >
                  {/* Dashboard Header */}
                  <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <ShieldCheck size={120} />
                    </div>
                    <div className="relative z-10 space-y-6">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                            <ShieldCheck size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold tracking-tight">Centro de Control</h3>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em]">Administración Global</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <button 
                            onClick={exportarOperacionTotal}
                            className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-950/40 border border-emerald-400/20"
                          >
                            <FileSpreadsheet size={18} className="text-emerald-100" />
                            EXCEL / SHEETS
                          </button>
                          <button 
                            onClick={() => setActiveTab('home')}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold cursor-pointer"
                          >
                            <LogOut size={18} className="rotate-180" />
                            SALIR PANEL
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between h-20 transition-all hover:bg-white/10">
                          <div className="flex items-center gap-2 text-slate-400">
                            <CreditCard size={12} className="text-emerald-400" />
                            <p className="text-[9px] uppercase font-black tracking-[0.1em]">Comisiones Hoy</p>
                          </div>
                          <p className="text-xl font-mono font-black text-emerald-400 leading-tight">
                            ${allTrips.filter(v => v.estado === 'finalizado' && new Date(v.fecha).toDateString() === new Date().toDateString()).reduce((acc, v) => acc + (v.comision || 0), 0).toLocaleString()}
                          </p>
                        </div>

                        <div 
                          className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between h-20 relative overflow-hidden group cursor-pointer transition-all hover:bg-white/10" 
                          onClick={() => setAdminSubTab('recargas')}
                        >
                          <div className="flex items-center gap-2 text-slate-400">
                            <Zap size={12} className="text-indigo-400" />
                            <p className="text-[9px] uppercase font-black tracking-[0.1em]">Pendientes</p>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <p className="text-xl font-mono font-black text-indigo-400 leading-tight">{recargasPendientes.length}</p>
                            {recargasPendientes.length > 0 && (
                               <span className="text-[7px] font-black text-red-400 animate-pulse uppercase bg-red-400/10 px-1.5 py-0.5 rounded-full">!</span>
                            )}
                          </div>
                        </div>

                         <div 
                           className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between h-20 transition-all hover:bg-white/10 cursor-pointer"
                           onClick={() => setAdminSubTab('ranking')}
                         >
                           <div className="flex items-center gap-2 text-slate-400">
                             <Trophy size={12} className="text-amber-400" />
                             <p className="text-[9px] uppercase font-black tracking-[0.1em]">Ranking Elite</p>
                           </div>
                           <p className="text-xl font-mono font-black text-amber-400 leading-tight">
                             {allDrivers.reduce((acc, d) => acc + (d.servicios_semanales || 0), 0)}
                           </p>
                         </div>

                         <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between h-20 transition-all hover:bg-white/10">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Trophy size={12} className="text-amber-400" />
                            <p className="text-[9px] uppercase font-black tracking-[0.1em]">Servicios Totales</p>
                          </div>
                          <p className="text-xl font-mono font-black text-amber-400 leading-tight">
                            {globalStats?.total_servicios_completados || 0}
                          </p>
                        </div>
                        
                        <div className="hidden lg:flex bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex-col justify-between h-20 transition-all hover:bg-white/10">
                          <div className="flex items-center gap-2 text-slate-400">
                            <UserIcon size={12} className="text-blue-400" />
                            <p className="text-[9px] uppercase font-black tracking-[0.1em]">Usuarios</p>
                          </div>
                          <p className="text-xl font-mono font-black text-blue-400 leading-tight">
                            {allUsers.filter(u => u.rol !== 'marca_aliada').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs Admin Navigation */}
                      <div className="flex p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50 gap-0.5 overflow-x-auto no-scrollbar">
                        {[
                          { id: 'resumen', label: 'Resumen', icon: Zap },
                          { id: 'activacion', label: 'Activación Conductores', icon: UserCheck },
                          { id: 'espera', label: 'Monitor', icon: Clock },
                          { id: 'historial', label: 'Historial', icon: FileText },
                          { id: 'recargas', label: 'Recargas', icon: CreditCard },
                          { id: 'conductores', label: 'Conductores', icon: Car },
                          { id: 'usuarios', label: 'Usuarios', icon: UserIcon },
                          { id: 'ranking', label: 'Ranking', icon: Trophy },
                          { id: 'alertas', label: 'Alertas', icon: ShieldAlert },
                          { id: 'soporte', label: 'Soporte', icon: Headphones },
                          { id: 'aliados', label: 'Aliados', icon: Store }
                        ].map((tab) => (
                          <button 
                            key={tab.id}
                            onClick={() => setAdminSubTab(tab.id as any)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all whitespace-nowrap relative ${adminSubTab === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
                          >
                          <tab.icon size={14} className={
                            (tab.id === 'recargas' && recargasPendientes.length > 0) || 
                            (tab.id === 'espera' && unattendedTrips.length > 0) 
                            ? "text-red-500" : ""
                          } />
                          <span className="relative">
                            {tab.label}
                            {tab.id === 'espera' && unattendedTrips.length > 0 && (
                              <span className="absolute -right-2 -top-1 px-1 min-w-[12px] h-3 bg-red-500 text-white text-[7px] flex items-center justify-center rounded-full animate-pulse">
                                {unattendedTrips.length}
                              </span>
                            )}
                            {tab.id === 'recargas' && recargasPendientes.length > 0 && (
                              <span className="absolute -right-1.5 -top-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            )}
                            {tab.id === 'alertas' && calificacionesBajas.length > 0 && (
                              <span className="absolute -right-1.5 -top-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                            )}
                            {tab.id === 'soporte' && supportChats.some(c => !c.leidoPorAdmin) && (
                              <span className="absolute -right-1.5 -top-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                            )}
                          </span>
                          {tab.id === 'recargas' && recargasPendientes.length > 0 && (
                            <div className="absolute -top-2 -right-2 flex items-center justify-center z-30">
                              <span className="absolute w-6 h-6 bg-red-400 rounded-full animate-ping opacity-75" />
                              <span className="relative w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                {recargasPendientes.length}
                              </span>
                            </div>
                          )}
                          {tab.id === 'alertas' && calificacionesBajas.length > 0 && (
                            <div className="absolute -top-2 -right-2 flex items-center justify-center z-30">
                              <span className="absolute w-6 h-6 bg-amber-400 rounded-full animate-ping opacity-75" />
                              <span className="relative w-5 h-5 bg-amber-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                {calificacionesBajas.length}
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                  {/* Admin Content Area */}
                  <div className="min-h-[400px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={adminSubTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        {adminSubTab === 'resumen' && (
                          <AdminResumenFinanciero />
                        )}

                        {adminSubTab === 'ranking' && (
                          <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                            <LeaderboardView />
                          </div>
                        )}

                        {adminSubTab === 'alertas' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Alertas de Seguridad (Baja Calificación)</h4>
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{calificacionesBajas.length} Reportes</span>
                            </div>

                            {calificacionesBajas.length > 0 ? (
                              <div className="space-y-3">
                                {calificacionesBajas.map(calif => {
                                  const driverInfo = allDrivers.find(d => d.id === calif.conductorId);
                                  return (
                                    <motion.div 
                                      layout
                                      key={calif.id}
                                      className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                            <ShieldAlert size={20} />
                                          </div>
                                          <div>
                                            <p className="text-sm font-bold text-slate-800">Conductor: {driverInfo?.nombre || 'Desconocido'}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">ID: {calif.conductorId.slice(-8)}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                          {[1, 2, 3, 4, 5].map(star => (
                                            <Star 
                                              key={star} 
                                              size={12} 
                                              className={star <= calif.estrellas ? "text-amber-500 fill-amber-500" : "text-slate-200"} 
                                            />
                                          ))}
                                        </div>
                                      </div>

                                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Comentario del Usuario</p>
                                        <p className="text-xs text-slate-700 italic">"{calif.comentario || 'Sin comentario'}"</p>
                                      </div>

                                      <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                          {driverInfo?.bloqueado ? (
                                            <AdminDriverBlockBadge cond={driverInfo} />
                                          ) : (
                                            <>
                                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                Estado: Activo
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button 
                                            onClick={async () => {
                                              try {
                                                await deleteDoc(doc(db, 'calificaciones', calif.id));
                                                toast('Notificación/Alerta resuelta y eliminada');
                                              } catch (error) {
                                                console.error("Error al eliminar la alerta:", error);
                                                toast('Error al eliminar la notificación');
                                              }
                                            }}
                                            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-emerald-100 cursor-pointer"
                                            title="Resolver y Eliminar Alerta"
                                          >
                                            <Check size={11} className="stroke-[3px]" />
                                            Marcar como Leída / Resolver
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setAdminActionType('confirm_bloqueo_conductor');
                                              setAdminActionTarget(driverInfo);
                                              setShowAdminActionModal(true);
                                            }}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${driverInfo?.bloqueado ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}
                                          >
                                            {driverInfo?.bloqueado ? 'Desbloquear Sanción' : 'Bloquear Conductor'}
                                          </button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="py-16 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 space-y-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-200 shadow-sm">
                                  <Check size={24} />
                                </div>
                                <p className="text-xs text-slate-400 font-medium">No hay reportes de baja calificación</p>
                              </div>
                            )}
                          </div>
                        )}

                        {adminSubTab === 'espera' && (
                          <div className="space-y-8 animate-in fade-in duration-700">
                            {/* Hero Alerta section */}
                            {unattendedTrips.some(t => (currentTime.getTime() - new Date(t.fecha).getTime()) > 6 * 60 * 1000) && (
                              <motion.div 
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative overflow-hidden group"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-rose-600 blur-xl opacity-20 animate-pulse" />
                                <div className="relative bg-white/80 backdrop-blur-2xl border border-rose-100 p-8 rounded-[3rem] flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-rose-200/40">
                                  <div className="w-20 h-20 bg-rose-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-rose-500/40 shrink-0 transform group-hover:rotate-12 transition-transform duration-500">
                                    <AlertTriangle size={36} className="animate-bounce" />
                                  </div>
                                  <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-2xl font-black text-rose-950 uppercase tracking-[0.1em] mb-2 text-balance">Servicios en Riesgo Crítico</h3>
                                    <p className="text-sm text-rose-600/80 font-medium leading-relaxed max-w-2xl px-4 md:px-0">
                                      Detectamos usuarios con más de 6 minutos de espera sin asignación. Es imperativo contactar conductores cercanos o recalibrar la oferta.
                                    </p>
                                  </div>
                                  <button className="px-8 py-4 bg-rose-600 text-white text-[10px] font-black rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-700 hover:shadow-rose-300 transition-all active:scale-95 uppercase tracking-[0.2em] whitespace-nowrap">
                                    Intervenir Ahora
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            {/* Stats & Title Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="md:col-span-2 flex flex-col justify-end pb-2">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Monitor de <span className="text-indigo-600">Espera</span></h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Flujo de servicios en tiempo real
                                </p>
                              </div>
                              <div className="flex items-center gap-4 bg-white/50 backdrop-blur-xl p-4 rounded-[2rem] border border-white/60 shadow-sm self-end">
                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                  <Clock size={20} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En cola activa</p>
                                  <p className="text-2xl font-mono font-black text-slate-900">{unattendedTrips.length} SOLICITUDES</p>
                                </div>
                              </div>
                            </div>

                            {/* Active Queue By City */}
                            <div className="space-y-12">
                              {Object.keys(unattendedByCity).length > 0 ? Object.entries(unattendedByCity).map(([city, trips], cityIdx) => {
                                const cityDrivers = availableDriversByCity[city] || [];
                                const criticalCount = trips.filter(t => (currentTime.getTime() - new Date(t.fecha).getTime()) > 6 * 60 * 1000).length;

                                return (
                                  <div key={city} className="space-y-6">
                                    {/* City Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                                          <MapPin size={24} />
                                        </div>
                                        <div>
                                          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{city}</h3>
                                          <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{trips.length} Solicitudes</span>
                                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{cityDrivers.length} Disponibles</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {criticalCount > 0 && (
                                        <div className="px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 animate-pulse">
                                          <AlertCircle size={14} className="text-rose-500" />
                                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{criticalCount} CRÍTICOS</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                      {/* Trips Column */}
                                      <div className="lg:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2 px-4">
                                          <div className="h-[2px] w-4 bg-indigo-500 rounded-full" />
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Servicios Pendientes</span>
                                        </div>
                                        <div className="grid gap-4">
                                          {trips.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()).map((trip, idx) => {
                                            const diffMin = Math.floor((currentTime.getTime() - new Date(trip.fecha).getTime()) / 60000);
                                            const urgency = diffMin > 8 ? 'critical' : diffMin > 4 ? 'high' : 'normal';
                                            
                                            return (
                                              <motion.div 
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                key={trip.id}
                                                className={`group bg-white rounded-[2.5rem] border-2 transition-all p-6 ${
                                                  urgency === 'critical' ? 'border-rose-100 bg-rose-50/10' : 
                                                  urgency === 'high' ? 'border-amber-100 bg-amber-50/10' : 'border-slate-50'
                                                } hover:shadow-xl hover:shadow-slate-200/40`}
                                              >
                                                <div className="flex flex-col gap-6">
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-4">
                                                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                                                        urgency === 'critical' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'
                                                      }`}>
                                                        {trip.usuarioNombre?.charAt(0) || 'U'}
                                                      </div>
                                                      <div>
                                                        <h4 className="text-base font-black text-slate-900 truncate uppercase tracking-tight">{trip.usuarioNombre}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                          <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded-md uppercase">
                                                            {trip.tipo || 'Viaje'}
                                                          </span>
                                                          <span className="text-[10px] font-black text-indigo-600">${trip.valor?.toLocaleString()}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                                                      urgency === 'critical' ? 'bg-rose-500 text-white animate-pulse' : 
                                                      urgency === 'high' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'
                                                    }`}>
                                                      {diffMin}m esperando
                                                    </div>
                                                  </div>

                                                  <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                      <p className="text-[11px] font-bold text-slate-500 truncate">{trip.ruta?.origen?.split(',')[0] || trip.origenTexto}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                      <p className="text-[11px] font-black text-slate-700 truncate">{trip.ruta?.destino?.split(',')[0] || trip.destinoTexto}</p>
                                                    </div>
                                                  </div>

                                                  <div className="flex gap-2">
                                                    <button 
                                                      onClick={() => {
                                                        let phone = trip.usuarioTelefono?.replace(/\D/g, '') || '';
                                                        if (!phone) {
                                                          toast.error("El usuario no tiene un teléfono registrado");
                                                          return;
                                                        }
                                                        if (phone.length === 10) phone = `57${phone}`;
                                                        
                                                        const mensaje = encodeURIComponent(`Hola ${trip.usuarioNombre}, soy el administrador de Ruedas Rápidas. Vemos que tienes un servicio en espera, ¿todo bien?`);
                                                        window.open(`https://wa.me/${phone}?text=${mensaje}`, '_blank');
                                                      }}
                                                      className="flex-1 h-10 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 cursor-pointer"
                                                    >
                                                      <Headphones size={13} />
                                                      LLAMAR
                                                    </button>
                                                    <button 
                                                      onClick={() => {
                                                        setAdminMessageTarget({ id: trip.usuarioId, nombre: trip.usuarioNombre, type: 'usuario' });
                                                        setShowAdminMessageModal(true);
                                                      }}
                                                      className="flex-1 h-10 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-black transition-all shadow-lg shadow-slate-200 cursor-pointer"
                                                    >
                                                      <MessageCircle size={13} />
                                                      NOTIFICAR
                                                    </button>
                                                    <button 
                                                      onClick={() => {
                                                        setSelectedTripForAdminCancel(trip);
                                                        setAdminCancelReason('Tiempo de espera prolongado');
                                                        setAdminCancelCustomReason('');
                                                        setShowAdminCancelTripModal(true);
                                                      }}
                                                      className="flex-1 h-10 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-rose-100 transition-all shadow-md shadow-rose-100/50 cursor-pointer"
                                                    >
                                                      <XCircle size={13} />
                                                      ANULAR
                                                    </button>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Available Drivers Column */}
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-4">
                                          <div className="h-[2px] w-4 bg-emerald-500 rounded-full" />
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Flota Disponible</span>
                                        </div>
                                        <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-6 space-y-4 max-h-[600px] overflow-y-auto no-scrollbar">
                                          {cityDrivers.length > 0 ? cityDrivers.map((d, dIdx) => (
                                            <motion.div 
                                              initial={{ opacity: 0, x: 20 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: dIdx * 0.05 }}
                                              key={d.id}
                                              className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 group hover:border-emerald-200 transition-all shadow-sm"
                                            >
                                              <div className="relative">
                                                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                                                  {d.foto ? (
                                                    <img src={d.foto} alt="" className="w-full h-full object-cover" />
                                                  ) : (
                                                    <UserIcon className="text-white/20" size={20} />
                                                  )}
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <h5 className="text-xs font-black text-slate-800 uppercase truncate leading-tight">{d.nombre}</h5>
                                                <div className="flex items-center gap-2 mt-1">
                                                  <div className="flex items-center gap-0.5">
                                                    <Star size={8} className="text-amber-500 fill-amber-500" />
                                                    <span className="text-[9px] font-bold text-amber-600">{d.calificacion?.toFixed(1) || '5.0'}</span>
                                                  </div>
                                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[80px]">
                                                    {d.vehiculo?.modelo || d.vehiculo?.tipo}
                                                  </span>
                                                </div>
                                              </div>
                                              <button 
                                                onClick={() => {
                                                  let phone = d.telefono?.replace(/\D/g, '') || '';
                                                  if (!phone) {
                                                    toast.error("El conductor no tiene un teléfono registrado");
                                                    return;
                                                  }
                                                  
                                                  // Hardening for Colombia: if 10 digits, add 57. If starts with 57, keep it.
                                                  if (phone.length === 10) {
                                                    phone = `57${phone}`;
                                                  } else if (phone.length > 10 && phone.startsWith('0')) {
                                                    // some old formats or mistakes
                                                    phone = `57${phone.substring(1)}`;
                                                  }

                                                  const mensaje = encodeURIComponent(`Hola ${d.nombre}, hay servicios pendientes en ${city}. ¿Estás disponible?`);
                                                  window.open(`https://wa.me/${phone}?text=${mensaje}`, '_blank');
                                                }}
                                                className="h-10 px-4 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all font-black text-[9px] uppercase tracking-widest shadow-sm border border-emerald-100"
                                                title="Gestionar por WhatsApp"
                                              >
                                                <MessageCircle size={14} />
                                                GESTIONAR
                                              </button>
                                            </motion.div>
                                          )) : (
                                            <div className="py-12 text-center space-y-4">
                                              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto text-rose-200 border border-rose-50 shadow-sm">
                                                <ShieldAlert size={28} />
                                              </div>
                                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest px-4">Sin conductores disponibles en esta ciudad</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }) : (
                                <div className="py-32 text-center bg-white rounded-[4rem] border-2 border-slate-50 border-dashed space-y-8">
                                  <div className="relative mx-auto w-32 h-32">
                                    <div className="absolute inset-0 bg-emerald-500/5 rounded-full animate-pulse scale-150 blur-3xl" />
                                    <div className="relative w-full h-full bg-white rounded-[3rem] border border-slate-100 flex items-center justify-center text-emerald-500 shadow-2xl">
                                      <ShieldCheck size={56} strokeWidth={1.5} />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">Zona Despejada</h4>
                                    <p className="text-sm text-slate-400 font-medium px-8 mx-auto max-sm:px-4 max-w-sm">No hay servicios detenidos. El sistema fluye con normalidad operativa.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {adminSubTab === 'historial' && (
                          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* Analytics section - Simplified for elegance */}
                            <div className="relative overflow-hidden group">
                              <div className="absolute inset-0 bg-slate-900 rounded-[3.5rem]" />
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                              <div className="relative p-12 text-white">
                                <div className="flex flex-col lg:flex-row gap-12">
                                  {/* Stats Summary */}
                                  <div className="lg:w-1/3 space-y-10">
                                    <div className="space-y-4">
                                      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-900/40">
                                        Auditoría Crítica
                                      </div>
                                      <h3 className="text-4xl font-black tracking-tighter leading-tight">Métricas de <br/><span className="text-rose-400">Deserción</span></h3>
                                      <p className="text-slate-400 text-sm font-medium leading-relaxed">Información consolidada de cancelaciones por usuario, conductor y sistema.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Total Hoy</p>
                                        <p className="text-3xl font-mono font-black">{historicalWaitingStats.todayStats.total}</p>
                                      </div>
                                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Valor Perdido</p>
                                        <p className="text-xl font-mono font-black text-rose-400">${historicalWaitingStats.todayStats.valorTotal.toLocaleString()}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Trend Chart */}
                                  <div className="lg:flex-1 bg-white/5 p-8 rounded-[3rem] border border-white/10 flex flex-col">
                                    <div className="flex justify-between items-center mb-8">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico Semanal</p>
                                      <div className="flex gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                        <div className="w-2 h-2 rounded-full bg-white/10" />
                                      </div>
                                    </div>
                                    <div className="h-64">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={historicalWaitingStats.trend}>
                                          <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                            </linearGradient>
                                          </defs>
                                          <XAxis dataKey="name" hide />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', fontSize: '10px' }}
                                            itemStyle={{ color: '#fff' }}
                                          />
                                          <Area type="monotone" dataKey="total" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Detailed Cancellation Feed - Persists even after notification clear */}
                            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm p-10">
                              <div className="flex items-center justify-between mb-10">
                                <div>
                                  <h4 className="text-xl font-black text-slate-900 tracking-tight">Registro Maestro de Cancelaciones</h4>
                                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Archivo histórico de hoy - Datos Inmutables</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-mono font-black text-indigo-600">{historicalWaitingStats.todayCancelled.length}</p>
                                  <p className="text-[8px] font-black text-slate-400 uppercase uppercase">Incidentes</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {historicalWaitingStats.todayCancelled.slice(0, 18).map((trip: any) => (
                                  <div key={trip.id} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all group overflow-hidden">
                                    <div className="flex justify-between items-start mb-6">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl ${
                                        trip.canceladoPor === 'usuario' ? 'bg-indigo-500 shadow-indigo-100' :
                                        trip.canceladoPor === 'conductor' ? 'bg-amber-500 shadow-amber-100' : 'bg-slate-800 shadow-slate-100'
                                      }`}>
                                        {trip.canceladoPor === 'usuario' ? <UserIcon size={20} /> : <Car size={20} />}
                                      </div>
                                      <p className="text-[10px] font-mono font-black text-slate-400">
                                        {new Date(trip.fecha_cancelacion || trip.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                    <div className="space-y-4">
                                      <div>
                                        <p className="text-sm font-black text-slate-800 truncate">{trip.usuarioNombre}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Cliente del servicio</p>
                                      </div>
                                      <div className="space-y-1">
                                         <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 truncate">
                                          <MapPin size={10} className="shrink-0 text-indigo-400" />
                                          {trip.ruta?.origen?.split(',')[0]}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 truncate">
                                          <Navigation size={10} className="shrink-0 text-emerald-400" />
                                          {trip.ruta?.destino?.split(',')[0]}
                                        </div>
                                      </div>

                                      {/* City Metadata */}
                                      <div className="pt-3 border-t border-slate-100 flex gap-4">
                                        <div className="flex flex-col">
                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ciudad Usuario</span>
                                          <span className="text-[9px] font-bold text-slate-700 truncate">{trip.usuarioCiudad || trip.ciudad || 'N/A'}</span>
                                        </div>
                                        {trip.conductorId && (
                                          <div className="flex flex-col border-l border-slate-100 pl-4">
                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ciudad Conductor</span>
                                            <span className="text-[9px] font-bold text-slate-700 truncate">{trip.conductorCiudad || 'N/A'}</span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                                        <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${
                                          trip.estado === 'finalizado_cancelado' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                        }`}>
                                          {trip.estado === 'finalizado_cancelado' ? 'Auditado' : 'Pendiente'}
                                        </span>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => {
                                              setAdminMessageTarget({ id: trip.usuarioId, nombre: trip.usuarioNombre, type: 'usuario' });
                                              setShowAdminMessageModal(true);
                                            }}
                                            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all font-bold"
                                          >
                                            <MessageCircle size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {historicalWaitingStats.todayCancelled.length === 0 && (
                                <div className="py-20 text-center opacity-40">
                                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sin registros negativos hoy</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {adminSubTab === 'recargas' && (
                        <div className="space-y-6">
                          {/* Financial BI Dashboard Header */}
                          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                              <CreditCard size={120} />
                            </div>
                            <div className="relative z-10">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <CreditCard size={24} />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-black uppercase tracking-widest">Dashboard Financiero</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Recaudos y flujo de caja</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Hoy:</p>
                                  <p className="text-lg font-mono font-black text-emerald-400">${rechargesStats.dailyTotal.toLocaleString()}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Recaudación Aprobada</p>
                                    <span className="text-[8px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">{rechargesStats.approvedCount}</span>
                                  </div>
                                  <p className="text-2xl font-mono font-black text-white">${rechargesStats.totalCalculated.toLocaleString()}</p>
                                </div>

                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Ajustes Manuales</p>
                                    <span className="text-[8px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">{rechargesStats.manualCount}</span>
                                  </div>
                                  <p className="text-2xl font-mono font-black text-white">${rechargesStats.totalManuales.toLocaleString()}</p>
                                </div>

                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Cierre Mes</p>
                                  </div>
                                  <p className="text-2xl font-mono font-black text-white">${rechargesStats.monthlyTotal.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Charts Section */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500">
                              <div className="flex items-center justify-between mb-8">
                                <div>
                                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Curva de Recaudos (7D)</h4>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Tendencia semanal de ingresos</p>
                                </div>
                                <div className="flex gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                    <Zap size={14} />
                                  </div>
                                </div>
                              </div>
                              <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={rechargesStats.last7Days}>
                                    <defs>
                                      <linearGradient id="colorTotalRec" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                      dataKey="name" 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} 
                                    />
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontSize: '10px', fontWeight: 'bold', padding: '16px' }}
                                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Recaudado']}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotalRec)" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 space-y-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Top Conductores</h4>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Mayores contribuyentes al flujo</p>
                                </div>
                                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                                  <Star size={14} />
                                </div>
                              </div>
                              <div className="space-y-3">
                                {rechargesStats.topDrivers.map((d: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm group-hover:rotate-6 transition-transform ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400'}`}>
                                        {idx + 1}
                                      </div>
                                      <p className="text-[11px] font-black text-slate-700">{d.name}</p>
                                    </div>
                                    <p className="text-[11px] font-mono font-black text-indigo-600">${d.total.toLocaleString()}</p>
                                  </div>
                                ))}
                                {rechargesStats.topDrivers.length === 0 && (
                                  <div className="h-40 flex flex-col items-center justify-center text-slate-300">
                                    <AlertCircle size={32} strokeWidth={1} className="mb-2 opacity-50" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Sin datos suficientes</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {recargasPendientes.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-red-50 border border-red-100 p-4 rounded-[2rem] flex items-center gap-4 mb-2"
                            >
                              <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100 animate-bounce">
                                <PlusCircle size={24} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-red-900">¡Atención Administrador!</p>
                                <p className="text-[10px] text-red-600 font-medium">Tienes {recargasPendientes.length} recargas esperando tu aprobación inmediata.</p>
                              </div>
                            </motion.div>
                          )}
                          
                          <div className="bg-white rounded-[2rem] p-1 border border-slate-100 shadow-sm flex gap-1">
                            <button 
                              onClick={() => {
                                // Podríamos usar un estado interno si quisiéramos, por ahora lo manejamos con scroll o secciones
                                document.getElementById('pendientes-section')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="flex-1 py-3 px-4 rounded-3xl text-[10px] font-bold tracking-[0.1em] uppercase transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                            >
                              Pendientes ({recargasPendientes.length})
                            </button>
                            <button 
                              onClick={() => {
                                document.getElementById('historial-section')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="flex-1 py-3 px-4 rounded-3xl text-[10px] font-bold tracking-[0.1em] uppercase transition-all hover:bg-slate-50 text-slate-400"
                            >
                              Historial ({historialRecargas.length})
                            </button>
                          </div>

                          <div id="pendientes-section" className="space-y-4 pt-4">
                            <div className="flex items-center justify-between px-2">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Solicitudes de Saldo</h4>
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{recargasPendientes.length} Pendientes</span>
                            </div>
                            
                            {recargasPendientes.length > 0 ? (
                              <div className="space-y-3">
                                {recargasPendientes.map((recarga, rIdx) => (
                                  <motion.div 
                                    layout
                                    key={recarga.id || `recarga-pend-${rIdx}`} 
                                    className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                                  >
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                          <UserIcon size={20} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-bold text-slate-800">{recarga.conductorNombre}</p>
                                          <p className="text-[10px] text-slate-400">{new Date(recarga.fecha).toLocaleString()}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-mono font-bold text-emerald-600">${recarga.valor.toLocaleString()}</p>
                                        <button 
                                          onClick={() => {
                                            navigator.clipboard.writeText(recarga.nubankKey);
                                            toast.success("Clave copiada al portapapeles");
                                          }}
                                          className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter hover:underline flex items-center gap-1 justify-end"
                                        >
                                          {recarga.nubankKey}
                                          <PlusCircle size={8} />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2 pt-4 border-t border-slate-50">
                                      <button 
                                        onClick={async () => {
                                          try {
                                            await aprobarRecarga(recarga.id, recarga.conductorId, recarga.valor, user?.uid);
                                            toast.success(`Recarga de ${recarga.conductorNombre} aprobada`);
                                          } catch (error) {
                                            toast.error("Error al aprobar recarga");
                                          }
                                        }}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold py-3 rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                                      >
                                        <Check size={14} />
                                        APROBAR RECARGA
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          try {
                                            await rechazarRecarga(recarga.id, user?.uid);
                                            toast.info(`Recarga de ${recarga.conductorNombre} rechazada`);
                                          } catch (error) {
                                            toast.error("Error al rechazar recarga");
                                          }
                                        }}
                                        className="w-12 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all flex items-center justify-center border border-slate-200"
                                        title="Rechazar"
                                      >
                                        <X size={18} />
                                      </button>
                                    </div>

                                  </motion.div>
                                ))}
                              </div>
                            ) : (
                              <div className="py-12 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 space-y-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-200 shadow-sm">
                                  <CreditCard size={24} />
                                </div>
                                <p className="text-xs text-slate-400 font-medium">No hay recargas esperando aprobación</p>
                              </div>
                            )}
                          </div>

                          <div id="historial-section" className="space-y-4 pt-8 pb-12">
                            <div className="flex items-center justify-between px-2">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Historial Reciente</h4>
                              <Clock size={14} className="text-slate-300" />
                            </div>

                            <div className="space-y-2">
                              {historialRecargas.filter(r => r.estado !== 'pendiente').map((recarga, rIdx) => (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  key={recarga.id || `recarga-hist-${rIdx}`} 
                                  className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                      recarga.tipo === 'manual' ? 'bg-amber-50 text-amber-500' :
                                      recarga.tipo === 'ajuste_saldo_usuario' ? 'bg-indigo-50 text-indigo-500' :
                                      recarga.estado === 'aprobada' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                                    }`}>
                                      {recarga.tipo === 'manual' ? <PlusCircle size={16} /> :
                                       recarga.tipo === 'ajuste_saldo_usuario' ? <Star size={16} /> :
                                       recarga.estado === 'aprobada' ? <Check size={16} /> : <X size={16} />}
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-bold text-slate-700">
                                        {recarga.conductorNombre || recarga.usuarioNombre || 'Sistema'}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[9px] text-slate-400">{new Date(recarga.fecha).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
                                        <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">•</span>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                          {recarga.tipo === 'manual' ? 'Recarga Manual' :
                                           recarga.tipo === 'ajuste_saldo_usuario' ? 'Ajuste Usuario' :
                                           recarga.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className={`text-sm font-mono font-bold ${
                                      recarga.estado === 'aprobada' ? 'text-emerald-500' : 'text-slate-300'
                                    }`}>
                                      ${recarga.valor.toLocaleString()}
                                    </p>
                                    {recarga.procesadaPor && (
                                      <p className="text-[8px] text-slate-300 uppercase font-black tracking-tighter">ID: {recarga.procesadaPor.slice(-4)}</p>
                                    )}
                                  </div>
                                </motion.div>
                              ))}

                              {historialRecargas.filter(r => r.estado !== 'pendiente').length === 0 && (
                                <div className="py-12 text-center text-slate-300 italic text-[10px]">
                                  No hay historial disponible
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {adminSubTab === 'activacion' && (
                        <div className="space-y-6">
                          <AdminDriversPanel adminUid={user?.uid} />
                        </div>
                      )}

                      {adminSubTab === 'conductores' && (
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                            <div className="space-y-1">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Gestión de Flota</h4>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold border border-emerald-100">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  {allDrivers.filter(d => d.activo).length} EN LÍNEA
                                </span>
                                <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-bold border border-slate-100">
                                  {allDrivers.length} TOTAL
                                </span>
                              </div>
                            </div>

                            <div className="relative group">
                              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                <Search size={16} />
                              </div>
                              <input 
                                type="text"
                                placeholder="Buscar conductor o placa..."
                                value={driverSearchTerm}
                                onChange={(e) => setDriverSearchTerm(e.target.value)}
                                className="w-full md:w-64 bg-white border border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-200 transition-all shadow-sm"
                              />
                            </div>
                          </div>

                          <div className="grid gap-4">
                            {allDrivers
                              .filter(d => 
                                d.nombre?.toLowerCase().includes(driverSearchTerm.toLowerCase()) || 
                                d.vehiculo?.placa?.toLowerCase().includes(driverSearchTerm.toLowerCase())
                              )
                              .sort((a, b) => (b.activo ? 1 : 0) - (a.activo ? 1 : 0))
                              .map((cond, cIdx) => (
                              <motion.div 
                                layout
                                key={cond.id || `driver-item-${cIdx}`} 
                                className={`bg-white p-6 rounded-[2.5rem] border shadow-sm space-y-5 transition-all group ${cond.activo ? 'border-emerald-100 ring-4 ring-emerald-50/20' : 'border-slate-100'}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-4">
                                    <div className="relative">
                                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 transform group-hover:scale-105 shadow-inner ${
                                        cond.vehiculo?.tipo === 'taxi'
                                          ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                                          : cond.activo 
                                            ? 'bg-emerald-50 text-emerald-600' 
                                            : 'bg-slate-50 text-slate-400'
                                      }`}>
                                        {cond.vehiculo?.tipo?.toLowerCase() === 'taxi' ? <Taxi size={24} /> :
                                         cond.vehiculo?.tipo?.toLowerCase().includes('moto') ? <Bike size={24} /> : 
                                         <Car size={24} />}
                                      </div>
                                      {cond.activo && (
                                        <div className={`absolute -top-1 -right-1 w-4 h-4 border-2 border-white rounded-lg shadow-sm ${cond.en_servicio ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-base font-bold text-slate-800">{cond.nombre}</p>
                                        <div className="flex gap-1 items-center flex-wrap">
                                          {(() => {
                                            const matchingUser = allUsers.find(u => u.id === cond.id);
                                            if (matchingUser?.rol === 'ambos') {
                                              return (
                                                <span className="text-[8px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                  Ambos (Pasajero/Conductor)
                                                </span>
                                              );
                                            } else if (matchingUser?.rol === 'conductor') {
                                              return (
                                                <span className="text-[8px] font-black bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                  Solo Conductor
                                                </span>
                                              );
                                            } else if (matchingUser?.rol === 'admin' || matchingUser?.rol === 'admin_suplente') {
                                              return (
                                                <span className="text-[8px] font-black bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                  Admin Conductor
                                                </span>
                                              );
                                            } else {
                                              return (
                                                <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                  Conductor
                                                </span>
                                              );
                                            }
                                          })()}

                                          {cond.aprobado === false && (
                                            <span className="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm shadow-amber-100">Esperando Verificación</span>
                                          )}
                                          {cond.bloqueado ? (
                                            <AdminDriverBlockBadge cond={cond} />
                                          ) : cond.activo ? (
                                            <>
                                              <span className="text-[8px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm shadow-emerald-100">En Línea</span>
                                              {cond.en_servicio ? (
                                                <span className="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm shadow-amber-100 animate-pulse">En Ruta</span>
                                              ) : (
                                                <span className="text-[8px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm shadow-indigo-100">Esperando</span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Desconectado</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[10px] text-slate-500 font-bold tracking-tighter bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{cond.vehiculo?.placa}</p>
                                        <span className="text-[10px] text-slate-400 font-medium">•</span>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
                                          {cond.vehiculo?.tipo?.toLowerCase() === 'taxi' ? 'Taxi' :
                                           cond.vehiculo?.tipo?.toLowerCase().includes('moto') ? 'Motocicleta' : 
                                           ['camion_flete', 'camion_acarreo', 'motocarro'].includes(cond.vehiculo?.tipo) ? 'Carga' :
                                           'Automóvil'}
                                        </p>
                                        <span className="text-[10px] text-slate-400 font-medium">•</span>
                                        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                                          <MapPin size={10} />
                                          {cond.ciudad || 'N/A'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-mono font-bold text-emerald-600">${cond.tarjeta_virtual?.toLocaleString()}</p>
                                    <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 justify-end mt-1">
                                      <Star size={12} fill="currentColor" />
                                      {cond.calificacion?.toFixed(1) || '5.0'}
                                      <span className="text-slate-300 ml-1 text-[9px] font-medium opacity-50">({cond.servicios_completados || 0})</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 sm:col-span-1">
                                    <p className="text-[9px] uppercase font-bold text-slate-400 mb-3 tracking-[0.1em]">Documentos</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {['licencia', 'soat', 'cedula'].map(docType => (
                                        <button
                                          key={docType}
                                          onClick={() => {
                                            const newDocs = { ...cond.documentos_autorizados, [docType]: !cond.documentos_autorizados?.[docType] };
                                            updateDoc(doc(db, 'conductores', cond.id), { documentos_autorizados: newDocs });
                                            toast.info(`${docType.toUpperCase()} actualizado`);
                                          }}
                                          className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase transition-all ${cond.documentos_autorizados?.[docType] ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-100/50' : 'bg-white text-slate-400 border border-slate-200'}`}
                                        >
                                          {docType}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="sm:col-span-3 flex gap-2">
                                    <button 
                                      onClick={() => {
                                        setAdminMessageTarget({ id: cond.id, nombre: cond.nombre, type: 'conductor' });
                                        setShowAdminMessageModal(true);
                                      }}
                                      className="flex-1 bg-white hover:bg-slate-50 text-slate-500 text-[10px] font-bold rounded-2xl border border-slate-200 transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5"
                                    >
                                      <MessageCircle size={18} className="text-indigo-400" />
                                      MENSAJE
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const phone = cleanPhone(cond.telefono || cond.celular);
                                        if (phone) {
                                          window.open(`https://wa.me/${phone}?text=Hola+${encodeURIComponent(cond.nombre || '')},+te+escribo+de+Ruedas+Rápidas.`, '_blank');
                                        } else {
                                          toast.error(`No hay un número de WhatsApp o celular registrado para ${cond.nombre || 'este conductor'}`);
                                        }
                                      }}
                                      className="flex-1 bg-white hover:bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-2xl border border-slate-200 transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5"
                                    >
                                      <MessageCircle size={18} />
                                      WHATSAPP
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setAdminActionType('edit_saldo_conductor');
                                        setAdminActionTarget(cond);
                                        setAdminActionValue(String(cond.tarjeta_virtual || 0));
                                        setShowAdminActionModal(true);
                                      }}
                                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 border border-indigo-500"
                                    >
                                      <CreditCard size={18} />
                                      SALDO
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setAdminActionType('confirm_bloqueo_conductor');
                                        setAdminActionTarget(cond);
                                        setShowAdminActionModal(true);
                                      }}
                                      className={`flex-1 rounded-2xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold border ${cond.bloqueado ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}
                                    >
                                      {cond.bloqueado ? <Unlock size={18} /> : <Lock size={18} />}
                                      {cond.bloqueado ? 'HABILITAR' : 'BLOQUEAR'}
                                    </button>
                                  </div>

                                  {/* Action Toggle - Document Verification / Approval */}
                                  <div className="sm:col-span-3 mt-4 p-5 bg-amber-50 border border-amber-100 rounded-[2.5rem]">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                                          <FileText size={20} />
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Aprobación General</p>
                                          <p className="text-[9px] text-amber-500 font-medium">
                                            {cond.aprobado !== false ? 'Conductor validado y aprobado' : 'Esperando verificación de documentos'}
                                          </p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={async () => {
                                          const newState = cond.aprobado === false ? true : false;
                                          await updateDoc(doc(db, 'conductores', cond.id), { aprobado: newState });
                                          toast.success(newState ? "Conductor Aprobado" : "Conductor puesto en Espera");
                                        }}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm shrink-0 ${
                                          cond.aprobado !== false 
                                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 border border-rose-200' 
                                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        }`}
                                      >
                                        {cond.aprobado !== false ? 'Desaprobar' : 'Validar y Aprobar'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Action Toggle - Expreso Authorization */}
                                  <div className="sm:col-span-3 mt-4 p-5 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] mb-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                          <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Servicio Expreso</p>
                                          <p className="text-[9px] text-indigo-400 font-medium">{cond.expreso_habilitado ? 'Habilitado para viajes expresos' : 'Autorización especial requerida'}</p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => {
                                          const newState = !cond.expreso_habilitado;
                                          updateDoc(doc(db, 'conductores', cond.id), { expreso_habilitado: newState });
                                          toast.success(newState ? "Habilitado para Expreso" : "Habilitación revocada");
                                        }}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm ${
                                          cond.expreso_habilitado 
                                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                      >
                                        {cond.expreso_habilitado ? 'Revocar' : 'Habilitar'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                            
                            {allDrivers.filter(d => 
                                d.nombre?.toLowerCase().includes(driverSearchTerm.toLowerCase()) || 
                                d.vehiculo?.placa?.toLowerCase().includes(driverSearchTerm.toLowerCase())
                            ).length === 0 && (
                              <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100 space-y-4">
                                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto text-slate-200 shadow-sm">
                                  <Car size={32} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-slate-400">No se encontraron conductores</p>
                                  <p className="text-[10px] text-slate-300 px-8 mx-auto max-w-xs">Verifica placa o nombre.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {adminSubTab === 'usuarios' && (
                        <div className="space-y-6">
                          {unattendedTrips.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-rose-50 border border-rose-100 p-4 rounded-[2rem] flex items-center gap-3 shadow-sm"
                            >
                              <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center animate-pulse">
                                <AlertTriangle size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-rose-800">{unattendedTrips.length} servicios sin atender</p>
                                <p className="text-[10px] text-rose-600 font-medium">Hay solicitudes pendientes hace más de 5 minutos.</p>
                              </div>
                              <button 
                                onClick={() => setAdminSubTab('espera')}
                                className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-4 py-2 rounded-xl"
                              >
                                VER TODOS
                              </button>
                            </motion.div>
                          )}

                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                            <div className="space-y-1">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Base de Usuarios</h4>
                              <p className="text-[11px] text-slate-500 font-medium">{allUsers.filter(u => u.rol !== 'marca_aliada').length} registros totales</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              {/* Filter Pills */}
                              <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1 text-[10px] font-bold">
                                <button
                                  onClick={() => setUserPromoFilter('todos')}
                                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${userPromoFilter === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                  Todos
                                </button>
                                <button
                                  onClick={() => setUserPromoFilter('sin_bono')}
                                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${userPromoFilter === 'sin_bono' ? 'bg-amber-500 text-white shadow-sm font-black' : 'text-slate-500 hover:text-amber-600'}`}
                                >
                                  🎁 Sin Bono ($0)
                                </button>
                                <button
                                  onClick={() => setUserPromoFilter('con_bono')}
                                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${userPromoFilter === 'con_bono' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-emerald-600'}`}
                                >
                                  ⚡ Con Bono
                                </button>
                              </div>

                              <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                  <Search size={16} />
                                </div>
                                <input 
                                  type="text"
                                  placeholder="Buscar por nombre o email..."
                                  value={userSearchTerm}
                                  onChange={(e) => setUserSearchTerm(e.target.value)}
                                  className="w-full md:w-64 bg-white border border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-200 transition-all shadow-sm"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3">
                            {allUsers
                              .filter(u => {
                                if (u.rol === 'marca_aliada') return false;
                                const matchesSearch = u.nombre?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                                     u.email?.toLowerCase().includes(userSearchTerm.toLowerCase());
                                if (!matchesSearch) return false;

                                if (userPromoFilter === 'sin_bono') {
                                  return (u.saldo_promo || 0) === 0;
                                }
                                if (userPromoFilter === 'con_bono') {
                                  return (u.saldo_promo || 0) > 0;
                                }
                                return true;
                              })
                              .map((u, uIdx) => (
                              <div key={u.id || `user-item-${uIdx}`} className="space-y-1">
                                <motion.div 
                                  layout
                                  className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500 relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group z-10"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="relative">
                                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 transform shadow-inner bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:rotate-3">
                                        <UserIcon size={24} />
                                      </div>
                                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center shadow-sm ${
                                        u.rol === 'admin' 
                                          ? 'bg-indigo-500 text-white' 
                                          : u.rol === 'admin_suplente'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-emerald-500 text-white'
                                      }`}>
                                        <Shield size={10} />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-base font-bold text-slate-800">{u.nombre}</p>
                                        {u.rol === 'admin' && (
                                          <span className="bg-purple-50 text-purple-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                            <Shield size={8} /> ADMINISTRADOR
                                          </span>
                                        )}
                                        {u.rol === 'admin_suplente' && (
                                          <span className="bg-amber-50 text-amber-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                            <Shield size={8} /> SUPLENTE
                                          </span>
                                        )}
                                        {u.rol === 'conductor' && (
                                          <span className="bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                                            <Car size={8} /> CONDUCTOR
                                          </span>
                                        )}
                                        {u.rol === 'ambos' && (
                                          <span className="bg-orange-50 text-orange-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-orange-200 flex items-center gap-1">
                                            <UserIcon size={8} /> + <Car size={8} /> AMBOS (PASAJERO / CONDUCTOR)
                                          </span>
                                        )}
                                        {u.rol === 'usuario' && (
                                          <span className="bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                            <UserIcon size={8} /> PASAJERO
                                          </span>
                                        )}
                                        {(u.saldo_promo || 0) === 0 && (
                                          <span className="bg-amber-50 text-amber-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                            🎁 SIN BONO INICIAL
                                          </span>
                                        )}
                                        {u.bloqueado && (
                                          <span className="bg-red-50 text-red-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-red-100">Bloqueado</span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-400 font-medium tracking-tight flex items-center gap-1.5 flex-wrap">
                                        <span>{u.email}</span>
                                        {(u.celular || u.telefono) && (
                                          <>
                                            <span className="text-slate-300">•</span>
                                            <span className="font-mono text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                                              📱 {u.celular || u.telefono}
                                            </span>
                                          </>
                                        )}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                                          (u.saldo_promo || 0) > 0 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold' 
                                            : 'bg-slate-100 text-slate-400 font-medium'
                                        }`}>
                                          <CreditCard size={10} className={(u.saldo_promo || 0) > 0 ? "text-emerald-500" : "text-slate-400"} />
                                          <p className="text-[10px]">Bono Promo: ${(u.saldo_promo || 0).toLocaleString()} COP</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50/50 rounded-lg">
                                          <Navigation size={10} className="text-amber-400" />
                                          <p className="text-[10px] font-bold text-amber-600">{u.servicios_count || 0} Exitosos</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50/50 rounded-lg" title="Servicios cancelados o no atendidos">
                                          <X size={10} className="text-rose-400" />
                                          <p className="text-[10px] font-bold text-rose-600">{u.servicios_perdidos || 0} Perdidos</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50/50 rounded-lg">
                                          <MapPin size={10} className="text-emerald-400" />
                                          <p className="text-[10px] font-bold text-emerald-600">{u.ciudad || 'N/A'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 w-full sm:w-[32rem] mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-50">
                                    <div className="flex gap-2 w-full">
                                      <button 
                                        onClick={() => {
                                          setAdminMessageTarget({ id: u.id, nombre: u.nombre, type: 'usuario' });
                                          setShowAdminMessageModal(true);
                                        }}
                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-500 text-[10px] font-bold py-3 px-2 rounded-2xl border border-slate-200 transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                        <MessageCircle size={18} className="text-indigo-400" />
                                        MENSAJE
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const phone = cleanPhone(u.celular || u.telefono);
                                          if (phone) {
                                            window.open(`https://wa.me/${phone}?text=Hola+${encodeURIComponent(u.nombre || '')},+te+escribo+de+Ruedas+Rápidas.`, '_blank');
                                          } else {
                                            toast.error(`No hay un número de WhatsApp o celular registrado para ${u.nombre || 'este usuario'}`);
                                          }
                                        }}
                                        className="flex-1 bg-white hover:bg-emerald-50 text-emerald-600 text-[10px] font-bold py-3 px-2 rounded-2xl border border-slate-200 transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
                                      >
                                        <MessageCircle size={18} />
                                        WHATSAPP
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setAdminActionType('edit_saldo_usuario');
                                          setAdminActionTarget(u);
                                          // Prefill with 10,000 if currently 0 for ultra-fast 1-click bonus assignment
                                          setAdminActionValue(u.saldo_promo ? String(u.saldo_promo) : '10000');
                                          setShowAdminActionModal(true);
                                        }}
                                        className={`flex-1 text-[10px] font-bold py-3 px-2 rounded-2xl shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                                          (u.saldo_promo || 0) === 0
                                            ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white shadow-emerald-200 border border-emerald-400 animate-pulse'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 border border-indigo-500'
                                        }`}
                                      >
                                        <CreditCard size={18} />
                                        {(u.saldo_promo || 0) === 0 ? '🎁 ASIGNAR BONO' : 'SALDO PROMO'}
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setAdminActionType('confirm_bloqueo_usuario');
                                          setAdminActionTarget(u);
                                          setShowAdminActionModal(true);
                                        }}
                                        className={`flex-1 rounded-2xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold border cursor-pointer py-3 px-2 ${
                                          u.bloqueado 
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                            : 'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}
                                      >
                                        {u.bloqueado ? <Unlock size={18} /> : <Lock size={18} />}
                                        {u.bloqueado ? 'HABILITAR' : 'BLOQUEAR'}
                                      </button>
                                      {u.rol !== 'admin' && (
                                        <button 
                                          onClick={() => {
                                            setAdminActionType('toggle_suplente');
                                            setAdminActionTarget(u);
                                            setShowAdminActionModal(true);
                                          }}
                                          className={`flex-1 rounded-2xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold border cursor-pointer py-3 px-2 ${
                                            u.rol === 'admin_suplente' 
                                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                          }`}
                                        >
                                          <Shield size={18} className={u.rol === 'admin_suplente' ? 'text-amber-500' : 'text-slate-400'} />
                                          {u.rol === 'admin_suplente' ? 'QUITAR SUPLENTE' : 'HACER SUPLENTE'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              </div>
                            ))}
                            
                            {allUsers.filter(u => 
                              u.rol !== 'marca_aliada' && (
                                u.nombre?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
                              )
                            ).length === 0 && (
                              <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100 space-y-4">
                                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto text-slate-200 shadow-sm">
                                  <UserIcon size={32} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-slate-400">No se encontraron usuarios</p>
                                  <p className="text-[10px] text-slate-300 px-8 mx-auto max-w-xs">Intenta con otros términos de búsqueda o verifica que el registro exista.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {adminSubTab === 'soporte' && (
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2">Chats de Soporte</h4>
                          <div className="space-y-3">
                            {supportChats.length === 0 ? (
                              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 text-center space-y-3">
                                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                                  <Headphones size={32} />
                                </div>
                                <p className="text-sm font-bold text-slate-400">No hay chats de soporte activos</p>
                              </div>
                            ) : (
                              supportChats.map((chat, cIdx) => (
                                <button 
                                  key={chat.conductorId || `chat-${cIdx}`}
                                  onClick={() => {
                                    setActiveSupportConductor({ id: chat.conductorId, nombre: chat.conductorNombre });
                                    setShowSupportChat(true);
                                  }}
                                  className="w-full bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all group text-left"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="relative">
                                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-bold text-lg">
                                        {(chat.conductorNombre || "?").charAt(0)}
                                      </div>
                                      {!chat.leidoPorAdmin && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 border-2 border-white rounded-full animate-pulse" />
                                      )}
                                    </div>
                                    <div>
                                      <h5 className="text-sm font-bold text-slate-800">{chat.conductorNombre}</h5>
                                      <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{chat.ultimaMensaje}</p>
                                    </div>
                                  </div>
                                  <div className="text-right space-y-1">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                                      {chat.ultimaFecha?.toDate ? new Date(chat.ultimaFecha.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                    </p>
                                    <div className="flex items-center gap-1.5 justify-end">
                                      {!chat.leidoPorAdmin && (
                                        <span className="text-[7px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md uppercase">Nuevo</span>
                                      )}
                                      <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {adminSubTab === 'aliados' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Formulario */}
                          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Store size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">
                                  {editingMarcaId ? 'Editar Marca Aliada' : 'Registrar Marca Aliada'}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-medium">Define un nodo fijo comercial en la plataforma</p>
                              </div>
                            </div>

                            <form onSubmit={guardarMarcaAliada} className="space-y-4">
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Nombre Comercial</label>
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Restaurante El Sabor Real"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={nuevaMarcaNombre}
                                  onChange={e => setNuevaMarcaNombre(e.target.value)}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Categoría</label>
                                  <select 
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none hover:bg-slate-100/50 cursor-pointer"
                                    value={nuevaMarcaCategoria}
                                    onChange={e => setNuevaMarcaCategoria(e.target.value)}
                                  >
                                    <option value="Restaurante">🍔 Restaurante</option>
                                    <option value="Droguería">💊 Droguería</option>
                                    <option value="Ferretería">🔨 Ferretería</option>
                                    <option value="Supermercado">🛒 Supermercado</option>
                                    <option value="Tecnología">💻 Tecnología</option>
                                    <option value="Otro">📦 Otro Negocio</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">WhatsApp</label>
                                  <input 
                                    required
                                    type="tel" 
                                    placeholder="Ej: 3123456789"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={nuevaMarcaWhatsapp}
                                    onChange={e => setNuevaMarcaWhatsapp(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Ciudad de Cobertura</label>
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Fusagasugá"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={nuevaMarcaCiudad}
                                  onChange={e => setNuevaMarcaCiudad(e.target.value)}
                                />
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {['Fusagasugá', 'Bogotá', 'Girardot', 'Melgar', 'Pasca', 'Silvania'].map(city => (
                                    <button
                                      key={city}
                                      type="button"
                                      onClick={() => setNuevaMarcaCiudad(city)}
                                      className={`text-[8px] font-bold px-2 py-1 rounded-md transition-colors ${nuevaMarcaCiudad.toLowerCase() === city.toLowerCase() ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                      {city}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Dirección Física (Referencia Fija)</label>
                                <div className="relative">
                                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500" />
                                  <input 
                                    required
                                    type="text" 
                                    placeholder="Ej: Calle 8 con Carrera 6 - Esquina Parque Principal"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={nuevaMarcaDireccion}
                                    onChange={e => setNuevaMarcaDireccion(e.target.value)}
                                  />
                                </div>
                                <p className="text-[9px] text-slate-400 ml-1 mt-1 italic">Este punto fijo actuará como Nodo de origen de los despachos.</p>
                              </div>

                              {/* Drag and Drop Admin Brand Logo Upload */}
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Logo del Comercio (Opcional)</label>
                                <div 
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    setAdminLogoDragActive(true);
                                  }}
                                  onDragLeave={() => setAdminLogoDragActive(false)}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setAdminLogoDragActive(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                      handleLogoUpload(e.dataTransfer.files[0], setNuevaMarcaLogo);
                                    }
                                  }}
                                  className={`mt-1 border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden ${
                                    adminLogoDragActive 
                                      ? 'border-indigo-500 bg-indigo-50/50' 
                                      : nuevaMarcaLogo 
                                        ? 'border-emerald-300 bg-emerald-50/10' 
                                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleLogoUpload(e.target.files[0], setNuevaMarcaLogo);
                                      }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                  />
                                  {nuevaMarcaLogo ? (
                                    <div className="flex flex-col items-center gap-2 text-center">
                                      <img 
                                        src={nuevaMarcaLogo} 
                                        alt="Logo previsualización" 
                                        className="w-16 h-16 rounded-xl object-cover border border-slate-100 shadow-sm"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1 justify-center">
                                          <Check size={12} /> ¡Logo cargado!
                                        </p>
                                        <button 
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setNuevaMarcaLogo('');
                                          }}
                                          className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase tracking-wider underline relative z-20 cursor-pointer"
                                        >
                                          Eliminar y cambiar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1.5 text-center py-2">
                                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                        <Upload size={16} />
                                      </div>
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] font-extrabold text-slate-700 leading-tight">
                                          Arrastra tu logo aquí o <span className="text-indigo-600 underline">busca un archivo</span>
                                        </p>
                                        <p className="text-[8px] text-slate-400 font-medium">Recomendado: Cuadrado, formato PNG, JPG o JPEG (Max 2MB)</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-2 pt-2">
                                <button
                                  type="submit"
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                >
                                  <Check size={14} />
                                  {editingMarcaId ? 'Guardar Cambios' : 'Registrar Marca'}
                                </button>
                                {editingMarcaId && (
                                  <button
                                    type="button"
                                    onClick={cancelarEditarMarca}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl text-xs transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </form>
                          </div>

                          {/* Catálogo */}
                          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <h4 className="text-sm font-bold text-slate-800">Marcas Registradas ({marcasAliadas.length})</h4>
                            
                            {marcasAliadas.length === 0 ? (
                              <div className="text-center py-20 space-y-3">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                  <Store size={26} />
                                </div>
                                <p className="text-xs font-bold text-slate-400">No hay Marcas Aliadas registradas aún.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                                {marcasAliadas.map((marca, mIdx) => {
                                  // Color schemes for categories
                                  let catBg = 'bg-orange-50 text-orange-600 border-orange-100';
                                  if (marca.categoria === 'Droguería') catBg = 'bg-rose-50 text-rose-600 border-rose-100';
                                  if (marca.categoria === 'Ferretería') catBg = 'bg-amber-50 text-amber-600 border-amber-100';
                                  if (marca.categoria === 'Supermercado') catBg = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                  if (marca.categoria === 'Tecnología') catBg = 'bg-blue-50 text-blue-600 border-blue-100';

                                  return (
                                    <div 
                                      key={marca.id || `marca-${mIdx}`} 
                                      className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-3 hover:shadow-md transition-all relative flex flex-col justify-between"
                                    >
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${catBg}`}>
                                            {marca.categoria || 'Otro'}
                                          </span>
                                          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                            {marca.ciudad}
                                          </span>
                                        </div>

                                        <h5 className="font-bold text-sm text-slate-800 truncate leading-tight">
                                          {marca.nombre}
                                        </h5>

                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <MapPin size={12} className="text-rose-500 shrink-0" />
                                            <span className="truncate" title={marca.direccion}>{marca.direccion}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Zap size={12} className="text-emerald-500 shrink-0" />
                                            <span className="font-mono text-[10px]">{marca.whatsapp}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                                        <button
                                          onClick={() => iniciarEditarMarca(marca)}
                                          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-600 font-bold py-1.5 rounded-lg transition-colors"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          onClick={() => eliminarMarcaAliada(marca.id)}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.section>
              )}
            </main>

            {/* Bottom Navigation */}
            <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 flex justify-around items-center shrink-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
              {perfil?.rol === 'usuario' && !conductor ? (
                <>
                  <button 
                    onClick={() => setActiveTab('usuario')}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'usuario' ? 'text-emerald-600 font-black scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <MapPin size={22} className={activeTab === 'usuario' ? 'stroke-[2.5]' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Viajar</span>
                  </button>
                </>
              ) : perfil?.rol === 'conductor' ? (
                <>
                  <button 
                    onClick={() => setActiveTab('conductor')}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'conductor' ? 'text-indigo-600 font-black scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <ShieldCheck size={22} className={activeTab === 'conductor' ? 'stroke-[2.5]' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Panel</span>
                  </button>

                  <button 
                    onClick={() => {
                      setSelectedLeaderboard(conductor?.vehiculo?.tipo === 'moto' ? 'moto' : conductor?.vehiculo?.tipo === 'taxi' ? 'taxi' : 'carro');
                      setShowLeaderboardModal(true);
                    }}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-amber-500 hover:scale-105 transition-all duration-300"
                  >
                    <Trophy size={22} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Ranking</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Ambos o admin o sin rol cargado */}
                  <button 
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'home' ? 'text-emerald-600 font-black scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Car size={22} className={activeTab === 'home' ? 'stroke-[2.5]' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Inicio</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('usuario')}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'usuario' ? 'text-emerald-600 font-black scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <MapPin size={22} className={activeTab === 'usuario' ? 'stroke-[2.5]' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Pasajero</span>
                  </button>

                  <button 
                    onClick={() => {
                      if (conductor) {
                        setActiveTab('conductor');
                      } else {
                        setShowDriverRegModal(true);
                      }
                    }}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'conductor' ? 'text-indigo-600 font-black scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <ShieldCheck size={22} className={activeTab === 'conductor' ? 'stroke-[2.5]' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Conductor</span>
                  </button>

                  <button 
                    onClick={() => {
                      setSelectedLeaderboard(conductor?.vehiculo?.tipo === 'moto' ? 'moto' : conductor?.vehiculo?.tipo === 'taxi' ? 'taxi' : 'carro');
                      setShowLeaderboardModal(true);
                    }}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-amber-500 hover:scale-105 transition-all duration-300"
                  >
                    <Trophy size={22} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Ranking</span>
                  </button>
                </>
              )}
            </nav>

            {/* Trip Request Modal */}
            <AnimatePresence>
              {showTripRequestModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={selectedServiceType === 'marcas_aliadas' ? "fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden" : "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"}
                >
                  <motion.div 
                    initial={selectedServiceType === 'marcas_aliadas' ? { opacity: 0, y: 10 } : { scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    className={selectedServiceType === 'marcas_aliadas' ? "bg-slate-50 w-full h-full flex flex-col relative" : "bg-white rounded-[2.5rem] w-full shadow-2xl transition-all duration-300 relative flex flex-col max-w-sm max-h-[90vh] p-8"}
                  >
                    <div className={`flex justify-between items-center shrink-0 ${
                      selectedServiceType === 'marcas_aliadas' 
                        ? 'border-b border-slate-100 bg-white pb-4 px-4 sm:px-6 pt-4' 
                        : 'mb-4'
                    }`}>
                      <h3 className="text-2xl font-black text-slate-900 capitalize tracking-tight flex items-center gap-2">
                        {selectedServiceType === 'marcas_aliadas' ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner shrink-0">
                              <Store size={20} />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-sm sm:text-base font-black text-slate-800 tracking-tight uppercase">Aliados Comerciales</span>
                                <span className="bg-rose-50 border border-rose-100 text-rose-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">Marketplace</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold leading-none mt-0.5">
                                {perfil?.ciudad || 'Fusagasugá'} • Envíos Seguros e Inmediatos
                              </p>
                            </div>
                          </div>
                        ) : (
                          `Solicitar ${selectedServiceType ? getServiceName(selectedServiceType) : ''}`
                        )}
                      </h3>
                      
                      <div className="flex items-center gap-2">
                        {selectedServiceType === 'marcas_aliadas' && (
                          <motion.button 
                            onClick={openMyBrandManager}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="hidden sm:flex bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-[9.5px] font-black uppercase px-3.5 py-2.5 rounded-xl transition-all shrink-0 cursor-pointer items-center gap-1.5 shadow-xs"
                          >
                            <PlusCircle size={12} className="text-rose-500 animate-pulse" />
                            <span>{user && marcasAliadas.some(m => m.creadorId === user.uid) ? '⚡ Mi Oferta del Día' : 'Registrar mi Comercio'}</span>
                          </motion.button>
                        )}
                        
                        <button 
                          onClick={() => setShowTripRequestModal(false)} 
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all duration-200 cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {selectedServiceType === 'marcas_aliadas' ? (
                      /* MARCAS ALIADAS TAB CONTENT */
                      (() => {
                        const userCity = perfil?.ciudad || 'Fusagasugá';
                        const normUserCity = normalizeStrForCity(userCity);

                        const getCategoryStyles = (categoria: string) => {
                          let bg = 'bg-orange-50 border-orange-100 text-orange-600';
                          let iconBg = 'bg-orange-500/10 text-orange-500 border-orange-200/50';
                          let Icon = Utensils;

                          const catNorm = (categoria || '').toLowerCase();
                          if (catNorm === 'droguería' || catNorm === 'drogueria' || catNorm.includes('droga') || catNorm.includes('farma')) {
                            bg = 'bg-rose-50 border-rose-100 text-rose-600';
                            iconBg = 'bg-rose-500/10 text-rose-500 border-rose-200/50';
                            Icon = Pill;
                          } else if (catNorm === 'ferretería' || catNorm === 'ferreteria' || catNorm.includes('ferre')) {
                            bg = 'bg-amber-50 border-amber-100 text-amber-600';
                            iconBg = 'bg-amber-500/10 text-amber-500 border-amber-200/50';
                            Icon = Wrench;
                          } else if (catNorm === 'supermercado' || catNorm.includes('super') || catNorm.includes('mercado') || catNorm.includes('tienda')) {
                            bg = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                            iconBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-200/50';
                            Icon = ShoppingBag;
                          } else if (catNorm === 'tecnología' || catNorm === 'tecnologia' || catNorm.includes('tecno') || catNorm.includes('celu')) {
                            bg = 'bg-blue-50 border-blue-100 text-blue-600';
                            iconBg = 'bg-blue-500/10 text-blue-500 border-blue-200/50';
                            Icon = Smartphone;
                          } else if (catNorm === 'restaurante' || catNorm.includes('comida') || catNorm.includes('pizza') || catNorm.includes('pizzería') || catNorm.includes('pizzeria')) {
                            bg = 'bg-orange-50 border-orange-100 text-orange-600';
                            iconBg = 'bg-orange-500/10 text-orange-500 border-orange-200/50';
                            Icon = Utensils;
                          } else {
                            bg = 'bg-slate-50 border-slate-100 text-slate-600';
                            iconBg = 'bg-slate-500/10 text-slate-500 border-slate-200/50';
                            Icon = Store;
                          }

                          return { bg, iconBg, Icon };
                        };

                        const matchingAliados = marcasAliadas.filter(marca => {
                          // Search filter match
                          const searchNorm = normalizeStrForCity(brandSearchTerm);
                          const nameMatch = normalizeStrForCity(marca.nombre).includes(searchNorm);
                          const addressMatch = normalizeStrForCity(marca.direccion).includes(searchNorm);
                          const catMatch = normalizeStrForCity(marca.categoria).includes(searchNorm);
                          const textMatches = !brandSearchTerm || nameMatch || addressMatch || catMatch;

                          // Category filter match
                          const normSelCat = selectedBrandCategory.toLowerCase();
                          const normMarcaCat = (marca.categoria || "").toLowerCase();
                          const isRestauranteMatch = normSelCat === 'restaurante' && (normMarcaCat === 'restaurante' || normMarcaCat === 'pizzería' || normMarcaCat === 'pizzeria' || normMarcaCat.includes('pizza'));
                          
                          const categoryMatches = selectedBrandCategory === 'Todos' || 
                                                   normMarcaCat === normSelCat ||
                                                   isRestauranteMatch;

                          // City filter match
                          const normMarcaCity = normalizeStrForCity(marca.ciudad);
                          const cityMatches = normMarcaCity === normUserCity;

                          return textMatches && categoryMatches && cityMatches;
                        });

                        const getCategoryCount = (catName: string) => {
                          return marcasAliadas.filter(marca => {
                            const normMarcaCity = normalizeStrForCity(marca.ciudad);
                            if (normMarcaCity !== normUserCity) return false;

                            if (catName === 'Todos') return true;

                            const normSelCat = catName.toLowerCase();
                            const normMarcaCat = (marca.categoria || "").toLowerCase();
                            const isRestauranteMatch = normSelCat === 'restaurante' && (normMarcaCat === 'restaurante' || normMarcaCat === 'pizzería' || normMarcaCat === 'pizzeria' || normMarcaCat.includes('pizza'));
                            return normMarcaCat === normSelCat || isRestauranteMatch;
                          }).length;
                        };

                        return (
                          <div className="flex-1 flex flex-col overflow-hidden min-h-0 text-left bg-slate-50 animate-fadeIn">
                            {/* Controls Panel */}
                            <div className="bg-white border-b border-slate-100 py-4 px-4 sm:px-6 shrink-0 shadow-xs z-10 space-y-3.5">
                              <div className="max-w-7xl mx-auto flex flex-col gap-3 w-full">
                                {/* Search Bar */}
                                <div className="relative">
                                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" />
                                  <input 
                                    type="text"
                                    placeholder="Buscar comercios por nombre, dirección o categoría..."
                                    className="w-full bg-slate-50 border border-slate-200/80 hover:border-slate-300 focus:border-rose-500 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold focus:ring-4 focus:ring-rose-500/10 outline-none placeholder:text-slate-400 text-slate-700 transition-all shadow-sm"
                                    value={brandSearchTerm}
                                    onChange={e => setBrandSearchTerm(e.target.value)}
                                  />
                                </div>

                                {/* Category Horizontal Slider */}
                                <div 
                                  ref={categoriesScrollRef}
                                  {...categoriesScrollProps}
                                  className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none touch-pan-x active:cursor-grabbing"
                                >
                                  {(() => {
                                    const baseCategories = ['Todos', 'Restaurante', 'Supermercado', 'Droguería', 'Ferretería', 'Tecnología', 'Otro'];
                                    const dbCategories = Array.from(new Set(marcasAliadas.map(m => m.categoria).filter(Boolean)));
                                    const mergedCategories = [...baseCategories];
                                    dbCategories.forEach(cat => {
                                      if (!mergedCategories.some(c => c.toLowerCase() === cat.toLowerCase())) {
                                        mergedCategories.push(cat);
                                      }
                                    });

                                    return mergedCategories.map(cat => {
                                      const isSelected = selectedBrandCategory === cat;
                                      const count = getCategoryCount(cat);
                                      const { bg: catBg, Icon: FilterIcon } = getCategoryStyles(cat);

                                      return (
                                        <button
                                          key={cat}
                                          type="button"
                                          onClick={() => setSelectedBrandCategory(cat)}
                                          className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 cursor-pointer ${
                                            isSelected 
                                              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/15' 
                                              : 'bg-slate-50 border-slate-150 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                          }`}
                                        >
                                          <FilterIcon size={12} className={isSelected ? 'text-amber-300' : 'text-slate-400'} />
                                          <span>{cat}</span>
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ml-1 ${
                                            isSelected 
                                              ? 'bg-white/20 text-white' 
                                              : 'bg-slate-200 text-slate-600'
                                          }`}>
                                            {count}
                                          </span>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Catalog Body */}
                            <div 
                              ref={brandsListScrollRef}
                              {...brandsListScrollProps}
                              className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar touch-pan-y"
                            >
                              <div className="max-w-7xl mx-auto w-full">
                                {/* DYNAMIC OFFERS CAROUSEL IN USER'S CITY */}
                                {(() => {
                                  const activeCityOffers = marcasAliadas.filter(marca => {
                                    const normMarcaCity = normalizeStrForCity(marca.ciudad || '');
                                    const normUserCity = normalizeStrForCity(perfil?.ciudad || 'Fusagasugá');
                                    return normMarcaCity === normUserCity && marca.oferta && marca.oferta.activa && marca.oferta.titulo;
                                  });

                                  if (activeCityOffers.length > 0) {
                                    return (
                                      <div className="mb-6 shrink-0 bg-neutral-950 p-4 rounded-3xl border border-neutral-800/80 shadow-2xl relative overflow-hidden text-left">
                                        {/* Ambient boutique gold glow */}
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
                                        <div className="absolute bottom-0 left-10 w-48 h-48 bg-gradient-to-tr from-rose-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

                                        <div className="flex items-center justify-between mb-3 relative z-10">
                                          <div className="flex items-center gap-2">
                                            <span className="relative flex h-1.5 w-1.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                            </span>
                                            <span className="text-[10px] font-black text-neutral-200 tracking-[0.15em] uppercase flex items-center gap-1.5">
                                              👑 Ofertas Exclusivas del Día
                                            </span>
                                            <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                                              {activeCityOffers.length} {activeCityOffers.length === 1 ? 'ACTIVA' : 'ACTIVAS'}
                                            </span>
                                          </div>
                                          <span className="text-[8px] text-neutral-500 font-mono uppercase tracking-[0.15em]">
                                            Deslizar para explorar →
                                          </span>
                                        </div>
                                        
                                        <div className="flex gap-3 overflow-x-auto pb-1 pt-1 px-0.5 no-scrollbar select-none touch-pan-x snap-x mt-2">
                                          {activeCityOffers.map((marca, mIdx) => {
                                            const { bg: catBg, Icon: CatIcon } = getCategoryStyles(marca.categoria);
                                            const percent = marca.oferta.porcentajeDescuento || 0;
                                            
                                            return (
                                              <motion.div
                                                key={`offer-${marca.id || mIdx}`}
                                                whileHover={{ y: -3, scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                onClick={() => setSelectedAliadoForUser(marca)}
                                                className="flex-none w-[16.5rem] sm:w-[17.5rem] bg-gradient-to-b from-neutral-900 to-neutral-950 hover:from-neutral-850 hover:to-neutral-900 text-white rounded-2xl p-4 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between cursor-pointer border border-neutral-800/80 hover:border-neutral-700/60 snap-start group"
                                              >
                                                {/* Ambient Background Glow */}
                                                <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />

                                                {/* Top Brand Info */}
                                                <div className="flex items-center justify-between mb-3 relative z-10">
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700/60 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                                      {marca.logo ? (
                                                        <img src={marca.logo} alt={marca.nombre} className="w-full h-full object-contain rounded-sm" referrerPolicy="no-referrer" />
                                                      ) : (
                                                        <CatIcon size={12} className="text-neutral-300" />
                                                      )}
                                                    </div>
                                                    <div className="text-left">
                                                      <span className="text-[10px] font-black text-white block uppercase leading-none tracking-wide truncate max-w-[100px]">{marca.nombre}</span>
                                                      <span className="text-[7px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-0.5 block">{marca.categoria || 'Comercio'}</span>
                                                    </div>
                                                  </div>

                                                  {percent > 0 && (
                                                    <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-neutral-950 text-[7.5px] font-black px-2 py-0.5 rounded-md tracking-wider shadow-sm uppercase shrink-0">
                                                      -{percent}% OFF
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Offer Body */}
                                                <div className="text-left space-y-1 relative z-10 my-1">
                                                  <h5 className="text-[11px] font-bold uppercase tracking-tight line-clamp-1 text-white leading-tight">
                                                    {marca.oferta.titulo}
                                                  </h5>
                                                  <p className="text-[9px] text-neutral-400 font-medium line-clamp-2 leading-relaxed h-[27px] overflow-hidden">
                                                    {marca.oferta.descripcion}
                                                  </p>
                                                </div>

                                                {/* Price Row & Action */}
                                                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-800/60 relative z-10">
                                                  <div className="flex items-baseline gap-1 text-left">
                                                    <span className="text-[12px] font-black text-amber-400">${marca.oferta.precioDescuento.toLocaleString()}</span>
                                                    {marca.oferta.precioOriginal > 0 && (
                                                      <span className="text-[8.5px] text-neutral-500 line-through font-bold">${marca.oferta.precioOriginal.toLocaleString()}</span>
                                                    )}
                                                  </div>
                                                  
                                                  <span className="bg-white hover:bg-neutral-100 text-neutral-950 text-[7px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-all shadow-md flex items-center gap-1 shrink-0">
                                                    Ver Oferta
                                                  </span>
                                                </div>
                                              </motion.div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="mb-8 p-6 bg-gradient-to-r from-rose-50/50 to-pink-50/50 border border-rose-100/60 rounded-[2.2rem] text-left flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                                        <div className="flex items-start gap-3">
                                          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200/50">
                                            <Tag size={18} className="animate-pulse" />
                                          </div>
                                          <div>
                                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">¿Tienes un comercio en {userCity}?</h5>
                                            <p className="text-[10px] text-slate-400 font-bold leading-normal mt-0.5">
                                              Publica hoy tu primera oferta del día para llegar de inmediato a todos los clientes de tu zona y aumentar tus ventas de forma ágil y segura.
                                            </p>
                                          </div>
                                        </div>
                                        <motion.button
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          onClick={openMyBrandManager}
                                          className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200/80 hover:border-rose-300 text-[9px] font-black uppercase px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                                        >
                                          ⚡ Publicar Oferta Gratis
                                        </motion.button>
                                      </div>
                                    );
                                  }
                                })()}

                                {/* Results Info */}
                                <div className="flex justify-between items-center mb-5 shrink-0">
                                  <div className="flex flex-col text-left">
                                    <span className="text-[10px] uppercase font-black text-rose-500 tracking-wider">
                                      Comercios en tu zona
                                    </span>
                                    <span className="text-xs text-slate-500 font-extrabold leading-none mt-1">
                                      {matchingAliados.length} {matchingAliados.length === 1 ? 'establecimiento' : 'establecimientos'} para entrega hoy
                                    </span>
                                  </div>

                                  <motion.button 
                                    onClick={openMyBrandManager}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="sm:hidden bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <PlusCircle size={10} className="text-rose-500" />
                                    <span>{user && marcasAliadas.some(m => m.creadorId === user.uid) ? 'Mi Oferta' : 'Registrarse'}</span>
                                  </motion.button>
                                </div>

                                {/* Grid of 2 columns symmetric */}
                                {matchingAliados.length === 0 ? (
                                  <div className="text-center py-16 bg-white border border-slate-100 p-8 rounded-3xl space-y-4 max-w-md mx-auto shadow-xs">
                                    <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                                      <Store size={24} />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-black text-slate-800">No se encontraron comercios</p>
                                      <p className="text-xs text-slate-400 leading-relaxed">
                                        No hay comercios disponibles en {userCity} con el término "{brandSearchTerm}" o la categoría seleccionada.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-4 md:gap-6 lg:gap-8">
                                    {matchingAliados.map((marca, mIdx) => {
                                      const { bg: catBg, iconBg: catIconBg, Icon: CatIcon } = getCategoryStyles(marca.categoria);

                                      const waMessage = `Hola ${marca.nombre}! Te encontré en Ruedas Rápidas. Quisiera realizar un pedido para despacho en mi dirección.`;
                                      const waPhone = cleanPhone(marca.whatsapp);
                                      const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

                                      const hasActiveOffer = marca.oferta && marca.oferta.activa && marca.oferta.titulo;

                                      return (
                                        <motion.div 
                                          layout
                                          key={marca.id || `aliado-${mIdx}`}
                                          onClick={() => setSelectedAliadoForUser(marca)}
                                          className="bg-white rounded-3xl border border-slate-150 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-rose-300 transition-all duration-300 hover:-translate-y-0.5 group relative cursor-pointer"
                                        >
                                          {/* Imagen destacada: siempre con fondo blanco */}
                                          <div className="relative w-full aspect-[4/3] sm:aspect-video md:aspect-[16/10] bg-white border-b border-slate-100 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden">
                                            {marca.logo ? (
                                              <img 
                                                src={marca.logo} 
                                                alt={marca.nombre} 
                                                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : (
                                              <div className="w-full h-full bg-white flex flex-col items-center justify-center text-center p-2">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${catIconBg} mb-2 border border-slate-100/50 shadow-inner`}>
                                                  <CatIcon size={20} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider truncate max-w-full leading-none">
                                                  {marca.nombre}
                                                </span>
                                              </div>
                                            )}

                                            {/* Mini official badge */}
                                            <div className="absolute top-2.5 left-2.5 bg-amber-400 text-slate-950 text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs tracking-wider flex items-center gap-1 select-none z-10">
                                              <Star size={8} className="fill-slate-950 text-slate-950" /> Tienda Oficial
                                            </div>

                                            {/* Beautiful red offer glassmorphism badge */}
                                            {hasActiveOffer && (
                                              <div className="absolute top-2.5 right-2.5 bg-rose-600 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs tracking-wider flex items-center gap-1 select-none z-10 animate-pulse">
                                                🔥 Oferta Activa
                                              </div>
                                            )}
                                          </div>

                                          {/* Card Body */}
                                          <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between text-left space-y-3 bg-white">
                                            <div className="space-y-1.5">
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${catBg}`}>
                                                  {marca.categoria || 'Otro'}
                                                </span>
                                                <div className="flex items-center gap-0.5 text-[9px] text-amber-500 font-extrabold select-none">
                                                  <Star size={9} className="fill-amber-400 text-amber-400" />
                                                  <span>5.0</span>
                                                </div>
                                              </div>

                                              <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight leading-tight uppercase group-hover:text-rose-600 transition-colors truncate">
                                                {marca.nombre}
                                              </h4>

                                              <div className="flex flex-wrap items-center gap-1 text-[8px] font-black uppercase">
                                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                                  Socio Líder
                                                </span>
                                                <span className="bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-150">
                                                  Entrega hoy
                                                </span>
                                              </div>

                                              {/* Beautiful offer container inside the card */}
                                              {hasActiveOffer && (
                                                <div className="mt-2.5 p-2 bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-100/60 text-left">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[9.5px] font-black text-rose-600 truncate uppercase tracking-tight">{marca.oferta.titulo}</span>
                                                    {marca.oferta.porcentajeDescuento > 0 && (
                                                      <span className="bg-rose-600 text-white text-[8px] font-black px-1 py-0.5 rounded-md leading-none">
                                                        -{marca.oferta.porcentajeDescuento}%
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-[9px] text-slate-400 font-bold leading-tight line-clamp-1 mt-0.5">{marca.oferta.descripcion}</p>
                                                  <div className="flex items-center gap-1.5 mt-1 leading-none">
                                                    <span className="text-[10px] font-black text-slate-800">${marca.oferta.precioDescuento.toLocaleString()}</span>
                                                    {marca.oferta.precioOriginal > 0 && (
                                                      <span className="text-[8.5px] text-slate-400 font-bold line-through">${marca.oferta.precioOriginal.toLocaleString()}</span>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            <div className="space-y-3 pt-2.5 border-t border-slate-50">
                                              <p className="flex items-center gap-1 text-[9px] sm:text-xs text-slate-500 font-bold truncate">
                                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                                {marca.direccion}
                                              </p>
                                              
                                              <a 
                                                href={waLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer text-center group/btn"
                                              >
                                                <MessageCircle size={12} className="fill-white/10 group-hover/btn:scale-105 transition-transform" />
                                                <span>Pedir WhatsApp</span>
                                              </a>
                                            </div>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* STANDARD TRIP REQUEST FORM CONTENT */
                      selectedServiceType === 'camion_flete' || selectedServiceType === 'camion_acarreo' || selectedServiceType === 'motocarro' ? (
                        <form onSubmit={handleSolicitarViaje} className="space-y-4 overflow-y-auto no-scrollbar flex-1 text-left">
                          {/* Capacidad / Especificación de la carga */}
                          <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider ml-1">Carga a transportar (Peso / Detalles / Tipo)</label>
                            <div className="relative">
                              <Truck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600" />
                              <input 
                                required
                                type="text" 
                                placeholder="Ej: Dos lavadoras, 800 Kg, cajas de mudanza..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-xs font-semibold focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400"
                                value={tripRequestData.capacidad_carga || ''}
                                onChange={e => setTripRequestData({...tripRequestData, capacidad_carga: e.target.value})}
                              />
                            </div>
                          </div>

                          {/* Origen */}
                          <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider ml-1">Punto de Recogida (Origen)</label>
                            <div className="relative">
                              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" />
                              <input 
                                required
                                type="text" 
                                placeholder="¿Dónde recogemos la carga?"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-xs font-semibold focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400"
                                value={tripRequestData.origen}
                                onChange={e => setTripRequestData({...tripRequestData, origen: e.target.value})}
                              />
                            </div>
                          </div>

                          {/* Destino */}
                          <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider ml-1">Punto de Entrega (Destino)</label>
                            <div className="relative">
                              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                              <input 
                                required
                                type="text" 
                                placeholder="¿A dónde llevamos la carga?"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-xs font-semibold focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400"
                                value={tripRequestData.destino}
                                onChange={e => setTripRequestData({...tripRequestData, destino: e.target.value})}
                              />
                            </div>
                          </div>

                          {/* Info Banner */}
                          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100/50 flex justify-between items-center text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                                <CreditCard size={18} />
                              </div>
                              <div>
                                <span className="text-[10px] font-black text-slate-800 uppercase leading-none block mb-0.5">Flete por Cotizar</span>
                                <p className="text-[8px] text-slate-400 font-medium leading-tight max-w-[190px]">Los conductores registrados en tu ciudad te enviarán ofertas en tiempo real y tú eliges la mejor.</p>
                              </div>
                            </div>
                          </div>

                          <button 
                            type="submit"
                            className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95 mt-4 flex items-center justify-center gap-2"
                          >
                            <Truck size={16} />
                            Solicitar Cotización de Carga
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleSolicitarViaje} className="space-y-4 overflow-y-auto no-scrollbar flex-1 text-left">
                          {/* Información de Rastreo GPS */}
                          <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs shadow-sm mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
                                🗺️
                              </div>
                              <div className="leading-tight">
                                <span className="text-[10px] uppercase font-black text-emerald-400 block tracking-wider">Rastreo GPS en Tiempo Real</span>
                                <p className="text-[11px] font-medium text-slate-300">El mapa interactivo se activará automáticamente al aceptar la oferta de tu conductor.</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Punto de Recogida</label>
                            <div className="relative">
                              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                              <input 
                                required
                                type="text" 
                                placeholder="¿Dónde te recogemos?"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={tripRequestData.origen}
                                onChange={e => setTripRequestData({...tripRequestData, origen: e.target.value})}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Destino</label>
                            <div className="relative">
                              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                              <input 
                                required
                                type="text" 
                                placeholder="¿A dónde vas?"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={tripRequestData.destino}
                                onChange={e => setTripRequestData({...tripRequestData, destino: e.target.value})}
                              />
                            </div>
                          </div>
                          
                          {/* Tarifa fija de 5000 */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                                <CreditCard size={20} />
                              </div>
                              <div className="text-left">
                                <span className="text-xs font-bold text-slate-700 uppercase block leading-tight">Tarifa Mínima</span>
                                <p className="text-[9px] text-slate-400 font-medium leading-tight max-w-[140px]">El valor final varía según la distancia y el conductor</p>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-emerald-700">$5,000 COP</span>
                          </div>
                          
                          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-2 text-left">
                            {(perfil?.genero?.toLowerCase() === 'femenino' || perfil?.genero?.toLowerCase()?.includes('femenino')) && (
                              <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-100 rounded-xl mb-2">
                                <div className="flex items-center gap-2">
                                  <Heart size={18} className="text-pink-500 fill-pink-500" />
                                  <div>
                                    <p className="text-xs font-bold text-pink-700">Modo Rosa</p>
                                    <p className="text-[10px] text-pink-600 animate-pulse">Solo conductoras mujeres</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setModoRosa(!modoRosa)}
                                  className={`w-10 h-5 rounded-full relative transition-colors ${modoRosa ? 'bg-pink-500' : 'bg-slate-300'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${modoRosa ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-emerald-800">Total Oferta</span>
                              <span className="text-lg font-mono font-bold text-emerald-700">
                                ${(tripRequestData.valor).toLocaleString()}
                              </span>
                            </div>

                            {perfil?.saldo_promo > 0 && (
                              <div className="mt-2 p-3 bg-white/50 rounded-xl border border-emerald-100/50 space-y-2">
                                 <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1.5">
                                    <ShieldCheck size={12} className="text-emerald-600" />
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Ahorro con Bono</span>
                                  </div>
                                  <span className="text-xs font-mono font-bold text-emerald-600">
                                    -${Math.min(perfil.saldo_promo, tripRequestData.valor).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-[9px] text-emerald-600/70 italic leading-tight">Este valor se descontará de tu saldo virtual y se le abonará automáticamente al conductor.</p>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-3 border-t border-emerald-200/50">
                              <div className="flex items-center gap-1.5">
                                <CreditCard size={12} className="text-slate-500" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Pagar al Conductor</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-mono font-bold text-slate-700">
                                  ${Math.max(0, tripRequestData.valor - (perfil?.saldo_promo || 0)).toLocaleString()}
                                </span>
                                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-tight">En Efectivo</span>
                              </div>
                            </div>
                          </div>

                          <button 
                            type="submit"
                            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 mt-4 flex items-center justify-center gap-2"
                          >
                            {selectedServiceType === 'domicilio' ? <Package size={20} /> : 
                             selectedServiceType === 'moto' ? <Bike size={20} /> :
                             selectedServiceType === 'taxi' ? <Taxi size={20} /> :
                             <Car size={20} />}
                            CONFIRMAR SOLICITUD
                          </button>
                        </form>
                      )
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expreso Publish Modal (Driver) */}
            <AnimatePresence>
              {showExpresoModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-4">
                  <motion.div 
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-200 rounded-full sm:hidden" />
                    
                    <button 
                      onClick={() => setShowExpresoModal(false)}
                      className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={20} />
                    </button>

                    <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 border border-indigo-100 shadow-sm">
                          <Users size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Publicar Viaje Expreso</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Servicio compartido Intermunicipal</p>
                      </div>

                      <div className="space-y-5">
                        <div className="relative grid grid-cols-2 gap-4">
                           {/* Origen */}
                           <div className="space-y-2 relative">
                              <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-tighter">Origen</label>
                              <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Fusagasugá"
                                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-11 text-sm font-bold text-slate-800 outline-none transition-all"
                                  value={expresoForm.origen}
                                  onChange={e => setExpresoForm({...expresoForm, origen: e.target.value})}
                                />
                              </div>
                           </div>

                           {/* Swap Button inside grid */}
                           <div className="absolute left-1/2 top-[42px] -translate-x-1/2 z-10">
                             <button
                               type="button"
                               onClick={() => {
                                 setExpresoForm(prev => ({
                                   ...prev,
                                   origen: prev.destino,
                                   destino: prev.origen
                                 }));
                               }}
                               className="w-8 h-8 rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 border-white cursor-pointer"
                               title="Intercambiar Origen y Destino"
                             >
                               <ArrowLeftRight size={12} />
                             </button>
                           </div>

                           {/* Destino */}
                           <div className="space-y-2 relative">
                              <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-tighter">Destino</label>
                              <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Bogotá"
                                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-11 text-sm font-bold text-slate-800 outline-none transition-all"
                                  value={expresoForm.destino}
                                  onChange={e => setExpresoForm({...expresoForm, destino: e.target.value})}
                                />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-tighter">Punto de Encuentro</label>
                          <input 
                            required
                            type="text" 
                            placeholder="Ej: Terminal de Transportes Fusa"
                            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none transition-all"
                            value={expresoForm.puntoEncuentro}
                            onChange={e => setExpresoForm({...expresoForm, puntoEncuentro: e.target.value})}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Ruta o Destino Detallado</label>
                            <span className={`text-[9px] font-bold ${expresoForm.ruta.length > 250 ? 'text-rose-500' : 'text-slate-300'}`}>
                              {expresoForm.ruta.length}/300
                            </span>
                          </div>
                          <textarea 
                            required
                            maxLength={300}
                            placeholder="Ej: Salgo por la principal, paso por el peaje, entro por la Autopista Sur hasta el centro..."
                            rows={3}
                            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none transition-all resize-none shadow-inner"
                            value={expresoForm.ruta}
                            onChange={e => setExpresoForm({...expresoForm, ruta: e.target.value})}
                          />
                          <p className="text-[9px] text-slate-400 px-1 font-medium italic">
                            Indica por qué vías principales, paradas intermedias o barrios pasarás durante el recorrido.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-tighter">Fecha y Hora de Salida</label>
                          <div className="relative group">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              required
                              type="datetime-local" 
                              className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-11 text-sm font-bold text-slate-800 outline-none transition-all"
                              value={expresoForm.fechaSalida}
                              onChange={e => setExpresoForm({...expresoForm, fechaSalida: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-tighter">Cupos Disponibles</label>
                              <div className="relative group">
                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                  required
                                  type="number" 
                                  min="1"
                                  max="10"
                                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-11 text-sm font-bold text-slate-800 outline-none transition-all"
                                  value={expresoForm.cuposTotales}
                                  onChange={e => setExpresoForm({...expresoForm, cuposTotales: parseInt(e.target.value) || 4})}
                                />
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-tighter">Precio por Cupo</label>
                              <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                                <input 
                                  required
                                  type="number" 
                                  step="500"
                                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-8 text-sm font-bold text-slate-800 outline-none transition-all"
                                  value={expresoForm.valorPorCupo}
                                  onChange={e => setExpresoForm({...expresoForm, valorPorCupo: parseInt(e.target.value) || 0})}
                                />
                              </div>
                           </div>
                        </div>

                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                             <ShieldCheck size={20} />
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Seguridad Garantizada</p>
                             <p className="text-[9px] text-emerald-500 font-medium">Recuerda que se aplica una comisión del 15% sobre el valor total.</p>
                           </div>
                        </div>

                        <button 
                          onClick={handleCrearViajeExpreso}
                          disabled={isCreatingExpreso || !expresoForm.puntoEncuentro || !expresoForm.fechaSalida || !expresoForm.ruta}
                          className={`w-full h-16 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${
                            isCreatingExpreso || !expresoForm.puntoEncuentro || !expresoForm.fechaSalida || !expresoForm.ruta
                            ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                            : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1'
                          }`}
                        >
                          {isCreatingExpreso ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <PlusCircle size={18} />
                              PUBLICAR VIAJE
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Cargo Selection Modal */}
            <AnimatePresence>
              {showCargoSelector && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-4">
                  <motion.div 
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    className="bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col"
                  >
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-200 rounded-full sm:hidden" />
                    
                    <button 
                      onClick={() => setShowCargoSelector(false)}
                      className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={20} />
                    </button>

                    <div className="pt-2">
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2.5 bg-orange-100 rounded-2xl text-orange-600">
                            <Truck size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Servicios de Carga</h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Selecciona tu tipo de carga</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            setShowCargoSelector(false);
                            openTripRequest('camion_flete');
                          }}
                          className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-500 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-100 transition-colors">
                              <Truck size={22} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Flete</p>
                              <p className="text-xs text-slate-500">Para cargas pesadas y largas distancias</p>
                            </div>
                          </div>
                          <ChevronRight className="text-slate-400 group-hover:text-orange-500 transition-colors" size={18} />
                        </button>

                        <button
                          onClick={() => {
                            setShowCargoSelector(false);
                            openTripRequest('camion_acarreo');
                          }}
                          className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-500 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-100 transition-colors">
                              <Truck size={22} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Acarreo</p>
                              <p className="text-xs text-slate-500">Ideal para mudanzas y trasteos locales</p>
                            </div>
                          </div>
                          <ChevronRight className="text-slate-400 group-hover:text-orange-500 transition-colors" size={18} />
                        </button>

                        <button
                          onClick={() => {
                            setShowCargoSelector(false);
                            openTripRequest('motocarro');
                          }}
                          className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-500 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-100 transition-colors">
                              <Truck size={22} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Moto Carro</p>
                              <p className="text-xs text-slate-500">Cargas ligeras y entregas rápidas</p>
                            </div>
                          </div>
                          <ChevronRight className="text-slate-400 group-hover:text-orange-500 transition-colors" size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Expreso Booking Modal (User) */}
            <AnimatePresence>
              {showExpresoBookingModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-4">
                  <motion.div 
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    className="bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-200 rounded-full sm:hidden" />
                    
                    <button 
                      onClick={() => {
                        setShowExpresoBookingModal(false);
                        setSelectedExpresoTrip(null);
                        setJustBooked(null);
                      }}
                      className="absolute top-8 right-8 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={20} />
                    </button>

                    <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
                       {!selectedExpresoTrip ? (
                         <>
                           <div className="mb-6">
                             <div className="flex items-center gap-3 mb-2">
                               <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm shadow-indigo-100 animate-pulse">
                                 <Zap size={20} />
                               </div>
                               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Expreso Intermunicipal</h3>
                             </div>
                             <p className="text-slate-500 text-xs font-medium">Viajes compartidos disponibles para cualquier ciudad y destino.</p>
                           </div>

                           {/* Intermunicipal Search & Filter */}
                           <div className="bg-slate-50 border border-slate-150 p-4 rounded-[2rem] mb-6 relative">
                             <div className="relative grid grid-cols-2 gap-3">
                               {/* Filter Origen */}
                               <div className="relative">
                                 <label className="text-[9px] uppercase font-black text-slate-400 ml-1 block mb-1">Origen</label>
                                 <div className="relative">
                                   <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                                   <input 
                                     type="text" 
                                     placeholder="De dónde sales?"
                                     className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-2.5 pl-9 text-xs font-bold text-slate-800 outline-none transition-all shadow-sm"
                                     value={filterOrigen}
                                     onChange={e => setFilterOrigen(e.target.value)}
                                   />
                                   {filterOrigen && (
                                     <button 
                                       type="button"
                                       onClick={() => setFilterOrigen('')} 
                                       className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black p-1"
                                     >
                                       ×
                                     </button>
                                   )}
                                 </div>
                               </div>

                               {/* Swap/Invert Button */}
                               <div className="absolute left-1/2 top-[28px] -translate-x-1/2 z-10">
                                 <button
                                   type="button"
                                   onClick={() => {
                                     const temp = filterOrigen;
                                     setFilterOrigen(filterDestino);
                                     setFilterDestino(temp);
                                   }}
                                   className="w-7 h-7 rounded-full bg-white text-indigo-600 shadow-sm border border-slate-200 hover:border-indigo-500 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                                   title="Invertir origen y destino"
                                 >
                                   <ArrowLeftRight size={10} />
                                 </button>
                               </div>

                               {/* Filter Destino */}
                               <div className="relative">
                                 <label className="text-[9px] uppercase font-black text-slate-400 ml-1 block mb-1">Destino</label>
                                 <div className="relative">
                                   <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" size={14} />
                                   <input 
                                     type="text" 
                                     placeholder="A dónde vas?"
                                     className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-2.5 pl-9 text-xs font-bold text-slate-800 outline-none transition-all shadow-sm"
                                     value={filterDestino}
                                     onChange={e => setFilterDestino(e.target.value)}
                                   />
                                   {filterDestino && (
                                     <button 
                                       type="button"
                                       onClick={() => setFilterDestino('')} 
                                       className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black p-1"
                                     >
                                       ×
                                     </button>
                                   )}
                                 </div>
                               </div>
                             </div>
                           </div>

                           <div className="space-y-4">
                             {filteredExpresoViajes.length === 0 ? (
                               <div className="bg-slate-50 rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
                                 <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay viajes que coincidan con la búsqueda</p>
                                 <p className="text-slate-400 text-[10px] font-medium mt-1">Intenta cambiar los filtros de origen y destino</p>
                               </div>
                             ) : (
                               filteredExpresoViajes.map(viaje => (
                                 <motion.div 
                                   key={viaje.id}
                                   whileHover={{ scale: 1.02 }}
                                   onClick={() => {
                                     setSelectedExpresoTrip(viaje);
                                     setExpresoForm(prev => ({ ...prev, cuposTotales: 1 }));
                                   }}
                                   className="bg-white border-2 border-slate-100 p-5 rounded-3xl hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-50 transition-all cursor-pointer group flex flex-col"
                                 >
                                   {/* Beautiful Route Badge */}
                                   <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-wider self-start mb-3.5 border border-indigo-100/50 shadow-sm">
                                     <span>{viaje.origen || 'Fusagasugá'}</span>
                                     <ChevronRight size={10} className="text-indigo-400" />
                                     <span>{viaje.destino || 'Bogotá'}</span>
                                   </div>

                                   <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                          <UserIcon size={24} />
                                        </div>
                                        <div>
                                           <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{viaje.conductorNombre}</h4>
                                           <div className="flex items-center gap-2">
                                              <div className="flex items-center gap-0.5 text-amber-500">
                                                <Star size={10} fill="currentColor" />
                                                <span className="text-[10px] font-bold">{viaje.conductorCalificacion.toFixed(1)}</span>
                                              </div>
                                              <span className="text-slate-300">|</span>
                                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{viaje.vehiculo?.modelo} {viaje.vehiculo?.placa}</span>
                                           </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                         <p className="text-lg font-black text-emerald-600 leading-none">${viaje.valorPorCupo.toLocaleString()}</p>
                                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">por cupo</p>
                                      </div>
                                   </div>

                                   <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                      <div className="flex items-center gap-2">
                                        <Clock className="text-indigo-500" size={14} />
                                        <span className="text-xs font-bold text-slate-700">
                                          <><span>{new Date(viaje.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="text-slate-300 font-normal mx-1.5">|</span><span className="text-indigo-600 font-medium capitalize text-[11px]">{new Date(viaje.fechaSalida).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span></>
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 justify-end">
                                        <Users className="text-slate-400" size={14} />
                                        <span className={`text-xs font-bold ${viaje.cuposDisponibles <= 1 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                          {viaje.cuposDisponibles} cupos libres
                                        </span>
                                      </div>
                                   </div>
                                   <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 group-hover:bg-indigo-50/50 group-hover:border-indigo-100/50 transition-colors">
                                     <MapPin size={14} className="text-indigo-500 shrink-0" />
                                     <div>
                                       <p className="text-[10px] font-black text-slate-900 uppercase">Punto de Encuentro</p>
                                       <p className="text-[10px] font-bold text-slate-600 truncate">{viaje.puntoEncuentro}</p>
                                     </div>
                                   </div>
                                   {viaje.ruta && (
                                     <div className="mt-2 flex items-start gap-2 bg-indigo-50/30 p-2.5 rounded-2xl border border-indigo-100/30">
                                       <Navigation size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                       <div>
                                          <p className="text-[10px] font-black text-indigo-700 uppercase">Ruta / Destino</p>
                                          <p className="text-[10px] font-medium text-slate-600 line-clamp-2 leading-tight">{viaje.ruta}</p>
                                       </div>
                                     </div>
                                   )}
                                 </motion.div>
                               ))
                             )}
                           </div>
                         </>
                       ) : (
                         <div className="space-y-8">
                            <button 
                              onClick={() => {
                                setSelectedExpresoTrip(null);
                                setJustBooked(null);
                              }}
                              className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                            >
                              <ChevronRight className="rotate-180" size={14} />
                              Volver a la lista
                            </button>

                            <div className="text-center">
                               <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-sm text-indigo-600">
                                 <PlusCircle size={40} />
                               </div>
                               <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Reservar Cupo</h3>
                               <div className="mt-3 inline-flex items-center gap-2.5 bg-indigo-50/80 text-indigo-700 px-4 py-2.5 rounded-2xl border border-indigo-100/50 font-bold text-xs capitalize mx-auto">
                                 <Calendar size={13} className="shrink-0 text-indigo-500" />
                                 <span>{new Date(liveSelectedExpresoTrip.fechaSalida).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                 <span className="text-indigo-200">|</span>
                                 <Clock size={13} className="shrink-0 text-indigo-500" />
                                 <span>{new Date(liveSelectedExpresoTrip.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                               <p className="text-slate-500 text-xs font-medium mt-3">Selecciona cuántos asientos necesitas para este viaje compartido.</p>
                            </div>

                            <div className="bg-slate-50 rounded-[2.5rem] p-8 space-y-6">
                               {liveSelectedExpresoTrip.ruta && (
                                 <div className="bg-white/50 p-6 rounded-3xl border border-indigo-100/30 space-y-2">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                      <Navigation size={16} />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Ruta del Viaje</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                      "{liveSelectedExpresoTrip.ruta}"
                                    </p>
                                 </div>
                               )}
                               <div className="flex justify-center gap-4">
                                  {[1, 2, 3, 4].map(num => (
                                    <button
                                      key={num}
                                      disabled={num > liveSelectedExpresoTrip.cuposDisponibles}
                                      onClick={() => setExpresoForm({...expresoForm, cuposTotales: num})}
                                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${
                                        expresoForm.cuposTotales === num 
                                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-110' 
                                        : num > liveSelectedExpresoTrip.cuposDisponibles
                                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                                          : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-300'
                                      }`}
                                    >
                                      {num}
                                    </button>
                                  ))}
                               </div>
                               <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Selecciona cantidad de cupos ({liveSelectedExpresoTrip.cuposDisponibles} disponibles)</p>
                            </div>

                            <div className="space-y-4">
                               <div className="flex justify-between items-center px-4">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a pagar</span>
                                  <span className="text-2xl font-black text-slate-900">${(liveSelectedExpresoTrip.valorPorCupo * expresoForm.cuposTotales).toLocaleString()} COP</span>
                               </div>
                               
                               <button 
                                 onClick={() => handleReservarCupo(liveSelectedExpresoTrip, expresoForm.cuposTotales)}
                                 disabled={isBookingExpreso || (liveSelectedExpresoTrip.cuposDisponibles < expresoForm.cuposTotales)}
                                 className={`w-full h-20 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl ${
                                   isBookingExpreso || (liveSelectedExpresoTrip.cuposDisponibles < expresoForm.cuposTotales)
                                   ? 'bg-slate-100 text-slate-400 shadow-none'
                                   : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1'
                                 }`}
                               >
                                 {isBookingExpreso ? (
                                   <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                 ) : (
                                   <>
                                     <ShieldCheck size={24} />
                                     {liveSelectedExpresoTrip.cuposDisponibles < expresoForm.cuposTotales ? 'SIN CUPOS' : 'CONFIRMAR RESERVA'}
                                   </>
                                 )}
                               </button>

                               {(justBooked === liveSelectedExpresoTrip.id || liveSelectedExpresoTrip.pasajeros?.[user.uid]) && (
                                  <div className="flex flex-col gap-3">
                                    <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                                            <ShieldCheck size={20} />
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">¡Cupo Asegurado!</p>
                                            <p className="text-[9px] text-emerald-500 font-bold">Escribe por WhatsApp al conductor</p>
                                          </div>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleWhatsAppContact(
                                              liveSelectedExpresoTrip.conductorTelefono,
                                              liveSelectedExpresoTrip.conductorNombre,
                                              `Hola ${liveSelectedExpresoTrip.conductorNombre}, ya realicé mi reserva para el viaje de las ${new Date(liveSelectedExpresoTrip.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Confírmame por favor.`
                                            );
                                          }}
                                          className="flex items-center gap-3 bg-emerald-500 text-white px-6 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 active:scale-95 group"
                                        >
                                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <MessageCircle size={18} />
                                          </div>
                                          <span>WhatsApp Conductor</span>
                                        </button>
                                      </div>
                                    </div>
                                    <motion.button
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      onClick={() => {
                                        handleCancelarReservaExpreso(liveSelectedExpresoTrip);
                                        setShowExpresoBookingModal(false);
                                        setSelectedExpresoTrip(null);
                                      }}
                                      disabled={isCancellingExpresoReserva === liveSelectedExpresoTrip.id}
                                      className="w-full py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-all"
                                    >
                                      {isCancellingExpresoReserva === liveSelectedExpresoTrip.id ? 'PROCESANDO...' : 'CANCELAR MI RESERVA ACTUAL'}
                                    </motion.button>
                                  </div>
                                )}
                            </div>
                            
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                               <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                               <p className="text-[9px] text-amber-700 font-bold uppercase leading-tight">
                                 Al reservar te comprometes a llegar 10 min antes al punto de encuentro: <span className="text-amber-900">{liveSelectedExpresoTrip.puntoEncuentro}</span>.
                               </p>
                            </div>
                         </div>
                       )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Offer Modal */}
            <AnimatePresence>
              {showOfferModal && selectedTripForOffer && (
                <DriverOfferModal 
                  service={selectedTripForOffer}
                  onClose={() => setShowOfferModal(false)}
                  onSendOffer={(price, time) => submitOferta(price, time)}
                  driverBalance={conductor?.tarjeta_virtual}
                  onRequestRecharge={() => {
                    setShowOfferModal(false);
                    setShowRechargeModal(true);
                  }}
                />
              )}
            </AnimatePresence>

            {/* Rating Modal */}
            <CalificacionModal
              isOpen={showRatingModal && !!selectedTripForRating}
              selectedTrip={selectedTripForRating}
              onClose={() => {
                setShowRatingModal(false);
                setSelectedTripForRating(null);
              }}
              onSubmit={handleModalSubmitRating}
              isSubmitting={isSubmittingRating}
            />

            {/* Registration Modal */}
            <AnimatePresence>
              {showRegModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className={`bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 w-full max-h-[90vh] overflow-y-auto ${
                      regData.rol === 'marca_aliada' ? 'max-w-md' : 'max-w-sm'
                    } shadow-2xl transition-all duration-300 my-auto`}
                  >
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Bienvenido!</h3>
                    <p className="text-slate-500 text-sm mb-6">Completa tu perfil para acceder a todos los servicios de transporte de forma fácil y segura.</p>
                    
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Rol de Registro</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setRegData({ ...regData, rol: 'usuario' })}
                            className={`py-2.5 px-1 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                              regData.rol === 'usuario'
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm shadow-emerald-500/5 font-bold'
                                : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <UserIcon size={16} className={regData.rol === 'usuario' ? 'text-emerald-600' : 'text-slate-400'} />
                            <span className="text-[9px] font-bold uppercase tracking-tight">Pasajero</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setRegData({ ...regData, rol: 'conductor' })}
                            className={`py-2.5 px-1 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                              regData.rol === 'conductor'
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-sm shadow-indigo-500/5 font-bold'
                                : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Car size={16} className={regData.rol === 'conductor' ? 'text-indigo-600' : 'text-slate-400'} />
                            <span className="text-[9px] font-bold uppercase tracking-tight">Conductor</span>
                          </button>
                        </div>
                      </div>

                      {regData.rol !== 'marca_aliada' ? (
                        <>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Cédula</label>
                            <input 
                              required
                              type="text" 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={regData.cedula}
                              onChange={e => setRegData({...regData, cedula: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Teléfono</label>
                            <input 
                              required
                              type="tel" 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={regData.telefono}
                              onChange={e => setRegData({...regData, telefono: e.target.value})}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Departamento</label>
                              {regManualUbicacion ? (
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Tolima"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 placeholder-slate-400"
                                  value={regData.departamento || ''}
                                  onChange={e => setRegData({...regData, departamento: e.target.value})}
                                />
                              ) : (
                                <select 
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                  value={regData.departamento || 'Cundinamarca'}
                                  onChange={e => {
                                    const dep = e.target.value;
                                    const cities = COLOMBIA_DEPARTMENTS[dep] || [];
                                    setRegData({
                                      ...regData,
                                      departamento: dep,
                                      ciudad: cities[0] || ''
                                    });
                                  }}
                                >
                                  {DEPARTMENTS_LIST.map(dep => (
                                    <option key={dep} value={dep}>{dep}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Ciudad / Municipio</label>
                              {regManualUbicacion ? (
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Ibagué"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 placeholder-slate-400"
                                  value={regData.ciudad || ''}
                                  onChange={e => setRegData({...regData, ciudad: e.target.value})}
                                />
                              ) : (
                                <select 
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                  value={regData.ciudad}
                                  onChange={e => setRegData({...regData, ciudad: e.target.value})}
                                >
                                  {(COLOMBIA_DEPARTMENTS[regData.departamento || 'Cundinamarca'] || []).map(city => (
                                    <option key={city} value={city}>{city}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Género</label>
                              <select 
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={regData.genero}
                                onChange={e => setRegData({...regData, genero: e.target.value})}
                              >
                                <option value="masculino">Masculino</option>
                                <option value="femenino">Femenino</option>
                                <option value="otro">Otro</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end pr-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newValue = !regManualUbicacion;
                                setRegManualUbicacion(newValue);
                                setRegData({
                                  ...regData,
                                  departamento: newValue ? '' : 'Cundinamarca',
                                  ciudad: newValue ? '' : 'Fusagasugá'
                                });
                              }}
                              className="text-[10px] text-emerald-600 font-bold hover:underline hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              {regManualUbicacion ? "📋 Seleccionar de lista predeterminada" : "✍️ ¿No aparece tu departamento o ciudad? Escríbelos aquí"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4 pt-1"
                        >
                          <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-100 text-[11px] text-rose-700 leading-relaxed font-medium">
                            🌿 <span className="font-bold">¡Tu negocio en Ruedas Rápidas!</span> Registra tu Marca Aliada para aparecer en nuestro catálogo interactivo y empezar a recibir y despachar pedidos con nuestra red de conductores aliados.
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-bold text-rose-500 ml-1 flex items-center gap-1">
                              <Store size={10} /> Nombre Comercial de la Marca
                            </label>
                            <input 
                              required
                              type="text" 
                              placeholder="Ej: El Buen Gusto Gourmet"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-semibold text-slate-800"
                              value={regData.nombre_comercial}
                              onChange={e => setRegData({...regData, nombre_comercial: e.target.value})}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Categoría</label>
                              <select 
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                                value={regData.categoria_aliado}
                                onChange={e => setRegData({...regData, categoria_aliado: e.target.value})}
                              >
                                <option value="Restaurante">🍔 Restaurante</option>
                                <option value="Droguería">💊 Droguería</option>
                                <option value="Ferretería">🔨 Ferretería</option>
                                <option value="Supermercado">🛒 Supermercado</option>
                                <option value="Tecnología">💻 Tecnología</option>
                                <option value="Otro">📦 Otro Negocio</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Nro WhatsApp (Contacto)</label>
                              <input 
                                required
                                type="tel" 
                                placeholder="Ej: 3123456789"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                                value={regData.whatsapp_aliado}
                                onChange={e => setRegData({...regData, whatsapp_aliado: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Depto de Cobertura</label>
                              {regManualUbicacion ? (
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Santander"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-medium text-slate-800 placeholder-slate-400"
                                  value={regData.departamento || ''}
                                  onChange={e => setRegData({...regData, departamento: e.target.value})}
                                />
                              ) : (
                                <select 
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                                  value={regData.departamento || 'Cundinamarca'}
                                  onChange={e => {
                                    const dep = e.target.value;
                                    const cities = COLOMBIA_DEPARTMENTS[dep] || [];
                                    setRegData({
                                      ...regData,
                                      departamento: dep,
                                      ciudad: cities[0] || ''
                                    });
                                  }}
                                >
                                  {DEPARTMENTS_LIST.map(dep => (
                                    <option key={dep} value={dep}>{dep}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Ciudad de Cobertura</label>
                              {regManualUbicacion ? (
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Ej: Bucaramanga"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-medium text-slate-800 placeholder-slate-400"
                                  value={regData.ciudad || ''}
                                  onChange={e => setRegData({...regData, ciudad: e.target.value})}
                                />
                              ) : (
                                <select 
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                                  value={regData.ciudad}
                                  onChange={e => setRegData({...regData, ciudad: e.target.value})}
                                >
                                  {(COLOMBIA_DEPARTMENTS[regData.departamento || 'Cundinamarca'] || []).map(city => (
                                    <option key={city} value={city}>{city}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">NIT / Cédula Propietario</label>
                              <input 
                                required
                                type="text" 
                                placeholder="Ej: 1012345678"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                                value={regData.cedula}
                                onChange={e => setRegData({...regData, cedula: e.target.value})}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end pr-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newValue = !regManualUbicacion;
                                setRegManualUbicacion(newValue);
                                setRegData({
                                  ...regData,
                                  departamento: newValue ? '' : 'Cundinamarca',
                                  ciudad: newValue ? '' : 'Fusagasugá'
                                });
                              }}
                              className="text-[10px] text-rose-600 font-bold hover:underline hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              {regManualUbicacion ? "📋 Seleccionar de lista predeterminada" : "✍️ ¿No aparece tu departamento o ciudad? Escríbelos aquí"}
                            </button>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Dirección Física (Despachos)</label>
                            <input 
                              required
                              type="text" 
                              placeholder="Ej: Calle 8 # 6-24 Centro"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none text-slate-700"
                              value={regData.direccion_fisica}
                              onChange={e => setRegData({...regData, direccion_fisica: e.target.value})}
                            />
                          </div>
                        </motion.div>
                      )}

                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <input 
                          type="checkbox" 
                          id="terms"
                          className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                          checked={termsAccepted}
                          onChange={e => setTermsAccepted(e.target.checked)}
                        />
                        <label htmlFor="terms" className="text-[11px] text-slate-500 leading-tight">
                          Acepto el <button type="button" onClick={() => setShowTermsModal(true)} className="text-emerald-600 font-bold underline">Contrato de Uso y Exoneración de Responsabilidad</button> de Ruedas Rápidas.
                        </label>
                      </div>
                      <button 
                        type="submit"
                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 mt-4"
                      >
                        RECLAMAR MI BONO
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Modal de Mi Perfil (Editable) */}
            <AnimatePresence>
              {showProfileModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl flex flex-col"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 leading-tight">Mi Perfil</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Editar Información</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowProfileModal(false)} 
                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-5">
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-wider block mb-1.5">Nombre Completo</label>
                        <input 
                          required
                          type="text" 
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm"
                          value={profileFormData.nombre}
                          onChange={e => setProfileFormData({...profileFormData, nombre: e.target.value})}
                          placeholder="Ej: Juan Pérez"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-wider block mb-1.5">WhatsApp / Celular</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-slate-400 text-sm font-bold">+57</span>
                          <input 
                            required
                            type="tel" 
                            pattern="[0-9]{10}"
                            title="Por favor ingresa un número de 10 dígitos"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 pl-12 text-sm font-mono font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm"
                            value={profileFormData.celular}
                            onChange={e => setProfileFormData({...profileFormData, celular: e.target.value.replace(/\D/g, '')})}
                            placeholder="3123456789"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-wider block mb-1.5">Depto de Operación</label>
                          {profileManualUbicacion ? (
                            <input 
                              required
                              type="text" 
                              placeholder="Ej: Caldas"
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm font-medium text-slate-800 placeholder-slate-400"
                              value={profileFormData.departamento || ''}
                              onChange={e => setProfileFormData({...profileFormData, departamento: e.target.value})}
                            />
                          ) : (
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm"
                              value={profileFormData.departamento || 'Cundinamarca'}
                              onChange={e => {
                                const dep = e.target.value;
                                const cities = COLOMBIA_DEPARTMENTS[dep] || [];
                                setProfileFormData({
                                  ...profileFormData,
                                  departamento: dep,
                                  ciudad: cities[0] || ''
                                });
                              }}
                            >
                              {DEPARTMENTS_LIST.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-wider block mb-1.5">Ciudad de Operación</label>
                          {profileManualUbicacion ? (
                            <input 
                              required
                              type="text" 
                              placeholder="Ej: Manizales"
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm font-medium text-slate-800 placeholder-slate-400"
                              value={profileFormData.ciudad || ''}
                              onChange={e => setProfileFormData({...profileFormData, ciudad: e.target.value})}
                            />
                          ) : (
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm"
                              value={profileFormData.ciudad}
                              onChange={e => setProfileFormData({...profileFormData, ciudad: e.target.value})}
                            >
                              {(COLOMBIA_DEPARTMENTS[profileFormData.departamento || 'Cundinamarca'] || []).map(city => (
                                <option key={city} value={city}>{city}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end pr-1 mt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !profileManualUbicacion;
                            setProfileManualUbicacion(newValue);
                            setProfileFormData({
                              ...profileFormData,
                              departamento: newValue ? '' : 'Cundinamarca',
                              ciudad: newValue ? '' : 'Fusagasugá'
                            });
                          }}
                          className="text-[10px] text-indigo-600 font-bold hover:underline hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        >
                          {profileManualUbicacion ? "📋 Seleccionar de lista" : "✍️ Escribir manual"}
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                        * Cambiar tu ciudad te permitirá solicitar servicios en la nueva ubicación de inmediato.
                      </p>

                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-wider block mb-1.5">Género</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm"
                          value={profileFormData.genero}
                          onChange={e => setProfileFormData({...profileFormData, genero: e.target.value})}
                        >
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <button 
                          type="submit"
                          disabled={isUpdatingProfile}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdatingProfile ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check size={16} />
                              Guardar Cambios
                            </>
                          )}
                        </button>
                      </div>

                      {!conductor && (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="text-left">
                            <p className="text-[11px] font-bold text-slate-800">¿Quieres ser conductor?</p>
                            <p className="text-[9px] text-slate-400">Postula tu vehículo y genera ingresos</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileModal(false);
                              setShowDriverRegModal(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                          >
                            <span>Postularme</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      )}
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Terms and Conditions Modal */}
            <AnimatePresence>
              {showTermsModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col"
                  >
                    <div className="flex justify-between items-center mb-4 shrink-0">
                      <h3 className="text-xl font-bold text-slate-900">Términos y Condiciones</h3>
                      <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600">
                        <LogOut size={20} className="rotate-180" />
                      </button>
                    </div>
                    
                    <div className="overflow-y-auto pr-2 text-xs text-slate-600 space-y-4 leading-relaxed custom-scrollbar">
                      <p className="font-bold text-slate-800 uppercase">Contrato de Uso y Exoneración de Responsabilidad (Términos y Condiciones)</p>
                      <p className="font-bold">Ruedas Rápidas - Aplicación de Servicio de Transporte</p>
                      <p>Fecha de Última Actualización: 29 de Marzo de 2026</p>
                      
                      <section>
                        <p className="font-bold text-slate-800 mb-1">1. Aceptación de los Términos</p>
                        <p>Este Contrato de Uso y Exoneración de Responsabilidad establece los términos y condiciones legalmente vinculantes para el uso de la aplicación móvil y plataforma web "Ruedas Rápidas". Al acceder o utilizar la App, usted manifiesta que ha leído, entendido y acepta estar legalmente sujeto a estos Términos.</p>
                      </section>

                      <section>
                        <p className="font-bold text-slate-800 mb-1">2. Descripción del Servicio</p>
                        <p>Ruedas Rápidas es una plataforma tecnológica que facilita la conexión entre usuarios que requieren servicios de transporte o mensajería ("Pasajeros") y proveedores independientes de dichos servicios ("Conductores"). La Compañía NO presta servicios de transporte ni actúa como empresa de transporte.</p>
                      </section>

                      <section>
                        <p className="font-bold text-slate-800 mb-1">3. Obligaciones del Usuario</p>
                        <p>El Usuario se compromete a proporcionar información veraz, ser mayor de edad, utilizar el servicio de manera legal y tratar con respeto a los demás usuarios y conductores.</p>
                      </section>

                      <section>
                        <p className="font-bold text-slate-800 mb-1">4. Exoneración de Responsabilidad</p>
                        <p>La Compañía no es responsable por la conducta de los usuarios, la calidad del vehículo, retrasos, accidentes, pérdida de objetos personales o cualquier daño directo o indirecto derivado del uso del servicio. El transporte es un acuerdo privado entre Pasajero y Conductor.</p>
                      </section>

                      <section>
                        <p className="font-bold text-slate-800 mb-1">5. Privacidad y Datos</p>
                        <p>Sus datos personales serán tratados conforme a nuestra Política de Privacidad y la Ley 1581 de 2012 de Protección de Datos Personales en Colombia.</p>
                      </section>

                      <section>
                        <p className="font-bold text-slate-800 mb-1">6. Modificaciones</p>
                        <p>La Compañía se reserva el derecho de modificar estos términos en cualquier momento. El uso continuado de la App tras dichos cambios constituye la aceptación de los nuevos términos.</p>
                      </section>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 shrink-0">
                      {!perfil?.terminos_aceptados && (
                        <div className="flex items-center gap-3 mb-4">
                          <input 
                            type="checkbox" 
                            id="modal-terms"
                            className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                            checked={termsAccepted}
                            onChange={e => setTermsAccepted(e.target.checked)}
                          />
                          <label htmlFor="modal-terms" className="text-[11px] text-slate-500 font-bold">
                            He leído y acepto los términos.
                          </label>
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          if (!perfil?.terminos_aceptados && !termsAccepted) {
                            alert("Debe marcar la casilla de aceptación.");
                            return;
                          }
                          if (perfil && !perfil.terminos_aceptados) {
                            // Si ya tiene perfil pero no aceptó términos (usuario antiguo)
                            // Aquí deberíamos llamar a una función para actualizar el perfil
                            handleAceptarTerminosExistente();
                          }
                          setShowTermsModal(false);
                        }}
                        className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all text-sm uppercase tracking-wider"
                      >
                        {perfil?.terminos_aceptados ? 'Cerrar' : 'Aceptar y Continuar'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

             {/* Despachador de Aliados Modal */}
             <AnimatePresence>
               {showAliadoDispatchModal && (
                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
                 >
                   <motion.div 
                     initial={{ scale: 0.95, y: 15 }}
                     animate={{ scale: 1, y: 0 }}
                     exit={{ scale: 0.95, y: 15 }}
                     className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-slate-100"
                   >
                     {/* Head */}
                     <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start shrink-0">
                       <div className="flex gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                           <Store size={22} />
                         </div>
                         <div>
                           <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Despacho de Aliado</h3>
                           <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest leading-none mt-1">Saca envíos rápidos con negociación de precio</p>
                         </div>
                       </div>
                       <button 
                         onClick={() => setShowAliadoDispatchModal(false)}
                         className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                       >
                         <X size={16} />
                       </button>
                     </div>

                     {/* Body Form */}
                     <form onSubmit={handleCrearEntregaAliada} className="p-6 space-y-4">
                       <div>
                         <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Selecciona tu Negocio Original</label>
                         <select 
                           required
                           className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                           value={dispatchSelectedAliadoId}
                           onChange={e => setDispatchSelectedAliadoId(e.target.value)}
                         >
                           <option value="">-- Selecciona un Negocio Registrado --</option>
                           {marcasAliadas.map(m => (
                             <option key={m.id} value={m.id}>
                               {m.nombre} ({m.ciudad} - {m.direccion})
                             </option>
                           ))}
                         </select>
                         <p className="text-[9px] text-slate-400 mt-1 ml-1">Elegir un comercio autocompletará la dirección de origen para los motores/repartidores.</p>
                       </div>

                       <div>
                         <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Dirección de Destino</label>
                         <input 
                           required
                           type="text" 
                           placeholder="Ej: Carrera 4 # 5-10 Barrio Centro"
                           className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                           value={dispatchDestino}
                           onChange={e => setDispatchDestino(e.target.value)}
                         />
                       </div>

                       <div>
                         <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Detalles del Pedido</label>
                         <input 
                           type="text" 
                           placeholder="Ej: Llevar con cambio de $20K, frágil, etc."
                           className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                           value={dispatchDetalles}
                           onChange={e => setDispatchDetalles(e.target.value)}
                         />
                       </div>

                       {/* Banner explicativo de negociación y base inicial */}
                       <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-left">
                         <div className="flex gap-2.5">
                           <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                           <div className="space-y-1">
                             <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none">Negociación de Tarifa Activa</p>
                             <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                               El despacho se inicia con la oferta base estándar de <strong className="font-mono text-xs font-bold text-amber-900">$5,000 COP</strong>. Los conductores activos ofertarán su tarifa y tú podrás seleccionar la mejor opción, igual que en las solicitudes comunes.
                             </p>
                           </div>
                         </div>
                       </div>

                       <button 
                         type="submit"
                         className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 shrink-0 flex items-center justify-center gap-2 mt-2"
                       >
                         <Check size={16} /> Solicitar Repartidor
                       </button>
                     </form>
                   </motion.div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* Registra tu Marca Aliada Modal */}
             <AnimatePresence>               {showUserMarcaRegistroModal && (
                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   onClick={() => setShowUserMarcaRegistroModal(false)}
                   className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto p-4 md:p-6 flex items-center justify-center cursor-pointer"
                 >
                   <motion.div 
                     initial={{ scale: 0.95, y: 15 }}
                     animate={{ scale: 1, y: 0 }}
                     exit={{ scale: 0.95, y: 15 }}
                     onClick={(e) => e.stopPropagation()}
                     className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-slate-100 cursor-default my-auto relative"
                   >
                     {/* Head */}
                     <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 p-6 border-b border-rose-100 flex justify-between items-start shrink-0">
                       <div className="flex gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                           <Store size={20} />
                         </div>
                         <div>
                           <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                             {marcasAliadas.some(m => m.creadorId === user?.uid) ? "Mi Comercio & Oferta" : "Une tu Comercio"}
                           </h3>
                           <p className="text-[10px] text-rose-600 font-extrabold uppercase tracking-wider leading-none mt-1">
                             {marcasAliadas.some(m => m.creadorId === user?.uid) ? "Administra tus datos y tu oferta del día" : "Registra tu marca aliada en la red"}
                           </p>
                         </div>
                       </div>
                       <button 
                         type="button"
                         onClick={() => setShowUserMarcaRegistroModal(false)}
                         className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                       >
                         <X size={16} />
                       </button>
                     </div>

                     {/* Body Form */}
                     <form onSubmit={registrarMarcaDesdeUsuario} className="p-6 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar text-left">
                       <div className="p-3 bg-gradient-to-r from-rose-500/5 to-pink-500/5 rounded-2xl border border-rose-500/10 text-[10.5px] text-rose-800 leading-relaxed font-bold">
                         {marcasAliadas.some(m => m.creadorId === user?.uid) 
                           ? "✨ Mantén actualizados los datos de tu comercio y activa la Oferta del Día para aparecer destacado en la parte superior del catálogo de todos los usuarios." 
                           : "🌿 Al registrar tu comercio, aparecerás de inmediato en el catálogo interactivo de marcas aliadas y podrás despachar pedidos de forma ágil y segura con nuestra red de conductores."
                         }
                       </div>

                       {/* DATOS GENERALES DEL NEGOCIO */}
                       <div className="space-y-4">
                         <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                           <span className="text-xs">📋</span>
                           <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Datos de Identificación del Comercio</h4>
                         </div>

                         <div>
                           <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Nombre del Negocio</label>
                           <div className="relative">
                             <Store size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                             <input 
                               required
                               type="text" 
                               placeholder="Ej: Restaurante El Sabor Real"
                               className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-11 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs"
                               value={userMarcaNombre}
                               onChange={e => setUserMarcaNombre(e.target.value)}
                             />
                           </div>
                         </div>

                         <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Categoría</label>
                             <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs pointer-events-none">🏷️</span>
                               <select 
                                 required
                                 className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-8 pl-10 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all appearance-none cursor-pointer shadow-xs"
                                 value={userMarcaCategoria}
                                 onChange={e => setUserMarcaCategoria(e.target.value)}
                               >
                                 <option value="Restaurante">🍔 Restaurante</option>
                                 <option value="Droguería">💊 Droguería</option>
                                 <option value="Ferretería">🔨 Ferretería</option>
                                 <option value="Supermercado">🛒 Supermercado</option>
                                 <option value="Tecnología">💻 Tecnología</option>
                                 <option value="Otro">📦 Otro Negocio</option>
                               </select>
                               <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                             </div>
                           </div>

                           <div>
                             <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Nro WhatsApp</label>
                             <div className="relative">
                               <Smartphone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                               <input 
                                 required
                                 type="tel" 
                                 placeholder="Ej: 3123456789"
                                 className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-11 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs"
                                 value={userMarcaWhatsapp}
                                 onChange={e => setUserMarcaWhatsapp(e.target.value)}
                               />
                             </div>
                           </div>
                         </div>

                         <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Ciudad</label>
                             <div className="relative">
                               <MapPin size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                               <input 
                                 required
                                 type="text" 
                                 placeholder="Ej: Arauca"
                                 className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-11 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs"
                                 value={userMarcaCiudad}
                                 onChange={e => setUserMarcaCiudad(e.target.value)}
                               />
                             </div>
                           </div>

                           <div>
                             <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Dirección Física</label>
                             <div className="relative">
                               <Navigation size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                               <input 
                                 required
                                 type="text" 
                                 placeholder="Ej: Calle 15 # 20-30"
                                 className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-11 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs"
                                 value={userMarcaDireccion}
                                 onChange={e => setUserMarcaDireccion(e.target.value)}
                               />
                             </div>
                           </div>
                         </div>

                         {/* Logo Upload */}
                         <div>
                           <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Logo del Comercio (Opcional)</label>
                           <div 
                             onDragOver={(e) => {
                               e.preventDefault();
                               setUserLogoDragActive(true);
                             }}
                             onDragLeave={() => setUserLogoDragActive(false)}
                             onDrop={(e) => {
                               e.preventDefault();
                               setUserLogoDragActive(false);
                               if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                 handleLogoUpload(e.dataTransfer.files[0], setUserMarcaLogo);
                               }
                             }}
                             className={`mt-1 border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden ${
                               userLogoDragActive 
                                 ? "border-rose-500 bg-rose-50/50" 
                                 : userMarcaLogo 
                                   ? "border-emerald-300 bg-emerald-50/10" 
                                   : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                             }`}
                           >
                             <input 
                               type="file" 
                               accept="image/*"
                               onChange={(e) => {
                                 if (e.target.files && e.target.files[0]) {
                                   handleLogoUpload(e.target.files[0], setUserMarcaLogo);
                                 }
                               }}
                               className="absolute inset-0 opacity-0 cursor-pointer z-10"
                             />
                             {userMarcaLogo ? (
                               <div className="flex flex-col items-center gap-2 text-center">
                                 <img 
                                   src={userMarcaLogo} 
                                   alt="Logo previsualización" 
                                   className="w-14 h-14 rounded-xl object-cover border border-slate-100 shadow-sm"
                                   referrerPolicy="no-referrer"
                                 />
                                 <div className="space-y-0.5">
                                   <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1 justify-center">
                                     <Check size={10} /> ¡Logo cargado!
                                   </p>
                                   <button 
                                     type="button"
                                     onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       setUserMarcaLogo("");
                                     }}
                                     className="text-[8px] text-rose-500 hover:text-rose-700 font-extrabold uppercase tracking-wider underline relative z-20 cursor-pointer"
                                   >
                                     Eliminar
                                   </button>
                                 </div>
                               </div>
                             ) : (
                               <div className="flex flex-col items-center gap-1.5 text-center py-1">
                                 <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                   <Upload size={14} />
                                 </div>
                                 <div className="space-y-0.5">
                                   <p className="text-[10px] font-black text-slate-600 leading-tight">
                                     Arrastra tu logo aquí o <span className="text-rose-500 underline">busca un archivo</span>
                                   </p>
                                   <p className="text-[8px] text-slate-400 font-medium">PNG, JPG o JPEG (Max 2MB)</p>
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>

                       {/* SECCIÓN OFERTA DEL DÍA (MERCADOLIBRE O DAFITI STYLE) */}
                       <div className="pt-4 border-t border-slate-100 space-y-4">
                         <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-rose-50 to-pink-50/50 p-3.5 rounded-2xl border border-rose-500/10">
                           <div className="space-y-0.5">
                             <span className="flex items-center gap-1.5">
                               <span className="text-xs">⚡</span>
                               <h4 className="text-[10.5px] uppercase font-black text-rose-700 tracking-tight leading-none">Mi Oferta del Día</h4>
                             </span>
                             <p className="text-[9px] text-slate-500 font-bold leading-relaxed">
                               Activa esta opción para publicar un producto con descuento destacado.
                             </p>
                           </div>
                           <button
                             type="button"
                             onClick={() => setUserOfferActiva(!userOfferActiva)}
                             className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shrink-0 ${
                               userOfferActiva ? "bg-rose-500" : "bg-slate-200"
                             }`}
                           >
                             <div
                               className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
                                 userOfferActiva ? "translate-x-5" : "translate-x-0"
                               }`}
                             />
                           </button>
                         </div>

                         {userOfferActiva && (
                           <motion.div 
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             className="space-y-4 pt-1"
                           >
                             <div>
                               <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Título de la Oferta / Combo</label>
                               <div className="relative">
                                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs">🍔</span>
                                 <input 
                                   required={userOfferActiva}
                                   type="text" 
                                   placeholder="Ej: Hamburguesa Especial + Papas + Gaseosa (2x1)"
                                   className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-11 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs"
                                   value={userOfferTitulo}
                                   onChange={e => setUserOfferTitulo(e.target.value)}
                                 />
                               </div>
                             </div>

                             <div>
                               <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Descripción breve del Descuento</label>
                               <textarea 
                                 placeholder="Ej: Solo por el día de hoy, incluye adición de queso cheddar gratis..."
                                 rows={2}
                                 className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs"
                                 value={userOfferDescripcion}
                                 onChange={e => setUserOfferDescripcion(e.target.value)}
                               />
                             </div>

                             <div className="grid grid-cols-2 gap-3">
                               <div>
                                 <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Precio Original ($ COP)</label>
                                 <div className="relative">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                                   <input 
                                     required={userOfferActiva}
                                     type="number" 
                                     placeholder="Ej: 30000"
                                     className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-8 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs font-mono"
                                     value={userOfferPrecioOriginal}
                                     onChange={e => setUserOfferPrecioOriginal(e.target.value)}
                                   />
                                 </div>
                               </div>

                               <div>
                                 <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Precio de Oferta ($ COP)</label>
                                 <div className="relative">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                                   <input 
                                     required={userOfferActiva}
                                     type="number" 
                                     placeholder="Ej: 19900"
                                     className="w-full bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl py-3 pr-4 pl-8 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:bg-white transition-all shadow-xs font-mono"
                                     value={userOfferPrecioDescuento}
                                     onChange={e => setUserOfferPrecioDescuento(e.target.value)}
                                   />
                                 </div>
                               </div>
                             </div>

                             {/* Oferta Product Image Upload */}
                             <div>
                               <label className="text-[10px] uppercase font-black text-slate-500 ml-1 mb-1 block">Foto del Producto en Oferta (Recomendado)</label>
                               <div 
                                 onDragOver={(e) => {
                                   e.preventDefault();
                                   setUserOfferDragActive(true);
                                 }}
                                 onDragLeave={() => setUserOfferDragActive(false)}
                                 onDrop={(e) => {
                                   e.preventDefault();
                                   setUserOfferDragActive(false);
                                   if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                     handleLogoUpload(e.dataTransfer.files[0], setUserOfferImagen);
                                   }
                                 }}
                                 className={`border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden ${
                                   userOfferDragActive 
                                     ? "border-rose-500 bg-rose-50/50" 
                                     : userOfferImagen 
                                       ? "border-emerald-300 bg-emerald-50/10" 
                                       : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                                 }`}
                               >
                                 <input 
                                   type="file" 
                                   accept="image/*"
                                   onChange={(e) => {
                                     if (e.target.files && e.target.files[0]) {
                                       handleLogoUpload(e.target.files[0], setUserOfferImagen);
                                     }
                                   }}
                                   className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                 />
                                 {userOfferImagen ? (
                                   <div className="flex flex-col items-center gap-2 text-center">
                                     <img 
                                       src={userOfferImagen} 
                                       alt="Oferta previsualización" 
                                       className="w-full max-h-32 rounded-xl object-contain border border-slate-100 shadow-xs"
                                       referrerPolicy="no-referrer"
                                     />
                                     <div className="space-y-0.5">
                                       <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1 justify-center">
                                         <Check size={10} /> ¡Foto cargada correctamente!
                                       </p>
                                       <button 
                                         type="button"
                                         onClick={(e) => {
                                           e.preventDefault();
                                           e.stopPropagation();
                                           setUserOfferImagen("");
                                         }}
                                         className="text-[8px] text-rose-500 hover:text-rose-700 font-extrabold uppercase tracking-wider underline relative z-20 cursor-pointer"
                                       >
                                         Cambiar imagen
                                       </button>
                                     </div>
                                   </div>
                                 ) : (
                                   <div className="flex flex-col items-center gap-1.5 text-center py-2">
                                     <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                       <Image size={14} />
                                     </div>
                                     <div className="space-y-0.5">
                                       <p className="text-[10px] font-black text-slate-600 leading-tight">
                                         Sube la foto del producto o <span className="text-rose-500 underline">busca un archivo</span>
                                       </p>
                                       <p className="text-[8px] text-slate-400 font-medium">Recomendado formato rectangular (Max 2MB)</p>
                                     </div>
                                   </div>
                                 )}
                               </div>
                             </div>

                             {/* PREVIEW EN TIEMPO REAL (DAFITI / MERCADOLIBRE STYLE) */}
                             <div className="bg-slate-900 rounded-[2rem] p-4 text-white space-y-3 shadow-inner relative overflow-hidden select-none">
                               <div className="absolute top-2 right-2 bg-rose-500 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest animate-pulse">
                                 PREVIEW REAL
                               </div>
                               <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Previsualización de tu Oferta</span>
                               
                               <div className="bg-white rounded-2xl p-3 text-slate-800 flex gap-3 shadow-md">
                                 <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative">
                                   {userOfferImagen ? (
                                     <img src={userOfferImagen} className="w-full h-full object-cover" alt="preview" referrerPolicy="no-referrer" />
                                   ) : (
                                     <div className="text-center p-1 flex flex-col items-center justify-center">
                                       <ShoppingBag size={18} className="text-slate-400 mb-1" />
                                       <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Sin foto</span>
                                     </div>
                                   )}
                                   <div className="absolute bottom-1 left-1 bg-emerald-500 text-white text-[7px] font-black uppercase px-1 rounded shadow-sm">
                                     {userOfferPrecioOriginal && userOfferPrecioDescuento
                                       ? `${Math.round(((Number(userOfferPrecioOriginal) - Number(userOfferPrecioDescuento)) / Number(userOfferPrecioOriginal)) * 100)}% OFF`
                                       : "OFERTA"
                                     }
                                   </div>
                                 </div>

                                 <div className="flex-1 flex flex-col justify-between text-left py-0.5 min-w-0">
                                   <div>
                                     <div className="flex items-center gap-1">
                                       <span className="bg-rose-50 border border-rose-100 text-rose-600 text-[6.5px] font-extrabold px-1 rounded uppercase tracking-wider">
                                         {userMarcaCategoria}
                                       </span>
                                       <span className="text-[7.5px] font-black text-emerald-600 uppercase tracking-wider">¡Envío Gratis!</span>
                                     </div>
                                     <h5 className="text-[11px] font-black text-slate-800 leading-tight truncate uppercase mt-1">
                                       {userOfferTitulo || "Título de tu producto estrella"}
                                     </h5>
                                     <p className="text-[9px] text-slate-400 font-bold leading-none truncate mt-0.5">
                                       {userOfferDescripcion || "Agrega una descripción para tentar a tus clientes..."}
                                     </p>
                                   </div>

                                   <div className="flex items-baseline gap-1.5 mt-1">
                                     <span className="text-xs sm:text-sm font-black text-slate-900 leading-none">
                                       ${Number(userOfferPrecioDescuento).toLocaleString('es-CO') || '0'}
                                     </span>
                                     {userOfferPrecioOriginal && (
                                       <span className="text-[9px] text-slate-400 line-through leading-none">
                                         ${Number(userOfferPrecioOriginal).toLocaleString('es-CO')}
                                       </span>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           </motion.div>
                         )}
                       </div>

                       <div className="flex gap-3 pt-3">
                         <button 
                           type="button"
                           onClick={() => setShowUserMarcaRegistroModal(false)}
                           className="flex-1 h-13 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl text-[10px] uppercase tracking-wider transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer border border-slate-200 active:scale-95"
                         >
                           Cancelar
                         </button>
                         <button 
                           type="submit"
                           className="flex-[2] h-13 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:scale-95 text-white font-black rounded-2xl text-[10px] uppercase tracking-wider transition-all shadow-xl shadow-rose-950/20 shrink-0 flex items-center justify-center gap-2 cursor-pointer border border-rose-400/20"
                         >
                           <Check size={16} /> 
                           {marcasAliadas.some(m => m.creadorId === user?.uid) ? "Guardar Cambios" : "Completar Registro"}
                         </button>
                       </div>
                     </form>
                   </motion.div>
                 </motion.div>
               )}
             </AnimatePresence>

              {/* Modal Detalle Aliado Comercial & Oferta */}
              <AnimatePresence>
                {selectedAliadoForUser && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedAliadoForUser(null)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto p-4 md:p-6 flex items-center justify-center cursor-pointer"
                  >
                    <motion.div 
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col overflow-hidden border border-slate-100 cursor-default my-auto relative"
                    >
                      {/* Header */}
                      <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 border-b border-rose-100 flex justify-between items-start shrink-0">
                        <div className="flex gap-4 items-center">
                          <div className="w-14 h-14 rounded-2xl bg-white border border-rose-150 flex items-center justify-center p-1.5 shadow-sm overflow-hidden shrink-0">
                            {selectedAliadoForUser.logo ? (
                              <img 
                                src={selectedAliadoForUser.logo} 
                                alt={selectedAliadoForUser.nombre} 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                <Store size={22} />
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                              {selectedAliadoForUser.categoria || 'Otro'}
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight mt-1 leading-tight">
                              {selectedAliadoForUser.nombre}
                            </h3>
                            <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mt-1.5 flex items-center gap-1">
                              <MapPin size={10} className="text-rose-500" /> {selectedAliadoForUser.ciudad || 'Fusagasugá'} • Entrega Hoy
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setSelectedAliadoForUser(null)}
                          className="w-8 h-8 rounded-full bg-white/80 border border-slate-200/50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Body */}
                      <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh] custom-scrollbar text-left">
                        {/* ACTIVE OFFER BOX */}
                        {selectedAliadoForUser.oferta && selectedAliadoForUser.oferta.activa && selectedAliadoForUser.oferta.titulo ? (
                          <div className="bg-slate-900 rounded-[2.25rem] p-6 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
                            {/* Subtle premium gradient light source */}
                            <div className="absolute -right-20 -top-20 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -left-20 -bottom-20 w-44 h-44 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative z-10 space-y-4">
                              {/* Badge & Discount */}
                              <div className="flex items-center justify-between">
                                <span className="bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border border-rose-500/20 tracking-wider flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  🔥 Oferta Especial del Día
                                </span>
                                {selectedAliadoForUser.oferta.porcentajeDescuento > 0 && (
                                  <span className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm tracking-wide">
                                    -{selectedAliadoForUser.oferta.porcentajeDescuento}% OFF
                                  </span>
                                )}
                              </div>

                              {/* Image of the product if exists */}
                              {selectedAliadoForUser.oferta.imagenOferta && (
                                <div className="w-full h-44 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 p-2 flex items-center justify-center">
                                  <img 
                                    src={selectedAliadoForUser.oferta.imagenOferta} 
                                    alt={selectedAliadoForUser.oferta.titulo} 
                                    className="max-w-full max-h-full object-contain rounded-xl transition-transform duration-500 hover:scale-105"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}

                              {/* Offer details */}
                              <div className="space-y-1.5 text-left">
                                <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight">
                                  {selectedAliadoForUser.oferta.titulo}
                                </h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                                  {selectedAliadoForUser.oferta.descripcion}
                                </p>
                              </div>

                              {/* Pricing Row */}
                              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                                <div className="flex flex-col text-left">
                                  <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none mb-1">Precio Promocional</span>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xl sm:text-2xl font-black text-white">${selectedAliadoForUser.oferta.precioDescuento.toLocaleString()}</span>
                                    {selectedAliadoForUser.oferta.precioOriginal > 0 && (
                                      <span className="text-xs text-slate-500 font-bold line-through">${selectedAliadoForUser.oferta.precioOriginal.toLocaleString()}</span>
                                    )}
                                  </div>
                                </div>

                                {selectedAliadoForUser.oferta.precioOriginal > selectedAliadoForUser.oferta.precioDescuento && (
                                  <div className="text-right bg-slate-800/50 border border-slate-800 rounded-xl px-3 py-1.5">
                                    <span className="text-[8px] text-slate-400 uppercase font-black block tracking-wider leading-none mb-0.5">Ahorras hoy</span>
                                    <span className="text-xs font-black text-rose-400">
                                      -${(selectedAliadoForUser.oferta.precioOriginal - selectedAliadoForUser.oferta.precioDescuento).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Order button */}
                              {(() => {
                                const orderMsg = `¡Hola ${selectedAliadoForUser.nombre}! Vi tu Oferta Especial del Día '${selectedAliadoForUser.oferta.titulo}' por $${selectedAliadoForUser.oferta.precioDescuento} en Ruedas Rápidas. Quisiera pedirla para despacho en mi dirección.`;
                                const waPh = cleanPhone(selectedAliadoForUser.whatsapp);
                                const orderLink = `https://wa.me/${waPh}?text=${encodeURIComponent(orderMsg)}`;

                                return (
                                  <a 
                                    href={orderLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-3 border border-rose-500/20 active:scale-[0.98]"
                                  >
                                    <MessageCircle size={15} className="fill-white/10 text-white" />
                                    <span>Pedir Oferta por WhatsApp</span>
                                  </a>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-150 p-6 rounded-3xl text-center space-y-2">
                            <div className="w-10 h-10 bg-slate-100 border border-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                              <Tag size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">Sin Ofertas Activas</h4>
                              <p className="text-[10px] text-slate-400 font-bold leading-normal mt-0.5">
                                Este comercio no tiene ofertas publicadas en este momento. ¡Pero puedes pedir cualquiera de sus productos directamente por WhatsApp!
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Informacion de contacto & Ubicacion */}
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                            <span className="text-xs">📍</span>
                            <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Información y Contacto</h4>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-left">
                              <span className="text-[8px] text-slate-400 uppercase font-black block tracking-wider">Dirección Física</span>
                              <span className="text-xs font-bold text-slate-700 block mt-1">{selectedAliadoForUser.direccion}</span>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-left">
                              <span className="text-[8px] text-slate-400 uppercase font-black block tracking-wider">WhatsApp Oficial</span>
                              <span className="text-xs font-bold text-slate-700 block mt-1">{selectedAliadoForUser.whatsapp}</span>
                            </div>
                          </div>

                          {/* Direct WhatsApp Message for general orders */}
                          {(!selectedAliadoForUser.oferta || !selectedAliadoForUser.oferta.activa) && (
                            (() => {
                              const genMsg = `¡Hola ${selectedAliadoForUser.nombre}! Te encontré en Ruedas Rápidas. Quisiera solicitar información para realizar un pedido a domicilio.`;
                              const waPh = cleanPhone(selectedAliadoForUser.whatsapp);
                              const genLink = `https://wa.me/${waPh}?text=${encodeURIComponent(genMsg)}`;

                              return (
                                <a 
                                  href={genLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                                >
                                  <MessageCircle size={16} className="fill-white/10" />
                                  <span>Contactar por WhatsApp</span>
                                </a>
                              );
                            })()
                          )}

                          <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200/60 rounded-2xl text-[9.5px] text-slate-500 leading-relaxed font-bold flex items-center gap-2">
                            <span className="text-xs">💡</span>
                            <span>¡Apoya el comercio local! Al comprar a un comercio aliado, contribuyes directamente al desarrollo de tu ciudad.</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            {/* Driver Registration Modal */}
            <AnimatePresence>
              {showDriverRegModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold text-slate-900">Registro Conductor</h3>
                      <button onClick={() => setShowDriverRegModal(false)} className="text-slate-400 hover:text-slate-600">
                        <LogOut size={20} className="rotate-180" />
                      </button>
                    </div>
                    
                    <form onSubmit={handleDriverRegister} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Género</label>
                        <select 
                          value={driverRegData.genero}
                          onChange={(e) => setDriverRegData({...driverRegData, genero: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Departamento</label>
                          {driverRegManualUbicacion ? (
                            <input 
                              required
                              type="text" 
                              placeholder="Ej: Huila"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 placeholder-slate-400"
                              value={driverRegData.departamento || ''}
                              onChange={(e) => setDriverRegData({...driverRegData, departamento: e.target.value})}
                            />
                          ) : (
                            <select 
                              value={driverRegData.departamento || 'Cundinamarca'}
                              onChange={(e) => {
                                const dep = e.target.value;
                                const cities = COLOMBIA_DEPARTMENTS[dep] || [];
                                setDriverRegData({
                                  ...driverRegData,
                                  departamento: dep,
                                  ciudad: cities[0] || ''
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                              {DEPARTMENTS_LIST.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ciudad</label>
                          {driverRegManualUbicacion ? (
                            <input 
                              required
                              type="text" 
                              placeholder="Ej: Neiva"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 placeholder-slate-400"
                              value={driverRegData.ciudad || ''}
                              onChange={(e) => setDriverRegData({...driverRegData, ciudad: e.target.value})}
                            />
                          ) : (
                            <select 
                              value={driverRegData.ciudad}
                              onChange={(e) => setDriverRegData({...driverRegData, ciudad: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                              {(COLOMBIA_DEPARTMENTS[driverRegData.departamento || 'Cundinamarca'] || []).map(city => (
                                <option key={city} value={city}>{city}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end pr-1 mt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !driverRegManualUbicacion;
                            setDriverRegManualUbicacion(newValue);
                            setDriverRegData({
                              ...driverRegData,
                              departamento: newValue ? '' : 'Cundinamarca',
                              ciudad: newValue ? '' : 'Fusagasugá'
                            });
                          }}
                          className="text-[10px] text-emerald-600 font-bold hover:underline hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        >
                          {driverRegManualUbicacion ? "📋 Seleccionar de lista" : "✍️ Escribir manual"}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-900 mb-3">Información del Vehículo</h4>
                        
                        <div className="space-y-3 text-left">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Tipo de Vehículo</label>
                            <select 
                              value={driverRegData.vehiculo.tipo}
                              onChange={(e) => setDriverRegData({
                                ...driverRegData, 
                                vehiculo: { ...driverRegData.vehiculo, tipo: e.target.value }
                              })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                              <option value="moto">Moto</option>
                              <option value="carro">Carro</option>
                              <option value="taxi">Taxi (Amarillo)</option>
                              <option value="camion_flete">Camión (Flete)</option>
                              <option value="camion_acarreo">Camión (Acarreo)</option>
                              <option value="motocarro">Moto Carro</option>
                            </select>
                          </div>

                          {(driverRegData.vehiculo.tipo === 'camion_flete' || driverRegData.vehiculo.tipo === 'camion_acarreo' || driverRegData.vehiculo.tipo === 'motocarro') && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50 space-y-3"
                            >
                              <span className="text-[9px] font-black uppercase text-orange-700 tracking-widest block mb-1">Especificaciones de Carga</span>
                              
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Capacidad Máxima (Tons / Kg)</label>
                                <input 
                                  type="text"
                                  required
                                  value={driverRegData.vehiculo.capacidad || ''}
                                  onChange={(e) => setDriverRegData({
                                    ...driverRegData, 
                                    vehiculo: { ...driverRegData.vehiculo, capacidad: e.target.value }
                                  })}
                                  placeholder="Ej: 1.5 Toneladas o 800 Kg"
                                  className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Volumen Útil (m³)</label>
                                  <input 
                                    type="text"
                                    required
                                    value={driverRegData.vehiculo.volumen || ''}
                                    onChange={(e) => setDriverRegData({
                                      ...driverRegData, 
                                      vehiculo: { ...driverRegData.vehiculo, volumen: e.target.value }
                                    })}
                                    placeholder="Ej: 12 m³"
                                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Dimensiones (m)</label>
                                  <input 
                                    type="text"
                                    required
                                    value={driverRegData.vehiculo.dimensiones || ''}
                                    onChange={(e) => setDriverRegData({
                                      ...driverRegData, 
                                      vehiculo: { ...driverRegData.vehiculo, dimensiones: e.target.value }
                                    })}
                                    placeholder="Ej: 3.5 x 2.0 x 1.9"
                                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {driverRegData.vehiculo.tipo === 'taxi' && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-yellow-50/50 p-4 rounded-2xl border border-yellow-100/50 space-y-3"
                            >
                              <span className="text-[9px] font-black uppercase text-yellow-800 tracking-widest block mb-1">Información del Taxi</span>
                              
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Empresa de Taxis</label>
                                <input 
                                  type="text"
                                  required
                                  value={driverRegData.vehiculo.empresaTaxi || ''}
                                  onChange={(e) => setDriverRegData({
                                    ...driverRegData, 
                                    vehiculo: { ...driverRegData.vehiculo, empresaTaxi: e.target.value }
                                  })}
                                  placeholder="Ej: Taxi Imperial, Cooperativa El Sol"
                                  className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-yellow-500 outline-none placeholder:text-slate-400"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Número de Taxi (Interno)</label>
                                <input 
                                  type="text"
                                  required
                                  value={driverRegData.vehiculo.numeroTaxi || ''}
                                  onChange={(e) => setDriverRegData({
                                    ...driverRegData, 
                                    vehiculo: { ...driverRegData.vehiculo, numeroTaxi: e.target.value }
                                  })}
                                  placeholder="Ej: 4215 o C-23"
                                  className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-yellow-500 outline-none placeholder:text-slate-400"
                                />
                              </div>
                            </motion.div>
                          )}

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Placas</label>
                            <input 
                              type="text"
                              required
                              value={driverRegData.vehiculo.placa}
                              onChange={(e) => setDriverRegData({
                                ...driverRegData, 
                                ...driverRegData, 
                                vehiculo: { ...driverRegData.vehiculo, placa: e.target.value.toUpperCase() }
                              })}
                              placeholder="ABC-123"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Modelo / Año</label>
                            <input 
                              type="text"
                              required
                              value={driverRegData.vehiculo.modelo}
                              onChange={(e) => setDriverRegData({
                                ...driverRegData, 
                                vehiculo: { ...driverRegData.vehiculo, modelo: e.target.value }
                              })}
                              placeholder="Ej: 2022"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Color</label>
                            <input 
                              type="text"
                              required
                              value={driverRegData.vehiculo.color}
                              onChange={(e) => setDriverRegData({
                                ...driverRegData, 
                                vehiculo: { ...driverRegData.vehiculo, color: e.target.value }
                              })}
                              placeholder="Ej: Blanco"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95 mt-4"
                      >
                        {conductor ? 'GUARDAR ESPECIFICACIONES' : 'COMPLETAR REGISTRO'}
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recharge Modal */}
            <AnimatePresence>
              {showRechargeModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold text-slate-900">Recargar Tarjeta</h3>
                      <button onClick={() => setShowRechargeModal(false)} className="text-slate-400 hover:text-slate-600">
                        <LogOut size={20} className="rotate-180" />
                      </button>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Instrucciones de Pago</p>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        Realiza la transferencia a la siguiente llave de Breve Bancolombia y selecciona el monto a recargar.
                      </p>
                      <div className="mt-3 bg-white p-3 rounded-xl border border-emerald-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">llave de breve Bancolombia:</span>
                        <span className="text-sm font-mono font-bold text-emerald-700">0091947276</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={async () => {
                          await solicitarRecarga(user.uid, perfil?.nombre || user.displayName, 10000);
                          setShowRechargeModal(false);
                          toast.success("Solicitud de recarga de $10,000 enviada. Pendiente de aprobación.");
                        }}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 flex justify-between items-center px-6"
                      >
                        <span>Recargar</span>
                        <span className="font-mono">$10,000 COP</span>
                      </button>
                      <button 
                        onClick={async () => {
                          await solicitarRecarga(user.uid, perfil?.nombre || user.displayName, 20000);
                          setShowRechargeModal(false);
                          toast.success("Solicitud de recarga de $20,000 enviada. Pendiente de aprobación.");
                        }}
                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 flex justify-between items-center px-6"
                      >
                        <span>Recargar</span>
                        <span className="font-mono">$20,000 COP</span>
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 text-center mt-6">
                      El saldo se verá reflejado una vez el administrador apruebe la transacción.
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat en vivo */}
            {showChat && activeChatViaje && (
              <Chat
                viajeId={activeChatViaje.id}
                senderId={user.uid}
                senderName={perfil?.nombre || user.displayName || 'Usuario'}
                recipientName={user.uid === activeChatViaje.usuarioId ? activeChatViaje.conductorNombre : activeChatViaje.usuarioNombre}
                isOpen={showChat}
                onClose={() => setShowChat(false)}
              />
            )}

            {/* Admin Action Modal */}
            <AnimatePresence>
              {showAdminActionModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAdminActionModal(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden"
                  >
                    <div className="p-8 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          adminActionType?.includes('bloqueo') 
                            ? 'bg-red-100 text-red-600' 
                            : adminActionType === 'toggle_suplente'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {adminActionType?.includes('bloqueo') ? (
                            <ShieldAlert size={24} />
                          ) : adminActionType === 'toggle_suplente' ? (
                            <Shield size={24} />
                          ) : (
                            <CreditCard size={24} />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">
                            {adminActionType === 'edit_saldo_usuario' && 'Editar Saldo Usuario'}
                            {adminActionType === 'edit_saldo_conductor' && 'Editar Saldo Conductor'}
                            {adminActionType === 'confirm_bloqueo_usuario' && (adminActionTarget?.bloqueado ? 'Desbloquear Usuario' : 'Bloquear Usuario')}
                            {adminActionType === 'confirm_bloqueo_conductor' && (adminActionTarget?.bloqueado ? 'Desbloquear Conductor' : 'Bloquear Conductor')}
                            {adminActionType === 'toggle_suplente' && (adminActionTarget?.rol === 'admin_suplente' ? 'Quitar Administrador Suplente' : 'Hacer Administrador Suplente')}
                          </h3>
                          <p className="text-xs text-slate-500">{adminActionTarget?.nombre || adminActionTarget?.email}</p>
                        </div>
                      </div>

                      {adminActionType === 'edit_saldo_usuario' ? (
                        <div className="space-y-4">
                          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Saldo Actual del Usuario:</span>
                            <span className="text-xs font-mono font-bold text-slate-800">${(adminActionTarget?.saldo_promo || 0).toLocaleString()} COP</span>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Botones Rápidos de Bono</label>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => setAdminActionValue('5000')}
                                className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  adminActionValue === '5000'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                +$5.000
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdminActionValue('10000')}
                                className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  adminActionValue === '10000'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                +$10.000 🎁
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdminActionValue('20000')}
                                className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  adminActionValue === '20000'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                +$20.000
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdminActionValue('50000')}
                                className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  adminActionValue === '50000'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                +$50.000
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = adminActionTarget?.saldo_promo || 0;
                                  const val = Number(adminActionValue) || 0;
                                  setAdminActionValue(String(current + val));
                                }}
                                className="py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer col-span-2"
                              >
                                ⚡ Sumar al Saldo Actual
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">O Ingresa Valor Personalizado (COP)</label>
                              <button
                                type="button"
                                onClick={() => setAdminActionValue('0')}
                                className="text-[10px] text-rose-500 hover:underline font-bold"
                              >
                                Reiniciar ($0)
                              </button>
                            </div>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <input 
                                type="number"
                                value={adminActionValue}
                                onChange={(e) => setAdminActionValue(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 py-3 pl-8 pr-12 rounded-2xl text-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="0"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">COP</span>
                            </div>
                          </div>

                          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-center">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Nuevo Saldo Promocional Final</p>
                            <p className="text-xl font-mono font-black text-emerald-700 mt-0.5">
                              ${(Number(adminActionValue) || 0).toLocaleString()} COP
                            </p>
                          </div>
                        </div>
                      ) : adminActionType === 'edit_saldo_conductor' ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nuevo Saldo Tarjeta Virtual (COP)</label>
                          <input 
                            type="number"
                            value={adminActionValue}
                            onChange={(e) => setAdminActionValue(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="0"
                          />
                        </div>
                      ) : adminActionType === 'toggle_suplente' ? (
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {adminActionTarget?.rol === 'admin_suplente' 
                            ? '¿Estás seguro de que deseas desactivar el modo de administrador suplente para este usuario? Perderá el acceso al panel de administración.'
                            : '¿Estás seguro de que deseas activar el modo de administrador suplente para este usuario? Tendrá acceso completo al panel de administración para apoyarte.'}
                        </p>
                      ) : adminActionType === 'confirm_bloqueo_conductor' && !adminActionTarget?.bloqueado ? (
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">
                              Tipo de Sanción
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setBloqueoTipo('temporal')}
                                className={`py-3.5 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                                  bloqueoTipo === 'temporal'
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <Clock size={16} />
                                Temporal
                              </button>
                              <button
                                type="button"
                                onClick={() => setBloqueoTipo('permanente')}
                                className={`py-3.5 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                                  bloqueoTipo === 'permanente'
                                    ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <ShieldAlert size={16} />
                                Permanente
                              </button>
                            </div>
                          </div>

                          {bloqueoTipo === 'temporal' && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">
                                  Duración de la Sanción
                                </label>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setBloqueoHoras(h => Math.max(1, h - 1))}
                                    className="w-12 h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg transition-all active:scale-95 flex items-center justify-center border border-slate-200 select-none shadow-sm cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 text-center flex flex-col justify-center">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Bloqueado por</span>
                                    <span className="text-xl font-mono font-black text-slate-800 leading-none mt-0.5">
                                      {bloqueoHoras} <span className="text-xs font-black text-slate-400">{bloqueoHoras === 1 ? 'HORA' : 'HORAS'}</span>
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setBloqueoHoras(h => Math.min(168, h + 1))}
                                    className="w-12 h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg transition-all active:scale-95 flex items-center justify-center border border-slate-200 select-none shadow-sm cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Quick select hour chips */}
                              <div className="flex flex-wrap gap-2 justify-center select-none">
                                {[1, 2, 4, 8, 12, 24, 48].map((h) => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => setBloqueoHoras(h)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wider uppercase transition-all duration-300 border cursor-pointer ${
                                      bloqueoHoras === h
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200'
                                    }`}
                                  >
                                    {h >= 24 ? `${h / 24}d` : `${h}h`}
                                  </button>
                                ))}
                              </div>

                              {/* Unblock dynamic calculation preview */}
                              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2.5xl space-y-1 text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Liberación Automática</p>
                                <p className="text-xs text-slate-700 font-black">
                                  {new Date(Date.now() + bloqueoHoras * 60 * 60 * 1000).toLocaleString('es-CO', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </p>
                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                                  Sistema de Desbloqueo Automático Activado
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {adminActionTarget?.bloqueado 
                            ? '¿Estás seguro de que deseas desbloquear a este conductor/usuario? Podrá volver a utilizar la plataforma normalmente.'
                            : '¿Estás seguro de que deseas bloquear a este usuario? No podrá realizar viajes ni acceder a su cuenta hasta que sea desbloqueado.'}
                        </p>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setShowAdminActionModal(false)}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all active:scale-95"
                        >
                          CANCELAR
                        </button>
                        <button 
                          onClick={handleAdminAction}
                          className={`flex-1 py-4 text-white rounded-2xl font-bold text-xs shadow-xl transition-all active:scale-95 ${
                            adminActionType?.includes('bloqueo') 
                              ? (adminActionTarget?.bloqueado ? 'bg-emerald-600 shadow-emerald-100' : 'bg-red-600 shadow-red-100') 
                              : adminActionType === 'toggle_suplente'
                                ? 'bg-amber-600 shadow-amber-100 hover:bg-amber-700'
                                : 'bg-indigo-600 shadow-indigo-100'
                          }`}
                        >
                          CONFIRMAR
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Monitor Trip Cancellation Modal */}
            <AnimatePresence>
              {showAdminCancelTripModal && selectedTripForAdminCancel && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAdminCancelTripModal(false)}
                    className="absolute inset-0 bg-slate-900/65 backdrop-blur-md" 
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-rose-50"
                  >
                    <div className="p-8 space-y-6">
                      <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
                          <XCircle size={24} className="animate-pulse" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tight">
                            Anulación de Servicio
                          </h3>
                          <p className="text-xs text-rose-500 font-bold uppercase tracking-wider">Gestión del Monitor de Espera</p>
                        </div>
                      </div>

                      {/* Detalles del Servicio */}
                      <div className="bg-slate-50 border border-slate-100 p-5 rounded-[2rem] space-y-3 shadow-inner">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pasajero</span>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{selectedTripForAdminCancel.usuarioNombre}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Valor Solicitado</span>
                            <span className="text-xs font-black text-indigo-600">${selectedTripForAdminCancel.valor?.toLocaleString()} COP</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/60 pt-2 grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Ubicación</span>
                            <span className="font-bold text-slate-700 truncate block">
                              {selectedTripForAdminCancel.ciudad || 'No disp.'}, {selectedTripForAdminCancel.departamento || ''}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Vehículo</span>
                            <span className="font-bold text-slate-700 block uppercase">{selectedTripForAdminCancel.tipo || 'General'}</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between text-xs font-bold text-slate-600">
                          <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> Tiempo Transcurrido</span>
                          <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">
                            {Math.floor((currentTime.getTime() - new Date(selectedTripForAdminCancel.fecha).getTime()) / 60000)} minutos
                          </span>
                        </div>
                      </div>

                      {/* Motivos de Cancelación */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Motivo de Anulación</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            'Tiempo de espera prolongado',
                            'Falta de conductores',
                            'Error en la solicitud',
                            'Otro'
                          ].map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => {
                                setAdminCancelReason(reason);
                                if (reason !== 'Otro') setAdminCancelCustomReason('');
                              }}
                              className={`p-3.5 rounded-2xl border text-[11px] font-bold transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                adminCancelReason === reason
                                  ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>

                        {adminCancelReason === 'Otro' && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-2 mt-2"
                          >
                            <input 
                              type="text"
                              value={adminCancelCustomReason}
                              onChange={(e) => setAdminCancelCustomReason(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                              placeholder="Escribe el motivo detallado..."
                              maxLength={120}
                            />
                          </motion.div>
                        )}
                      </div>

                      {/* Notificar al Pasajero Toggle */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            adminCancelNotifyUser ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'
                          }`}>
                            <MessageCircle size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Notificar al Pasajero</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none">Envía una alerta explicativa</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdminCancelNotifyUser(!adminCancelNotifyUser)}
                          className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 outline-none ${
                            adminCancelNotifyUser ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            adminCancelNotifyUser ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Auto-archivar (Quitar notificación / Limpiar UI) Toggle */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            adminCancelArchiveTrip ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'
                          }`}>
                            <CheckCircle2 size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-800 block">Limpiar Celular del Pasajero</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-normal">Quita la notificación y resetea su pantalla al instante</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdminCancelArchiveTrip(!adminCancelArchiveTrip)}
                          className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 outline-none ${
                            adminCancelArchiveTrip ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            adminCancelArchiveTrip ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setShowAdminCancelTripModal(false)}
                          disabled={isProcessingAdminCancel}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                          CONSERVAR
                        </button>
                        <button 
                          onClick={handleAdminCancelTrip}
                          disabled={isProcessingAdminCancel || (adminCancelReason === 'Otro' && !adminCancelCustomReason.trim())}
                          className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isProcessingAdminCancel ? (
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                            />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                          ANULAR SERVICIO
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Admin Message Modal / Chat */}
            <AnimatePresence>
              {showAdminMessageModal && adminMessageTarget && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-white w-full max-w-md h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                  >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                          <MessageCircle size={24} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {adminMessageTarget.nombre === 'Admin' || adminMessageTarget.id === 'admin' ? 'Administrador' : adminMessageTarget.nombre}
                          </h3>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Soporte en vivo
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowAdminMessageModal(false)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <X size={20} className="text-slate-400" />
                      </button>
                    </div>

                    {/* Messages Thread */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                      {messagesAdminChat.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 opacity-40">
                          <MessageCircle size={48} className="text-slate-300" />
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay mensajes anteriores</p>
                        </div>
                      ) : (
                        messagesAdminChat.map((msg, idx) => {
                          const isMe = msg.senderId === user?.uid;
                          return (
                            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.mensaje}</p>
                                <p className={`text-[8px] mt-1 font-bold uppercase tracking-tighter ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  {new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div id="chat-end" />
                    </div>

                    {/* Footer/Input */}
                    <div className="p-4 bg-white border-t border-slate-100">
                      <div className="flex gap-2 items-center bg-slate-50 border border-slate-100 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <input 
                          type="text"
                          value={adminMessageText}
                          onChange={(e) => setAdminMessageText(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                          placeholder="Escribe un mensaje..."
                          className="flex-1 bg-transparent px-2 py-1 text-sm outline-none"
                        />
                        <button 
                          onClick={handleSendAdminMessage}
                          disabled={isSendingAdminMessage || !adminMessageText.trim()}
                          className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSendingAdminMessage ? (
                             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Navigation size={18} className="rotate-45" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Modal Mis Finanzas */}
            <AnimatePresence>
              {showDriverFinancesModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ y: "100%", scale: 0.95 }}
                    animate={{ y: 0, scale: 1 }}
                    exit={{ y: "100%", scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="bg-slate-950 text-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-800"
                  >
                    {/* Header */}
                    <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                          <TrendingUp size={22} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white tracking-tight">Mis Finanzas</h3>
                          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                            Tu rendimiento financiero
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowDriverFinancesModal(false)}
                        className="w-10 h-10 bg-slate-800/80 rounded-full text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-6">
                      {/* Balance overview & quick stats */}
                      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[2.5rem] border border-slate-800 relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Saldo en Tarjeta Virtual</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-mono font-black text-white">${(conductor?.tarjeta_virtual || 0).toLocaleString()}</span>
                          <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">COP</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">Este saldo se utiliza para comisiones y despachos.</p>
                        
                        <div className="mt-4 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-[1.5rem] flex items-start gap-2.5">
                          <AlertTriangle size={14} className="text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                          <p className="text-[10px] text-rose-200 leading-relaxed font-medium">
                            El descuento de la comisión del <strong className="text-white font-black">15%</strong> se realiza automáticamente de tu Tarjeta Virtual cuando el usuario acepta el servicio. Si se realiza una cancelación por cualquier panel, el descuento se mantendrá aplicado <strong className="text-white font-black">sin reembolso</strong>.
                          </p>
                        </div>
                      </div>

                      {/* Income Periods (Daily, Weekly, Monthly) */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] px-1">Resumen de Ingresos</h4>
                        
                        <div className="grid grid-cols-3 gap-3">
                          {/* Diario */}
                          <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 text-center relative group overflow-hidden">
                            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hoy</p>
                            <p className="text-sm font-mono font-black text-emerald-400">
                              ${calculateDriverEarnings().daily.toLocaleString()}
                            </p>
                            <span className="text-[9px] text-slate-500 font-medium mt-1 block">
                              {historialViajesConductor.filter(v => {
                                if (!v.fecha) return false;
                                const d = new Date(v.fecha);
                                const today = new Date();
                                return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                              }).length} viajes
                            </span>
                          </div>

                          {/* Semanal */}
                          <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 text-center relative group overflow-hidden">
                            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Esta Semana</p>
                            <p className="text-sm font-mono font-black text-indigo-400">
                              ${calculateDriverEarnings().weekly.toLocaleString()}
                            </p>
                            <span className="text-[9px] text-slate-500 font-medium mt-1 block">
                              {historialViajesConductor.filter(v => {
                                if (!v.fecha) return false;
                                const d = new Date(v.fecha);
                                const now = new Date();
                                const currentDay = now.getDay();
                                const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
                                const mondayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
                                mondayStart.setHours(0, 0, 0, 0);
                                return d >= mondayStart;
                              }).length} viajes
                            </span>
                          </div>

                          {/* Mensual */}
                          <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 text-center relative group overflow-hidden">
                            <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Este Mes</p>
                            <p className="text-sm font-mono font-black text-amber-400">
                              ${calculateDriverEarnings().monthly.toLocaleString()}
                            </p>
                            <span className="text-[9px] text-slate-500 font-medium mt-1 block">
                              {historialViajesConductor.filter(v => {
                                if (!v.fecha) return false;
                                const d = new Date(v.fecha);
                                const today = new Date();
                                return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
                              }).length} viajes
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Daily Goal & Progress */}
                      <div className="bg-slate-900/60 p-5 rounded-[2.5rem] border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target size={16} className="text-rose-400" />
                            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Meta Diaria</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-400">
                              ${driverFinancesGoal.toLocaleString()} COP
                            </span>
                            <button 
                              onClick={() => {
                                const newGoalStr = prompt("Ingresa tu meta diaria de ganancias (COP):", String(driverFinancesGoal));
                                if (newGoalStr) {
                                  const newGoal = Number(newGoalStr.replace(/[^0-9]/g, ''));
                                  if (!isNaN(newGoal) && newGoal > 0) {
                                    setDriverFinancesGoal(newGoal);
                                    localStorage.setItem('driver_finances_goal', String(newGoal));
                                    toast.success(`Meta diaria actualizada a $${newGoal.toLocaleString()} COP`);
                                  }
                                }
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                            >
                              <Edit size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          {(() => {
                            const dailyEarned = calculateDriverEarnings().daily;
                            const pct = Math.min(100, Math.round((dailyEarned / driverFinancesGoal) * 100));
                            return (
                              <>
                                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-full rounded-full bg-gradient-to-r ${pct >= 100 ? 'from-emerald-400 to-teal-500' : 'from-indigo-500 to-emerald-400'}`}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-slate-400">{pct}% completado</span>
                                  <span className={pct >= 100 ? "text-emerald-400" : "text-indigo-400"}>
                                    {pct >= 100 ? "¡Meta Alcanzada! 🎉" : `Faltan $${Math.max(0, driverFinancesGoal - dailyEarned).toLocaleString()} COP`}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Performance Booster & Motivation Message */}
                      {(() => {
                        const dailyEarned = calculateDriverEarnings().daily;
                        const tripsTodayCount = historialViajesConductor.filter(v => {
                          if (!v.fecha) return false;
                          const d = new Date(v.fecha);
                          const today = new Date();
                          return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                        }).length;

                        let motIcon = <Zap size={24} className="text-amber-400 animate-pulse" />;
                        let motTitle = "¡Acelera tus ingresos!";
                        let motDesc = "Realiza un par de viajes hoy para activar tu racha diaria y subir en el ranking.";
                        let motCardBg = "bg-amber-500/5 border-amber-500/10";
                        let motText = "text-amber-400";

                        if (tripsTodayCount === 0) {
                          motIcon = <Car size={24} className="text-indigo-400" />;
                          motTitle = "¡Arranca motores!";
                          motDesc = "Aún no has registrado viajes hoy. ¡Enciende tu disponibilidad y comienza a facturar ahora mismo!";
                          motCardBg = "bg-indigo-500/5 border-indigo-500/10";
                          motText = "text-indigo-400";
                        } else if (dailyEarned >= driverFinancesGoal) {
                          motIcon = <Trophy size={24} className="text-emerald-400" />;
                          motTitle = "¡Imparable hoy!";
                          motDesc = "Has superado tu meta diaria establecida. Cada viaje de ahora en adelante es ganancia pura. ¡Sigue así, campeón!";
                          motCardBg = "bg-emerald-500/5 border-emerald-500/10";
                          motText = "text-emerald-400";
                        } else {
                          motIcon = <Zap size={24} className="text-emerald-400 animate-pulse" />;
                          motTitle = "¡Excelente progreso!";
                          motDesc = `Estás a un paso de cumplir tu meta diaria de hoy. Con solo un par de viajes más la completarás de forma impecable.`;
                          motCardBg = "bg-emerald-500/5 border-emerald-500/10";
                          motText = "text-emerald-400";
                        }

                        return (
                          <div className={`p-5 rounded-[2.5rem] border ${motCardBg} flex items-start gap-4`}>
                            <div className="p-3 bg-slate-900 rounded-2xl flex-shrink-0">
                              {motIcon}
                            </div>
                            <div className="space-y-1 text-left">
                              <h5 className={`text-sm font-black tracking-tight ${motText}`}>{motTitle}</h5>
                              <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{motDesc}</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Recent Completed Services list */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">Últimos Servicios</h4>
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                            {historialViajesConductor.length} completados
                          </span>
                        </div>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {historialViajesConductor.length === 0 ? (
                            <div className="py-8 text-center bg-slate-900 rounded-3xl border border-slate-800/50">
                              <p className="text-xs text-slate-500">No tienes servicios finalizados recientemente.</p>
                            </div>
                          ) : (
                            historialViajesConductor.slice(0, 5).map((viaje, vIdx) => (
                              <div key={viaje.id || `hist-conductor-${vIdx}`} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50 flex items-center justify-between hover:bg-slate-900 transition-colors">
                                <div className="space-y-1 text-left">
                                  <p className="text-xs font-bold text-slate-200 truncate max-w-[200px]">{viaje.ruta.destino}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase">
                                      {viaje.tipo || 'Estándar'}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-mono">
                                      {new Date(viaje.fecha).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-mono font-black text-emerald-400">+${(viaje.valor || 0).toLocaleString()}</p>
                                  <p className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">COP</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal Ranking Elite (Conductor) */}
            <AnimatePresence>
              {showLeaderboardModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ y: "100%", scale: 0.95 }}
                    animate={{ y: 0, scale: 1 }}
                    exit={{ y: "100%", scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="bg-slate-900 text-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-800"
                  >
                    {/* Header */}
                    <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                          <Trophy size={24} className="fill-amber-500/10" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-black text-white tracking-tight uppercase">Ranking Elite</h3>
                          <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest leading-none">
                            Cuadro de honor de conductores
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowLeaderboardModal(false)}
                        className="w-10 h-10 bg-slate-850 rounded-full text-slate-400 flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Filter selector */}
                    {conductor && !isUserAdmin ? (
                      <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                          </span>
                          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                            Ranking de {conductor.vehiculo?.tipo === 'moto' ? 'Motos' : conductor.vehiculo?.tipo === 'taxi' ? 'Taxis' : 'Carros'} Elite
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest border border-amber-500/20 shadow-sm">
                          {conductor.vehiculo?.tipo === 'moto' ? <Bike size={12} /> : conductor.vehiculo?.tipo === 'taxi' ? <Taxi size={12} /> : <Car size={12} />}
                          Tu Vehículo
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800/60 flex gap-1.5">
                        <button 
                          onClick={() => setSelectedLeaderboard('carro')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${selectedLeaderboard === 'carro' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/10' : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}
                        >
                          <Car size={14} />
                          Carros Elite
                        </button>
                        <button 
                          onClick={() => setSelectedLeaderboard('moto')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${selectedLeaderboard === 'moto' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/10' : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}
                        >
                          <Bike size={14} />
                          Motos Elite
                        </button>
                        <button 
                          onClick={() => setSelectedLeaderboard('taxi')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${selectedLeaderboard === 'taxi' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/10' : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}
                        >
                          <Taxi size={14} />
                          Taxis Elite
                        </button>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {/* Personal position summary banner */}
                      {(() => {
                        const data = getLeaderboardData();
                        const currentDriverIndex = user ? data.findIndex(d => d.id === user.uid) : -1;
                        const currentDriverRank = currentDriverIndex !== -1 ? currentDriverIndex + 1 : null;
                        
                        return (
                          <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
                            currentDriverRank 
                              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300 font-medium' 
                              : 'bg-indigo-950/10 border-indigo-500/25 text-indigo-300 font-medium'
                          }`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                              currentDriverRank ? 'bg-emerald-500/20' : 'bg-indigo-500/20'
                            }`}>
                              {currentDriverRank ? '🎯' : '🚀'}
                            </div>
                            <div className="text-left flex-1">
                              {currentDriverRank ? (
                                <>
                                  <p className="text-xs font-extrabold uppercase tracking-wide">¡Felicitaciones!</p>
                                  <p className="text-[10px] opacity-80 mt-0.5">Te encuentras en la posición <span className="font-bold">#{currentDriverRank}</span> de la semana.</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-extrabold uppercase tracking-wide">Fuera de la lista semanal</p>
                                  <p className="text-[10px] opacity-85 mt-0.5">Realiza más servicios con buena calificación para entrar al top 100.</p>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Leaderboard List */}
                      <div className="space-y-2">
                        {(() => {
                          const data = getLeaderboardData();
                          if (data.length === 0) {
                            return (
                              <div className="py-16 text-center bg-slate-950/20 rounded-[2.5rem] border border-dashed border-slate-800 space-y-3">
                                <Trophy className="mx-auto text-slate-700 animate-pulse" size={40} />
                                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Sin datos en esta categoría</p>
                              </div>
                            );
                          }
                          return data.map((d, idx) => {
                            const isMe = user && d.id === user.uid;
                            const isTop1 = idx === 0;
                            const isTop2 = idx === 1;
                            const isTop3 = idx === 2;
                            
                            return (
                              <div
                                key={d.id || `leaderboard-${idx}`}
                                className={`relative overflow-hidden p-4 rounded-3xl flex items-center gap-4 transition-all duration-300 border ${
                                  isMe 
                                    ? 'bg-slate-850 border-emerald-500/40 shadow-lg shadow-emerald-500/5' 
                                    : isTop1 
                                      ? 'bg-gradient-to-r from-amber-500/10 to-yellow-600/5 border-amber-500/30' 
                                      : isTop2 
                                        ? 'bg-gradient-to-r from-slate-300/10 to-slate-400/5 border-slate-400/20'
                                        : isTop3 
                                          ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5 border-orange-500/20'
                                          : 'bg-slate-950/40 border-slate-850 hover:bg-slate-850 hover:border-slate-800'
                                }`}
                              >
                                {/* Rank position stylized */}
                                <div className="flex items-center justify-center w-8 shrink-0">
                                  {isTop1 ? (
                                    <span className="text-2xl filter drop-shadow">🥇</span>
                                  ) : isTop2 ? (
                                    <span className="text-2xl filter drop-shadow">🥈</span>
                                  ) : isTop3 ? (
                                    <span className="text-2xl filter drop-shadow">🥉</span>
                                  ) : (
                                    <span className="text-sm font-mono font-black text-slate-500">{idx + 1}</span>
                                  )}
                                </div>

                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border ${
                                  isTop1 
                                    ? 'border-amber-400/50 bg-amber-500/10' 
                                    : 'border-slate-700 bg-slate-850'
                                }`}>
                                  {d.foto ? (
                                    <img referrerPolicy="no-referrer" src={d.foto} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <UserIcon className={isTop1 ? "text-amber-400" : "text-slate-400"} size={18} />
                                  )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-black text-white truncate uppercase tracking-tight leading-none">
                                      {d.nombre || 'Conductor'}
                                    </h4>
                                    {isMe && (
                                      <span className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 rounded-md">
                                        Tú
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex items-center gap-1 bg-slate-950/60 px-1.5 py-0.5 rounded-lg border border-slate-850">
                                      <Star size={9} className="text-amber-400 fill-amber-400" />
                                      <span className="text-[10px] font-bold text-amber-400">{(d.calificacion || 0).toFixed(1)}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium truncate">
                                      {d.vehiculo?.modelo || 'Ruedas Pro'}
                                    </span>
                                  </div>
                                </div>

                                {/* Performance count */}
                                <div className="text-right border-l border-slate-800/80 pl-4 shrink-0 min-w-[64px]">
                                  <p className="text-lg font-mono font-black text-amber-400 leading-none">{d.servicios_semanales || 0}</p>
                                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Viajes</p>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Information rules info card */}
                      <div className="p-5 bg-slate-950 rounded-[2rem] border border-slate-850 space-y-2.5">
                        <div className="flex items-center gap-2 text-amber-400">
                          <Zap size={14} className="fill-amber-400/20" />
                          <h4 className="text-xs font-black uppercase tracking-wider">Reglas del Cuadro de Honor</h4>
                        </div>
                        <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed text-left">
                          <li>El ranking semanal se reinicia automáticamente cada lunes a las 00:00 horas.</li>
                          <li>Para calificar en la tabla, el conductor debe tener una calificación superior a <span className="text-amber-400 font-bold">4.0★</span>.</li>
                          <li>Los conductores destacados reciben prioridad en asignación y beneficios exclusivos.</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal Mis Finanzas (Usuario/Pasajero) */}
            <AnimatePresence>
              {showUserFinancesModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ y: "100%", scale: 0.95 }}
                    animate={{ y: 0, scale: 1 }}
                    exit={{ y: "100%", scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="bg-slate-950 text-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-800"
                  >
                    {/* Header */}
                    <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                          <CreditCard size={22} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white tracking-tight">Mis Finanzas</h3>
                          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                            Tu billetera y bonificaciones
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowUserFinancesModal(false)}
                        className="w-10 h-10 bg-slate-800/80 rounded-full text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-6 text-left">
                      {/* Promo Balance Card */}
                      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[2.5rem] border border-slate-800 relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Tu Saldo Promocional</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-mono font-black text-emerald-400">${(perfil?.saldo_promo || 0).toLocaleString()}</span>
                          <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">COP</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                          Este saldo promocional se aplica automáticamente como descuento parcial o total en tus solicitudes de viaje válidas.
                        </p>
                      </div>

                      {/* How it works info */}
                      <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 space-y-3">
                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.1em]">¿Cómo funciona tu bono?</h4>
                        <ul className="text-[11px] text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                          <li>Se descuenta virtualmente del valor total de cada oferta aceptada.</li>
                          <li>Tú pagas únicamente el excedente en efectivo al conductor.</li>
                          <li>El conductor recibe el valor del bono directamente en su cuenta virtual de Ruedas Rápidas.</li>
                          <li>¡Una forma segura, rápida y económica de viajar!</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History Modal Overlay */}
            <AnimatePresence>
              {showHistory && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="bg-slate-50 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                  >
                    <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                          <Clock size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 tracking-tight">Historial de Viajes</h3>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            {historyType === 'conductor' ? `${historialViajesConductor.length} Registros` : `${historialViajes.length} Registros`}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowHistory(false)}
                        className="w-10 h-10 bg-slate-100 rounded-full text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-4 text-left">
                      {/* Stats Summary inside history modal */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-white p-4 rounded-3xl border border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{historyType === 'conductor' ? 'Total Ganado' : 'Total Gastado'}</p>
                          <p className="text-lg font-mono font-black text-emerald-600">
                            ${(historyType === 'conductor' ? historialViajesConductor : historialViajes).reduce((acc, v) => acc + (v.valor || 0), 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-3xl border border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Servicios</p>
                          <p className="text-lg font-mono font-black text-indigo-600">
                            {(historyType === 'conductor' ? historialViajesConductor : historialViajes).length}
                          </p>
                        </div>
                      </div>

                      {(historyType === 'conductor' ? historialViajesConductor : historialViajes).length === 0 ? (
                        <div className="py-12 text-center space-y-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                            <Clock size={32} />
                          </div>
                          <p className="text-slate-400 text-sm">No tienes viajes registrados aún.</p>
                        </div>
                      ) : (
                        (historyType === 'conductor' ? historialViajesConductor : historialViajes).map((viaje, vIdx) => (
                          <div key={viaje.id || `hist-viaje-${vIdx}`} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-800 leading-tight">{viaje.ruta.destino}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                                    {viaje.tipo || 'Viaje'}
                                  </span>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    {new Date(viaje.fecha).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-mono font-bold text-emerald-700">${viaje.valor.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                                  {(viaje.conductorNombre || 'C').charAt(0)}
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Conductor: <span className="text-slate-800">{viaje.conductorNombre || 'N/A'}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!viaje.calificado && (
                                  <button 
                                    onClick={() => {
                                      setSelectedTripForRating(viaje);
                                      setShowRatingModal(true);
                                    }}
                                    className="text-[9px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg uppercase transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                  >
                                    <Star size={10} fill="currentColor" />
                                    Calificar
                                  </button>
                                )}
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">Completado</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Movements Modal Overlay (Wallet Movements) */}
            <AnimatePresence>
              {showMovements && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="bg-slate-50 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                  >
                    <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 tracking-tight">Movimientos de Saldo</h3>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            {misMovimientos.length} Registros recientes
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowMovements(false)}
                        className="w-10 h-10 bg-slate-100 rounded-full text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-3 text-left">
                      {misMovimientos.length === 0 ? (
                        <div className="py-12 text-center space-y-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                            <CreditCard size={32} />
                          </div>
                          <p className="text-slate-400 text-sm font-medium uppercase text-[9px] tracking-widest">Sin movimientos registrados</p>
                        </div>
                      ) : (
                        misMovimientos.map((mov, mIdx) => (
                          <div key={mov.id || `mov-${mIdx}`} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                mov.tipoDoc === 'recarga' 
                                  ? (mov.estado === 'aprobada' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500')
                                  : 'bg-rose-50 text-rose-500'
                              }`}>
                                {mov.tipoDoc === 'recarga' ? <PlusCircle size={20} /> : <Zap size={20} />}
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                  {mov.tipoDoc === 'recarga' 
                                    ? `Recarga ${mov.estado === 'pendiente' ? 'Pendiente' : 'Aprobada'}`
                                    : (mov.tipo === 'comision_expreso' ? 'Comisión Expreso' : 'Comisión Viaje')}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold">
                                  {new Date(mov.fecha).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-mono font-black ${mov.tipoDoc === 'recarga' && mov.estado === 'aprobada' ? 'text-emerald-600' : mov.tipoDoc === 'transaccion' ? 'text-rose-600' : 'text-slate-400'}`}>
                                {mov.tipoDoc === 'recarga' ? '+' : '-'}${mov.valor?.toLocaleString()}
                              </p>
                              {mov.tipoDoc === 'recarga' && mov.estado === 'pendiente' && (
                                <span className="text-[7px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Espera admin</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Support Chat */}
            {showSupportChat && activeSupportConductor && user && (
              <SupportChat
                conductorId={activeSupportConductor.id}
                conductorNombre={activeSupportConductor.nombre}
                senderId={user.uid}
                senderName={perfil?.nombre || conductor?.nombre || user.displayName || "Usuario"}
                isAdmin={isUserAdmin}
                isOpen={showSupportChat}
                onClose={() => setShowSupportChat(false)}
              />
            )}
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto text-rose-500">
                  <AlertTriangle size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{confirmAction.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">{confirmAction.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setConfirmAction(null)}
                    className="py-4 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-100"
                  >
                    No, volver
                  </button>
                  <button 
                    onClick={confirmAction.onConfirm}
                    className="py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-100 hover:bg-black active:scale-95 transition-all"
                  >
                    Sí, confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </ErrorBoundary>
    </MapProvider>
  );
}
