# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [2.0.0] - 2025-01-26

### 🎉 Refactorización Completa

Esta es una **refactorización completa** del proyecto con mejoras significativas en código, arquitectura y experiencia de usuario.

### ✨ Añadido

#### Arquitectura
- **Módulos ES6**: Código completamente modularizado y separado en archivos independientes
- **`js/constants.js`**: Centralización de todas las constantes y configuración
- **`js/utils.js`**: Funciones de utilidad reutilizables y robustas
- **`js/toast.js`**: Sistema de notificaciones tipo toast con animaciones
- **`js/sync.js`**: Gestión mejorada de sincronización con Supabase
- **`js/calculator.js`**: Módulo independiente para la calculadora principal
- **`js/reimbursements.js`**: Módulo independiente para reembolsos
- **`js/split.js`**: Módulo independiente para divisor rápido
- **`js/app.js`**: Orquestador principal que coordina todos los módulos
- **`css/styles.css`**: Estilos separados del HTML

#### Funcionalidades
- Sistema de notificaciones toast elegantes con 4 tipos (info, success, warning, error)
- Indicador visual de estado de sincronización en tiempo real
- Banner de estado offline automático
- Migración automática de datos entre versiones
- Versionado de estado para compatibilidad futura
- Mejor gestión de errores con reintentos automáticos
- Detección de estado online/offline
- Cache de elementos del DOM para mejor performance

#### Documentación
- **`SUPABASE_SETUP.md`**: Guía completa paso a paso para configurar Supabase
- **`config.example.js`**: Archivo de ejemplo bien documentado con instrucciones SQL
- **`CHANGELOG.md`**: Este archivo para trackear cambios
- README.md completamente reescrito con estructura clara
- Comentarios JSDoc en funciones importantes

### 🔄 Cambiado

#### Sincronización
- Reescrito completamente el sistema de sincronización
- Polling más robusto con manejo de errores
- Mejor detección de cambios remotos con hashing
- Sincronización bidireccional más confiable
- Callbacks estructurados para eventos de sync
- Manejo adecuado del flag `isApplyingRemote` para evitar loops

#### Código
- De 1614 líneas en un solo archivo a módulos separados y mantenibles
- Eliminación de código duplicado
- Uso de constantes en lugar de magic numbers
- Funciones puras y sin efectos secundarios cuando es posible
- Mejor separación de responsabilidades
- Uso de clases ES6 para encapsulación

#### UI/UX
- Feedback visual mejorado en todas las acciones
- Mensajes de error más descriptivos
- Estados de carga visibles
- Animaciones suaves con CSS transitions
- Mejor accesibilidad (ARIA labels, roles, etc.)
- Responsive design mejorado

#### Seguridad
- Validación XSS consistente con `escapeHtml()`
- Función `copyToClipboard` más robusta
- Generación de UUIDs con `crypto.randomUUID`
- Mejor validación de inputs
- config.js correctamente en .gitignore con backup del anterior

### 🐛 Corregido

- **Bug crítico**: Sincronización que no funcionaba correctamente
- **Bug**: División por cero en cálculo de proporciones
- **Bug**: Polling infinito sin detener al cerrar pestaña
- **Bug**: Condiciones de carrera en `isApplyingRemote`
- **Bug**: Manejo incorrecto de errores que no informaba al usuario
- **Bug**: Cache del Service Worker con nombre incorrecto ("finanzas" vs "a-medias")
- **Bug**: Inconsistencia en redondeo de céntimos
- **Bug**: Función `uid()` poco robusta (ahora usa crypto.randomUUID)
- **Bug**: Magic numbers sin constantes descriptivas
- **Bug**: localStorage sin try-catch que podía crashear la app
- **Bug**: Debounce manual frágil (ahora función reutilizable)

### 🔒 Seguridad

- Protección contra XSS consistente en toda la app
- Credenciales de Supabase ahora en config.example.js como plantilla
- .gitignore actualizado para proteger config.js y archivos sensibles
- Validación mejorada de entradas de usuario
- Headers de seguridad en requests de Supabase

### 📝 Mejoras de Código

- Eliminación de ~1400 líneas de código mezclado
- Separación clara de concerns
- Código más testeable y mantenible
- Uso de async/await consistente
- Manejo de promesas mejorado
- Uso de template literals para HTML
- Destructuring de objetos para legibilidad

### 🎨 Estilos

- CSS separado en archivo independiente
- Variables CSS para theming
- Animaciones con keyframes
- Clases utilitarias reutilizables
- Media queries para responsive
- Preparación para modo oscuro (estructura lista)

### 📦 Service Worker

- Cache actualizado con nuevos archivos
- Nombre correcto: "a-medias-v2.0"
- Lista completa de assets a cachear
- Mejor estrategia de cache stale-while-revalidate

### 🗑️ Eliminado

- Código muerto y no utilizado
- Comentarios obsoletos
- Funciones duplicadas
- Magic numbers hardcodeados
- Dependencias innecesarias

---

## [1.0.0] - 2024-08-31

### Añadido
- Versión inicial de la aplicación
- Calculadora de división mensual
- Sistema de reembolsos
- Divisor rápido
- PWA básica con Service Worker
- Sincronización básica con Supabase
- Modo offline

### Limitaciones conocidas (resueltas en v2.0)
- Todo el código en un solo archivo HTML
- Sincronización poco confiable
- Sin sistema de notificaciones
- Manejo de errores básico
- Sin indicadores de estado de sync
- Código difícil de mantener

---

## Tipos de cambios

- **Añadido**: para nuevas funcionalidades
- **Cambiado**: para cambios en funcionalidad existente
- **Deprecado**: para funcionalidades que serán eliminadas
- **Eliminado**: para funcionalidades eliminadas
- **Corregido**: para corrección de bugs
- **Seguridad**: en caso de vulnerabilidades
