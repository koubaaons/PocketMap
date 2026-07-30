// supabase/functions/cache-shared-image/index.ts
//
// Fetches a card image from an external source (currently TCGdex) and
// caches it in the shared card-images bucket, returning its public
// URL — one copy per unique card, reused across every user, exactly
// like the client-side uploadSharedImageIfMissing this replaces.
//
// Why this needs to be server-side at all: TCGdex's asset CDN
// (assets.tcgdex.net) sends no CORS headers whatsoever, so a
// browser-side fetch() to read the image bytes is blocked outright —
// not specific to any one deployed domain, every browser enforces
// this. Running the fetch here instead sidesteps the problem
// entirely, since CORS is a browser-only enforcement mechanism; it
// doesn't apply to server-to-server requests at all.
//
// Deploy with: supabase functions deploy cache-shared-image
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

    const { imageUrl, path } = await req.json();
    if (!imageUrl || !path) {
      return jsonResponse({ error: 'imageUrl and path are required' }, 400);
    }

    // Scoped to the caller's own session — only used to confirm this
    // is a genuine, authenticated user before doing any work. The
    // resulting cached image is shared/public once created (same as
    // the client-side version), but the function itself shouldn't be
    // callable by an unauthenticated request.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    // === Same "check if already cached, only fetch/upload if
    // missing" logic as the client-side version this replaces — most
    // calls for a popular card will just hit this and return
    // immediately, without ever re-fetching from TCGdex at all. ===
    const lastSlash = path.lastIndexOf('/');
    const folder = lastSlash === -1 ? '' : path.slice(0, lastSlash);
    const filename = lastSlash === -1 ? path : path.slice(lastSlash + 1);
    const { data: existing } = await supabase.storage.from(CARD_IMAGES_BUCKET).list(folder, { search: filename });
    if ((existing ?? []).some((f) => f.name === filename)) {
      const { data: urlData } = supabase.storage.from(CARD_IMAGES_BUCKET).getPublicUrl(path);
      return jsonResponse({ url: urlData.publicUrl }, 200);
    }

    // Not cached yet — fetch it here, server-side, where TCGdex's
    // missing CORS headers simply don't matter.
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return jsonResponse({ error: `image fetch failed (${imageRes.status})` }, 502);
    }
    const imageBlob = await imageRes.blob();

    const { error: uploadError } = await supabase.storage
      .from(CARD_IMAGES_BUCKET)
      .upload(path, imageBlob, { contentType: imageBlob.type || 'image/jpeg', upsert: true });
    if (uploadError) {
      return jsonResponse({ error: uploadError.message }, 500);
    }

    const { data: urlData } = supabase.storage.from(CARD_IMAGES_BUCKET).getPublicUrl(path);
    return jsonResponse({ url: urlData.publicUrl }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
