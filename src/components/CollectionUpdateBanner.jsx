/**
 * @fileoverview CollectionUpdateBanner — shows one dismissible banner
 * per collection that useCollectionUpdateCheck found new cards for,
 * offering to import them as unowned.
 *
 * Deliberately a persistent banner, not an auto-dismissing toast —
 * "would you like to import these?" is a real decision the person
 * needs a moment to notice and act on, not a fire-and-forget status
 * message.
 */

import { useState } from 'react';
import { Button } from './ui/index.jsx';

export function CollectionUpdateBanner({ pendingUpdates, onImport, onDismiss, toast }) {
  const [importingId, setImportingId] = useState(null);

  if (pendingUpdates.length === 0) return null;

  const handleImport = async (collectionId, collectionName) => {
    setImportingId(collectionId);
    try {
      const result = await onImport(collectionId);
      if (result?.failures?.length > 0) {
        toast(`Added ${result.added} card(s) to "${collectionName}" — ${result.failures.length} failed and were skipped`, 'error');
      } else {
        toast(`Added ${result?.added ?? 0} new card(s) to "${collectionName}" as unowned`);
      }
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="collection-update-banner-stack">
      {pendingUpdates.map(({ collectionId, collectionName, newCards }) => (
        <div key={collectionId} className="collection-update-banner">
          <span className="collection-update-banner-text">
            {newCards.length === 1
              ? `1 new card was added to "${collectionName}"`
              : `${newCards.length} new cards were added to "${collectionName}"`}
            {' '}— import {newCards.length === 1 ? 'it' : 'them'} as unowned?
          </span>
          <div className="collection-update-banner-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleImport(collectionId, collectionName)}
              disabled={importingId === collectionId}
            >
              {importingId === collectionId ? 'Importing…' : 'Import'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(collectionId)}
              disabled={importingId === collectionId}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
