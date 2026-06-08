/**
 * @fileoverview PlaceholderTab — reusable placeholder for unimplemented tabs.
 *
 * Used in CollectionDetailView for tabs coming in Milestone 6.
 * When a tab is implemented, replace <PlaceholderTab> with the real component.
 * One line change per tab.
 */

// === REFACTOR4c START: Extract PlaceholderTab component ===

import { EmptyState } from './index.jsx';

/**
 * @param {{
 *   icon: string,
 *   title: string,
 *   milestone: string,
 * }} props
 */
export function PlaceholderTab({ icon, title, milestone }) {
  return (
    <div className="tab-content tab-placeholder">
      <EmptyState
        icon={icon}
        title={title}
        subtitle={`Coming in ${milestone}`}
      />
    </div>
  );
}

// === REFACTOR4c END: Extract PlaceholderTab component ===