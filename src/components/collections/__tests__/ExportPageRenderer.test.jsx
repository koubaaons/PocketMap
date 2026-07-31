// @vitest-environment jsdom
/**
 * @fileoverview Tests for ExportPageRenderer.jsx.
 *
 * Focused specifically on the combined-panel image positioning logic
 * (ExportPanelImage) — a real bug was found where a panel's own
 * imageX/imageY/imageScale (set by the user dragging/zooming the
 * image within a combined slot in the real, live binder view) were
 * completely ignored by the export, always showing the image at its
 * default centered position instead. Not attempting broader coverage
 * of the rest of this file's grid-layout logic here, which is fine to
 * leave unverified by Vitest the same way every other export
 * rendering component in this app is — jsdom can't meaningfully
 * verify visual canvas output either way. This positioning logic is
 * different: it's real React state and inline style values, which
 * jsdom genuinely can check.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportPageRenderer } from '../ExportPageRenderer.jsx';

const BINDER = { id: 'binder-1', rows: 2, cols: 2 };

function makePanel(overrides = {}) {
  return {
    id: 'panel-1', binderId: 'binder-1', pageNumber: 1,
    startSlotIndex: 0, spanCols: 2, spanRows: 1,
    panelType: 'insert', insertId: 'insert-1',
    imageX: 50, imageY: 50, imageScale: 1,
    ...overrides,
  };
}

const INSERT = { id: 'insert-1', name: 'Wedding Photo', image_url: 'https://x/wedding.jpg' };

describe('ExportPageRenderer — combined panel image positioning (real bug fix)', () => {
  it('applies the panel\'s own imageX/imageY/imageScale to the image wrap\'s inline position — the real fix, since this used to always render at the default centered position regardless of what the panel actually had set', () => {
    render(
      <ExportPageRenderer
        binder={BINDER}
        pageNumber={1}
        pageSlotMap={{}}
        pagePanels={[makePanel({ imageX: 30, imageY: 70, imageScale: 1.8 })]}
        cardDefMap={{}}
        binderInsertMap={{ 'insert-1': INSERT }}
        inventoryGroupMap={{}}
      />
    );

    const img = screen.getByAltText('Wedding Photo');
    const wrap = img.parentElement;

    expect(wrap.style.left).toBe('30%');
    expect(wrap.style.top).toBe('70%');
    expect(wrap.style.transform).toBe('translate(-50%, -50%) scale(1.8)');
  });

  it('defaults to imageX/imageY 50% and imageScale 1 (centered, unscaled) when a panel has none set — e.g. one created before these fields existed', () => {
    render(
      <ExportPageRenderer
        binder={BINDER}
        pageNumber={1}
        pageSlotMap={{}}
        pagePanels={[makePanel({ imageX: undefined, imageY: undefined, imageScale: undefined })]}
        cardDefMap={{}}
        binderInsertMap={{ 'insert-1': INSERT }}
        inventoryGroupMap={{}}
      />
    );

    const img = screen.getByAltText('Wedding Photo');
    const wrap = img.parentElement;

    expect(wrap.style.left).toBe('50%');
    expect(wrap.style.top).toBe('50%');
    expect(wrap.style.transform).toBe('translate(-50%, -50%) scale(1)');
  });

  it('real bug fixed (again): the panel image\'s aspect-ratio comes directly from the pre-fetched panelAspectRatios prop, not discovered via onLoad after rendering — the earlier onLoad-based approach depended on a React state update committing before html2canvas captured, which wasn\'t reliably winning that race in practice (still reported producing a visible gap around the image). Pre-fetching before rendering starts removes the race entirely.', () => {
    render(
      <ExportPageRenderer
        binder={BINDER}
        pageNumber={1}
        pageSlotMap={{}}
        pagePanels={[makePanel()]}
        cardDefMap={{}}
        binderInsertMap={{ 'insert-1': INSERT }}
        inventoryGroupMap={{}}
        panelAspectRatios={{ 'panel-1': 1600 / 900 }}
      />
    );

    const img = screen.getByAltText('Wedding Photo');
    const wrap = img.parentElement;
    expect(wrap.style.aspectRatio).toBe(`${1600 / 900} / 1`);
  });

  it('defaults a panel\'s aspect-ratio to 1 (square) if it\'s missing from panelAspectRatios for any reason, rather than crashing', () => {
    render(
      <ExportPageRenderer
        binder={BINDER}
        pageNumber={1}
        pageSlotMap={{}}
        pagePanels={[makePanel()]}
        cardDefMap={{}}
        binderInsertMap={{ 'insert-1': INSERT }}
        inventoryGroupMap={{}}
        panelAspectRatios={{}}
      />
    );

    const img = screen.getByAltText('Wedding Photo');
    const wrap = img.parentElement;
    expect(wrap.style.aspectRatio).toBe('1 / 1');
  });

  it('a regular (non-combined) slot still renders as a plain, unpositioned image — this fix is scoped to combined panels only, not every card image', () => {
    const cardDef = { id: 'card-1', name: 'Pikachu', image_url: 'https://x/pikachu.jpg' };
    render(
      <ExportPageRenderer
        binder={BINDER}
        pageNumber={1}
        pageSlotMap={{ 0: { slotIndex: 0, cardDefId: 'card-1' } }}
        pagePanels={[]}
        cardDefMap={{ 'card-1': cardDef }}
        binderInsertMap={{}}
        inventoryGroupMap={{}}
      />
    );

    const img = screen.getByAltText('Pikachu');
    expect(img.className).toContain('export-cell-image');
    // A regular slot's image has no positioned wrap div around it —
    // its direct parent is the cell itself, not an image-wrap.
    expect(img.parentElement.className).toContain('export-cell');
  });

  it('real bug fixed: a panel\'s cell has its aspect-ratio scaled by its own span, matching BinderPanelSlot.jsx\'s exact formula — the base .export-cell CSS rule\'s fixed single-card ratio was otherwise being wrongly forced onto a spanning cell, distorting its real size compared to the live binder', () => {
    render(
      <ExportPageRenderer
        binder={BINDER}
        pageNumber={1}
        pageSlotMap={{}}
        pagePanels={[makePanel({ spanCols: 2, spanRows: 1 })]}
        cardDefMap={{}}
        binderInsertMap={{ 'insert-1': INSERT }}
        inventoryGroupMap={{}}
      />
    );

    const img = screen.getByAltText('Wedding Photo');
    // Walk up: img -> image-wrap -> the actual .export-cell
    const cell = img.parentElement.parentElement;
    expect(cell.className).toContain('export-cell-filled');
    expect(cell.style.aspectRatio).toBe(`${(2.5 * 2) / (3.5 * 1)} / 1`);
  });
});
