

import { useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { clearState } from '../../store/storage.js';

export function AccountView({ toast }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    clearState();
    toast('All data cleared. Reloading…', 'info');
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div className="view">
      <div className="section-header">
        <h3 className="section-title">Account</h3>
      </div>

      <div className="account-section">
        <h4 className="account-section-title">Profile</h4>
        <p className="account-section-subtitle">Local user — no account required</p>
      </div>

      <div className="account-section">
        <h4 className="account-section-title">Data & Storage</h4>
        <p className="account-section-subtitle">
          All data is stored locally on this device.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
          Clear All Data
        </Button>
      </div>

      {confirmReset && (
        <ConfirmModal
          title="Clear all data?"
          message="This will permanently delete all your binders, cards, collections, and settings. This cannot be undone."
          confirmLabel="Clear Everything"
          onConfirm={handleReset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
