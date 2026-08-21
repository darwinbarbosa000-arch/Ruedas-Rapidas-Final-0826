import express, { Request, Response } from 'express';
import path from 'path';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json());

// -------------------------------------------------------------
// 1. RATE LIMIT GENERAL: Máximo 60 requests por usuario cada 1 minuto
// -------------------------------------------------------------
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 peticiones por ventana
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Usar identificador de usuario si está presente en headers o la IP normalizada para IPv6
    const userId = req.headers['x-user-id'] as string;
    return userId || ipKeyGenerator(req.ip || '127.0.0.1');
  },
  message: {
    success: false,
    error: 'Límite de solicitudes superado (Máximo 60 peticiones por minuto). Por favor espere un momento.'
  }
});

// Aplicar Rate Limit General a todas las rutas de la API (/api/*)
app.use('/api/', generalLimiter);

// -------------------------------------------------------------
// 2. RATE LIMIT REGISTRO CONDUCTOR: Máximo 3 registros por IP cada 10 minutos
// -------------------------------------------------------------
const driverRegisterLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 3, // máximo 3 peticiones por IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip || '127.0.0.1'),
  message: {
    success: false,
    error: 'Límite de registros excedido. Se permite un máximo de 3 intentos de registro por IP cada 10 minutos.'
  }
});

// Helper para normalizar cadenas
const normalizeStr = (str: string) =>
  str
    ? str
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    : '';

// -------------------------------------------------------------
// FUNCIÓN DE VALIDACIÓN DE CONDUCTOR
// -------------------------------------------------------------
function validateDriverData(body: any) {
  const phone = body.phone || body.telefono || body.celular || '';
  const city = body.city || body.ciudad || '';
  const vehicleType = body.vehicle_type || body.vehiculo_tipo || (body.vehiculo && body.vehiculo.tipo) || '';

  // 1. Validar Teléfono: Debe empezar con +57 y tener 12 dígitos en total (+573001234567)
  const cleanPhone = String(phone).trim();
  const phoneRegex = /^\+57\d{9}$/;
  if (!cleanPhone || !phoneRegex.test(cleanPhone) || cleanPhone.length !== 12) {
    return {
      isValid: false,
      error: 'El teléfono debe iniciar con +57 y tener exactamente 12 caracteres (ej: +573001234567).'
    };
  }

  // 2. Validar Ciudad: Debe estar en ["Yopal", "Bogota", "Medellin"]
  const normalizedCity = normalizeStr(city);
  const allowedCities = ['yopal', 'bogota', 'medellin'];
  if (!normalizedCity || !allowedCities.includes(normalizedCity)) {
    return {
      isValid: false,
      error: 'La ciudad de registro debe ser únicamente una de las siguientes: Yopal, Bogota o Medellin.'
    };
  }

  // 3. Validar Tipo de Vehículo: Debe estar en ["moto", "carro", "taxi"]
  const normalizedVehicle = normalizeStr(vehicleType);
  const allowedVehicles = ['moto', 'carro', 'taxi'];
  if (!normalizedVehicle || !allowedVehicles.includes(normalizedVehicle)) {
    return {
      isValid: false,
      error: 'El tipo de vehículo debe ser únicamente uno de los siguientes: moto, carro o taxi.'
    };
  }

  return { isValid: true, error: null };
}

// -------------------------------------------------------------
// ENDPOINT: REGISTRO CONDUCTOR (/api/register-driver y /api/conductores/registro)
// -------------------------------------------------------------
const handleDriverRegister = (req: Request, res: Response) => {
  const validation = validateDriverData(req.body);

  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      error: validation.error
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Validación de registro de conductor exitosa.',
    validatedData: {
      phone: req.body.phone || req.body.telefono || req.body.celular,
      city: req.body.city || req.body.ciudad,
      vehicle_type: req.body.vehicle_type || req.body.vehiculo_tipo || (req.body.vehiculo && req.body.vehiculo.tipo)
    }
  });
};

app.post('/api/register-driver', driverRegisterLimiter, handleDriverRegister);
app.post('/api/conductores/registro', driverRegisterLimiter, handleDriverRegister);

// -------------------------------------------------------------
// OTP & DEVICE TRACKING (Twilio / Antibot / Rate Limiting)
// -------------------------------------------------------------
const smsDeviceTracker = new Map<string, number[]>();
const deviceAccountTracker = new Map<string, number>();
const activeOtps = new Map<string, { otp: number; attempts: number; createdAt: number; deviceId: string }>();

// ===== ENDPOINT 1: ENVIAR OTP - registerUser =====
app.post('/api/auth/register-user', async (req: Request, res: Response) => {
  try {
    const { phone, recaptchaToken, deviceId } = req.body;

    if (!phone || !deviceId) {
      res.status(400).json({ success: false, error: 'Teléfono y Device ID son requeridos.' });
      return;
    }

    // 1. ANTIBOT: Validar reCAPTCHA v3 (si está configurado)
    if (process.env.RECAPTCHA_SECRET && recaptchaToken) {
      try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`;
        const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
        const recaptchaData = await recaptchaRes.json();
        if (!recaptchaData.success || (recaptchaData.score !== undefined && recaptchaData.score < 0.7)) {
          res.status(403).json({ success: false, error: 'Actividad sospechosa detectada (Anti-Bot).' });
          return;
        }
      } catch (err) {
        console.error('Error validando reCAPTCHA:', err);
      }
    }

    // 2. RATE LIMIT: Máximo 3 SMS por dispositivo cada hora
    const now = Date.now();
    const ONE_HOUR = 3600 * 1000;
    const deviceHistory = (smsDeviceTracker.get(String(deviceId)) || []).filter(ts => (now - ts) < ONE_HOUR);
    if (deviceHistory.length >= 3) {
      res.status(429).json({ success: false, error: 'Demasiados SMS solicitados. Máximo 3 por hora por dispositivo.' });
      return;
    }
    deviceHistory.push(now);
    smsDeviceTracker.set(String(deviceId), deviceHistory);

    // 3. ANTI-DUPLICADO: 1 dispositivo = 2 cuentas máx
    const count = deviceAccountTracker.get(String(deviceId)) || 0;
    if (count >= 2) {
      res.status(429).json({ success: false, error: 'Límite de cuentas alcanzado (Máximo 2 cuentas por dispositivo).' });
      return;
    }

    // 4. GENERAR OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Si Twilio está configurado en variables de entorno, enviar SMS real
    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_PHONE) {
      try {
        const twilioAuth = Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', phone);
        params.append('From', process.env.TWILIO_PHONE);
        params.append('Body', `Tu código Ruedas Rápidas es: ${otp}. Válido por 2 min. No lo compartas.`);

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
      } catch (twErr) {
        console.error('Error enviando SMS con Twilio:', twErr);
      }
    }

    // Guardar OTP en memoria (2 minutos de vigencia)
    activeOtps.set(phone, {
      otp,
      attempts: 0,
      createdAt: now,
      deviceId
    });

    console.log(`[AUTH OTP] Teléfono: ${phone} | OTP: ${otp} | Device: ${deviceId}`);

    res.status(200).json({
      success: true,
      message: 'OTP enviado'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error al procesar OTP.' });
  }
});

// ===== ENDPOINT 2: VERIFICAR OTP - verifyOTP =====
app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      res.status(400).json({ success: false, error: 'Teléfono y código OTP son requeridos.' });
      return;
    }

    const record = activeOtps.get(phone);
    if (!record) {
      res.status(404).json({ success: false, error: 'Código expirado o no encontrado.' });
      return;
    }

    if (Date.now() - record.createdAt > 120000) {
      activeOtps.delete(phone);
      res.status(400).json({ success: false, error: 'Código expirado (Tiempo límite 2 minutos).' });
      return;
    }

    if (record.attempts >= 3) {
      activeOtps.delete(phone);
      res.status(429).json({ success: false, error: 'Demasiados intentos fallidos.' });
      return;
    }

    if (Number(record.otp) !== Number(otp)) {
      record.attempts += 1;
      activeOtps.set(phone, record);
      res.status(400).json({ success: false, error: 'Código incorrecto.' });
      return;
    }

    // ÉXITO: Incrementar cuenta en dispositivo
    const currentDeviceAccounts = deviceAccountTracker.get(record.deviceId) || 0;
    deviceAccountTracker.set(record.deviceId, currentDeviceAccounts + 1);

    // Borrar OTP usado
    activeOtps.delete(phone);

    res.status(200).json({
      success: true,
      message: 'Verificado',
      accountCount: currentDeviceAccounts + 1
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error al verificar OTP.' });
  }
});

// Rate limiter para ofertas por conductor (Max 5 ofertas cada 10 min)
const driverOfferServerTracker = new Map<string, number[]>();

// -------------------------------------------------------------
// ENDPOINT: SUBMIT OFFER / CLOUD FUNCTION SUBMITOFFER
// -------------------------------------------------------------
app.post('/api/submit-offer', (req: Request, res: Response) => {
  try {
    const { serviceId, driverId, price_propuesto, vehicle_type, distancia_km, distancia_reportada, user_location, conductor_location } = req.body;

    if (!serviceId) {
      res.status(400).json({ success: false, error: 'El ID del servicio (serviceId) es requerido.' });
      return;
    }

    // 1. RATE LIMIT ANTI-SABOTAJE: Max 5 ofertas por conductor cada 10 minutos
    if (driverId) {
      const now = Date.now();
      const TEN_MIN_MS = 10 * 60 * 1000;
      const history = (driverOfferServerTracker.get(String(driverId)) || []).filter(ts => (now - ts) < TEN_MIN_MS);
      driverOfferServerTracker.set(String(driverId), history);

      if (history.length >= 5) {
        res.status(429).json({
          success: false,
          error: 'Vas muy rápido. Espera 10 min'
        });
        return;
      }
    }

    const price = Number(price_propuesto);
    if (!price || isNaN(price)) {
      res.status(400).json({ success: false, error: 'Debe ingresar un precio propuesto válido.' });
      return;
    }

    // 2. VALIDACIÓN GPS: Distancia calculada vs Distancia reportada
    let distCalculada = Number(distancia_km) || 0;
    if (user_location?.lat && conductor_location?.lat) {
      const R = 6371;
      const dLat = (user_location.lat - conductor_location.lat) * (Math.PI / 180);
      const dLon = (user_location.lng - conductor_location.lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(conductor_location.lat * (Math.PI / 180)) * Math.cos(user_location.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distCalculada = Math.round(R * c * 10) / 10;
    }

    const distReportada = Number(distancia_reportada) || Number(distancia_km) || 0;
    if (distReportada > 0 && distCalculada > 0) {
      if (distCalculada > (distReportada * 1.5)) {
        res.status(400).json({
          success: false,
          error: 'Ubicación no coincide'
        });
        return;
      }
    }

    const distKm = distCalculada || distReportada || 2;

    if (distKm > 25) {
      res.status(400).json({
        success: false,
        error: 'Estás muy lejos del usuario. Máximo 25km para ofertar'
      });
      return;
    }

    // Fórmula Ruedas Rápidas
    const normType = (vehicle_type || '').trim().toLowerCase();
    let base = 5000;
    let por_km = 1400;

    if (normType === 'moto') {
      base = 5000;
      por_km = 1400;
    } else if (normType === 'carro') {
      base = 7000;
      por_km = 2000;
    } else if (normType === 'taxi') {
      base = 7000;
      por_km = 2200;
    }

    let precio_sugerido = base + (por_km * distKm);
    precio_sugerido = Math.max(5000, precio_sugerido);
    precio_sugerido = Math.round(precio_sugerido / 100) * 100;

    // 3. DETECCIÓN DE DUMPING
    if (price < (precio_sugerido * 0.5)) {
      res.status(400).json({
        success: false,
        error: 'Oferta muy por debajo del mercado'
      });
      return;
    }

    const precio_minimo = 5000;
    const precio_maximo = precio_sugerido * 3;

    if (price < precio_minimo) {
      res.status(400).json({
        success: false,
        error: 'La tarifa mínima nacional es $5.000'
      });
      return;
    }

    if (price > precio_maximo) {
      res.status(400).json({
        success: false,
        error: `Oferta muy alta. Máximo permitido: $${precio_maximo.toLocaleString('es-CO')}`
      });
      return;
    }

    // Registrar éxito en rate limiter
    if (driverId) {
      const now = Date.now();
      const history = (driverOfferServerTracker.get(String(driverId)) || []);
      history.push(now);
      driverOfferServerTracker.set(String(driverId), history);
    }

    // 4. DATOS DE AUDITORÍA DE OFERTA (/logs_offers)
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const auditLog = {
      driverId: driverId || 'unknown',
      serviceId,
      price,
      timestamp: new Date().toISOString(),
      ip: Array.isArray(clientIp) ? clientIp[0] : clientIp
    };

    res.status(200).json({
      success: true,
      message: 'Oferta validada y aprobada correctamente.',
      data: {
        serviceId,
        driverId,
        price_propuesto: price,
        precio_sugerido,
        precio_minimo,
        precio_maximo,
        distancia_km: distKm,
        auditLog
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error al procesar la oferta.' });
  }
});

// -------------------------------------------------------------
// ENDPOINT: ACCEPT OFFER / CLOUD FUNCTION ACCEPTOFFER
// -------------------------------------------------------------
app.post('/api/accept-offer', (req: Request, res: Response) => {
  try {
    const { serviceId, offerId, driverId, userId } = req.body;

    if (!serviceId) {
      res.status(400).json({ success: false, error: 'serviceId es requerido.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Oferta aceptada correctamente.',
      data: {
        serviceId,
        offerId: offerId || driverId || 'default-offer',
        driverId: driverId || 'conductor',
        userId: userId || 'usuario',
        status: 'accepted',
        acceptedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error al aceptar la oferta.' });
  }
});

// -------------------------------------------------------------
// ENDPOINTS DE ADMINISTRACIÓN Y ACTIVACIÓN DE CONDUCTORES
// -------------------------------------------------------------
app.get('/api/admin/pending-drivers', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Endpoint de administración activo para getPendingDrivers'
  });
});

app.post('/api/admin/approve-driver', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId es requerido' });
    return;
  }
  res.status(200).json({
    success: true,
    message: 'Conductor activado exitosamente',
    data: {
      userId,
      role: 'conductor',
      status: 'activo',
      approvedAt: new Date().toISOString()
    }
  });
});

app.post('/api/admin/reject-driver', (req: Request, res: Response) => {
  const { userId, reason } = req.body;
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId es requerido' });
    return;
  }
  res.status(200).json({
    success: true,
    message: 'Conductor rechazado',
    data: {
      userId,
      status: 'rechazado',
      rejectedReason: reason || 'Documentación incompleta'
    }
  });
});

// Endpoint de verificación / Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rateLimit: '60 req/min general, 3 req/10min registro conductor'
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
