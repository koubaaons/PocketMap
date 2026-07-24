// @vitest-environment jsdom
/**
 * @fileoverview Tests for CollectionUpdateBanner.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CollectionUpdateBanner } from '../CollectionUpdateBanner.jsx';

function makeEntry(overrides = {}) {
  return { collectionId: 'col-1', collectionName: 'Base Set', newCards: [{ id: 'c1', name: 'Pikachu' }], ...overrides };
}

describe('CollectionUpdateBanner', () => {
  it('renders nothing when there are no pending updates', () => {
    const { container } = render(
      <CollectionUpdateBanner pendingUpdates={[]} onImport={vi.fn()} onDismiss={vi.fn()} toast={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('uses singular wording for exactly one new card', () => {
    render(<CollectionUpdateBanner pendingUpdates={[makeEntry()]} onImport={vi.fn()} onDismiss={vi.fn()} toast={vi.fn()} />);
    expect(screen.getByText(/1 new card was added to "Base Set"/)).toBeInTheDocument();
  });

  it('uses plural wording for more than one new card', () => {
    render(<CollectionUpdateBanner
      pendingUpdates={[makeEntry({ newCards: [{ id: 'c1' }, { id: 'c2' }] })]}
      onImport={vi.fn()} onDismiss={vi.fn()} toast={vi.fn()}
    />);
    expect(screen.getByText(/2 new cards were added to "Base Set"/)).toBeInTheDocument();
  });

  it('renders one banner per pending collection', () => {
    render(<CollectionUpdateBanner
      pendingUpdates={[makeEntry({ collectionId: 'col-1', collectionName: 'Base Set' }), makeEntry({ collectionId: 'col-2', collectionName: 'Jungle' })]}
      onImport={vi.fn()} onDismiss={vi.fn()} toast={vi.fn()}
    />);
    expect(screen.getByText(/Base Set/)).toBeInTheDocument();
    expect(screen.getByText(/Jungle/)).toBeInTheDocument();
  });

  it('clicking Dismiss calls onDismiss with the right collection id, without importing anything', () => {
    const onDismiss = vi.fn();
    const onImport = vi.fn();
    render(<CollectionUpdateBanner pendingUpdates={[makeEntry()]} onImport={onImport} onDismiss={onDismiss} toast={vi.fn()} />);

    fireEvent.click(screen.getByText('Dismiss'));

    expect(onDismiss).toHaveBeenCalledWith('col-1');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('clicking Import calls onImport and shows a success toast on completion', async () => {
    const onImport = vi.fn().mockResolvedValue({ added: 1, failures: [] });
    const toast = vi.fn();
    render(<CollectionUpdateBanner pendingUpdates={[makeEntry()]} onImport={onImport} onDismiss={vi.fn()} toast={toast} />);

    fireEvent.click(screen.getByText('Import'));

    expect(onImport).toHaveBeenCalledWith('col-1');
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('Added 1 new card')));
  });

  it('shows an error-styled toast when some cards fail to import', async () => {
    const onImport = vi.fn().mockResolvedValue({ added: 1, failures: [{ name: 'Bad Card', error: 'x' }] });
    const toast = vi.fn();
    render(<CollectionUpdateBanner pendingUpdates={[makeEntry()]} onImport={onImport} onDismiss={vi.fn()} toast={toast} />);

    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('1 failed'), 'error'));
  });

  it('disables both buttons while the import for that collection is in progress', async () => {
    let resolveImport;
    const onImport = vi.fn().mockReturnValue(new Promise(resolve => { resolveImport = resolve; }));
    render(<CollectionUpdateBanner pendingUpdates={[makeEntry()]} onImport={onImport} onDismiss={vi.fn()} toast={vi.fn()} />);

    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => expect(screen.getByText('Importing…')).toBeDisabled());
    expect(screen.getByText('Dismiss')).toBeDisabled();

    await act(async () => { resolveImport({ added: 1, failures: [] }); await Promise.resolve(); });
  });
});
