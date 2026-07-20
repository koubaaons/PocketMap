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
import { buildPageSlotMap } from '../selectors/binderSelectors.js';

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
  }));
}

/**
 * Renders one page off-screen and returns a captured canvas. Caller
 * is responsible for extracting whatever it needs (dataURL, etc.) and
 * discarding the canvas promptly — see the memory-usage note above.
 */
async function capturePage(pageNumber, { binder, allBinderSlots, allBinderPanels, cardDefMap, binderInsertMap, inventoryGroupMap, options }) {
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

  // cardsOnly's whole point is transparency, which a PDF page can't
  // represent — silently falling back would produce a file that
  // doesn't look like what the user asked for, so this is enforced
  // here rather than left to the UI to remember.
  if (format === 'pdf' && options.cardsOnly) {
    throw new Error('"Cards only" (transparent) requires a PNG export — PDF pages are always opaque.');
  }

  const safeName = binder.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'binder';
  const captureOpts = { binder, allBinderSlots, allBinderPanels, cardDefMap, binderInsertMap, inventoryGroupMap, options };

  // Single-page PNG stays a simple direct download — no zip needed
  // for exactly one file, and no need for the streaming machinery
  // below since there's nothing to accumulate across pages.
  if (format === 'png' && pageNumbers.length === 1) {
    onProgress?.(1, 1);
    const canvas = await capturePage(pageNumbers[0], captureOpts);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${safeName}-page-${pageNumbers[0]}.png`;
    link.click();
    return;
  }

  if (format === 'pdf') {
    let pdf = null;
    for (let i = 0; i < pageNumbers.length; i++) {
      onProgress?.(i + 1, pageNumbers.length);
      const canvas = await capturePage(pageNumbers[i], captureOpts);
      const dataUrl = canvas.toDataURL('image/png');
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
      } else {
        pdf.addPage([canvas.width, canvas.height], orientation);
      }
      pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
      // Let the (large, uncompressed) canvas be garbage-collected
      // before capturing the next page, rather than keeping every
      // page's canvas alive until the whole export finishes.
    }
    pdf.save(`${safeName}.pdf`);
    return;
  }

  // PNG, multiple pages — zip them, adding each page's compressed
  // bytes as soon as it's captured rather than holding every raw
  // canvas in memory until the end.
  const zip = new JSZip();
  for (let i = 0; i < pageNumbers.length; i++) {
    onProgress?.(i + 1, pageNumbers.length);
    const canvas = await capturePage(pageNumbers[i], captureOpts);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    zip.file(`page-${String(pageNumbers[i]).padStart(3, '0')}.png`, base64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}-pages.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}