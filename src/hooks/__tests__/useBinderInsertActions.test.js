// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinderInsertActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
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
vi.mock('../../utils/supabaseImageUpload.js', () => ({
  uploadImageToStorage: (...args) => mockUploadImageToStorage(...args),
}));

function makeFile(name) {
  return { name }; // the hook only ever reads .name off the file object directly
}

describe('useBinderInsertActions', () => {
  it('handleBulkAddInserts uploads each file, then dispatches BINDER_INSERT_BULK_ADD with one insert per successful file', async () => {
    mockDispatch.mockClear();
    mockCompressImage.mockResolvedValue('compressed-blob');
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/img.jpg');
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('art1.png'), makeFile('art2.png')]));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe(ACTIONS.BINDER_INSERT_BULK_ADD);
    expect(call.payload).toHaveLength(2);
    expect(toast).toHaveBeenCalledWith('Added 2 images to the library');
  });

  it('does nothing at all for an empty file list', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([]));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('strips the file extension to derive the insert name', async () => {
    mockDispatch.mockClear();
    mockCompressImage.mockResolvedValue('compressed-blob');
    mockUploadImageToStorage.mockResolvedValue('https://storage.example.com/img.jpg');
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('cool-art.png')]));

    expect(mockDispatch.mock.calls[0][0].payload[0].name).toBe('cool-art');
  });

  it('reports a failure count and still adds whichever files succeeded, when one file fails to upload', async () => {
    mockDispatch.mockClear();
    mockCompressImage.mockResolvedValue('compressed-blob');
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
    mockDispatch.mockClear();
    mockCompressImage.mockRejectedValue(new Error('bad image'));
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    await act(async () => result.current.handleBulkAddInserts([makeFile('bad.png')]));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('1 image failed to upload', 'error');
  });

  it('handleDeleteInsert dispatches BINDER_INSERT_DELETE and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderInsertActions } = await import('../useBinderInsertActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderInsertActions(toast, 'user-1'));

    act(() => result.current.handleDeleteInsert('insert-1'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId: 'insert-1' } });
    expect(toast).toHaveBeenCalledWith('Image moved to trash');
  });

  it('handleBulkDeleteInserts dispatches BINDER_INSERT_DELETE once per id and toasts the count', async () => {
    mockDispatch.mockClear();
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
