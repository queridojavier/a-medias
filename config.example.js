// config.example.js
// ============================================
// CONFIGURACIÓN DE EJEMPLO PARA A MEDIAS
// ============================================
//
// IMPORTANTE: Este archivo es solo un ejemplo.
//
// Para activar la sincronización con Supabase:
// 1. Copia este archivo a "config.js" en el mismo directorio
// 2. Reemplaza los valores de ejemplo con tus credenciales reales de Supabase
// 3. NO subas config.js a tu repositorio público (está en .gitignore)
//
// Cómo obtener las credenciales de Supabase:
// 1. Ve a https://supabase.com y crea una cuenta (gratuita)
// 2. Crea un nuevo proyecto
// 3. Ve a Settings > API
// 4. Copia la URL del proyecto y la clave "anon/public"
// 5. Ve a Table Editor y crea una tabla llamada "a_medias_shares" con esta estructura:
//
//    CREATE TABLE a_medias_shares (
//      id BIGSERIAL PRIMARY KEY,
//      share_id TEXT UNIQUE NOT NULL,
//      share_key TEXT NOT NULL,
//      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
//      created_at TIMESTAMPTZ DEFAULT NOW(),
//      updated_at TIMESTAMPTZ DEFAULT NOW()
//    );
//
//    -- Índices para mejorar el rendimiento
//    CREATE INDEX idx_share_id ON a_medias_shares(share_id);
//    CREATE INDEX idx_share_key ON a_medias_shares(share_key);
//
// 6. IMPORTANTE: Configura Row Level Security (RLS) para seguridad:
//
//    -- Habilitar RLS
//    ALTER TABLE a_medias_shares ENABLE ROW LEVEL SECURITY;
//
//    -- Política: Solo puedes leer/actualizar si conoces la share_key
//    CREATE POLICY "Los usuarios pueden leer sus propios shares"
//    ON a_medias_shares FOR SELECT
//    USING (true);
//
//    CREATE POLICY "Los usuarios pueden insertar shares"
//    ON a_medias_shares FOR INSERT
//    WITH CHECK (true);
//
//    CREATE POLICY "Los usuarios pueden actualizar shares con la key correcta"
//    ON a_medias_shares FOR UPDATE
//    USING (true);
//
// ============================================

window.__A_MEDIAS_CONFIG__ = {
  // URL de tu proyecto de Supabase
  // Ejemplo: 'https://xyzcompany.supabase.co'
  supabaseUrl: '',

  // Clave pública/anon de Supabase
  // Ejemplo: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  supabaseAnonKey: '',

  // Nombre de la tabla (no cambies esto a menos que uses otro nombre)
  supabaseTable: 'a_medias_shares'
};

// Si dejas los valores vacíos, la app funcionará SOLO en modo local
// (sin sincronización). Los datos se guardarán únicamente en tu navegador.
