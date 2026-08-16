/**
 * The header's top context strip — organisation/workspace, role, and a
 * source-health signal — sitting above the identity layer that carries the
 * brand, the Spotlight and the drawer triggers.
 *
 * Every cell is a `ShellIdentityCell`: a label that is *already* the honest
 * string to show, plus a tone. This component never decides what "unknown"
 * means for a given cell - it only paints whatever tone and label its caller
 * already resolved - because the honest fallback for "no organisation
 * concept exists" and the honest fallback for "no source-health signal was
 * plumbed to this route" are different facts that only the caller can state
 * correctly.
 *
 * `AdaptiveShell` is the one caller today, and it resolves all three itself:
 * role from the real (if present) demo session, organisation from
 * `domain/capabilities.ts`'s own `team` entry (this backend seats one
 * tenant), and source-health to an explicit "not measured here" unless a
 * route hands it real evidence data through `AdaptiveShellProps.sourceHealth`
 * - which no route does yet, because no route-level evidence feed is wired
 * to the shell. That absence is rendered, not hidden: this strip always
 * mounts, with three real, honest cells, never omitted for lack of data.
 */

import { useId } from "react";

export type ShellIdentityTone = "ok" | "warning" | "bad" | "neutral";

export interface ShellIdentityCell {
  readonly label: string;
  readonly tone: ShellIdentityTone;
  /**
   * The full technical reason `label` stands in for, when `label` has been
   * shortened for the header's own width. Never discarded: it lands on the
   * cell's `title` (a pointer hover) and in an `sr-only` node the cell's
   * `aria-describedby` points at (a screen reader), so the honest sentence
   * `requireCapabilityReason` produced is always one interaction away from
   * whichever short label is on screen. Omitted when `label` already is the
   * whole story - the fixture cells below, for one.
   */
  readonly description?: string;
}

export interface ShellIdentityStripProps {
  readonly organisation: ShellIdentityCell;
  readonly role: ShellIdentityCell;
  readonly sourceHealth: ShellIdentityCell;
}

function IdentityCellSpan({
  cell,
  className,
  descriptionId,
}: {
  readonly cell: ShellIdentityCell;
  readonly className: string;
  readonly descriptionId: string;
}) {
  const hasDescription = cell.description !== undefined && cell.description !== cell.label;
  return (
    <>
      <span
        className={className}
        data-tone={cell.tone}
        title={hasDescription ? cell.description : undefined}
        aria-describedby={hasDescription ? descriptionId : undefined}
      >
        {cell.label}
      </span>
      {hasDescription ? (
        <span id={descriptionId} className="sr-only">
          {cell.description}
        </span>
      ) : null}
    </>
  );
}

export function ShellIdentityStrip({ organisation, role, sourceHealth }: ShellIdentityStripProps) {
  const idPrefix = useId();
  return (
    <div className="dt-shell__identity-strip" data-header-strip="identity-context">
      <div className="dt-shell__identity-primary">
        <IdentityCellSpan
          cell={organisation}
          className="dt-shell__identity-cell"
          descriptionId={`${idPrefix}-org`}
        />
        <span className="dt-shell__identity-sep" aria-hidden="true" />
        <IdentityCellSpan cell={role} className="dt-shell__identity-cell" descriptionId={`${idPrefix}-role`} />
      </div>
      <span className="dt-shell__identity-spacer" />
      <span className="dt-shell__identity-health" data-tone={sourceHealth.tone}>
        <span className="dt-shell__identity-health-dot" aria-hidden="true" />
        <IdentityCellSpan
          cell={sourceHealth}
          className="dt-shell__identity-health-label"
          descriptionId={`${idPrefix}-health`}
        />
      </span>
    </div>
  );
}
