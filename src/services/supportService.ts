import { collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from './viajeService';

export interface SoporteMensaje {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
  isAdmin: boolean;
}

export interface SoporteChat {
  conductorId: string;
  conductorNombre: string;
  ultimaMensaje: string;
  ultimaFecha: any;
  leidoPorAdmin: boolean;
  leidoPorConductor: boolean;
}

export const enviarMensajeSoporte = async (
  conductorId: string,
  conductorNombre: string,
  senderId: string,
  senderName: string,
  text: string,
  isAdmin: boolean
) => {
  const chatRef = doc(db, 'soporte_chats', conductorId);
  const mensajesRef = collection(db, 'soporte_chats', conductorId, 'mensajes');

  try {
    // 1. Enviar el mensaje
    await addDoc(mensajesRef, {
      senderId,
      senderName,
      text,
      timestamp: serverTimestamp(),
      isAdmin
    });

    // 2. Actualizar el documento del chat para el listado del admin
    await setDoc(chatRef, {
      conductorId,
      conductorNombre,
      ultimaMensaje: text,
      ultimaFecha: serverTimestamp(),
      leidoPorAdmin: isAdmin,
      leidoPorConductor: !isAdmin
    }, { merge: true });

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `soporte_chats/${conductorId}/mensajes`);
  }
};

export const escucharMensajesSoporte = (conductorId: string, callback: (mensajes: SoporteMensaje[]) => void) => {
  const mensajesRef = collection(db, 'soporte_chats', conductorId, 'mensajes');
  const q = query(mensajesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const mensajes = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as SoporteMensaje[];
    callback(mensajes);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `soporte_chats/${conductorId}/mensajes`);
  });
};

export const escucharChatsSoporte = (callback: (chats: SoporteChat[]) => void) => {
  const chatsRef = collection(db, 'soporte_chats');
  const q = query(chatsRef, orderBy('ultimaFecha', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(d => ({
      ...d.data()
    })) as SoporteChat[];
    callback(chats);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'soporte_chats');
  });
};

export const marcarComoLeidoSoporte = async (conductorId: string, isAdmin: boolean) => {
  const chatRef = doc(db, 'soporte_chats', conductorId);
  try {
    const chatDoc = await getDoc(chatRef);
    if (chatDoc.exists()) {
      await updateDoc(chatRef, {
        [isAdmin ? 'leidoPorAdmin' : 'leidoPorConductor']: true
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `soporte_chats/${conductorId}`);
  }
};
