# Configuración del Servicio de Correo

Este documento explica cómo configurar el servicio de correo electrónico para enviar invitaciones a propietarios.

El servicio soporta dos métodos:
1. **Mailgun SDK** (Recomendado) - API directa de Mailgun
2. **SMTP** (Fallback) - Compatible con Gmail, SendGrid, Outlook, etc.

## Configuración con Mailgun (Recomendado)

Mailgun es un servicio profesional de correo con excelente deliverability y APIs fáciles de usar.

**Para desarrollo/testing puedes usar el sandbox domain incluido gratis - no necesitas dominio propio.**

### Paso 1: Obtener credenciales de Mailgun

1. Ve a https://www.mailgun.com/ y crea una cuenta (tienen plan gratuito)
2. En el dashboard, ve a "Sending" → "Domains"
3. **Usa el sandbox domain** - Ya viene configurado y listo para usar
   - Ejemplo: `sandboxbfd805d6d2c547fd8fdc7bda69e954e1.mailgun.org`
   - No requiere configuración DNS
   - Perfecto para desarrollo y testing
4. Ve a "Settings" → "API Keys" y copia tu "Private API Key"

### Paso 2: Configurar variables de entorno

Tu archivo `.env` debe configurarse de la siguiente manera:

```env
# Email Configuration - Mailgun
MAILGUN_API_KEY=your-mailgun-api-key-here
MAILGUN_DOMAIN=your-mailgun-domain.mailgun.org
MAILGUN_URL=https://api.mailgun.net
EMAIL_FROM=postmaster@your-mailgun-domain.mailgun.org
EMAIL_FROM_NAME=Timeshare Exchange Platform
```

**Importante:**
- Si tu cuenta es EU, usa `MAILGUN_URL=https://api.eu.mailgun.net`
- El sandbox domain es **GRATIS** y suficiente para testing
- Límite: 300 correos/mes
- Solo puedes enviar a direcciones autorizadas (paso siguiente)

### Paso 3: Autorizar destinatarios (CRÍTICO para sandbox)

**Este paso es obligatorio para que funcione el sandbox:**

1. Ve a tu dashboard de Mailgun: https://app.mailgun.com/
2. Haz clic en "Sending" → "Domains"
3. Selecciona tu sandbox domain
4. En la pestaña "Authorized Recipients", haz clic en "Add Recipient"
5. Agrega las direcciones de correo de prueba (ej: `grmoralesp@gmail.com`)
6. Mailgun enviará un correo de confirmación a cada destinatario
7. Los destinatarios deben hacer clic en el link de confirmación
8. Una vez confirmado, verás el email en la lista de "Authorized Recipients"

**Sin este paso, los correos serán rechazados con error "Forbidden".**

### Cuándo necesitas un dominio propio

Solo necesitas un dominio propio si:
- ❌ Quieres enviar a cualquier email sin autorización previa
- ❌ Necesitas más de 300 correos/mes
- ❌ Quieres que el remitente sea tu dominio (ej: `noreply@tuempresa.com`)
- ❌ Es para producción con usuarios reales

Para desarrollo y testing, el sandbox es perfecto. ✅

## Configuración con Gmail (SMTP)

### Opción 1: Usar App Password (Recomendado)

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Selecciona "Seguridad" en el menú lateral
3. En "Cómo inicias sesión en Google", activa "Verificación en dos pasos" si no está activada
4. Una vez activada la verificación en dos pasos, busca "Contraseñas de aplicaciones"
5. Genera una contraseña de aplicación para "Correo"
6. Copia la contraseña generada (16 caracteres)

### Configurar variables de entorno

Edita el archivo `.env` en el backend:

```env
# Email Configuration - SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-app-password-aqui
EMAIL_FROM=tu-email@gmail.com
EMAIL_FROM_NAME=Timeshare Exchange Platform
```

**Importante:** 
- `EMAIL_PASSWORD` debe ser la "Contraseña de aplicación", NO tu contraseña normal de Gmail
- `EMAIL_SECURE=false` usa TLS en el puerto 587
- `EMAIL_SECURE=true` usaría SSL en el puerto 465
- Si tienes configurado Mailgun, el sistema usará Mailgun primero

## Otros Proveedores de Correo (SMTP)

### SendGrid (SMTP)

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=tu-sendgrid-api-key
EMAIL_FROM=tu-email-verificado@tudominio.com
EMAIL_FROM_NAME=Timeshare Exchange Platform
```

### Outlook/Office 365

```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@outlook.com
EMAIL_PASSWORD=tu-contraseña
EMAIL_FROM=tu-email@outlook.com
EMAIL_FROM_NAME=Timeshare Exchange Platform
```

### Mailgun (SMTP - alternativa al SDK)

Si prefieres usar SMTP en lugar del SDK de Mailgun:

```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=postmaster@tu-dominio.mailgun.org
EMAIL_PASSWORD=tu-mailgun-smtp-password
EMAIL_FROM=no-reply@tu-dominio.com
EMAIL_FROM_NAME=Timeshare Exchange Platform
```

**Nota:** Se recomienda usar el SDK (configurando `MAILGUN_API_KEY`) en lugar de SMTP.

## Verificar Configuración

Una vez configuradas las variables de entorno, puedes verificar la conexión ejecutando:

```bash
cd backend
npm run dev
```

El servicio de correo mostrará en consola:
- `📧 Email service initialized with Mailgun` - Si Mailgun está configurado
- `📧 Email service initialized with Nodemailer (SMTP)` - Si se usa SMTP
- `⚠️ Email service not configured` - Si faltan credenciales

## Probar Envío de Correo

Para probar que el correo funciona:

1. **Autoriza tu email en Mailgun** (grmoralesp@gmail.com o el que uses)
2. **Confirma el email** haciendo clic en el link que Mailgun te envía
3. **Inicia el backend:**
   ```bash
   cd backend
   npm run dev
   ```
   Deberías ver: `📧 Email service initialized with Mailgun`

4. **Crea una invitación:**
   - Ve a http://localhost:5173/staff/create-owner-invitation
   - Ingresa el email autorizado
   - Envía la invitación

5. **Verifica en consola:**
   - `✅ Email sent successfully via Mailgun: <message-id>` - Correo enviado
   - `✅ Invitation email sent to email@example.com` - Confirmación
   - `⚠️ Failed to send invitation email` - Error

6. **Revisa tu bandeja de entrada** - El correo debería llegar en segundos

**Nota:** Si el correo falla, la invitación se crea de todos modos. Puedes copiar el link manualmente y enviarlo al propietario.

**Nota:** Si el correo falla, la invitación se crea de todos modos. Puedes copiar el link manualmente y enviarlo al propietario.

## Contenido del Correo

El correo de invitación incluye:

- Saludo personalizado (nombre del propietario)
- Nombre de la propiedad que envía la invitación
- Cantidad de habitaciones asignadas
- Explicación de las dos opciones (aceptar como reserva o convertir a créditos)
- Botón con link para aceptar la invitación
- Información de expiración (30 días por defecto)

## Troubleshooting

### Mailgun - Error: "Forbidden" o "Free accounts are for test purposes only"
**Causa:** El destinatario no está autorizado en el sandbox domain

**Solución:**
1. Ve a https://app.mailgun.com/
2. Sending → Domains → Tu sandbox
3. Authorized Recipients → Add Recipient
4. Agrega el email y espera la confirmación
5. El destinatario debe hacer clic en el link del correo de Mailgun

### Mailgun - "Invalid domain" o "Domain not found"
- Verifica que `MAILGUN_DOMAIN` sea exactamente como aparece en tu dashboard
- Debe incluir "sandbox" y ".mailgun.org"
- Ejemplo correcto: `sandboxbfd805d6d2c547fd8fdc7bda69e954e1.mailgun.org`

### Mailgun - Error: "Invalid API key"
- Verifica que tu API key sea la "Private API Key", no la pública
- Debe empezar con algo como "66c30660..."
- Revísala en Settings → API Keys

### Mailgun EU - "Not found"
- Si tu cuenta es de Europa, usa `MAILGUN_URL=https://api.eu.mailgun.net`
- Verifica en tu dashboard si dice "EU"

### Gmail SMTP - Error: "Invalid login"
- Verifica que estés usando una App Password, no tu contraseña normal
- Confirma que la verificación en dos pasos esté activada en Gmail

### Error: "Connection timeout"
- Verifica que el puerto sea correcto (587 para TLS, 465 para SSL)
- Revisa si tu firewall bloquea conexiones SMTP

### El correo llega a spam
- Configura SPF, DKIM y DMARC en tu dominio
- Usa un proveedor de correo profesional (SendGrid, Mailgun, etc.)
- Evita usar cuentas de Gmail personales en producción

### Correos no se envían pero no hay error
- Verifica que EMAIL_USER y EMAIL_PASSWORD estén configurados
- Revisa los logs del servidor para ver mensajes de advertencia
- Intenta con un servicio como Mailtrap.io para testing

## Producción

Para producción, se recomienda:

1. **Usar Mailgun con dominio propio:** Configura y verifica tu dominio en Mailgun
   - Agrega los registros DNS (MX, TXT, CNAME) que Mailgun te proporcione
   - Verifica el dominio antes de enviar correos
   - Plan paid para volumen alto

2. **Alternativas profesionales:** SendGrid, AWS SES, Postmark
3. **Monitoreo:** Implementa logs y alertas para fallos de envío
4. **Rate limiting:** Controla la cantidad de correos enviados
5. **Templates:** Usa plantillas profesionales con branding consistente

## Variables de Entorno Requeridas

### Para Mailgun (Método recomendado)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| MAILGUN_API_KEY | API Key privada | 66c30660a479c2b... |
| MAILGUN_DOMAIN | Dominio de Mailgun | sandbox....mailgun.org |
| MAILGUN_URL | URL de la API | https://api.mailgun.net |
| EMAIL_FROM | Email remitente | postmaster@... |
| EMAIL_FROM_NAME | Nombre remitente | Timeshare Exchange |
| FRONTEND_URL | URL del frontend | http://localhost:5173 |

### Para SMTP (Fallback)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| EMAIL_HOST | Servidor SMTP | smtp.gmail.com |
| EMAIL_PORT | Puerto SMTP | 587 |
| EMAIL_SECURE | Usar SSL (true/false) | false |
| EMAIL_USER | Usuario SMTP | tu-email@gmail.com |
| EMAIL_PASSWORD | Contraseña/API Key | tu-app-password |
| EMAIL_FROM | Email remitente | tu-email@gmail.com |
| EMAIL_FROM_NAME | Nombre remitente | Timeshare Exchange |
| FRONTEND_URL | URL del frontend | http://localhost:5173 |

## Prioridad de Configuración

El sistema intenta los proveedores en este orden:
1. **Mailgun SDK** - Si `MAILGUN_API_KEY` y `MAILGUN_DOMAIN` están configurados
2. **SMTP (Nodemailer)** - Si `EMAIL_USER` y `EMAIL_PASSWORD` están configurados
3. **Sin correo** - Logs de advertencia, pero la invitación se crea igual
