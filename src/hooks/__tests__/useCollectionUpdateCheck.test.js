// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCollectionUpdateCheck.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

let mockUser = { id: 'user-1' };
vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

const mockGetUserPreferences = vi.fn();
const mockRecordCollectionUpdateCheck = vi.fn();
vi.mock('../../services/userPreferences.js', () => ({
  getUserPreferences: (...args) => mockGetUserPreferences(...args),
  recordCollectionUpdateCheck: (...args) => mockRecordCollectionUpdateCheck(...args),
}));

const mockFetchAllCardsForSet = vi.fn();
const mockMapCardToDraft = vi.fn();
vi.mock('../../services/activeProvider.js', () => ({
  fetchAllCardsForSet: (...args) => mockFetchAllCardsForSet(...args),
  mapCardToDraft: (...args) => mockMapCardToDraft(...args),
  PROVIDER_KEY: 'pokemon',
}));

const mockUploadCardImageIfAvailable = vi.fn();

const mockImportNewCardsForCollection = vi.fn();
vi.mock('../../services/tcgImport.js', () => ({
  importNewCardsForCollection: (...args) => mockImportNewCardsForCollection(...args),
  uploadCardImageIfAvailable: (...args) => mockUploadCardImageIfAvailable(...args),
}));

function makeCollection(overrides = {}) {
  return { id: 'col-1', name: 'Base Set', external_set_id: 'base1', known_external_card_ids: [], ...overrides };
}

describe('useCollectionUpdateCheck', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
    mockDispatch.mockReset();
    mockGetUserPreferences.mockReset();
    mockRecordCollectionUpdateCheck.mockReset().mockResolvedValue(undefined);
    mockFetchAllCardsForSet.mockReset();
    mockImportNewCardsForCollection.mockReset();
    mockMapCardToDraft.mockReset().mockReturnValue({ sourceImageUrl: null });
    mockUploadCardImageIfAvailable.mockReset();
  });

  it('does nothing while still syncing', async () => {
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({ syncing: true, collections: [], cardDefinitions: [] }));

    await new Promise(r => setTimeout(r, 10));
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it('ignores collections with no external_set_id — custom collections were never imported from anywhere', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false, collections: [{ id: 'col-1', name: 'My Custom Binder', external_set_id: null }], cardDefinitions: [],
    }));

    await waitFor(() => expect(mockRecordCollectionUpdateCheck).toHaveBeenCalled());
    expect(mockFetchAllCardsForSet).not.toHaveBeenCalled();
  });

  it('does not check again if less than a day has passed since the last check', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({ syncing: false, collections: [makeCollection()], cardDefinitions: [] }));

    await waitFor(() => expect(mockGetUserPreferences).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 10));
    expect(mockFetchAllCardsForSet).not.toHaveBeenCalled();
  });

  it('detects a card not present in known ids or existing card definitions as new', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([
      { id: 'ext-1', name: 'Pikachu' },
      { id: 'ext-2', name: 'Charizard' },
    ]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { result } = renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection()],
      cardDefinitions: [{ id: 'cd-1', collectionId: 'col-1', external_card_id: 'ext-1' }],
    }));

    await waitFor(() => expect(result.current.pendingUpdates).toHaveLength(1));
    expect(result.current.pendingUpdates[0].collectionName).toBe('Base Set');
    expect(result.current.pendingUpdates[0].newCards).toEqual([{ id: 'ext-2', name: 'Charizard' }]);
  });

  it('does not flag anything as new when nothing has actually changed', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-1', name: 'Pikachu' }]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { result } = renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection()],
      cardDefinitions: [{ id: 'cd-1', collectionId: 'col-1', external_card_id: 'ext-1' }],
    }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    expect(result.current.pendingUpdates).toEqual([]);
  });

  it('does not re-flag a card already recorded in known_external_card_ids, even if never actually imported (a previously dismissed card)', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-2', name: 'Charizard' }]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { result } = renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection({ known_external_card_ids: ['ext-2'] })], // previously seen + dismissed
      cardDefinitions: [],
    }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    expect(result.current.pendingUpdates).toEqual([]);
  });

  it('dispatches COLLECTION_UPDATE recording every current card id as known, regardless of outcome', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-1', name: 'Pikachu' }, { id: 'ext-2', name: 'Charizard' }]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { ACTIONS } = await import('../../store/index.js');
    renderHook(() => useCollectionUpdateCheck({ syncing: false, collections: [makeCollection()], cardDefinitions: [] }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: ACTIONS.COLLECTION_UPDATE })));
    const call = mockDispatch.mock.calls.find(c => c[0].type === ACTIONS.COLLECTION_UPDATE)[0];
    expect(call.payload.known_external_card_ids).toEqual(expect.arrayContaining(['ext-1', 'ext-2']));
  });

  it('checks multiple imported collections independently', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet
      .mockResolvedValueOnce([{ id: 'ext-1', name: 'New in Set A' }])
      .mockResolvedValueOnce([{ id: 'ext-2', name: 'New in Set B' }]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { result } = renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection({ id: 'col-1', name: 'Set A', external_set_id: 'a' }), makeCollection({ id: 'col-2', name: 'Set B', external_set_id: 'b' })],
      cardDefinitions: [],
    }));

    await waitFor(() => expect(result.current.pendingUpdates).toHaveLength(2));
  });

  it('skips a collection tagged with a DIFFERENT provider — its external_set_id belongs to an ID scheme the current provider knows nothing about', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection({ provider_key: 'some-other-tcg-provider' })],
      cardDefinitions: [],
    }));

    await waitFor(() => expect(mockRecordCollectionUpdateCheck).toHaveBeenCalled());
    expect(mockFetchAllCardsForSet).not.toHaveBeenCalled();
  });

  it('still checks a collection with no provider_key at all — treated as matching the current provider, since there was only ever one before this field existed', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection({ provider_key: undefined })],
      cardDefinitions: [],
    }));

    await waitFor(() => expect(mockFetchAllCardsForSet).toHaveBeenCalledWith('base1'));
  });

  it('checks a collection explicitly tagged with the current provider', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection({ provider_key: 'pokemon' })],
      cardDefinitions: [],
    }));

    await waitFor(() => expect(mockFetchAllCardsForSet).toHaveBeenCalledWith('base1'));
  });

  it('importNewCards() calls importNewCardsForCollection and dispatches the resulting card definitions', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-2', name: 'Charizard' }]);
    mockImportNewCardsForCollection.mockResolvedValue({ cardDefinitions: [{ id: 'cd-new' }], failures: [] });
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCollectionUpdateCheck({ syncing: false, collections: [makeCollection()], cardDefinitions: [] }));

    await waitFor(() => expect(result.current.pendingUpdates).toHaveLength(1));

    let outcome;
    await act(async () => { outcome = await result.current.importNewCards('col-1'); });

    expect(mockImportNewCardsForCollection).toHaveBeenCalledWith('col-1', [{ id: 'ext-2', name: 'Charizard' }]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.CARD_DEFINITION_BULK_ADD, payload: [{ id: 'cd-new' }] });
    expect(outcome).toEqual({ added: 1, failures: [] });
    expect(result.current.pendingUpdates).toEqual([]); // cleared after importing
  });

  it('backfills a missing image when the provider now has one for a card that had none at import time', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-1', name: 'Fire Energy', image: 'https://cdn/fire-energy' }]);
    mockMapCardToDraft.mockReturnValue({ sourceImageUrl: 'https://cdn/fire-energy/high.webp' });
    mockUploadCardImageIfAvailable.mockResolvedValue('https://storage/fire-energy.jpg');
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { ACTIONS } = await import('../../store/index.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection()],
      cardDefinitions: [{ id: 'cd-1', collectionId: 'col-1', external_card_id: 'ext-1', image_url: null }],
    }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith({
      type: ACTIONS.CARD_DEFINITION_UPDATE,
      payload: { id: 'cd-1', image_url: 'https://storage/fire-energy.jpg' },
    }));
  });

  it('does not touch a card that already has an image, even if the provider data changed', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-1', name: 'Pikachu', image: 'https://cdn/pikachu' }]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection()],
      cardDefinitions: [{ id: 'cd-1', collectionId: 'col-1', external_card_id: 'ext-1', image_url: 'https://storage/already-has-one.jpg' }],
    }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled()); // the COLLECTION_UPDATE call still happens
    expect(mockUploadCardImageIfAvailable).not.toHaveBeenCalled(); // but this card was never attempted
  });

  it('does nothing for a card missing an image if the provider still doesn\'t have one either', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-1', name: 'Fire Energy' }]); // still no image field
    mockMapCardToDraft.mockReturnValue({ sourceImageUrl: null });
    mockUploadCardImageIfAvailable.mockResolvedValue(null);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { ACTIONS } = await import('../../store/index.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection()],
      cardDefinitions: [{ id: 'cd-1', collectionId: 'col-1', external_card_id: 'ext-1', image_url: null }],
    }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    const updateCalls = mockDispatch.mock.calls.filter(c => c[0].type === ACTIONS.CARD_DEFINITION_UPDATE);
    expect(updateCalls).toHaveLength(0);
  });

  it('one card failing to backfill does not stop other cards in the same collection from being checked', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([
      { id: 'ext-1', name: 'Broken Energy', image: 'https://cdn/broken' },
      { id: 'ext-2', name: 'Fire Energy', image: 'https://cdn/fire' },
    ]);
    mockMapCardToDraft.mockReturnValue({ sourceImageUrl: 'https://cdn/some-image/high.webp' });
    mockUploadCardImageIfAvailable
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce('https://storage/fire.jpg');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { ACTIONS } = await import('../../store/index.js');
    renderHook(() => useCollectionUpdateCheck({
      syncing: false,
      collections: [makeCollection()],
      cardDefinitions: [
        { id: 'cd-1', collectionId: 'col-1', external_card_id: 'ext-1', image_url: null },
        { id: 'cd-2', collectionId: 'col-1', external_card_id: 'ext-2', image_url: null },
      ],
    }));

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: ACTIONS.CARD_DEFINITION_UPDATE, payload: { id: 'cd-2', image_url: 'https://storage/fire.jpg' },
    })));
    consoleError.mockRestore();
  });

  it('dismiss() clears the pending entry without importing anything', async () => {
    mockGetUserPreferences.mockResolvedValue({ lastCollectionUpdateCheckAt: null });
    mockFetchAllCardsForSet.mockResolvedValue([{ id: 'ext-2', name: 'Charizard' }]);
    const { useCollectionUpdateCheck } = await import('../useCollectionUpdateCheck.js');
    const { result } = renderHook(() => useCollectionUpdateCheck({ syncing: false, collections: [makeCollection()], cardDefinitions: [] }));

    await waitFor(() => expect(result.current.pendingUpdates).toHaveLength(1));
    act(() => result.current.dismiss('col-1'));

    expect(result.current.pendingUpdates).toEqual([]);
    expect(mockImportNewCardsForCollection).not.toHaveBeenCalled();
  });
});