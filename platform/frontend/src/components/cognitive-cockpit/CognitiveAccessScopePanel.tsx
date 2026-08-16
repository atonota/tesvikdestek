/**
 * The context rail's access-scope panel: RBAC, audit and financial truth.
 *
 * Only the tenant and role are real facts this client has. Everything else
 * this panel would need to answer honestly - a fine-grained permission grant,
 * an audit-log entry, a financial-exposure figure - has no reader on this
 * client, so each renders an em dash with the reason next to it rather than a
 * guess.
 */

import { useContent } from "@/content";

export interface CognitiveAccessScopePanelProps {
  readonly tenantLabel: string;
  readonly roleLabel: string;
  readonly isDemo: boolean;
}

export function CognitiveAccessScopePanel({
  tenantLabel,
  roleLabel,
  isDemo,
}: CognitiveAccessScopePanelProps) {
  const title = useContent("cockpit.access.title");
  const tenantFieldLabel = useContent("cockpit.access.tenant_label");
  const roleFieldLabel = useContent("cockpit.access.role_label");
  const demoSuffix = useContent("cockpit.access.role_demo_suffix");
  const approvalLabel = useContent("cockpit.access.approval_label");
  const approvalReason = useContent("cockpit.access.approval_reason");
  const auditLabel = useContent("cockpit.access.audit_label");
  const auditReason = useContent("cockpit.access.audit_reason");
  const financialLabel = useContent("cockpit.access.financial_label");
  const financialReason = useContent("cockpit.access.financial_reason");
  const note = useContent("cockpit.access.note");
  const dash = useContent("cockpit.access.value_dash");

  return (
    <section className="cognitive-access-scope" aria-label={title}>
      <h2>{title}</h2>
      <dl className="cognitive-access-scope__list">
        <div>
          <dt>{tenantFieldLabel}</dt>
          <dd>{tenantLabel}</dd>
        </div>
        <div>
          <dt>{roleFieldLabel}</dt>
          <dd>
            {roleLabel}
            {isDemo ? demoSuffix : ""}
          </dd>
        </div>
        <div>
          <dt>{approvalLabel}</dt>
          <dd>
            {dash} <span className="cognitive-access-scope__reason">{approvalReason}</span>
          </dd>
        </div>
        <div>
          <dt>{auditLabel}</dt>
          <dd>
            {dash} <span className="cognitive-access-scope__reason">{auditReason}</span>
          </dd>
        </div>
        <div>
          <dt>{financialLabel}</dt>
          <dd>
            {dash} <span className="cognitive-access-scope__reason">{financialReason}</span>
          </dd>
        </div>
      </dl>
      <p className="cognitive-access-scope__note">{note}</p>
    </section>
  );
}
