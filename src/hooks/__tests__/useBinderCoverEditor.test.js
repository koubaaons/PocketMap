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
vi.mock('../../utils/supabaseImageUpload.js', () => ({
  uploadImageToStorage: (...args) => mockUploadImageToStorage(...args),
}));

const BINDER = { id: 'binder-1', name: 'My Binder', cover_color: '#ff0000', page_color: '#ffffff', stickers: [] };

describe('useBinderCoverEditor', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockCompressStickerImage.mockReset();
    mockUploadImageToStorage.mockReset();
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

  it('handleStickerFileSelected compresses, uploads, and adds a new sticker to the draft, selecting it', async () => {
    mockCompressStickerImage.mockResolvedValue('compressed-blob');
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/sticker.png');
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: BINDER, toast: vi.fn() }));

    const fakeEvent = { target: { files: [{ name: 'sticker.png' }], value: 'x' } };
    await act(async () => result.current.handleStickerFileSelected(fakeEvent));

    expect(result.current.draftStickers).toHaveLength(1);
    expect(result.current.draftStickers[0].image_url).toBe('https://storage.example.com/sticker.png');
    expect(result.current.selectedStickerId).toBe(result.current.draftStickers[0].id);
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

  it('handleRemoveDraftSticker removes the sticker and clears the selection if it was the selected one', async () => {
    const binderWithSticker = { ...BINDER, stickers: [{ id: 'sticker-1' }] };
    const { useBinderCoverEditor } = await import('../useBinderCoverEditor.js');
    const { result } = renderHook(() => useBinderCoverEditor({ binder: binderWithSticker, toast: vi.fn() }));

    act(() => result.current.setSelectedStickerId('sticker-1'));
    act(() => result.current.handleRemoveDraftSticker('sticker-1'));

    expect(result.current.draftStickers).toHaveLength(0);
    expect(result.current.selectedStickerId).toBe(null);
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
