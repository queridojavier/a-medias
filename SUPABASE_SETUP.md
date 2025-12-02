# Configuración de Supabase para A Medias

Esta guía te ayudará a configurar la sincronización en la nube para la aplicación "A Medias" usando Supabase.

## ¿Por qué Supabase?

Supabase es una alternativa open-source a Firebase que ofrece:
- ✅ Capa gratuita generosa (perfecto para uso personal)
- ✅ Base de datos PostgreSQL real
- ✅ API REST automática
- ✅ Seguridad con Row Level Security (RLS)
- ✅ Sin necesidad de tarjeta de crédito

## Paso 1: Crear cuenta en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Regístrate con GitHub, Google o email
4. Es **completamente gratuito** para el uso que le daremos

## Paso 2: Crear un nuevo proyecto

1. Una vez dentro, haz clic en "New Project"
2. Selecciona tu organización (o crea una nueva)
3. Rellena los datos:
   - **Name**: `a-medias` (o el nombre que prefieras)
   - **Database Password**: Genera una contraseña segura (guárdala, pero no la necesitarás para la app)
   - **Region**: Elige la más cercana a ti (ej: `Europe West (Ireland)` para España)
   - **Pricing Plan**: Free
4. Haz clic en "Create new project"
5. Espera 1-2 minutos mientras se crea el proyecto

## Paso 3: Crear la tabla de datos

1. En el menú lateral, ve a **"Table Editor"**
2. Haz clic en "Create a new table"
3. O mejor, ve a **"SQL Editor"** y ejecuta este script:

```sql
-- Crear la tabla principal
CREATE TABLE a_medias_shares (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT UNIQUE NOT NULL,
  share_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_share_id ON a_medias_shares(share_id);
CREATE INDEX idx_share_key ON a_medias_shares(share_key);
CREATE INDEX idx_updated_at ON a_medias_shares(updated_at);

-- Comentarios explicativos
COMMENT ON TABLE a_medias_shares IS 'Almacena los datos compartidos de A Medias';
COMMENT ON COLUMN a_medias_shares.share_id IS 'Identificador único público del share';
COMMENT ON COLUMN a_medias_shares.share_key IS 'Clave secreta para acceder al share';
COMMENT ON COLUMN a_medias_shares.payload IS 'Datos de la aplicación (calculadora, reembolsos, etc.)';
```

4. Haz clic en "Run" (o F5)
5. Deberías ver un mensaje de éxito

## Paso 4: Configurar seguridad (Row Level Security)

**IMPORTANTE**: Por defecto, Supabase permite a cualquiera leer/escribir en tus tablas. Debemos protegerlas.

1. En el **SQL Editor**, ejecuta este script:

```sql
-- Habilitar Row Level Security
ALTER TABLE a_medias_shares ENABLE ROW LEVEL SECURITY;

-- Política: Permitir SELECT a todos (necesario para que funcione)
CREATE POLICY "Permitir lectura de shares"
ON a_medias_shares FOR SELECT
USING (true);

-- Política: Permitir INSERT a todos (para crear nuevos shares)
CREATE POLICY "Permitir crear shares"
ON a_medias_shares FOR INSERT
WITH CHECK (true);

-- Política: Permitir UPDATE solo si conoces la share_key
-- Nota: La validación real de la key se hace en la aplicación
CREATE POLICY "Permitir actualizar shares"
ON a_medias_shares FOR UPDATE
USING (true);

-- Política: NO permitir DELETE (los shares no se pueden borrar desde la app)
-- Si quieres permitir borrado, descomenta estas líneas:
-- CREATE POLICY "Permitir borrar shares"
-- ON a_medias_shares FOR DELETE
-- USING (true);
```

2. Haz clic en "Run"

### ¿Por qué estas políticas?

- La seguridad real viene de que solo quien tiene el `share_key` puede leer/modificar los datos
- Las políticas RLS permiten que la API funcione, pero la validación de la clave se hace en la app
- Nadie puede borrar shares accidentalmente desde la aplicación

## Paso 5: Obtener las credenciales

1. Ve a **Settings > API** (en el menú lateral)
2. Verás dos secciones importantes:

### Project URL
```
https://xyzcompany.supabase.co
```
Copia esta URL completa.

### API Keys
Encontrarás varias claves. La que necesitas es:
- **`anon` `public`**: Esta es la clave pública, segura para usar en el navegador

⚠️ **NO uses la `service_role` key** - esa es privada y tiene acceso total.

## Paso 6: Configurar la aplicación

1. Ve a la carpeta de tu proyecto "A Medias"
2. Busca el archivo `config.example.js`
3. Copia este archivo y renómbralo a `config.js`:

```bash
cp config.example.js config.js
```

4. Abre `config.js` y reemplaza los valores:

```javascript
window.__A_MEDIAS_CONFIG__ = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',  // ← Pega tu URL aquí
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // ← Pega tu clave anon aquí
  supabaseTable: 'a_medias_shares'
};
```

5. Guarda el archivo

## Paso 7: Probar la sincronización

1. Abre la aplicación en tu navegador
2. Deberías ver que el botón "Crear enlace seguro" ahora está activo
3. Haz clic en "Crear enlace seguro"
4. Si todo funciona:
   - Se creará un enlace único
   - Verás el estado "Sincronizado"
   - Podrás copiar el enlace para compartir

5. **Para probar la sincronización**:
   - Copia el enlace completo
   - Ábrelo en otra pestaña o en modo incógnito
   - Cambia algún valor en una pestaña
   - Espera 8 segundos (el tiempo de polling)
   - Los cambios deberían aparecer en la otra pestaña automáticamente

## Verificación en Supabase

Para ver que los datos se están guardando:

1. Ve a **Table Editor** en Supabase
2. Selecciona la tabla `a_medias_shares`
3. Deberías ver una fila con:
   - `share_id`: Un código aleatorio (ej: `a3f9k2m8x1`)
   - `share_key`: Otro código aleatorio más largo
   - `payload`: Un objeto JSON con tus datos
   - `created_at` y `updated_at`: Las fechas

## Solución de problemas

### "No se pudo crear el enlace"

**Causa**: Probablemente las credenciales están mal configuradas.

**Solución**:
1. Verifica que `config.js` existe (no solo `config.example.js`)
2. Revisa que copiaste bien la URL y la clave
3. Asegúrate de no tener espacios extra al copiar
4. Abre la consola del navegador (F12) y busca errores

### "Error al sincronizar. Reintentando..."

**Causa**: La tabla no existe o RLS está bloqueando el acceso.

**Solución**:
1. Ve a Table Editor y verifica que la tabla `a_medias_shares` existe
2. Ejecuta de nuevo el script de RLS del Paso 4
3. Verifica que la tabla tiene las políticas correctas en **Authentication > Policies**

### Los cambios no se sincronizan

**Causa**: El polling está funcionando pero los datos no cambian.

**Solución**:
1. Verifica que estás usando el mismo enlace en ambas pestañas
2. Espera al menos 8 segundos (el intervalo de actualización)
3. Comprueba que no estás en modo offline
4. Abre la consola (F12) y busca mensajes de [A Medias]

### "Guardado solo en este dispositivo"

**Causa**: La configuración no está habilitada.

**Solución**:
- Si no configuraste Supabase: Esto es normal, la app funciona solo en modo local
- Si sí configuraste Supabase: Revisa el archivo `config.js`

## Seguridad y privacidad

### ¿Es seguro?

- ✅ Los enlaces contienen claves aleatorias criptográficamente seguras
- ✅ Solo quien tiene el enlace completo puede acceder a los datos
- ✅ Supabase usa HTTPS (encriptación en tránsito)
- ⚠️ Los datos NO están encriptados en reposo en la base de datos
- ⚠️ Cualquiera con el enlace puede ver Y EDITAR los datos

### Recomendaciones:

1. **Comparte el enlace solo con tu pareja** (por mensaje privado, no público)
2. **No publiques el enlace** en redes sociales o foros
3. Si pierdes el control del enlace, usa "Salir del enlace" y crea uno nuevo
4. Los datos no contienen información altamente sensible, pero trátalos con privacidad

### ¿Qué datos se guardan?

- Nóminas (cantidades)
- Aportaciones al fondo común
- Ajustes entre vosotros
- Reembolsos registrados (conceptos, montos, fechas)
- Modo de reparto (proporcional o 50/50)

**NO se guardan**: nombres, emails, direcciones, cuentas bancarias, ni nada que identifique personalmente.

## Limitar el almacenamiento (opcional)

Si quieres evitar que alguien abuse creando muchos shares:

```sql
-- Limitar a máximo 1000 shares
CREATE OR REPLACE FUNCTION prevent_too_many_shares()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM a_medias_shares) > 1000 THEN
    RAISE EXCEPTION 'Límite de shares alcanzado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_shares_limit
  BEFORE INSERT ON a_medias_shares
  FOR EACH ROW
  EXECUTE FUNCTION prevent_too_many_shares();
```

## Limpieza automática (opcional)

Para borrar shares antiguos no usados (ej: más de 6 meses):

```sql
-- Crear función para limpiar shares viejos
CREATE OR REPLACE FUNCTION cleanup_old_shares()
RETURNS void AS $$
BEGIN
  DELETE FROM a_medias_shares
  WHERE updated_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Ejecutar manualmente cuando quieras:
SELECT cleanup_old_shares();
```

O configura un cron job en Supabase (disponible en planes de pago).

## Costos

### Plan Free de Supabase incluye:
- ✅ 500 MB de almacenamiento de base de datos
- ✅ 2 GB de ancho de banda
- ✅ 50,000 usuarios autenticados activos/mes
- ✅ Proyectos ilimitados

Para "A Medias", esto significa:
- **Almacenamiento**: Un share ocupa ~1-5 KB. Puedes tener miles.
- **Ancho de banda**: Cada sincronización usa ~1-2 KB. Necesitarías miles de sincronizaciones al mes para alcanzar el límite.
- **Usuarios**: No usas autenticación, así que este límite no aplica.

**Conclusión**: El plan gratuito es más que suficiente para uso personal o familiar. 🎉

## Soporte

Si tienes problemas:

1. Revisa la consola del navegador (F12 > Console)
2. Revisa los logs de Supabase (en el dashboard > Logs)
3. Abre un issue en el repositorio de GitHub del proyecto

## Referencias

- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [API REST de Supabase](https://supabase.com/docs/guides/api)
