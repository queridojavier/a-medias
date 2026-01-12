# Sistema Local First - A Medias v3.0

## ¿Qué cambió?

Tu app ahora usa un sistema **Local First** que:

✅ **No requiere backend** (Adiós Supabase y sus pausas)
✅ **Funciona 100% offline**
✅ **Cero costos** de servidor
✅ **Privacidad total** - tus datos nunca salen de tu dispositivo (a menos que compartas)
✅ **Compartir fácil** vía URL sin registro
✅ **Escalable** para la App Store

## Arquitectura

### Almacenamiento Local (IndexedDB)

- **Archivo**: `js/storage-local.js`
- **Funcionalidad**: Guarda todos los datos en IndexedDB (con fallback a localStorage)
- **Ventajas**:
  - Más capacidad que localStorage (50MB+ vs 5-10MB)
  - Más robusto y rápido
  - Funciona offline nativamente
  - Sin límites de uso

### Compartir vía URL

- **Archivo**: `js/share-url.js`
- **Funcionalidad**: Comprime y codifica datos en la URL
- **Cómo funciona**:
  1. Comprime los datos con gzip (si el navegador lo soporta)
  2. Codifica en base64 URL-safe
  3. Genera un hash para verificación
  4. Crea una URL compartible

**Ejemplo de URL compartida:**
```
https://tu-app.com/?d=H4sIAAAAAAAAA3...&h=abc123&v=1
```

### Sistema Híbrido

- **Archivo**: `js/sync-hybrid.js`
- **Funcionalidad**: Adapta entre Local First y Supabase (legacy)
- **Modos**:
  - `NONE`: Solo local (por defecto)
  - `URL`: Compartir vía URL
  - `SUPABASE`: Legacy (aún compatible)

## Cómo usar

### Guardar datos (automático)

Los datos se guardan automáticamente en IndexedDB cada vez que haces un cambio.

```javascript
// Internamente:
await hybridSync.saveState(data);
```

### Crear enlace para compartir

1. Click en "Crear enlace seguro"
2. Copia la URL generada
3. Envía la URL a tu pareja

```javascript
const url = await hybridSync.createShareURL(data);
// url: https://tu-app.com/?d=...&h=...&v=1
```

### Abrir enlace compartido

1. Abrir la URL en cualquier dispositivo
2. Los datos se cargan automáticamente
3. Ambos dispositivos pueden editar

### Dejar de compartir

1. Click en "Salir del enlace"
2. Los datos permanecen guardados localmente
3. La URL deja de funcionar

### Exportar backup

```javascript
await hybridSync.exportAllData();
// Descarga: a-medias-backup-2026-01-12.json
```

### Importar backup

```javascript
await hybridSync.importData(file);
```

## Ventajas vs Supabase

| Característica | Supabase (v2.0) | Local First (v3.0) |
|----------------|-----------------|-------------------|
| **Costo** | Gratis con límites | 100% gratis |
| **Pausas** | Sí (inactividad) | Nunca |
| **Requiere cuenta** | Sí | No |
| **Funciona offline** | No | Sí |
| **Privacidad** | Datos en servidor | Datos en tu dispositivo |
| **Setup** | Configurar config.js | Listo para usar |
| **Límite de datos** | ~1GB | ~50MB+ por navegador |

## Limitaciones

1. **Tamaño de URL**: Las URLs tienen límite (~8KB de datos comprimidos)
   - Para tu app de gastos esto es más que suficiente
   - Si los datos crecen mucho, puedes migrar a Firebase

2. **No sync automático**: Los cambios NO se sincronizan en tiempo real
   - Solución: Recargar la página o implementar WebSockets más adelante

3. **No historial de versiones**: Sobrescribe los datos
   - Solución futura: Sistema de versiones con timestamps

## Migración futura a Firebase (opcional)

Si tu app crece y necesitas:
- Sincronización en tiempo real entre dispositivos
- Usuarios ilimitados
- Más capacidad de almacenamiento

Puedes agregar Firebase manteniendo la misma arquitectura:

```javascript
// Futuro: js/sync-firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

// Firebase plan gratuito:
// - 50K lecturas/día
// - 20K escrituras/día
// - 10GB de almacenamiento
// - No se pausa nunca
```

## Siguiente paso: UI Moderna

Ahora que el backend está resuelto, podemos enfocarnos en:

1. **Bottom navigation** (móvil)
2. **Sidebar** (desktop)
3. **Cards con glassmorphism**
4. **Animaciones suaves**
5. **Responsive perfecto**

## Desarrollo local

Para probar:

```bash
# Servidor local simple
python3 -m http.server 8000

# Abrir en navegador
open http://localhost:8000
```

## Producción

Puedes hostear en:
- **Netlify** (gratis)
- **Vercel** (gratis)
- **GitHub Pages** (gratis)
- **Cloudflare Pages** (gratis)

Todos estos servicios son 100% gratis y perfectos para apps Local First.

## Preguntas frecuentes

**¿Los datos son seguros?**
Sí, los datos están en tu dispositivo. Al compartir, la URL contiene los datos codificados pero no encriptados (próxima mejora).

**¿Puedo usar mi base de datos de Supabase actual?**
Sí, el sistema es compatible. Los datos existentes en Supabase quedan ahí, pero la app ya no depende de él.

**¿Funciona en iPhone/Android?**
Sí, funciona en cualquier navegador moderno (Chrome, Safari, Firefox, Edge).

**¿Qué pasa si borro el navegador?**
Los datos se pierden. Por eso es importante hacer backups periódicos o compartir la URL como respaldo.

**¿Cuándo estará en la App Store?**
Para publicar en la App Store necesitas:
1. Convertir a PWA (ya lo es)
2. Empaquetar con Capacitor o PWA Builder
3. Cuenta de Apple Developer ($99/año)
4. Proceso de revisión (~1-2 semanas)

¡Podemos hacerlo cuando estés listo!
