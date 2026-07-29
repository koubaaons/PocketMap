-- =============================================================================
-- Migration: 0021_storage_quota
--
-- Backs a 10MB-per-user storage quota on PRIVATE uploads (custom card
-- images, binder cover stickers, library inserts) — deliberately NOT
-- shared card art (imported from TCGdex), which is deduplicated once
-- across every user and doesn't scale with account count the way
-- private uploads do.
--
-- Two pieces:
--
-- 1. Per-file size tracking (image_size_bytes on card_definitions and
--    binder_inserts; stickers get an equivalent field within their
--    existing JSONB entries, not a new column, since they're already
--    stored as a JSON array on binders). This is what makes the
--    running total in (2) able to be DECREMENTED accurately when a
--    file is later deleted — confirmed directly that every private
--    upload path already correctly removes its Storage file on
--    permanent deletion, so tracking the size at upload time is all
--    that's needed to keep the running total correct indefinitely,
--    rather than it only ever growing and eventually locking someone
--    out who's actually freed up space.
--
-- 2. user_preferences.storage_bytes_used — the actual running total
--    checked before every new upload.
--
-- Also adds an RLS policy letting the account owner (matched by
-- email, not a hardcoded id, so it doesn't need updating if the
-- owner's own auth id ever changes) view every row of
-- user_preferences — needed for the admin storage-usage view. This
-- ADDS to the existing "users manage their own preferences" policy
-- rather than replacing it; Postgres RLS policies are OR'd together,
-- so ordinary users still only ever see their own row.
-- =============================================================================

alter table public.card_definitions
  add column if not exists image_size_bytes integer;

alter table public.binder_inserts
  add column if not exists image_size_bytes integer;

alter table public.user_preferences
  add column if not exists storage_bytes_used bigint not null default 0;

create policy "Owner can view all storage usage"
on public.user_preferences for select
using ( auth.jwt() ->> 'email' = 'koubaons@gmail.com' );

-- Atomic increment (or decrement, with a negative delta) of a user's
-- running storage total. A client-side "fetch the current value, add
-- to it, write the result back" pattern has a real race condition if
-- two uploads happen in quick succession — both could read the same
-- starting value and each write back a result that only accounts for
-- their own change, silently losing one of the two increments. A
-- single UPDATE statement incrementing in place is atomic at the
-- database level regardless of how many calls arrive concurrently.
-- Upserts the row if it doesn't exist yet, same as every other
-- user_preferences write in this app.
create or replace function public.increment_storage_usage(p_user_id uuid, p_delta bigint)
returns void
language sql
security invoker
as $$
  insert into public.user_preferences (user_id, storage_bytes_used)
  values (p_user_id, greatest(p_delta, 0))
  on conflict (user_id) do update
    set storage_bytes_used = greatest(public.user_preferences.storage_bytes_used + p_delta, 0);
$$;
