# Metrika - Marketing Analytics Platform

## Overview
Piattaforma di analytics marketing per Marais, che integra dati da Yandex Direct e catalogo prodotti e-commerce.

**URL Produzione:** https://app.marais.ru

## Tech Stack
- **Framework:** Next.js 16.0.4 (App Router)
- **React:** 19.2.0
- **UI:** shadcn/ui + Radix UI + Tailwind CSS 4
- **Database:** PostgreSQL (via `pg`) + SQLite (via `better-sqlite3`)
- **Auth:** JWT con `jose`
- **Charts:** Recharts
- **Deploy:** Docker + Traefik (reverse proxy)

## Project Structure
```
metrika/
├── docker-compose.yml    # Docker config con Traefik labels
├── deploy.sh            # Script di deploy
└── nextjs-app/
    ├── Dockerfile
    ├── .env             # Variabili d'ambiente (non in git)
    ├── .env.example     # Template variabili
    └── src/
        ├── app/         # Next.js App Router pages
        ├── components/  # React components
        ├── lib/         # Utilities e configurazioni
        ├── hooks/       # React hooks
        └── locales/     # i18n (it.json, ru.json)
```

## Pages
| Route | Descrizione |
|-------|-------------|
| `/` | Home dashboard con servizi disponibili |
| `/login` | Pagina di login |
| `/profile` | Profilo utente, cambio password, lingua |
| `/settings` | Gestione utenti (solo admin) |
| `/yandex-direct` | Dashboard KPI Yandex Direct |
| `/yandex-direct/search` | Analisi Search Queries |
| `/yandex-direct/display` | Analisi Display/YAN |
| `/yandex-direct/consultants` | Valutazione consulenti |
| `/catalog/products` | Catalogo prodotti e-commerce |

## API Routes
| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login utente |
| `/api/auth/logout` | POST | Logout utente |
| `/api/auth/me` | GET | Info utente corrente |
| `/api/users` | GET/POST | Lista/crea utenti |
| `/api/users/[id]` | DELETE | Elimina utente |
| `/api/campaigns` | GET | Lista campagne Yandex |
| `/api/dashboard` | GET | Metriche dashboard |
| `/api/dashboard/metrics-timeline` | GET | Timeline metriche |
| `/api/dashboard/breakdown` | GET | Breakdown per owner |
| `/api/search` | GET | Search queries |
| `/api/display` | GET | Display/YAN data |
| `/api/consultants/performance` | GET | Performance consulenti |
| `/api/sync` | POST | Sincronizza dati Yandex |
| `/api/products` | GET | Lista prodotti con filtri |
| `/api/products/[id]` | GET | Dettaglio singolo prodotto |

## Environment Variables
```bash
# Yandex Direct API
DIRECT_TOKEN=xxx
DIRECT_CLIENT_LOGIN=xxx

# PostgreSQL
POSTGRES_URL=postgresql://user:pass@host:5432/db

# Auth
JS_USER=admin
JS_PASS=password
```

## Key Components
- `AppSidebar` - Sidebar navigazione con menu collassabili
- `PageFilters` - Filtri condivisi (periodo, campagna)
- `SyncStatus` - Widget sincronizzazione Yandex
- `ImageZoom` - Zoom immagini con Dialog
- `ProductDetailSheet` - Sheet laterale dettaglio prodotto
- `ThemeToggle` - Switch tema chiaro/scuro

## i18n
Supporta italiano (`it`) e russo (`ru`). I file di traduzione sono in `src/locales/`.

Hook: `useI18n()` restituisce `{ t, locale, setLocale }`.

## Caching
In-memory cache per filtri prodotti (brands, categories, seasons) con TTL 5 minuti.
File: `src/lib/cache.ts`

## Deploy
```bash
# Dal progetto locale
./deploy.sh

# Oppure manualmente
git push
ssh vps-marais2 "cd /home/skull/production/maraisnext && git pull && docker compose up -d --build"
```

## Server
- **Host:** vps-marais2 (51.250.45.193)
- **User:** skull
- **Path:** `/home/skull/production/maraisnext`
- **Container:** metrika
- **Rete Docker:** wg-pihole (condivisa con Traefik)

## Traefik Config
```yaml
labels:
  - "traefik.enable=true"
  # HTTP
  - "traefik.http.routers.metrika.rule=Host(`app.marais.ru`)"
  - "traefik.http.routers.metrika.entrypoints=web"
  # HTTPS
  - "traefik.http.routers.metrika-secure.rule=Host(`app.marais.ru`)"
  - "traefik.http.routers.metrika-secure.entrypoints=websecure"
  - "traefik.http.routers.metrika-secure.tls=true"
  # Service
  - "traefik.http.services.metrika.loadbalancer.server.port=3000"
```

## Database Schema
### PostgreSQL (Swell - prodotti)
- `products` - Prodotti e-commerce
- `product_images` - Immagini prodotti
- `product_attributes` - Attributi (taglia, colore, stagione)

### SQLite (locale - Yandex Direct)
- `yandex_campaigns` - Campagne
- `yandex_daily_stats` - Statistiche giornaliere
- `yandex_search_queries` - Query di ricerca
- `users` - Utenti applicazione
- `sync_log` - Log sincronizzazioni
