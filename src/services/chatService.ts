import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Mensaje {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
}

export function enviarMensaje(viajeId: string, senderId: string, senderName: string, text: string) {
  const mensajesRef = collection(db, 'viajes', viajeId, 'mensajes');
  return addDoc(mensajesRef, {
    senderId,
    senderName,
    text,
    timestamp: serverTimestamp()
  });
}

export function escucharMensajes(viajeId: string, callback: (mensajes: Mensaje[]) => void) {
  const mensajesRef = collection(db, 'viajes', viajeId, 'mensajes');
  const q = query(mensajesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const mensajes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Mensaje[];
    callback(mensajes);
  }, (error) => {
    console.error("Error escuchando mensajes:", error);
  });
}
