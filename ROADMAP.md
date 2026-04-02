# 🗺️ ExploraMap — Roadmap

> Aplicación web de exploración y planificación de rutas con mapas interactivos, POIs, grabación GPS y gestión de tracks.

---

## 📊 Estado Actual

| Área | Estado |
|------|--------|
| **Frontend** | ✅ React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| **Mapas** | ✅ Leaflet + react-leaflet + OpenStreetMap |
| **POIs** | ✅ Overpass API (10 categorías: museos, castillos, catedrales, restaurantes, lagos, picos, miradores, senderismo, puentes, turístico) |
| **Rutas** | ✅ Construcción manual + Ejemplos Mock (Modernista/Gótica) |
| **Tracks** | ✅ Grabación GPS + Ejemplos Mock (Montserrat/Banyoles) |
| **Búsqueda** | ✅ Nominatim para buscar ubicaciones reales |
| **Persistencia** | ✅ LocalStorage (rutas y tracks) |
| **Testing** | ⚠️ Vitest + Playwright configurados, sin tests reales |
| **i18n** | ✅ Castellano y Catalán implementados |
| **Datos Híbridos** | ✅ Rutas/Tracks de ejemplo (Mock) + llocs (POIs) 100% reals |
| **Repo GitHub** | ❌ No publicado |
| **Backend** | ❌ No implementado |

---

## 🎯 Fase 0 — Fundamentos (Prioritario)

### 🌍 Internacionalización (i18n)
- [x] Configurar librería de i18n (i18next o react-intl)
- [x] Crear ficheros de traducción: `es.json`, `ca.json` y `en.json`
- [x] Selector de idioma en la UI (sidebar)
- [x] Persistir preferencia de idioma en localStorage
- [x] Traducir toda la UI: sidebar, botones, popups, toasts, labels

### 🧪 Datos de Prueba (Híbrido)
- [x] Rutes guardades mock (Barcelona Modernista i Gòtica)
- [x] Tracks gravats mock (Montserrat i Banyoles)
- [x] **Llocs Reals**: 100% Integració amb Overpass i Wikipedia (no hi ha POIs mock)
- [x] Layer de dades: Interfície neta que combina dades de prova i dades locals de l'usuari

---

## 🚀 Fase 1 — MVP Estable

### Mejoras del Mapa
- [x] Routing real con OSRM/GraphHopper
- [x] Capas de mapa alternativas (satélite, topográfico, ciclable)
- [x] Geolocalización del usuario con marcador en tiempo real
- [x] Zoom adaptativo al cargar rutas/tracks guardados

### POIs y Búsqueda
- [ ] Ampliar categorías de POIs (restaurantes, gasolineras, hoteles, farmacias, áreas de descanso)
- [ ] Búsqueda de POIs por nombre (no solo por bounds)
- [ ] Filtrado por distancia al usuario
- [ ] Información enriquecida de POIs (horarios, teléfono, reseñas)

### UX/UI
- [ ] Diseño responsive completo (móvil/tablet)
- [x] Modo claro/oscuro (next-themes ya está instalado)
- [ ] Indicador visual de progreso en tracks grabados
- [x] Toasts de confirmación en acciones (guardar/borrar rutas y tracks)

### Datos y Persistencia
- [ ] Exportar rutas a GPX/KML
- [ ] Importar rutas desde GPX/KML
- [ ] Exportar tracks a GPX
- [ ] Backup/restore de datos desde archivo JSON

---

## ☁️ Fase 2 — Supabase (Backend as a Service)

### Configuración
- [ ] Crear proyecto en Supabase
- [ ] Configurar variables de entorno (`.env`)
- [ ] Instalar `@supabase/supabase-js`
- [ ] Configurar cliente Supabase en `src/lib/supabase.ts`

### Base de Datos
- [ ] Tabla `users` (perfil de usuario)
- [ ] Tabla `routes` (rutas guardadas con PostGIS)
- [ ] Tabla `tracks` (tracks grabados con PostGIS)
- [ ] Tabla `shared_routes` (rutas compartidas públicamente)
- [ ] Políticas RLS (Row Level Security) para privacidad

### Autenticación
- [ ] Auth con email/password
- [ ] Auth social (Google, GitHub)
- [ ] Protección de rutas privadas
- [ ] Gestión de sesión y refresh tokens

### Funciones Sociales
- [ ] Compartir rutas públicas con enlace
- [ ] Explorar rutas de otros usuarios
- [ ] Valoraciones y comentarios en rutas
- [ ] Perfiles de usuario con estadísticas

### Funciones Avanzadas
- [ ] Planificación de rutas multi-día con etapas
- [ ] Integración con datos meteorológicos (OpenWeatherMap)
- [ ] Estimación de tiempo y dificultad de rutas planificadas
- [ ] Puntos de interés a lo largo de una ruta (no solo cercanos)

---

## 📱 Fase 3 — Mobile y Offline

### PWA
- [ ] Service Worker para funcionamiento offline
- [ ] Caché de tiles de mapa
- [ ] Instalación como app nativa
- [ ] Notificaciones push (alertas meteorológicas, recordatorios)

### Optimización
- [ ] Virtualización de marcadores para muchos POIs
- [ ] Clustering de marcadores (leaflet.markercluster)
- [ ] Lazy loading de componentes pesados
- [ ] Code splitting por rutas

### Accesibilidad
- [ ] Navegación por teclado completa
- [ ] ARIA labels en todos los componentes interactivos
- [ ] Contraste de colores WCAG AA
- [ ] Soporte para lectores de pantalla

---

## 🔬 Fase 4 — Testing y Calidad

### Testing
- [ ] Tests unitarios de utilidades (haversine, cálculos de track)
- [ ] Tests de componentes con Testing Library
- [ ] Tests E2E con Playwright (flujos completos de usuario)
- [ ] Cobertura de tests > 80%

### CI/CD con GitHub
- [ ] GitHub Actions para lint + typecheck en cada PR
- [ ] GitHub Actions para ejecutar tests automáticamente
- [ ] Deploy automático a Vercel/Netlify en push a `main`
- [ ] Preview deployments en cada PR

---

## 📋 Control de Versiones — GitHub

### Estructura de Ramas
```
main          → Código en producción
develop       → Integración de features
feature/*     → Nuevas funcionalidades
fix/*         → Correcciones de bugs
release/*     → Preparación de versiones
```

### Buenas Prácticas
- [ ] Commits atómicos y descriptivos (Convencional Commits)
- [ ] Pull Requests con descripción y screenshots
- [ ] Code review antes de mergear a `develop`
- [ ] Tags semánticos para releases (`v0.1.0`, `v1.0.0`)
- [ ] `.gitignore` completo (node_modules, .env, etc.)
- [ ] `README.md` con instrucciones de desarrollo
- [ ] `CHANGELOG.md` para historial de cambios

---

## 🎯 Futuro (Ideas a Largo Plazo)

- [ ] Integración con Strava/Garmin Connect para importar actividades
- [ ] Rutas generadas por IA según preferencias del usuario
- [ ] Modo aventura con retos y logros
- [ ] Integración con reservas (hoteles, restaurantes, actividades)
- [ ] Mapas colaborativos editables por comunidades
- [ ] API pública para desarrolladores
- [ ] Edge Functions de Supabase para lógica serverless

---

## 📝 Notas Técnicas

### Stack Tecnológico
```
Frontend:       React 18 + TypeScript + Vite + Tailwind + shadcn/ui
Mapas:          Leaflet + react-leaflet + OpenStreetMap
Estado:         @tanstack/react-query + Zustand/Context
Backend/DB:     Supabase (PostgreSQL + PostGIS + Auth + Storage)
i18n:           i18next + react-i18next
Testing:        Vitest + Playwright + Testing Library
CI/CD:          GitHub Actions
Deploy:         Vercel / Netlify
```

### Nuevas Dependencias Necesarias
```
i18next, react-i18next       → Internacionalización (Fase 0)
@supabase/supabase-js        → Supabase client (Fase 2)
leaflet.markercluster        → Clustering de marcadores (Fase 3)
```

### Estructura de Archivos (proyectada)
```
src/
├── components/
│   ├── ExplorerMap.tsx       → Componente principal del mapa
│   ├── NavLink.tsx
│   ├── ui/                   → shadcn/ui components
│   └── LanguageSelector.tsx  → ⭐ Selector de idioma (Fase 0)
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── useTranslation.ts     → ⭐ Hook de traducción (Fase 0)
├── lib/
│   ├── overpass.ts           → Integración con Overpass API
│   ├── storage.ts            → Persistencia en LocalStorage
│   ├── mock.ts               → ⭐ Datos mock (Fase 0)
│   ├── supabase.ts           → ⭐ Cliente Supabase (Fase 2)
│   ├── types.ts              → Tipos TypeScript
│   └── utils.ts              → Utilidades
├── locales/
│   ├── es.json               → ⭐ Traducciones Castellano (Fase 0)
│   └── ca.json               → ⭐ Traducciones Catalán (Fase 0)
├── pages/
│   ├── Index.tsx
│   └── NotFound.tsx
└── App.tsx
```

---

*Última actualización: Abril 2026*
