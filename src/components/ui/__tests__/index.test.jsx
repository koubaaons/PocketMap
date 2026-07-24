// @vitest-environment jsdom
/**
 * @fileoverview Tests for the shared UI primitives in ui/index.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Button, Input, Select, Modal, ModalActions, ToastContainer, EmptyState, StatCard, Badge, ConfirmModal } from '../index.jsx';

describe('Button', () => {
  it('renders its children and responds to clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByText('Save'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when the disabled prop is set, and does not fire onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Save</Button>);
    expect(screen.getByText('Save')).toBeDisabled();
    fireEvent.click(screen.getByText('Save'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the variant and size to the className', () => {
    render(<Button variant="danger" size="sm">Delete</Button>);
    expect(screen.getByText('Delete')).toHaveClass('btn-danger', 'btn-sm');
  });
});

describe('Input', () => {
  it('renders a label wired to the input via htmlFor/id', () => {
    render(<Input id="name" label="Name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('shows an error message with role="alert" when given one', () => {
    render(<Input id="name" label="Name" error="Name is required" value="" onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('links the input to its error via aria-describedby', () => {
    render(<Input id="name" label="Name" error="Name is required" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'name-error');
  });
});

describe('Select', () => {
  it('renders every option, with the right one able to be disabled', () => {
    render(<Select id="rarity" label="Rarity" value="" onChange={() => {}} options={[
      { value: '', label: 'Any' }, { value: 'rare', label: 'Rare' }, { value: 'secret', label: 'Secret', disabled: true },
    ]} />);

    expect(screen.getByRole('option', { name: 'Rare' })).not.toBeDisabled();
    expect(screen.getByRole('option', { name: 'Secret' })).toBeDisabled();
  });
});

describe('Modal', () => {
  it('renders the title and children', () => {
    render(<Modal title="Edit Binder" onClose={vi.fn()}><p>Body content</p></Modal>);
    expect(screen.getByText('Edit Binder')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<Modal title="Edit Binder" onClose={onClose}><p>Body</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the backdrop (outside the modal box)', () => {
    const onClose = vi.fn();
    render(<Modal title="Edit Binder" onClose={onClose}><p>Body</p></Modal>);
    fireEvent.click(screen.getByRole('dialog')); // the overlay itself
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT call onClose when clicking inside the modal box itself', () => {
    const onClose = vi.fn();
    render(<Modal title="Edit Binder" onClose={onClose}><p>Body content</p></Modal>);
    fireEvent.click(screen.getByText('Body content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the × button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal title="Edit Binder" onClose={onClose}><p>Body</p></Modal>);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus to the modal box on mount (focus trap entry)', () => {
    render(<Modal title="Edit Binder" onClose={vi.fn()}><p>Body</p></Modal>);
    expect(document.activeElement).toBe(screen.getByRole('dialog').firstChild);
  });

  it('applies the size class', () => {
    render(<Modal title="Confirm" onClose={vi.fn()} size="sm"><p>Body</p></Modal>);
    expect(screen.getByRole('dialog').firstChild).toHaveClass('modal-sm');
  });
});

describe('ModalActions', () => {
  it('renders its children inside the actions row', () => {
    render(<ModalActions><button>OK</button></ModalActions>);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  it('renders every toast with its message', () => {
    render(<ToastContainer toasts={[{ id: 1, message: 'Saved!', type: 'success' }, { id: 2, message: 'Oops', type: 'error' }]} dismiss={vi.fn()} />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    expect(screen.getByText('Oops')).toBeInTheDocument();
  });

  it('calls dismiss with the right id when a toast is clicked', () => {
    const dismiss = vi.fn();
    render(<ToastContainer toasts={[{ id: 'toast-1', message: 'Saved!', type: 'success' }]} dismiss={dismiss} />);
    fireEvent.click(screen.getByText('Saved!'));
    expect(dismiss).toHaveBeenCalledWith('toast-1');
  });
});

describe('EmptyState', () => {
  it('renders icon, title, and subtitle when given', () => {
    render(<EmptyState icon="🃏" title="No cards" subtitle="Add your first card" />);
    expect(screen.getByText('No cards')).toBeInTheDocument();
    expect(screen.getByText('Add your first card')).toBeInTheDocument();
  });

  it('omits the subtitle element entirely when none is given', () => {
    const { container } = render(<EmptyState icon="🃏" title="No cards" />);
    expect(container.querySelector('.empty-state-subtitle')).toBeFalsy();
  });

  it('renders the action slot when given', () => {
    render(<EmptyState icon="🃏" title="No cards" action={<button>Add card</button>} />);
    expect(screen.getByText('Add card')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders the label and animates the value up via useCountUp', () => {
    vi.useFakeTimers();
    render(<StatCard value={100} label="Total Cards" />);
    expect(screen.getByText('Total Cards')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText('100')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders an icon when a tone/icon are given', () => {
    render(<StatCard value={5} label="Owned" icon="ti-check" tone="success" />);
    expect(document.querySelector('.ti-check')).toBeTruthy();
  });
});

describe('Badge', () => {
  it('renders its children with the given variant class', () => {
    render(<Badge variant="success">Owned</Badge>);
    expect(screen.getByText('Owned')).toHaveClass('badge-success');
  });

  it('defaults to the "default" variant', () => {
    render(<Badge>Plain</Badge>);
    expect(screen.getByText('Plain')).toHaveClass('badge-default');
  });
});

describe('ConfirmModal', () => {
  it('calls both onConfirm and onClose when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmModal title="Delete?" message="Are you sure?" onConfirm={onConfirm} onClose={onClose} />);

    fireEvent.click(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls only onClose (not onConfirm) when Cancel is clicked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmModal title="Delete?" message="Are you sure?" onConfirm={onConfirm} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('uses a custom confirm label when given', () => {
    render(<ConfirmModal title="Declutter?" message="Sure?" confirmLabel="Declutter" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Declutter')).toBeInTheDocument();
  });
});
