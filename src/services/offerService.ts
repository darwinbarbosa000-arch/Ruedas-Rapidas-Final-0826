import { db } from '../firebase';
import { doc, getDoc, setDoc, addDoc, collection, runTransaction } from 'firebase/firestore';

export interface OfferSubmitParams {
  serviceId: string;
  driverId: string;
  price_propuesto: number;
  suggestedPrice?: number;
  conductor_location?: { lat: number; lng: number } | null;
  distancia_reportada?: number;
  conductorNombre?: string;
  conductorTelefono?: string;
  conductorPlaca?: string;
  conductorColor?: string;
  tiempoLlegada?: number;
  vehicle_type?: string;
  ip?: string;
}

export interface OfferValidationResult {
  isValid: boolean;
  error?: string;
  precio_sugerido: number;
  precio_minimo: number;
  precio_maximo: number;
  distancia_km: number;
}

// -----------------------------------------------------------------
// 1. RATE LIMITER ANTI-SABOTAJE: Max 5 ofertas por conductor cada 10 min
// -----------------------------------------------------------------
const driverOfferTimestampsMap = new Map<string, number[]>();

function checkDriverRateLimit(driverId: string) {
  const now = Date.now();
  const TEN_MIN_MS = 10 * 60 * 1000;
  
  const history = (driverOfferTimestampsMap.get(driverId) || []).filter(ts => (now - ts) < TEN_MIN_MS);
  driverOfferTimestampsMap.set(driverId, history);

  if (history.length >= 5) {
    throw new Error('Vas muy rápido. Espera 10 min');
  }
}

function registerDriverOfferSuccess(driverId: string) {
  const now = Date.now();
  const TEN_MIN_MS = 10 * 60 * 1000;
  const history = (driverOfferTimestampsMap.get(driverId) || []).filter(ts => (now - ts) < TEN_MIN_MS);
  history.push(now);
  driverOfferTimestampsMap.set(driverId, history);
}

/**
 * Calcula la distancia en Kilómetros entre dos puntos geográficos (Haversine)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radio de la Tierra en Km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Redondear a 1 decimal
}

/**
 * FÓRMULA ÚNICA DE PRECIO SUGERIDO NACIONAL (RUEDAS RÁPIDAS)
 */
export function calculateNationalSuggestedPrice(vehicleType: string, distanceKm: number) {
  const normVehicle = (vehicleType || '').trim().toLowerCase();
  
  let base = 5000;
  let por_km = 1400;

  if (normVehicle === 'moto') {
    base = 5000;
    por_km = 1400;
  } else if (normVehicle === 'carro') {
    base = 7000;
    por_km = 2000;
  } else if (normVehicle === 'taxi') {
    base = 7000;
    por_km = 2200;
  } else if (normVehicle.includes('camion') || normVehicle.includes('flete') || normVehicle.includes('acarreo') || normVehicle.includes('motocarro')) {
    base = 12000;
    por_km = 3000;
  }

  let precio_sugerido = base + (por_km * distanceKm);
  precio_sugerido = Math.max(5000, precio_sugerido); // Aplicar mínimo nacional
  precio_sugerido = Math.round(precio_sugerido / 100) * 100; // Redondear a 100

  const precio_minimo = 5000;
  const precio_maximo = precio_sugerido * 3; // TOPE NACIONAL

  return {
    precio_sugerido,
    precio_minimo,
    precio_maximo
  };
}

/**
 * Función para formatear número con puntos de miles colombianos (ej. 12000 -> "12.000")
 */
export function formatCOP(value: number): string {
  if (isNaN(value) || value === undefined || value === null) return '0';
  return Math.round(value).toLocaleString('es-CO');
}

/**
 * Reglas de Negocio / Cloud Function `submitOffer` para validar y guardar ofertas con Seguridad Anti-Sabotaje
 */
export async function submitOffer(params: OfferSubmitParams) {
  const {
    serviceId,
    driverId,
    price_propuesto,
    conductor_location,
    conductorNombre,
    conductorTelefono,
    conductorPlaca,
    conductorColor,
    tiempoLlegada
  } = params;

  if (!serviceId) throw new Error('El ID del servicio es requerido');
  if (!driverId) throw new Error('El ID del conductor es requerido');

  // 1. REGLA ANTI-SABOTAJE 1: RATE LIMIT DE 5 OFERTAS CADA 10 MINUTOS
  checkDriverRateLimit(driverId);

  // Obtener datos del servicio de Firestore (/services/{serviceId} o /viajes/{serviceId})
  let serviceRef = doc(db, 'services', serviceId);
  let serviceSnap = await getDoc(serviceRef);

  if (!serviceSnap.exists()) {
    serviceRef = doc(db, 'viajes', serviceId);
    serviceSnap = await getDoc(serviceRef);
  }

  if (!serviceSnap.exists()) {
    throw new Error('El servicio especificado no existe o fue cancelado');
  }

  const serviceData = serviceSnap.data();

  // Coordenadas del usuario/pasajero
  const userLat = serviceData.user_location?.lat ?? serviceData.origenCoords?.lat ?? serviceData.ruta?.origenCoords?.lat ?? 0;
  const userLng = serviceData.user_location?.lng ?? serviceData.origenCoords?.lng ?? serviceData.ruta?.origenCoords?.lng ?? 0;

  // Coordenadas del conductor (desde params o Firestore)
  let driverLat = conductor_location?.lat ?? 0;
  let driverLng = conductor_location?.lng ?? 0;

  if (!driverLat || !driverLng) {
    const userDocRef = doc(db, 'users', driverId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const uData = userDocSnap.data();
      driverLat = uData.conductor_location?.lat ?? uData.location?.lat ?? uData.user_location?.lat ?? 0;
      driverLng = uData.conductor_location?.lng ?? uData.location?.lng ?? uData.user_location?.lng ?? 0;
    }
  }

  // 2. REGLA ANTI-SABOTAJE 2: VALIDAR GPS
  // Calcular la distancia real entre GPS de conductor y usuario
  const distancia_calculada = (driverLat && driverLng && userLat && userLng)
    ? calculateDistanceKm(driverLat, driverLng, userLat, userLng)
    : 0;

  const distancia_reportada = params.distancia_reportada || serviceData.distancia_km || serviceData.distanciaKm || serviceData.distancia_reportada || 0;

  if (distancia_reportada > 0 && distancia_calculada > 0) {
    if (distancia_calculada > (distancia_reportada * 1.5)) {
      throw new Error('Ubicación no coincide');
    }
  }

  // Tipo de vehículo y distancias de referencia
  const service_vehicle_type = params.vehicle_type || serviceData.service_vehicle_type || serviceData.tipo || 'carro';
  const distancia_km = distancia_reportada || serviceData.distancia_km || serviceData.distanciaKm || 2;
  const distancia_trip = distancia_km;
  const distancia_pickup = distancia_calculada;

  // Calcular precio sugerido nacional basado en la distancia del trayecto
  const { precio_sugerido, precio_minimo, precio_maximo } = calculateNationalSuggestedPrice(
    service_vehicle_type,
    distancia_trip
  );

  // SERVICIOS ESPECIALES: Flete, Acarreo, Motocarro tienen libertad absoluta de tarifa (sin límites de banda ni tarifas mínimas/máximas)
  const isSpecialCargo = 
    ['camion_flete', 'camion_acarreo', 'motocarro'].includes(service_vehicle_type) ||
    ['camion_flete', 'camion_acarreo', 'motocarro'].includes(serviceData.tipo) ||
    serviceData.tarifa_libre === true ||
    serviceData.servicio_especial === true;

  const valorPasajero = serviceData.valor || serviceData.precio || serviceData.basePrice || 4000;
  const suggestedPrice = params.suggestedPrice || serviceData.suggestedPrice || precio_sugerido || valorPasajero;
  
  let minAllowed = 1000;
  let maxAllowed = 999999999;

  if (!isSpecialCargo) {
    // VALIDAR BANDA 40% para servicios regulares (moto, carro, taxi, etc.)
    minAllowed = Math.max(4000, Math.round(suggestedPrice * 0.6));
    maxAllowed = Math.round(suggestedPrice * 1.4);

    if (price_propuesto < minAllowed || price_propuesto > maxAllowed) {
      throw new Error(`Oferta fuera de rango ($${formatCOP(minAllowed)} - $${formatCOP(maxAllowed)})`);
    }

    if (price_propuesto < 4000) {
      throw new Error('La tarifa mínima es $4.000');
    }
  } else {
    // Para servicios especiales (flete, acarreo, motocarro): libertad total sin ningún límite
    if (price_propuesto <= 0) {
      throw new Error('La tarifa propuesta debe ser mayor a $0');
    }
    minAllowed = 1000;
    maxAllowed = Math.max(price_propuesto * 2, 50000000);
  }

  // Validaciones Generales de Rango y Distancia de Recogida
  if (distancia_pickup > 25) {
    throw new Error('Estás muy lejos del usuario. Máximo 25km para ofertar');
  }

  // Verificar Saldo en Tarjeta Virtual (Comisión 8%)
  const conductorRef = doc(db, 'conductores', driverId);
  const conductorSnap = await getDoc(conductorRef);
  const conductorData = conductorSnap.exists() ? conductorSnap.data() : null;

  if (conductorData) {
    const comision = Math.round(price_propuesto * 0.08);
    const saldoActual = conductorData.tarjeta_virtual || 0;
    if (saldoActual < comision) {
      throw new Error(`Tu saldo en Tarjeta Virtual es insuficiente ($${formatCOP(saldoActual)} COP). Requieres al menos $${formatCOP(comision)} COP (8% de comisión requerida).`);
    }
  }

  // GUARDAR OFERTA - TODO EN INGLES EN /offers
  const offerData = {
    driverId,
    serviceId,
    price: price_propuesto,
    status: 'pending',
    createdAt: new Date().toISOString(),
    // Metadatos complementarios para compatibilidad
    price_propuesto,
    precio_sugerido,
    precio_minimo: minAllowed,
    precio_maximo: maxAllowed,
    distancia_km,
    vehicle_type: service_vehicle_type,
    conductorNombre: conductorNombre || conductorData?.nombre || 'Conductor',
    conductorTelefono: conductorTelefono || conductorData?.telefono || conductorData?.celular || '',
    conductorPlaca: conductorPlaca || conductorData?.vehiculo?.placa || '',
    conductorColor: conductorColor || conductorData?.vehiculo?.color || '',
    conductorCiudad: conductorData?.ciudad || '',
    conductorCalificacion: conductorData?.calificacion || 5.0,
    vehiculo: conductorData?.vehiculo || null,
    tiempo_llegada: tiempoLlegada || 5,
    fecha: new Date().toISOString()
  };

  // 4. REGLA ANTI-SABOTAJE 4: AUDITORÍA EN /logs_offers
  const auditLogData = {
    driverId,
    serviceId,
    price: price_propuesto,
    timestamp: new Date().toISOString(),
    ip: params.ip || '127.0.0.1'
  };

  try {
    await addDoc(collection(db, 'logs_offers'), auditLogData);
  } catch (err) {
    console.error('Error guardando log de auditoría:', err);
  }

  // Guardar en /offers (colección global de ofertas)
  const offersRef = collection(db, 'offers');
  const newOfferDoc = await addDoc(offersRef, {
    driverId,
    serviceId,
    price: price_propuesto,
    status: 'pending',
    createdAt: new Date().toISOString(),
    conductorNombre: conductorNombre || conductorData?.nombre || 'Conductor',
    conductorTelefono: conductorTelefono || conductorData?.telefono || conductorData?.celular || '',
    conductorPlaca: conductorPlaca || conductorData?.vehiculo?.placa || '',
    conductorColor: conductorColor || conductorData?.vehiculo?.color || '',
    tiempo_llegada: tiempoLlegada || 5
  });

  // Guardar en el documento del servicio/viaje para reactividad en frontend
  const ofertasMap = serviceData.ofertas || {};
  ofertasMap[driverId] = {
    ...offerData,
    valor: price_propuesto,
    offerId: newOfferDoc.id
  };

  await setDoc(serviceRef, {
    ofertas: ofertasMap,
    estado: 'negociando'
  }, { merge: true });

  // Registrar éxito en rate limiter
  registerDriverOfferSuccess(driverId);

  return {
    success: true,
    message: 'Oferta enviada exitosamente',
    offerId: newOfferDoc.id,
    data: offerData
  };
}

export interface AcceptOfferParams {
  serviceId: string;
  offerId?: string;
  driverId?: string;
  userId?: string;
}

/**
 * Función blindada acceptOffer / seleccionarOferta para aceptar ofertas de manera segura.
 * Previene errores de 'indexOf', 'find' o propiedades 'undefined' cuando faltan campos en Firestore.
 */
export async function acceptOffer(params: AcceptOfferParams) {
  const { serviceId, offerId, driverId, userId } = params;

  if (!serviceId) {
    throw new Error('El ID del servicio es requerido');
  }

  // 1. Obtener documento del servicio (soporta colección 'services' y 'viajes')
  let serviceRef = doc(db, 'services', serviceId);
  let serviceSnap = await getDoc(serviceRef);

  if (!serviceSnap.exists()) {
    serviceRef = doc(db, 'viajes', serviceId);
    serviceSnap = await getDoc(serviceRef);
  }

  if (!serviceSnap.exists()) {
    throw new Error('Servicio no existe o fue cancelado');
  }

  const serviceData = serviceSnap.data() || {};

  // Validar pertenencia del usuario si se proporciona userId
  if (userId && serviceData.userId && serviceData.userId !== userId && serviceData.usuarioId && serviceData.usuarioId !== userId) {
    throw new Error('No tienes permiso para aceptar ofertas en este servicio');
  }

  // BLINDAJE 1: Convertir de forma segura 'offers' / 'ofertas' si viene undefined, null u objeto
  let offersArray: any[] = [];
  const rawOffers = serviceData.offers ?? serviceData.ofertas;

  if (Array.isArray(rawOffers)) {
    offersArray = rawOffers;
  } else if (rawOffers && typeof rawOffers === 'object') {
    offersArray = Object.entries(rawOffers).map(([key, val]: [string, any]) => ({
      id: key,
      offerId: val?.offerId || key,
      driverId: val?.driverId || val?.conductorId || key,
      ...val
    }));
  }

  // Buscar oferta por offerId o driverId
  const targetId = offerId || driverId;
  let offer = offersArray.find(o => 
    Boolean(o && (o.id === targetId || o.offerId === targetId || o.driverId === targetId || o.conductorId === targetId))
  );

  // Si no se encontró por lista, pero se proporcionaron datos directo en params o el objeto oferta
  if (!offer && driverId && rawOffers && typeof rawOffers === 'object' && rawOffers[driverId]) {
    offer = {
      driverId,
      ...rawOffers[driverId]
    };
  }

  if (!offer) {
    throw new Error('Oferta no encontrada o ya no está disponible');
  }

  const selectedDriverId = offer.driverId || offer.conductorId || driverId;
  if (!selectedDriverId) {
    throw new Error('ID de conductor inválido en la oferta');
  }

  // Referencias a posibles colecciones del conductor
  const driverRef = doc(db, 'conductores', selectedDriverId);
  const userDriverRef = doc(db, 'users', selectedDriverId);
  const walletRef = doc(db, 'wallets', selectedDriverId);

  const valorOferta = Number(offer.price || offer.price_propuesto || offer.valor || serviceData.valor || 0);
  const comision = Math.round(valorOferta * 0.08);
  const nowIso = new Date().toISOString();

  let updatedServiceData: any = null;

  // TRANSACTION ATÓMICA: ACEPTAR + COBRAR COMISIÓN 8%
  await runTransaction(db, async (transaction) => {
    // 1. LECTURAS
    const currentServiceSnap = await transaction.get(serviceRef);
    if (!currentServiceSnap.exists()) {
      throw new Error('El servicio ya no existe');
    }

    const driverSnap = await transaction.get(driverRef);
    const userDriverSnap = await transaction.get(userDriverRef);
    const walletSnap = await transaction.get(walletRef);

    const driverDocData = driverSnap.exists() ? driverSnap.data() : (userDriverSnap.exists() ? userDriverSnap.data() : {});
    const walletDocData = walletSnap.exists() ? walletSnap.data() : {};

    const currentBalance = Number(
      walletDocData.balance ?? driverDocData.tarjeta_virtual ?? driverDocData.balance ?? 0
    );

    // 2. VALIDAR SALDO DEL CONDUCTOR
    if (currentBalance < comision) {
      throw new Error(`El conductor no tiene saldo suficiente en Tarjeta Virtual ($${formatCOP(currentBalance)} COP). Se requiere $${formatCOP(comision)} COP (8% de comisión).`);
    }

    const vehiculo = offer.vehiculo || offer.conductorVehiculo || driverDocData.vehiculo || {};

    updatedServiceData = {
      estado: 'aceptado',
      status: 'accepted',
      conductorId: selectedDriverId,
      driverId: selectedDriverId,
      conductorNombre: offer.conductorNombre || driverDocData.nombre || driverDocData.name || 'Conductor',
      conductorTelefono: offer.conductorTelefono || driverDocData.telefono || driverDocData.celular || '',
      conductorPlaca: offer.conductorPlaca || vehiculo.placa || 'SN-PLACA',
      conductorColor: offer.conductorColor || vehiculo.color || 'N/A',
      conductorCiudad: driverDocData.ciudad || serviceData.ciudad || 'Yopal',
      conductorCalificacion: offer.conductorCalificacion || driverDocData.calificacion || 5.0,
      conductorVehiculo: vehiculo,
      empresaTaxi: vehiculo.empresaTaxi || null,
      numeroTaxi: vehiculo.numeroTaxi || null,
      valor: valorOferta,
      comision: comision,
      tiempo_llegada: offer.tiempo_llegada || 5,
      fecha_aceptacion: nowIso,
      acceptedOffer: offer,
      ofertas: {},
      offers: []
    };

    const newBalance = currentBalance - comision;

    // 3. ACTUALIZACIONES DE DOCUMENTOS
    transaction.set(serviceRef, updatedServiceData, { merge: true });

    if (driverSnap.exists()) {
      transaction.set(driverRef, {
        tarjeta_virtual: newBalance,
        en_servicio: true,
        viajeActualId: serviceId
      }, { merge: true });
    }

    if (userDriverSnap.exists()) {
      transaction.set(userDriverRef, {
        tarjeta_virtual: newBalance,
        en_servicio: true,
        viajeActualId: serviceId
      }, { merge: true });
    }

    if (walletSnap.exists()) {
      transaction.set(walletRef, {
        balance: newBalance
      }, { merge: true });
    }
  });

  // 4. REGISTRAR TRANSACCIÓN DE COMISIÓN
  try {
    const transaccionesRef = collection(db, 'transacciones');
    await addDoc(transaccionesRef, {
      userId: selectedDriverId,
      tipo: 'comision',
      valor: comision,
      referencia: serviceId,
      fecha: nowIso
    });
  } catch (err) {
    console.warn('Error registrando transacción de comisión:', err);
  }

  return {
    success: true,
    message: 'Oferta aceptada y comisión cobrada exitosamente',
    data: updatedServiceData
  };
}
