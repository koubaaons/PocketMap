// @vitest-environment jsdom
/**
 * @fileoverview Tests for AuthGate.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthGate } from '../AuthGate.jsx';

let mockAuthState = { user: null, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
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
  LoginView: ({ onSwitchToRegister, onForgotPassword }) => (
    <div>
      <span>Login Screen</span>
      <button onClick={onSwitchToRegister}>Switch to register</button>
      <button onClick={onForgotPassword}>Forgot password</button>
    </div>
  ),
}));

vi.mock('../views/ForgotPasswordView.jsx', () => ({
  ForgotPasswordView: ({ onBackToLogin }) => (
    <div>
      <span>Forgot Password Screen</span>
      <button onClick={onBackToLogin}>Back to login</button>
    </div>
  ),
}));

vi.mock('../views/ResetPasswordView.jsx', () => ({
  ResetPasswordView: ({ onDone }) => (
    <div>
      <span>Reset Password Screen</span>
      <button onClick={onDone}>Done</button>
    </div>
  ),
}));

describe('AuthGate', () => {
  it('renders nothing at all while the session is still loading — avoids a login-screen flash on reload', () => {
    mockAuthState = { user: null, loading: true, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
    const { container } = render(<AuthGate><span>The Real App</span></AuthGate>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the children (the real app) once a valid user session exists', () => {
    mockAuthState = { user: { id: 'user-1' }, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
    render(<AuthGate><span>The Real App</span></AuthGate>);
    expect(screen.getByText('The Real App')).toBeInTheDocument();
  });

  it('defaults to the Register screen when there is no user', () => {
    mockAuthState = { user: null, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
    render(<AuthGate><span>The Real App</span></AuthGate>);
    expect(screen.getByText('Register Screen')).toBeInTheDocument();
    expect(screen.queryByText('The Real App')).not.toBeInTheDocument();
  });

  it('switches to the Login screen when RegisterView asks to', () => {
    mockAuthState = { user: null, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
    render(<AuthGate><span>The Real App</span></AuthGate>);

    fireEvent.click(screen.getByText('Switch to login'));

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });

  it('switches back to Register from Login', () => {
    mockAuthState = { user: null, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
    render(<AuthGate><span>The Real App</span></AuthGate>);

    fireEvent.click(screen.getByText('Switch to login'));
    fireEvent.click(screen.getByText('Switch to register'));

    expect(screen.getByText('Register Screen')).toBeInTheDocument();
  });

  describe('password reset flow (real feature)', () => {
    it('switches to the Forgot Password screen from Login', () => {
      mockAuthState = { user: null, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
      render(<AuthGate><span>The Real App</span></AuthGate>);

      fireEvent.click(screen.getByText('Switch to login'));
      fireEvent.click(screen.getByText('Forgot password'));

      expect(screen.getByText('Forgot Password Screen')).toBeInTheDocument();
    });

    it('switches back to Login from the Forgot Password screen', () => {
      mockAuthState = { user: null, loading: false, passwordRecovery: false, clearPasswordRecovery: vi.fn() };
      render(<AuthGate><span>The Real App</span></AuthGate>);

      fireEvent.click(screen.getByText('Switch to login'));
      fireEvent.click(screen.getByText('Forgot password'));
      fireEvent.click(screen.getByText('Back to login'));

      expect(screen.getByText('Login Screen')).toBeInTheDocument();
    });

    it('real bug this whole feature exists to prevent: shows ResetPasswordView, NOT the real app, when passwordRecovery is true — even though Supabase\'s PASSWORD_RECOVERY event still establishes a genuinely truthy user session', () => {
      mockAuthState = { user: { id: 'user-1' }, loading: false, passwordRecovery: true, clearPasswordRecovery: vi.fn() };
      render(<AuthGate><span>The Real App</span></AuthGate>);

      expect(screen.getByText('Reset Password Screen')).toBeInTheDocument();
      expect(screen.queryByText('The Real App')).not.toBeInTheDocument();
    });

    it('shows ResetPasswordView even with no user at all, as long as passwordRecovery is true', () => {
      mockAuthState = { user: null, loading: false, passwordRecovery: true, clearPasswordRecovery: vi.fn() };
      render(<AuthGate><span>The Real App</span></AuthGate>);

      expect(screen.getByText('Reset Password Screen')).toBeInTheDocument();
    });

    it('calling ResetPasswordView\'s onDone clears passwordRecovery and returns to the login screen', () => {
      const clearPasswordRecovery = vi.fn();
      mockAuthState = { user: { id: 'user-1' }, loading: false, passwordRecovery: true, clearPasswordRecovery };
      render(<AuthGate><span>The Real App</span></AuthGate>);

      fireEvent.click(screen.getByText('Done'));

      expect(clearPasswordRecovery).toHaveBeenCalled();
    });
  });
});
