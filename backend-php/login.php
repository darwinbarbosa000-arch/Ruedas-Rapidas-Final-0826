<?php
/**
 * Login Seguro con Bloqueo Anti-Fuerza Bruta
 * Ruedas Rápidas - Viaja Seguro
 * 
 * Implementa:
 * 1. Verificación de bloqueo activo (30 minutos)
 * 2. Contador de intentos fallidos
 * 3. Bloqueo automático por fuerza bruta al 5to intento fallido
 * 4. Verificación de password con password_verify() (BCRYPT)
 * 5. Validación de cuenta verificada por email
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
    exit;
}

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

$email = filter_var(trim($input['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$password = $input['password'] ?? '';
$ip = obtenerIPCliente();

if (!$email || empty($password)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Credenciales incompletas']);
    exit;
}

$pdo = obtenerConexionDB();

// 1. Buscar usuario
$stmt = $pdo->prepare("
    SELECT id, nombre, email, rol, password_hash, estado, intentos_fallidos, bloqueado_hasta,
           (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS esta_bloqueado,
           TIMESTAMPDIFF(MINUTE, NOW(), bloqueado_hasta) AS minutos_restantes
    FROM usuarios 
    WHERE email = ? 
    LIMIT 1
");
$stmt->execute([$email]);
$usuario = $stmt->fetch();

if (!$usuario) {
    // Respuesta genérica para no enumerar usuarios válidos
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Credenciales inválidas']);
    exit;
}

// 2. Comprobar si la cuenta está actualmente bloqueada
if (!empty($usuario['esta_bloqueado'])) {
    http_response_code(423);
    die("Cuenta bloqueada 30 min por seguridad");
}

$intentos_fallidos = (int)$usuario['intentos_fallidos'];

// 3. Bloqueo por fuerza bruta (si ya acumula 5 o más intentos fallidos)
if ($intentos_fallidos >= 5) {
    // Si se usa mysqli:
    // $conn->query("UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email='$email'");
    $stmtBloqueo = $pdo->prepare("UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?");
    $stmtBloqueo->execute([$email]);
    http_response_code(423);
    die("Cuenta bloqueada 30 min por seguridad");
}

// 4. Validar contraseña con password_verify (BCRYPT)
if (!password_verify($password, $usuario['password_hash'])) {
    // Incrementar contador de intentos fallidos
    $intentos_fallidos++;
    
    $stmtInc = $pdo->prepare("UPDATE usuarios SET intentos_fallidos = ? WHERE email = ?");
    $stmtInc->execute([$intentos_fallidos, $email]);

    // Registrar en auditoría de intentos
    try {
        $pdo->prepare("INSERT INTO intentos_login (email, ip, exitoso, fecha) VALUES (?, ?, 0, NOW())")->execute([$email, $ip]);
    } catch (\Exception $e) {}

    // Bloqueo por fuerza bruta inmediato al alcanzar el 5to fallo
    if ($intentos_fallidos >= 5) {
        // Ejecución idéntica a la solicitada:
        $stmtBloqueo = $pdo->prepare("UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?");
        $stmtBloqueo->execute([$email]);
        http_response_code(423);
        die("Cuenta bloqueada 30 min por seguridad");
    }

    $restantes = 5 - $intentos_fallidos;
    http_response_code(401);
    echo json_encode([
        'status' => 'error', 
        'message' => "Contraseña incorrecta. Te quedan {$restantes} intentos antes de bloquear la cuenta."
    ]);
    exit;
}

// 5. Validar que la cuenta esté verificada por correo
if ($usuario['estado'] !== 'activo') {
    http_response_code(403);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Tu cuenta aún no ha sido verificada. Revisa tu correo electrónico o solicita un reenvío del enlace de activación.'
    ]);
    exit;
}

// 6. Login exitoso: Resetear contador de fallos y desbloqueo
$stmtReset = $pdo->prepare("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE email = ?");
$stmtReset->execute([$email]);

try {
    $pdo->prepare("INSERT INTO intentos_login (email, ip, exitoso, fecha) VALUES (?, ?, 1, NOW())")->execute([$email, $ip]);
} catch (\Exception $e) {}

// Generar sesión o respuesta de autenticación exitosa
echo json_encode([
    'status' => 'success',
    'message' => 'Inicio de sesión exitoso',
    'usuario' => [
        'id' => $usuario['id'],
        'nombre' => $usuario['nombre'],
        'email' => $usuario['email'],
        'rol' => $usuario['rol']
    ]
]);
