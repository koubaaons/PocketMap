-- =============================================================================
-- Migration: 0009_binder_panels_and_inserts
-- Michi Method support — combining adjacent binder slots into one
-- larger space, holding either a real card (e.g. a Jumbo/oversized
-- promo) or a decorative art insert (not a real card at all — no
-- rarity, no ownership, doesn't affect collection stats).
--
-- binder_inserts: a small personal image library, deliberately
-- separate from card_definitions/collections — an insert has no
-- template fields, no rarity, nothing that makes it a "card". Kept
-- minimal on purpose.
--
-- binder_panels: represents one combined-slot group as a rectangular
-- block (start position + span). binder_slots itself is completely
-- untouched — normal single-card slots keep working exactly as
-- before; a panel is an additive, separate concept sitting alongside
-- them, not a replacement.
-- =============================================================================

create table public.binder_inserts (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  image_url  text not null,
  created_at timestamptz not null default now()
);

alter table public.binder_inserts enable row level security;

create policy "Users can manage their own binder inserts"
on public.binder_inserts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table public.binder_panels (
  id               text primary key,
  binder_id        text not null references public.binders(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  page_number      integer not null,
  start_slot_index integer not null,
  span_cols        integer not null default 1,
  span_rows        integer not null default 1,
  panel_type       text not null check (panel_type in ('card', 'insert')),
  -- Exactly one of these is set, matching panel_type — enforced at
  -- the application layer (createBinderPanel), not a DB constraint,
  -- consistent with how the rest of this schema handles conditional
  -- fields elsewhere.
  card_def_id      text references public.card_definitions(id) on delete cascade,
  insert_id        text references public.binder_inserts(id) on delete cascade,
  created_at       timestamptz not null default now()
);

alter table public.binder_panels enable row level security;

create policy "Users can manage their own binder panels"
on public.binder_panels for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.binder_inserts to authenticated;
grant select, insert, update, delete on public.binder_panels  to authenticated;

alter table public.binder_panels
  add column image_x     numeric not null default 50,
  add column image_y     numeric not null default 50,
  add column image_scale numeric not null default 1;

  alter table public.binder_slots
  add column inventory_item_id text references public.user_inventory(id) on delete set null;
 
-- Same link for card-type combined-slot panels (Michi Method) — a
-- panel holding a real card is still a specific physical copy placed
-- somewhere, same reasoning as binder_slots above.
alter table public.binder_panels
  add column inventory_item_id text references public.user_inventory(id) on delete set null;