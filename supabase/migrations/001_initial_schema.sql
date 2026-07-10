-- =============================================================================
-- Pinder — Initial Schema Migration
-- Issue #114 — Database Schema & Migrations
--
-- One table per entity, matching the existing JS type definitions in
-- src/types/ exactly. Every table has:
--   - user_id  references auth.users so Supabase knows who owns each row
--   - RLS enabled + a policy so users can only see/write their own data
--   - An index on user_id for query performance
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Also committed to supabase/migrations/001_initial_schema.sql in the repo.
-- =============================================================================


-- ── BINDERS ──────────────────────────────────────────────────────────────────
-- Matches binder.types.js: validateBinder / createBinder
-- stickers is a JSONB array: [{ id, image_url, x, y, rotation, scale }]

create table if not exists binders (
  id            text        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  rows          integer     not null default 3 check (rows between 1 and 10),
  cols          integer     not null default 3 check (cols between 1 and 10),
  pages         integer     not null default 10 check (pages between 1 and 500),
  cover_color   text        not null default '#e8627a',
  page_color    text        not null default 'dark',
  stickers      jsonb       not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table binders enable row level security;

create policy "Users manage their own binders"
  on binders for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists binders_user_id_idx on binders (user_id);


-- ── BINDER SLOTS ─────────────────────────────────────────────────────────────
-- Matches binder.types.js: validateBinderSlot / createBinderSlot
-- A slot = one card placed at a specific page/position in a binder.

create table if not exists binder_slots (
  id              text        primary key,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  binder_id       text        not null references binders(id) on delete cascade,
  card_def_id     text        not null,
  collection_id   text        not null,
  page_number     integer     not null check (page_number >= 1),
  slot_index      integer     not null check (slot_index >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table binder_slots enable row level security;

create policy "Users manage their own binder slots"
  on binder_slots for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists binder_slots_user_id_idx   on binder_slots (user_id);
create index if not exists binder_slots_binder_id_idx on binder_slots (binder_id);


-- ── COLLECTIONS ──────────────────────────────────────────────────────────────
-- Matches collection.types.js: validateCollection / createCollection

create table if not exists collections (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  name             text        not null,
  is_custom        boolean     not null default true,
  import_source    text        null,
  cover_image_url  text        null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table collections enable row level security;

create policy "Users manage their own collections"
  on collections for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists collections_user_id_idx on collections (user_id);


-- ── TEMPLATE FIELDS ──────────────────────────────────────────────────────────
-- Matches collection.types.js: validateTemplateField / createTemplateField
-- field_type: 'text' | 'number' | 'bool' | 'select'
-- options is JSONB array of strings (only used when field_type = 'select')

create table if not exists template_fields (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  collection_id  text        not null references collections(id) on delete cascade,
  field_name     text        not null,
  field_type     text        not null check (field_type in ('text','number','bool','select')),
  is_required    boolean     not null default false,
  field_order    integer     not null default 0,
  options        jsonb       not null default '[]',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table template_fields enable row level security;

create policy "Users manage their own template fields"
  on template_fields for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists template_fields_user_id_idx       on template_fields (user_id);
create index if not exists template_fields_collection_id_idx on template_fields (collection_id);


-- ── CARD DEFINITIONS ─────────────────────────────────────────────────────────
-- Matches collection.types.js: validateCardDefinition / createCardDefinition
-- attributes is JSONB object: { [fieldId]: value } — dynamic per collection
-- holo_type: one of the values in HOLO_TYPES from holoTypes.js

create table if not exists card_definitions (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  collection_id  text        not null references collections(id) on delete cascade,
  name           text        not null,
  image_url      text        null,
  holo_type      text        not null default 'none',
  attributes     jsonb       not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table card_definitions enable row level security;

create policy "Users manage their own card definitions"
  on card_definitions for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists card_definitions_user_id_idx       on card_definitions (user_id);
create index if not exists card_definitions_collection_id_idx on card_definitions (collection_id);


-- ── USER INVENTORY ───────────────────────────────────────────────────────────
-- Matches inventory.types.js: validateInventoryItem / createInventoryItem
-- Existence of a record = owned. No record = not owned. No boolean needed.
-- condition_rating: 'mint'|'near_mint'|'excellent'|'good'|'played'|'poor'|null

create table if not exists user_inventory (
  id                  text        primary key,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  card_def_id         text        not null references card_definitions(id) on delete cascade,
  collection_id       text        not null references collections(id) on delete cascade,
  is_favorite         boolean     not null default false,
  condition_rating    text        null check (
                                    condition_rating in
                                    ('mint','near_mint','excellent','good','played','poor')
                                  ),
  date_acquired       text        null,
  notes               text        null,
  available_for_trade boolean     not null default false,
  available_for_sale  boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table user_inventory enable row level security;

create policy "Users manage their own inventory"
  on user_inventory for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_inventory_user_id_idx      on user_inventory (user_id);
create index if not exists user_inventory_card_def_id_idx  on user_inventory (card_def_id);
create index if not exists user_inventory_collection_id_idx on user_inventory (collection_id);


-- ── BIN (soft-delete trash) ───────────────────────────────────────────────────
-- Matches the bin slice in the store reducer.
-- _type: 'binder' | 'collection' | 'cardDef'
-- snapshot is JSONB — the full entity as it was at deletion time, so
-- restore can recreate it without any other table lookup.

create table if not exists bin (
  id           text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  entity_type  text        not null check (entity_type in ('binder','collection','cardDef')),
  deleted_at   timestamptz not null default now(),
  snapshot     jsonb       not null
);

alter table bin enable row level security;

create policy "Users manage their own bin"
  on bin for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists bin_user_id_idx on bin (user_id);


-- ── GRANTS ───────────────────────────────────────────────────────────────────
-- Explicit INSERT/SELECT/UPDATE/DELETE grants for the authenticated role.
-- RLS policies alone are not sufficient — the role also needs privileges.

grant select, insert, update, delete on binders         to authenticated;
grant select, insert, update, delete on binder_slots    to authenticated;
grant select, insert, update, delete on collections     to authenticated;
grant select, insert, update, delete on template_fields to authenticated;
grant select, insert, update, delete on card_definitions to authenticated;
grant select, insert, update, delete on user_inventory  to authenticated;
grant select, insert, update, delete on bin             to authenticated;