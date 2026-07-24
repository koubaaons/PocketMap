// @vitest-environment jsdom
/**
 * @fileoverview Tests for CollectionSummary.jsx.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollectionSummary } from '../CollectionSummary.jsx';

describe('CollectionSummary', () => {
  it('displays all four stat values', () => {
    render(<CollectionSummary stats={{ total: 100, owned: 40, missing: 50, unorganised: 10, pct: 40 }} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('displays the completion percentage in the ring', () => {
    render(<CollectionSummary stats={{ total: 100, owned: 40, missing: 50, unorganised: 10, pct: 40 }} />);
    expect(screen.getByLabelText('40% complete')).toBeInTheDocument();
  });

  it('renders correctly for a fully-empty collection (all zeros)', () => {
    render(<CollectionSummary stats={{ total: 0, owned: 0, missing: 0, unorganised: 0, pct: 0 }} />);
    expect(screen.getByLabelText('0% complete')).toBeInTheDocument();
  });
});
