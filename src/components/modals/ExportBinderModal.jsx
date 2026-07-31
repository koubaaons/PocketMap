/**
 * @fileoverview ExportBinderModal — pick which pages, which toggles,
 * and which format (PNG or PDF), then render+download via
 * binderExport.js.
 */

import { useState } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { buildSpreadList } from '../../selectors/binderSelectors.js';

export function ExportBinderModal({
  binder,
  allBinderSlots,
  allBinderPanels,
  cardDefMap,
  binderInsertMap,
  inventoryGroupMap,
  onClose,
  toast,
}) {
  const [rangeType, setRangeType] = useState('all'); // 'all' | 'range' | 'single'
  const [fromPage, setFromPage] = useState('1');
  const [toPage, setToPage] = useState(String(binder.pages));
  const [singlePage, setSinglePage] = useState('1');
  // === Requested directly: an option to export the binder the way it
  // actually looks when open — two facing physical pages together on
  // one sheet, exactly like flipping through the real thing, instead
  // of one isolated page at a time. Always covers the whole binder
  // when on (see buildSpreadList) — a partial physical page range
  // doesn't map cleanly onto pairs of facing pages, so the page-range
  // selector below is hidden rather than trying to reconcile the two.
  const [spreadMode, setSpreadMode] = useState(false);

  const [hideSlotNumbers, setHideSlotNumbers] = useState(false);
  const [hideQuantityBadges, setHideQuantityBadges] = useState(false);
  const [hideBackground, setHideBackground] = useState(false);
  const [cardsOnly, setCardsOnly] = useState(false);

  const [format, setFormat] = useState('png'); // 'png' | 'pdf'
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total }
  const [error, setError] = useState('');

  const clampPage = (n) => Math.min(Math.max(1, n), binder.pages);

  const getSelectedPageNumbers = () => {
    if (rangeType === 'single') {
      const p = clampPage(parseInt(singlePage, 10) || 1);
      return [p];
    }
    if (rangeType === 'range') {
      const from = clampPage(parseInt(fromPage, 10) || 1);
      const to   = clampPage(parseInt(toPage, 10) || binder.pages);
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    }
    return Array.from({ length: binder.pages }, (_, i) => i + 1);
  };

  // cardsOnly's whole point is a transparent PNG — a PDF page can't
  // represent that (see binderExport.js), so picking it forces PNG
  // rather than letting the user pick a combination that would
  // silently not do what it says.
  const handleToggleCardsOnly = (checked) => {
    setCardsOnly(checked);
    if (checked) setFormat('png');
  };

  const handleExport = async () => {
    setError('');
    setIsExporting(true);
    try {
      if (spreadMode) {
        const spreads = buildSpreadList(binder.pages);
        setProgress({ current: 0, total: spreads.length });
        const { exportBinderSpreads } = await import('../../utils/binderExport.js');
        await exportBinderSpreads({
          binder,
          spreads,
          allBinderSlots,
          allBinderPanels,
          cardDefMap,
          binderInsertMap,
          inventoryGroupMap,
          format,
          options: { hideSlotNumbers, hideQuantityBadges, hideBackground, cardsOnly },
          onProgress: (current, total) => setProgress({ current, total }),
        });
        toast(`Exported ${spreads.length} spread${spreads.length !== 1 ? 's' : ''}`);
        onClose();
        return;
      }

      const pageNumbers = getSelectedPageNumbers();
      setProgress({ current: 0, total: pageNumbers.length });
      const { exportBinderPages } = await import('../../utils/binderExport.js');
      await exportBinderPages({
        binder,
        pageNumbers,
        allBinderSlots,
        allBinderPanels,
        cardDefMap,
        binderInsertMap,
        inventoryGroupMap,
        format,
        options: { hideSlotNumbers, hideQuantityBadges, hideBackground, cardsOnly },
        onProgress: (current, total) => setProgress({ current, total }),
      });
      toast(`Exported ${pageNumbers.length} page${pageNumbers.length !== 1 ? 's' : ''}`);
      onClose();
    } catch (err) {
      console.error('[Pinder] binder export failed:', err);
      setError(err.message || 'Export failed — try again.');
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  return (
    <Modal title="Export Binder" onClose={onClose}>
      <p className="modal-step-intro">Rendered fresh at high resolution — nothing is saved to your account.</p>

      <div className="form-group">
        <label className="export-checkbox-option">
          <input type="checkbox" checked={spreadMode} onChange={e => setSpreadMode(e.target.checked)} />
          Export as spreads — two facing pages together, like opening a real binder
        </label>
      </div>

      {!spreadMode && (
        <div className="form-group">
          <label>Pages</label>
          <div className="export-range-options">
            <label className="export-radio-option">
              <input type="radio" checked={rangeType === 'all'} onChange={() => setRangeType('all')} />
              All pages ({binder.pages})
            </label>
            <label className="export-radio-option">
              <input type="radio" checked={rangeType === 'range'} onChange={() => setRangeType('range')} />
              Page range
            </label>
            {rangeType === 'range' && (
              <div className="export-range-inputs">
                <Input id="export-from" type="number" min={1} max={binder.pages} value={fromPage} onChange={e => setFromPage(e.target.value)} />
                <span>to</span>
                <Input id="export-to" type="number" min={1} max={binder.pages} value={toPage} onChange={e => setToPage(e.target.value)} />
              </div>
            )}
            <label className="export-radio-option">
              <input type="radio" checked={rangeType === 'single'} onChange={() => setRangeType('single')} />
              Single page
            </label>
            {rangeType === 'single' && (
              <div className="export-range-inputs">
                <Input id="export-single" type="number" min={1} max={binder.pages} value={singlePage} onChange={e => setSinglePage(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="form-group">
        <label>Options</label>
        <div className="export-toggle-options">
          <label className="export-checkbox-option">
            <input type="checkbox" checked={hideSlotNumbers} onChange={e => setHideSlotNumbers(e.target.checked)} />
            Hide slot numbers
          </label>
          <label className="export-checkbox-option">
            <input type="checkbox" checked={hideQuantityBadges} onChange={e => setHideQuantityBadges(e.target.checked)} />
            Hide card quantity badges (×N)
          </label>
          <label className="export-checkbox-option">
            <input type="checkbox" checked={hideBackground} onChange={e => setHideBackground(e.target.checked)} disabled={cardsOnly} />
            Hide binder background
          </label>
          <label className="export-checkbox-option">
            <input type="checkbox" checked={cardsOnly} onChange={e => handleToggleCardsOnly(e.target.checked)} />
            Cards only — transparent background (forces PNG)
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>Format</label>
        <div className="export-range-options">
          <label className="export-radio-option">
            <input type="radio" checked={format === 'png'} onChange={() => setFormat('png')} />
            Images (PNG{(spreadMode ? buildSpreadList(binder.pages).length : getSelectedPageNumbers().length) > 1 ? ', zipped' : ''})
          </label>
          <label className="export-radio-option">
            <input type="radio" checked={format === 'pdf'} disabled={cardsOnly} onChange={() => setFormat('pdf')} />
            PDF (one document)
          </label>
        </div>
      </div>

      {error && <p className="modal-step-error">{error}</p>}
      {isExporting && progress && (
        <p className="modal-step-note">Rendering {spreadMode ? 'spread' : 'page'} {progress.current} of {progress.total}…</p>
      )}

      <ModalActions>
        <Button variant="ghost" onClick={onClose} disabled={isExporting}>Cancel</Button>
        <Button variant="primary" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting…' : 'Export'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
