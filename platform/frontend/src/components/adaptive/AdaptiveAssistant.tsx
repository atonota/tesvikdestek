/**
 * The adaptive assistant.
 *
 * There is no AI provider in this deployment, and this surface is built so that
 * this fact is the first thing it says rather than something a user discovers.
 *
 * What it still does, honestly: it runs deterministic rules over records the
 * page has *already loaded*, shows what each rule read, explains why it fired,
 * and names one next action. That is genuinely useful and it is reproducible -
 * two people looking at the same screen get the same suggestion, which is not
 * true of a generated one.
 *
 * What it refuses to do:
 *
 *  - claim an analysis. No "analiz tamamlandı", no "sonuçlar üretildi". The
 *    component test greps for that language, because it is the exact phrasing
 *    that turns a rule into an oracle.
 *  - render a provider-based suggestion without a connected provider. It is
 *    dropped, not greyed out: a greyed-out answer is still an answer on the
 *    screen, and people read past the styling.
 *  - show an unexplained suggestion. A suggestion with no `why` is an
 *    instruction, and this product does not issue instructions about money.
 *  - turn an unanswered fact into a negative. Missing facts render as
 *    "bilinmiyor". UNKNOWN is not false, here or anywhere else.
 *
 * The operator stays in control: every suggestion can be dismissed, and nothing
 * here mutates anything - actions are handed back to the caller.
 */

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/intl";
import { Card } from "../composites";
import { PartialDataNotice } from "../patterns";
import { Badge, Button, Link } from "../primitives";
import {
  renderableSuggestions,
  suppressedSuggestionCount,
  type AssistantCapabilities,
  type AssistantDataStatus,
  type AssistantSuggestion,
} from "./types";

export interface AdaptiveAssistantProps {
  readonly capabilities: AssistantCapabilities;
  readonly suggestions: readonly AssistantSuggestion[];
  readonly dataStatus: AssistantDataStatus;
  readonly onDismiss?: (id: string) => void;
  readonly className?: string;
}

/**
 * States: no-provider (default) · provider-declared · provider-connected ·
 * nothing-to-suggest · partial-data.
 */
export function AdaptiveAssistant({
  capabilities,
  suggestions,
  dataStatus,
  onDismiss,
  className,
}: AdaptiveAssistantProps) {
  const visible = renderableSuggestions(suggestions, capabilities);
  const withheld = suppressedSuggestionCount(suggestions, capabilities);
  const connected = capabilities.providerState === "connected";

  return (
    /**
     * A region, not a complementary landmark.
     *
     * The shell's right rail is already the `complementary` landmark. Nesting a
     * second one inside it - with the same accessible name, as an earlier draft
     * did - gives a screen-reader user two identically named landmarks one
     * inside the other, which is worse than having none.
     */
    <section className={cn("dt-assistant", className)} aria-label="Sıradaki adımlar ve veri durumu">
      <Card
        title="Sıradaki adımlar"
        headingLevel={2}
        actions={
          <Badge tone={connected ? "accent" : "neutral"}>
            {connected ? "Sağlayıcı bağlı" : "Sağlayıcı yok"}
          </Badge>
        }
      >
        {connected ? null : (
          <p className="dt-assistant__provider" role="note">
            {capabilities.providerReason}
          </p>
        )}

        <ul className="dt-assistant__list">
          {visible.map((suggestion) => (
            <li key={suggestion.id} className="dt-assistant__item">
              <p className="dt-assistant__title">{suggestion.title}</p>
              <p className="dt-assistant__why">{suggestion.why}</p>
              <p className="dt-assistant__basis">
                <Badge tone="neutral">
                  {suggestion.basis === "loaded-data" ? "Ekrandaki veriden" : "Sağlayıcıdan"}
                </Badge>
                {suggestion.readFrom.length > 0 ? (
                  <span className="dt-assistant__read">
                    Okunan kayıtlar: {suggestion.readFrom.join(", ")}
                  </span>
                ) : null}
              </p>
              <p className="dt-assistant__action">
                {suggestion.nextAction.to ? (
                  <Link to={suggestion.nextAction.to}>{suggestion.nextAction.label}</Link>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={suggestion.nextAction.onRun === undefined}
                    onClick={suggestion.nextAction.onRun}
                  >
                    {suggestion.nextAction.label}
                  </Button>
                )}
                {onDismiss ? (
                  <Button size="sm" variant="ghost" onClick={() => onDismiss(suggestion.id)}>
                    Kapat
                  </Button>
                ) : null}
              </p>
            </li>
          ))}
        </ul>

        {visible.length === 0 ? (
          <p className="dt-muted">
            Ekrandaki verilerden çıkarılabilecek bir sonraki adım bulunmadı. Bu, yapılacak bir şey
            olmadığı anlamına gelmez; yalnızca bu ekranın gördüğü kayıtlarda bir kural eşleşmedi.
          </p>
        ) : null}

        {withheld > 0 ? (
          <p className="dt-assistant__withheld" role="note">
            {withheld} öneri gösterilmiyor: bunlar bir sağlayıcı yanıtı gerektiriyor ve bağlı bir
            sağlayıcı yok. Gizlenmiş bir yanıt yerine hiç yanıt göstermemek tercih edildi.
          </p>
        ) : null}
      </Card>

      <Card title="Veri durumu" headingLevel={2} tone="sunken">
        {/*
         * The timestamp is a client fetch time and says so.
         *
         * It is TanStack's `dataUpdatedAt`: the moment this browser received
         * the payload. It is not when the decision was produced and it is not
         * when the source was captured - the list endpoint returns neither -
         * and "son yükleme" alone reads as the stronger of the three.
         */}
        <p className="dt-assistant__source">
          {dataStatus.label} —{" "}
          {dataStatus.loading
            ? "yükleniyor"
            : dataStatus.lastLoadedAt
              ? `bu tarayıcıya son yüklenme ${formatDateTime(dataStatus.lastLoadedAt)}`
              : "bu tarayıcıya bu oturumda hiç yüklenmedi"}
        </p>

        {dataStatus.error ? (
          <p className="dt-field-error" role="alert">
            {dataStatus.error}
          </p>
        ) : null}

        {dataStatus.missing.length > 0 ? (
          <>
            <p className="dt-assistant__missing-title">Yanıtlanmamış olgular</p>
            <ul className="dt-assistant__missing">
              {dataStatus.missing.map((fact) => (
                <li key={fact}>
                  <span>{fact}</span>{" "}
                  <Badge tone="insufficient" srDescription="Bu olgu yanıtlanmadı">
                    Bilinmiyor
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="dt-muted">
              Yanıtlanmamış bir olgu &quot;hayır&quot; sayılmaz. Motor bunu bilinmiyor olarak işler
              ve sonuç buna göre yetersiz veri çıkabilir.
            </p>
          </>
        ) : null}

        {/*
         * Partial means partial *today*, not as a permanent hedge.
         *
         * The previous notice claimed there was no endpoint that returns every
         * record. There is: `/api/degerlendirmeler` returns the whole list for
         * the tenant. Inventing a backend limitation to excuse a constant
         * `partial: true` is the same class of dishonesty as inventing a
         * result, so the notice now appears only when a query is genuinely in
         * flight or has genuinely failed, and names which.
         */}
        {dataStatus.partial ? (
          <PartialDataNotice
            what="Bu öneriler yalnızca bu ekranın yükleyebildiği kayıtlara bakar."
            because={
              dataStatus.error
                ? "Kayıtların bir bölümü bu oturumda yüklenemedi. Yüklenmemiş bir kayıt hakkında öneri üretilemez ve üretilmiş gibi de gösterilmez."
                : "Kayıtlar hâlâ yükleniyor. Yükleme bitene kadar buradaki sayımlar eksik kalır."
            }
          />
        ) : null}
      </Card>
    </section>
  );
}
