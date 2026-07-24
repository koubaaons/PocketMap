// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCardImageUpload.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockCompressImage = vi.fn();
vi.mock('../../utils/index.js', () => ({
  compressImage: (...args) => mockCompressImage(...args),
}));

const mockUploadImageToStorage = vi.fn();
vi.mock('../../utils/supabaseImageUpload.js', () => ({
  uploadImageToStorage: (...args) => mockUploadImageToStorage(...args),
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

describe('useCardImageUpload', () => {
  beforeEach(() => {
    mockCompressImage.mockReset();
    mockUploadImageToStorage.mockReset();
  });
  it('starts with isCompressing false', async () => {
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set: vi.fn() }));
    expect(result.current.isCompressing).toBe(false);
  });

  it('compresses, uploads, and calls set("image_url", ...) with the resulting URL', async () => {
    mockCompressImage.mockResolvedValue('compressed-blob');
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/card.jpg');
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    const fakeEvent = { target: { files: [{ name: 'card.png' }] } };
    await act(async () => result.current.handleImageChange(fakeEvent));

    expect(mockCompressImage).toHaveBeenCalledWith({ name: 'card.png' });
    expect(set).toHaveBeenCalledWith('image_url', 'https://storage.example.com/card.jpg');
  });

  it('sets isCompressing true during the upload and back to false once done', async () => {
    let resolveCompress;
    mockCompressImage.mockReturnValue(new Promise(resolve => { resolveCompress = resolve; }));
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/card.jpg');
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    const fakeEvent = { target: { files: [{ name: 'card.png' }] } };
    let uploadPromise;
    act(() => { uploadPromise = result.current.handleImageChange(fakeEvent); });

    await waitFor(() => expect(result.current.isCompressing).toBe(true));

    await act(async () => { resolveCompress('compressed-blob'); await uploadPromise; });

    expect(result.current.isCompressing).toBe(false);
  });

  it('does nothing if no file was actually selected', async () => {
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    const fakeEvent = { target: { files: [] } };
    await act(async () => result.current.handleImageChange(fakeEvent));

    expect(mockCompressImage).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('logs an error and resets isCompressing, without calling set, when the upload fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCompressImage.mockResolvedValue('compressed-blob');
    mockUploadImageToStorage.mockRejectedValue(new Error('network error'));
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    const fakeEvent = { target: { files: [{ name: 'card.png' }] } };
    await act(async () => result.current.handleImageChange(fakeEvent));

    expect(set).not.toHaveBeenCalled();
    expect(result.current.isCompressing).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handleRemoveImage calls set("image_url", null) and clears the file input value', async () => {
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    act(() => { result.current.fileInputRef.current = { value: 'C:\\fakepath\\card.png' }; });
    act(() => result.current.handleRemoveImage());

    expect(set).toHaveBeenCalledWith('image_url', null);
    expect(result.current.fileInputRef.current.value).toBe('');
  });
});
