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

// === ISSUE #10 START: Template Builder UI — import shared builder and preview ===
import { TemplateBuilder } from '../collections/TemplateBuilder.jsx';
import { TemplatePreview } from '../collections/TemplatePreview.jsx';
// === ISSUE #10 END: Template Builder UI ===

// ─── Mock API sources ─────────────────────────────────────────────────────────
// Replace with real API calls in Milestone 10.

const MOCK_API_SOURCES = [
  {
    id: 'winx-api',
    name: 'Winx Club Cards',
    category: 'Anime',
    cardCount: 406,
    templateFields: [
      { field_name: 'Character',      field_type: 'text',   is_required: true  },
      { field_name: 'Season',         field_type: 'text',   is_required: false },
      { field_name: 'Transformation', field_type: 'text',   is_required: false },
      { field_name: 'Rarity',         field_type: 'select', is_required: true  },
      { field_name: 'Card Number',    field_type: 'text',   is_required: true  },
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

// ─── CreateCollectionModal ────────────────────────────────────────────────────

export function CreateCollectionModal({ onSubmit, onClose }) {
  const [step, setStep] = useState('choose');
  const [selectedSource, setSelectedSource] = useState(null);
  const [collectionName, setCollectionName] = useState('');
  const [nameError, setNameError] = useState('');

  // === ISSUE #10 START: Template Builder UI — fields now have order ===
  const [templateFields, setTemplateFields] = useState([
    { id: Date.now(), field_name: '', field_type: 'text', is_required: false, order: 0 },
  ]);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleAddField = () => {
    const nextOrder = templateFields.length;
    setTemplateFields(f => [
      ...f,
      { id: Date.now(), field_name: '', field_type: 'text', is_required: false, order: nextOrder },
    ]);
  };

  const handleChangeField = (id, key, val) => {
    setTemplateFields(f => f.map(field => field.id === id ? { ...field, [key]: val } : field));
  };

  const handleReorderField = (id, direction) => {
    const sorted = [...templateFields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(f => f.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const orderA = sorted[idx].order;
    const orderB = sorted[swapIdx].order;
    setTemplateFields(f => f.map(field => {
      if (field.id === sorted[idx].id) return { ...field, order: orderB };
      if (field.id === sorted[swapIdx].id) return { ...field, order: orderA };
      return field;
    }));
  };
  // === ISSUE #10 END: Template Builder UI ===

  // ── Custom flow ─────────────────────────────────────────────────────────────

  const handleCustomNameNext = () => {
    if (!collectionName.trim()) { setNameError('Collection name is required'); return; }
    setNameError('');
    setStep('custom-template');
  };



  const handleCustomConfirm = () => {
    const { collection, errors: cErrors } = createCollection({
      name: collectionName,
      is_custom: true,
      import_source: null,
    });
    if (!collection) { console.error('Collection creation failed:', cErrors); return; }


    const fields = templateFields
      .sort((a, b) => a.order - b.order)
      .map((f, idx) => createTemplateField({
        collectionId: collection.id,
        field_name: f.field_name,
        field_type: f.field_type,
        is_required: f.is_required,
        order: idx,
      }).field)
      .filter(Boolean);


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
      .map((f, idx) => createTemplateField({
        collectionId: collection.id,
        field_name: f.field_name,
        field_type: f.field_type,
        is_required: f.is_required,
        order: idx,
      }).field)
      .filter(Boolean);


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
    // === ISSUE #10 START: Template Builder UI — use TemplateBuilder component ===
    return (
      <Modal title="Build Your Template" onClose={onClose}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Define the fields every card in <strong>{collectionName}</strong> will have.
          Fields cannot be deleted later, only added.
        </p>
        <TemplateBuilder
          fields={templateFields}
          errors={fieldErrors}
          onChange={handleChangeField}
          onAdd={handleAddField}
          onReorder={handleReorderField}
        />
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('custom-name')}>← Back</Button>
          <Button variant="primary" onClick={handleCustomTemplateNext}>Next →</Button>
        </ModalActions>
      </Modal>
    );
    // === ISSUE #10 END: Template Builder UI ===
  }

  // ── Step: Custom review ─────────────────────────────────────────────────────

  if (step === 'custom-review') {

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