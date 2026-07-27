// supabase/functions/delete-account/index.ts
//
// Actually deletes the calling user's account — the one part of
// account deletion that genuinely cannot be done from client-side
// code at all. Deleting a user's login (auth.users) requires
// Supabase's admin API, which needs the service role key — a
// credential that must never reach the browser, since it bypasses
// every Row Level Security policy in the database. This function is
// the safe place for that key to live: server-side, never shipped to
// any client.
//
// Deploy with: supabase functions deploy delete-account
//
// Current, correct Deno import syntax as of writing this — Supabase's
// own docs specifically warn against bare specifiers or old
// deno.land/x URLs; npm: with an explicit version is what's
// recommended now.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CARD_IMAGES_BUCKET = 'card-images';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    // === Client scoped to the CALLER's own session — used ONLY to
    // verify who's actually calling. Never used for the privileged
    // operations below. ===
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    // === Admin client — the service role key, safe here since this
    // runs server-side and is never exposed to the browser. Every
    // operation below acts ONLY on user.id, the caller's own verified
    // identity from the check above — never an id taken from the
    // request body, which would let any authenticated caller delete
    // an arbitrary OTHER user's account. ===
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Delete this user's own PRIVATE storage files — everything
    // under their own user-id-prefixed folder. Deliberately NOT
    // touching anything outside that folder: shared, deduplicated
    // card art (imported from TCGdex) lives at a different,
    // non-user-scoped path, and other users' cards still reference
    // those same shared files — deleting them here would be a real
    // bug, not just an oversight.
    const { data: files, error: listError } = await adminClient.storage
      .from(CARD_IMAGES_BUCKET)
      .list(user.id);

    if (!listError && files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      const { error: removeError } = await adminClient.storage.from(CARD_IMAGES_BUCKET).remove(paths);
      if (removeError) console.error('[delete-account] failed to remove some storage files:', removeError);
    }

    // Deletes the auth user itself. Every row across every table for
    // this user is cascade-deleted automatically by the database from
    // here — see migration 0020_cascade_delete_user_data.sql — no
    // separate delete call needed per table.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});