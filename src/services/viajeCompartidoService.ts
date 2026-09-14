import { doc, setDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getSyncedISOString } from './clockService';

export interface ViajeCompartidoData {
  id: string;
  viaje_id: string;
  pasajero_id: string;
  pasajero_nombre: string;
  conductor_id: string;
  conductor_nombre: string;
  conductor_placa: string;
  conductor_vehiculo?: any;
  origen: string;
  destino: string;
  origen_coords?: { lat: number; lng: number } | null;
  destino_coords?: { lat: number; lng: number } | null;
  estado: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  finalizado_at?: string;
  link?: string;
}

/**
 * Registra el viaje compartido en la base de datos y abre WhatsApp con el link seguro.
 */
export async function compartirViajeSeguro(
  viaje: any,
  user: any,
  perfil?: any
): Promise<{ officialLink: string; previewLink: string; message: string }> {
  if (!viaje || !viaje.id) {
    throw new Error('ID de viaje no válido');
  }

  const viajeId = viaje.id;
  const officialLink = `https://ruedasrapidasviajaseguro.com/?viaje_seguro=${viajeId}`;
  
  // Link para pruebas en el entorno actual (dev/preview)
  let previewLink = officialLink;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    previewLink = `${window.location.origin}/?viaje_seguro=${viajeId}`;
  }

  // Mensaje oficial obligatorio para WhatsApp
  const message = `Hola, estoy en un servicio de Ruedas Rápidas, sigue mi ruta en tiempo real y segura: ${officialLink}`;

  try {
    const shareDocRef = doc(db, 'viajes_compartidos', viajeId);
    await setDoc(
      shareDocRef,
      {
        id: viajeId,
        viaje_id: viajeId,
        pasajero_id: user?.uid || viaje.usuarioId || '',
        pasajero_nombre: perfil?.nombre || user?.displayName || viaje.usuarioNombre || 'Pasajero',
        conductor_id: viaje.conductorId || '',
        conductor_nombre: viaje.conductorNombre || 'Conductor Asignado',
        conductor_placa: viaje.conductorPlaca || '',
        conductor_vehiculo: viaje.conductorVehiculo || null,
        origen: viaje.origen || viaje.ruta?.origen || 'Punto de recogida',
        destino: viaje.destino || viaje.ruta?.destino || 'Punto de entrega',
        origen_coords: viaje.origenCoords || viaje.origenCoordenadas || viaje.ruta?.origenCoords || null,
        destino_coords: viaje.destinoCoords || viaje.destinoCoordenadas || viaje.ruta?.destinoCoords || null,
        estado: viaje.estado || 'en_curso',
        activo: viaje.estado !== 'finalizado' && viaje.estado !== 'cancelado',
        link: officialLink,
        updated_at: getSyncedISOString(),
        created_at: getSyncedISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[viajeCompartidoService] Error al registrar en viajes_compartidos:', error);
  }

  // Abrir WhatsApp de inmediato con el mensaje predefinido
  if (typeof window !== 'undefined') {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  return {
    officialLink,
    previewLink,
    message,
  };
}

/**
 * Actualiza el viaje compartido como inactivo cuando el viaje principal finaliza.
 */
export async function marcarViajeCompartidoFinalizado(viajeId: string): Promise<void> {
  if (!viajeId) return;
  try {
    const shareDocRef = doc(db, 'viajes_compartidos', viajeId);
    await updateDoc(shareDocRef, {
      activo: false,
      estado: 'finalizado',
      finalizado_at: getSyncedISOString(),
      updated_at: getSyncedISOString(),
    });
  } catch (error) {
    console.warn('[viajeCompartidoService] Error al actualizar viaje finalizado:', error);
  }
}
