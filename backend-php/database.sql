-- =========================================================================
-- Estructura de Base de Datos MySQL para Registro Blindado
-- Ruedas Rápidas - Viaja Seguro (Hostinger / cPanel / phpMyAdmin)
-- =========================================================================

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL DEFAULT 'Usuario',
  `email` VARCHAR(191) NOT NULL,
  `telefono` VARCHAR(25) DEFAULT NULL,
  `rol` ENUM('usuario', 'conductor', 'marca_aliada', 'admin') NOT NULL DEFAULT 'usuario',
  `password_hash` VARCHAR(255) NOT NULL,
  `token_verificacion` VARCHAR(64) DEFAULT NULL,
  `estado` ENUM('pendiente', 'activo', 'bloqueado') NOT NULL DEFAULT 'pendiente',
  `ip_registro` VARCHAR(45) NOT NULL,
  `email_verificado_en` DATETIME DEFAULT NULL,
  `creado` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_usuarios_email` (`email`),
  KEY `idx_usuarios_token` (`token_verificacion`),
  KEY `idx_usuarios_ip_creado` (`ip_registro`, `creado`),
  KEY `idx_usuarios_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla complementaria para registro de intentos de login y seguridad (opcional)
CREATE TABLE IF NOT EXISTS `intentos_login` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `ip` VARCHAR(45) NOT NULL,
  `exitoso` TINYINT(1) NOT NULL DEFAULT 0,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_intentos_ip_fecha` (`ip`, `fecha`),
  KEY `idx_intentos_email_fecha` (`email`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
