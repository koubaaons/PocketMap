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
 *
 * === ISSUE #89: Modal and Form Polish ===
 * Replaced every inline style={{ fontSize, color, marginTop/marginBottom }}
 * with proper CSS classes (.modal-step-intro, .modal-step-note) using the
 * same spacing/color tokens the rest of the app already uses — this file
 * was the one inconsistency found during the #89 audit; every other modal
 * already used classes exclusively.
 */

import { useState } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createCollection, createTemplateField } from '../../types/index.js';
import { TemplateBuilder } from '../collections/TemplateBuilder.jsx';
import { TemplatePreview } from '../collections/TemplatePreview.jsx';

// === REFACTOR3a START: use useTemplateEditor hook ===
import { useTemplateEditor } from '../../hooks/useTemplateEditor.js';
// === REFACTOR3a END ===

// === REFACTOR3b START: import API sources from services layer ===
import { getApiSources } from '../../services/apiSources.js';
// === REFACTOR3b END ===

// ─── CreateCollectionModal ────────────────────────────────────────────────────

export function CreateCollectionModal({ onSubmit, onClose }) {
  const [step, setStep] = useState('choose');
  const [selectedSource, setSelectedSource] = useState(null);
  const [collectionName, setCollectionName] = useState('');
  const [nameError, setNameError] = useState('');

  // === REFACTOR3a START: replace duplicated field logic with hook ===
  const {
    fields: templateFields,
    errors: fieldErrors,
    handleAdd: handleAddField,
    handleChange: handleChangeField,
    handleReorder: handleReorderField,
    handleRemove,
    validate: validateFields,
    clearErrors,
  } = useTemplateEditor([
    { id: `new-${Date.now()}`, field_name: '', field_type: 'text', is_required: false, order: 0, options: [], _isNew: true },
  ]);
  // === REFACTOR3a END ===

  // ── Custom flow ─────────────────────────────────────────────────────────────

  const handleCustomNameNext = () => {
    if (!collectionName.trim()) { setNameError('Collection name is required'); return; }
    setNameError('');
    setStep('custom-template');
  };

  const handleCustomTemplateNext = () => {
    if (!validateFields()) return;
    if (templateFields.length === 0) return;
    clearErrors();
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
      .map((f, idx) => createTemplateField({
        collectionId: collection.id,
        field_name: f.field_name,
        field_type: f.field_type,
        is_required: f.is_required,
        order: idx,
        options: f.options ?? [],
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
        options: f.options ?? [],
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
        <p className="modal-step-intro">
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
    const apiSources = getApiSources();
    return (
      <Modal title="Import Collection from API" onClose={onClose}>
        <p className="modal-step-intro">
          Choose a collection to import and confirm the template.
        </p>
        <div className="api-sources-grid">
          {apiSources.map(source => (
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
    const previewFields = selectedSource.templateFields.map((f, idx) => ({
      id: String(idx),
      collectionId: '',
      ...f,
      order: idx,
    }));
    return (
      <Modal title={`Import "${selectedSource.name}"`} onClose={onClose}>
        <p className="modal-step-intro">
          This will create the collection with the following field schema:
        </p>
        <TemplatePreview fields={previewFields} showValidation={false} />
        <p className="modal-step-note">
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
        <p className="modal-step-intro">
          Define the fields every card in <strong>{collectionName}</strong> will have.
          Fields cannot be deleted later, only added.
        </p>
        <TemplateBuilder
          fields={templateFields}
          errors={fieldErrors}
          onChange={handleChangeField}
          onAdd={handleAddField}
          onReorder={handleReorderField}
          onRemove={handleRemove}
        />
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
          <div className="review-label">Field Schema</div>
          <TemplatePreview fields={templateFields} showValidation={true} />
        </div>
        <p className="modal-step-note">
          No cards yet — you'll add them after creating the collection.
        </p>
        <ModalActions>
          <Button variant="ghost" onClick={() => setStep('custom-template')}>← Back</Button>
          <Button variant="primary" onClick={handleCustomConfirm} disabled={templateFields.length === 0}>
            Create Collection
          </Button>
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
        <p className="modal-step-note modal-step-note-tight">
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