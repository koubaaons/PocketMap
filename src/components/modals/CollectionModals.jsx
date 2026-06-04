/**
 * @fileoverview Collection modals.
 * Responsibility: create and edit collections only.
 *
 * CreateCollectionModal has two multi-step flows:
 *   Custom:  Choose → Name → Build Template → Review → Create
 *   API:     Choose → Select Source → Confirm → Create
 *
 * Collection is NOT saved until the final step.
 * On confirm, calls onSubmit({ collection, templateFields, cardDefinitions })
 */

import { useState } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createCollection, createTemplateField } from '../../types/index.js';

// ─── Mock API sources ─────────────────────────────────────────────────────────
// Replace with real API calls in a future issue.

const MOCK_API_SOURCES = [
  {
    id: 'winx-api',
    name: 'Winx Club Cards',
    category: 'Anime',
    cardCount: 406,
    templateFields: [
      { field_name: 'Character',       field_type: 'text',   is_required: true  },
      { field_name: 'Season',          field_type: 'text',   is_required: false },
      { field_name: 'Transformation',  field_type: 'text',   is_required: false },
      { field_name: 'Rarity',          field_type: 'select', is_required: true  },
      { field_name: 'Card Number',     field_type: 'text',   is_required: true  },
    ],
    sampleCards: [
      { name: 'Bloom Believix',  attributes: { Character: 'Bloom', Season: 'Season 4', Transformation: 'Believix',  Rarity: 'Rare',       'Card Number': 'WC-001' } },
      { name: 'Flora Enchantix', attributes: { Character: 'Flora', Season: 'Season 3', Transformation: 'Enchantix', Rarity: 'Ultra Rare', 'Card Number': 'WC-002' } },
      { name: 'Musa Concert',    attributes: { Character: 'Musa',  Season: 'Season 2', Transformation: 'Charmix',   Rarity: 'Common',     'Card Number': 'WC-003' } },
    ],
  },
  {
    id: 'yugioh-api',
    name: 'Yu-Gi-Oh! TCG',
    category: 'Trading Cards',
    cardCount: 12458,
    templateFields: [
      { field_name: 'Type',       field_type: 'select', is_required: true  },
      { field_name: 'Attribute',  field_type: 'select', is_required: false },
      { field_name: 'ATK',        field_type: 'number', is_required: false },
      { field_name: 'DEF',        field_type: 'number', is_required: false },
      { field_name: 'Rarity',     field_type: 'select', is_required: true  },
      { field_name: 'Set Number', field_type: 'text',   is_required: true  },
    ],
    sampleCards: [],
  },
  {
    id: 'pokemon-api',
    name: 'Pokémon TCG',
    category: 'Trading Cards',
    cardCount: 16192,
    templateFields: [
      { field_name: 'Pokémon',     field_type: 'text',   is_required: true  },
      { field_name: 'Set',         field_type: 'text',   is_required: true  },
      { field_name: 'HP',          field_type: 'number', is_required: false },
      { field_name: 'Rarity',      field_type: 'select', is_required: true  },
      { field_name: 'Card Number', field_type: 'text',   is_required: true  },
    ],
    sampleCards: [],
  },
];

const FIELD_TYPES = [
  { value: 'text',    label: 'Text'      },
  { value: 'number',  label: 'Number'    },
  { value: 'boolean', label: 'Yes / No'  },
  { value: 'select',  label: 'Dropdown'  },
];

// ─── Shared helper: TemplateFieldRow ─────────────────────────────────────────

function TemplateFieldRow({ field, error, onChange, onRemove, removable }) {
  return (
    <div className="template-field-row">
      <div style={{ flex: 1 }}>
        <Input
          id={`field-name-${field.id}`}
          placeholder="Field name e.g. Rarity"
          value={field.field_name}
          onChange={e => onChange(field.id, 'field_name', e.target.value)}
          error={error}
        />
      </div>
      <select
        className="field-type-select"
        value={field.field_type}
        onChange={e => onChange(field.id, 'field_type', e.target.value)}
      >
        {FIELD_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <label className="field-required-label" title="Required">
        <input
          type="checkbox"
          checked={field.is_required}
          onChange={e => onChange(field.id, 'is_required', e.target.checked)}
        />
        <span style={{ fontSize: 11 }}>Req</span>
      </label>
      {removable && (
        <button className="field-remove-btn" onClick={() => onRemove(field.id)} title="Remove field">×</button>
      )}
    </div>
  );
}

// ─── Shared helper: ReviewFieldList ──────────────────────────────────────────

function ReviewFieldList({ fields }) {
  return (
    <div className="review-fields">
      {fields.map((f, i) => (
        <div key={i} className="review-field-row">
          <span className="review-field-name">{f.field_name}</span>
          <span className="review-field-type">{f.field_type}</span>
          {f.is_required && <span className="review-field-required">required</span>}
        </div>
      ))}
    </div>
  );
}

// ─── CreateCollectionModal ────────────────────────────────────────────────────

export function CreateCollectionModal({ onSubmit, onClose }) {
  const [step, setStep] = useState('choose');
  const [selectedSource, setSelectedSource] = useState(null);
  const [collectionName, setCollectionName] = useState('');
  const [nameError, setNameError] = useState('');
  const [templateFields, setTemplateFields] = useState([
    { id: Date.now(), field_name: '', field_type: 'text', is_required: false },
  ]);
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Template field helpers ──────────────────────────────────────────────────

  const addField = () => {
    setTemplateFields(f => [...f, { id: Date.now(), field_name: '', field_type: 'text', is_required: false }]);
  };

  const updateField = (id, key, val) => {
    setTemplateFields(f => f.map(field => field.id === id ? { ...field, [key]: val } : field));
  };

  const removeField = (id) => {
    setTemplateFields(f => f.filter(field => field.id !== id));
  };

  // ── Custom flow ─────────────────────────────────────────────────────────────

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
      .map(f => createTemplateField({ collectionId: collection.id, field_name: f.field_name, field_type: f.field_type, is_required: f.is_required }).field)
      .filter(Boolean);

    // Custom collections start with no card definitions — added manually later
    onSubmit({ collection, templateFields: fields, cardDefinitions: [] });
  };

  // ── API flow ────────────────────────────────────────────────────────────────

  const handleApiConfirm = () => {
    if (!selectedSource) return;

    const { collection, errors: cErrors } = createCollection({
      name: selectedSource.name,
      is_custom: false,
      import_source: selectedSource.id,
    });
    if (!collection) { console.error('Collection creation failed:', cErrors); return; }

    const fields = selectedSource.templateFields
      .map(f => createTemplateField({ collectionId: collection.id, field_name: f.field_name, field_type: f.field_type, is_required: f.is_required }).field)
      .filter(Boolean);

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

  // ── Step: Choose ────────────────────────────────────────────────────────────

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

  // ── Step: API select ────────────────────────────────────────────────────────

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

  // ── Step: API confirm ───────────────────────────────────────────────────────

  if (step === 'api-confirm') {
    return (
      <Modal title={`Import "${selectedSource.name}"`} onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          This will create the collection with the following template fields:
        </p>
        <ReviewFieldList fields={selectedSource.templateFields} />
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

  // ── Step: Custom name ───────────────────────────────────────────────────────

  if (step === 'custom-name') {
    return (
      <Modal title="Name Your Collection" onClose={onClose}>
        <Input id="col-name" label="Collection Name *" placeholder="e.g. Winx Club Cards"
          value={collectionName} onChange={e => setCollectionName(e.target.value)}
          error={nameError} autoFocus />
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('choose')}>← Back</Button>
          <Button variant="primary" onClick={handleCustomNameNext}>Next →</Button>
        </ModalActions>
      </Modal>
    );
  }

  // ── Step: Custom template ───────────────────────────────────────────────────

  if (step === 'custom-template') {
    return (
      <Modal title="Build Your Template" onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Define the fields every card in <strong>{collectionName}</strong> will have.
          Fields cannot be deleted later, only added.
        </p>
        <div className="template-fields-list">
          {templateFields.map(field => (
            <TemplateFieldRow
              key={field.id}
              field={field}
              error={fieldErrors[field.id]}
              onChange={updateField}
              onRemove={removeField}
              removable={templateFields.length > 1}
            />
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

  // ── Step: Custom review ─────────────────────────────────────────────────────

  if (step === 'custom-review') {
    return (
      <Modal title="Review & Create" onClose={onClose}>
        <div className="review-section">
          <div className="review-label">Collection Name</div>
          <div className="review-value">{collectionName}</div>
        </div>
        <div className="review-section">
          <div className="review-label">Template Fields ({templateFields.length})</div>
          <ReviewFieldList fields={templateFields} />
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

// ─── EditCollectionModal ──────────────────────────────────────────────────────

export function EditCollectionModal({ collection, onSubmit, onClose }) {
  const [name, setName] = useState(collection.name);
  const [nameError, setNameError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) { setNameError('Collection name is required'); return; }
    onSubmit({ ...collection, name: name.trim(), updatedAt: Date.now() });
  };

  return (
    <Modal title="Edit Collection" onClose={onClose}>
      <Input id="edit-col-name" label="Collection Name *"
        value={name} onChange={e => setName(e.target.value)} error={nameError} autoFocus />
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