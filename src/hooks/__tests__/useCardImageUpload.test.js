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
const mockDataUrlToBlob = vi.fn();
vi.mock('../../utils/supabaseImageUpload.js', () => ({
  uploadImageToStorage: (...args) => mockUploadImageToStorage(...args),
  dataUrlToBlob: (...args) => mockDataUrlToBlob(...args),
}));

const mockCheckStorageQuota = vi.fn();
vi.mock('../../services/userPreferences.js', () => ({
  checkStorageQuota: (...args) => mockCheckStorageQuota(...args),
  formatBytes: (b) => `${b} B`,
  STORAGE_QUOTA_BYTES: 10 * 1024 * 1024,
}));

vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

// compressImage resolves with a base64 data URL string in real life
// (canvas.toDataURL), not a Blob — this fake string plus the
// dataUrlToBlob mock below replicate that real shape, rather than
// the previous version's unrealistic { size: N } mock, which is
// exactly why it never caught the real "compressed.size is
// undefined" bug this file's logic had.
const FAKE_DATA_URL = 'data:image/jpeg;base64,ZmFrZQ==';

describe('useCardImageUpload', () => {
  beforeEach(() => {
    mockCompressImage.mockReset();
    mockUploadImageToStorage.mockReset();
    mockDataUrlToBlob.mockReset().mockImplementation(() => ({ size: 50000, type: 'image/jpeg' }));
    mockCheckStorageQuota.mockReset().mockResolvedValue({ allowed: true, used: 0, remaining: 10 * 1024 * 1024 });
  });

  it('starts with isCompressing false', async () => {
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set: vi.fn() }));
    expect(result.current.isCompressing).toBe(false);
  });

  it('compresses, converts to a real Blob, checks quota, uploads, and calls set with the resulting url and size', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/card.jpg');
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    const fakeEvent = { target: { files: [{ name: 'card.png' }] } };
    await act(async () => result.current.handleImageChange(fakeEvent));

    expect(mockCompressImage).toHaveBeenCalledWith({ name: 'card.png' });
    expect(mockDataUrlToBlob).toHaveBeenCalledWith(FAKE_DATA_URL);
    expect(mockCheckStorageQuota).toHaveBeenCalledWith('user-1', 50000);
    expect(mockUploadImageToStorage).toHaveBeenCalledWith(expect.objectContaining({ size: 50000 }), expect.any(String));
    expect(set).toHaveBeenCalledWith('image_url', 'https://storage.example.com/card.jpg');
    expect(set).toHaveBeenCalledWith('image_size_bytes', 50000);
  });

  it('rejects the upload and toasts a clear message, without ever calling uploadImageToStorage, when over quota', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockCheckStorageQuota.mockResolvedValue({ allowed: false, used: 10 * 1024 * 1024 - 100, remaining: 100 });
    const set = vi.fn();
    const toast = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set, toast }));

    const fakeEvent = { target: { files: [{ name: 'card.png' }] } };
    await act(async () => result.current.handleImageChange(fakeEvent));

    expect(mockUploadImageToStorage).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Storage limit reached'), 'error');
  });

  it('rejecting over quota does not throw even when no toast callback was provided (an existing caller not yet updated)', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockCheckStorageQuota.mockResolvedValue({ allowed: false, used: 10 * 1024 * 1024, remaining: 0 });
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set })); // no toast passed

    const fakeEvent = { target: { files: [{ name: 'card.png' }] } };
    await expect(act(async () => result.current.handleImageChange(fakeEvent))).resolves.not.toThrow();
    expect(set).not.toHaveBeenCalled();
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

    await act(async () => { resolveCompress(FAKE_DATA_URL); await uploadPromise; });

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
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
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

  it('handleRemoveImage calls set for both image_url and image_size_bytes with null, and clears the file input value', async () => {
    const set = vi.fn();
    const { useCardImageUpload } = await import('../useCardImageUpload.js');
    const { result } = renderHook(() => useCardImageUpload({ set }));

    act(() => { result.current.fileInputRef.current = { value: 'C:\\fakepath\\card.png' }; });
    act(() => result.current.handleRemoveImage());

    expect(set).toHaveBeenCalledWith('image_url', null);
    expect(set).toHaveBeenCalledWith('image_size_bytes', null);
    expect(result.current.fileInputRef.current.value).toBe('');
  });
});
