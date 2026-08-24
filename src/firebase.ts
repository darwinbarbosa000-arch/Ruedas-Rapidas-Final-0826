import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration
// @ts-ignore
import firebaseConfigData from '../firebase-applet-config.json';
const firebaseConfig = firebaseConfigData as any;

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  // @ts-ignore
  useFetchStreams: false,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// VARIABLE GLOBAL PARA EL RECAPTCHA
export let recaptchaVerifier: RecaptchaVerifier | null = null;

// FUNCIÓN PARA CREAR O REUTILIZAR EL RECAPTCHA VERIFIER (v2 Normal / Checkbox)
export const setupRecaptcha = (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
  if (typeof window === 'undefined') {
    throw new Error('RecaptchaVerifier solo puede ejecutarse en el navegador.');
  }

  // Asegurar que el contenedor DOM exista para evitar excepciones de reCAPTCHA
  let containerElem = document.getElementById(containerId);
  if (!containerElem) {
    containerElem = document.createElement('div');
    containerElem.id = containerId;
    containerElem.style.position = 'fixed';
    containerElem.style.bottom = '0';
    containerElem.style.left = '0';
    containerElem.style.width = '1px';
    containerElem.style.height = '1px';
    containerElem.style.opacity = '0';
    containerElem.style.pointerEvents = 'none';
    containerElem.style.zIndex = '-9999';
    document.body.appendChild(containerElem);
  }

  // Limpiar instancia previa si existe para evitar conflictos de renderizado en React
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Si ya fue limpiado o destruido
    }
    recaptchaVerifier = null;
  }

  try {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerElem, {
      size: 'invisible',
      callback: (response: any) => {
        console.log('reCAPTCHA verificado con éxito:', response);
      },
      'expired-callback': () => {
        console.warn('El reCAPTCHA ha expirado. Por favor resuélvelo de nuevo.');
      }
    });
  } catch (err) {
    console.warn('Error inicializando RecaptchaVerifier con elemento directo:', err);
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {}
    });
  }

  return recaptchaVerifier;
};

// Test connection
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore connection failed: The client is offline. Please check your connection.");
    } else {
      console.error("Firestore connection test error:", error);
    }
  }
}
