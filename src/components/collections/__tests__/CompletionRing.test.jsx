// @vitest-environment jsdom
/**
 * @fileoverview Tests for CompletionRing.jsx.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletionRing } from '../CompletionRing.jsx';

describe('CompletionRing', () => {
  it('renders the percentage as both text and an accessible label', () => {
    render(<CompletionRing pct={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByLabelText('42% complete')).toBeInTheDocument();
  });

  it('at 0%, the stroke offset equals the full circumference (nothing filled)', () => {
    render(<CompletionRing pct={0} />);
    const circles = document.querySelectorAll('circle');
    const progressCircle = circles[1];
    const circumference = 2 * Math.PI * 18;
    expect(parseFloat(progressCircle.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference, 1);
  });

  it('at 100%, the stroke offset is 0 (fully filled)', () => {
    render(<CompletionRing pct={100} />);
    const circles = document.querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(parseFloat(progressCircle.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 1);
  });

  it('at 50%, the stroke offset is half the circumference', () => {
    render(<CompletionRing pct={50} />);
    const circles = document.querySelectorAll('circle');
    const progressCircle = circles[1];
    const circumference = 2 * Math.PI * 18;
    expect(parseFloat(progressCircle.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference / 2, 1);
  });
});
