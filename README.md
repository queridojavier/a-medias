# A Medias v3.1 (PWA Local First)

Calculadora inteligente para repartir gastos en pareja de forma justa y transparente.
Funciona en navegador, se instala como app (PWA), y comparte datos de forma **segura y cifrada**.

## 🚀 Novedades en v3.1

- 🔒 **Cifrado AES-GCM**: Los datos compartidos están cifrados de extremo a extremo
- 🏠 **100% Local First**: No requiere servidor, funciona offline
- 📱 **Sin registro**: Comparte con un enlace, sin cuentas
- 🔗 **URLs cifradas**: La clave va en el hash (#) - nunca se envía al servidor
- 🖼️ **QR local**: Los códigos QR se generan localmente, sin enviar datos externos

## 🔗 Demo

**https://amedias.netlify.app**

## ✨ Funcionalidades

### División Mensual
- Cálculo **proporcional** según ingresos o **50/50**
- Aportación a fondo común y ajustes manuales
- Visualización con gráfico de dona

### Reembolsos
- Registro de gastos grandes adelantados
- División en cuotas personalizables
- Seguimiento de pagos con historial

### Divisor Rápido
- División instantánea para cenas, viajes, etc.
- Presets rápidos (2, 3, 4, 6 personas)

### Compartir (Local First)
- **Modo local**: Datos guardados en tu navegador (IndexedDB)
- **Modo compartido**: Enlace cifrado para sincronizar con otro dispositivo
- Sin backend, sin registro, sin límites

## 📂 Estructura del Proyecto

```
a-medias/
├── index.html              # HTML principal
├── manifest.json           # Manifiesto PWA
├── sw.js                   # Service Worker (offline)
├── css/
│   ├── styles.css          # Estilos principales
│   ├── animations.css      # Animaciones
│   ├── components.css      # Componentes
│   └── navigation.css      # Navegación
├── js/
│   ├── app-hybrid.js       # Punto de entrada
│   ├── constants.js        # Constantes
│   ├── utils.js            # Utilidades
│   ├── toast.js            # Notificaciones
│   ├── storage-local.js    # IndexedDB storage
│   ├── share-url.js        # Compartir vía URL cifrada
│   ├── sync-hybrid.js      # Sistema de sincronización
│   ├── calculator.js       # División mensual
│   ├── reimbursements.js   # Reembolsos
│   └── split.js            # Divisor rápido
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## 🚀 Uso Local

```bash
# Con Python 3
python3 -m http.server 8000

# O con Node.js
npx serve

# Abrir http://localhost:8000
```

## 🔒 Seguridad y Privacidad

### Cómo funciona el cifrado
1. Los datos se comprimen (gzip)
2. Se cifran con **AES-GCM 256 bits**
3. La clave va en el **hash (#)** de la URL
4. El hash **nunca se envía** al servidor

```
https://app.com/?d=datos_cifrados&v=2#clave_secreta
                                      ↑ Solo en cliente
```

### Datos que se guardan
- ✅ Cantidades de nóminas
- ✅ Aportaciones y ajustes
- ✅ Reembolsos (conceptos, montos, fechas)

### Datos que NO se guardan
- ❌ Nombres
- ❌ Emails
- ❌ Cuentas bancarias
- ❌ Información personal

## 📱 Instalar como App (PWA)

### iOS (Safari)
1. Abre la URL en Safari
2. Toca compartir → "Añadir a pantalla de inicio"

### Android (Chrome)
1. Abre la URL en Chrome
2. Menú (⋮) → "Instalar app"

### Escritorio
1. Abre la URL en Chrome/Edge
2. Click en el icono de instalar

## 🧩 Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Estilos**: Tailwind CSS (CDN)
- **PWA**: Service Worker + Web App Manifest
- **Cifrado**: Web Crypto API (AES-GCM)
- **Storage**: IndexedDB (con fallback a localStorage)
- **QR**: qrcode.js (generación local)

## 📄 Licencia

MIT License

---

**v3.1** - Enero 2026 - Cifrado AES-GCM, QR local, arquitectura Local First pura
