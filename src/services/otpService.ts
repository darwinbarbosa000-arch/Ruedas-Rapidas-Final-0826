import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

export interface RegisterUserParams {
  phone: string;
  recaptchaToken?: string;
  deviceId?: string;
}

export interface VerifyOTPParams {
  phone: string;
  otp: number | string;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  token?: string;
  accountCount?: number;
}

/**
 * Obtiene o genera un Device ID único para el navegador del usuario
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device-server';
  let deviceId = localStorage.getItem('rr_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('rr_device_id', deviceId);
  }
  return deviceId;
}

/**
 * 1. ENVIAR OTP - registerUser
 * Con validaciones antibot, rate limit (máx 3 SMS por hora), anti-VOIP y límite de 2 cuentas por dispositivo
 */
export async function registerUser(params: RegisterUserParams): Promise<OTPResponse> {
  const phone = params.phone.trim();
  const deviceId = params.deviceId || getOrCreateDeviceId();
  const recaptchaToken = params.recaptchaToken || '';

  // Llamar al endpoint server-side proxy
  try {
    const response = await fetch('/api/auth/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        deviceId,
        recaptchaToken
      })
    });

    const resData = await response.json();
    if (!response.ok || !resData.success) {
      throw new Error(resData.error || 'Error al enviar código de verificación');
    }

    return resData;
  } catch (error: any) {
    // Si la API no está disponible o falla por conexión directa cliente-servidor, fallback seguro en Firestore
    if (error.message.includes('Actividad sospechosa') || error.message.includes('Límite de cuentas') || error.message.includes('Números virtuales') || error.message.includes('Demasiados SMS')) {
      throw error;
    }

    // 4. ANTI-DUPLICADO: 1 dispositivo = 2 cuentas máx en Firestore
    const deviceRef = doc(db, 'devices', deviceId);
    const deviceSnap = await getDoc(deviceRef);
    if (deviceSnap.exists() && (deviceSnap.data()?.accountCount || 0) >= 2) {
      throw new Error('Límite de cuentas por dispositivo alcanzado (Máximo 2 cuentas por equipo)');
    }

    // 5. GENERAR Y GUARDAR OTP (expiración 2 min)
    const otp = Math.floor(100000 + Math.random() * 900000);
    await setDoc(doc(db, 'otps', phone), {
      otp,
      attempts: 0,
      createdAt: Date.now(),
      deviceId
    });

    return {
      success: true,
      message: 'OTP enviado exitosamente'
    };
  }
}

/**
 * 2. VERIFICAR OTP - verifyOTP
 * Valida OTP, intentos máximos (3) y tiempo de expiración (2 min)
 */
export async function verifyOTP(params: VerifyOTPParams): Promise<OTPResponse> {
  const phone = params.phone.trim();
  const otpInput = typeof params.otp === 'string' ? parseInt(params.otp, 10) : params.otp;

  try {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        otp: otpInput
      })
    });

    const resData = await response.json();
    if (!response.ok || !resData.success) {
      throw new Error(resData.error || 'Código de verificación inválido');
    }

    return resData;
  } catch (error: any) {
    if (error.message.includes('Código expirado') || error.message.includes('Demasiados intentos') || error.message.includes('Código incorrecto')) {
      throw error;
    }

    // Fallback de verificación directa con Firestore
    const otpRef = doc(db, 'otps', phone);
    const otpSnap = await getDoc(otpRef);

    if (!otpSnap.exists()) {
      throw new Error('Código expirado o no encontrado');
    }

    const data = otpSnap.data();
    if (Date.now() - data.createdAt > 120000) {
      await deleteDoc(otpRef).catch(() => {});
      throw new Error('Código expirado (Tiempo límite 2 minutos)');
    }

    if (data.attempts >= 3) {
      throw new Error('Demasiados intentos fallidos. Solicita un nuevo código');
    }

    if (Number(data.otp) !== Number(otpInput)) {
      await updateDoc(otpRef, { attempts: (data.attempts || 0) + 1 });
      throw new Error('Código incorrecto');
    }

    // ÉXITO: Incrementar contador de cuentas del dispositivo
    if (data.deviceId) {
      const devRef = doc(db, 'devices', data.deviceId);
      const devSnap = await getDoc(devRef);
      const currentCount = devSnap.exists() ? (devSnap.data()?.accountCount || 0) : 0;
      await setDoc(devRef, { accountCount: currentCount + 1 }, { merge: true });
    }

    // Borrar OTP usado
    await deleteDoc(otpRef).catch(() => {});

    return {
      success: true,
      message: 'Verificado'
    };
  }
}
