/**
 * The cognitive auth card — clean-room `/giris` and `/kayit` master surface.
 *
 * Presentational only: `LoginRoute` and `RegisterRoute` own every mutation,
 * the safe-return contract and the typed demo-credential match; this package
 * renders what it is handed and decides nothing about sessions. The header is
 * `CognitiveAuthSpotlight` — the actual `CognitiveSpotlightHeader` master
 * component in its public variant — and the body is one
 * `CognitiveAccessWorkbench` organism: a product-orientation rail beside a
 * single access console, never the old centered card.
 */

import { useContent } from "@/content";
import type { DemoProfile, DemoRole } from "@/demo";

import { CognitiveAccessWorkbench } from "./CognitiveAccessWorkbench";
import { CognitiveAuthSpotlight } from "./CognitiveAuthSpotlight";

import "./cognitive-auth.css";

export interface CognitiveAuthCardProps {
  readonly mode: "login" | "register";
  readonly onSubmit: (values: { eposta: string; parola: string; organizasyon: string }) => void;
  readonly submitting?: boolean;
  readonly error?: string | null;
  readonly demoProfiles?: readonly DemoProfile[];
  readonly onDemoStart?: (role: DemoRole) => void;
  readonly demoStarting?: DemoRole | null;
  readonly staticDemoOnly?: boolean;
}

export function CognitiveAuthCard({
  mode,
  onSubmit,
  submitting = false,
  error = null,
  demoProfiles = [],
  onDemoStart,
  demoStarting = null,
  staticDemoOnly = false,
}: CognitiveAuthCardProps) {
  const skipLabel = useContent("auth.a11y.skip_link");
  const title = useContent(mode === "register" ? "auth.register.title" : "auth.login.title");
  const description = useContent(
    mode === "register" ? "auth.register.description" : "auth.login.description",
  );
  return (
    <div className="cognitive-auth" data-cognitive-auth data-mode={mode}>
      <a className="cognitive-auth__skip-link" href="#ana-icerik">
        {skipLabel}
      </a>
      <CognitiveAuthSpotlight />
      <main id="ana-icerik" className="cognitive-auth__canvas" tabIndex={-1}>
        <div className="cognitive-auth__panel">
          <CognitiveAccessWorkbench
            mode={mode}
            title={title}
            description={description}
            onSubmit={onSubmit}
            submitting={submitting}
            error={error}
            demoProfiles={demoProfiles}
            onDemoStart={onDemoStart}
            demoStarting={demoStarting}
            staticDemoOnly={staticDemoOnly}
          />
        </div>
      </main>
    </div>
  );
}
