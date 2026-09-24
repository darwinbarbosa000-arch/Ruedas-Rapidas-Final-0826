import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

export interface DriverDocuments {
  cedulaUrl?: string;
  licenciaUrl?: string;
  tarjetaUrl?: string;
  selfieUrl?: string;
  [key: string]: string | undefined;
}

export interface PendingDriver {
  id: string;
  name: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  cedula?: string;
  role: string;
  status: string;
  aprobado: boolean;
  driverDocuments?: DriverDocuments;
  fotoCedulaUrl?: string;
  vehiculo?: {
    tipo?: string;
    placa?: string;
    modelo?: string;
    color?: string;
    empresaTaxi?: string;
    numeroTaxi?: string;
    capacidad?: string;
    volumen?: string;
    dimensiones?: string;
  };
  ciudad?: string;
  departamento?: string;
  fecha_registro?: string;
  tarjeta_virtual?: number;
  deviceId?: string;
}

/**
 * Validador universal para saber si un conductor está pendiente de aprobación previa por el administrador
 */
export function isDriverPendingApproval(d: any): boolean {
  if (!d) return false;

  // Si ya está explícitamente aprobado y activo, no está pendiente
  if (d.aprobado === true && (d.status === 'activo' || d.status === 'aprobado' || d.estado === 'activo' || d.activo === true)) {
    return false;
  }

  // Si está explícitamente no aprobado
  if (d.aprobado === false) return true;

  // Si el estado o status es pending / pendiente / en_espera / espera
  const st = String(d.status || d.estado || '').toLowerCase().trim();
  if (st === 'pending' || st === 'pendiente' || st === 'en_espera' || st === 'espera' || st === 'revision' || st === 'por_aprobar') {
    return true;
  }

  // Si su rol es conductor y aún no ha sido marcado como aprobado
  const role = String(d.role || d.rol || '').toLowerCase().trim();
  if (role === 'conductor' && d.aprobado !== true) {
    return true;
  }

  return false;
}

/**
 * Mapeador universal de datos de Firestore a la interfaz PendingDriver
 */
export function mapToPendingDriver(id: string, d: any, existing?: PendingDriver): PendingDriver {
  const cedulaUrl =
    d.fotoCedulaUrl ||
    d.cedulaUrl ||
    d.driverDocuments?.cedulaUrl ||
    d.driverDocuments?.fotoCedulaUrl ||
    d.documentos?.cedulaUrl ||
    existing?.driverDocuments?.cedulaUrl ||
    existing?.fotoCedulaUrl ||
    '';

  const licenciaUrl =
    d.driverDocuments?.licenciaUrl ||
    d.documentos?.licenciaUrl ||
    d.licenciaUrl ||
    existing?.driverDocuments?.licenciaUrl ||
    '';

  const tarjetaUrl =
    d.driverDocuments?.tarjetaUrl ||
    d.documentos?.tarjetaUrl ||
    d.tarjetaUrl ||
    existing?.driverDocuments?.tarjetaUrl ||
    '';

  const selfieUrl =
    d.photoURL ||
    d.selfieUrl ||
    d.driverDocuments?.selfieUrl ||
    d.documentos?.selfieUrl ||
    existing?.driverDocuments?.selfieUrl ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

  const vTipo = d.vehiculo?.tipo || d.vehiculoTipo || d.vehicle_type || existing?.vehiculo?.tipo || 'carro';
  const vPlaca = d.vehiculo?.placa || d.placa || existing?.vehiculo?.placa || 'SN-PLACA';
  const vModelo = d.vehiculo?.modelo || d.vehiculoModelo || existing?.vehiculo?.modelo || 'Estándar';
  const vColor = d.vehiculo?.color || existing?.vehiculo?.color || 'Gris';

  return {
    id,
    name: d.nombre || d.name || existing?.name || 'Conductor Pendiente',
    nombre: d.nombre || d.name || existing?.nombre || 'Conductor Pendiente',
    email: d.email || existing?.email || '',
    telefono: d.telefono || d.celular || d.phone || existing?.telefono || '',
    cedula: d.cedula || d.documento || existing?.cedula || 'No registrada',
    role: 'conductor',
    status: d.status || d.estado || 'pendiente',
    aprobado: false,
    fotoCedulaUrl: cedulaUrl,
    driverDocuments: {
      cedulaUrl: cedulaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
      licenciaUrl: licenciaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
      tarjetaUrl: tarjetaUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400',
      selfieUrl: selfieUrl,
    },
    vehiculo: {
      tipo: vTipo,
      placa: vPlaca,
      modelo: vModelo,
      color: vColor,
    },
    ciudad: d.ciudad || existing?.ciudad || 'Fusagasugá',
    departamento: d.departamento || existing?.departamento || 'Cundinamarca',
    fecha_registro: d.fecha_registro || d.createdAt || existing?.fecha_registro || new Date().toISOString(),
    tarjeta_virtual: d.tarjeta_virtual || 50000,
    deviceId: d.deviceId || existing?.deviceId || '',
  };
}

/**
 * PARTE 1.1: FUNCIÓN PARA LISTAR CONDUCTORES PENDIENTES
 * Consulta de forma robusta las colecciones 'conductores', 'drivers', 'users' y 'usuarios'
 */
export async function getPendingDrivers(): Promise<PendingDriver[]> {
  const pendingMap = new Map<string, PendingDriver>();

  // 1. Colección principal 'conductores' (siempre accesible)
  try {
    const condRef = collection(db, 'conductores');
    const snapCond = await getDocs(condRef);
    snapCond.docs.forEach((docSnap) => {
      const d = docSnap.data();
      if (isDriverPendingApproval(d)) {
        pendingMap.set(docSnap.id, mapToPendingDriver(docSnap.id, d));
      }
    });
  } catch (e) {
    console.warn('getPendingDrivers query conductores notice:', e);
  }

  // 2. Colección 'drivers' (expedientes KYC creados al registrarse)
  try {
    const driversRef = collection(db, 'drivers');
    const snapDrivers = await getDocs(driversRef);
    snapDrivers.docs.forEach((docSnap) => {
      const d = docSnap.data();
      if (isDriverPendingApproval(d)) {
        const existing = pendingMap.get(docSnap.id);
        pendingMap.set(docSnap.id, mapToPendingDriver(docSnap.id, d, existing));
      }
    });
  } catch (e) {
    console.warn('getPendingDrivers query drivers notice:', e);
  }

  // 3. Colección 'users'
  try {
    const usersRef = collection(db, 'users');
    const snapUsers = await getDocs(usersRef);
    snapUsers.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const isConductor = d.role === 'conductor' || d.rol === 'conductor';
      if (isConductor && isDriverPendingApproval(d)) {
        const existing = pendingMap.get(docSnap.id);
        pendingMap.set(docSnap.id, mapToPendingDriver(docSnap.id, d, existing));
      }
    });
  } catch (e) {
    console.warn('getPendingDrivers query users notice:', e);
  }

  // 4. Colección 'usuarios'
  try {
    const usuariosRef = collection(db, 'usuarios');
    const snapUsuarios = await getDocs(usuariosRef);
    snapUsuarios.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const isConductor = d.rol === 'conductor' || d.role === 'conductor';
      if (isConductor && isDriverPendingApproval(d)) {
        const existing = pendingMap.get(docSnap.id);
        pendingMap.set(docSnap.id, mapToPendingDriver(docSnap.id, d, existing));
      }
    });
  } catch (e) {
    console.warn('getPendingDrivers query usuarios notice:', e);
  }

  return Array.from(pendingMap.values()).sort((a, b) => {
    const tA = new Date(a.fecha_registro || 0).getTime();
    const tB = new Date(b.fecha_registro || 0).getTime();
    return tB - tA;
  });
}

/**
 * SUSCRIPCIÓN EN TIEMPO REAL:
 * Mantiene la lista de conductores pendientes sincronizada al milisegundo ante cualquier nuevo registro
 */
export function subscribePendingDrivers(
  callback: (drivers: PendingDriver[]) => void
): () => void {
  const pendingMap = new Map<string, PendingDriver>();

  const emit = () => {
    const list = Array.from(pendingMap.values()).sort((a, b) => {
      const tA = new Date(a.fecha_registro || 0).getTime();
      const tB = new Date(b.fecha_registro || 0).getTime();
      return tB - tA;
    });
    callback(list);
  };

  // 1. Escuchar 'conductores'
  const unsubConductores = onSnapshot(
    collection(db, 'conductores'),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const d = change.doc.data();
        if (change.type === 'removed') {
          pendingMap.delete(change.doc.id);
        } else {
          if (isDriverPendingApproval(d)) {
            const existing = pendingMap.get(change.doc.id);
            pendingMap.set(change.doc.id, mapToPendingDriver(change.doc.id, d, existing));
          } else {
            // Ya fue aprobado o activado
            pendingMap.delete(change.doc.id);
          }
        }
      });
      emit();
    },
    (err) => console.warn('Realtime listener conductores notice:', err)
  );

  // 2. Escuchar 'drivers'
  let unsubDrivers: (() => void) | null = null;
  try {
    unsubDrivers = onSnapshot(
      collection(db, 'drivers'),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const d = change.doc.data();
          if (change.type === 'removed') {
            // No borrar si existe en conductores
          } else {
            if (isDriverPendingApproval(d)) {
              const existing = pendingMap.get(change.doc.id);
              pendingMap.set(change.doc.id, mapToPendingDriver(change.doc.id, d, existing));
            } else if (d.aprobado === true || d.status === 'activo') {
              pendingMap.delete(change.doc.id);
            }
          }
        });
        emit();
      },
      (err) => console.warn('Realtime listener drivers notice:', err)
    );
  } catch (err) {
    console.warn('Notice listening to drivers collection:', err);
  }

  return () => {
    try {
      unsubConductores();
    } catch {}
    if (unsubDrivers) {
      try {
        unsubDrivers();
      } catch {}
    }
  };
}

/**
 * PARTE 1.2: FUNCIÓN PARA APROBAR Y ACTIVAR CONDUCTOR PREVIAMENTE
 * Sincroniza atómicamente el estado en /conductores, /drivers, /users, /usuarios y genera la notificación
 */
export async function approveDriver(userId: string, adminUid: string = 'admin_system') {
  if (!userId) throw new Error('userId es requerido para aprobar');

  const nowIso = new Date().toISOString();

  // 1. Colección principal /conductores
  try {
    const condRef = doc(db, 'conductores', userId);
    await setDoc(condRef, {
      aprobado: true,
      activo: true,
      status: 'activo',
      estado: 'activo',
      approvedAt: nowIso,
      approvedBy: adminUid,
      documentos_autorizados: {
        licencia: true,
        soat: true,
        cedula: true,
      },
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating conductores on approve:', e);
  }

  // 2. Colección /drivers (expediente KYC)
  try {
    const driverRef = doc(db, 'drivers', userId);
    await setDoc(driverRef, {
      aprobado: true,
      status: 'activo',
      estado: 'activo',
      approvedAt: nowIso,
      approvedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating drivers on approve:', e);
  }

  // 3. Colección /users
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      role: 'conductor',
      rol: 'conductor',
      status: 'activo',
      estado: 'activo',
      aprobado: true,
      approvedAt: nowIso,
      approvedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating users on approve:', e);
  }

  // 4. Colección /usuarios
  try {
    const usuarioRef = doc(db, 'usuarios', userId);
    await setDoc(usuarioRef, {
      rol: 'conductor',
      role: 'conductor',
      status: 'activo',
      estado: 'activo',
      aprobado: true,
      approvedAt: nowIso,
      approvedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating usuarios on approve:', e);
  }

  // 5. Notificación push/in-app al conductor
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: userId,
      title: '¡Tu cuenta ha sido aprobada y activada! 🎉',
      body: 'La administración ha validado tus documentos. Ya puedes recibir solicitudes de viaje y conectarte en línea.',
      type: 'driver_approved',
      createdAt: nowIso,
      leido: false,
    });
  } catch (e) {
    console.warn('Error adding notification on approve:', e);
  }

  return { success: true, message: 'Conductor validado y aprobado exitosamente' };
}

/**
 * PARTE 1.3: FUNCIÓN PARA RECHAZAR CONDUCTOR CON MOTIVO
 */
export async function rejectDriver(userId: string, reason: string, adminUid: string = 'admin_system') {
  if (!userId) throw new Error('userId es requerido para rechazar');

  const nowIso = new Date().toISOString();
  const safeReason = reason?.trim() || 'Documentación incompleta o no válida';

  // 1. Colección /conductores
  try {
    const condRef = doc(db, 'conductores', userId);
    await setDoc(condRef, {
      aprobado: false,
      activo: false,
      status: 'rechazado',
      estado: 'rechazado',
      rejectedReason: safeReason,
      rejectedAt: nowIso,
      rejectedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating conductores on reject:', e);
  }

  // 2. Colección /drivers
  try {
    const driverRef = doc(db, 'drivers', userId);
    await setDoc(driverRef, {
      aprobado: false,
      status: 'rechazado',
      estado: 'rechazado',
      rejectedReason: safeReason,
      rejectedAt: nowIso,
      rejectedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating drivers on reject:', e);
  }

  // 3. Colección /users
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      status: 'rechazado',
      estado: 'rechazado',
      aprobado: false,
      rejectedReason: safeReason,
      rejectedAt: nowIso,
      rejectedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating users on reject:', e);
  }

  // 4. Colección /usuarios
  try {
    const usuarioRef = doc(db, 'usuarios', userId);
    await setDoc(usuarioRef, {
      status: 'rechazado',
      estado: 'rechazado',
      aprobado: false,
      rejectedReason: safeReason,
      rejectedAt: nowIso,
      rejectedBy: adminUid,
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating usuarios on reject:', e);
  }

  // 5. Notificar al conductor
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: userId,
      title: 'Solicitud de Conductor no aprobada',
      body: `Motivo: ${safeReason}. Puedes comunicarte con soporte para enviar nueva documentación.`,
      type: 'driver_rejected',
      createdAt: nowIso,
      leido: false,
    });
  } catch (e) {
    console.warn('Error adding notification on reject:', e);
  }

  return { success: true };
}
