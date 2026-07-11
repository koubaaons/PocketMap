# PINDER

**A card collection manager built around the physical experience of collecting.**

Most digital collection trackers treat your cards like a spreadsheet. Pinder treats them like a binder — because that's how collectors actually think about their cards. Open a binder, flip through pages, find your holographic Charizard in page 6 slot 4. The physical ritual is the point, and Pinder is the digital version of that ritual.

> 🔗 **Repository:** [github.com/koubaaons/PocketMap](https://github.com/koubaaons/PocketMap)  
> 📖 **Engineering Journal:** See `Pinder_Development_Journal.pdf` in the [V1 release assets](https://github.com/koubaaons/PocketMap/releases/tag/v1.0.0)  
> 👩‍💻 **Developer:** Ons Koubaa — first-year engineering student

---

## What makes it different

**Physical binder UI** — Cards live in binders with configurable rows, columns, and pages. Navigate page by page exactly like flipping through a physical binder. Cards occupy specific slots at specific page numbers — `binderId / pageNumber / slotIndex` — not just a flat list.

**Holographic card effects** — Eight rarity effects ported from the open-source `simeydotme/pokemon-cards-css` technique: Regular, Holo, Galaxy, Rainbow, Gold, V, VStar, and Off. Pointer tracking is written directly to the DOM via CSS custom properties, bypassing React's render cycle entirely so moving your mouse over a holo card never triggers a re-render.

**Any franchise** — Not locked to Pokémon. Create custom collections with your own template fields (text, number, boolean, select) for any card game: Winx Club, Digimon, One Piece, Magic, or anything else. One template per collection, enforced at the data layer.

**Real backend** — Supabase PostgreSQL with Row Level Security. Data persists across devices, syncs in real time via Supabase Realtime subscriptions, and survives browser clears. Not a localStorage toy.

**Soft delete with trash** — Nothing is deleted immediately. Cards, collections, and binders go to a trash bin where they can be restored. `deleted_at` in the database makes them invisible without removing the row. Delete forever is a deliberate second action.

---

## Features

### Collections & Cards
- Create collections with custom template fields (any franchise, any card type)
- Add card definitions with name, image, rarity, and custom attribute values
- Mark cards as owned — creates an inventory record with condition, acquisition date, notes
- Mark cards as available for trade or sale
- Holographic effect per card (8 types) — visible in the binder and card detail view
- Search and filter by owned / missing / unorganised / tradeable
- Collection completion ring showing owned vs total

### Binders
- Create binders with configurable rows × columns × pages
- Physical page-flip animation with book-spine rendering
- Cover customisation — pick any colour, add stickers from a sticker library
- Place cards from your owned inventory into specific binder slots
- Move and swap cards between slots with drag-and-drop
- Fullscreen binder mode
- Preview mode — see all cards in colour before saving layout changes

### Organisation
- Home dashboard with stats, recently added cards, and activity feed
- Favorites — star any card, view all favorites in one place
- Search across all collections and card definitions
- Trash / Bin — soft-delete with restore, including full collection restore (all cards + inventory)

### Auth & Account
- Register, log in, and log out via Supabase Auth
- Session persists across page reloads — no re-login on refresh
- User profile with display name, join date, and password change
- Account deletion
- Beta feedback form — type, description, optional screenshot, stored in Supabase

### Data & Sync
- Supabase Realtime — changes sync across devices without page reload
- localStorage cache — app works offline, re-hydrates from Supabase on login
- Fire-and-forget writes — local state updates instantly, Supabase writes in the background
- Per-entity write router — each action type maps to the correct Supabase operation

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite |
| State | Custom Redux-style store — no Redux, no Zustand |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Styling | CSS Modules — 24 feature-scoped stylesheets |
| Routing | Single-page, view-based navigation |
| Type system | Factory + validator pattern (no TypeScript — planned pre-mobile) |

### Architecture

```
UI (Views / Components)
  ↓ dispatch(ACTION)
Store (useStore / useDispatch)
  ↓ reduces
Reducer (ACTIONS / state shape)
  ↓ persists
Storage (dual write)
  ├── localStorage    (instant cache)
  └── Supabase        (source of truth)
       ├── supabaseSync.js     (write router)
       └── supabaseStorage.js  (row converters)

Supporting layers:
  Supabase Auth   → AUTH_SET / HYDRATE into store
  Realtime sync   → HYDRATE on any table change
  Types/Validators → factory + validate before dispatch
  Selectors       → pure derived state, scoped per view
```

The store abstraction was designed from Milestone 1 so that swapping localStorage for Supabase required changing only one file. The `userId` field on every entity was added before auth existed, in preparation for this moment.

---

## Database schema

7 tables in Supabase PostgreSQL. All tables have RLS enabled with `auth.uid() = user_id` policies. Soft delete via `deleted_at timestamptz null` on binders, collections, card_definitions, and user_inventory.

```
auth.users ──┬──→ binders ──────────→ binder_slots
             ├──→ collections ──┬───→ template_fields
             │                  ├───→ card_definitions ──→ user_inventory
             │                  │                      └──→ binder_slots
             └──→ bin (JSONB snapshots for restore)
```

See `supabase/migrations/` for the full schema history.

---

## Getting started

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) account

### 1. Clone and install

```bash
git clone https://github.com/koubaaons/PocketMap.git
cd PocketMap
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings → API Keys** and copy your **Project URL** and **Publishable key**

### 3. Set up environment variables

Create `.env.local` in the project root (never committed):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

### 4. Run database migrations

In your Supabase dashboard → SQL Editor, run each file in `supabase/migrations/` in order:

```
001_initial_schema.sql
002_soft_delete_columns.sql
003_storage_bucket.sql
004_realtime_publications.sql
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), register an account, and start building your collection.

---

## Project structure

```
src/
├── components/
│   ├── collections/     # Card grids, binder slots, completion rings
│   ├── modals/          # Card detail, binder create/edit, slot actions
│   ├── ui/              # Button, Modal, Toast, ConfirmModal, Input
│   └── views/           # HomeView, BinderView, CollectionsView, SearchView…
├── hooks/               # useStore, useDispatch, useAuth, useSupabaseSync…
├── selectors/           # Pure derived state — inventory, search, home stats
├── services/            # supabase.js, apiSources.js
├── store/
│   ├── index.js         # Store creation and dispatch (94 lines)
│   ├── reducer.js       # All state transitions — no side effects
│   ├── storage.js       # localStorage cache layer
│   ├── supabaseSync.js  # Per-entity Supabase write router
│   └── supabaseStorage.js # Row converters and loadStateFromSupabase
├── styles/              # 24 CSS files — tokens, components, feature-scoped
├── types/               # Factory + validator for every entity type
└── utils/               # generateId, image compression, misc helpers
```

---

## Milestone history

| Milestone | What shipped |
|-----------|-------------|
| [1 — Data Model](https://github.com/koubaaons/PocketMap/milestone/1) | Custom store, entity types, factory/validator pattern, localStorage persistence |
| [2 — Collections](https://github.com/koubaaons/PocketMap/milestone/2) | Collection creation, template fields, card definitions, custom schemas |
| [3 — Inventory](https://github.com/koubaaons/PocketMap/milestone/3) | Mark cards as owned, acquisition details, favorites |
| [4 — Binders](https://github.com/koubaaons/PocketMap/milestone/4) | Physical binder layout, slot placement, page navigation |
| [5 — Bin / Trash](https://github.com/koubaaons/PocketMap/milestone/5) | Soft-delete with restore for binders, collections, and cards |
| [6 — Search](https://github.com/koubaaons/PocketMap/milestone/6) | Cross-collection search, ownership filter, sort |
| [7 — Slot Architecture](https://github.com/koubaaons/PocketMap/milestone/7) | binderId / pageNumber / slotIndex triple, move/swap, drag-and-drop |
| [8 — Design System](https://github.com/koubaaons/PocketMap/milestone/8) | Token system, dark/light theme, 24 CSS files |
| [9 — Component Polish](https://github.com/koubaaons/PocketMap/milestone/9) | Holographic effects, binder animation, sticker system, fullscreen, image compression |
| [10 — Auth](https://github.com/koubaaons/PocketMap/milestone/10) | Supabase Auth, registration, login, profile, beta feedback form |
| [11 — Backend](https://github.com/koubaaons/PocketMap/milestone/11) | PostgreSQL schema, per-entity writes, soft-delete in Supabase, Realtime sync |

---

## Roadmap

**V1 is complete.** The app is a full-stack React application with real auth, a real database, real-time sync, and a distinctive physical collection experience that no other app in this space offers.

**V2 — in development:**

| Milestone | What's coming |
|-----------|---------------|
| 12 — Pre-V2 Prep | Supabase Storage migration, schema version control, API validation spike |
| 13 — Import System | Pokémon TCG API, Yu-Gi-Oh API, One Piece API, CSV import with AI column mapping, batch photo upload |
| 14 — Statistics | Completion %, rarity breakdown, acquisition timeline, collection ranking |
| 15 — Card Recognition | AI Vision API — scan a physical card and it fills in the form |
| 16 — Trade & Social | Trade lists, request flow, public profiles, collection gifting |
| 17 — Collector Experience | Wishlist, Collection Wrapped, pack ripping, hand-drawn card art |
| 18 — Mobile | React Native, iOS + Android, camera integration |
| 19 — Ons Mode | The signature aesthetic — fairy theme, hand-drawn art, creator section |
| 20 — Advanced Statistics | Value tracking, price history, cross-collector comparison |
| 21 — Platform & Scale | react-virtuoso, CDN, caching, error monitoring, analytics |

---

## Engineering journal

The full development history — every architectural decision, what went wrong, what was corrected, and what would be done differently — is documented in `Pinder_Development_Journal.pdf`, available as a release asset on the [V1 release page](https://github.com/koubaaons/PocketMap/releases/tag/v1.0.0).

It covers 11 milestones, the reasoning behind the custom store architecture, the holographic effects system, the Supabase migration, and honest retrospectives on every major decision.

---

## Acknowledgements

Holographic card effects adapted from [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) — the genuine CSS compositing technique for per-rarity shine effects. The pointer tracking in this app bypasses React's render cycle by writing directly to DOM CSS custom properties, a pattern derived from understanding how the original technique works at the browser level.

---

*Built by Ons Koubaa · First-year engineering student · 2025–2026*
