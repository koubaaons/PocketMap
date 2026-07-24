// @vitest-environment jsdom
/**
 * @fileoverview Tests for AuthGate.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthGate } from '../AuthGate.jsx';

let mockAuthState = { user: null, loading: false };
vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../views/RegisterView.jsx', () => ({
  RegisterView: ({ onSwitchToLogin }) => (
    <div>
      <span>Register Screen</span>
      <button onClick={onSwitchToLogin}>Switch to login</button>
    </div>
  ),
}));

vi.mock('../views/LoginView.jsx', () => ({
  LoginView: ({ onSwitchToRegister }) => (
    <div>
      <span>Login Screen</span>
      <button onClick={onSwitchToRegister}>Switch to register</button>
    </div>
  ),
}));

describe('AuthGate', () => {
  it('renders nothing at all while the session is still loading — avoids a login-screen flash on reload', () => {
    mockAuthState = { user: null, loading: true };
    const { container } = render(<AuthGate><span>The Real App</span></AuthGate>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the children (the real app) once a valid user session exists', () => {
    mockAuthState = { user: { id: 'user-1' }, loading: false };
    render(<AuthGate><span>The Real App</span></AuthGate>);
    expect(screen.getByText('The Real App')).toBeInTheDocument();
  });

  it('defaults to the Register screen when there is no user', () => {
    mockAuthState = { user: null, loading: false };
    render(<AuthGate><span>The Real App</span></AuthGate>);
    expect(screen.getByText('Register Screen')).toBeInTheDocument();
    expect(screen.queryByText('The Real App')).not.toBeInTheDocument();
  });

  it('switches to the Login screen when RegisterView asks to', () => {
    mockAuthState = { user: null, loading: false };
    render(<AuthGate><span>The Real App</span></AuthGate>);

    fireEvent.click(screen.getByText('Switch to login'));

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });

  it('switches back to Register from Login', () => {
    mockAuthState = { user: null, loading: false };
    render(<AuthGate><span>The Real App</span></AuthGate>);

    fireEvent.click(screen.getByText('Switch to login'));
    fireEvent.click(screen.getByText('Switch to register'));

    expect(screen.getByText('Register Screen')).toBeInTheDocument();
  });
});
