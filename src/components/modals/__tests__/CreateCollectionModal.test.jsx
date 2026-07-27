// @vitest-environment jsdom
/**
 * @fileoverview Tests for CreateCollectionModal.
 *
 * The "choose a source" step and the Yu-Gi-Oh/Winx mock API flow were
 * removed entirely, requested directly — the only real, working
 * import path (Pokémon) already has its own dedicated entry point,
 * so this modal now goes straight to custom creation.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateCollectionModal } from '../CollectionModals.jsx';
import { vi } from 'vitest';

describe('CreateCollectionModal', () => {
  it('opens directly on the name step — no "choose a source" step exists anymore', () => {
    render(<CreateCollectionModal onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('Name Your Collection')).toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want to create/)).not.toBeInTheDocument();
    expect(screen.queryByText('Import from API')).not.toBeInTheDocument();
  });

  it('Cancel on the name step closes the modal directly, since it\'s the first step now', () => {
    const onClose = vi.fn();
    render(<CreateCollectionModal onSubmit={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  it('proceeds through the full custom flow to actually create a collection', () => {
    const onSubmit = vi.fn();
    render(<CreateCollectionModal onSubmit={onSubmit} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Collection Name *'), { target: { value: 'My Custom Cards' } });
    fireEvent.click(screen.getByText('Next →'));

    expect(screen.getByText('Build Your Template')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Field name e.g. Rarity'), { target: { value: 'Condition' } });
    fireEvent.click(screen.getByText('Next →'));

    expect(screen.getByText('Review & Create')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create Collection'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.collection.name).toBe('My Custom Cards');
    expect(payload.collection.is_custom).toBe(true);
    expect(payload.cardDefinitions).toEqual([]);
  });
});