# 🛡️ Módulo de Registro Blindado (PHP + MySQL + PHPMailer)
**Ruedas Rápidas - Viaja Seguro** (`https://ruedasrapidasviajaseguro.com`)

Este módulo implementa el protocolo estricto de seguridad anti-bots, anti-sabotaje, hashing criptográfico BCRYPT y verificación por correo electrónico.

---

## 🔒 Características de Seguridad Implementadas

1. **Anti-Bots Invisible (Honeypot):**
   - Campo invisible `website`. Si un bot rellena este campo, el script finaliza sin procesar datos.
2. **Google reCAPTCHA v3:**
   - Verificación del token con los servidores de Google mediante cURL y validación de score humano (>= 0.5).
3. **Validación Dura:**
   - Validación estricta con `FILTER_VALIDATE_EMAIL`.
   - Longitud mínima de contraseña de 8 caracteres.
4. **Anti-Sabotaje / Rate Limiting por IP:**
   - Previene la creación masiva de cuentas: máximo **3 registros por hora por cada dirección IP**.
   - Detección precisa de IP real compatible con Cloudflare / proxies.
5. **Cero Contraseñas en Texto Plano:**
   - Hashing con `password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])`. Nunca MD5 ni SHA1.
6. **Token Criptográfico de 64 Caracteres:**
   - Generado con `bin2hex(random_bytes(32))` para evitar adivinanzas o ataques de fuerza bruta.
7. **Consultas Preparadas (Prepared Statements PDO):**
   - Inmunidad total contra inyección SQL.
8. **Envío con PHPMailer (SMTP Hostinger):**
   - Despacho seguro por puerto 465 (SSL) con plantilla HTML responsive y enlace único a `verificar.php`.

---

## 📁 Archivos Incluidos

- `config.php`: Credenciales de MySQL, claves de reCAPTCHA, SMTP de Hostinger y funciones de utilidad.
- `registro.php`: Endpoint que recibe el registro, aplica los 5 pasos de blindaje y envía el correo.
- `verificar.php`: Valida el token del enlace, activa al usuario en la BD y muestra la pantalla de confirmación.
- `database.sql`: Script SQL para importar en phpMyAdmin.
- `composer.json`: Para instalar PHPMailer con `composer install`.

---

## 🚀 Pasos de Instalación en Hostinger (hPanel)

### 1. Crear la Base de Datos en Hostinger
1. Entra a tu **hPanel** de Hostinger -> **Bases de datos MySQL**.
2. Crea una nueva base de datos (ej. `u123456789_ruedas_db`) y un usuario con contraseña segura.
3. Abre **phpMyAdmin** para esa base de datos y haz clic en la pestaña **Importar**.
4. Selecciona el archivo `database.sql` y presiona **Ejecutar**.

### 2. Configurar el Correo Corporativo en Hostinger
1. En hPanel ve a **Emails** -> Crea una cuenta de correo (ejemplo: `no-responder@ruedasrapidasviajaseguro.com`).
2. Datos SMTP oficiales de Hostinger:
   - **Servidor SMTP:** `smtp.hostinger.com`
   - **Puerto:** `465` (SSL) o `587` (TLS)
   - **Usuario:** Tu correo completo
   - **Contraseña:** La contraseña que asignaste a esa cuenta

### 3. Instalar PHPMailer
Tienes 2 opciones sencillas:
- **Opción A (Con Composer o SSH en Hostinger):**
  Ejecuta en la carpeta de tu servidor:
  ```bash
  composer require phpmailer/phpmailer
  ```
- **Opción B (Sin Composer - Manual):**
  Descarga el ZIP de [PHPMailer en GitHub](https://github.com/PHPMailer/PHPMailer) y extrae la carpeta `src/` dentro de tu servidor en una subcarpeta llamada `PHPMailer/src/`.

### 4. Actualizar `config.php`
Abre `config.php` en el Administrador de Archivos de Hostinger y ajusta:
```php
define('DB_NAME', 'tu_base_de_datos');
define('DB_USER', 'tu_usuario_mysql');
define('DB_PASS', 'tu_password_mysql');
define('SMTP_USER', 'no-responder@ruedasrapidasviajaseguro.com');
define('SMTP_PASS', 'tu_password_de_correo');
define('RECAPTCHA_SECRET_KEY', 'tu_clave_secreta_google');
```

---

## 🧪 Ejemplo de Consumo desde JavaScript / Fetch

```javascript
// En tu formulario de registro en el frontend:
const formData = new FormData();
formData.append('nombre', 'Carlos Mendoza');
formData.append('email', 'carlos@ejemplo.com');
formData.append('password', 'ClaveSegura123!');
formData.append('telefono', '3101234567');
formData.append('rol', 'conductor');
formData.append('website', ''); // Honeypot (debe ir siempre vacío)
formData.append('g-recaptcha-response', tokenRecaptcha); // Token generado por grecaptcha.execute()

fetch('https://ruedasrapidasviajaseguro.com/registro.php', {
  method: 'POST',
  body: formData
})
.then(res => res.json())
.then(data => {
  if (data.status === 'success') {
    alert('¡Registro exitoso! Revisa tu correo electrónico para activar tu cuenta.');
  } else {
    alert('Error: ' + data.message);
  }
});
```
