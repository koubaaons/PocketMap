// @vitest-environment jsdom
/**
 * @fileoverview Tests for binderExport.js — focused specifically on
 * buildPanelAspectRatioMap, the pre-fetch logic that replaced an
 * earlier, timing-dependent approach (discovering a panel image's
 * aspect ratio via onLoad, after rendering had already started, and
 * hoping the resulting React state update committed before
 * html2canvas captured — reported as still producing a visible gap
 * around the image in practice). This is deliberately the only piece
 * of this file with direct test coverage: everything else here is
 * DOM/canvas capture work that jsdom can't meaningfully verify, the
 * same limitation every export-related file in this app has.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPanelAspectRatioMap } from '../binderExport.js';

// Mocks the global Image constructor so onload/onerror firing is
// fully controlled here, rather than depending on jsdom's own (very
// limited) image-loading behavior or a real network request.
class MockImage {
  set src(_value) {
    MockImage.instances.push(this);
  }
}
MockImage.instances = [];

describe('buildPanelAspectRatioMap', () => {
  beforeEach(() => {
    MockImage.instances = [];
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a card-type panel\'s ratio from its natural width/height', async () => {
    const panels = [{ id: 'panel-1', panelType: 'card', cardDefId: 'card-1' }];
    const cardDefMap = { 'card-1': { image_url: 'https://x/card.jpg' } };

    const promise = buildPanelAspectRatioMap(panels, cardDefMap, {});
    // The mock Image was just constructed and had .src set synchronously above
    expect(MockImage.instances).toHaveLength(1);
    MockImage.instances[0].naturalWidth = 1600;
    MockImage.instances[0].naturalHeight = 900;
    MockImage.instances[0].onload();

    const result = await promise;
    expect(result).toEqual({ 'panel-1': 1600 / 900 });
  });

  it('resolves an insert-type panel\'s ratio from binderInsertMap instead of cardDefMap', async () => {
    const panels = [{ id: 'panel-1', panelType: 'insert', insertId: 'insert-1' }];
    const binderInsertMap = { 'insert-1': { image_url: 'https://x/photo.jpg' } };

    const promise = buildPanelAspectRatioMap(panels, {}, binderInsertMap);
    MockImage.instances[0].naturalWidth = 1000;
    MockImage.instances[0].naturalHeight = 500;
    MockImage.instances[0].onload();

    const result = await promise;
    expect(result).toEqual({ 'panel-1': 2 });
  });

  it('falls back to a ratio of 1 (square) if the image fails to load, rather than rejecting the whole export over one broken image', async () => {
    const panels = [{ id: 'panel-1', panelType: 'card', cardDefId: 'card-1' }];
    const cardDefMap = { 'card-1': { image_url: 'https://x/broken.jpg' } };

    const promise = buildPanelAspectRatioMap(panels, cardDefMap, {});
    MockImage.instances[0].onerror();

    const result = await promise;
    expect(result).toEqual({ 'panel-1': 1 });
  });

  it('skips a panel entirely from the result if it has no image at all (not yet given an insert/card)', async () => {
    const panels = [{ id: 'panel-1', panelType: 'insert', insertId: null }];

    const result = await buildPanelAspectRatioMap(panels, {}, {});

    expect(result).toEqual({});
    expect(MockImage.instances).toHaveLength(0); // never even attempted to load anything
  });

  it('handles multiple panels independently, each getting its own correct ratio', async () => {
    const panels = [
      { id: 'panel-1', panelType: 'card', cardDefId: 'card-1' },
      { id: 'panel-2', panelType: 'card', cardDefId: 'card-2' },
    ];
    const cardDefMap = {
      'card-1': { image_url: 'https://x/a.jpg' },
      'card-2': { image_url: 'https://x/b.jpg' },
    };

    const promise = buildPanelAspectRatioMap(panels, cardDefMap, {});
    MockImage.instances[0].naturalWidth = 800;
    MockImage.instances[0].naturalHeight = 400;
    MockImage.instances[0].onload();
    MockImage.instances[1].naturalWidth = 300;
    MockImage.instances[1].naturalHeight = 300;
    MockImage.instances[1].onload();

    const result = await promise;
    expect(result).toEqual({ 'panel-1': 2, 'panel-2': 1 });
  });
});
