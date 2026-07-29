-- =============================================================================
-- Migration: 0023_fix_ambiguous_user_id
--
-- Fixes a real bug in get_all_users_storage_usage (0022): its own
-- RETURNS TABLE(user_id uuid, ...) declares user_id as an output
-- parameter, which PL/pgSQL treats as a variable accessible
-- throughout the function body -- colliding directly with the
-- user_id COLUMN referenced in every subquery's WHERE clause.
-- Postgres correctly refused to guess which one was meant
-- ("column reference \"user_id\" is ambiguous", error 42702).
--
-- Fixed by explicitly qualifying every column reference with its
-- table name, removing any ambiguity, rather than renaming the
-- output parameter (which would require call-site changes too).
-- =============================================================================

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
    coalesce((select sum(card_definitions.image_size_bytes) from public.card_definitions where card_definitions.user_id = u.id), 0)
    + coalesce((select sum(binder_inserts.image_size_bytes) from public.binder_inserts where binder_inserts.user_id = u.id), 0)
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
