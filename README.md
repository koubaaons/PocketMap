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

<img width="1710" height="910" alt="addcollection (1)" src="https://github.com/user-attachments/assets/8418f640-bf0e-4947-a098-7b812ab0c05f" />


### 4. Customizer Studio & High-Resolution Export
Create Binder and Customise it: Choose pastel cover themes, position stickers.

![createandcustomisebinder](https://github.com/user-attachments/assets/c36510d4-25c6-406e-98ee-2f1400d54be0)

### 5. Dark Mode & Export Workflows
Full dark/light theme support across all views with seamless layout previews and export your binder into images or pdf.

![darkmodeandexport](https://github.com/user-attachments/assets/4539dcea-dcf9-4eba-a441-ff683198da63)

---

## What makes it different

- **Physical binder UI.** Cards live in binders with configurable rows, columns, and pages (up to 36). Navigate page by page or spread by spread with a 3D book-flip animation. Cards occupy specific slots via a `binderId / pageNumber / slotIndex` structure.
- **The Michi Method (combined slots and inserts).** Merge adjacent slots into custom rectangular spaces to house jumbo cards or decorative image inserts from an image library, with drag-and-resize positioning.
- **Quantity tracking and copy-based placement.** Own multiple physical copies of the same card. Each copy tracks its own condition, language, and notes, and can be placed into binders up to your owned count.
- **Holographic card effects.** Eight rarity effects ported from the open-source [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) technique: Regular, Holo, Galaxy, Rainbow, Gold, V, VStar, and Off. Pointer tracking writes directly to DOM CSS custom properties, bypassing React's re-render cycle.
- **TCGdex API integration.** Bulk-import sets from TCGdex with automatic rarity-to-holo mapping, server-side shared image caching to prevent storage duplication, and automated daily checks for new releases.
- **Real backend.** Supabase PostgreSQL with Row Level Security, Edge Functions, real-time sync across devices, and a strict 10 MB private storage quota with WebP compression.
- **Soft delete with a three-section trash.** Binders, collections, cards, and image-library assets go to a structured trash bin for selective or full restoration before permanent deletion.

## Features

### Collections and cards
- Create collections with custom template fields (text, number, boolean, select) for any franchise.
- Import card data through the TCGdex set browser.
- Track multiple physical copies per card, each with its own language, condition, acquisition date, and notes.
- Apply holographic effects (8 types).
- Multiselect bulk actions (own, favorite, declutter) and attribute/entity filters.
- Declutter items to hide them from main views without deleting them.

### Binders and layouts
- Customisable covers with live sticker placement (drag, rotate, resize, percentage-based sizing).
- **Plan Layout mode:** make speculative layout changes, card swaps, or page swaps locally, then commit or discard them safely.
- **Three ways to place cards:** drag a card onto a slot, or click a card and then a slot (or a slot and then a card). The Add Cards panel stays open so you can place many in a row. Placed cards can be dragged to another slot, and swap with whatever is there.
- Add Cards and Library panels can be dragged from any empty area and resized.
- First-time hints guide new users through customizing, Plan Layout, and combining slots.
- **Binder export:** individual pages, page ranges, or full facing-page spreads to PNG or multi-page PDF via html2canvas, jsPDF, and jszip, with transparency, slot-number, and badge toggles.

### Organisation and dashboard
- Home dashboard with count-up animations, a recent activity feed, and a recently added card strip.
- Favorites view and multi-type search (cards, collections, binders) with deep links straight to binder slots.
- Image library for managing decorative background inserts.

### Auth, account, and safety
- Supabase Auth with session persistence, a forgot/reset password flow, and secure account deletion via an Edge Function.
- Automated test suite (Vitest and Testing Library, **960+ tests**) covering hooks, reducers, validators, and components.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| State | Custom Redux-style store (reducer/actions pattern) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Styling | Feature-scoped CSS and design tokens |
| Testing | Vitest, Testing Library |
| Export / utils | html2canvas, jsPDF, jszip |
| Hosting | Vercel |

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
```

The storage abstraction was designed in Milestone 1 so that swapping localStorage for Supabase required modifying only one file. A `user_id` field was embedded on every entity from the start, so multi-user support was possible once authentication arrived.

### Database schema

Managed through version-controlled migration files in `supabase/migrations/`. All tables enforce Row Level Security (`auth.uid() = user_id`).

```text
auth.users ──┬──→ binders ──────────┬──→ binder_slots
             │                      └──→ binder_panels ──→ binder_inserts
             ├──→ collections ──┬───→ template_fields
             │                  ├───→ card_definitions ──→ user_inventory
             │                  │                      └──→ binder_slots
             ├──→ user_preferences
             └──→ bin (JSONB snapshots for soft-delete recovery)
```

## Getting started

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) account
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (for Edge Functions)

### 1. Clone and install

```bash
git clone https://github.com/koubaaons/PocketMap.git
cd PocketMap
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

### 3. Set up the database

Run the SQL scripts in `supabase/migrations/` **in order** in your Supabase SQL Editor, from `0001` through the latest. Check each one completed before running the next.

### 4. Deploy the Edge Functions

Edge Functions deploy separately from the app (pushing to Git does not update them):

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy
```

These power account deletion and the shared card-image cache.

### 5. Run tests and start the dev server

```bash
npm run test     # run the Vitest suite
npm run dev      # http://localhost:5173
```

## Project structure

```text
src/
├── components/   # Feature views, modals, card grids, binder UI
├── hooks/        # Custom hooks (useStore, useDraggable, useBinderView...)
├── selectors/    # Pure derived state and search/stats aggregators
├── services/     # TCGdex API integration, Supabase client configuration
├── store/        # Store setup, reducers, and Supabase sync routing
├── styles/       # Feature-scoped CSS
├── types/        # Factory functions and schema validators
└── utils/        # Image compression, WebP conversion, export helpers
```

## Milestone history

| # | Milestone | What shipped |
|---|---|---|
| 1 | Core Architecture | Custom store, validation/factory pattern, abstract storage layer |
| 2 | Collections | Collection model, custom template fields, stats selector |
| 3 | Templates | Type-safe dynamic attributes, rule enforcement |
| 4 | Card Definitions | Dynamic form generation, management lists |
| 5 | Ownership | User inventory relation model, condition ratings, favorites |
| 6 | Collection Views | Tab filtering (Owned / Missing / Unorganised) |
| 7 | Binder V2 | Slot architecture, grey placeholder logic, schema v2 migration |
| 8 | UI Foundation | CSS token architecture, theme switcher, layout shell |
| 9 | Component Polish | Holographic system, 3D book cover flips, sticker customization |
| 10 | Auth and Profile | Supabase Auth integration, profile management, feedback form |
| 11 | Backend Migration | PostgreSQL tables, RLS policies, Realtime multi-device sync |
| 12 | Version 0.3.0 Prep | Storage bucket migration, schema version control, API spikes |
| 13 | Import and Advanced UX | TCGdex API, quantity tracking, Michi Method combined panels, test suite |
| 14 | Production Readiness | Storage quotas, account deletion Edge Function, export engine, Vercel deployment |
| 15 | Tester Feedback and Polish | Click-to-place, drag-to-reposition, whole-panel dragging, onboarding hints, 36-page binders |

## Roadmap

- Social features (profiles, sharing binders), which will also fill the Settings page
- Mobile app
- IoT integration
- A guided first-run welcome for brand-new accounts

## Known limitations

- The backend runs on Supabase's free tier: projects pause after a period of inactivity, and there are monthly bandwidth and email limits.
- Private image uploads are capped at 10 MB per account.

## Engineering journal

The complete record of architectural decisions, dead ends, bug diagnoses, and lessons learned is in `Pinder_Development_Journal.pdf` (included in the release assets).
