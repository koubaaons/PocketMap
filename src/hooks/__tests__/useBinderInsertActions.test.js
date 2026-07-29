// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinderInsertActions.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

const mockCompressImage = vi.fn();
vi.mock('../../utils/imageCompression.js', () => ({
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

// compressImage resolves with a base64 JPEG data URL string in real
// life (canvas.toDataURL), not a Blob — this fake string plus the
// dataUrlToBlob mock below replicate that real shape, rather than an
// unrealistic { size: N } mock, which is exactly why the real
// "compressed.size is undefined" bug wasn't caught before.
const FAKE_DATA_URL = 'data:image/jpeg;base64,ZmFrZQ==';

function makeFile(name) {
  return { name }; // the hook only ever reads .name off the file object directly
}

describe('useBinderInsertActions', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockCompressImage.mockReset();
    mockUploadImageToStorage.mockReset();
    mockDataUrlToBlob.mockReset().mockImplementation(() => ({ size: 50000, type: 'image/jpeg' }));
    mockCheckStorageQuota.mockReset().mockResolvedValue({ allowed: true, used: 0, remaining: 10 * 1024 * 1024 });
  });

  it('handleBulkAddInserts uploads each file, converts to a real Blob, checks quota per file, then dispatches BINDER_INSERT_BULK_ADD with one insert per successful file', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/img.jpg');
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('art1.png'), makeFile('art2.png')]));

    expect(mockDataUrlToBlob).toHaveBeenCalledTimes(2);
    expect(mockCheckStorageQuota).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe(ACTIONS.BINDER_INSERT_BULK_ADD);
    expect(call.payload).toHaveLength(2);
    expect(call.payload[0].image_size_bytes).toBe(50000);
    expect(toast).toHaveBeenCalledWith('Added 2 images to the library');
  });

  it('does nothing at all for an empty file list', async () => {
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([]));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('strips the file extension to derive the insert name', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/img.jpg');
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('cool-art.png')]));

    expect(mockDispatch.mock.calls[0][0].payload[0].name).toBe('cool-art');
  });

  it('reports a failure count and still adds whichever files succeeded, when one file fails to upload', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage
      .mockResolvedValueOnce('https://storage.example.com/ok.jpg')
      .mockRejectedValueOnce(new Error('network error'));
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('good.png'), makeFile('bad.png')]));

    expect(mockDispatch.mock.calls[0][0].payload).toHaveLength(1); // only the successful one
    expect(toast).toHaveBeenCalledWith('1 image failed to upload', 'error');
    expect(toast).toHaveBeenCalledWith('Added 1 image to the library');
  });

  it('dispatches nothing and only shows the failure toast when every file fails', async () => {
    mockCompressImage.mockRejectedValue(new Error('bad image'));
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('bad.png')]));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('1 image failed to upload', 'error');
  });

  it('stops the batch once the quota is hit — every remaining file is reported as failed without a doomed compress/upload attempt for each', async () => {
    mockCompressImage.mockResolvedValue(FAKE_DATA_URL);
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/ok.jpg');
    // First file's check passes, second file's check fails
    mockCheckStorageQuota
      .mockResolvedValueOnce({ allowed: true, used: 0, remaining: 10 * 1024 * 1024 })
      .mockResolvedValueOnce({ allowed: false, used: 10 * 1024 * 1024, remaining: 0 });
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('a.png'), makeFile('b.png'), makeFile('c.png')]));

    // Only 2 checks — the 3rd file never even got compressed/checked,
    // since quotaExceeded short-circuits the rest of the loop.
    expect(mockCheckStorageQuota).toHaveBeenCalledTimes(2);
    expect(mockCompressImage).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[0][0].payload).toHaveLength(1); // only the first file succeeded
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Storage limit reached'), 'error');
    // The generic "N images failed to upload" toast should NOT also
    // fire — the quota message is the more specific, correct one.
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('failed to upload'), 'error');
  });

  it('handleDeleteInsert dispatches BINDER_INSERT_DELETE and toasts', async () => {
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    act(() => result.current.handleDeleteInsert('insert-1'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId: 'insert-1' } });
    expect(toast).toHaveBeenCalledWith('Image moved to trash');
  });

  it('handleBulkDeleteInserts dispatches BINDER_INSERT_DELETE once per id and toasts the count', async () => {
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    act(() => result.current.handleBulkDeleteInserts(['insert-1', 'insert-2']));

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId: 'insert-1' } });
    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId: 'insert-2' } });
    expect(toast).toHaveBeenCalledWith('2 images moved to trash');
  });
});
