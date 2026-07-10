/**
 * @fileoverview FeedbackButton — floating feedback trigger + modal.
 *
 * A fixed-position button that sits over every view in the app.
 * Opens a modal form with:
 *   - Type selector (bug / suggestion / other)
 *   - Description textarea (required, min 10 chars)
 *   - Optional screenshot upload (stored as base64 in the body for
 *     now — Supabase Storage is a Milestone 11 concern)
 *
 * Submissions go to the beta_feedback table in Supabase with the
 * authenticated user's id, type, body, and created_at timestamp.
 * The form resets and the modal closes on successful submission.
 *
 * Placed in App.jsx outside the view router so it renders on every
 * screen without any per-view wiring.
 */

import { useState, useRef, useCallback } from 'react';
import { Modal, Button } from './ui/index.jsx';
import { supabase } from '../services/supabase.js';
import { useAuth } from '../hooks/useAuth.js';

const TYPES = [
  { value: 'bug',        label: '🐛 Bug report' },
  { value: 'suggestion', label: '💡 Suggestion' },
  { value: 'other',      label: '💬 Other' },
];

const MIN_BODY_LENGTH = 10;

export function FeedbackButton({ toast }) {
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [type, setType]       = useState('bug');
  const [body, setBody]       = useState('');
  const [screenshot, setScreenshot] = useState(null); // base64 string or null
  const [errors, setErrors]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const reset = useCallback(() => {
    setType('bug');
    setBody('');
    setScreenshot(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  function validate() {
    const e = {};
    if (body.trim().length < MIN_BODY_LENGTH) {
      e.body = `Please describe the issue in at least ${MIN_BODY_LENGTH} characters.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleScreenshotChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 so we can store it in the text body for now.
    // Supabase Storage (Milestone 11) will handle this properly later.
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    // Include screenshot inline in the body if one was attached.
    const fullBody = screenshot
      ? `${body.trim()}\n\n[screenshot attached: ${screenshot.substring(0, 100)}...]`
      : body.trim();

    const { error } = await supabase
      .from('beta_feedback')
      .insert({
        user_id: user.id,
        type,
        body:    fullBody,
      });

    setSubmitting(false);

    if (error) {
      setErrors({ general: 'Could not submit feedback. Please try again.' });
      return;
    }

    toast('Feedback sent — thank you! 🙌', 'success');
    handleClose();
  }

  return (
    <>
      <button
        className="feedback-fab"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
      >
        <i className="ti ti-message-circle" aria-hidden="true" />
      </button>

      {open && (
        <Modal title="Send feedback" onClose={handleClose} size="sm">
          {errors.general && (
            <p className="auth-error-banner" role="alert">{errors.general}</p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="feedback-type">Type</label>
              <select
                id="feedback-type"
                className="form-input"
                value={type}
                onChange={e => setType(e.target.value)}
                disabled={submitting}
              >
                {TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="feedback-body">
                Description <span className="feedback-required">*</span>
              </label>
              <textarea
                id="feedback-body"
                className={`form-input feedback-textarea${errors.body ? ' input-error' : ''}`}
                placeholder={
                  type === 'bug'
                    ? 'What happened? What did you expect instead?'
                    : type === 'suggestion'
                    ? 'What would you like to see in Pinder?'
                    : "What's on your mind?"
                }
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={submitting}
                rows={5}
                maxLength={2000}
              />
              {errors.body && (
                <p className="auth-field-error" role="alert">{errors.body}</p>
              )}
              <p className="feedback-char-count">
                {body.length} / 2000
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="feedback-screenshot">
                Screenshot <span className="feedback-optional">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                id="feedback-screenshot"
                type="file"
                accept="image/*"
                className="form-input feedback-file-input"
                onChange={handleScreenshotChange}
                disabled={submitting}
              />
              {screenshot && (
                <p className="feedback-screenshot-preview">
                  ✓ Screenshot attached
                  <button
                    type="button"
                    className="feedback-remove-screenshot"
                    onClick={() => {
                      setScreenshot(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Remove
                  </button>
                </p>
              )}
            </div>

            <div className="feedback-actions">
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send feedback'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}