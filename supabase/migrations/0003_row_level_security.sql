-- =============================================================================
-- Migration: 0003_row_level_security
-- Issue #126: Schema Version Control — Commit Migration Files
--
-- RLS policies exactly as they exist in production right now, read
-- directly from pg_policies — nothing here is guessed or "completed".
--
-- Worth knowing, not fixing here: beta_feedback only has an INSERT
-- policy, no SELECT/UPDATE/DELETE. That may be intentional (users
-- submit feedback but never need to read it back through the app),
-- or it may be a gap nobody's hit yet because nothing has tried to
-- read from that table client-side. Confirm which before assuming
-- it needs a fix.
-- =============================================================================

alter table public.beta_feedback     enable row level security;
alter table public.bin               enable row level security;
alter table public.binder_slots      enable row level security;
alter table public.binders           enable row level security;
alter table public.card_definitions  enable row level security;
alter table public.collections       enable row level security;
alter table public.template_fields   enable row level security;
alter table public.user_inventory    enable row level security;

create policy "Users can insert their own feedback"
on public.beta_feedback for insert
with check ( auth.uid() = user_id );

create policy "Users manage their own bin"
on public.bin for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users manage their own binder slots"
on public.binder_slots for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users manage their own binders"
on public.binders for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users manage their own card definitions"
on public.card_definitions for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users manage their own collections"
on public.collections for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users manage their own template fields"
on public.template_fields for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

create policy "Users manage their own inventory"
on public.user_inventory for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );