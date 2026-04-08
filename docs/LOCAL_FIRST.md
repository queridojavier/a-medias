# Sistema Local First - A Medias v3.1

## Arquitectura

Tu app usa un sistema **100% Local First** con **cifrado AES-GCM**:

✅ **No requiere backend**  
✅ **Funciona 100% offline**  
✅ **Cero costos de servidor**  
✅ **Cifrado de extremo a extremo**  
✅ **QR generado localmente**  

## Almacenamiento

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| **IndexedDB** | `storage-local.js` | Datos locales (50MB+) |
| **URL Cifrada** | `share-url.js` | Compartir con AES-GCM |
| **Sincronización** | `sync-hybrid.js` | Orquesta todo |

## Cómo Funciona el Cifrado

```
1. Datos → Comprimir (gzip) → Cifrar (AES-GCM) → Base64
2. URL: ?d=datos_cifrados&v=2#clave_aes
                               ↑ Solo en cliente
```

La clave va en el **hash (#)** de la URL, que **nunca se envía al servidor**.

## Uso

### Compartir datos
1. Click en "Crear enlace seguro"
2. Comparte la URL (incluye clave en el hash)
3. El otro dispositivo abre la URL

### Backup
```javascript
await hybridSync.exportAllData();
// Descarga: a-medias-backup-FECHA.json
```

## Desarrollo

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000
```

## Futuro (Firebase)

Si necesitas sincronización en tiempo real, puedes añadir Firebase:

```javascript
// js/sync-firebase.js (futuro)
import { getDatabase, ref, onValue } from 'firebase/database';
```

Firebase plan gratuito incluye:
- 50K lecturas/día
- 20K escrituras/día
- 10GB almacenamiento

---

**v3.1** - Cifrado AES-GCM + QR local
