<?php
/**
 * Registro Blindado de Usuarios / Conductores
 * Ruedas Rápidas - Viaja Seguro
 * 
 * Implementa:
 * 1. Honeypot invisible anti-bots
 * 2. Validación de Google reCAPTCHA v3
 * 3. Validación estricta de Email y Longitud de Contraseña
 * 4. Rate-limiting por IP (Anti-sabotaje, máx 3 registros por hora)
 * 5. Hashing seguro con BCRYPT (Cero texto plano) + Token criptográfico de 64 caracteres
 * 6. Prepared Statements contra Inyección SQL
 * 7. Envío de Correo de Activación mediante PHPMailer y SMTP de Hostinger
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Permitir peticiones CORS si el frontend se consume desde dominio autorizado
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origins = [
    'https://ruedasrapidasviajaseguro.com',
    'http://localhost:3000',
    'http://localhost:5173'
];
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método no permitido. Solo se acepta POST.']);
    exit;
}

require_once __DIR__ . '/config.php';

// Soporte tanto para formulario tradicional x-www-form-urlencoded como JSON en el body
$input = $_POST;
if (empty($input)) {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $input = $json;
        }
    }
}

// =========================================================================
// 1. ANTI-BOTS INVISIBLE (Honeypot + Google reCAPTCHA v3)
// =========================================================================

// 1.1 Trampa Honeypot: Campo señuelo "website" que los humanos no ven ni llenan
if (!empty($input['website'])) {
    // Respuesta silenciosa para engañar a los bots automatizados
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => 'Si los datos son correctos, recibirás un correo de verificación.'
    ]);
    exit;
}

// 1.2 Verificación Google reCAPTCHA v3 (Opcional si se proporciona el token)
$recaptchaResponse = $input['g-recaptcha-response'] ?? '';
if (!empty(RECAPTCHA_SECRET_KEY) && RECAPTCHA_SECRET_KEY !== 'TU_CLAVE_SECRETA_RECAPTCHA_V3') {
    if (empty($recaptchaResponse)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Verificación de seguridad reCAPTCHA requerida.']);
        exit;
    }

    // Verificación segura con cURL (no depende de allow_url_fopen en Hostinger)
    $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'secret'   => RECAPTCHA_SECRET_KEY,
        'response' => $recaptchaResponse,
        'remoteip' => obtenerIPCliente()
    ]));
    $res = curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError || !$res) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Error de conexión con el servicio de seguridad reCAPTCHA.']);
        exit;
    }

    $recaptchaData = json_decode($res, true);
    // Para reCAPTCHA v3 validamos éxito y un puntaje humano mínimo (>= 0.5)
    if (empty($recaptchaData['success']) || (isset($recaptchaData['score']) && $recaptchaData['score'] < 0.5)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Bot detectado o verificación de seguridad denegada.']);
        exit;
    }
}

// =========================================================================
// 2. VALIDACIÓN DURA Y SANITIZACIÓN DE ENTRADAS
// =========================================================================

$pdo = obtenerConexionDB();
$ip = obtenerIPCliente();

$email = filter_var(trim($input['email'] ?? ''), FILTER_VALIDATE_EMAIL);
if (!$email) {
    registrarFallo($pdo, 'email_invalido@desconocido', $ip, 'Email con formato inválido');
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'El correo electrónico no es válido.']);
    exit;
}

// 2.1 VERIFICAR BLOQUEO ACTIVO POR FUERZA BRUTA
$stmtCheck = $pdo->prepare("
    SELECT id, nombre, estado, intentos_fallidos, bloqueado_hasta, 
           (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS esta_bloqueado,
           TIMESTAMPDIFF(MINUTE, NOW(), bloqueado_hasta) AS minutos_restantes
    FROM usuarios 
    WHERE email = ? 
    LIMIT 1
");
$stmtCheck->execute([$email]);
$usuarioExistente = $stmtCheck->fetch();

if ($usuarioExistente && !empty($usuarioExistente['esta_bloqueado'])) {
    http_response_code(423);
    die("Cuenta bloqueada 30 min por seguridad");
}

// 2.2 CALCULAR INTENTOS FALLIDOS (Anti-fuerza bruta)
$stmtFallidos = $pdo->prepare("
    SELECT COUNT(*) FROM intentos_registro 
    WHERE (email = ? OR ip = ?) AND fecha > NOW() - INTERVAL 30 MINUTE
");
$stmtFallidos->execute([$email, $ip]);
$intentos_fallidos = (int)$stmtFallidos->fetchColumn();

if ($usuarioExistente && isset($usuarioExistente['intentos_fallidos'])) {
    $intentos_fallidos = max($intentos_fallidos, (int)$usuarioExistente['intentos_fallidos']);
}

// Bloqueo por fuerza bruta
if ($intentos_fallidos >= 5) {
    $pdo->prepare("UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?")->execute([$email]);
    http_response_code(423);
    die("Cuenta bloqueada 30 min por seguridad");
}

$password = $input['password'] ?? '';
if (strlen($password) < 8) {
    registrarFallo($pdo, $email, $ip, 'Password menor a 8 caracteres');
    // Re-evaluar si con este fallo alcanzó los 5 intentos
    $intentos_fallidos++;
    if ($intentos_fallidos >= 5) {
        $pdo->prepare("UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?")->execute([$email]);
        http_response_code(423);
        die("Cuenta bloqueada 30 min por seguridad");
    }
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'La contraseña debe tener mínimo 8 caracteres.']);
    exit;
}

$nombre = htmlspecialchars(trim($input['nombre'] ?? 'Usuario'), ENT_QUOTES, 'UTF-8');
$telefono = preg_replace('/\D/', '', $input['telefono'] ?? '');
$rol = in_array($input['rol'] ?? '', ['conductor', 'usuario', 'marca_aliada'], true) ? $input['rol'] : 'usuario';

// =========================================================================
// 3. EVITA CUENTAS MASIVAS DEL MISMO IP (ANTI-SABOTAJE / RATE LIMITING)
// =========================================================================

// Consulta preparada: Máximo 3 intentos de registro por IP en la última hora
$stmtIp = $pdo->prepare("SELECT COUNT(*) AS total FROM usuarios WHERE ip_registro = ? AND creado > NOW() - INTERVAL 1 HOUR");
$stmtIp->execute([$ip]);
$intentos = (int)$stmtIp->fetchColumn();

if ($intentos >= 3) {
    registrarFallo($pdo, $email, $ip, 'Exceso de registros por IP');
    http_response_code(429);
    echo json_encode([
        'status' => 'error',
        'message' => 'Demasiados intentos desde esta dirección IP. Por seguridad, intenta nuevamente en 1 hora.'
    ]);
    exit;
}

if ($usuarioExistente) {
    if ($usuarioExistente['estado'] === 'activo') {
        registrarFallo($pdo, $email, $ip, 'Intento de registro sobre cuenta activa');
        $intentos_fallidos++;
        if ($intentos_fallidos >= 5) {
            $pdo->prepare("UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?")->execute([$email]);
            http_response_code(423);
            die("Cuenta bloqueada 30 min por seguridad");
        }
        http_response_code(409);
        echo json_encode([
            'status' => 'error',
            'message' => 'Este correo electrónico ya se encuentra registrado y activo. Por favor inicia sesión.'
        ]);
        exit;
    } else {
        // Si estaba pendiente, generamos un nuevo token y reenviamos el correo de activación
        $token_verificacion = bin2hex(random_bytes(32)); // 64 caracteres
        $nuevoHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $stmtReenvio = $pdo->prepare("
            UPDATE usuarios 
            SET password_hash = ?, 
                token_verificacion = ?, 
                ip_registro = ?, 
                intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                creado = NOW() 
            WHERE id = ?
        ");
        $stmtReenvio->execute([$nuevoHash, $token_verificacion, $ip, $usuarioExistente['id']]);

        // Proceder al envío del correo
        enviarCorreoActivacion($email, $nombre, $token_verificacion);
        echo json_encode([
            'status' => 'success',
            'message' => 'Tu cuenta estaba pendiente de activación. Hemos reenviado el enlace de verificación a tu correo.'
        ]);
        exit;
    }
}

// =========================================================================
// 4. GUARDA SEGURO (BCRYPT + TOKEN CRIPTOGRÁFICO DE 64 CARACTERES)
// =========================================================================

// Cero contraseñas en texto plano, NUNCA md5 ni sha1
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$token_verificacion = bin2hex(random_bytes(32)); // 64 caracteres hex criptográficamente seguros

$stmtInsert = $pdo->prepare("
    INSERT INTO usuarios (nombre, email, telefono, rol, password_hash, token_verificacion, estado, ip_registro, creado)
    VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, NOW())
");

$stmtInsert->execute([
    $nombre,
    $email,
    $telefono,
    $rol,
    $hash,
    $token_verificacion,
    $ip
]);

// =========================================================================
// 5. ENVÍA CORREO DE VERIFICACIÓN (PHPMailer con SMTP Hostinger)
// =========================================================================

$correoEnviado = enviarCorreoActivacion($email, $nombre, $token_verificacion);

if ($correoEnviado) {
    http_response_code(201);
    echo json_encode([
        'status' => 'success',
        'message' => '¡Registro blindado exitoso! Hemos enviado un enlace de activación a tu correo electrónico. Debes verificarlo antes de poder ingresar.',
        'data' => [
            'email' => $email,
            'estado' => 'pendiente'
        ]
    ]);
} else {
    // Si falla el envío SMTP, informamos al usuario sin romper el registro
    http_response_code(201);
    echo json_encode([
        'status' => 'warning',
        'message' => 'Usuario registrado, pero ocurrió un retraso al despachar el correo de verificación. Puedes solicitar un reenvío en unos minutos.'
    ]);
}

// =========================================================================
// FUNCIÓN AUXILIAR PARA ENVIAR CORREO CON PHPMAILER
// =========================================================================

function enviarCorreoActivacion($destinatarioEmail, $destinatarioNombre, $token) {
    $linkVerificacion = APP_URL . "/verificar.php?token=" . urlencode($token);

    // Detección de autoloader de Composer o librerías manuales de PHPMailer
    if (file_exists(__DIR__ . '/vendor/autoload.php')) {
        require_once __DIR__ . '/vendor/autoload.php';
    } elseif (file_exists(__DIR__ . '/PHPMailer/src/PHPMailer.php')) {
        require_once __DIR__ . '/PHPMailer/src/Exception.php';
        require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
        require_once __DIR__ . '/PHPMailer/src/SMTP.php';
    } else {
        // Fallback nativo mail() de PHP con cabeceras MIME si PHPMailer aún no está instalado
        $asunto = "=?UTF-8?B?" . base64_encode("Activa tu cuenta en Ruedas Rápidas") . "?=";
        $mensajeHTML = construirPlantillaHTML($destinatarioNombre, $linkVerificacion);
        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type: text/html; charset=UTF-8\r\n";
        $headers .= "From: " . SMTP_FROM_NAME . " <" . SMTP_USER . ">\r\n";
        $headers .= "Reply-To: " . SMTP_USER . "\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        return @mail($destinatarioEmail, $asunto, $mensajeHTML, $headers);
    }

    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);

        // Configuración del servidor SMTP de Hostinger
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = (SMTP_SECURE === 'ssl') 
            ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS 
            : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        // Remitente y Destinatario
        $mail->setFrom(SMTP_USER, SMTP_FROM_NAME);
        $mail->addAddress($destinatarioEmail, $destinatarioNombre);
        $mail->addReplyTo(SMTP_USER, SMTP_FROM_NAME);

        // Contenido del Correo
        $mail->isHTML(true);
        $mail->Subject = '🛡️ Activa tu cuenta en Ruedas Rápidas - Código de Verificación';
        $mail->Body    = construirPlantillaHTML($destinatarioNombre, $linkVerificacion);
        $mail->AltBody = "Hola {$destinatarioNombre},\n\nPara activar tu cuenta en Ruedas Rápidas, copia y pega el siguiente enlace en tu navegador:\n{$linkVerificacion}\n\nSi no creaste esta cuenta, puedes ignorar este mensaje.";

        $mail->send();
        return true;
    } catch (\Exception $e) {
        error_log("Error enviando correo con PHPMailer: " . $e->getMessage());
        return false;
    }
}

function construirPlantillaHTML($nombre, $link) {
    return '
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Activa tu cuenta</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
            .content { padding: 32px 24px; line-height: 1.6; }
            .btn { display: inline-block; background-color: #059669; color: #ffffff !important; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin: 24px 0; text-align: center; font-size: 15px; }
            .link-box { word-break: break-all; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; font-size: 12px; color: #475569; font-family: monospace; }
            .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin:0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">RUEDAS RÁPIDAS</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Viaja Seguro • Fusagasugá</p>
            </div>
            <div class="content">
                <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">¡Hola, ' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '!</h2>
                <p>Estás a un solo paso de ingresar a la plataforma de movilidad y envíos más segura de la región.</p>
                <p>Para proteger tu cuenta contra accesos no autorizados y fraudes, por favor confirma tu correo electrónico haciendo clic en el siguiente botón:</p>
                <div style="text-align: center;">
                    <a href="' . htmlspecialchars($link, ENT_QUOTES, 'UTF-8') . '" class="btn" target="_blank">Verificar y Activar mi Cuenta</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">Si el botón no funciona, copia y pega este enlace seguro en tu navegador:</p>
                <div class="link-box">' . htmlspecialchars($link, ENT_QUOTES, 'UTF-8') . '</div>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Este enlace es válido por 24 horas. Si tú no solicitaste este registro, puedes ignorar este mensaje con total tranquilidad.</p>
            </div>
            <div class="footer">
                &copy; ' . date('Y') . ' Ruedas Rápidas. Protocolo de Validación Criptográfica y Anti-Fraude.
            </div>
        </div>
    </body>
    </html>
    ';
}

/**
 * Registra un intento fallido para auditoría y conteo de fuerza bruta
 */
function registrarFallo($pdo, $email, $ip, $motivo) {
    try {
        $stmt = $pdo->prepare("INSERT INTO intentos_registro (email, ip, motivo, fecha) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$email, $ip, $motivo]);

        // Si el usuario existe, incrementar su contador individual de intentos fallidos
        $stmtUp = $pdo->prepare("UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1 WHERE email = ?");
        $stmtUp->execute([$email]);
    } catch (\Exception $e) {
        error_log("Error al registrar fallo de fuerza bruta: " . $e->getMessage());
    }
}
