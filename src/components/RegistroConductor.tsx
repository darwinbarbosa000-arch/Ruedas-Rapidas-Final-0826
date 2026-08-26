import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, 
  Car, 
  Smartphone, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  KeyRound, 
  Clock, 
  X,
  UploadCloud,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  validateAndFormatColombianPhone,
  checkPlacaExistsInDrivers,
  checkDriverOtpRateLimit,
  verifyRecaptchaV3Score,
  checkDriverSingleAccountLimit,
  getDeviceId,
  requestOTP,
  verifyOTP,
  resetOtpRateLimit
} from '../services/authService';

interface RegistroConductorProps {
  onSuccess?: (driverData: any) => void;
  onCancel?: () => void;
}

export const RegistroConductor: React.FC<RegistroConductorProps> = ({
  onSuccess,
  onCancel
}) => {
  // Pasos del asistente: 1 = Formulario de Conductor y Documento, 2 = Verificación OTP por SMS, 3 = Confirmación / Estado Pendiente
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state
  const [nombre, setNombre] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('+573');
  const [cedula, setCedula] = useState<string>('');
  const [placa, setPlaca] = useState<string>('');
  const [tipoVehiculo, setTipoVehiculo] = useState<string>('carro');
  const [modeloVehiculo, setModeloVehiculo] = useState<string>('');
  const [ciudad, setCiudad] = useState<string>('Fusagasugá');
  const [departamento, setDepartamento] = useState<string>('Cundinamarca');
  const [fotoCedulaUrl, setFotoCedulaUrl] = useState<string>('');
  const [fotoCedulaPreview, setFotoCedulaPreview] = useState<string | null>(null);

  // OTP state
  const [otpCode, setOtpCode] = useState<string>('');

  // Estados de seguridad y proceso (Anti-dobleclic)
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [securityStatus, setSecurityStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formateador y validador de Placa en tiempo real
  const handlePlacaChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setPlaca(clean);
  };

  // Manejo de la subida de foto de la cédula
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFotoCedulaPreview(dataUrl);
      setFotoCedulaUrl(dataUrl);
      toast.success('Documento cargado correctamente');
    };
    reader.readAsDataURL(file);
  };

  /**
   * PASO 1: Envío seguro de OTP para Conductor con todas las capas de seguridad
   */
  const handleRequestDriverOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing || isSendingOtp) return; // ANTI-DOBLECLIC

    setErrorMessage(null);

    // 1. Validaciones básicas de campos
    if (!nombre.trim()) {
      toast.error('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!cedula.trim()) {
      toast.error('Por favor ingresa tu número de cédula de ciudadanía.');
      return;
    }
    if (!placa.trim() || placa.trim().length < 5) {
      toast.error('Ingresa una placa válida (ej: ABC123 o ABC12D).');
      return;
    }
    if (!fotoCedulaUrl) {
      toast.error('Por favor adjunta la foto de tu cédula para validación de seguridad.');
      return;
    }

    // 2. SOLO +57 (Rechazar teléfonos que no comiencen con +57)
    const phoneVal = validateAndFormatColombianPhone(telefono);
    if (!phoneVal.valid) {
      const errorMsg = phoneVal.error?.includes('Colombia') 
        ? "Solo números de Colombia (+57)" 
        : (phoneVal.error || "Solo números de Colombia (+57)");
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const formattedPhone = phoneVal.formattedPhone;
    const cleanDigits = phoneVal.cleanDigits;
    const deviceId = getDeviceId();

    setIsSendingOtp(true);
    setSecurityStatus('Ejecutando validaciones de seguridad...');

    try {
      // 3. ANTI-BOT (reCAPTCHA v3 invisible)
      setSecurityStatus('Analizando seguridad anti-bot (reCAPTCHA v3)...');
      const botCheck = await verifyRecaptchaV3Score('driver_register');
      if (!botCheck.success || botCheck.score < 0.5) {
        throw new Error('Verificación de seguridad fallida: Posible actividad automatizada detectada (Score reCAPTCHA < 0.5).');
      }

      // 4. VERIFICACIÓN DE PLACA (Validar que la placa no exista ya en 'drivers')
      setSecurityStatus('Verificando disponibilidad de placa vehicular...');
      const placaExists = await checkPlacaExistsInDrivers(placa);
      if (placaExists) {
        throw new Error('Esta placa ya está registrada en ItalBusiness / Ruedas Rápidas.');
      }

      // 5. LÍMITE DISPOSITIVO (1 teléfono = máximo 1 cuenta de conductor activa)
      setSecurityStatus('Validando límite de 1 cuenta de conductor por equipo...');
      await checkDriverSingleAccountLimit(formattedPhone, deviceId);

      // 6. RATE LIMIT (3 solicitudes de OTP en 10 min -> bloquear 30 min en 'otp_attempts/{phone}')
      setSecurityStatus('Comprobando límites de envío de SMS...');
      await checkDriverOtpRateLimit(formattedPhone, cleanDigits);

      // 7. Enviar OTP por SMS
      setSecurityStatus('Enviando código de verificación SMS...');
      await requestOTP(formattedPhone, 'driver-recaptcha-container', { isRegistration: false });

      toast.success('¡Código de verificación enviado al ' + formattedPhone + '!');
      setStep(2); // Pasar a verificación de código
    } catch (error: any) {
      console.error('Error en pre-validación de conductor:', error);
      const msg = error.message || 'Error al procesar el registro.';
      setErrorMessage(msg);

      const isBlocked = msg.includes('bloqueado') || msg.includes('demasiados intentos') || msg.includes('espera');
      if (isBlocked && telefono.trim()) {
        toast.error(msg, {
          action: {
            label: "Desbloquear (Pruebas)",
            onClick: async () => {
              const val = validateAndFormatColombianPhone(telefono.trim());
              await resetOtpRateLimit(val.valid ? val.formattedPhone : telefono.trim());
              setErrorMessage(null);
              toast.success("Límite de intentos restablecido. Puedes volver a intentar.");
            }
          },
          duration: 12000
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSendingOtp(false);
      setSecurityStatus('');
    }
  };

  /**
   * PASO 2: Confirmación del OTP y Guardado Seguro en Firestore
   */
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return; // ANTI-DOBLECLIC

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      toast.error('Ingresa los 6 dígitos del código recibido.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setSecurityStatus('Verificando código de seguridad...');

    try {
      const phoneVal = validateAndFormatColombianPhone(telefono);
      const formattedPhone = phoneVal.valid ? phoneVal.formattedPhone : telefono;
      const deviceId = getDeviceId();

      // 1. Validar OTP en Firebase Auth
      const verifiedUser = await verifyOTP(otpCode.trim(), null, formattedPhone);
      const uid = verifiedUser.uid;

      setSecurityStatus('Guardando expediente de conductor en Firestore...');
      const nowIso = new Date().toISOString();

      // 2. ESTADO PENDIENTE EN 'users/{uid}'
      await setDoc(doc(db, 'users', uid), {
        uid,
        name: nombre.trim(),
        nombre: nombre.trim(),
        phone: formattedPhone,
        telefono: formattedPhone,
        role: 'conductor',
        rol: 'conductor',
        status: 'pending',
        estado: 'pending',
        aprobado: false,
        deviceId: deviceId,
        cedula: cedula.trim(),
        placa: placa.toUpperCase().trim(),
        createdAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });

      // 3. CREAR DOC DRIVER EN 'drivers/{uid}'
      await setDoc(doc(db, 'drivers', uid), {
        uid,
        nombre: nombre.trim(),
        telefono: formattedPhone,
        celular: formattedPhone,
        cedula: cedula.trim(),
        placa: placa.toUpperCase().trim(),
        fotoCedulaUrl: fotoCedulaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
        createdAt: nowIso,
        status: 'pending',
        aprobado: false,
        deviceId: deviceId,
        vehiculoTipo: tipoVehiculo,
        vehiculoModelo: modeloVehiculo || 'Estándar',
        ciudad: ciudad.trim(),
        departamento: departamento.trim(),
        updatedAt: nowIso
      }, { merge: true });

      // 4. Sincronización transparente con colecciones del ecosistema ('conductores' y 'usuarios')
      await setDoc(doc(db, 'conductores', uid), {
        userId: uid,
        id: uid,
        nombre: nombre.trim(),
        telefono: formattedPhone,
        celular: formattedPhone,
        cedula: cedula.trim(),
        tarjeta_virtual: 50000,
        activo: false,
        modo_repartidor: false,
        aprobado: false,
        status: 'pending',
        calificacion: 5.0,
        total_calificaciones: 0,
        servicios_completados: 0,
        ciudad: ciudad.trim(),
        departamento: departamento.trim(),
        vehiculo: {
          tipo: tipoVehiculo,
          placa: placa.toUpperCase().trim(),
          modelo: modeloVehiculo || 'Estándar'
        },
        documentos_autorizados: {
          licencia: false,
          soat: false,
          cedula: true
        },
        fotoCedulaUrl: fotoCedulaUrl || '',
        deviceId: deviceId,
        fecha_registro: nowIso
      }, { merge: true });

      await setDoc(doc(db, 'usuarios', uid), {
        nombre: nombre.trim(),
        telefono: formattedPhone,
        celular: formattedPhone,
        cedula: cedula.trim(),
        ciudad: ciudad.trim(),
        departamento: departamento.trim(),
        saldo: 0,
        saldo_promo: 10000,
        rol: 'conductor',
        status: 'pending',
        terminos_aceptados: true,
        fecha_aceptacion_terminos: nowIso
      }, { merge: true });

      toast.success('¡Registro de Conductor completado exitosamente!');
      setStep(3); // Mostrar confirmación de estado pendiente

      if (onSuccess) {
        onSuccess({
          uid,
          nombre,
          telefono: formattedPhone,
          placa,
          status: 'pending'
        });
      }
    } catch (error: any) {
      console.error('Error al verificar OTP o registrar conductor:', error);
      const msg = error.message || 'Código incorrecto o error al crear expediente.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      setSecurityStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      {/* Contenedor invisible para reCAPTCHA v3 */}
      <div id="driver-recaptcha-container" className="hidden" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-800 text-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden my-auto"
      >
        {/* Glow ambient de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        {/* Botón Cerrar */}
        {onCancel && (
          <button
            onClick={onCancel}
            type="button"
            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer z-20"
          >
            <X size={18} />
          </button>
        )}

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Car size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Seguridad Blindada
              </span>
              <span className="text-[10px] font-bold text-slate-400">Paso {step} de 3</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Registro de Conductor
            </h2>
          </div>
        </div>

        {/* Alerta de Error si ocurre */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-2xl text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estado de Seguridad en progreso */}
        {securityStatus && (
          <div className="mb-4 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-2xl text-indigo-300 text-xs flex items-center gap-2 animate-pulse">
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span>{securityStatus}</span>
          </div>
        )}

        {/* PASO 1: Formulario Conductor */}
        {step === 1 && (
          <form onSubmit={handleRequestDriverOtp} className="space-y-4 relative z-10">
            {/* Nombre Completo */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Carlos Mario Rodríguez"
                disabled={isSendingOtp}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-2xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            {/* Cédula y Teléfono Celular (+57) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                  Cédula de Ciudadanía *
                </label>
                <input
                  type="text"
                  required
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej. 11379008"
                  disabled={isSendingOtp}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-2xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                  Teléfono Celular (+57) *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-emerald-400 pointer-events-none">
                    🇨🇴 +57
                  </span>
                  <input
                    type="tel"
                    required
                    value={telefono.replace(/^\+57/, '')}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setTelefono(`+57${digits}`);
                    }}
                    placeholder="300 123 4567"
                    disabled={isSendingOtp}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-2xl py-3 pl-16 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none font-mono tracking-wider transition-all"
                  />
                </div>
                <span className="text-[9px] text-slate-400 px-1 mt-1 block">
                  Solo números de Colombia (+57). Máx 1 cuenta por equipo.
                </span>
              </div>
            </div>

            {/* Placa y Tipo de Vehículo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                  Placa del Vehículo *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={placa}
                    onChange={(e) => handlePlacaChange(e.target.value)}
                    placeholder="ABC123"
                    disabled={isSendingOtp}
                    maxLength={6}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-2xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none font-mono font-black tracking-widest uppercase transition-all"
                  />
                  <span className="absolute right-3.5 top-3.5 text-[10px] font-black text-slate-400">
                    {placa.length}/6
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 px-1 mt-1 block">
                  Validación de placa única en el sistema
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                  Tipo de Vehículo *
                </label>
                <select
                  value={tipoVehiculo}
                  onChange={(e) => setTipoVehiculo(e.target.value)}
                  disabled={isSendingOtp}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none transition-all"
                >
                  <option value="carro">🚗 Carro Particular</option>
                  <option value="moto">🏍️ Moto</option>
                  <option value="taxi">🚕 Taxi</option>
                  <option value="camion_flete">🚚 Camión Flete</option>
                  <option value="camion_acarreo">🚛 Camión Acarreo</option>
                  <option value="motocarro">🛺 Motocarro</option>
                </select>
              </div>
            </div>

            {/* Ciudad y Departamento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  disabled={isSendingOtp}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                  Departamento
                </label>
                <input
                  type="text"
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  disabled={isSendingOtp}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Foto de la Cédula (Obligatorio para verificación KYC) */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 px-1">
                Foto de la Cédula de Ciudadanía *
              </label>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {fotoCedulaPreview ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-800 p-2 flex items-center gap-3">
                  <img
                    src={fotoCedulaPreview}
                    alt="Cédula Preview"
                    className="w-16 h-12 object-cover rounded-xl border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-emerald-300 flex items-center gap-1">
                      <FileCheck size={14} /> Documento Adjuntado
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">Listo para validación KYC</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-slate-300 hover:text-white bg-white/10 px-3 py-1.5 rounded-xl mr-1"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSendingOtp}
                  className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-400 bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-300 transition-all cursor-pointer"
                >
                  <UploadCloud size={24} className="text-emerald-400" />
                  <span className="text-xs font-bold">Toca para subir foto de tu Cédula</span>
                  <span className="text-[9px] text-slate-500">Formato JPG, PNG (Máx 5MB)</span>
                </button>
              )}
            </div>

            {/* Resumen de Blindaje de Seguridad */}
            <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck size={14} />
                <span>Protocolo de Protección Conductor:</span>
              </div>
              <p>• Rate limit: 3 solicitudes en 10 min (bloqueo 30 min por seguridad).</p>
              <p>• Análisis anti-bot invisible y verificación de placa única.</p>
            </div>

            {/* BOTÓN ENVIAR CÓDIGO (Anti-dobleclic) */}
            <button
              type="submit"
              disabled={isSendingOtp || isProcessing}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-2 transition-all ${
                isSendingOtp || isProcessing
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] cursor-pointer shadow-emerald-900/30'
              }`}
            >
              {isSendingOtp ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Validando y Enviando SMS...</span>
                </>
              ) : (
                <>
                  <Smartphone size={16} />
                  <span>Validar y Recibir Código SMS</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* PASO 2: Verificación de Código OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtpAndRegister} className="space-y-5 relative z-10">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-center space-y-1">
              <KeyRound size={28} className="mx-auto text-emerald-400 mb-1" />
              <h3 className="text-sm font-black text-white uppercase">Verificación de Celular</h3>
              <p className="text-xs text-slate-300">
                Hemos enviado un código SMS de 6 dígitos al:
              </p>
              <p className="text-sm font-mono font-black text-emerald-400">{telefono}</p>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                Ingresa el Código de 6 Dígitos
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                disabled={isProcessing}
                className="w-full bg-slate-800 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-2xl py-4 text-center text-2xl font-mono font-black text-white tracking-[0.4em] placeholder-slate-600 focus:outline-none transition-all"
                autoFocus
              />
              <span className="text-[10px] text-slate-400 text-center block mt-1.5">
                Código de un solo uso para autorizar la creación de cuenta
              </span>
            </div>

            {/* BOTÓN REGISTRARSE (Anti-dobleclic) */}
            <div className="space-y-2">
              <button
                type="submit"
                disabled={isProcessing || otpCode.length < 6}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-2 transition-all ${
                  isProcessing || otpCode.length < 6
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.98] cursor-pointer shadow-emerald-900/30'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creando Expediente Seguro...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Registrarse y Enviar Expediente</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isProcessing}
                className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-bold transition-all"
              >
                ← Corregir Datos o Teléfono
              </button>
            </div>
          </form>
        )}

        {/* PASO 3: Estado Pendiente y Confirmación */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-5 py-3 relative z-10"
          >
            <div className="w-20 h-20 bg-amber-500/20 border border-amber-500/30 rounded-3xl flex items-center justify-center text-amber-400 mx-auto shadow-inner">
              <Clock size={40} className="animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                ESTADO: PENDIENTE DE REVISIÓN
              </span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                ¡Expediente de Conductor Creado!
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                Tu perfil ha sido registrado con estado <strong>pending</strong> en la base de datos de ItalBusiness / Ruedas Rápidas.
              </p>
            </div>

            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-700 pb-1.5">
                <span className="text-slate-400">Conductor:</span>
                <span className="font-bold text-white">{nombre}</span>
              </div>
              <div className="flex justify-between border-b border-slate-700 pb-1.5">
                <span className="text-slate-400">Placa Registrada:</span>
                <span className="font-mono font-bold text-emerald-400">{placa.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-700 pb-1.5">
                <span className="text-slate-400">Teléfono:</span>
                <span className="font-mono text-white">{telefono}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Acceso a Carreras:</span>
                <span className="font-bold text-amber-400">Bloqueado hasta aprobación</span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-200 leading-relaxed">
              🛡️ <strong>Seguridad ItalBusiness:</strong> Un administrador validará tu cédula y placa para activar tu cuenta. Te notificaremos cuando esté aprobada.
            </div>

            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
              }}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              Entendido / Ir al Panel Principal
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default RegistroConductor;
