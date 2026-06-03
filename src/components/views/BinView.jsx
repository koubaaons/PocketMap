import { useState, useCallback, useMemo } from 'react';
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { relativeDate } from '../../utils/index.js';

export function BinView({ bin, binders, toast }) {
  const dispatch = useDispatch();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const binderMap = useMemo(() => {
    const map = {};
    binders.forEach(b => map[b.id] = b);
    return map;
  }, [binders]);

  const handleRestore = useCallback((card) => {
    const binderExists = binders.some(b => b.id === card.binderId);
    if (!binderExists) { toast('Binder no longer exists — cannot restore', 'error'); return; }
    dispatch({ type: ACTIONS.BIN_RESTORE, payload: { cardId: card.id } });
    toast(`"${card.name}" restored`);
  }, [binders, dispatch, toast]);

  const handlePermDelete = useCallback((cardId) => {
    dispatch({ type: ACTIONS.BIN_DELETE, payload: { cardId } });
    toast('Deleted permanently', 'info');
  }, [dispatch, toast]);

  if (bin.length === 0) {
    return (
      <div className="view">
        <EmptyState icon="🗑" title="Trash is empty" subtitle="Deleted cards appear here. You can restore or permanently delete them." />
      </div>
    );
  }

  return (
    <div className="view">
      <div className="section-header">
        <p className="search-count">{bin.length} item{bin.length !== 1 ? 's' : ''} in trash</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmEmpty(true)}>Empty Bin</Button>
      </div>
      <div className="bin-list">
        {bin.map(card => {
          const b = binderMap[card.binderId];
          return (
            <div key={card.id} className="bin-row">
              <div className="bin-info">
                <span className="bin-name">{card.name}</span>
                <span className="bin-meta">
                  {card.character && <>{card.character} · </>}
                  {b ? b.name : 'Binder deleted'} · Deleted {relativeDate(card.deletedAt)}
                </span>
              </div>
              <div className="bin-actions">
                <Button variant="ghost" size="sm" onClick={() => handleRestore(card)}>Restore</Button>
                <Button variant="danger" size="sm" onClick={() => handlePermDelete(card.id)}>Delete Forever</Button>
              </div>
            </div>
          );
        })}
      </div>
      {confirmEmpty && (
        <ConfirmModal title="Empty trash?"
          message={`This will permanently delete all ${bin.length} item${bin.length !== 1 ? 's' : ''}. This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={() => { dispatch({ type: ACTIONS.BIN_EMPTY }); toast('Trash emptied'); }}
          onClose={() => setConfirmEmpty(false)} />
      )}
    </div>
  );
}
