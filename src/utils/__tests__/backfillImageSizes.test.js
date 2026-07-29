// @vitest-environment jsdom
/**
 * @fileoverview Tests for backfillImageSizes.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockList = vi.fn();
const mockUpdate = vi.fn();

// Configurable per-table select behavior, set fresh in each test.
let selectHandlers = {};
function defaultEmptyChain() {
  const emptyResult = { data: [], error: null };
  const eqResult = {
    is: () => ({ not: () => Promise.resolve(emptyResult) }),
    then: (resolve) => Promise.resolve(emptyResult).then(resolve),
  };
  return { eq: () => eqResult };
}

const mockFrom = vi.fn((table) => ({
  select: (...args) => selectHandlers[table]?.(...args) ?? defaultEmptyChain(),
  update: (...args) => mockUpdate(table, ...args),
}));

vi.mock('../../services/supabase.js', () => ({
  supabase: {
    storage: { from: () => ({ list: (...args) => mockList(...args) }) },
    from: (...args) => mockFrom(...args),
  },
}));

vi.mock('../supabaseImageUpload.js', () => ({
  CARD_IMAGES_BUCKET: 'card-images',
  getStoragePathFromUrl: (url) => {
    const base = 'https://storage.example.com/card-images';
    if (!url || !url.startsWith(base)) return null;
    return url.slice(base.length + 1);
  },
}));

describe('backfillImageSizes', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockUpdate.mockReset().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    selectHandlers = {};
  });

  it('backfills a custom card\'s size by matching its filename against the user\'s own Storage folder', async () => {
    mockList.mockImplementation((folder) => {
      if (folder === 'user-1') return Promise.resolve({ data: [{ name: 'abc123.jpg', metadata: { size: 50000 } }], error: null });
      return Promise.resolve({ data: [], error: null });
    });
    selectHandlers['card_definitions'] = () => ({
      eq: () => ({ is: () => ({ not: () => Promise.resolve({
        data: [{ id: 'cd-1', image_url: 'https://storage.example.com/card-images/user-1/abc123.jpg' }],
        error: null,
      }) }) }),
    });

    const { backfillImageSizes } = await import('../backfillImageSizes.js');
    await backfillImageSizes('user-1');

    expect(mockUpdate).toHaveBeenCalledWith('card_definitions', { image_size_bytes: 50000 });
  });

  it('does NOT backfill a shared/API-imported card image — its filename never appears in the user\'s own folder listing at all', async () => {
    mockList.mockResolvedValue({ data: [{ name: 'abc123.jpg', metadata: { size: 50000 } }], error: null }); // user's own folder
    selectHandlers['card_definitions'] = () => ({
      eq: () => ({ is: () => ({ not: () => Promise.resolve({
        // A shared, TCGdex-cached image — a completely different path, not under user-1/ at all
        data: [{ id: 'cd-1', image_url: 'https://storage.example.com/card-images/tcgdex-cache/some-card.jpg' }],
        error: null,
      }) }) }),
    });

    const { backfillImageSizes } = await import('../backfillImageSizes.js');
    await backfillImageSizes('user-1');

    expect(mockUpdate).not.toHaveBeenCalledWith('card_definitions', expect.anything());
  });

  it('backfills sticker sizes within a binder\'s stickers JSON array, leaving stickers that already have a size untouched', async () => {
    mockList.mockImplementation((folder) => {
      if (folder === 'user-1/stickers') return Promise.resolve({ data: [{ name: 'sticker1.png', metadata: { size: 30000 } }], error: null });
      return Promise.resolve({ data: [], error: null });
    });
    selectHandlers['binders'] = () => ({
      eq: () => Promise.resolve({
        data: [{
          id: 'binder-1',
          stickers: [
            { id: 's1', image_url: 'https://storage.example.com/card-images/user-1/stickers/sticker1.png' }, // missing size
            { id: 's2', image_url: 'https://storage.example.com/card-images/user-1/stickers/sticker2.png', imageSizeBytes: 9999 }, // already has one
          ],
        }],
        error: null,
      }),
    });

    const { backfillImageSizes } = await import('../backfillImageSizes.js');
    await backfillImageSizes('user-1');

    const updateCall = mockUpdate.mock.calls.find(c => c[0] === 'binders');
    expect(updateCall[1].stickers[0].imageSizeBytes).toBe(30000); // filled in
    expect(updateCall[1].stickers[1].imageSizeBytes).toBe(9999); // untouched
  });

  it('does nothing for a binder where every sticker already has a size — no wasted update call', async () => {
    mockList.mockResolvedValue({ data: [], error: null });
    selectHandlers['binders'] = () => ({
      eq: () => Promise.resolve({
        data: [{ id: 'binder-1', stickers: [{ id: 's1', image_url: 'https://x/y.png', imageSizeBytes: 1000 }] }],
        error: null,
      }),
    });

    const { backfillImageSizes } = await import('../backfillImageSizes.js');
    await backfillImageSizes('user-1');

    expect(mockUpdate).not.toHaveBeenCalledWith('binders', expect.anything());
  });
});

describe('runImageSizeBackfillIfNeeded', () => {
  beforeEach(() => {
    localStorage.clear();
    mockList.mockReset().mockResolvedValue({ data: [], error: null });
    selectHandlers = {};
  });

  it('does nothing if userId is falsy', async () => {
    const { runImageSizeBackfillIfNeeded } = await import('../backfillImageSizes.js');
    await runImageSizeBackfillIfNeeded(null);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('sets the localStorage flag after a successful run, and is a no-op on the next call', async () => {
    const { runImageSizeBackfillIfNeeded } = await import('../backfillImageSizes.js');

    await runImageSizeBackfillIfNeeded('user-1');
    expect(localStorage.getItem('backfilled_image_sizes_v1')).toBe('true');

    mockList.mockClear();
    await runImageSizeBackfillIfNeeded('user-1');
    expect(mockList).not.toHaveBeenCalled();
  });
});
