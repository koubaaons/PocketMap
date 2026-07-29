// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinderCoverEditor.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

const mockCompressStickerImage = vi.fn();
vi.mock('../../utils/index.js', () => ({
  compressStickerImage: (...args) => mockCompressStickerImage(...args),
}));

const mockUploadImageToStorage = vi.fn();
const mockDeleteImageFromStorage = vi.fn();
const mockGetStoragePathFromUrl = vi.fn();
const mockDataUrlToBlob = vi.fn();
vi.mock('../../utils/supabaseImageUpload.js', () => ({
  uploadImageToStorage: (...args) => mockUploadImageToStorage(...args),
  deleteImageFromStorage: (...args) => mockDeleteImageFromStorage(...args),
  getStoragePathFromUrl: (...args) => mockGetStoragePathFromUrl(...args),
  dataUrlToBlob: (...args) => mockDataUrlToBlob(...args),
}));

const mockCheckStorageQuota = vi.fn();
vi.mock('../../services/userPreferences.js', () => ({
  checkStorageQuota: (...args) => mockCheckStorageQuota(...args),
  formatBytes: (b) => `${b} B`,
  STORAGE_QUOTA_BYTES: 10 * 1024 * 1024,
}));

// compressStickerImage resolves with a base64 PNG data URL string in
// real life (canvas.toDataURL), not a Blob — this fake string plus
// the dataUrlToBlob mock below replicate that real shape, rather than
// an unrealistic { size: N } mock, which is exactly why the real
// "compressed.size is undefined" bug wasn't caught before.
const FAKE_DATA_URL = 'data:image/png;base64,ZmFrZQ==';

const BINDER = { id: 'binder-1', name: 'My Binder', cover_color: '#ff0000', page_color: '#ffffff', stickers: [] };

describe('useBinderCoverEditor', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockCompressStickerImage.mockReset();
    mockUploadImageToStorage.mockReset();
    mockDeleteImageFromStorage.mockReset().mockResolvedValue(undefined);
    mockGetStoragePathFromUrl.mockReset().mockImplementation((url) => url ? `path/${url}` : null);
    mockDataUrlToBlob.mockReset().mockImplementation(() => ({ size: 50000, type: 'image/png' }));
    mockCheckStorageQuota.mockReset().mockResolvedValue({ allowed: true, used: 0, remaining: 10 * 1024 * 1024 });
  });

  it('starts with isEditingCover false and drafts seeded from the binder', async () => {
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    expect(result.current.isEditingCover).toBe(false);
    expect(result.current.draftName).toBe('My Binder');
    expect(result.current.draftColor).toBe('#ff0000');
    expect(result.current.draftStickers).toEqual([]);
  });

  it('handleEnterCoverEdit turns on edit mode', async () => {
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    act(() => result.current.handleEnterCoverEdit());

    expect(result.current.isEditingCover).toBe(true);
  });

  it('handleCancelCoverEdit discards any draft changes and exits edit mode', async () => {
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    act(() => result.current.handleEnterCoverEdit());
    act(() => result.current.setDraftName('Changed Name'));

    act(() => result.current.handleCancelCoverEdit());

    expect(result.current.isEditingCover).toBe(false);
    expect(result.current.draftName).toBe('My Binder'); // reverted, not "Changed Name"
  });

  it('handleCancelCoverEdit cleans up (Storage delete + quota decrement) a sticker that was added but never saved — the real orphaned-upload bug this fixes', async () => {
    mockCompressStickerImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/new.png');
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    act(() => result.current.handleEnterCoverEdit());
    const fakeEvent = { target: { files: [{ name: 'sticker.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));
    expect(result.current.draftStickers).toHaveLength(1);

    act(() => result.current.handleCancelCoverEdit());

    expect(mockDeleteImageFromStorage).toHaveBeenCalledWith('path/https://storage.example.com/new.png');
  });

  it('handleCancelCoverEdit does NOT clean up a sticker that was already saved before this draft session started', async () => {
    const savedSticker = { id: 'saved-sticker', image_url: 'https://storage.example.com/saved.png', imageSizeBytes: 30000 };
    const binderWithSticker = { ...BINDER, stickers: [savedSticker] };
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithSticker, toast: vi.fn() }));

    act(() => result.current.handleEnterCoverEdit());
    act(() => result.current.handleCancelCoverEdit());

    expect(mockDeleteImageFromStorage).not.toHaveBeenCalled();
  });

  it('handleSaveCoverEdit dispatches BINDER_UPDATE with the draft values, toasts, and exits edit mode', async () => {
    const toast = vi.fn();
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast }));

    act(() => result.current.handleEnterCoverEdit());
    act(() => result.current.setDraftName('New Name'));
    act(() => result.current.setDraftColor('#00ff00'));

    act(() => result.current.handleSaveCoverEdit());

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: ACTIONS.BINDER_UPDATE,
      payload: expect.objectContaining({ name: 'New Name', cover_color: '#00ff00' }),
    }));
    expect(toast).toHaveBeenCalledWith('Cover updated');
    expect(result.current.isEditingCover).toBe(false);
  });

  it('handleSaveCoverEdit falls back to the binder\'s real name when the draft name is blank', async () => {
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    act(() => result.current.setDraftName('   ')); // whitespace-only
    act(() => result.current.handleSaveCoverEdit());

    expect(mockDispatch.mock.calls[0][0].payload.name).toBe('My Binder');
  });

  it('handleSaveCoverEdit cleans up (Storage delete + quota decrement) a sticker that was already saved but got replaced during this edit — the real bug this fixes: replacing a cover sticker (remove old, add new, save) previously orphaned the old file and permanently inflated the tracked total, with no cleanup path at all', async () => {
    const oldSticker = { id: 'old-sticker', image_url: 'https://storage.example.com/old.png', imageSizeBytes: 40000 };
    const binderWithSticker = { ...BINDER, stickers: [oldSticker] };
    mockCompressStickerImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/new.png');
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithSticker, toast: vi.fn() }));

    act(() => result.current.handleEnterCoverEdit());
    act(() => result.current.handleRemoveDraftSticker('old-sticker')); // remove the saved one
    const fakeEvent = { target: { files: [{ name: 'new.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent)); // add a replacement
    mockDeleteImageFromStorage.mockClear();

    act(() => result.current.handleSaveCoverEdit());

    expect(mockDeleteImageFromStorage).toHaveBeenCalledWith('path/https://storage.example.com/old.png');
  });

  it('handleSaveCoverEdit does NOT clean up a sticker that is still present in the final saved list', async () => {
    const keptSticker = { id: 'kept-sticker', image_url: 'https://storage.example.com/kept.png', imageSizeBytes: 20000 };
    const binderWithSticker = { ...BINDER, stickers: [keptSticker] };
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithSticker, toast: vi.fn() }));

    act(() => result.current.handleEnterCoverEdit());
    act(() => result.current.handleSaveCoverEdit()); // saved without removing anything

    expect(mockDeleteImageFromStorage).not.toHaveBeenCalled();
  });

  it('handleAddStickerClick sets an error instead of opening the file picker once MAX_STICKERS is reached', async () => {
    const binderWithSticker = { ...BINDER, stickers: [{ id: 'sticker-1' }] };
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithSticker, toast: vi.fn() }));

    const clickSpy = vi.fn();
    act(() => { result.current.stickerFileInputRef.current = { click: clickSpy }; });

    act(() => result.current.handleAddStickerClick());

    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.current.stickerUploadError).toContain('Maximum 1 stickers');
  });

  it('handleStickerFileSelected compresses, converts to a real Blob, checks quota, uploads, and adds a new sticker to the draft, selecting it', async () => {
    mockCompressStickerImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/sticker.png');
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    const fakeEvent = { target: { files: [{ name: 'sticker.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));

    expect(mockDataUrlToBlob).toHaveBeenCalledWith(FAKE_DATA_URL);
    expect(mockCheckStorageQuota).toHaveBeenCalledWith('user-1', 50000);
    expect(result.current.draftStickers).toHaveLength(1);
    expect(result.current.draftStickers[0].image_url).toBe('https://storage.example.com/sticker.png');
    expect(result.current.draftStickers[0].imageSizeBytes).toBe(50000);
    expect(result.current.selectedStickerId).toBe(result.current.draftStickers[0].id);
  });

  it('rejects the upload and sets an error message, without uploading, when over quota', async () => {
    mockCompressStickerImage.mockResolvedValue(FAKE_DATA_URL);
    mockCheckStorageQuota.mockResolvedValue({ allowed: false, used: 10 * 1024 * 1024, remaining: 0 });
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    const fakeEvent = { target: { files: [{ name: 'sticker.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));

    expect(mockUploadImageToStorage).not.toHaveBeenCalled();
    expect(result.current.draftStickers).toHaveLength(0);
    expect(result.current.stickerUploadError).toContain('Storage limit reached');
  });

  it('handleStickerFileSelected sets an error message when the file fails to compress/read', async () => {
    mockCompressStickerImage.mockRejectedValue(new Error('bad file'));
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    const fakeEvent = { target: { files: [{ name: 'bad.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));

    expect(result.current.stickerUploadError).toContain('Could not read that image');
    expect(result.current.draftStickers).toHaveLength(0);
  });

  it('handleStickerFileSelected does nothing if no file was actually selected', async () => {
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    const fakeEvent = { target: { files: [], value: '' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));

    expect(mockCompressStickerImage).not.toHaveBeenCalled();
  });

  it('handleRemoveDraftSticker removes an already-saved sticker from the draft WITHOUT touching Storage (that only happens through the real permanent-delete path later)', async () => {
    const binderWithSticker = { ...BINDER, stickers: [{ id: 'sticker-1', image_url: 'https://x/saved.png', imageSizeBytes: 1000 }] };
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithSticker, toast: vi.fn() }));

    act(() => result.current.setSelectedStickerId('sticker-1'));
    act(() => result.current.handleRemoveDraftSticker('sticker-1'));

    expect(result.current.draftStickers).toHaveLength(0);
    expect(result.current.selectedStickerId).toBe(null);
    expect(mockDeleteImageFromStorage).not.toHaveBeenCalled();
  });

  it('handleRemoveDraftSticker DOES clean up Storage + quota for a sticker that was only ever local (uploaded then removed in the same session, never saved)', async () => {
    mockCompressStickerImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/sticker.png');
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    const fakeEvent = { target: { files: [{ name: 'sticker.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));
    const newId = result.current.draftStickers[0].id;

    act(() => result.current.handleRemoveDraftSticker(newId));

    expect(mockDeleteImageFromStorage).toHaveBeenCalledWith('path/https://storage.example.com/sticker.png');
  });

  it('handleChangeDraftSticker patches only the matching sticker by id', async () => {
    const binderWithStickers = { ...BINDER, stickers: [{ id: 'sticker-1', x: 10, y: 10 }, { id: 'sticker-2', x: 50, y: 50 }] };
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithStickers, toast: vi.fn() }));

    act(() => result.current.handleChangeDraftSticker('sticker-1', { x: 20 }));

    const s1 = result.current.draftStickers.find(s => s.id === 'sticker-1');
    const s2 = result.current.draftStickers.find(s => s.id === 'sticker-2');
    expect(s1.x).toBe(20);
    expect(s2.x).toBe(50); // untouched
  });
});
