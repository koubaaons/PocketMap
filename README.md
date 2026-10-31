# Pinder

A card collection manager built around the physical experience of collecting.

Most digital collection trackers treat your cards like a spreadsheet. Pinder treats them like a binder — because that's how collectors actually think about their cards. Open a binder, flip through pages, find your holographic Charizard in page 6 slot 4. The physical ritual is the point, and Pinder is the digital version of that ritual.

🔗 **Live app**: [pocket-map-gamma.vercel.app](https://pocket-map-gamma.vercel.app/)  
🔗 **Repository**: [github.com/koubaaons/PocketMap](https://github.com/koubaaons/PocketMap)  
📦 **Latest release**: Pinder v1.0.0 (Milestone 14 Production-Ready)  
📖 **Engineering Journal**: See `Pinder_Development_Journal.pdf` in the repository/release assets  
👩‍💻 **Developer**: Ons Koubaa — Second-year Software Engineering and Management student at the University of Gothenburg  

---

## 🎬 App Preview

### 1. Interactive Physical Binders
Flip through pages spread-by-spread, place cards into specific slots, and customize covers with stickers.

![insidebinder](https://github.com/user-attachments/assets/14e7af9f-ef38-4786-b547-8b1b232c59bb)

### 2. Collection Management & Search
Browse sets, track completion rates, filter owned vs. missing cards, and import full sets.

![collections](https://github.com/user-attachments/assets/f7ec7b34-20e1-4365-b121-58b3509f9d53)

### 3. Add & Browse Card Collections
Explore imported TCG sets, management templates, and add custom cards with ease.

![addcollection](https://github.com/user-attachments/assets/a1b8940a-d832-4d64-95e2-aceb7fe573d7)

### 4. Customizer Studio & High-Resolution Export
Create Binder and Customise it: Choose pastel cover themes, position stickers.

![createandcustomisebinder](https://github.com/user-attachments/assets/c36510d4-25c6-406e-98ee-2f1400d54be0)

### 5. Dark Mode & Export Workflows
Full dark/light theme support across all views with seamless layout previews and export your binder into images or pdf.

![darkmodeandexport](https://github.com/user-attachments/assets/4539dcea-dcf9-4eba-a441-ff683198da63)

---

## What makes it different

* **Physical binder UI** — Cards live in binders with configurable rows, columns, and pages. Navigate page by page or spread by spread with a 3D book-flip animation. Cards occupy specific slots via a `binderId / pageNumber / slotIndex` structure.
* **The Michi Method (Combined Slots & Inserts)** — Merge adjacent slots into custom rectangular spaces to house jumbo cards or decorative custom image inserts from an image library, complete with drag-and-resize positioning.
* **Quantity Tracking & Copy-Based Placement** — Own multiple physical copies of the same card. Each copy tracks its own condition, language, and notes independently, and can be placed into binders up to your owned count.
* **Holographic card effects** — Eight rarity effects ported from the open-source `simeydotme/pokemon-cards-css` technique: Regular, Holo, Galaxy, Rainbow, Gold, V, VStar, and Off. Pointer tracking writes directly to DOM CSS custom properties, bypassing React's re-render cycle.
* **TCGdex API Integration** — Bulk-import sets directly from TCGdex with automatic rarity-to-holo mapping, shared-image server caching to prevent storage duplication, and automated daily update checks for new card releases.
* **Real backend** — Supabase PostgreSQL with Row Level Security, Edge Functions for account deletion, real-time sync across devices, and a strict 10MB private storage quota with WebP compression.
* **Soft delete with 3-section trash** — Binders, collections, cards, and image library assets go to a structured trash bin for selective or full-state restoration before permanent deletion.

---

## Features

### Collections & Cards
* Create collections with custom template fields (text, number, boolean, select) for any franchise.
* Import card data automatically via the TCGdex API set browser.
* Track multiple physical copies per card with individual language, condition, acquisition date, and notes.
* Apply holographic effects (8 types).
* Multiselect bulk actions (bulk own, favorite, declutter) and attribute/entity filters.
* Declutter items to hide them from main views without deleting them.

### Binders & Layouts
* Customisable covers with live sticker placement (drag, rotate, resize, percentage-based sizing).
* **Plan Layout Mode** — Make speculative layout changes, card swaps, or page swaps locally and commit or discard them safely.
* **Binder Export** — Export individual pages, page ranges, or full facing-page spreads to PNG or multi-page PDF via html2canvas/jsPDF (with transparency, slot-number, and badge toggles).
* Persistent drag-and-drop **Add Cards Panel** for fast placement.

### Organisation & Dashboard
* Home dashboard with count-up animations, recent activity feed, and recently added card strip.
* Favorites view and multi-type search view (Cards, Collections, Binders) with deep-linking directly to binder slots.
* Image library for managing decorative background inserts.

### Auth, Account & Safety
* Supabase Auth with session persistence, password reset flow, and secure account deletion via Edge Functions.
* Automated test suite (Vitest, 650+ tests covering hooks, reducers, and validators).

---

## Tech stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 18 + Vite |
| **State** | Custom Redux-style store (reducer/actions pattern) |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) |
| **Styling** | Feature-scoped CSS modules and design tokens |
| **Testing** | Vitest |
| **Export/Utils** | html2canvas, jsPDF, jszip |

---

## Architecture

```text
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
The storage abstraction was designed in Milestone 1 so that swapping localStorage for Supabase required modifying only one file. The user_id field was embedded on every entity from inception to ensure seamless multi-user capability upon introducing authentication.Database schemaManaged via version-controlled migration files in supabase/migrations/. All tables enforce Row Level Security (RLS) policies (auth.uid() = user_id).Plaintextauth.users ──┬──→ binders ──────────┬──→ binder_slots
             │                      └──→ binder_panels ──→ binder_inserts
             ├──→ collections ──┬───→ template_fields
             │                  ├───→ card_definitions ──→ user_inventory
             │                  │                      └──→ binder_slots
             ├──→ user_preferences
             └──→ bin (JSONB snapshots for soft-delete recovery)
Getting startedPrerequisitesNode.js 18+A free Supabase account1. Clone and installBashgit clone [https://github.com/koubaaons/PocketMap.git](https://github.com/koubaaons/PocketMap.git)
cd PocketMap
npm install
2. Configure environment variablesCreate .env.local in the project root:Extrait de codeVITE_SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
VITE_SUPABASE_ANON_KEY=your-publishable-key
3. Run database migrationsExecute the SQL migration scripts sequentially in your Supabase dashboard SQL Editor (supabase/migrations/): from 0001 through the latest schema updates.4. Run tests and start development serverBashnpm run test     # Run Vitest test suite
npm run dev      # Start local dev server at http://localhost:5173
Project structurePlaintextsrc/
├── components/          # Feature views, modals, card grids, binder UI
├── hooks/               # Custom hooks (useStore, useDraggable, useBinderView...)
├── selectors/           # Pure derived state and search/stats aggregators
├── services/            # TCGdex API integration, Supabase client configuration
├── store/               # Store setup, reducers, and Supabase sync routing
├── styles/              # Feature-scoped CSS stylesheets
├── types/               # Factory functions and strict schema validators
└── utils/               # Image compression utilities, WebP converters, export helpers
Milestone historyMilestoneWhat shipped1 — Core ArchitectureCustom store, validation/factory pattern, abstract storage layer2 — CollectionsCollection model, custom template fields, stats selector3 — TemplatesType-safe dynamic attributes, rule enforcement4 — Card DefinitionsDynamic form generation, management lists5 — OwnershipUSER_INVENTORY relation model, condition ratings, favorites6 — Collection ViewsTab filtering (Owned/Missing/Unorganised)7 — Binder V2Slot architecture, grey placeholder logic, schema v2 migration8 — UI FoundationCSS token architecture, theme switcher, layout shell9 — Component PolishHolographic system, 3D book cover flips, sticker customization10 — Auth & ProfileSupabase Auth integration, profile management, feedback form11 — Backend MigrationPostgreSQL tables, RLS policies, Realtime multi-device sync12 — Version 0.3.0 PrepSupabase Storage bucket migration, schema version control, API spikes13 — Import & Advanced UXTCGdex API, quantity tracking, Michi Method combined panels, test suite14 — Production ReadinessStorage quotas, account deletion Edge Function, export engine, Vercel deploymentEngineering journalThe complete record of architectural decisions, iterative dead ends, bug diagnoses, and lessons learned is compiled in Pinder_Development_Journal.pdf (included in release assets).
