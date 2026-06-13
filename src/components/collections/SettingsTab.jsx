/**
 * @fileoverview SettingsTab — collection settings with template field management.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract SettingsTab component ===

import { TemplateManagementView } from '../views/TemplateManagementView.jsx';

export function SettingsTab({ collection, templateFields, toast }) {
  return (
    <div className="tab-content">
      <TemplateManagementView
        collection={collection}
        templateFields={templateFields}
        toast={toast}
      />
    </div>
  );
}

// === REFACTOR7e END ===