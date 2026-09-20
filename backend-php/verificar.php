<?php
/**
 * Verificación y Activación de Cuenta mediante Token Criptográfico
 * Ruedas Rápidas - Viaja Seguro
 * https://ruedasrapidasviajaseguro.com/verificar.php?token=...
 */

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

require_once __DIR__ . '/config.php';

$token = trim($_GET['token'] ?? '');
$esApi = (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

$estadoVerificacion = 'error';
$mensaje = '';
$usuarioNombre = '';
$usuarioEmail = '';

// 1. Validación de formato de Token (debe ser hexadecimal de 64 caracteres)
if (empty($token) || !preg_match('/^[a-f0-9]{64}$/i', $token)) {
    $mensaje = 'El token de verificación es inválido o tiene un formato incorrecto.';
} else {
    try {
        $pdo = obtenerConexionDB();

        // 2. Búsqueda del usuario por token
        $stmt = $pdo->prepare("SELECT id, nombre, email, estado, rol, creado FROM usuarios WHERE token_verificacion = ? LIMIT 1");
        $stmt->execute([$token]);
        $usuario = $stmt->fetch();

        if (!$usuario) {
            $mensaje = 'Este enlace de verificación ya fue utilizado previamente o ha expirado. Si ya activaste tu cuenta, puedes iniciar sesión directamente.';
        } elseif ($usuario['estado'] === 'activo') {
            $estadoVerificacion = 'ya_activo';
            $usuarioNombre = $usuario['nombre'];
            $usuarioEmail = $usuario['email'];
            $mensaje = 'Tu cuenta ya se encuentra verificada y activa. Puedes ingresar a la plataforma.';
        } else {
            // 3. Activación blindada: pasamos a estado 'activo' e invalidamos el token
            $stmtUpdate = $pdo->prepare("
                UPDATE usuarios 
                SET estado = 'activo', 
                    token_verificacion = NULL, 
                    email_verificado_en = NOW() 
                WHERE id = ?
            ");
            $stmtUpdate->execute([$usuario['id']]);

            $estadoVerificacion = 'exito';
            $usuarioNombre = $usuario['nombre'];
            $usuarioEmail = $usuario['email'];
            $mensaje = '¡Tu cuenta ha sido verificada exitosamente! Ya puedes disfrutar de todos los servicios de Ruedas Rápidas.';
        }
    } catch (\PDOException $e) {
        error_log("Error en verificación: " . $e->getMessage());
        $mensaje = 'Ocurrió un error al procesar la activación. Por favor intenta más tarde o comunícate con soporte.';
    }
}

// Respuesta en formato JSON si fue llamada como endpoint de API
if ($esApi) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status'  => $estadoVerificacion === 'exito' || $estadoVerificacion === 'ya_activo' ? 'success' : 'error',
        'code'    => $estadoVerificacion,
        'message' => $mensaje,
        'email'   => $usuarioEmail
    ]);
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación de Cuenta • Ruedas Rápidas</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23059669'><path d='M12 2L2 7l10 5 10-5-10-5z'/></svg>">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .card {
            max-width: 480px;
            width: 100%;
            background: #ffffff;
            border-radius: 24px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.07);
            padding: 36px 28px;
            text-align: center;
        }
        .icon-circle {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 20px auto;
        }
        .icon-success { background: #dcfce7; color: #16a34a; border: 2px solid #bbf7d0; }
        .icon-error   { background: #fee2e2; color: #dc2626; border: 2px solid #fecaca; }
        .icon-info    { background: #e0f2fe; color: #0284c7; border: 2px solid #bae6fd; }

        h1 {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
            margin-bottom: 8px;
        }
        p {
            font-size: 15px;
            color: #475569;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .email-badge {
            display: inline-block;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            color: #334155;
            font-family: monospace;
            font-size: 13px;
            font-weight: bold;
            padding: 6px 14px;
            border-radius: 9999px;
            margin-bottom: 24px;
        }
        .btn-action {
            display: block;
            width: 100%;
            background: #059669;
            color: #ffffff;
            font-weight: 800;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-decoration: none;
            padding: 16px;
            border-radius: 14px;
            box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
            transition: all 0.2s ease;
        }
        .btn-action:hover {
            background: #047857;
            transform: translateY(-1px);
        }
        .footer-note {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 24px;
        }
    </style>
</head>
<body>
    <div class="card">
        <?php if ($estadoVerificacion === 'exito'): ?>
            <div class="icon-circle icon-success">✓</div>
            <h1>¡Cuenta Activada con Éxito!</h1>
            <?php if (!empty($usuarioNombre)): ?>
                <p>Bienvenido, <strong><?= htmlspecialchars($usuarioNombre, ENT_QUOTES, 'UTF-8') ?></strong>.</p>
            <?php endif; ?>
            <div class="email-badge"><?= htmlspecialchars($usuarioEmail, ENT_QUOTES, 'UTF-8') ?></div>
            <p><?= htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8') ?></p>
            <a href="<?= APP_URL ?>" class="btn-action">Abrir App y Comenzar</a>

        <?php elseif ($estadoVerificacion === 'ya_activo'): ?>
            <div class="icon-circle icon-info">ℹ</div>
            <h1>Cuenta Ya Verificada</h1>
            <div class="email-badge"><?= htmlspecialchars($usuarioEmail, ENT_QUOTES, 'UTF-8') ?></div>
            <p><?= htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8') ?></p>
            <a href="<?= APP_URL ?>" class="btn-action">Ir al Inicio de Sesión</a>

        <?php else: ?>
            <div class="icon-circle icon-error">✕</div>
            <h1>No Pudimos Activar la Cuenta</h1>
            <p><?= htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8') ?></p>
            <a href="<?= APP_URL ?>" class="btn-action" style="background: #334155;">Volver al Inicio</a>
        <?php endif; ?>

        <div class="footer-note">
            Ruedas Rápidas • Sistema Blindado de Protección al Usuario y Conductor
        </div>
    </div>
</body>
</html>
