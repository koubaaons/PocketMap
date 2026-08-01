// @vitest-environment jsdom
/**
 * @fileoverview Tests for Sidebar.jsx.
 *
 * Focused specifically on the real bug just fixed: the sidebar's own
 * displayed name and avatar initial were hardcoded, literal text
 * ("Ons" / "ON"), never actually wired up to the real, logged-in
 * account at all — every single account, regardless of who was
 * genuinely signed in, saw the same name. Not attempting broader
 * coverage of the rest of this file's navigation logic here, which
 * was already working correctly and isn't what changed.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar.jsx';

const NAV = { currentView: 'home' };

describe('Sidebar — real bug fixed: the displayed name/avatar are no longer hardcoded', () => {
  it('shows the real user\'s own display_name (from user_metadata, the same field AccountView\'s "Save name" writes to) when one has been set', () => {
    const user = { email: 'test@example.com', user_metadata: { display_name: 'Samy' } };
    render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={user} />);

    expect(screen.getByText('Samy')).toBeInTheDocument();
    expect(screen.queryByText('Ons')).not.toBeInTheDocument();
  });

  it('falls back to the local part of the email (before the @) when no display_name has ever been set — the common case, not an edge case, since most accounts never set one', () => {
    const user = { email: 'samy.koubaa@gmail.com', user_metadata: {} };
    render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={user} />);

    expect(screen.getByText('samy.koubaa')).toBeInTheDocument();
  });

  it('falls back to "Account" (not a blank name, and never the hardcoded "Ons") if user is missing entirely', () => {
    render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={null} />);

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.queryByText('Ons')).not.toBeInTheDocument();
  });

  it('derives the avatar initial from the real displayed name, not a hardcoded "ON"', () => {
    const user = { email: 'test@example.com', user_metadata: { display_name: 'Zara' } };
    render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={user} />);

    expect(screen.getByText('ZA')).toBeInTheDocument();
  });

  it('an empty-string display_name (whitespace only) is treated the same as unset, falling back to the email', () => {
    const user = { email: 'test@example.com', user_metadata: { display_name: '   ' } };
    render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={user} />);

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('two different accounts on the same browser genuinely show two different names — the actual real-world scenario that surfaced this bug', () => {
    const userA = { email: 'ons@example.com', user_metadata: { display_name: 'Ons' } };
    const { unmount } = render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={userA} />);
    expect(screen.getByText('Ons')).toBeInTheDocument();
    unmount();

    const userB = { email: 'samy.koubaa@gmail.com', user_metadata: {} };
    render(<Sidebar nav={NAV} bin={[]} onNavigate={() => {}} user={userB} />);
    expect(screen.getByText('samy.koubaa')).toBeInTheDocument();
    expect(screen.queryByText('Ons')).not.toBeInTheDocument();
  });
});
