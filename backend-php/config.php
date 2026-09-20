<?php
/**
 * Configuración General del Sistema y Base de Datos MySQL
 * Hostinger / ruedasrapidasviajaseguro.com
 */

// Evitar acceso directo
if (!defined('ACCESO_PERMITIDO')) {
    define('ACCESO_PERMITIDO', true);
}

// 1. Configuración de Base de Datos MySQL (Hostinger)
define('DB_HOST', 'localhost');                  // Generalmente 'localhost' en Hostinger
define('DB_NAME', 'u123456789_ruedas_db');       // Reemplaza con el nombre de tu BD en hPanel
define('DB_USER', 'u123456789_admin');           // Reemplaza con tu usuario MySQL
define('DB_PASS', 'TU_PASSWORD_SEGURO_AQUI');    // Reemplaza con tu contraseña de BD
define('DB_CHARSET', 'utf8mb4');

// 2. Clave Secreta de Google reCAPTCHA v3
define('RECAPTCHA_SECRET_KEY', 'TU_CLAVE_SECRETA_RECAPTCHA_V3');

// 3. Configuración de Correo SMTP (Hostinger Webmail)
define('SMTP_HOST', 'smtp.hostinger.com');       // Servidor SMTP oficial de Hostinger
define('SMTP_PORT', 465);                         // Puerto 465 (SSL) o 587 (TLS)
define('SMTP_SECURE', 'ssl');                     // 'ssl' para puerto 465, 'tls' para 587
define('SMTP_USER', 'no-responder@ruedasrapidasviajaseguro.com'); // Tu correo corporativo creado en Hostinger
define('SMTP_PASS', 'TU_PASSWORD_DEL_CORREO');   // Contraseña del correo de Hostinger
define('SMTP_FROM_NAME', 'Ruedas Rápidas - Viaja Seguro');

// 4. URL Base del Proyecto
define('APP_URL', 'https://ruedasrapidasviajaseguro.com');

/**
 * Función para obtener conexión segura a MySQL mediante PDO
 */
function obtenerConexionDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $opciones = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opciones);
        } catch (PDOException $e) {
            // No exponer datos sensibles del servidor al usuario final
            error_log("Error de conexión a la BD: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Error interno al conectar con el servidor de base de datos."
            ]);
            exit;
        }
    }
    return $pdo;
}

/**
 * Función para obtener la IP real del cliente (incluso detrás de CDN/Cloudflare/Proxy)
 */
function obtenerIPCliente() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return filter_var($_SERVER['HTTP_CF_CONNECTING_IP'], FILTER_VALIDATE_IP) ?: $_SERVER['REMOTE_ADDR'];
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($ips[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
