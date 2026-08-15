/**
 * Level 6 - page templates (12).
 *
 * Templates are presentational: they take already-fetched data and arrange it.
 * Routes own loading, errors and mutations; templates own layout, headings and
 * the honesty notices that belong to a whole page.
 */

import { useMemo, useState, type ReactNode } from "react";

import {
  callWindowLabel,
  supportTypeLabel,
  type Decision,
  type Program,
  type ReadinessHealth,
  type Snapshot,
} from "@/api/types";
import type { DemoProfile, DemoRole } from "@/demo";
import { CAPABILITIES, GROUP_LABELS, STATUS_LABELS, type Capability, type CapabilityGroup } from "@/domain/capabilities";
import { ALL_FACTS, BOOLEAN_FACTS, INTEGER_FACTS, TEXT_FACTS, factLabel } from "@/domain/facts";
import type { MaturityReport } from "@/domain/maturity";
import { DISCLAIMER, USER_APPROVAL_LABEL } from "@/domain/outcomes";
import { TRISTATE_CHOICES } from "@/domain/tristate";
import { formatDateTime, formatNumber } from "@/lib/intl";
import {
  Card,
  DefinitionList,
  FilterBar,
  Fieldset,
  SearchInput,
  Stepper,
  Tabs,
  Timeline,
} from "./composites";
import { AppForm, SelectField, TextField, useFormValues } from "./forms";
import { DataGrid } from "./data-grid/DataGrid";
import { decisionsGridConfig, sourcesGridConfig } from "./data-grid/configs";
import type { GridConfig } from "./data-grid/types";
import {
  ApprovalRecordCard,
  BackendCapabilityGate,
  CallWindowBadge,
  DecisionCompareGrid,
  DecisionHashPair,
  MaturityRadar,
  MissingFactsPanel,
  MoneyStateLabel,
  OutcomeBadge,
  PredicateTraceTable,
  ProgramCard,
  ReasonList,
  RequiredDocumentsChecklist,
  SourceFreshnessMeter,
  SourceSnapshotCard,
} from "./domain";
import { DisclaimerBlock, EmptyState, ErrorState, PartialDataNotice, SkeletonBlock } from "./patterns";
import { Badge, Button, Link } from "./primitives";

/**
 * The tri-state choices as select options.
 *
 * "Bilinmiyor" first and with the empty wire value, exactly as
 * `domain/tristate` declares them - derived rather than retyped, so the order
 * and the values cannot drift from the vocabulary the backend parses.
 */
const TRISTATE_OPTIONS = TRISTATE_CHOICES.map((choice) => ({
  value: choice.value as string,
  label: choice.label,
}));

/* ------------------------------------------------- the source registry read */

/**
 * What this client knows about `GET /api/kaynaklar`, as a type.
 *
 * An array is a *completed* read, and `[]` is a real answer: the registry was
 * read and it is empty. `null` is not an answer at all - nobody managed to read
 * it - and the whole point of the distinction is that these two must never
 * render the same. `?? []` erased it at five call sites, and every one of them
 * turned a failed request into a confident claim: zero source captures on the
 * landing page, "bu programın kaynak kayıtları kütükte yok" on a programme
 * whose own record cites one, and a decision whose evidence "does not match"
 * a registry nobody read.
 *
 * Backwards compatible on purpose: every existing caller passing an array keeps
 * meaning exactly what it meant, so the tests and stories that assert the
 * genuinely-empty state still assert it.
 */
export type SourceRegistryRead = readonly Snapshot[] | null;

/** How to describe and recover a registry read that has not produced rows. */
export interface SourceReadState {
  /** Still in flight. Not a failure, and not an absence either. */
  readonly pending?: boolean;
  /** Already-translated technical text, collapsed behind a summary. */
  readonly detail?: string | undefined;
  /** Runs the read again. Omitted only where the caller genuinely cannot. */
  readonly onRetry?: (() => void) | undefined;
}

/** The parts of the registry query the templates' contract is derived from. */
export interface SourceRegistryQuery {
  readonly isSuccess: boolean;
  readonly isPending: boolean;
  readonly data: readonly Snapshot[] | undefined;
  readonly refetch: () => unknown;
}

/**
 * The registry query, turned into the two props the templates take.
 *
 * Declared once, beside the type it produces, because the alternative is the
 * `?? []` that caused all of this: five call sites each deciding for themselves
 * what a failed read means. Rows exist only when the read succeeded - a pending
 * or failed query yields `null` - and the state carries the retry, so no caller
 * can pass the data without also passing the way to recover it.
 */
export function readSourceRegistry(
  query: SourceRegistryQuery,
  detail?: string,
): { readonly rows: SourceRegistryRead; readonly state: SourceReadState } {
  return {
    rows: query.isSuccess && query.data !== undefined ? query.data : null,
    state: { pending: query.isPending, detail, onRetry: () => void query.refetch() },
  };
}

/**
 * The one surface every unread registry gets.
 *
 * It says three things and refuses to say a fourth. It names what cannot be
 * shown, it says the reason is a failed read rather than an empty registry, and
 * it offers the retry - which is the only action that can change the answer.
 * What it never does is produce a number, a "bulunamadı", or an "unknown"
 * verdict about a record it never saw.
 */
export function UnreadSourceRegistry({
  what,
  state,
}: {
  readonly what: string;
  readonly state?: SourceReadState;
}) {
  if (state?.pending === true) {
    return <SkeletonBlock lines={2} label="Kaynak kütüğü yükleniyor" />;
  }
  return (
    <ErrorState
      title="Kaynak kütüğü okunamadı"
      message={`${what} Okunamayan bir kütük boş bir kütük değildir; burada kayıt yok demiyoruz, okuyamadık diyoruz.`}
      detail={state?.detail}
      {...(state?.onRetry ? { onRetry: state.onRetry } : {})}
    />
  );
}

/* ---------------------------------------------------------- PublicLanding */

export interface PublicLandingProps {
  programCount: number;
  /** `null` when the source registry could not be read. Never a stand-in zero. */
  snapshotCount: number | null;
  /** Same rule. A review claim derived from a failed request is not a claim. */
  verifiedSnapshotCount: number | null;
  /** Only consulted when a count is `null`. */
  sourcesRead?: SourceReadState;
}

/**
 * States: populated · zero-programs · unread-registry.
 *
 * The third state is the one this page got wrong for the longest. Two of its
 * four headline figures come from the source registry, and both were `?? 0`, so
 * a 502 on `/api/kaynaklar` published "0 kaynak yakalaması, 0 doğrulanmış
 * kaynak" - and then, underneath, an editorial claim about expert review that
 * nothing had measured. Zero is the most dangerous wrong answer available here,
 * because it is also a perfectly plausible right one.
 */
export function PublicLanding({
  programCount,
  snapshotCount,
  verifiedSnapshotCount,
  sourcesRead,
}: PublicLandingProps) {
  const sourcesUnread = snapshotCount === null || verifiedSnapshotCount === null;
  const sourceFigure = (value: number | null): string => {
    if (value !== null) return formatNumber(value);
    return sourcesRead?.pending === true ? "okunuyor" : "okunamadı";
  };

  return (
    <div className="dt-stack">
      <h1>Destek programları için deterministik ön değerlendirme</h1>
      <p className="dt-lede">
        Şirket profilinizi girin; sistem her program için resmî kaynaklara dayanan, sürümlenmiş
        kurallarla bir sonuç üretir ve o sonucun <strong>hangi koşulda</strong>,{" "}
        <strong>hangi kaynağa</strong> dayandığını satır satır gösterir.
      </p>
      <DisclaimerBlock />

      <Card title="Bugün depoda ne var" headingLevel={2}>
        <DefinitionList
          columns={2}
          items={[
            { term: "Program", description: formatNumber(programCount) },
            { term: "Kaynak yakalaması", description: sourceFigure(snapshotCount) },
            { term: "Doğrulanmış kaynak", description: sourceFigure(verifiedSnapshotCount) },
            { term: "Sonuç türü", description: "4 (onaylandı diye bir değer yoktur)" },
          ]}
        />
        {sourcesUnread ? (
          <UnreadSourceRegistry
            what="Kaynak yakalaması ve doğrulanmış kaynak sayıları gösterilemiyor."
            {...(sourcesRead ? { state: sourcesRead } : {})}
          />
        ) : verifiedSnapshotCount === 0 ? (
          <p className="dt-muted">
            Hiçbir kaynak henüz uzman doğrulamasından geçmedi. Bu, sonuçların güvenilirlik
            tavanını belirler ve gizlenmez.
          </p>
        ) : null}
      </Card>

      <Card title="Sistemin kasıtlı olarak yapmadıkları" headingLevel={2}>
        <ul className="dt-list">
          <li>Resmî kuruma başvuru göndermez.</li>
          <li>Hak edilmiş veya ödenecek tutar hesaplamaz.</li>
          <li>Bilinmeyen bir çağrı tarihini tahmin etmez; bilinmiyorsa koşullu der.</li>
          <li>Yapay zekâ karar vermez; bu sürümde arayüzde yapay zekâ yoktur.</li>
        </ul>
      </Card>

      <div className="dt-row">
        <Link to="/kayit" className="dt-btn dt-btn--primary dt-btn--md">
          Hesap oluştur
        </Link>
        <Link to="/programlar">Programları incele</Link>
        <Link to="/nasil-calisir">Nasıl çalışır?</Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- CatalogList */

export interface CatalogListProps {
  programs: readonly Program[];
  hrefFor?: (program: Program) => string;
  title?: string;
}

/** States: loaded · filtered-empty · empty. */
export function CatalogList({
  programs,
  hrefFor = (program) => `/programlar/${program.code}`,
  title = "Program kataloğu",
}: CatalogListProps) {
  const [search, setSearch] = useState("");
  const [supportType, setSupportType] = useState("");
  const [callWindow, setCallWindow] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    return programs.filter((program) => {
      if (supportType && program.support_type !== supportType) return false;
      if (callWindow && program.call_window_state !== callWindow) return false;
      if (!needle) return true;
      return (
        program.name.toLocaleLowerCase("tr").includes(needle) ||
        program.code.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [programs, search, supportType, callWindow]);

  const supportTypes = useMemo(
    () => [...new Set(programs.map((program) => program.support_type))],
    [programs],
  );
  const callWindows = useMemo(
    () => [...new Set(programs.map((program) => program.call_window_state))],
    [programs],
  );

  return (
    <div className="dt-stack">
      <h1>{title}</h1>
      <SearchInput value={search} onValueChange={setSearch} resultCount={filtered.length} />
      <FilterBar
        resultCount={filtered.length}
        filters={[
          {
            id: "support",
            label: "Destek türü",
            value: supportType,
            options: supportTypes.map((value) => ({ value, label: supportTypeLabel(value) })),
          },
          {
            id: "window",
            label: "Çağrı penceresi",
            value: callWindow,
            options: callWindows.map((value) => ({ value, label: callWindowLabel(value) })),
          },
        ]}
        onChange={(id, value) => {
          if (id === "support") setSupportType(value);
          if (id === "window") setCallWindow(value);
        }}
        onReset={() => {
          setSupportType("");
          setCallWindow("");
          setSearch("");
        }}
      />
      {filtered.length === 0 ? (
        <EmptyState
          title="Eşleşen program yok"
          reason="Arama ve filtre birlikte hiçbir kaydı bırakmadı."
        />
      ) : (
        <ul className="dt-grid">
          {filtered.map((program) => (
            <li key={program.code}>
              <ProgramCard program={program} href={hrefFor(program)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------- OpportunityDetail */

export interface OpportunityDetailProps {
  program: Program;
  /** `null` when the registry could not be read. `[]` means read and empty. */
  snapshots: SourceRegistryRead;
  sourcesRead?: SourceReadState;
}

/**
 * States: with-sources · without-sources · unread-registry.
 *
 * The third state exists because the first two were saying opposite things on
 * one screen. "Kaynak sayısı 1" comes from the programme record, which arrived;
 * "Bu programın kaynak kayıtları kütükte yok" came from a registry read that
 * did not. A reader has no way to tell which sentence to believe, and the one
 * that sounds most specific is the false one.
 */
export function OpportunityDetail({ program, snapshots, sourcesRead }: OpportunityDetailProps) {
  const related =
    snapshots?.filter((snapshot) => program.source_snapshot_ids.includes(snapshot.id)) ?? null;
  return (
    <div className="dt-stack">
      <h1>{program.name}</h1>
      <div className="dt-row">
        <CallWindowBadge state={program.call_window_state} />
        <Badge tone="neutral">{supportTypeLabel(program.support_type)}</Badge>
        <Badge tone="neutral">Sürüm {program.version}</Badge>
      </div>

      <Card title="Künye" headingLevel={2}>
        <DefinitionList
          columns={2}
          items={[
            { term: "Program kodu", description: <code className="dt-mono">{program.code}</code> },
            { term: "Resmî sayfa", description: <Link href={program.official_url} external>Kurumun sayfası</Link> },
            { term: "Yayımlanmış referans", description: <MoneyStateLabel publishedReference={program.published_reference} /> },
            { term: "Kaynak sayısı", description: formatNumber(program.source_snapshot_ids.length) },
          ]}
        />
        {program.notes ? <p>{program.notes}</p> : null}
      </Card>

      <Card title="Gerekli belgeler" headingLevel={2}>
        <RequiredDocumentsChecklist documents={program.required_documents} />
      </Card>

      <Card title="Dayandığı kaynaklar" headingLevel={2}>
        {related === null ? (
          <UnreadSourceRegistry
            what={`Bu programın dayandığı ${formatNumber(program.source_snapshot_ids.length)} kaynak gösterilemiyor.`}
            {...(sourcesRead ? { state: sourcesRead } : {})}
          />
        ) : related.length === 0 ? (
          <EmptyState title="Kaynak bulunamadı" reason="Bu programın kaynak kayıtları kütükte yok." />
        ) : (
          <ul className="dt-stack">
            {related.map((snapshot) => (
              <li key={snapshot.id}>
                <SourceSnapshotCard snapshot={snapshot} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- AuthForm */

/** Index signature so react-hook-form can treat it as a `FieldValues`. */
interface AuthFormValues extends Record<string, string> {
  eposta: string;
  parola: string;
  organizasyon: string;
}

export interface AuthFormProps {
  mode: "register" | "login";
  onSubmit: (values: { eposta: string; parola: string; organizasyon: string }) => void;
  submitting?: boolean;
  error?: string | null;
  /**
   * The one-click demo profiles, or nothing.
   *
   * Passed in rather than imported here so this template stays presentational -
   * it renders what it is handed and decides nothing about sessions. Omitting
   * the prop renders the screen exactly as it was before the demo existed,
   * which is what the registration route relies on.
   */
  demoProfiles?: readonly DemoProfile[];
  /** Called with the chosen profile's id. The route owns what happens next. */
  onDemoStart?: (role: DemoRole) => void;
  /** Which card is mid-entry, so only its own button shows the busy state. */
  demoStarting?: DemoRole | null;
}

/**
 * The demo entry block: a card per profile, stacked.
 *
 * Stacked at every width rather than a two-column grid. At 320px a grid has to
 * collapse to one column anyway, and the card carries a heading, three emphasis
 * chips, two credential rows and a full-width button - side by side, that is
 * the layout that produces the horizontal overflow this repository measures
 * for. One column is not a phone compromise here; it is the honest shape of
 * the content, and it keeps the two actions far enough apart to be distinct.
 */
function DemoProfileCards({
  profiles,
  onStart,
  starting = null,
}: {
  readonly profiles: readonly DemoProfile[];
  readonly onStart: (role: DemoRole) => void;
  readonly starting?: DemoRole | null;
}) {
  return (
    <section className="dt-demo" aria-labelledby="demo-giris-basligi">
      <h2 id="demo-giris-basligi" className="dt-demo__title">
        Tek tıkla demo
      </h2>
      <p className="dt-demo__notice" data-testid="demo-giris-uyarisi">
        Bu bir <strong>arayüz demosudur</strong>. Aşağıdaki iki seçenek yalnızca bir{" "}
        <strong>etiket ve inceleme bağlamı</strong> seçer: her ikisi de aynı ekranları, aynı
        gezinmeyi ve aynı örnek veriyi açar. Bir yetkilendirme vermez ve hiçbir ekranı
        kısıtlamaz; backend'de rol modeli yoktur ve bu hesaplar hiçbir sunucuda tanımlı
        değildir. Demoya geçmeden önce varsa açık sunucu oturumunuz gerçekten kapatılır. Demo
        sırasında hiçbir kayıt sunucuya yazılmaz.
      </p>
      <ul className="dt-demo__list">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <article className="dt-demo__card">
              <h3 className="dt-demo__card-title">{profile.title}</h3>
              <p className="dt-demo__role">
                Etiket: <strong>{profile.roleLabel}</strong>
              </p>
              <p>{profile.summary}</p>
              <ul className="dt-demo__emphasis">
                {profile.emphasis.map((item) => (
                  <li key={item}>
                    <Badge tone="neutral">{item}</Badge>
                  </li>
                ))}
              </ul>
              <dl className="dt-demo__credentials">
                <div className="dt-demo__credential">
                  <dt>Demo e-posta</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div className="dt-demo__credential">
                  <dt>Demo parola</dt>
                  <dd>{profile.password}</dd>
                </div>
              </dl>
              <p className="dt-demo__credential-note">
                Bu bilgiler gizli değildir ve gerçek bir hesaba ait değildir; yalnızca demonun
                hangi profili açtığını göstermek için yazılıdır.
              </p>
              {/*
                * While one demo is opening, the other card's action is
                * disabled - not merely un-busy.
                *
                * Opening a demo signs the browser out first, so two clicks in
                * flight are two logouts racing one navigation, and whichever
                * resolves last decides the role the shell ends up showing. The
                * busy spinner marks the card that was chosen; the disabled
                * state on the other is what makes the choice binding.
                */}
              <Button
                fullWidth
                onClick={() => onStart(profile.id)}
                loading={starting === profile.id}
                disabled={starting !== null && starting !== profile.id}
                loadingLabel="Demo açılıyor"
              >
                {profile.actionLabel}
              </Button>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * States: idle · submitting · error.
 *
 * On the form layer, so an empty e-mail or password is refused here with an
 * announced reason instead of being posted and refused by the server.
 *
 * There is deliberately **no** client-side password length rule. The backend
 * owns the policy, and a length check invented here would reject a password
 * the server would have accepted - or, worse, quietly disagree with it. The
 * hint states what the server expects; the server decides.
 *
 * `organizasyon` stays in `defaultValues` in both modes, so the submitted shape
 * is the same object either way and the caller has no branch to get wrong.
 */
export function AuthForm({
  mode,
  onSubmit,
  submitting = false,
  error = null,
  demoProfiles = [],
  onDemoStart,
  demoStarting = null,
}: AuthFormProps) {
  const showDemo = demoProfiles.length > 0 && onDemoStart !== undefined;
  return (
    <div className="dt-stack">
      {showDemo ? (
        <>
          <DemoProfileCards
            profiles={demoProfiles}
            onStart={onDemoStart}
            starting={demoStarting}
          />
          {/*
            * A separator with a word in it, not a bare rule.
            *
            * The two halves of this screen do different things - one enters a
            * demo, the other signs in for real - and a hairline between them
            * says "same form, more fields" to anyone skimming. The heading is
            * `h2` so the demo block and the credential block sit at the same
            * level under the page title rather than one appearing to own the
            * other.
            */}
          <h2 className="dt-demo__divider">Ya da kendi hesabınızla girin</h2>
        </>
      ) : null}
      <AuthCredentialForm
        mode={mode}
        onSubmit={onSubmit}
        submitting={submitting}
        error={error}
      />
    </div>
  );
}

/** The credential half, unchanged in behaviour and separated only for reading. */
function AuthCredentialForm({
  mode,
  onSubmit,
  submitting,
  error,
}: Pick<AuthFormProps, "mode" | "onSubmit"> & {
  readonly submitting: boolean;
  readonly error: string | null;
}) {
  return (
    <AppForm<AuthFormValues>
      label={mode === "register" ? "Hesap oluştur" : "Giriş yap"}
      className="dt-stack"
      defaultValues={{ eposta: "", parola: "", organizasyon: "" }}
      submitLabel={mode === "register" ? "Hesap oluştur" : "Giriş yap"}
      busy={submitting}
      submitFullWidth
      onValid={(values) => onSubmit(values)}
    >
      {error ? (
        <p className="dt-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <TextField name="eposta" label="E-posta" type="email" autoComplete="email" required />
      <TextField
        name="parola"
        label="Parola"
        type="password"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        required
        {...(mode === "register" ? { hint: "En az 12 karakter." } : {})}
      />
      {mode === "register" ? <TextField name="organizasyon" label="Organizasyon adı" /> : null}
    </AppForm>
  );
}


/* -------------------------------------------------------- ProfileWorkspace */

export interface ProfileWorkspaceProps {
  /**
   * What the form starts with. Not a controlled value: the form owns the
   * answers from the first keystroke onwards.
   */
  defaultValues: Record<string, string>;
  /** Receives the object react-hook-form validated. Nothing else is sent. */
  onSubmit: (values: Record<string, string>) => void;
  submitting?: boolean;
  missingFacts?: readonly string[];
  /** Already-translated failure text, or null when the last attempt was fine. */
  error?: string | null;
}

/**
 * Write-only by necessity: there is no endpoint that returns stored facts, so
 * this template states that plainly instead of showing an empty form as if it
 * were the saved state.
 *
 * States: empty · edited · submitting · error · partial-data (always).
 *
 * The error state is not decoration. A save can fail because the session
 * expired, in which case the backend redirects to the login page and nothing is
 * written; without this region the form would simply sit there and the user
 * would reasonably believe the profile was saved.
 */
export function ProfileWorkspace({
  defaultValues,
  onSubmit,
  submitting = false,
  missingFacts = [],
  error = null,
}: ProfileWorkspaceProps) {
  return (
    <div className="dt-stack">
      <h1>Şirket profili</h1>
      <PartialDataNotice
        what="Bu formdaki kayıtlı değerler sunucudan geri okunamıyor."
        because="Backend'de profil okuma ucu (GET /api/profil) yok. Alanlar boş görünüyorsa bu, kayıt yapılmadığı anlamına gelmez."
      />
      {error ? (
        <p className="dt-field-error" role="alert">
          {error}
        </p>
      ) : null}
      {missingFacts.length > 0 ? (
        <Card title="Son değerlendirmede eksik görülen olgular" headingLevel={2} tone="warning">
          <MissingFactsPanel missingFacts={missingFacts} />
        </Card>
      ) : null}

      {/*
       * One store. The form owns the answers, validates them, and hands the
       * validated object to `onSubmit` - which is the object the route posts.
       * The route used to keep a second copy, fed by per-field notifications,
       * and *that* was what reached the server.
       */}
      <AppForm<Record<string, string>>
        label="Şirket profili"
        className="dt-stack"
        defaultValues={defaultValues}
        submitLabel="Profili kaydet"
        busy={submitting}
        onValid={onSubmit}
      >
        <TextField name="display_name" label="Görünen ad" />

        <Fieldset
          legend="Nitelik beyanları"
          description="Bilinmiyor, hayır demek değildir. Emin değilseniz Bilinmiyor bırakın; motor bunu belirsizlik olarak işler."
        >
          {BOOLEAN_FACTS.map((fact) => (
            <SelectField
              key={fact.name}
              name={fact.name}
              label={fact.label}
              options={TRISTATE_OPTIONS}
              {...(fact.help ? { hint: fact.help } : {})}
            />
          ))}
        </Fieldset>

        <Fieldset legend="Sayısal bilgiler" columns={2}>
          {INTEGER_FACTS.map((fact) => (
            <TextField
              key={fact.name}
              name={fact.name}
              label={fact.label}
              numeric
              {...(fact.help ? { hint: fact.help } : {})}
            />
          ))}
        </Fieldset>

        <Fieldset legend="Sınıflandırma" columns={2}>
          {TEXT_FACTS.map((fact) => (
            <TextField
              key={fact.name}
              name={fact.name}
              label={fact.label}
              {...(fact.placeholder ? { placeholder: fact.placeholder } : {})}
            />
          ))}
        </Fieldset>
      </AppForm>
    </div>
  );
}

/* -------------------------------------------------------- EligibilityWizard */

export interface EligibilityWizardProps {
  step: number;
  /** What the form starts with. The form owns the answers from then on. */
  defaultValues: Record<string, string>;
  onStepChange: (step: number) => void;
  /** Receives the object react-hook-form validated. Nothing else is sent. */
  onFinish: (values: Record<string, string>) => void;
  submitting?: boolean;
  /** Already-translated failure text from the save or the evaluation. */
  error?: string | null;
}

const WIZARD_STEPS = [
  { id: "nitelik", label: "Nitelik" },
  { id: "olcek", label: "Ölçek" },
  { id: "siniflandirma", label: "Sınıflandırma" },
  { id: "ozet", label: "Özet" },
];

/**
 * States: step 0-3 · submitting · error · partial-data (answers not re-readable).
 *
 * On failure the wizard stays where it is. Advancing or navigating after a
 * failed save would strand the user on a results screen built from data the
 * server never accepted.
 */
export function EligibilityWizard({
  step,
  defaultValues,
  onStepChange,
  onFinish,
  submitting = false,
  error = null,
}: EligibilityWizardProps) {
  return (
    <div className="dt-stack">
      <h1>Uygunluk sihirbazı</h1>
      <Stepper steps={WIZARD_STEPS} currentIndex={step} />
      {error ? (
        <p className="dt-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <PartialDataNotice
        what="Sihirbazı kapatıp yeniden açarsanız önceki cevaplarınız geri yüklenemez."
        because="Profil okuma ucu olmadığı için cevaplar yalnızca bu oturumda tutulur."
      />

      {/*
       * One form across all four steps.
       *
       * react-hook-form keeps the values of fields that are no longer mounted
       * (`shouldUnregister` is false by default), so stepping back and forth
       * does not silently blank an answer - which is exactly what a per-step
       * form would do. The submit button appears only on the last step: on the
       * earlier ones "İleri" moves a step and saves nothing, and a submit
       * button that is really a navigation control is how a half-answered
       * profile gets posted.
       */}
      <AppForm<Record<string, string>>
        label="Uygunluk sihirbazı"
        className="dt-stack"
        defaultValues={defaultValues}
        submitLabel="Kaydet ve değerlendir"
        busy={submitting}
        showSubmit={step === WIZARD_STEPS.length - 1}
        onValid={onFinish}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={step === 0}
              onClick={() => onStepChange(step - 1)}
            >
              Geri
            </Button>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button onClick={() => onStepChange(step + 1)}>İleri</Button>
            ) : null}
          </>
        }
      >
        {step === 0 ? (
          <Fieldset legend="Nitelik beyanları" description="Emin değilseniz Bilinmiyor bırakın.">
            {BOOLEAN_FACTS.map((fact) => (
              <SelectField
                key={fact.name}
                name={fact.name}
                label={fact.label}
                options={TRISTATE_OPTIONS}
              />
            ))}
          </Fieldset>
        ) : null}

        {step === 1 ? (
          <Fieldset legend="Ölçek" columns={2}>
            {INTEGER_FACTS.map((fact) => (
              <TextField key={fact.name} name={fact.name} label={fact.label} numeric />
            ))}
          </Fieldset>
        ) : null}

        {step === 2 ? (
          <Fieldset legend="Sınıflandırma" columns={2}>
            {TEXT_FACTS.map((fact) => (
              <TextField
                key={fact.name}
                name={fact.name}
                label={fact.label}
                {...(fact.placeholder ? { placeholder: fact.placeholder } : {})}
              />
            ))}
          </Fieldset>
        ) : null}

        {step === 3 ? <WizardSummary /> : null}
      </AppForm>
    </div>
  );
}

/**
 * The summary step, reading the form rather than a copy of it.
 *
 * It has to be its own component: hooks only see the form context from inside
 * the provider `AppForm` renders. That is the point rather than an obstacle -
 * the count and the listed answers now come from the same object that will be
 * submitted, so the screen cannot show one thing and post another.
 */
function WizardSummary() {
  const values = useFormValues<Record<string, string>>();
  const answered = ALL_FACTS.filter((fact) => (values[fact.name] ?? "") !== "").length;

  return (
    <Card title="Özet" headingLevel={2}>
      <p>
        {formatNumber(answered)} / {formatNumber(ALL_FACTS.length)} olgu yanıtlandı.
      </p>
      <DefinitionList
        items={ALL_FACTS.map((fact) => ({
          term: fact.label,
          description: (values[fact.name] ?? "") === "" ? "Bilinmiyor" : values[fact.name] ?? "",
        }))}
      />
      <DisclaimerBlock variant="compact" />
    </Card>
  );
}

/* ------------------------------------------------------------ DecisionList */

export interface DecisionListProps {
  decisions: readonly Decision[];
  onSelect?: (id: string) => void;
  /** Retained for API compatibility; selection now lives in the grid. */
  selectedIds?: readonly string[];
  onToggleCompare?: (id: string) => void;
}

/** States: populated · empty · with-selection. */
export function DecisionList({
  decisions,
  onSelect,
  onToggleCompare,
}: DecisionListProps) {
  if (decisions.length === 0) {
    return (
      <EmptyState
        title="Henüz karar yok"
        reason="Profilinizi doldurup değerlendirmeyi çalıştırdığınızda kararlar burada listelenir."
        action={<Link to="/uygunluk/sihirbaz">Sihirbazı başlat</Link>}
      />
    );
  }

  // Selection is the grid's now: the ad-hoc "Karşılaştır" checkbox column has
  // become a real selection column with a bulk-action bar, and the compare
  // callback receives the selected loaded rows.
  const config = decisionsGridConfig(
    onToggleCompare ? { onCompare: (ids) => ids.forEach((id) => onToggleCompare(id)) } : {},
  );

  return (
    <DataGrid
      config={onSelect ? withRowSelectHandler(config, onSelect) : config}
      rows={decisions}
    />
  );
}

/** Keeps the workspace's "click a row to open it in the detail panel" behaviour. */
function withRowSelectHandler(
  config: GridConfig<Decision>,
  onSelect: (id: string) => void,
): GridConfig<Decision> {
  return {
    ...config,
    columns: config.columns.map((column) =>
      column.id === "program"
        ? {
            ...column,
            cell: (decision: Decision) => (
              <button
                type="button"
                className="dt-linklike"
                onClick={() => onSelect(decision.id)}
              >
                {decision.program_code}
              </button>
            ),
          }
        : column,
    ),
  };
}

/* ---------------------------------------------------------- DecisionDetail */

export interface DecisionDetailProps {
  decision: Decision;
  program: Program | null;
  /**
   * `null` when the registry could not be read.
   *
   * Two of this template's four tabs are about evidence, and both of them
   * answered a failed read with a verdict: the evidence tab said the cited
   * snapshot "kütükte yok", and the rule trace marked every citation as an
   * unknown source, because an unread registry and an empty one arrived at
   * `knownSnapshotIds` identically. Those are the two strongest claims this
   * product makes about a decision, and they were being produced by an HTTP
   * failure.
   */
  snapshots: SourceRegistryRead;
  sourcesRead?: SourceReadState;
  approvalSlot?: ReactNode;
  /**
   * Where this sits in the document outline.
   *
   * `1` when it *is* the page (`/degerlendirmeler/:id`). `2` when it is embedded
   * in a page that already owns the `h1`, as in the decision workspace. A page
   * with two `h1` elements has no single root, and a screen reader announces
   * two different document titles for one screen.
   */
  headingLevel?: 1 | 2;
}

/**
 * States: complete · missing-program · missing-sources · unread-registry.
 *
 * Section headings are derived from `headingLevel` rather than hard-coded, so
 * the outline stays contiguous in both placements: h1→h2 standalone, h2→h3
 * embedded. Neither mode skips a level.
 *
 * The unread state gates the two evidence-bearing tabs and nothing else. The
 * outcome, the reasons and the missing facts come from the decision itself and
 * stay on screen: a registry failure is not a reason to hide the decision, only
 * a reason to stop making claims about what backs it.
 */
export function DecisionDetail({
  decision,
  program,
  snapshots,
  sourcesRead,
  approvalSlot,
  headingLevel = 1,
}: DecisionDetailProps) {
  const related =
    snapshots?.filter((snapshot) => decision.source_snapshot_ids.includes(snapshot.id)) ?? null;
  const Title = headingLevel === 1 ? "h1" : "h2";
  const sectionLevel: 2 | 3 = headingLevel === 1 ? 2 : 3;

  return (
    <div className="dt-stack">
      <Title>{program?.name ?? decision.program_code}</Title>
      <div className="dt-row">
        <OutcomeBadge outcome={decision.outcome} label={decision.outcome_label} showDescription />
      </div>

      <DisclaimerBlock />

      <Tabs
        label="Karar ayrıntısı"
        items={[
          {
            value: "gerekce",
            label: "Gerekçe",
            content: (
              <div className="dt-stack">
                <Card title="Gerekçeler" headingLevel={sectionLevel}>
                  <ReasonList reasons={decision.reasons} />
                </Card>
                <Card title="Eksik olgular" headingLevel={sectionLevel}>
                  <MissingFactsPanel missingFacts={decision.missing_facts} />
                </Card>
              </div>
            ),
          },
          {
            value: "iz",
            label: "Kural izi",
            content:
              snapshots === null ? (
                /*
                 * Gated rather than drawn with empty `knownSnapshotIds`.
                 *
                 * Every row in this table carries a citation, and the chip
                 * renders "bu kaynak kütükte bulunamadı" for anything not in
                 * that list. Passing `[]` because the read failed would put that
                 * verdict on every single row - a table of confident, uniformly
                 * wrong claims - and there is no honest half-rendering of a
                 * citation whose registry nobody could open.
                 */
                <UnreadSourceRegistry
                  what="Kural izindeki kaynak atıfları doğrulanamadığı için iz gösterilemiyor."
                  {...(sourcesRead ? { state: sourcesRead } : {})}
                />
              ) : (
                <PredicateTraceTable
                  traces={decision.traces}
                  knownSnapshotIds={snapshots.map((snapshot) => snapshot.id)}
                />
              ),
          },
          {
            value: "kanit",
            label: "Kanıt",
            content: (
              <div className="dt-stack">
                <DecisionHashPair
                  inputHash={decision.input_hash}
                  decisionHash={decision.decision_hash}
                />
                <DefinitionList
                  items={[
                    { term: "Kural sürümü", description: <code className="dt-mono">{decision.rule_set_version_id}</code> },
                    { term: "Program sürümü", description: <code className="dt-mono">{decision.program_version_id}</code> },
                    { term: "Üretildiği an", description: formatDateTime(decision.created_at) },
                  ]}
                />
                {related === null ? (
                  <UnreadSourceRegistry
                    what={`Bu kararın dayandığı ${formatNumber(decision.source_snapshot_ids.length)} kaynak gösterilemiyor.`}
                    {...(sourcesRead ? { state: sourcesRead } : {})}
                  />
                ) : related.length === 0 ? (
                  <EmptyState
                    title="Kaynak kaydı bulunamadı"
                    reason="Karar kaynak kimliği taşıyor ama kütükte eşleşen kayıt yok."
                  />
                ) : (
                  <ul className="dt-stack">
                    {related.map((snapshot) => (
                      <li key={snapshot.id}>
                        <SourceSnapshotCard snapshot={snapshot} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
          {
            value: "onay",
            label: USER_APPROVAL_LABEL,
            content: approvalSlot ?? <ApprovalRecordCard />,
          },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------- DecisionCompare */

export interface DecisionCompareProps {
  decisions: readonly Decision[];
}

/** States: comparable · too-few. */
export function DecisionCompare({ decisions }: DecisionCompareProps) {
  return (
    <div className="dt-stack">
      <h1>Karar karşılaştırması</h1>
      <DisclaimerBlock />
      <DecisionCompareGrid decisions={decisions} />
    </div>
  );
}

/* ----------------------------------------------------------- SourceRegistry */

export interface SourceRegistryProps {
  snapshots: readonly Snapshot[];
}

/** States: populated · empty. */
export function SourceRegistry({ snapshots }: SourceRegistryProps) {
  return (
    <div className="dt-stack">
      <h1>Kaynak kütüğü</h1>
      <p className="dt-lede">
        Her karar, burada listelenen kaynak yakalamalarından birine dayanır. İçerik özeti,
        sistemin üzerinde akıl yürüttüğü metnin kanıtıdır.
      </p>
      <SourceFreshnessMeter snapshots={snapshots} />
      <PartialDataNotice
        what="Yakalanan ham metin bu ekranda gösterilemiyor."
        because="API kaynak gövdesini döndürmüyor; yalnızca üstveri ve içerik özeti okunabiliyor."
      />
      {snapshots.length === 0 ? (
        <EmptyState title="Kaynak yok" reason="Katalog henüz seed edilmemiş olabilir." />
      ) : (
        <DataGrid config={sourcesGridConfig()} rows={snapshots} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ SettingsPanel */

export interface SettingsPanelProps {
  sections: readonly { id: string; title: string; content: ReactNode }[];
  title?: string;
}

/** States: one section · many sections. */
export function SettingsPanel({ sections, title = "Ayarlar" }: SettingsPanelProps) {
  return (
    <div className="dt-stack">
      <h1>{title}</h1>
      {sections.map((section) => (
        <Card key={section.id} title={section.title} headingLevel={2}>
          {section.content}
        </Card>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- OpsHealth */

export interface OpsHealthProps {
  health: ReadinessHealth | null;
  maturity?: MaturityReport;
  lastCheckedAt?: string;
}

/** States: ready · not-ready · unreachable. */
export function OpsHealth({ health, maturity, lastCheckedAt }: OpsHealthProps) {
  return (
    <div className="dt-stack">
      <h1>Platform sağlığı</h1>
      {health === null ? (
        <EmptyState
          title="Sağlık bilgisi okunamadı"
          reason="Sunucunun /hazir ucu yanıt vermedi. Bu ekran gerçek yanıt olmadan hiçbir şey göstermez."
        />
      ) : (
        <Card title="Hazırlık" headingLevel={2}>
          <DefinitionList
            columns={2}
            items={[
              {
                term: "Genel durum",
                description: (
                  <Badge tone={health.status === "ready" ? "candidate" : "ineligible"}>
                    {health.status === "ready" ? "Hazır" : "Hazır değil"}
                  </Badge>
                ),
              },
              { term: "Veritabanı", description: health.database },
              { term: "Katalog", description: health.catalog },
              {
                term: "Program sayısı",
                description:
                  health.program_count === undefined ? "—" : formatNumber(health.program_count),
              },
              { term: "Yapay zekâ sağlayıcı", description: health.ai_provider },
            ]}
          />
          {lastCheckedAt ? (
            <p className="dt-muted">Son okuma: {formatDateTime(lastCheckedAt)}</p>
          ) : null}
          {health.ai_provider === "disabled" ? (
            <p className="dt-muted">
              Yapay zekâ sağlayıcı kapalı. Bu sürümde arayüzde yapay zekâ üretimi hiçbir yerde
              gösterilmez.
            </p>
          ) : null}
        </Card>
      )}

      {maturity ? (
        <Card title="Olgunluk — yedi boyut" headingLevel={2}>
          <p className="dt-muted">
            Tek bir toplam puan yoktur: {maturity.unmeasurableCount} boyut bugün ölçülemiyor ve
            ortalama almak bunu gizlerdi.
          </p>
          <MaturityRadar dimensions={maturity.dimensions} />
        </Card>
      ) : null}
    </div>
  );
}

/* --------------------------------------- CapabilityMatrix (product surface) */

export interface CapabilityMatrixProps {
  capabilities?: readonly Capability[];
}

/** The honesty ledger, rendered. States: grouped by capability area. */
export function CapabilityMatrix({ capabilities = CAPABILITIES }: CapabilityMatrixProps) {
  const groups = useMemo(() => {
    const map = new Map<CapabilityGroup, Capability[]>();
    for (const capability of capabilities) {
      const list = map.get(capability.group) ?? [];
      list.push(capability);
      map.set(capability.group, list);
    }
    return [...map.entries()];
  }, [capabilities]);

  const counts = {
    green: capabilities.filter((c) => c.status === "green").length,
    partial: capabilities.filter((c) => c.status === "partial").length,
    blocked: capabilities.filter((c) => c.status === "blocked").length,
  };

  return (
    <div className="dt-stack">
      <h1>Yetenek matrisi</h1>
      <p className="dt-lede">
        Bu ürünün neyi yapabildiği, neyi kısmen yapabildiği ve neyi <em>hiç</em> yapamadığı.
        Yapamadıkları gizlenmez, taklit edilmez.
      </p>
      <DefinitionList
        columns={2}
        items={[
          { term: STATUS_LABELS.green, description: formatNumber(counts.green) },
          { term: STATUS_LABELS.partial, description: formatNumber(counts.partial) },
          { term: STATUS_LABELS.blocked, description: formatNumber(counts.blocked) },
        ]}
      />
      {groups.map(([group, items]) => (
        <Card key={group} title={GROUP_LABELS[group]} headingLevel={2}>
          <ul className="dt-stack">
            {items.map((capability) => (
              <li key={capability.id}>
                <BackendCapabilityGate capability={capability}>
                  <p className="dt-capability__label">
                    <Badge tone="candidate">{STATUS_LABELS.green}</Badge> {capability.title}
                  </p>
                  {capability.backedBy ? (
                    <p className="dt-muted">
                      <code className="dt-mono">{capability.backedBy}</code>
                    </p>
                  ) : null}
                </BackendCapabilityGate>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- ReadinessTimeline */

export interface ReadinessTemplateProps {
  decisions: readonly Decision[];
}

/** Organization readiness derived from missing_facts. States: ready · gaps · no-data. */
export function ReadinessTemplate({ decisions }: ReadinessTemplateProps) {
  const missing = useMemo(
    () => [...new Set(decisions.flatMap((decision) => decision.missing_facts))],
    [decisions],
  );

  return (
    <div className="dt-stack">
      <h1>Organizasyon hazırlığı</h1>
      <p className="dt-lede">
        Hangi olguların eksik olduğu, kararların kendisinden okunur. Hangi değeri girdiğiniz
        okunamaz; eksik olan okunur.
      </p>
      {decisions.length === 0 ? (
        <EmptyState
          title="Değerlendirme yok"
          reason="Hazırlık göstergesi kararlardan türetilir; önce bir değerlendirme çalıştırın."
        />
      ) : (
        <>
          <Card title="Eksik olgular" headingLevel={2}>
            <MissingFactsPanel missingFacts={missing} />
          </Card>
          <Card title="Karar başına durum" headingLevel={2}>
            <Timeline
              entries={decisions.map((decision) => ({
                id: decision.id,
                title: `${decision.program_code} — ${decision.outcome_label}`,
                timestamp: formatDateTime(decision.created_at),
                detail:
                  decision.missing_facts.length === 0 ? (
                    <span className="dt-muted">Eksik olgu yok.</span>
                  ) : (
                    <span>{decision.missing_facts.map(factLabel).join(", ")}</span>
                  ),
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- ApprovalForm */

export interface ApprovalFormProps {
  onSubmit: (note: string) => void;
  submitting?: boolean;
  recordedNote?: string | null;
  /**
   * When the approval was recorded, as the write reported it.
   *
   * Required company for `recordedNote`: the card used to build this itself,
   * with `new Date().toISOString()` *inside its own render*, so the recorded
   * moment moved on every repaint - a background refetch was enough. The caller
   * owns it now, because the caller is the one that knows when the write
   * happened.
   */
  recordedAt?: string | null;
  /** Whose clock `recordedAt` came from. See `ApprovalRecordCard`. */
  recordedAtSource?: "server" | "client";
  /** Already-translated failure text, or null when the last attempt was fine. */
  error?: string | null;
}

/**
 * States: idle · submitting · error · recorded-this-session.
 *
 * `recordedNote` is set by the caller only on a successful mutation, so a
 * failed approval can never paint the "recorded" card. The error region says
 * why, which matters most when the session expired: the backend redirected to
 * the login page and no approval exists.
 */
export function ApprovalForm({
  onSubmit,
  submitting = false,
  recordedNote = null,
  recordedAt = null,
  recordedAtSource = "server",
  error = null,
}: ApprovalFormProps) {
  return (
    <div className="dt-stack">
      <ApprovalRecordCard
        note={recordedNote ?? ""}
        {...(recordedAt ? { approvedAt: recordedAt, approvedAtSource: recordedAtSource } : {})}
      />
      {error ? (
        <p className="dt-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <AppForm<{ note: string }>
        label={`${USER_APPROVAL_LABEL} kaydı`}
        className="dt-stack"
        defaultValues={{ note: "" }}
        submitLabel={`${USER_APPROVAL_LABEL} olarak kaydet`}
        busy={submitting}
        onValid={(values) => onSubmit(values.note)}
        footer={<p className="dt-muted">{DISCLAIMER}</p>}
      >
        <TextField
          name="note"
          label={`${USER_APPROVAL_LABEL} notu`}
          multiline
          hint="Bu not yalnızca sizin kaydınızdır; hiçbir kuruma iletilmez."
        />
      </AppForm>
    </div>
  );
}
