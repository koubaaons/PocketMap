/**
 * @fileoverview Collection modals.
 * Responsibility: create and edit collections only.
 *
 * CreateCollectionModal is custom-collection-only: Name → Build
 * Template → Review → Create.
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
 *
 * === ISSUE #130 (redesign) ===
 * Pokémon TCG used to have its own search → preview → import steps
 * inline in this file. That flow moved to a dedicated full page
 * (PokemonSetsBrowser.jsx, opened from CollectionsView, not this
 * modal) plus a reusable PokemonImportModal.jsx for the preview/
 * confirm/progress part.
 *
 * === Removed the "choose a source" step and the Yu-Gi-Oh/Winx mock
 * API flow entirely, requested directly ===
 * That step offered a choice between custom creation and importing
 * from a source — but the only real, working import path (Pokémon)
 * already has its own dedicated entry point (the franchise tiles in
 * CollectionsView, opening PokemonSetsBrowser directly), and the
 * "API" options this modal itself offered were non-functional mock
 * placeholders (#131/#132, never implemented). Keeping a choice
 * screen whose only two options were "the real thing, but you should
 * actually use the other button for that" and "a fake demo" served no
 * one — this modal now goes straight to custom creation, which is
 * genuinely all it does.
 */

import { useState } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createCollection, createTemplateField } from '../../types/index.js';
import { TemplateBuilder } from '../collections/TemplateBuilder.jsx';
import { TemplatePreview } from '../collections/TemplatePreview.jsx';

// === REFACTOR3a START: use useTemplateEditor hook ===
import { useTemplateEditor } from '../../hooks/useTemplateEditor.js';
// === REFACTOR3a END ===

// ─── CreateCollectionModal ────────────────────────────────────────────────────

export function CreateCollectionModal({ onSubmit, onClose }) {
  const [step, setStep] = useState('custom-name');
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
  } = useTemplateEditor(() => [
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

  // ── Step: Custom name ───────────────────────────────────────────────────────

  if (step === 'custom-name') {
    return (
      <Modal title="Name Your Collection" onClose={onClose}>
        <Input id="col-name" label="Collection Name *" placeholder="e.g. Winx Club Cards"
          value={collectionName} onChange={e => setCollectionName(e.target.value)}
          error={nameError} autoFocus />
        <ModalActions>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
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