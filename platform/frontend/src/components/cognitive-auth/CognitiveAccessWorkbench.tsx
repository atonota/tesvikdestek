/**
 * The Access Workbench — one adaptive organism for `/giris` and `/kayit`.
 *
 * Replaces the old "long notice, two demo cards, divider, separate form"
 * stack with a single full-canvas layout: a decorative product-orientation
 * rail and one focused access console. There is no centered card and no
 * empty desktop half — the rail fills the space a card would have left bare,
 * and at 320px it drops out entirely so the console is the whole screen.
 *
 * The console's default login mode shows a compact role switch, one
 * selected-profile preview and one primary demo action — never both demo
 * profiles' credentials at once. A profile's credentials are available, but
 * only behind an explicit disclosure (`<details>` — an accessible, native
 * collapsible; no portal, no second focus trap) and only for the profile
 * currently selected. The permanent one-click demo behaviour is unchanged:
 * this organism only decides what is visible, `LoginRoute` still owns what
 * happens when the button is pressed.
 *
 * The manual/"real" credential form is the same `AppForm`/`TextField` layer
 * this product uses everywhere else, revealed in place by a secondary
 * control rather than replacing the console. Register mode has no demo to
 * default to, so its console renders that same form directly, with no
 * toggle to press first.
 */

import { useId, useState } from "react";

import { Badge, Link } from "@/foundation";
import { AppForm, TextField } from "@/components/forms";
import { useContent } from "@/content";
import type { DemoProfile, DemoRole } from "@/demo";

export interface CognitiveAccessWorkbenchProps {
  readonly mode: "login" | "register";
  readonly title: string;
  readonly description: string;
  readonly onSubmit: (values: { eposta: string; parola: string; organizasyon: string }) => void;
  readonly submitting?: boolean;
  readonly error?: string | null;
  readonly demoProfiles?: readonly DemoProfile[];
  readonly onDemoStart?: ((role: DemoRole) => void) | undefined;
  readonly demoStarting?: DemoRole | null;
  readonly staticDemoOnly?: boolean;
}

function StaticNotice() {
  const notice = useContent("auth.static.notice");
  return (
    <p className="cognitive-auth__notice" role="note" data-testid="statik-yayin-uyarisi">
      {notice}
    </p>
  );
}

function RoleSwitch({
  profiles,
  selectedId,
  onSelect,
  disabled,
}: {
  readonly profiles: readonly DemoProfile[];
  readonly selectedId: DemoRole;
  readonly onSelect: (id: DemoRole) => void;
  readonly disabled: boolean;
}) {
  const label = useContent("auth.workbench.role_switch.label");
  return (
    <div className="cognitive-auth__role-switch" role="group" aria-label={label}>
      {profiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          className="cognitive-auth__role-option"
          aria-pressed={profile.id === selectedId}
          data-selected={profile.id === selectedId}
          onClick={() => onSelect(profile.id)}
          disabled={disabled}
        >
          {profile.roleLabel}
        </button>
      ))}
    </div>
  );
}

function ProfilePreview({
  profile,
  onStart,
  starting,
}: {
  readonly profile: DemoProfile;
  readonly onStart: (role: DemoRole) => void;
  readonly starting: DemoRole | null;
}) {
  const rolePrefix = useContent("auth.demo.role_prefix");
  const emailLabel = useContent("auth.demo.email_label");
  const passwordLabel = useContent("auth.demo.password_label");
  const credentialNote = useContent("auth.demo.credential_note");
  const loadingLabel = useContent("auth.demo.loading_label");
  const revealSummary = useContent("auth.workbench.reveal.summary");
  const busy = starting === profile.id;
  // Disabled for the busy profile too, not only the others: a second click on
  // the action already mid-flight would fire a second mutation racing the
  // first, and the button being merely `aria-busy` never stopped that click.
  const disabled = starting !== null;

  return (
    <div className="cognitive-auth__profile-preview">
      <h3 className="cognitive-auth__profile-title">{profile.title}</h3>
      <p className="cognitive-auth__demo-role">
        {rolePrefix} <strong>{profile.roleLabel}</strong>
      </p>
      <p className="cognitive-auth__demo-summary">{profile.summary}</p>
      <ul className="cognitive-auth__demo-emphasis">
        {profile.emphasis.map((item) => (
          <li key={item}>
            <Badge tone="neutral">{item}</Badge>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="cognitive-auth__demo-action"
        onClick={() => onStart(profile.id)}
        disabled={disabled}
        aria-busy={busy ? "true" : undefined}
      >
        {busy ? loadingLabel : profile.actionLabel}
      </button>

      <details className="cognitive-auth__reveal">
        <summary>{revealSummary}</summary>
        <dl className="cognitive-auth__demo-credentials">
          <div className="cognitive-auth__demo-credential">
            <dt>{emailLabel}</dt>
            <dd>{profile.email}</dd>
          </div>
          <div className="cognitive-auth__demo-credential">
            <dt>{passwordLabel}</dt>
            <dd>{profile.password}</dd>
          </div>
        </dl>
        <p className="cognitive-auth__demo-credential-note" data-testid="demo-kimlik-notu">
          {credentialNote}
        </p>
      </details>
    </div>
  );
}

function DemoConsole({
  profiles,
  onStart,
  starting,
}: {
  readonly profiles: readonly DemoProfile[];
  readonly onStart: (role: DemoRole) => void;
  readonly starting: DemoRole | null;
}) {
  const [selectedId, setSelectedId] = useState<DemoRole>(profiles[0]?.id ?? "superadmin");
  const heading = useContent("auth.demo.title");
  const noticeShort = useContent("auth.demo.notice_short");
  const noticeSummary = useContent("auth.demo.notice_summary");
  const notice = useContent("auth.demo.notice");
  const headingId = useId();
  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  if (!selected) return null;

  return (
    <section className="cognitive-auth__demo" aria-labelledby={headingId}>
      <h2 id={headingId} className="cognitive-auth__demo-title">
        {heading}
      </h2>
      <p className="cognitive-auth__notice-short">{noticeShort}</p>
      <details className="cognitive-auth__notice-full">
        <summary>{noticeSummary}</summary>
        <p className="cognitive-auth__notice" data-testid="demo-giris-uyarisi">
          {notice}
        </p>
      </details>
      <RoleSwitch
        profiles={profiles}
        selectedId={selectedId}
        onSelect={setSelectedId}
        disabled={starting !== null}
      />
      <ProfilePreview key={selected.id} profile={selected} onStart={onStart} starting={starting} />
    </section>
  );
}

function CredentialForm({
  mode,
  onSubmit,
  submitting,
}: Pick<CognitiveAccessWorkbenchProps, "mode" | "onSubmit"> & {
  readonly submitting: boolean;
}) {
  const emailLabel = useContent("auth.credential.email_label");
  const passwordLabel = useContent("auth.credential.password_label");
  const passwordHint = useContent("auth.credential.password_hint");
  const orgLabel = useContent("auth.credential.org_label");
  const submitLabel = useContent(
    mode === "register" ? "auth.credential.submit_register" : "auth.credential.submit_login",
  );

  return (
    <AppForm<{ eposta: string; parola: string; organizasyon: string }>
      label={submitLabel}
      className="cognitive-auth__form"
      defaultValues={{ eposta: "", parola: "", organizasyon: "" }}
      submitLabel={submitLabel}
      busy={submitting}
      submitFullWidth
      onValid={(values) => onSubmit(values)}
    >
      <TextField name="eposta" label={emailLabel} type="email" autoComplete="email" required />
      <TextField
        name="parola"
        label={passwordLabel}
        type="password"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        required
        {...(mode === "register" ? { hint: passwordHint } : {})}
      />
      {mode === "register" ? <TextField name="organizasyon" label={orgLabel} /> : null}
    </AppForm>
  );
}

function RealAccountControl({
  mode,
  onSubmit,
  submitting,
  collapsible,
}: Pick<CognitiveAccessWorkbenchProps, "mode" | "onSubmit"> & {
  readonly submitting: boolean;
  readonly collapsible: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const openLabel = useContent("auth.workbench.real.toggle_open");
  const closeLabel = useContent("auth.workbench.real.toggle_close");

  return (
    <div className="cognitive-auth__real-account">
      {collapsible ? (
        <button
          type="button"
          className="cognitive-auth__real-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? closeLabel : openLabel}
        </button>
      ) : null}
      {open ? <CredentialForm mode={mode} onSubmit={onSubmit} submitting={submitting} /> : null}
    </div>
  );
}

function CardFooter({ mode }: { readonly mode: "login" | "register" }) {
  const label = useContent(mode === "register" ? "auth.register.footer" : "auth.login.footer");
  const to = mode === "register" ? "/giris" : "/kayit";
  return (
    <div className="cognitive-auth__footer">
      <Link to={to}>{label}</Link>
    </div>
  );
}

export function CognitiveAccessWorkbench({
  mode,
  title,
  description,
  onSubmit,
  submitting = false,
  error = null,
  demoProfiles = [],
  onDemoStart,
  demoStarting = null,
  staticDemoOnly = false,
}: CognitiveAccessWorkbenchProps) {
  const railEyebrow = useContent("auth.workbench.rail.eyebrow");
  const railTitle = useContent("auth.workbench.rail.title");
  const railBody = useContent("auth.workbench.rail.body");
  const titleId = useId();
  const showDemo = mode === "login" && demoProfiles.length > 0 && onDemoStart !== undefined;

  return (
    <div className="cognitive-auth__workbench" data-mode={mode}>
      <aside className="cognitive-auth__rail" aria-hidden="true">
        <span className="cognitive-auth__rail-eyebrow">{railEyebrow}</span>
        <p className="cognitive-auth__rail-title">{railTitle}</p>
        <p className="cognitive-auth__rail-body">{railBody}</p>
      </aside>

      <section className="cognitive-auth__console" aria-labelledby={titleId}>
        <h1 id={titleId} className="cognitive-auth__title">
          {title}
        </h1>
        <p className="cognitive-auth__lede">{description}</p>
        {staticDemoOnly ? <StaticNotice /> : null}
        {error ? (
          <p className="cognitive-auth__field-error" role="alert">
            {error}
          </p>
        ) : null}

        {showDemo && onDemoStart ? (
          <DemoConsole profiles={demoProfiles} onStart={onDemoStart} starting={demoStarting} />
        ) : null}

        <RealAccountControl mode={mode} onSubmit={onSubmit} submitting={submitting} collapsible={showDemo} />

        <CardFooter mode={mode} />
      </section>
    </div>
  );
}
