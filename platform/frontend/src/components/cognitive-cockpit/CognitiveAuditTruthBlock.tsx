/**
 * The cockpit's audit truth block: what this screen can and cannot prove.
 *
 * There is no audit-log endpoint behind this product today. Saying so, once,
 * in the section a reader would otherwise expect an audit trail, is the
 * honest reading; a blank space where a list is expected reads as "nothing
 * happened" rather than as "this client cannot show you that yet".
 */

import { useContent } from "@/content";

export function CognitiveAuditTruthBlock() {
  const title = useContent("cockpit.audit.title");
  const status = useContent("cockpit.audit.status");
  const description = useContent("cockpit.audit.description");

  return (
    <section className="cognitive-audit-truth" aria-label={title}>
      <div className="cognitive-audit-truth__header">
        <h2>{title}</h2>
        <span className="cognitive-audit-truth__status">{status}</span>
      </div>
      <p>{description}</p>
    </section>
  );
}
