-- =============================================================================
-- Migration: 0001_initial_schema
-- Issue #126: Schema Version Control — Commit Migration Files
--
-- This is a BASELINE migration, not a from-scratch one: it reconstructs the
-- schema exactly as it already exists in production, reverse-engineered from
-- information_schema.columns and information_schema.table_constraints (no
-- original CREATE TABLE history survived to migrate from). Every column
-- name, type, nullability, and default below was read directly from the
-- live database, not guessed.
--
-- NOT included, because it wasn't queried and would otherwise be a guess
-- rather than a fact: Row Level Security policies. If RLS is enabled on
-- these tables (it should be, given every table has a user_id column),
-- add a follow-up migration with the actual policies once you've confirmed
-- what's currently active — don't assume this file enables it.
--
-- Table order below is dependency order (referenced tables first) so
-- foreign keys can resolve when this runs against a truly empty database.
-- =============================================================================

-- ── collections ──────────────────────────────────────────────────────────
-- Referenced by: card_definitions, template_fields, user_inventory
create table public.collections (
  id               text primary key,
  user_id          uuid not null references auth.users(id),
  name             text not null,
  is_custom        boolean not null default true,
  import_source    text,
  cover_image_url  text,
  created_at       timestamp with time zone not null default now(),
  updated_at       timestamp with time zone not null default now(),
  deleted_at       timestamp with time zone
);

-- ── binders ──────────────────────────────────────────────────────────────
-- Referenced by: binder_slots
create table public.binders (
  id           text primary key,
  user_id      uuid not null references auth.users(id),
  name         text not null,
  rows         integer not null default 3,
  cols         integer not null default 3,
  pages        integer not null default 10,
  cover_color  text not null default '#e8627a'::text,
  page_color   text not null default 'dark'::text,
  stickers     jsonb not null default '[]'::jsonb,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now(),
  deleted_at   timestamp with time zone
);

-- ── card_definitions ─────────────────────────────────────────────────────
-- References: collections
-- Referenced by: user_inventory
create table public.card_definitions (
  id             text primary key,
  user_id        uuid not null references auth.users(id),
  collection_id  text not null references public.collections(id),
  name           text not null,
  image_url      text,
  holo_type      text not null default 'none'::text,
  attributes     jsonb not null default '{}'::jsonb,
  created_at     timestamp with time zone not null default now(),
  updated_at     timestamp with time zone not null default now(),
  deleted_at     timestamp with time zone
);

-- ── template_fields ──────────────────────────────────────────────────────
-- References: collections
create table public.template_fields (
  id            text primary key,
  user_id       uuid not null references auth.users(id),
  collection_id text not null references public.collections(id),
  field_name    text not null,
  field_type    text not null,
  is_required   boolean not null default false,
  field_order   integer not null default 0,
  options       jsonb not null default '[]'::jsonb,
  created_at    timestamp with time zone not null default now(),
  updated_at    timestamp with time zone not null default now()
);

-- ── binder_slots ─────────────────────────────────────────────────────────
-- References: binders
create table public.binder_slots (
  id             text primary key,
  user_id        uuid not null references auth.users(id),
  binder_id      text not null references public.binders(id),
  card_def_id    text not null,
  collection_id  text not null,
  page_number    integer not null,
  slot_index     integer not null,
  created_at     timestamp with time zone not null default now(),
  updated_at     timestamp with time zone not null default now()
);

-- ── user_inventory ───────────────────────────────────────────────────────
-- References: card_definitions, collections
create table public.user_inventory (
  id                    text primary key,
  user_id               uuid not null references auth.users(id),
  card_def_id           text not null references public.card_definitions(id),
  collection_id         text not null references public.collections(id),
  is_favorite           boolean not null default false,
  condition_rating      text,
  date_acquired         text,
  notes                 text,
  available_for_trade   boolean not null default false,
  available_for_sale    boolean not null default false,
  created_at            timestamp with time zone not null default now(),
  updated_at            timestamp with time zone not null default now(),
  deleted_at            timestamp with time zone
);

-- ── beta_feedback ────────────────────────────────────────────────────────
-- Standalone, no foreign keys besides user_id.
create table public.beta_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  type        text not null,
  body        text not null,
  created_at  timestamp with time zone default now()
);

-- ── bin ──────────────────────────────────────────────────────────────────
-- The trash-bin snapshot table. Standalone, no foreign keys besides user_id.
create table public.bin (
  id           text primary key,
  user_id      uuid not null references auth.users(id),
  entity_type  text not null,
  deleted_at   timestamp with time zone not null default now(),
  snapshot     jsonb not null
);