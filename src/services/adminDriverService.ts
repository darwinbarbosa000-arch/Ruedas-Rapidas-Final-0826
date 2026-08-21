import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  addDoc, 
  query, 
  where 
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
  driverDocuments?: DriverDocuments;
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
}

/**
 * PARTE 1.1: FUNCIÓN PARA LISTAR CONDUCTORES PENDIENTES
 * Consulta la colección 'users', 'usuarios' y 'conductores' para recopilar solicitudes con documentos
 */
export async function getPendingDrivers(): Promise<PendingDriver[]> {
  const pendingMap = new Map<string, PendingDriver>();

  try {
    // 1. Consultar colección 'users'
    try {
      const usersRef = collection(db, 'users');
      const qUsers = query(usersRef, where('status', '==', 'pendiente'));
      const snapUsers = await getDocs(qUsers);
      
      snapUsers.docs.forEach(docSnap => {
        const d = docSnap.data();
        pendingMap.set(docSnap.id, {
          id: docSnap.id,
          name: d.name || d.nombre || 'Sin nombre',
          nombre: d.nombre || d.name || 'Sin nombre',
          email: d.email || '',
          telefono: d.telefono || d.celular || d.phone || '',
          cedula: d.cedula || d.documento || 'No registrada',
          role: d.role || d.rol || 'usuario',
          status: d.status || 'pendiente',
          driverDocuments: d.driverDocuments || d.documentos || {
            cedulaUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
            licenciaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
            tarjetaUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400',
            selfieUrl: d.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'
          },
          vehiculo: d.vehiculo || {},
          ciudad: d.ciudad || '',
          departamento: d.departamento || '',
          fecha_registro: d.createdAt || d.fecha_registro || new Date().toISOString()
        });
      });
    } catch (e) {
      console.warn('getPendingDrivers query users:', e);
    }

    // 2. Consultar colección 'conductores' donde aprobado == false o status == 'pendiente'
    try {
      const condRef = collection(db, 'conductores');
      const snapCond = await getDocs(condRef);
      
      snapCond.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.aprobado === false || d.status === 'pendiente' || !pendingMap.has(docSnap.id)) {
          // Si no está aprobado aún
          if (d.aprobado !== true && d.status !== 'activo') {
            const existing = pendingMap.get(docSnap.id);
            pendingMap.set(docSnap.id, {
              id: docSnap.id,
              name: existing?.name || d.nombre || d.name || 'Conductor Pendiente',
              nombre: d.nombre || existing?.nombre || 'Conductor Pendiente',
              email: d.email || existing?.email || '',
              telefono: d.telefono || d.celular || existing?.telefono || '',
              cedula: d.cedula || existing?.cedula || 'No registrada',
              role: existing?.role || d.role || 'usuario',
              status: d.status || 'pendiente',
              driverDocuments: d.driverDocuments || d.documentos || existing?.driverDocuments || {
                cedulaUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
                licenciaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
                tarjetaUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400',
                selfieUrl: d.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'
              },
              vehiculo: d.vehiculo || existing?.vehiculo || {},
              ciudad: d.ciudad || existing?.ciudad || '',
              departamento: d.departamento || existing?.departamento || '',
              fecha_registro: d.fecha_registro || existing?.fecha_registro || new Date().toISOString()
            });
          }
        }
      });
    } catch (e) {
      console.warn('getPendingDrivers query conductores:', e);
    }

    // Convertir mapa a array
    return Array.from(pendingMap.values());
  } catch (error) {
    console.error('Error fetching pending drivers:', error);
    return Array.from(pendingMap.values());
  }
}

/**
 * PARTE 1.2: FUNCIÓN PARA APROBAR CONDUCTOR
 */
export async function approveDriver(userId: string, adminUid: string = 'admin_system') {
  if (!userId) throw new Error('userId es requerido para aprobar');

  const nowIso = new Date().toISOString();

  // 1. Actualizar colección /users
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      role: 'conductor',
      status: 'activo',
      approvedAt: nowIso,
      approvedBy: adminUid
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating users collection on approve:', e);
  }

  // 2. Actualizar colección /usuarios
  try {
    const usuarioRef = doc(db, 'usuarios', userId);
    await setDoc(usuarioRef, {
      rol: 'conductor',
      status: 'activo',
      approvedAt: nowIso,
      approvedBy: adminUid
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating usuarios collection on approve:', e);
  }

  // 3. Actualizar colección /conductores
  try {
    const condRef = doc(db, 'conductores', userId);
    await setDoc(condRef, {
      aprobado: true,
      activo: true,
      status: 'activo',
      approvedAt: nowIso,
      approvedBy: adminUid
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating conductores collection on approve:', e);
  }

  // 4. Notificar al conductor en /notifications
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: userId,
      title: '¡Cuenta aprobada!',
      body: 'Ya puedes empezar a recibir y ofertar viajes',
      type: 'driver_approved',
      createdAt: nowIso,
      leido: false
    });
  } catch (e) {
    console.warn('Error adding notification on approve:', e);
  }

  return { success: true, message: 'Conductor activado' };
}

/**
 * PARTE 1.3: FUNCIÓN PARA RECHAZAR CONDUCTOR
 */
export async function rejectDriver(userId: string, reason: string) {
  if (!userId) throw new Error('userId es requerido para rechazar');

  const nowIso = new Date().toISOString();

  // 1. Actualizar /users
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      status: 'rechazado',
      rejectedReason: reason || 'Documentación incompleta o no válida'
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating users collection on reject:', e);
  }

  // 2. Actualizar /usuarios
  try {
    const usuarioRef = doc(db, 'usuarios', userId);
    await setDoc(usuarioRef, {
      status: 'rechazado',
      rejectedReason: reason || 'Documentación incompleta o no válida'
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating usuarios collection on reject:', e);
  }

  // 3. Actualizar /conductores
  try {
    const condRef = doc(db, 'conductores', userId);
    await setDoc(condRef, {
      aprobado: false,
      status: 'rechazado',
      rejectedReason: reason || 'Documentación incompleta o no válida'
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating conductores collection on reject:', e);
  }

  // 4. Notificar al conductor en /notifications
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: userId,
      title: 'Solicitud rechazada',
      body: `Tu solicitud de conductor ha sido rechazada: ${reason}`,
      type: 'driver_rejected',
      createdAt: nowIso,
      leido: false
    });
  } catch (e) {
    console.warn('Error adding notification on reject:', e);
  }

  return { success: true };
}
