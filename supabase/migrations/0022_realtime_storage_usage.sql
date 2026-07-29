-- =============================================================================
-- Migration: 0022_realtime_storage_usage
--
-- Replaces the incrementally-maintained storage_bytes_used counter
-- (added in 0021) with real-time aggregate functions. Three separate
-- bugs were found in the increment/decrement approach in quick
-- succession -- "Empty All" never decrementing, replacing a cover
-- sticker never decrementing, and each one was a genuinely different
-- missed code path. That's not a coincidence of carelessness; it's
-- the fundamental fragility of maintaining a running counter via
-- scattered writes across many call sites -- any one missed call
-- anywhere causes permanent, silent drift with no way to
-- self-correct.
--
-- The real fix: don't maintain a counter at all. Compute the total
-- fresh, every time, by summing image_size_bytes directly from the
-- actual current data (custom cards, inserts, sticker JSON). Once an
-- item is genuinely deleted, its row is just gone -- it automatically
-- stops counting, with no decrement call needed anywhere, ever. This
-- eliminates the entire class of bug just found, not just the three
-- specific instances of it.
--
-- get_storage_usage(p_user_id): callable by any authenticated user,
-- for themselves. security invoker (respects RLS) -- if someone
-- passed a DIFFERENT user's id, the underlying SELECTs would still
-- only see rows RLS already lets them see (their own), so this
-- can't leak another account's usage even though it takes a
-- parameter rather than always using auth.uid() implicitly.
--
-- get_all_users_storage_usage(): admin-only, checked explicitly
-- inside the function (same email as the existing RLS policy on
-- user_preferences) since aggregating across every user's rows
-- necessarily requires bypassing RLS, unlike the per-user function.
-- =============================================================================

create or replace function public.get_storage_usage(p_user_id uuid)
returns bigint
language sql
stable
security invoker
as $$
  select
    coalesce((select sum(image_size_bytes) from public.card_definitions where user_id = p_user_id), 0)
    + coalesce((select sum(image_size_bytes) from public.binder_inserts where user_id = p_user_id), 0)
    + coalesce((
        select sum((sticker->>'imageSizeBytes')::bigint)
        from public.binders b, jsonb_array_elements(b.stickers) as sticker
        where b.user_id = p_user_id
      ), 0);
$$;

create or replace function public.get_all_users_storage_usage()
returns table(user_id uuid, storage_bytes_used bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') is distinct from 'koubaons@gmail.com' then
    raise exception 'not authorized';
  end if;

  return query
  select u.id, (
    coalesce((select sum(image_size_bytes) from public.card_definitions where user_id = u.id), 0)
    + coalesce((select sum(image_size_bytes) from public.binder_inserts where user_id = u.id), 0)
    + coalesce((
        select sum((sticker->>'imageSizeBytes')::bigint)
        from public.binders b, jsonb_array_elements(b.stickers) as sticker
        where b.user_id = u.id
      ), 0)
  )::bigint as storage_bytes_used
  from auth.users u
  order by storage_bytes_used desc;
end;
$$;

-- The old counter, its RLS override, and the atomic-increment
-- function are no longer used at all -- every call site now uses the
-- functions above instead. Dropped outright rather than left as dead,
-- misleading schema that looks like it might still be the real
-- mechanism.
drop function if exists public.increment_storage_usage(uuid, bigint);
drop policy if exists "Owner can view all storage usage" on public.user_preferences;
alter table public.user_preferences drop column if exists storage_bytes_used;
