# A Medias (PWA)

Calculadora simple para repartir aportaciones y transferencias mensuales en pareja.  
Funciona en navegador, se puede **instalar como app** (PWA) y **opera offline** tras la primera carga. No usa servidor ni bases de datos: solo `localStorage`.

## 🔗 Demo
- GitHub Pages: **https://queridojavier.github.io/finanzas-pareja/**  
  (Si clonas el proyecto con otro usuario o nombre de repo, tu URL será `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`)

## ✨ Funcionalidades
- Cálculo proporcional por ingresos.
- Aportación a fondo común y ajuste manual (+/−).
- Redondeo a céntimos y control de límites.
- Persistencia local (cada dispositivo guarda sus datos).
- Instalación como PWA en iOS, Android y escritorio.
- Offline tras la primera visita online (Service Worker).

## 📂 Estructura
finanzas-pareja/
├── index.html         # App
├── manifest.json      # Manifiesto PWA
├── sw.js              # Service Worker (caché y offline)
└── icons/
├── icon-192.png   # Icono PWA 192x192
└── icon-512.png   # Icono PWA 512x512

## 🚀 Uso local
**Opción 1:** abrir `index.html` directamente con el navegador.  
**Opción 2:** servir en local (mejor para probar PWA en la red):
```bash
python3 -m http.server 8000
# Abre http://localhost:8000

Nota: los Service Workers solo funcionan en https o http://localhost. Si abres el archivo directamente (file://), tendrás la app pero sin SW.

🌐 Despliegue en GitHub Pages
	1.	Sube los archivos a la rama main.
	2.	Repo → Settings → Pages.
	3.	Build and deployment → Source: Deploy from a branch.
Branch: main y carpeta / (root). Guardar.
	4.	La web quedará disponible en la URL indicada por GitHub Pages.

📱 Instalar como App (PWA)
	•	iOS (Safari): abrir la URL → compartir → Añadir a pantalla de inicio.
	•	Android (Chrome): abrir la URL → menú → Instalar app.
	•	Escritorio (Chrome/Edge): barra de direcciones → icono de “Instalar”.

🛠️ Personalización
	•	Colores y tipografías: edita el <style> y las clases Tailwind en index.html.
	•	Iconos: reemplaza icons/icon-192.png y icons/icon-512.png.
(Fondo salmón con flechas de transferencia y cupido. Tamaños exactos).
	•	Nombre corto y tema: cambia short_name, theme_color y background_color en manifest.json.
	•	Caché: si modificas archivos estáticos, sube la versión del caché en sw.js (const CACHE = 'finanzas-vX').

🔒 Privacidad
	•	No se envían datos a ningún servidor.
	•	Los valores se guardan en localStorage del navegador del usuario.

🧩 Tecnologías
	•	HTML + Tailwind (CDN).
	•	PWA: manifest.json + service worker (sw.js).
	•	Formateo de moneda: Intl.NumberFormat('es-ES', { currency: 'EUR' }).

❗ Problemas frecuentes
	•	No aparece la URL de Pages: verifica que hay archivos en main y que Pages está configurado con main y /.
	•	No se actualiza la app: el SW puede estar sirviendo caché. Forzar recarga dura:
	•	Móvil: cerrar y reabrir la “app” o borrar datos del sitio.
	•	Escritorio (Chrome): DevTools → Application → Service Workers → Update y Clear storage.
	•	Offline no funciona: necesitas una primera visita online para que el SW cachee.

📜 Licencia

MIT. Haz lo que quieras, sin garantías. Incluye el aviso de copyright si redistribuyes.
