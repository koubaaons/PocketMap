// @vitest-environment jsdom
/**
 * @fileoverview Tests for ExportBinderModal.jsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportBinderModal } from '../ExportBinderModal.jsx';

const mockExportBinderPages = vi.fn();
const mockExportBinderSpreads = vi.fn();
vi.mock('../../../utils/binderExport.js', () => ({
  exportBinderPages: (...args) => mockExportBinderPages(...args),
  exportBinderSpreads: (...args) => mockExportBinderSpreads(...args),
}));

function renderModal(props) {
  return render(<ExportBinderModal
    binder={{ id: 'binder-1', pages: 10 }}
    allBinderSlots={[]} allBinderPanels={[]} cardDefMap={{}} binderInsertMap={{}} inventoryGroupMap={{}}
    onClose={vi.fn()} toast={vi.fn()}
    {...props}
  />);
}

beforeEach(() => {
  mockExportBinderPages.mockReset();
  mockExportBinderSpreads.mockReset();
});

describe('ExportBinderModal — page range selection', () => {
  it('defaults to "All pages" showing the real page count', () => {
    renderModal();
    expect(screen.getByText('All pages (10)')).toBeInTheDocument();
  });

  it('selecting "Page range" reveals from/to inputs', () => {
    renderModal();
    fireEvent.click(screen.getByText('Page range'));
    expect(document.getElementById('export-from')).toBeTruthy();
    expect(document.getElementById('export-to')).toBeTruthy();
  });

  it('selecting "Single page" reveals just one page input', () => {
    renderModal();
    fireEvent.click(screen.getByText('Single page'));
    expect(document.getElementById('export-single')).toBeTruthy();
    expect(document.getElementById('export-from')).toBeFalsy();
  });

  it('shows "zipped" in the PNG label only when more than one page is selected', () => {
    renderModal({ binder: { id: 'binder-1', pages: 10 } });
    expect(screen.getByText(/PNG, zipped/)).toBeInTheDocument(); // "All pages" = 10 pages by default

    fireEvent.click(screen.getByText('Single page'));
    expect(screen.getByText('Images (PNG)')).toBeInTheDocument(); // no "zipped" for exactly one page
  });
});

describe('ExportBinderModal — cards-only / format interaction', () => {
  it('checking "Cards only" forces the format to PNG', () => {
    renderModal();
    fireEvent.click(screen.getByText('PDF (one document)'));
    expect(screen.getByLabelText('PDF (one document)')).toBeChecked();

    fireEvent.click(screen.getByText(/Cards only/));

    expect(screen.getByLabelText(/Images \(PNG/)).toBeChecked();
  });

  it('disables the PDF option while "Cards only" is checked', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Cards only/));
    expect(screen.getByLabelText('PDF (one document)')).toBeDisabled();
  });

  it('disables "Hide binder background" while "Cards only" is checked — redundant once transparent', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Cards only/));
    expect(screen.getByLabelText('Hide binder background')).toBeDisabled();
  });
});

describe('ExportBinderModal — export flow', () => {
  it('clicking Export calls exportBinderPages with the current page selection and options', async () => {
    mockExportBinderPages.mockResolvedValue(undefined);
    renderModal();

    fireEvent.click(screen.getByText(/Hide slot numbers/));
    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(mockExportBinderPages).toHaveBeenCalled());
    const call = mockExportBinderPages.mock.calls[0][0];
    expect(call.pageNumbers).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(call.options.hideSlotNumbers).toBe(true);
    expect(call.format).toBe('png');
  });

  it('shows a success toast and closes the modal after a successful export', async () => {
    mockExportBinderPages.mockResolvedValue(undefined);
    const toast = vi.fn();
    const onClose = vi.fn();
    renderModal({ toast, onClose });

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith('Exported 10 pages');
  });

  it('shows an error message and does NOT close the modal when the export fails', async () => {
    mockExportBinderPages.mockRejectedValue(new Error('Ran out of memory'));
    const onClose = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderModal({ onClose });

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(screen.getByText('Ran out of memory')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('disables Cancel and Export while an export is in progress', async () => {
    let resolveExport;
    mockExportBinderPages.mockReturnValue(new Promise(resolve => { resolveExport = resolve; }));
    renderModal();

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(screen.getByText('Exporting…')).toBeInTheDocument());
    expect(screen.getByText('Exporting…')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();

    await act(async () => { resolveExport(); await Promise.resolve(); });
  });
});

describe('ExportBinderModal — spread mode (real bug context: exporting the binder the way it actually looks when open)', () => {
  it('checking spread mode hides the page-range picker entirely — a partial range doesn\'t map onto pairs of facing pages', () => {
    renderModal();
    expect(screen.getByText('Page range')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Export as spreads/));

    expect(screen.queryByText('Page range')).not.toBeInTheDocument();
  });

  it('clicking Export in spread mode calls exportBinderSpreads (not exportBinderPages) with the full, correctly-paired spread list for the binder', async () => {
    mockExportBinderSpreads.mockResolvedValue(undefined);
    renderModal({ binder: { id: 'binder-1', pages: 5 } });

    fireEvent.click(screen.getByText(/Export as spreads/));
    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(mockExportBinderSpreads).toHaveBeenCalled());
    expect(mockExportBinderPages).not.toHaveBeenCalled();
    const call = mockExportBinderSpreads.mock.calls[0][0];
    // 5 pages -> spreads: (null,1), (2,3), (4,5) -- 3 spreads total
    expect(call.spreads).toEqual([
      { spreadIndex: 1, leftPageNum: null, rightPageNum: 1 },
      { spreadIndex: 2, leftPageNum: 2, rightPageNum: 3 },
      { spreadIndex: 3, leftPageNum: 4, rightPageNum: 5 },
    ]);
  });

  it('toasts and closes using the spread count, not a leftover page count, after a successful spread export', async () => {
    mockExportBinderSpreads.mockResolvedValue(undefined);
    const toast = vi.fn();
    const onClose = vi.fn();
    renderModal({ binder: { id: 'binder-1', pages: 5 }, toast, onClose });

    fireEvent.click(screen.getByText(/Export as spreads/));
    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith('Exported 3 spreads');
  });

  it('shows "Rendering spread N of M" progress text, not "page", while a spread export is in progress', async () => {
    let resolveExport;
    mockExportBinderSpreads.mockReturnValue(new Promise(resolve => { resolveExport = resolve; }));
    renderModal({ binder: { id: 'binder-1', pages: 5 } });

    fireEvent.click(screen.getByText(/Export as spreads/));
    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => expect(screen.getByText(/Rendering spread/)).toBeInTheDocument());

    await act(async () => { resolveExport(); await Promise.resolve(); });
  });
});
