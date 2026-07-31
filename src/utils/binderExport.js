/**
 * @fileoverview binderExport — renders selected binder pages off-
 * screen at high resolution and produces a downloadable PNG (one
 * file, or a zip of several) or PDF.
 *
 * === Why this isn't "free" ===
 * There's no way to turn app UI into a real image/PDF without
 * actually rendering it and capturing the result — this uses
 * html2canvas to screenshot a hidden, off-screen render of each page
 * (via ExportPageRenderer.jsx) at 2x scale for print-quality output,
 * then either bundles those images with jszip or stitches them into
 * pages of a jsPDF document.
 *
 * === Why transparency only works for PNG ===
 * A PDF page is always an opaque sheet — even with the binder's own
 * background hidden, a PDF viewer/printer just shows white behind it,
 * not true transparency. The "cards only" toggle is only meaningful
 * for a PNG export; see exportBinderPages's format handling below.
 *
 * === CORS note ===
 * html2canvas needs to read pixel data out of every card image it
 * captures, which the browser only allows for images served with
 * permissive CORS headers. Every <img> in ExportPageRenderer sets
 * crossOrigin="anonymous" and html2canvas is called with useCORS:true
 * to request that — if a particular image host doesn't send the
 * right headers, that one image will render as blank in the capture
 * (a browser security limitation, not something fixable from here).
 *
 * === FIX (real bug reported directly by the user): exporting "all
 * pages" or a range silently failed — no file, no error, the page
 * itself appeared to reload — while a single page always worked. A
 * 2x-scale canvas is raw, uncompressed pixel data (a single 1200px-
 * wide page is already several megabytes as a canvas), and the old
 * version captured EVERY selected page into an array and held all of
 * them in memory simultaneously before building the zip/PDF at the
 * very end. For a binder with many pages, that's enough memory
 * pressure to crash or force-reload the tab — which looks exactly
 * like "the page refreshed, nothing downloaded". Now each page is
 * captured, immediately appended to the zip/PDF (both of which store
 * compressed PNG bytes, not raw pixels — far smaller), and its canvas
 * is discarded before moving to the next page, so peak memory stays
 * roughly constant regardless of how many pages are being exported.
 */

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { createElement } from 'react';
import { ExportPageRenderer } from '../components/collections/ExportPageRenderer.jsx';
import { ExportSpreadRenderer } from '../components/collections/ExportSpreadRenderer.jsx';
import { buildPageSlotMap } from '../selectors/binderSelectors.js';

/**
 * Resolves to a single card/insert image's real, natural aspect
 * ratio (width/height) by loading it directly, independent of any
 * React rendering. Falls back to 1 (square) on error — a slightly
 * wrong shape for one broken image is far better than blocking the
 * whole export over it.
 */
function getImageNaturalAspectRatio(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1);
    };
    img.onerror = () => resolve(1);
    img.src = url;
  });
}

/**
 * Builds a { panelId: aspectRatio } map for every combined panel that
 * has an image, by loading each one directly and reading its real
 * dimensions — done once, up front, before any off-screen rendering
 * starts at all.
 *
 * === Real bug fixed: a combined panel's image position/size depends
 * on its NATURAL aspect ratio (see ExportPanelImage in
 * ExportPageRenderer.jsx). The original approach discovered this by
 * rendering the image and reading its dimensions once the browser's
 * own 'load' event fired, via a React state update inside an onLoad
 * handler — but that state update needed to actually commit and
 * repaint before html2canvas captured the DOM, which an off-screen,
 * one-shot render can't fully guarantee (waiting one extra animation
 * frame afterward wasn't consistently enough — still reported
 * producing a visible gap in practice). Pre-fetching every ratio
 * before rendering begins at all removes that race entirely: by the
 * time anything renders, every panel's correct ratio is already
 * known and passed in directly as a prop, nothing left to discover
 * or wait for mid-capture.
 */
export async function buildPanelAspectRatioMap(allBinderPanels, cardDefMap, binderInsertMap) {
  const entries = await Promise.all(
    allBinderPanels.map(async (panel) => {
      const imageUrl = panel.panelType === 'card'
        ? cardDefMap[panel.cardDefId]?.image_url
        : binderInsertMap[panel.insertId]?.image_url;
      if (!imageUrl) return null;
      const ratio = await getImageNaturalAspectRatio(imageUrl);
      return [panel.id, ratio];
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
}

const EXPORT_SCALE = 2; // 2x the rendered DOM size — print-quality without being excessive

/**
 * Waits for every <img> inside a container to finish loading (or fail
 * — either way we don't want to capture a canvas full of blank spots
 * because html2canvas ran before images arrived).
 */
function waitForImages(container) {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true }); // don't hang the whole export on one broken image
    });
  })).then(() => new Promise(resolve => requestAnimationFrame(resolve)));
  // General safety margin: gives the browser one more frame to finish
  // layout/paint of whatever just loaded before html2canvas reads the
  // DOM. (Previously this specifically existed to wait for a React
  // state update from an image's onLoad handler to commit — that
  // dependency is gone now that panel image aspect ratios are
  // pre-fetched before rendering even starts, see
  // buildPanelAspectRatioMap — but the extra frame is still cheap
  // insurance against other layout timing, so it stays.)
}

/**
 * Renders one page off-screen and returns a captured canvas. Caller
 * is responsible for extracting whatever it needs (dataURL, etc.) and
 * discarding the canvas promptly — see the memory-usage note above.
 */
async function capturePage(pageNumber, { binder, allBinderSlots, allBinderPanels, cardDefMap, binderInsertMap, inventoryGroupMap, panelAspectRatios, options }) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px'; // off-screen, not display:none — html2canvas needs real layout
  document.body.appendChild(container);

  const root = createRoot(container);

  const pageSlotMap = buildPageSlotMap(allBinderSlots, binder.id, pageNumber);
  const pagePanels  = allBinderPanels.filter(p => p.binderId === binder.id && p.pageNumber === pageNumber);

  try {
    // === FIX (real bug reported directly by the user: "Invalid
    // element provided as first argument" from html2canvas, only on
    // multi-page exports): waiting on requestAnimationFrame timing was
    // an unreliable proxy for "React has committed this render" — it
    // usually worked, but wasn't guaranteed, and broke under the
    // heavier load of rendering many pages back-to-back in sequence,
    // occasionally leaving container.firstChild null (nothing
    // committed yet) at the exact moment html2canvas tried to read
    // it. flushSync forces the commit to happen synchronously, before
    // this call returns — no timing guess involved. Still waits one
    // rAF afterward, but only to let the browser finish layout/paint
    // of that now-guaranteed-present DOM before measuring it.
    flushSync(() => {
      root.render(
        createElement(ExportPageRenderer, {
          binder,
          pageNumber,
          pageSlotMap,
          pagePanels,
          cardDefMap,
          binderInsertMap,
          inventoryGroupMap,
          panelAspectRatios,
          hideSlotNumbers: options.hideSlotNumbers,
          hideQuantityBadges: options.hideQuantityBadges,
          hideBackground: options.hideBackground,
          cardsOnly: options.cardsOnly,
        })
      );
    });

    await new Promise(resolve => requestAnimationFrame(resolve));

    await waitForImages(container);

    if (!container.firstChild) {
      throw new Error(`Export failed to render page ${pageNumber} — nothing was there to capture.`);
    }

    const canvas = await html2canvas(container.firstChild, {
      scale: EXPORT_SCALE,
      useCORS: true,
      backgroundColor: options.cardsOnly ? null : undefined, // null = transparent capture
      logging: false,
    });

    return canvas;
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

/**
 * Renders one full spread (two facing pages) off-screen and returns a
 * captured canvas — the spread equivalent of capturePage above, same
 * structure and same reasoning throughout (flushSync for a guaranteed
 * commit before capture, waitForImages before html2canvas runs).
 */
async function captureSpread({ spreadIndex, leftPageNum, rightPageNum }, { binder, allBinderSlots, allBinderPanels, cardDefMap, binderInsertMap, inventoryGroupMap, panelAspectRatios, options }) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px';
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    flushSync(() => {
      root.render(
        createElement(ExportSpreadRenderer, {
          binder,
          leftPageNum,
          rightPageNum,
          allBinderSlots,
          allBinderPanels,
          cardDefMap,
          binderInsertMap,
          inventoryGroupMap,
          panelAspectRatios,
          hideSlotNumbers: options.hideSlotNumbers,
          hideQuantityBadges: options.hideQuantityBadges,
          hideBackground: options.hideBackground,
          cardsOnly: options.cardsOnly,
        })
      );
    });

    await new Promise(resolve => requestAnimationFrame(resolve));

    await waitForImages(container);

    if (!container.firstChild) {
      throw new Error(`Export failed to render spread ${spreadIndex} — nothing was there to capture.`);
    }

    const canvas = await html2canvas(container.firstChild, {
      scale: EXPORT_SCALE,
      useCORS: true,
      backgroundColor: options.cardsOnly ? null : undefined,
      logging: false,
    });

    return canvas;
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

/**
 * @param {object} params
 * @param {object} params.binder
 * @param {number[]} params.pageNumbers - which physical pages to export, in order
 * @param {object[]} params.allBinderSlots
 * @param {object[]} params.allBinderPanels
 * @param {object} params.cardDefMap
 * @param {object} params.binderInsertMap
 * @param {object} params.inventoryGroupMap
 * @param {'png'|'pdf'} params.format
 * @param {{hideSlotNumbers: boolean, hideQuantityBadges: boolean, hideBackground: boolean, cardsOnly: boolean}} params.options
 * @param {(current: number, total: number) => void} [params.onProgress]
 */
export async function exportBinderPages({
  binder,
  pageNumbers,
  allBinderSlots,
  allBinderPanels,
  cardDefMap,
  binderInsertMap,
  inventoryGroupMap,
  format,
  options,
  onProgress,
}) {
  if (pageNumbers.length === 0) throw new Error('No pages selected to export');

  const panelAspectRatios = await buildPanelAspectRatioMap(allBinderPanels, cardDefMap, binderInsertMap);

  await runExport({
    units: pageNumbers,
    captureFn: (pageNumber) => capturePage(pageNumber, { binder, allBinderSlots, allBinderPanels, cardDefMap, binderInsertMap, inventoryGroupMap, panelAspectRatios, options }),
    unitLabel: (pageNumber) => `page-${pageNumber}`,
    zipEntryName: (pageNumber) => `page-${String(pageNumber).padStart(3, '0')}.png`,
    unitKind: 'pages',
    binder,
    format,
    options,
    onProgress,
  });
}

/**
 * Same as exportBinderPages, but exports whole spreads (two facing
 * pages side by side, like opening a real physical binder) instead of
 * one physical page at a time. Always covers the entire binder — see
 * buildSpreadList in binderSelectors.js for the exact pairing.
 *
 * @param {object} params
 * @param {object} params.binder
 * @param {{spreadIndex: number, leftPageNum: number|null, rightPageNum: number|null}[]} params.spreads
 * @param {object[]} params.allBinderSlots
 * @param {object[]} params.allBinderPanels
 * @param {object} params.cardDefMap
 * @param {object} params.binderInsertMap
 * @param {object} params.inventoryGroupMap
 * @param {'png'|'pdf'} params.format
 * @param {{hideSlotNumbers: boolean, hideQuantityBadges: boolean, hideBackground: boolean, cardsOnly: boolean}} params.options
 * @param {(current: number, total: number) => void} [params.onProgress]
 */
export async function exportBinderSpreads({
  binder,
  spreads,
  allBinderSlots,
  allBinderPanels,
  cardDefMap,
  binderInsertMap,
  inventoryGroupMap,
  format,
  options,
  onProgress,
}) {
  if (spreads.length === 0) throw new Error('This binder has no pages to export');

  const panelAspectRatios = await buildPanelAspectRatioMap(allBinderPanels, cardDefMap, binderInsertMap);

  await runExport({
    units: spreads,
    captureFn: (spread) => captureSpread(spread, { binder, allBinderSlots, allBinderPanels, cardDefMap, binderInsertMap, inventoryGroupMap, panelAspectRatios, options }),
    unitLabel: (spread) => `spread-${spread.spreadIndex}`,
    zipEntryName: (spread) => `spread-${String(spread.spreadIndex).padStart(3, '0')}.png`,
    unitKind: 'spreads',
    binder,
    format,
    options,
    onProgress,
  });
}

/**
 * Shared streaming orchestration for both export modes above — given
 * a list of "units" (either page numbers or spread objects) and a way
 * to capture each one into a canvas, produces a single-file PNG
 * (exactly one unit), a zip of PNGs, or a multi-page PDF. Captures and
 * appends/downloads one unit at a time rather than holding every
 * canvas in memory simultaneously — see this file's own header
 * comment for why that matters (a real bug found and fixed here
 * before spreads existed at all).
 */
async function runExport({ units, captureFn, unitLabel, zipEntryName, unitKind, binder, format, options, onProgress }) {
  // cardsOnly's whole point is transparency, which a PDF page can't
  // represent — silently falling back would produce a file that
  // doesn't look like what the user asked for, so this is enforced
  // here rather than left to the UI to remember.
  if (format === 'pdf' && options.cardsOnly) {
    throw new Error('"Cards only" (transparent) requires a PNG export — PDF pages are always opaque.');
  }

  const safeName = binder.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'binder';

  // Single-unit PNG stays a simple direct download — no zip needed
  // for exactly one file, and no need for the streaming machinery
  // below since there's nothing to accumulate.
  if (format === 'png' && units.length === 1) {
    onProgress?.(1, 1);
    const canvas = await captureFn(units[0]);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${safeName}-${unitLabel(units[0])}.png`;
    link.click();
    return;
  }

  if (format === 'pdf') {
    let pdf = null;
    for (let i = 0; i < units.length; i++) {
      onProgress?.(i + 1, units.length);
      const canvas = await captureFn(units[i]);
      const dataUrl = canvas.toDataURL('image/png');
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
      } else {
        pdf.addPage([canvas.width, canvas.height], orientation);
      }
      pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
      // Let the (large, uncompressed) canvas be garbage-collected
      // before capturing the next unit, rather than keeping every
      // one alive until the whole export finishes.
    }
    pdf.save(`${safeName}.pdf`);
    return;
  }

  // PNG, multiple units — zip them, adding each one's compressed
  // bytes as soon as it's captured rather than holding every raw
  // canvas in memory until the end.
  const zip = new JSZip();
  for (let i = 0; i < units.length; i++) {
    onProgress?.(i + 1, units.length);
    const canvas = await captureFn(units[i]);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    zip.file(zipEntryName(units[i]), base64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}-${unitKind}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}
