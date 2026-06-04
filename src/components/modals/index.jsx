/**
 * @fileoverview Feature modals — Binder, Card, and Collection forms.
 *
 * Each modal manages its own local form state.
 * Validated data is passed to onSubmit — never dispatched directly.
 * This keeps modals reusable and independently testable.
 */

import { useState, useCallback } from 'react';
import { Modal, ModalActions, Button, Input, Select, ConfirmModal } from '../ui/index.jsx';
import { createBinder, createCard, createCollection, createTemplateField } from '../../types/index.js';
import { isSlotOccupied, availableSlots } from '../../utils/index.js';

// ─── Binder Modal ─────────────────────────────────────────────────────────────

export function CreateBinderModal({ onSubmit, onClose }) {
  const [fields, setFields] = useState({ name: '', cols: 3, rows: 3, pages: 20 });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const capacity = fields.rows * fields.cols * fields.pages || 0;

  const handleSubmit = useCallback(() => {
    const { binder, errors: errs } = createBinder(fields);
    if (!binder) {
      const fieldErrors = {};
      errs.forEach(e => {
        if (e.includes('name')) fieldErrors.name = 'Required';
        if (e.includes('cols')) fieldErrors.cols = '1–10';
        if (e.includes('rows')) fieldErrors.rows = '1–10';
        if (e.includes('pages')) fieldErrors.pages = '1–500';
      });
      setErrors(fieldErrors);
      return;
    }
    onSubmit(binder);
  }, [fields, onSubmit]);

  return (
    <Modal title="Create New Binder" onClose={onClose}>
      <Input id="binder-name" label="Binder Name *" placeholder="e.g. Winx Club Main Collection"
        value={fields.name} onChange={e => set('name', e.target.value)} error={errors.name} autoFocus />
      <div className="form-row">
        <Input id="binder-cols" label="Columns" type="number" min={1} max={10}
          value={fields.cols} onChange={e => set('cols', +e.target.value)} error={errors.cols} />
        <Input id="binder-rows" label="Rows" type="number" min={1} max={10}
          value={fields.rows} onChange={e => set('rows', +e.target.value)} error={errors.rows} />
      </div>
      <Input id="binder-pages" label="Number of Pages" type="number" min={1} max={500}
        value={fields.pages} onChange={e => set('pages', +e.target.value)} error={errors.pages} />
      <p className="capacity-hint">
        Total capacity: <strong>{Number.isFinite(capacity) ? capacity.toLocaleString() : '—'} cards</strong>
      </p>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Create Binder</Button>
      </ModalActions>
    </Modal>
  );
}

// ─── Card Modals ──────────────────────────────────────────────────────────────

export function AddCardModal({ binder, cards, initialPage = 1, initialSlot = null, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    name: '', character: '', series: '',
    page: initialPage,
    slot: initialSlot ?? (availableSlots(cards, binder, initialPage)[0] ?? 1),
    favorite: false,
  });
  const [errors, setErrors] = useState({});
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  const pageOptions = Array.from({ length: binder.pages }, (_, i) => ({
    value: i + 1, label: `Page ${i + 1}`,
  }));

  const totalSlots = binder.rows * binder.cols;
  const slotOptions = Array.from({ length: totalSlots }, (_, i) => {
    const slot = i + 1;
    const taken = isSlotOccupied(cards, binder.id, fields.page, slot);
    return { value: slot, label: `Slot ${slot}${taken ? ' (taken)' : ''}`, disabled: taken };
  });

  const handlePageChange = (page) => {
    const free = availableSlots(cards, binder, page);
    setFields(f => ({ ...f, page, slot: free.includes(f.slot) ? f.slot : (free[0] ?? 1) }));
  };

  const handleSubmit = useCallback(() => {
    if (isSlotOccupied(cards, binder.id, fields.page, fields.slot)) {
      setErrors({ slot: 'This slot is already taken' });
      return;
    }
    const { card, errors: errs } = createCard({ ...fields, binderId: binder.id });
    if (!card) {
      const fieldErrors = {};
      errs.forEach(e => { if (e.includes('name')) fieldErrors.name = 'Required'; });
      setErrors(fieldErrors);
      return;
    }
    onSubmit(card);
  }, [fields, cards, binder, onSubmit]);

  return (
    <Modal title={`Add Card to "${binder.name}"`} onClose={onClose}>
      <Input id="card-name" label="Card Name *" placeholder="e.g. Bloom Enchantix"
        value={fields.name} onChange={e => set('name', e.target.value)} error={errors.name} autoFocus />
      <div className="form-row">
        <Input id="card-char" label="Character" placeholder="e.g. Bloom"
          value={fields.character} onChange={e => set('character', e.target.value)} />
        <Input id="card-series" label="Series" placeholder="e.g. Winx Club"
          value={fields.series} onChange={e => set('series', e.target.value)} />
      </div>
      <div className="form-row">
        <Select id="card-page" label="Page" options={pageOptions}
          value={fields.page} onChange={e => handlePageChange(+e.target.value)} />
        <Select id="card-slot" label="Slot" options={slotOptions}
          value={fields.slot} onChange={e => set('slot', +e.target.value)} error={errors.slot} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={fields.favorite}
          onChange={e => set('favorite', e.target.checked)} />
        Mark as Favorite
      </label>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Add Card</Button>
      </ModalActions>
    </Modal>
  );
}

export function EditCardModal({ card, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    name: card.name,
    character: card.character ?? '',
    series: card.series ?? '',
    favorite: card.favorite,
  });
  const [errors, setErrors] = useState({});
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    const name = fields.name.trim();
    if (!name) { setErrors({ name: 'Required' }); return; }
    onSubmit({ ...card, ...fields, name });
  };

  return (
    <Modal title="Edit Card" onClose={onClose}>
      <Input id="edit-name" label="Card Name *" value={fields.name}
        onChange={e => set('name', e.target.value)} error={errors.name} autoFocus />
      <div className="form-row">
        <Input id="edit-char" label="Character" value={fields.character}
          onChange={e => set('character', e.target.value)} />
        <Input id="edit-series" label="Series" value={fields.series}
          onChange={e => set('series', e.target.value)} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={fields.favorite}
          onChange={e => set('favorite', e.target.checked)} />
        Mark as Favorite
      </label>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
      </ModalActions>
    </Modal>
  );
}

export function CardDetailModal({ card, binderName, onEdit, onDelete, onToggleFavorite, onClose }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <ConfirmModal
        title="Delete Card?"
        message={`Move "${card.name}" to the trash? You can restore it later.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setConfirming(false)}
      />
    );
  }

  return (
    <Modal title={card.name} onClose={onClose}>
      <div className="card-detail-grid">
        {card.character && (
          <div className="detail-field">
            <span className="detail-label">Character</span>
            <span className="detail-value">{card.character}</span>
          </div>
        )}
        {card.series && (
          <div className="detail-field">
            <span className="detail-label">Series</span>
            <span className="detail-value detail-series">{card.series}</span>
          </div>
        )}
        <div className="detail-field">
          <span className="detail-label">Binder</span>
          <span className="detail-value">{binderName}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">Location</span>
          <span className="detail-value">Page {card.page} · Slot {card.slot}</span>
        </div>
      </div>
      {card.favorite && <div className="fav-badge">★ Favorite</div>}
      <hr className="modal-divider" />
      <div className="card-detail-actions">
        <Button variant="ghost" size="sm" onClick={onToggleFavorite}>
          {card.favorite ? '☆ Unfavorite' : '★ Favorite'}
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Delete</Button>
        </div>
      </div>
    </Modal>
  );
}

const MOCK_API_SOURCES = [
  {
    id: 'winx-api',
    name: 'Winx Club Cards',
    category: 'Anime',
    cardCount: 406,
    templateFields: [
      { field_name: 'Character', field_type: 'text', is_required: true },
      { field_name: 'Season', field_type: 'text', is_required: false },
      { field_name: 'Transformation', field_type: 'text', is_required: false },
      { field_name: 'Rarity', field_type: 'select', is_required: true },
      { field_name: 'Card Number', field_type: 'text', is_required: true },
    ],
    sampleCards: [
      { name: 'Bloom Believix', attributes: { Character: 'Bloom', Season: 'Season 4', Transformation: 'Believix', Rarity: 'Rare', 'Card Number': 'WC-001' } },
      { name: 'Flora Enchantix', attributes: { Character: 'Flora', Season: 'Season 3', Transformation: 'Enchantix', Rarity: 'Ultra Rare', 'Card Number': 'WC-002' } },
      { name: 'Musa Concert', attributes: { Character: 'Musa', Season: 'Season 2', Transformation: 'Charmix', Rarity: 'Common', 'Card Number': 'WC-003' } },
    ],
  },
  {
    id: 'yugioh-api',
    name: 'Yu-Gi-Oh! TCG',
    category: 'Trading Cards',
    cardCount: 12458,
    templateFields: [
      { field_name: 'Type', field_type: 'select', is_required: true },
      { field_name: 'Attribute', field_type: 'select', is_required: false },
      { field_name: 'ATK', field_type: 'number', is_required: false },
      { field_name: 'DEF', field_type: 'number', is_required: false },
      { field_name: 'Rarity', field_type: 'select', is_required: true },
      { field_name: 'Set Number', field_type: 'text', is_required: true },
    ],
    sampleCards: [],
  },
  {
    id: 'pokemon-api',
    name: 'Pokémon TCG',
    category: 'Trading Cards',
    cardCount: 16192,
    templateFields: [
      { field_name: 'Pokémon', field_type: 'text', is_required: true },
      { field_name: 'Set', field_type: 'text', is_required: true },
      { field_name: 'HP', field_type: 'number', is_required: false },
      { field_name: 'Rarity', field_type: 'select', is_required: true },
      { field_name: 'Card Number', field_type: 'text', is_required: true },
    ],
    sampleCards: [],
  },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown' },
];

export function CreateCollectionModal({ onSubmit, onClose }) {
  // step: 'choose' | 'api-select' | 'api-confirm' | 'custom-name' | 'custom-template' | 'custom-review'
  const [step, setStep] = useState('choose');
  const [selectedSource, setSelectedSource] = useState(null);

  // Custom collection form state
  const [collectionName, setCollectionName] = useState('');
  const [nameError, setNameError] = useState('');
  const [templateFields, setTemplateFields] = useState([
    { id: Date.now(), field_name: '', field_type: 'text', is_required: false },
  ]);
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addField = () => {
    setTemplateFields(f => [
      ...f,
      { id: Date.now(), field_name: '', field_type: 'text', is_required: false },
    ]);
  };

  const updateField = (id, key, val) => {
    setTemplateFields(f => f.map(field => field.id === id ? { ...field, [key]: val } : field));
  };

  const removeField = (id) => {
    setTemplateFields(f => f.filter(field => field.id !== id));
  };

  // ── Custom flow submit ────────────────────────────────────────────────────

  const handleCustomNameNext = () => {
    if (!collectionName.trim()) { setNameError('Collection name is required'); return; }
    setNameError('');
    setStep('custom-template');
  };

  const handleCustomTemplateNext = () => {
    const errors = {};
    templateFields.forEach(f => {
      if (!f.field_name.trim()) errors[f.id] = 'Field name is required';
    });
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setStep('custom-review');
  };

  const handleCustomConfirm = () => {
    const { collection, errors: cErrors } = createCollection({
      name: collectionName,
      is_custom: true,
      import_source: null,
    });
    if (!collection) { console.error('Collection creation failed:', cErrors); return; }

    const fields = templateFields
      .map(f => {
        const { field } = createTemplateField({
          collectionId: collection.id,
          field_name: f.field_name,
          field_type: f.field_type,
          is_required: f.is_required,
        });
        return field;
      })
      .filter(Boolean);

    // Custom collections start with no card definitions — user adds manually later
    onSubmit({ collection, templateFields: fields, cardDefinitions: [] });
  };

  // ── API flow submit ────────────────────────────────────────────────────────

  const handleApiConfirm = () => {
    if (!selectedSource) return;

    const { collection, errors: cErrors } = createCollection({
      name: selectedSource.name,
      is_custom: false,
      import_source: selectedSource.id,
    });
    if (!collection) { console.error('Collection creation failed:', cErrors); return; }

    const fields = selectedSource.templateFields
      .map(f => {
        const { field } = createTemplateField({
          collectionId: collection.id,
          field_name: f.field_name,
          field_type: f.field_type,
          is_required: f.is_required,
        });
        return field;
      })
      .filter(Boolean);

    // API collections bulk-create card definitions from the mock data
    // In a future issue, replace sampleCards with a real API response
    const cardDefs = selectedSource.sampleCards.map(c => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      collectionId: collection.id,
      name: c.name,
      image_url: null,
      attributes: c.attributes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    onSubmit({ collection, templateFields: fields, cardDefinitions: cardDefs });
  };

  // ── Render steps ──────────────────────────────────────────────────────────

  if (step === 'choose') {
    return (
      <Modal title="Create New Collection" onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          Choose how you want to create your collection.
        </p>
        <div className="collection-choose-grid">
          <button className="collection-choose-option" onClick={() => setStep('api-select')}>
            <span className="choose-icon">🌐</span>
            <span className="choose-title">Import from API</span>
            <span className="choose-desc">Choose from thousands of official collections provided by our supported APIs.</span>
          </button>
          <button className="collection-choose-option" onClick={() => setStep('custom-name')}>
            <span className="choose-icon">✏️</span>
            <span className="choose-title">Create Custom Collection</span>
            <span className="choose-desc">Build a completely custom collection with your own template and fields.</span>
          </button>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </ModalActions>
      </Modal>
    );
  }

  // ── API: Select source ────────────────────────────────────────────────────

  if (step === 'api-select') {
    return (
      <Modal title="Import Collection from API" onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Choose a collection to import and confirm the template.
        </p>
        <div className="api-sources-grid">
          {MOCK_API_SOURCES.map(source => (
            <button
              key={source.id}
              className={`api-source-card ${selectedSource?.id === source.id ? 'selected' : ''}`}
              onClick={() => setSelectedSource(source)}
            >
              <div className="api-source-name">{source.name}</div>
              <div className="api-source-meta">{source.category}</div>
              <div className="api-source-count">{source.cardCount.toLocaleString()} cards</div>
            </button>
          ))}
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('choose')}>← Back</Button>
          <Button variant="primary" onClick={() => selectedSource && setStep('api-confirm')} disabled={!selectedSource}>
            Next →
          </Button>
        </ModalActions>
      </Modal>
    );
  }

  // ── API: Confirm ──────────────────────────────────────────────────────────

  if (step === 'api-confirm') {
    return (
      <Modal title={`Import "${selectedSource.name}"`} onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          This will create the collection with the following template fields:
        </p>
        <div className="review-fields">
          {selectedSource.templateFields.map((f, i) => (
            <div key={i} className="review-field-row">
              <span className="review-field-name">{f.field_name}</span>
              <span className="review-field-type">{f.field_type}</span>
              {f.is_required && <span className="review-field-required">required</span>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
          {selectedSource.sampleCards.length > 0
            ? `${selectedSource.sampleCards.length} sample cards will be imported.`
            : 'Card definitions will be imported from the API.'}
        </p>
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('api-select')}>← Back</Button>
          <Button variant="primary" onClick={handleApiConfirm}>Create Collection</Button>
        </ModalActions>
      </Modal>
    );
  }

  // ── Custom: Name ──────────────────────────────────────────────────────────

  if (step === 'custom-name') {
    return (
      <Modal title="Name Your Collection" onClose={onClose}>
        <Input
          id="col-name"
          label="Collection Name *"
          placeholder="e.g. Winx Club Cards"
          value={collectionName}
          onChange={e => setCollectionName(e.target.value)}
          error={nameError}
          autoFocus
        />
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('choose')}>← Back</Button>
          <Button variant="primary" onClick={handleCustomNameNext}>Next →</Button>
        </ModalActions>
      </Modal>
    );
  }

  // ── Custom: Build template ────────────────────────────────────────────────

  if (step === 'custom-template') {
    return (
      <Modal title="Build Your Template" onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Define the fields every card in <strong>{collectionName}</strong> will have.
          Fields cannot be deleted later, only added.
        </p>
        <div className="template-fields-list">
          {templateFields.map((field) => (
            <div key={field.id} className="template-field-row">
              <div style={{ flex: 1 }}>
                <Input
                  id={`field-name-${field.id}`}
                  placeholder="Field name e.g. Rarity"
                  value={field.field_name}
                  onChange={e => updateField(field.id, 'field_name', e.target.value)}
                  error={fieldErrors[field.id]}
                />
              </div>
              <select
                className="field-type-select"
                value={field.field_type}
                onChange={e => updateField(field.id, 'field_type', e.target.value)}
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <label className="field-required-label" title="Required">
                <input
                  type="checkbox"
                  checked={field.is_required}
                  onChange={e => updateField(field.id, 'is_required', e.target.checked)}
                />
                <span style={{ fontSize: 11 }}>Req</span>
              </label>
              {templateFields.length > 1 && (
                <button className="field-remove-btn" onClick={() => removeField(field.id)} title="Remove field">×</button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={addField} style={{ marginTop: 8 }}>
          + Add Field
        </Button>
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('custom-name')}>← Back</Button>
          <Button variant="primary" onClick={handleCustomTemplateNext}>Next →</Button>
        </ModalActions>
      </Modal>
    );
  }

  // ── Custom: Review ────────────────────────────────────────────────────────

  if (step === 'custom-review') {
    return (
      <Modal title="Review & Create" onClose={onClose}>
        <div className="review-section">
          <div className="review-label">Collection Name</div>
          <div className="review-value">{collectionName}</div>
        </div>
        <div className="review-section">
          <div className="review-label">Template Fields ({templateFields.length})</div>
          <div className="review-fields">
            {templateFields.map((f, i) => (
              <div key={i} className="review-field-row">
                <span className="review-field-name">{f.field_name}</span>
                <span className="review-field-type">{f.field_type}</span>
                {f.is_required && <span className="review-field-required">required</span>}
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          No cards yet — you'll add them manually after creating the collection.
        </p>
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('custom-template')}>← Back</Button>
          <Button variant="primary" onClick={handleCustomConfirm}>Create Collection</Button>
        </ModalActions>
      </Modal>
    );
  }

  return null;
}

export function EditCollectionModal({ collection, onSubmit, onClose }) {
  const [name, setName] = useState(collection.name);
  const [nameError, setNameError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) { setNameError('Collection name is required'); return; }
    onSubmit({ ...collection, name: name.trim(), updatedAt: Date.now() });
  };

  return (
    <Modal title="Edit Collection" onClose={onClose}>
      <Input
        id="edit-col-name"
        label="Collection Name *"
        value={name}
        onChange={e => setName(e.target.value)}
        error={nameError}
        autoFocus
      />
      {!collection.is_custom && collection.import_source && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8, marginBottom: 14 }}>
          Source: {collection.import_source}
        </p>
      )}
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
      </ModalActions>
    </Modal>
  );
}
