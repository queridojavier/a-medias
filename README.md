# A Medias v2.0 (PWA)

Calculadora inteligente para repartir gastos en pareja de forma justa y transparente.
Funciona en navegador, se puede **instalar como app** (PWA) y **sincroniza automáticamente** entre dispositivos.

## 🚀 Novedades en v2.0

- ✨ **Código modular**: Completamente refactorizado en módulos ES6
- 🔄 **Sincronización mejorada**: Sistema de sync en tiempo real más robusto
- 🎯 **Sistema de notificaciones**: Toasts elegantes para feedback visual
- 📱 **Mejor UX**: Indicadores de carga, estado offline, y animaciones suaves
- 🔒 **Más seguro**: Validación mejorada y protección contra XSS
- 🎨 **CSS separado**: Estilos organizados en archivo independiente
- 📊 **3 módulos principales**:
  - **División mensual**: Reparto proporcional o 50/50 de nóminas
  - **Reembolsos**: Control de gastos grandes con cuotas
  - **Divisor rápido**: Para dividir cuentas al momento

## 🔗 Demo

- GitHub Pages: **https://queridojavier.github.io/finanzas-pareja/**
  (Si clonas el proyecto, tu URL será `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`)

## ✨ Funcionalidades

### División Mensual
- Cálculo **proporcional** según ingresos o **50/50**
- Aportación a fondo común y ajustes manuales
- Redondeo a céntimos y control de límites
- Visualización con gráfico de dona

### Reembolsos
- Registro de gastos grandes adelantados
- División en cuotas personalizables
- Seguimiento de pagos con historial
- Progreso visual de devolución

### Divisor Rápido
- División instantánea para cenas, viajes, etc.
- Distribución inteligente de céntimos sobrantes
- Presets rápidos (2, 3, 4, 6 personas)

### Sincronización
- **Modo local**: Sin configuración, datos en tu navegador
- **Modo compartido**: Sincronización automática en tiempo real
- Enlaces privados seguros con clave única
- Actualización cada 8 segundos en segundo plano
- Indicador visual de estado de sincronización

## 📂 Estructura del Proyecto

```
a-medias/
├── index.html              # HTML principal (simplificado)
├── manifest.json           # Manifiesto PWA
├── sw.js                   # Service Worker (caché y offline)
├── config.example.js       # Ejemplo de configuración
├── config.js               # Tu configuración (NO SUBIR A GIT)
├── SUPABASE_SETUP.md       # Guía completa de configuración
├── css/
│   └── styles.css          # Estilos de la aplicación
├── js/
│   ├── app.js              # Punto de entrada principal
│   ├── constants.js        # Constantes y configuración
│   ├── utils.js            # Utilidades y helpers
│   ├── toast.js            # Sistema de notificaciones
│   ├── sync.js             # Sincronización con Supabase
│   ├── calculator.js       # Módulo de división mensual
│   ├── reimbursements.js   # Módulo de reembolsos
│   └── split.js            # Módulo de divisor rápido
└── icons/
    ├── icon-192.png        # Icono PWA 192x192
    └── icon-512.png        # Icono PWA 512x512
```

## 🚀 Uso local

### Opción 1: Servidor HTTP simple
```bash
# Con Python 3
python3 -m http.server 8000

# O con Node.js (npx)
npx serve

# Abre http://localhost:8000
```

### Opción 2: Abrir directamente
Abre `index.html` en tu navegador (funciona pero sin Service Worker).

> **Nota**: Los Service Workers solo funcionan en `https://` o `http://localhost`.
> Si abres con `file://`, la app funciona pero sin modo offline.

## ⚙️ Configurar Sincronización (Opcional)

La aplicación funciona **perfectamente sin configuración** en modo local. Si quieres sincronizar datos entre dispositivos:

### Guía rápida

1. **Crea una cuenta en [Supabase](https://supabase.com/)** (gratis)
2. **Crea un proyecto** nuevo
3. **Ejecuta este script SQL** en el SQL Editor:

```sql
CREATE TABLE a_medias_shares (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT UNIQUE NOT NULL,
  share_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_id ON a_medias_shares(share_id);
CREATE INDEX idx_share_key ON a_medias_shares(share_key);

ALTER TABLE a_medias_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de shares"
  ON a_medias_shares FOR SELECT USING (true);

CREATE POLICY "Permitir crear shares"
  ON a_medias_shares FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizar shares"
  ON a_medias_shares FOR UPDATE USING (true);
```

4. **Obtén tus credenciales** en Settings > API:
   - Project URL
   - anon/public key

5. **Configura la app**:
```bash
cp config.example.js config.js
# Edita config.js con tus credenciales
```

6. **¡Listo!** Abre la app y crea tu primer enlace compartido.

### Guía completa

Para instrucciones detalladas paso a paso con capturas y solución de problemas, consulta **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

## 🌐 Despliegue

### Opción 1: Netlify (Recomendada) ⭐

Netlify permite configurar las credenciales de Supabase como **variables de entorno seguras**, sin exponerlas en el código.

1. Conecta tu repositorio a [Netlify](https://netlify.com)
2. Configura las variables de entorno en el dashboard:
   - `SUPABASE_URL`: Tu URL de Supabase
   - `SUPABASE_ANON_KEY`: Tu clave anon/public
3. Despliega automáticamente

👉 **Guía completa**: [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md)

### Opción 2: GitHub Pages

> ⚠️ Con GitHub Pages necesitarás que cada usuario configure sus propias credenciales manualmente.

1. Sube los archivos a tu repositorio (rama `main`)
2. Ve a **Settings → Pages**
3. Selecciona:
   - Source: "Deploy from a branch"
   - Branch: `main`
   - Folder: `/ (root)`
4. Guarda y espera ~1 minuto
5. Tu app estará en `https://TU_USUARIO.github.io/NOMBRE_REPO/`

## 📱 Instalar como App (PWA)

### iOS (Safari)
1. Abre la URL en Safari
2. Toca el botón de compartir (cuadro con flecha)
3. Desplázate y toca "Añadir a pantalla de inicio"
4. Confirma

### Android (Chrome)
1. Abre la URL en Chrome
2. Toca el menú (⋮)
3. Selecciona "Instalar app" o "Añadir a pantalla de inicio"

### Escritorio (Chrome/Edge)
1. Abre la URL
2. Mira el icono de "Instalar" en la barra de direcciones
3. Haz clic e instala

## 🛠️ Desarrollo

### Requisitos
- Navegador moderno con soporte ES6 modules
- (Opcional) Servidor HTTP local para probar Service Worker

### Estructura de módulos

```javascript
// app.js - Orquestador principal
import Calculator from './calculator.js';
import ReimbursementsManager from './reimbursements.js';
import SplitCalculator from './split.js';
import syncManager from './sync.js';
import toast from './toast.js';

// Cada módulo es independiente y reutilizable
```

### Constantes configurables

Edita `js/constants.js` para ajustar:
- Intervalos de sincronización
- Delays de debounce
- Valores por defecto
- Duración de notificaciones

### Personalización de estilos

Edita `css/styles.css` para cambiar:
- Colores (variables CSS en `:root`)
- Animaciones
- Espaciados
- Efectos visuales

## 🔒 Seguridad y Privacidad

### Sin Supabase (modo local)
- ✅ Datos guardados solo en tu navegador
- ✅ Nada se envía a internet
- ✅ Máxima privacidad

### Con Supabase (modo compartido)
- ✅ Comunicación encriptada (HTTPS)
- ✅ Enlaces con claves criptográficamente seguras
- ✅ Row Level Security en base de datos
- ⚠️ Cualquiera con el enlace puede leer/editar
- ⚠️ No compartas enlaces públicamente

### Datos que se guardan
- Cantidades de nóminas
- Aportaciones y ajustes
- Reembolsos (conceptos, montos, fechas)
- Preferencias (modo proporcional/50-50)

### Datos que NO se guardan
- ❌ Nombres
- ❌ Emails
- ❌ Cuentas bancarias
- ❌ Información personal identificable

## 🧩 Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Estilos**: Tailwind CSS (CDN)
- **PWA**: Service Worker + Web App Manifest
- **Backend**: Supabase (PostgreSQL + API REST)
- **Formato**: Intl API para monedas y fechas

## ❗ Solución de Problemas

### La sincronización no funciona

**Síntoma**: Botón "Crear enlace seguro" deshabilitado

**Solución**:
1. Verifica que existe `config.js` (no solo el ejemplo)
2. Revisa las credenciales en `config.js`
3. Abre la consola (F12) y busca errores

### Los cambios no se sincronizan

**Síntoma**: Cambios en una pestaña no aparecen en otra

**Solución**:
1. Espera 8 segundos (intervalo de polling)
2. Verifica que ambas pestañas usan el mismo enlace
3. Comprueba que no estás offline
4. Revisa las políticas RLS en Supabase

### Service Worker no actualiza

**Síntoma**: Cambios en el código no se reflejan

**Solución**:
- **Móvil**: Cierra y reabre la app o borra datos del sitio
- **Escritorio**: DevTools → Application → Service Workers → Update

### Error en consola con módulos ES6

**Síntoma**: `Uncaught SyntaxError: Cannot use import statement`

**Solución**:
- Usa un servidor HTTP (no abras con `file://`)
- Verifica que el navegador soporte ES6 modules

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -am 'Añadir nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 🗺️ Roadmap

- [ ] Modo oscuro
- [ ] Exportar/importar datos (JSON)
- [ ] Gráficos de histórico
- [ ] Múltiples cuentas compartidas
- [ ] Categorías personalizables
- [ ] Notificaciones push para recordatorios
- [ ] Soporte para más de 2 personas

## 📄 Licencia

MIT License - Haz lo que quieras, sin garantías.

Incluye el aviso de copyright si redistribuyes.

## 👤 Autor

Creado con ❤️ para una gestión financiera justa y transparente en pareja.

## 🙏 Agradecimientos

- [Tailwind CSS](https://tailwindcss.com/) por los estilos
- [Supabase](https://supabase.com/) por el backend
- [Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) por el formato de monedas

---

**v2.0** - Enero 2025 - Refactorización completa con módulos ES6 y sincronización mejorada
