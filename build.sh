#!/bin/bash
# build.sh - Script de build para Netlify
# Genera config.js desde variables de entorno

echo "🔧 Generando config.js desde variables de entorno..."

# Verificar que las variables están definidas
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "⚠️  Variables de entorno SUPABASE_URL y/o SUPABASE_ANON_KEY no definidas"
  echo "📝 Creando config.js vacío (modo local)"
  
  cat > config.js << 'EOF'
// config.js - Generado automáticamente
// Variables de entorno no configuradas - funcionando en modo local
window.__A_MEDIAS_CONFIG__ = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseTable: 'a_medias_shares'
};
EOF

else
  echo "✅ Variables de entorno encontradas"
  
  cat > config.js << EOF
// config.js - Generado automáticamente por el build de Netlify
// NO editar manualmente - se regenera en cada despliegue
window.__A_MEDIAS_CONFIG__ = {
  supabaseUrl: '${SUPABASE_URL}',
  supabaseAnonKey: '${SUPABASE_ANON_KEY}',
  supabaseTable: 'a_medias_shares'
};
EOF

  echo "✅ config.js generado correctamente"
fi

echo "🚀 Build completado"
