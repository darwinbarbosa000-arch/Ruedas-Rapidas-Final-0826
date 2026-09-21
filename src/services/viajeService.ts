import { doc, runTransaction, serverTimestamp, collection, addDoc, setDoc, getDoc, updateDoc, writeBatch, query, where, getDocs, increment, deleteField } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getSyncedISOString } from './clockService';
import { submitOffer, acceptOffer } from './offerService';
import { marcarViajeCompartidoFinalizado } from './viajeCompartidoService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const rawMsg = error instanceof Error ? error.message : String(error);
  
  let cleanMsg = rawMsg;
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed && typeof parsed.error === 'string') {
      cleanMsg = parsed.error;
    }
  } catch (e) {}

  const errInfo: FirestoreErrorInfo = {
    error: cleanMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  const isDomainError = cleanMsg.includes('ya ha sido aceptado') || 
                        cleanMsg.includes('ya no está disponible') || 
                        cleanMsg.includes('saldo suficiente') || 
                        cleanMsg.includes('no encontrado') ||
                        cleanMsg.includes('ya fue cancelado') ||
                        cleanMsg.includes('ya no existe') ||
                        cleanMsg.includes('no cuenta con saldo') ||
                        cleanMsg.includes('por debajo del mercado') ||
                        cleanMsg.includes('mínima') ||
                        cleanMsg.includes('máximo') ||
                        cleanMsg.includes('rápido') ||
                        cleanMsg.includes('coincide') ||
                        cleanMsg.includes('lejos') ||
                        cleanMsg.includes('insuficiente');

  if (isDomainError) {
    console.warn('Validación de Negocio:', cleanMsg);
    throw new Error(cleanMsg);
  } else {
    console.error('Firestore Error:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
}

/**
 * Helper to retry a Firestore operation when transient permission errors occur (e.g. during registration)
 */
async function retryWithDelay<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isPermissionError = error.code === 'permission-denied' || 
                              error.message?.toLowerCase().includes('permission') || 
                              error.message?.toLowerCase().includes('insufficient');
    if (retries > 0 && isPermissionError) {
      console.warn(`Transient permission issue detected. Retrying in ${delayMs}ms... (Retries left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return retryWithDelay(fn, retries - 1, delayMs * 1.5);
    }
    throw error;
  }
}

/**
 * Crea un perfil de usuario con bono promocional de bienvenida de $10.000 COP (descontable en servicios)
 * o $50.000 COP para conductores.
 */
export async function crearPerfilUsuario(userId: string, datos: any) {
  const userRef = doc(db, 'usuarios', userId);
  const isAdmin = datos.email === 'darwin.barbosa000@gmail.com' || datos.email === 'ruedasrapidasviajaseguro@gmail.com';
  
  const defaultBonus = (datos.rol === 'conductor') ? 50000 : (datos.rol === 'marca_aliada' ? 0 : 10000);
  const resolvedPromo = (datos.saldo_promo !== undefined && datos.saldo_promo !== null && datos.saldo_promo > 0)
    ? datos.saldo_promo
    : (datos.rol === 'marca_aliada' ? 0 : 10000);

  const writeOp = async () => {
    await setDoc(userRef, {
      cedula: datos.cedula || '',
      departamento: datos.departamento || 'Cundinamarca',
      ciudad: datos.ciudad || 'Fusagasugá',
      servicios_count: 0,
      ...datos,
      saldo: datos.saldo !== undefined ? datos.saldo : 0,
      saldo_promo: resolvedPromo, // Bono inicial de $10.000 COP para usuarios, $50.000 COP para conductores
      rol: isAdmin ? 'admin' : (datos.rol || 'usuario'),
      terminos_aceptados: true,
      fecha_aceptacion_terminos: new Date().toISOString(),
      fecha_registro: new Date().toISOString()
    }, { merge: true });
  };

  try {
    await retryWithDelay(writeOp, 4, 400);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${userId}`);
  }
}

/**
 * Acepta un viaje directamente desde el modo conductor (sin oferta previa).
 * Verifica que el conductor tenga saldo suficiente para la comisión (8%).
 * Se asume un tiempo por defecto o se puede pasar como parámetro.
 */
export async function aceptarViaje(viajeId: string, conductorId: string, conductorNombre: string, conductorTelefono: string, conductorPlaca: string, conductorColor: string, valor: number, tiempoLlegada: number = 5) {
  const comision = Math.round(valor * 0.08);
  const conductorRef = doc(db, 'conductores', conductorId);
  const viajeRef = doc(db, 'viajes', viajeId);
  const transaccionesRef = collection(db, 'transacciones');

  try {
    await runTransaction(db, async (transaction) => {
      const conductorDoc = await transaction.get(conductorRef);
      const viajeDoc = await transaction.get(viajeRef);
      
      if (!conductorDoc.exists()) {
        throw new Error('El conductor no existe');
      }
      if (!viajeDoc.exists()) {
        throw new Error('El viaje no existe');
      }
      if (viajeDoc.data().estado !== 'solicitado' && viajeDoc.data().estado !== 'negociando') {
        throw new Error('El viaje ya no está disponible');
      }

      const saldoActual = conductorDoc.data().tarjeta_virtual || 0;
      if (saldoActual < comision) {
        throw new Error('Saldo insuficiente en Tarjeta Virtual para aceptar este viaje. El mínimo requerido es el 8% del valor del servicio ($' + comision.toLocaleString() + ' COP).');
      }

      // 1. Actualizar estado del viaje
      transaction.update(viajeRef, {
        estado: 'aceptado',
        conductorId: conductorId,
        conductorNombre: conductorNombre,
        conductorTelefono: conductorTelefono,
        conductorPlaca: conductorPlaca,
        conductorColor: conductorColor,
        conductorCiudad: conductorDoc.data().ciudad || '',
        conductorCalificacion: conductorDoc.data().calificacion || 5.0,
        valor: valor,
        comision: comision,
        tiempo_llegada: tiempoLlegada,
        fecha_aceptacion: getSyncedISOString(),
        ofertas: {} // Limpiar ofertas una vez aceptado
      });

      // 2. Descontar comisión e indicar que está en servicio
      transaction.update(conductorRef, {
        tarjeta_virtual: saldoActual - comision,
        en_servicio: true,
        viajeActualId: viajeId
      });

      // 3. Registrar transacción de comisión
      const transaccionId = `comision_${viajeId}_${Date.now()}`;
      const transaccionRef = doc(transaccionesRef, transaccionId);
      transaction.set(transaccionRef, {
        userId: conductorId,
        tipo: 'comision',
        valor: comision,
        referencia: viajeId,
        fecha: new Date().toISOString()
      });
    });

    console.log('Viaje aceptado exitosamente.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * El usuario selecciona una oferta de un conductor.
 */
export async function seleccionarOferta(viajeId: string, oferta: any) {
  try {
    const targetDriverId = oferta?.conductorId || oferta?.driverId;
    const targetOfferId = oferta?.offerId || oferta?.id;

    return await acceptOffer({
      serviceId: viajeId,
      offerId: targetOfferId,
      driverId: targetDriverId,
      userId: auth.currentUser?.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * Actualiza el estado del viaje (en_camino, llegando, en_transito, finalizado).
 */
export async function actualizarEstadoViaje(viajeId: string, nuevoEstado: string) {
  const viajeRef = doc(db, 'viajes', viajeId);
  try {
    await updateDoc(viajeRef, {
      estado: nuevoEstado,
      [`fecha_${nuevoEstado}`]: getSyncedISOString()
    });
    if (nuevoEstado === 'finalizado') {
      await marcarViajeCompartidoFinalizado(viajeId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * El conductor propone un valor para el viaje y el tiempo estimado de llegada con validaciones de oferta nacional.
 */
export async function ofertarViaje(
  viajeId: string, 
  conductorId: string, 
  conductorNombre: string, 
  conductorTelefono: string, 
  conductorPlaca: string, 
  conductorColor: string, 
  valor: number, 
  tiempoLlegada: number,
  conductorLocation?: { lat: number; lng: number } | null
) {
  try {
    await submitOffer({
      serviceId: viajeId,
      driverId: conductorId,
      price_propuesto: valor,
      conductor_location: conductorLocation,
      conductorNombre,
      conductorTelefono,
      conductorPlaca,
      conductorColor,
      tiempoLlegada
    });
  } catch (error: any) {
    if (error instanceof Error && !error.message.includes('permission-denied') && !error.message.includes('FirebaseError')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * Finaliza un viaje, descuenta el valor del saldo promocional del usuario (bono de bienvenida o saldo activo),
 * suma automáticamente dicho valor a la Tarjeta Virtual del conductor y liquida la comisión.
 */
export async function finalizarViaje(viajeId: string, usuarioId: string, valor: number) {
  const userRef = doc(db, 'usuarios', usuarioId);
  const viajeRef = doc(db, 'viajes', viajeId);
  const statsRef = doc(db, 'config', 'stats'); // Documento para estadísticas globales
  const transaccionesRef = collection(db, 'transacciones');

  try {
    let tripSummary = { descuento: 0, valorFinal: valor, valorTotal: valor };

    await runTransaction(db, async (transaction) => {
      // 1. TODAS LAS LECTURAS AL INICIO
      const userDoc = await transaction.get(userRef);
      const viajeDoc = await transaction.get(viajeRef);
      const statsDoc = await transaction.get(statsRef);

      if (!userDoc.exists()) throw new Error('Usuario no encontrado');
      if (!viajeDoc.exists()) throw new Error('Viaje no encontrado');
      if (viajeDoc.data().estado === 'finalizado') return; 

      const viajeData = viajeDoc.data();
      const conductorId = viajeData.conductorId;
      
      let conductorDoc = null;
      let conductorRef = null;
      if (conductorId) {
        conductorRef = doc(db, 'conductores', conductorId);
        conductorDoc = await transaction.get(conductorRef);
      }

      // 2. CÁLCULO DE VALORES
      const comision = viajeData.comision || Math.round(valor * 0.08);
      const saldoPromoActual = userDoc.data().saldo_promo || 0;
      // Descontable en cada servicio hasta agotar el bono
      const descuento = Math.min(saldoPromoActual, valor);
      const valorFinalEfectivo = Math.max(0, valor - descuento);

      tripSummary = {
        descuento,
        valorFinal: valorFinalEfectivo,
        valorTotal: valor
      };

      // Nivel Global
      if (!statsDoc.exists()) {
        transaction.set(statsRef, { total_servicios_completados: 1 });
      } else {
        transaction.update(statsRef, { total_servicios_completados: increment(1) });
      }

      // Nivel Conductor: El bono descontado al usuario se SUMA directamente a la tarjeta virtual del conductor
      if (conductorDoc && conductorDoc.exists() && conductorRef) {
        const saldoConductor = conductorDoc.data().tarjeta_virtual || 0;
        
        transaction.update(conductorRef, {
          servicios_completados: increment(1),
          servicios_semanales: increment(1),
          tarjeta_virtual: saldoConductor + (descuento > 0 ? descuento : 0),
          en_servicio: false,
          viajeActualId: null
        });

        if (descuento > 0) {
          const transaccionAbonoId = `abono_promo_${viajeId}_${Date.now()}`;
          const transaccionAbonoRef = doc(transaccionesRef, transaccionAbonoId);
          transaction.set(transaccionAbonoRef, {
            userId: conductorId,
            tipo: 'abono_promo',
            valor: descuento,
            referencia: viajeId,
            detalle: `Abono bono pasajero (${viajeData.usuarioNombre || 'Pasajero'}) acreditado a Tarjeta Virtual`,
            fecha: new Date().toISOString()
          });
        }
      }

      // Nivel Usuario: Descontar el valor del bono usado en este servicio
      transaction.update(userRef, {
        saldo_promo: Math.max(0, saldoPromoActual - descuento),
        servicios_count: increment(1)
      });

      // Finalizar viaje con desglose claro
      transaction.update(viajeRef, {
        estado: 'finalizado',
        comision: comision,
        valor_pagado_promo: descuento,
        saldo_promo_descontado: descuento,
        abono_tarjeta_conductor: descuento,
        valor_final: valorFinalEfectivo,
        fecha_finalizacion: getSyncedISOString()
      });
    });

    await marcarViajeCompartidoFinalizado(viajeId);
    return tripSummary;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
    throw error;
  }
}

/**
 * Crea un perfil de conductor con validaciones y saldo inicial de 50,000 COP en tarjeta virtual.
 */
export async function crearPerfilConductor(userId: string, datos: any) {
  // Normalizar y formatear el teléfono de forma robusta
  let rawPhone = String(datos.telefono || datos.celular || datos.phone || '').trim();
  const digitsOnly = rawPhone.replace(/\D/g, '');
  let phone = rawPhone;

  if (digitsOnly.length === 10) {
    phone = `+57${digitsOnly}`;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('57')) {
    phone = `+${digitsOnly}`;
  } else if (/^\+57\d{10}$/.test(rawPhone)) {
    phone = rawPhone;
  } else if (digitsOnly.length >= 7) {
    phone = `+57${digitsOnly}`;
  } else {
    phone = rawPhone || '+573000000000';
  }

  const city = datos.ciudad || datos.city || 'Fusagasugá';
  const depto = datos.departamento || 'Cundinamarca';
  const vehicleType = datos.vehiculo?.tipo || datos.vehicle_type || datos.vehiculo_tipo || 'carro';

  // Llamar al endpoint backend para validación asistida sin bloquear la base de datos
  try {
    const res = await fetch('/api/register-driver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({
        userId,
        phone,
        city,
        vehicle_type: vehicleType,
        vehiculo: datos.vehiculo
      })
    });
    if (res.ok) {
      console.log('Validación backend de conductor exitosa');
    }
  } catch (apiError: any) {
    console.warn('Aviso de validación backend de conductor (continuando en modo seguro):', apiError?.message);
  }

  const conductorRef = doc(db, 'conductores', userId);
  const userRef = doc(db, 'users', userId);
  const usuarioRef = doc(db, 'usuarios', userId);
  
  const writeOp = async () => {
    const defaultDocs = {
      cedulaUrl: datos.driverDocuments?.cedulaUrl || datos.cedulaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
      licenciaUrl: datos.driverDocuments?.licenciaUrl || datos.licenciaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
      tarjetaUrl: datos.driverDocuments?.tarjetaUrl || datos.tarjetaUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400',
      selfieUrl: datos.driverDocuments?.selfieUrl || datos.selfieUrl || datos.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'
    };

    // 1. Guardar en /users/{uid}
    await setDoc(userRef, {
      name: datos.nombre || datos.name || 'Conductor',
      role: 'conductor',
      status: 'aprobado',
      driverDocuments: defaultDocs,
      phoneVerified: true,
      vehiculo: datos.vehiculo || { tipo: vehicleType, placa: 'POR-ASIGNAR', modelo: 'Estándar' },
      ciudad: city,
      departamento: depto,
      createdAt: new Date().toISOString()
    }, { merge: true });

    // 2. Guardar en /usuarios/{uid}
    await setDoc(usuarioRef, {
      nombre: datos.nombre || datos.name || 'Conductor',
      rol: 'conductor',
      status: 'aprobado',
      ciudad: city,
      departamento: depto,
      driverDocuments: defaultDocs
    }, { merge: true });

    // 3. Guardar en /conductores/{uid} con su bono de $50.000 COP en tarjeta virtual
    await setDoc(conductorRef, {
      ...datos,
      nombre: datos.nombre || datos.name || 'Conductor',
      telefono: phone,
      celular: phone,
      userId: userId,
      tarjeta_virtual: 50000, // Bono de bienvenida de $50.000 COP
      saldo_promo: 50000,
      activo: false,
      modo_repartidor: false,
      aprobado: true,
      status: 'aprobado',
      driverDocuments: defaultDocs,
      documentos_autorizados: {
        identidad: true,
        licencia: true,
        propiedad: true,
        soat: true
      },
      calificacion: 5.0,
      total_calificaciones: 0,
      servicios_completados: 0,
      servicios_semanales: 0,
      expreso_habilitado: true,
      genero: datos.genero || 'masculino',
      ciudad: city,
      departamento: depto,
      vehiculo: datos.vehiculo || { tipo: vehicleType, placa: 'POR-ASIGNAR', modelo: 'Estándar' },
      fecha_registro: new Date().toISOString()
    }, { merge: true });

    // 4. Registrar movimiento inicial de bono en la Tarjeta Virtual
    try {
      const transaccionBonoRef = doc(collection(db, 'transacciones'), `bono_conductor_${userId}`);
      await setDoc(transaccionBonoRef, {
        userId: userId,
        tipo: 'bono_bienvenida',
        valor: 50000,
        referencia: 'registro_conductor',
        detalle: 'Bono Inicial de Bienvenida a Tarjeta Virtual',
        fecha: new Date().toISOString()
      }, { merge: true });
    } catch (tErr) {
      console.warn("Aviso al registrar transacción inicial de bono:", tErr);
    }
  };

  try {
    await retryWithDelay(writeOp, 4, 400);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conductores/${userId}`);
  }
}

/**
 * Cambia el estado de conexión del conductor (activo/inactivo).
 */
export async function toggleEstadoConductor(conductorId: string, nuevoEstado: boolean) {
  const conductorRef = doc(db, 'conductores', conductorId);
  try {
    const docSnap = await getDoc(conductorRef);
    if (docSnap.exists() && docSnap.data().bloqueado && nuevoEstado) {
      throw new Error('Tu cuenta de conductor está bloqueada. Contacta a soporte.');
    }
    await updateDoc(conductorRef, {
      activo: nuevoEstado,
      en_servicio: nuevoEstado ? (docSnap.data().en_servicio || false) : false
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conductores/${conductorId}`);
  }
}

/**
 * Permite que el conductor cancele un viaje después de haberlo aceptado.
 * Según las reglas de negocio, NO hay reembolso de la comisión del 8% si el conductor cancela.
 */
export async function cancelarViajeConductor(viajeId: string, conductorId: string) {
  const viajeRef = doc(db, 'viajes', viajeId);
  const conductorRef = doc(db, 'conductores', conductorId);

  try {
    await runTransaction(db, async (transaction) => {
      transaction.update(viajeRef, {
        estado: 'cancelado',
        canceladoPor: 'conductor',
        fecha_cancelacion: new Date().toISOString(),
        actualizado_en: serverTimestamp()
      });
      transaction.update(conductorRef, {
        en_servicio: false,
        viajeActualId: null
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * Cambia el estado de recepción de domicilios del conductor.
 */
export async function toggleModoRepartidor(conductorId: string, nuevoEstado: boolean) {
  const conductorRef = doc(db, 'conductores', conductorId);
  try {
    await updateDoc(conductorRef, {
      modo_repartidor: nuevoEstado
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conductores/${conductorId}`);
  }
}

/**
 * El conductor solicita una recarga de saldo.
 */
export async function solicitarRecarga(conductorId: string, conductorNombre: string, valor: number) {
  const recargasRef = collection(db, 'recargas');
  try {
    await addDoc(recargasRef, {
      conductorId,
      conductorNombre,
      valor,
      estado: 'pendiente',
      fecha: new Date().toISOString(),
      nubankKey: '@DBP772'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'recargas');
  }
}

/**
 * El administrador aprueba una recarga y actualiza el saldo del conductor.
 */
export async function aprobarRecarga(recargaId: string, conductorId: string, valor: number, adminId?: string) {
  const recargaRef = doc(db, 'recargas', recargaId);
  const conductorRef = doc(db, 'conductores', conductorId);
  const transaccionesRef = collection(db, 'transacciones');

  try {
    await runTransaction(db, async (transaction) => {
      const recargaDoc = await transaction.get(recargaRef);
      const conductorDoc = await transaction.get(conductorRef);

      if (!recargaDoc.exists()) throw new Error('Recarga no encontrada');
      if (!conductorDoc.exists()) throw new Error('Conductor no encontrado');
      if (recargaDoc.data().estado !== 'pendiente') throw new Error('La recarga ya ha sido procesada');

      const saldoActual = conductorDoc.data().tarjeta_virtual || 0;

      // 1. Actualizar estado de la recarga
      transaction.update(recargaRef, { 
        estado: 'aprobada',
        fechaProcesada: new Date().toISOString(),
        procesadaPor: adminId || 'admin'
      });

      // 2. Incrementar saldo del conductor
      transaction.update(conductorRef, {
        tarjeta_virtual: saldoActual + valor
      });

      // 3. Registrar transacción
      const transaccionId = `recarga_${recargaId}_${Date.now()}`;
      const transaccionRef = doc(transaccionesRef, transaccionId);
      transaction.set(transaccionRef, {
        userId: conductorId,
        tipo: 'recarga',
        valor: valor,
        referencia: recargaId,
        fecha: new Date().toISOString()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recargas/${recargaId}`);
  }
}

/**
 * Califica a un conductor después de un viaje.
 * Actualiza el promedio de calificación del conductor y marca el viaje como calificado.
 */
export async function calificarConductor(viajeId: string, conductorId: string, usuarioId: string, estrellas: number, comentario: string = "") {
  const conductorRef = doc(db, 'conductores', conductorId);
  const viajeRef = doc(db, 'viajes', viajeId);
  const calificacionesRef = collection(db, 'calificaciones');

  try {
    await runTransaction(db, async (transaction) => {
      const conductorDoc = await transaction.get(conductorRef);
      const viajeDoc = await transaction.get(viajeRef);

      if (!conductorDoc.exists()) throw new Error('Conductor no encontrado');
      if (!viajeDoc.exists()) throw new Error('Viaje no encontrado');
      if (viajeDoc.data().calificado) return; // Ya está calificado, regresamos éxito

      const conductorData = conductorDoc.data();
      const currentCalificacion = conductorData.calificacion || 5.0;
      const currentTotal = conductorData.total_calificaciones || 0;

      const newTotal = (currentTotal || 0) + 1;
      const newCalificacion = (((currentCalificacion || 5.0) * (currentTotal || 0)) + estrellas) / newTotal;

      // 1. Crear la calificación
      const calificacionId = `calif_${viajeId}_${Date.now()}`;
      const calificacionRef = doc(calificacionesRef, calificacionId);
      const calificacionData = {
        conductorId,
        usuarioId,
        viajeId,
        estrellas,
        comentario: comentario || "",
        fecha: new Date().toISOString()
      };
      
      console.log('Ejecutando transacción de calificación:', {
        calificacionId,
        conductorId,
        newCalificacion,
        newTotal
      });

      transaction.set(calificacionRef, calificacionData);

      // 2. Actualizar el conductor
      transaction.update(conductorRef, {
        calificacion: Number(newCalificacion.toFixed(2)),
        total_calificaciones: newTotal
      });

      // 3. Marcar el viaje como calificado
      transaction.update(viajeRef, {
        calificado: true
      });
    });
    console.log('Calificación completada exitosamente');
  } catch (error) {
    console.error('Error detallado en calificarConductor:', error);
    handleFirestoreError(error, OperationType.WRITE, `calificaciones_viaje_${viajeId}`);
  }
}

/**
 * El administrador rechaza una recarga.
 */
export async function rechazarRecarga(recargaId: string, adminId?: string) {
  const recargaRef = doc(db, 'recargas', recargaId);
  try {
    await updateDoc(recargaRef, { 
      estado: 'rechazada',
      fechaProcesada: new Date().toISOString(),
      procesadaPor: adminId || 'admin'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recargas/${recargaId}`);
  }
}

/**
 * El administrador realiza una recarga manual a un conductor.
 */
export async function recargaManual(conductorId: string, conductorNombre: string, valor: number, adminId: string) {
  const conductorRef = doc(db, 'conductores', conductorId);
  const recargasRef = collection(db, 'recargas');
  const transaccionesRef = collection(db, 'transacciones');

  try {
    await runTransaction(db, async (transaction) => {
      const conductorDoc = await transaction.get(conductorRef);
      if (!conductorDoc.exists()) throw new Error('Conductor no encontrado');

      const saldoActual = conductorDoc.data().tarjeta_virtual || 0;
      
      // 1. Crear el registro en la colección de recargas (como manual)
      const recargaManualDoc = doc(recargasRef);
      transaction.set(recargaManualDoc, {
        conductorId,
        conductorNombre,
        valor,
        estado: 'aprobada', // Las manuales se consideran aprobadas de inmediato
        tipo: 'manual',
        fecha: new Date().toISOString(),
        fechaProcesada: new Date().toISOString(),
        procesadaPor: adminId
      });

      // 2. Actualizar el saldo del conductor
      transaction.update(conductorRef, {
        tarjeta_virtual: valor // En el caso de "Editar Saldo" del admin actual, parece que sobreescriben el valor o lo incrementan?
        // El código actual en App.tsx dice: updateDoc(..., { tarjeta_virtual: Number(adminActionValue) })
        // Así que es un "set" de saldo, no un incremento.
      });

      // 3. Registrar en transacciones
      const transaccionRef = doc(transaccionesRef, `manual_${recargaManualDoc.id}`);
      transaction.set(transaccionRef, {
        userId: conductorId,
        tipo: 'recarga_manual',
        valor: valor,
        referencia: recargaManualDoc.id,
        fecha: new Date().toISOString(),
        procesadaPor: adminId
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recargas_manuales/${conductorId}`);
  }
}

/**
 * Permite que el usuario cancele su solicitud de viaje.
 * Si el viaje no había sido aceptado por un conductor, se cuenta como un "servicio perdido" en las estadísticas del usuario.
 */
export async function cancelarViajeUsuario(viajeId: string, usuarioId: string) {
  const viajeRef = doc(db, 'viajes', viajeId);
  const userRef = doc(db, 'usuarios', usuarioId);

  try {
    await runTransaction(db, async (transaction) => {
      const viajeDoc = await transaction.get(viajeRef);
      const userDoc = await transaction.get(userRef);

      if (!viajeDoc.exists()) throw new Error('El viaje no existe');

      const estadoActual = viajeDoc.data().estado;
      
      // Actualizar el viaje
      transaction.update(viajeRef, {
        estado: 'cancelado',
        canceladoPor: 'usuario',
        fecha_cancelacion: new Date().toISOString(),
        actualizado_en: serverTimestamp()
      });

      // Liberar al conductor si ya estaba asignado (el 8% queda cobrado, sin reembolso)
      const conductorId = viajeDoc.data().conductorId;
      if (conductorId) {
        const conductorRef = doc(db, 'conductores', conductorId);
        transaction.update(conductorRef, {
          en_servicio: false,
          viajeActualId: null
        });
      }

      // Si el viaje estaba en 'solicitado' o 'negociando' (no aceptado aún)
      // lo contamos como servicio perdido para el usuario
      if (estadoActual === 'solicitado' || estadoActual === 'negociando') {
        if (userDoc.exists()) {
          transaction.update(userRef, {
            servicios_perdidos: (userDoc.data().servicios_perdidos || 0) + 1
          });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * Función genérica de cancelación (usada para limpiezas o timeouts).
 */
export async function cancelarViaje(viajeId: string) {
  const viajeRef = doc(db, 'viajes', viajeId);
  try {
    await runTransaction(db, async (transaction) => {
      const viajeDoc = await transaction.get(viajeRef);
      if (!viajeDoc.exists()) throw new Error('El viaje no existe');

      transaction.update(viajeRef, {
        estado: 'cancelado',
        canceladoPor: 'sistema',
        fecha_cancelacion: new Date().toISOString(),
        actualizado_en: serverTimestamp()
      });

      const conductorId = viajeDoc.data().conductorId;
      if (conductorId) {
        const conductorRef = doc(db, 'conductores', conductorId);
        transaction.update(conductorRef, {
          en_servicio: false,
          viajeActualId: null
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * Permite que un administrador cancele un viaje que no ha sido atendido o que está en espera prolongada.
 */
export async function cancelarViajePorAdministrador(viajeId: string, adminId: string, motivo: string) {
  const viajeRef = doc(db, 'viajes', viajeId);
  try {
    await runTransaction(db, async (transaction) => {
      const viajeDoc = await transaction.get(viajeRef);
      if (!viajeDoc.exists()) throw new Error('El viaje no existe');

      transaction.update(viajeRef, {
        estado: 'cancelado',
        canceladoPor: 'administrador',
        motivoCancelacionAdmin: motivo,
        canceladoPorAdminId: adminId,
        fecha_cancelacion: new Date().toISOString(),
        actualizado_en: serverTimestamp()
      });

      const conductorId = viajeDoc.data().conductorId;
      if (conductorId) {
        const conductorRef = doc(db, 'conductores', conductorId);
        transaction.update(conductorRef, {
          en_servicio: false,
          viajeActualId: null
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `viajes/${viajeId}`);
  }
}

/**
 * El administrador ajusta el saldo promocional de un usuario.
 */
export async function ajustarSaldoUsuario(usuarioId: string, usuarioNombre: string, nuevoSaldo: number, adminId: string) {
  const usuarioRef = doc(db, 'usuarios', usuarioId);
  const recargasRef = collection(db, 'recargas'); // Podríamos usar una colección diferente si quisiéramos separar usuarios de conductores

  try {
    await runTransaction(db, async (transaction) => {
      const usuarioDoc = await transaction.get(usuarioRef);
      if (!usuarioDoc.exists()) throw new Error('Usuario no encontrado');

      // 1. Crear el registro de ajuste (opcional para el historial de recargas si se concentran aquí)
      const ajusteDoc = doc(recargasRef);
      transaction.set(ajusteDoc, {
        usuarioId,
        usuarioNombre,
        valor: nuevoSaldo,
        estado: 'aprobada',
        tipo: 'ajuste_saldo_usuario',
        fecha: new Date().toISOString(),
        procesadaPor: adminId
      });

      // 2. Actualizar el saldo
      transaction.update(usuarioRef, {
        saldo_promo: nuevoSaldo
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${usuarioId}`);
  }
}

/**
 * Bloquea o desbloquea un usuario.
 */
export async function toggleBloqueoUsuario(userId: string, bloqueado: boolean) {
  const userRef = doc(db, 'usuarios', userId);
  try {
    await updateDoc(userRef, { bloqueado });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${userId}`);
  }
}

/**
 * Activa o desactiva el rol de administrador suplente a un usuario.
 */
export async function toggleAdminSuplente(userId: string, esSuplente: boolean) {
  const userRef = doc(db, 'usuarios', userId);
  try {
    await updateDoc(userRef, { rol: esSuplente ? 'admin_suplente' : 'usuario' });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${userId}`);
  }
}

/**
 * Bloquea o desbloquea un conductor.
 */
export async function toggleBloqueoConductor(conductorId: string, bloqueado: boolean, bloqueo_tipo?: 'permanente' | 'temporal', horas?: number) {
  const conductorRef = doc(db, 'conductores', conductorId);
  try {
    const updates: any = { bloqueado };
    if (bloqueado) {
      if (bloqueo_tipo === 'temporal' && horas) {
        updates.bloqueo_tipo = 'temporal';
        updates.bloqueado_desde = new Date().toISOString();
        updates.bloqueado_hasta = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
        updates.bloqueo_horas = horas;
      } else {
        updates.bloqueo_tipo = 'permanente';
        updates.bloqueado_desde = new Date().toISOString();
        updates.bloqueado_hasta = null;
        updates.bloqueo_horas = null;
      }
    } else {
      updates.bloqueo_tipo = null;
      updates.bloqueado_desde = null;
      updates.bloqueado_hasta = null;
      updates.bloqueo_horas = null;
    }
    await updateDoc(conductorRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conductores/${conductorId}`);
  }
}

/**
 * Crea un viaje expreso compartido.
 */
export async function crearViajeExpreso(conductorId: string, datos: any) {
  const expresoRef = collection(db, 'expreso_viajes');
  try {
    const docRef = await addDoc(expresoRef, {
      ...datos,
      conductorId,
      cuposDisponibles: datos.cuposTotales,
      estado: 'programado',
      pasajeros: {},
      fechaCreacion: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'expreso_viajes');
  }
}

/**
 * Reserva uno o más cupos en un viaje expreso.
 * Se descuenta automáticamente una comisión del 8% de la tarjeta virtual del conductor.
 */
export async function reservarCupoExpreso(viajeId: string, usuarioId: string, usuarioNombre: string, cuposReservar: number, usuarioTelefono: string) {
  const viajeRef = doc(db, 'expreso_viajes', viajeId);
  const userRef = doc(db, 'usuarios', usuarioId);
  const transaccionesRef = collection(db, 'transacciones');

  try {
    await runTransaction(db, async (transaction) => {
      const viajeDoc = await transaction.get(viajeRef);
      const userDoc = await transaction.get(userRef);

      if (!viajeDoc.exists()) throw new Error('El viaje expreso no existe');
      if (!userDoc.exists()) throw new Error('Usuario no encontrado');

      const data = viajeDoc.data();
      if (data.estado !== 'programado') throw new Error('Este viaje ya no acepta reservas');
      if (data.cuposDisponibles < cuposReservar) throw new Error('No hay cupos suficientes disponibles');

      const conductorId = data.conductorId;
      if (!conductorId) throw new Error('Conductor no identificado para este viaje');
      
      const conductorRef = doc(db, 'conductores', conductorId);
      const conductorDoc = await transaction.get(conductorRef);
      
      if (!conductorDoc.exists()) throw new Error('El conductor ya no está disponible');

      // Calcular comisión (8% de la reserva)
      const valorReserva = (data.valorPorCupo || 0) * cuposReservar;
      const comision = Math.round(valorReserva * 0.08);
      const saldoConductor = conductorDoc.data().tarjeta_virtual || 0;

      if (saldoConductor < comision) {
        throw new Error('El conductor no cuenta con saldo suficiente en su Tarjeta Virtual para procesar la comisión de esta reserva (8% = $' + comision.toLocaleString() + ' COP).');
      }

      const pasajeros = data.pasajeros || {};
      const infoActual = pasajeros[usuarioId] || { cupos: 0 };
      const nuevosCupos = infoActual.cupos + cuposReservar;

      // 1. Actualizar viaje: cupos y datos del pasajero
      transaction.update(viajeRef, {
        cuposDisponibles: data.cuposDisponibles - cuposReservar,
        [`pasajeros.${usuarioId}`]: {
          nombre: usuarioNombre,
          telefono: usuarioTelefono,
          fecha: new Date().toISOString(),
          cupos: nuevosCupos,
          valorTotal: nuevosCupos * (data.valorPorCupo || 0)
        }
      });

      // 2. Descontar comisión al conductor
      transaction.update(conductorRef, {
        tarjeta_virtual: saldoConductor - comision
      });

      // 3. Registrar transacción de comisión
      const transaccionId = `comision_expreso_${viajeId}_${usuarioId}_${Date.now()}`;
      const transaccionRef = doc(transaccionesRef, transaccionId);
      transaction.set(transaccionRef, {
        userId: conductorId,
        tipo: 'comision_expreso',
        valor: comision,
        referencia: viajeId,
        detalles: `Reserva de ${cuposReservar} cupo(s) por ${usuarioNombre}`,
        fecha: new Date().toISOString()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `expreso_viajes/${viajeId}`);
  }
}

/**
 * Cancela una reserva de cupos en un viaje expreso (Usuario).
 */
export async function cancelarReservaExpreso(viajeId: string, usuarioId: string, usuarioNombre: string) {
  const viajeRef = doc(db, 'expreso_viajes', viajeId);
  try {
    await runTransaction(db, async (transaction) => {
      const viajeDoc = await transaction.get(viajeRef);
      if (!viajeDoc.exists()) throw new Error('El viaje expreso no existe');

      const data = viajeDoc.data();
      const pasajeros = data.pasajeros || {};
      const infoReserva = pasajeros[usuarioId];

      if (!infoReserva) throw new Error('No tienes una reserva en este viaje');

      const cuposLiberar = infoReserva.cupos || 0;

      // 1. Actualizar el viaje: liberar cupos y eliminar pasajero con deleteField()
      transaction.update(viajeRef, {
        cuposDisponibles: increment(cuposLiberar),
        [`pasajeros.${usuarioId}`]: deleteField()
      });
      
      // 2. Notificación al conductor
      const conductorId = data.conductorId;
      if (conductorId) {
        const mensajesRef = collection(db, 'mensajes_admin');
        const notificacionRef = doc(mensajesRef);
        transaction.set(notificacionRef, {
          chatId: `notif_${conductorId}`,
          mensaje: `¡ALERTA! El pasajero ${usuarioNombre} ha cancelado su reserva de ${cuposLiberar} cupo(s) para el viaje de las ${new Date(data.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Los cupos han sido liberados.`,
          senderId: 'sistema',
          senderNombre: 'Sistema Expreso',
          targetId: conductorId,
          targetNombre: data.conductorNombre || 'Conductor',
          tipoTarget: 'conductor',
          fecha: new Date().toISOString(),
          leido: false,
          tipo: 'cancelacion_expreso'
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `expreso_viajes/${viajeId}/cancelar`);
  }
}

/**
 * Cancela un viaje expreso (Solo conductor).
 * Libera cupos y notifica a todos los pasajeros.
 */
export async function cancelarViajeExpreso(viajeId: string) {
  const viajeRef = doc(db, 'expreso_viajes', viajeId);
  try {
    await runTransaction(db, async (transaction) => {
      const viajeDoc = await transaction.get(viajeRef);
      if (!viajeDoc.exists()) throw new Error('El viaje no existe');

      const data = viajeDoc.data();
      if (data.estado === 'cancelado') return;

      // 1. Marcar el viaje como cancelado
      transaction.update(viajeRef, {
        estado: 'cancelado',
        fechaCancelacion: new Date().toISOString()
      });

      // 2. Notificar a cada pasajero
      const pasajeros = data.pasajeros || {};
      const mensajesRef = collection(db, 'mensajes_admin');

      Object.entries(pasajeros).forEach(([uid, info]: [string, any]) => {
        const notifRef = doc(mensajesRef);
        transaction.set(notifRef, {
          chatId: `notif_${uid}`,
          mensaje: `¡LO SENTIMOS! El conductor ${data.conductorNombre || 'del expreso'} ha cancelado el viaje de las ${new Date(data.fechaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Te invitamos a buscar otra opción disponible.`,
          senderId: 'sistema',
          senderNombre: 'Sistema Expreso',
          targetId: uid,
          targetNombre: info.nombre,
          tipoTarget: 'usuario',
          fecha: new Date().toISOString(),
          leido: false,
          tipo: 'cancelacion_expreso_conductor'
        });
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `expreso_viajes/${viajeId}`);
  }
}

/**
 * Envía un mensaje en un chat entre administrador y usuario/conductor.
 */
export async function enviarMensajeAdmin(
  chatId: string, 
  mensaje: string, 
  senderId: string, 
  senderNombre: string, 
  targetId: string, 
  targetNombre: string,
  tipoTarget: 'usuario' | 'conductor'
) {
  const mensajesRef = collection(db, 'mensajes_admin');
  try {
    await addDoc(mensajesRef, {
      chatId,
      mensaje,
      senderId,
      senderNombre,
      targetId,
      targetNombre,
      tipoTarget,
      fecha: new Date().toISOString(),
      leido: false
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'mensajes_admin');
  }
}

/**
 * Marca todos los mensajes no leídos de un chat como leídos para el receptor actual.
 */
export async function marcarMensajesChatLeidos(chatId: string, currentUserId: string) {
  const q = query(
    collection(db, 'mensajes_admin'),
    where('chatId', '==', chatId),
    where('targetId', '==', currentUserId),
    where('leido', '==', false)
  );
  
  try {
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { leido: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'mensajes_admin_batch');
  }
}
