/**
 * @fileoverview Tests for userPreferences.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockRpc = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }));

vi.mock('../supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args), rpc: (...args) => mockRpc(...args) },
}));

describe('getUserPreferences', () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();
  });

  it('returns defaults when no row exists yet (brand new account)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { getUserPreferences } = await import('../userPreferences.js');

    const prefs = await getUserPreferences('user-1');

    expect(prefs).toEqual({ seededStarterCollection: false, lastNewSetCheckAt: null, knownSetIds: [], lastCollectionUpdateCheckAt: null });
  });

  it('maps the real row correctly when one exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { seeded_starter_collection: true, last_new_set_check_at: '2026-01-01T00:00:00Z', known_set_ids: ['set-1', 'set-2'] },
      error: null,
    });
    const { getUserPreferences } = await import('../userPreferences.js');

    const prefs = await getUserPreferences('user-1');

    expect(prefs).toEqual({
      seededStarterCollection: true,
      lastNewSetCheckAt: '2026-01-01T00:00:00Z',
      knownSetIds: ['set-1', 'set-2'],
      lastCollectionUpdateCheckAt: undefined,
    });
  });

  it('falls back to defaults (not a throw) if the fetch itself errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('network down') });
    const { getUserPreferences } = await import('../userPreferences.js');

    const prefs = await getUserPreferences('user-1');

    expect(prefs).toEqual({ seededStarterCollection: false, lastNewSetCheckAt: null, knownSetIds: [], lastCollectionUpdateCheckAt: null });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('defaults known_set_ids to an empty array if the column is somehow null', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { seeded_starter_collection: false, last_new_set_check_at: null, known_set_ids: null },
      error: null,
    });
    const { getUserPreferences } = await import('../userPreferences.js');

    const prefs = await getUserPreferences('user-1');

    expect(prefs.knownSetIds).toEqual([]);
  });
});

describe('recordNewSetCheck', () => {
  beforeEach(() => {
    mockUpsert.mockReset().mockResolvedValue({ error: null });
  });

  it('upserts the current timestamp and the given known set ids', async () => {
    const { recordNewSetCheck } = await import('../userPreferences.js');

    await recordNewSetCheck('user-1', ['set-1', 'set-2']);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', known_set_ids: ['set-1', 'set-2'] }),
      { onConflict: 'user_id' }
    );
    const call = mockUpsert.mock.calls[0][0];
    expect(typeof call.last_new_set_check_at).toBe('string');
  });
});

describe('recordCollectionUpdateCheck', () => {
  beforeEach(() => {
    mockUpsert.mockReset().mockResolvedValue({ error: null });
  });

  it('upserts the current timestamp for last_collection_update_check_at', async () => {
    const { recordCollectionUpdateCheck } = await import('../userPreferences.js');

    await recordCollectionUpdateCheck('user-1');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
      { onConflict: 'user_id' }
    );
    const call = mockUpsert.mock.calls[0][0];
    expect(typeof call.last_collection_update_check_at).toBe('string');
  });
});

describe('checkStorageQuota', () => {
  // === CHANGED: no longer reads a maintained counter. Now calls
  // get_storage_usage, a Postgres function that sums usage directly
  // from the actual current data every time — see the comment on
  // checkStorageQuota itself for why the previous counter-based
  // approach was replaced entirely, after three separate drift bugs
  // were found in it.
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('allows an upload that stays within the 10MB quota', async () => {
    mockRpc.mockResolvedValue({ data: 1000, error: null });
    const { checkStorageQuota, STORAGE_QUOTA_BYTES } = await import('../userPreferences.js');

    const result = await checkStorageQuota('user-1', 500);

    expect(mockRpc).toHaveBeenCalledWith('get_storage_usage', { p_user_id: 'user-1' });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1000);
    expect(result.remaining).toBe(STORAGE_QUOTA_BYTES - 1000);
  });

  it('rejects an upload that would push the account over its quota', async () => {
    const { STORAGE_QUOTA_BYTES } = await import('../userPreferences.js');
    mockRpc.mockResolvedValue({ data: STORAGE_QUOTA_BYTES - 100, error: null });
    const { checkStorageQuota } = await import('../userPreferences.js');

    const result = await checkStorageQuota('user-1', 500);

    expect(result.allowed).toBe(false);
  });

  it('allows an upload that lands exactly at the quota (not strictly under it)', async () => {
    const { STORAGE_QUOTA_BYTES } = await import('../userPreferences.js');
    mockRpc.mockResolvedValue({ data: STORAGE_QUOTA_BYTES - 500, error: null });
    const { checkStorageQuota } = await import('../userPreferences.js');

    const result = await checkStorageQuota('user-1', 500);

    expect(result.allowed).toBe(true);
  });

  it('remaining never goes negative even if usage somehow already exceeds the quota', async () => {
    const { STORAGE_QUOTA_BYTES } = await import('../userPreferences.js');
    mockRpc.mockResolvedValue({ data: STORAGE_QUOTA_BYTES + 1000, error: null });
    const { checkStorageQuota } = await import('../userPreferences.js');

    const result = await checkStorageQuota('user-1', 0);

    expect(result.remaining).toBe(0);
  });

  it('treats a failed usage fetch as 0 used (fails open rather than blocking every upload on a transient error) and logs the error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });
    const { checkStorageQuota } = await import('../userPreferences.js');

    const result = await checkStorageQuota('user-1', 500);

    expect(result.used).toBe(0);
    expect(result.allowed).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('formatBytes', () => {
  it('formats sub-KB values in bytes', async () => {
    const { formatBytes } = await import('../userPreferences.js');
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats KB-range values with one decimal', async () => {
    const { formatBytes } = await import('../userPreferences.js');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats MB-range values with one decimal', async () => {
    const { formatBytes } = await import('../userPreferences.js');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('getAllUsersStorageUsage', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls get_all_users_storage_usage and maps the results', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-a', storage_bytes_used: 5000 }, { user_id: 'user-b', storage_bytes_used: 1000 }],
      error: null,
    });
    const { getAllUsersStorageUsage } = await import('../userPreferences.js');

    const result = await getAllUsersStorageUsage();

    expect(mockRpc).toHaveBeenCalledWith('get_all_users_storage_usage');
    expect(result).toEqual([
      { userId: 'user-a', storageBytesUsed: 5000 },
      { userId: 'user-b', storageBytesUsed: 1000 },
    ]);
  });

  it('returns an empty array (not a throw) if the RPC errors — e.g. a non-owner account being denied by the function itself', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: new Error('not authorized') });
    const { getAllUsersStorageUsage } = await import('../userPreferences.js');

    const result = await getAllUsersStorageUsage();

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
