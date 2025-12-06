# Desplegar A Medias en Netlify

Esta guía te explica cómo desplegar "A Medias" en Netlify con las credenciales de Supabase configuradas de forma segura.

## ¿Por qué Netlify?

- ✅ **Gratuito** para proyectos personales
- ✅ **Variables de entorno seguras** (no se exponen en el código)
- ✅ **Despliegue automático** desde GitHub
- ✅ **HTTPS incluido**
- ✅ **CDN global** para mejor velocidad

## Paso 1: Conectar con Netlify

1. Ve a [netlify.com](https://netlify.com) y crea una cuenta (puedes usar GitHub)
2. Haz clic en **"Add new site"** → **"Import an existing project"**
3. Selecciona **GitHub** y autoriza el acceso
4. Busca y selecciona tu repositorio de "A Medias"

## Paso 2: Configurar el Build

Netlify debería detectar automáticamente la configuración del archivo `netlify.toml`, pero verifica:

| Campo | Valor |
|-------|-------|
| Build command | `chmod +x build.sh && ./build.sh` |
| Publish directory | `.` |

## Paso 3: Configurar Variables de Entorno

⚠️ **Esto es lo más importante** - aquí van tus credenciales de Supabase de forma segura.

1. En tu sitio de Netlify, ve a: **Site configuration** → **Environment variables**
2. Haz clic en **"Add a variable"**
3. Añade estas dos variables:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (tu clave anon/public) |

4. Haz clic en **"Save"**

> 💡 **Tip**: Puedes obtener estos valores en tu dashboard de Supabase → Settings → API

## Paso 4: Desplegar

1. Haz clic en **"Deploy site"** o simplemente haz push a tu repositorio
2. Netlify construirá tu sitio automáticamente
3. En unos segundos tendrás tu URL (ej: `https://tu-app.netlify.app`)

## Paso 5: Verificar

1. Abre tu nueva URL de Netlify
2. Intenta crear un enlace compartido
3. Si funciona, ¡ya está todo listo! 🎉

## Configurar dominio personalizado (opcional)

1. Ve a **Domain management** → **Add a domain**
2. Sigue las instrucciones para configurar tu dominio

## Despliegue Automático

Cada vez que hagas `git push` a tu rama principal:
- Netlify detectará el cambio
- Ejecutará el build automáticamente
- Tu sitio se actualizará en segundos

## Solución de Problemas

### "El enlace compartido no funciona"

1. Ve a **Deploys** en Netlify
2. Haz clic en el último deploy
3. Revisa los logs del build para ver si hay errores
4. Verifica que las variables de entorno estén correctamente configuradas

### "Variables de entorno no encontradas"

- Asegúrate de que los nombres sean exactamente `SUPABASE_URL` y `SUPABASE_ANON_KEY`
- Después de añadir/cambiar variables, haz un nuevo deploy: **Deploys** → **Trigger deploy**

### Ver logs del build

1. Ve a **Deploys**
2. Haz clic en cualquier deploy
3. Busca las líneas que empiezan con 🔧 y ✅

## Migrar desde GitHub Pages

Si ya tenías la app en GitHub Pages:
1. Desactiva GitHub Pages: **Settings** → **Pages** → **None**
2. Actualiza cualquier enlace que tengas apuntando a la vieja URL
3. Los enlaces compartidos existentes seguirán funcionando si usas la misma base de datos de Supabase
