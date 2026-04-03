# 🗺️ ExploraWander — Roadmap

> Aplicació web d'exploració i planificació de rutes amb mapes interactius, POIs, gravació GPS i gestió de tracks.

---

## 📊 Estat Actual (v1.0.0 - Abril 2026)

| Àrea | Estat |
|------|--------|
| **Frontend** | ✅ React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| **Mapes** | ✅ Leaflet + react-leaflet + OpenStreetMap |
| **POIs** | ✅ Overpass API + Wikipedia + UNESCO + Info enriquida |
| **Rutes** | ✅ Construcció manual + OSRM + Import/Export (GPX/JSON) |
| **Tracks** | ✅ Gravació GPS (cada 10s) + Background + Import/Export (GPX/JSON) |
| **Búsqueda** | ✅ Nominatim per cercar ubicacions |
| **i18n** | ✅ Castellà, Català i Anglès |
| **Responsive** | ✅ Disseny mòbil complet (bottom sheet + overlay) |
| **Capas mapa** | ✅ Estàndard, Satèl·lit, Topogràfic, Ciclisme |
| **Compartir** | ✅ QR + enllaços dinàmics |
| **Auth** | ✅ Login/Registre amb Supabase (pendent verificació email) |
| **Backend** | ✅ Schema SQL creat (pendent executar a Supabase) |
| **PWA/Offline** | ✅ Service Worker + Cache de tiles + Funcionament offline |
| **Testing** | ⚠️ Configurats, sense tests reals |

---

## ✅ Fase 0 — Fonaments (Completat)

### 🌍 Internacionalització (i18n)
- [x] Configurar i18next
- [x] Fitxers: `es.json`, `ca.json`, `en.json`
- [x] Selector d'idioma a la UI
- [x] Persistència idioma a localStorage
- [x] UI completa traduïda

### 🧪 Dades Híbrides
- [x] Rutes mock (Barcelona Modernista i Gòtica)
- [x] Tracks mock (Montserrat i Banyoles)
- [x] POIs 100% reals (Overpass + Wikipedia)
- [x] Sistema de multi-mirrors per Overpass (4 servidors)

---

## ✅ Fase 1 — MVP Estable (Completat)

### Millores del Mapa
- [x] Routing real amb OSRM
- [x] Capes alternatives (satèl·lit, topogràfic, ciclable)
- [x] Geolocalització amb marcador en temps real
- [x] Zoom adaptatiu en carregar rutes/tracks

### POIs i Búsqueda
- [x] Categories completes amb emojis
- [x] Ranking de qualitat (Wikipedia, UNESCO, patrimoni)
- [x] Descobriment progressiu per Zoom
- [x] Sistema anti-429 (multi-mirrors)
- [x] Info enriquida (horaris, telèfon, web, adreça)
- [x] Filtres per valoració i nº de ressenyes
- [ ] Búsqueda de POIs per nom
- [ ] Filtrat per distància a l'usuari

### UX/UI
- [x] Mode clar/fosc
- [x] **Disseny responsive complet (mòbil/tablet)**
- [x] Toasts de confirmació
- [x] Bottom sheet al mòbil
- [x] Touch targets optimitzats (min 40px)
- [x] Icones de categories més petits
- [ ] Indicador visual de progrés en tracks gravats

### Dades i Persistència
- [x] Exportar rutes a GPX/JSON
- [x] Importar rutes des de GPX/JSON
- [x] Exportar tracks a GPX/JSON
- [x] Backup/restore complet JSON
- [x] Compartir rutes/tracks amb QR i enllaços

### Gravació de Tracks
- [x] Throttle a 10 segons entre punts (arxius més lleugers)
- [x] Background geolocation per a gravació amb pantalla apagada
- [x] Foreground service notification (Android)
- [ ] Indicador visual de progrés en tracks gravats

---

## ☁️ Fase 2 — Supabase (Backend)

### Configuració
- [x] Projecte Supabase creat
- [x] Variables d'entorn configurades
- [x] Client Supabase amb auto-refresh i persistència
- [x] **Schema SQL creat (`routes`, `tracks`)** — fitxer `supabase-schema.sql`
- [x] **RLS (Row Level Security) configurat** — al schema SQL
- [ ] **Executar SQL a Supabase** — copiar/enganxar `supabase-schema.sql` al SQL Editor

### Autenticació
- [x] Login amb email/password
- [x] Registre amb verificació email
- [x] Gestió de sessió (auto-refresh)
- [x] Detecció d'errors (email no verificat, credencials invàlides)
- [x] Reenviament d'email de confirmació
- [ ] **Desactivar verificació email per a desenvolupament (opcional)**
- [ ] Auth social (Google, GitHub)
- [ ] Recuperació de contrasenya
- [ ] Perfil d'usuari (nom, avatar, preferències)

### Emmagatzematge
- [x] Fallback a localStorage quan no hi ha sessió
- [ ] **Verificar que les taules existeixen i funcionen**
- [ ] Sincronització automàtica localStorage → Supabase al fer login
- [ ] Indicador visual d'estat de sincronització

### Funcions Socials
- [ ] Compartir rutes públiques amb enllaç
- [ ] Explorar rutes d'altres usuaris
- [ ] Valoracions i comentaris
- [ ] Perfils públics amb estadístiques

---

## 📱 Fase 3 — Mobile i Offline

### App Nativa Android
- [x] Capacitor 8 integrat
- [x] Permisos GPS configurats
- [x] Keystore de signatura
- [x] Background geolocation plugin instal·lat
- [x] Permisos foreground service i background location
- [ ] Generar APK distribuïble
- [ ] Provar en dispositiu real

### PWA & Offline
- [x] Service Worker amb workbox (generateSW)
- [x] Cache de tiles de mapa (OSM, Esri, OpenTopoMap)
- [x] Instal·lació com a PWA (manifest + install prompt)
- [x] Funcionament offline bàsic (app shell + assets)
- [x] Cache d'APIs (Nominatim, Wikipedia, Overpass, OSRM, Supabase)
- [ ] Notificacions push

### Optimització Mòbil
- [x] Sidebar responsive amb bottom sheet
- [x] Touch targets optimitzats
- [ ] Virtualització de marcadors per molts POIs
- [ ] Clustering de marcadors (leaflet.markercluster)
- [ ] Gestos tàctils (swipe per tancar sidebar)
- [ ] Pull-to-refresh

### Accessibilitat
- [ ] Navegació per teclat completa
- [ ] ARIA labels en components interactius
- [ ] Contrast de colors WCAG AA

---

## 🔬 Fase 4 — Testing i Qualitat

### Testing
- [ ] Tests unitaris (haversine, càlculs de track)
- [ ] Tests de components amb Testing Library
- [ ] Tests E2E amb Playwright
- [ ] Cobertura > 80%

### CI/CD
- [ ] GitHub Actions: lint + typecheck
- [ ] GitHub Actions: tests automàtics
- [ ] Deploy automàtic a Vercel/Netlify
- [ ] Preview deployments per PR

---

## 📋 Control de Versions

### Estructura de Branques
```
main          → Codi en producció
develop       → Integració de features
feature/*     → Noves funcionalitats
fix/*         → Correccions de bugs
```

### Bones Pràctiques
- [x] Commits descriptius
- [x] `.gitignore` configurat
- [x] Publicat a GitHub (`salma1256/explore-wander`)
- [ ] Commits atòmics (Conventional Commits)
- [ ] Tags semàntics (`v0.9.0`, `v1.0.0`)
- [ ] `CHANGELOG.md`

---

## 🎯 Futur (Idees a Llarg Termini)

- [ ] Integració amb Strava/Garmin Connect
- [ ] Rutes generades per IA segons preferències
- [ ] Mode aventura amb reptes i assoliments
- [ ] Integració amb reserves (hotels, restaurants)
- [ ] Mapes col·laboratius
- [ ] API pública per a desenvolupadors
- [ ] Edge Functions de Supabase

---

## 📝 Notes Tècniques

### Stack Tecnològic
```
Frontend:       React 18 + TypeScript + Vite + Tailwind + shadcn/ui
Mapes:          Leaflet + react-leaflet + OpenStreetMap
Estat:          @tanstack/react-query
Backend/DB:     Supabase (PostgreSQL + Auth + Storage)
i18n:           i18next + react-i18next
Mobile:         Capacitor 8 (Android)
Testing:        Vitest + Playwright
```

### Dependències Instal·lades
```
@supabase/supabase-js              → Client Supabase ✅
@capacitor/core, @capacitor/cli, @capacitor/android → App Nativa ✅
@capacitor-community/background-geolocation → Background GPS ✅
i18next, react-i18next             → Internacionalització ✅
leaflet.markercluster              → Clustering (pendent)
vite-plugin-pwa, workbox-window    → PWA/Offline ✅
```

---

## ⚠️ Tasques Pendents Prioritàries

1. **Executar SQL a Supabase** — copiar `supabase-schema.sql` al SQL Editor de Supabase
2. **Verificar/actualitzar credencials Supabase** — les actuals poden ser invàlides
3. **Configurar email de confirmació** a Supabase (o desactivar per a dev)
4. **Generar APK Android** — provar background geolocation en dispositiu real
5. **Clustering de marcadors** — necessari per zones amb molts POIs
6. **Gestos mòbil** — swipe per tancar bottom sheet

---

*Última actualització: Abril 2026 (v1.0.0 - Background & PWA Edition)*
