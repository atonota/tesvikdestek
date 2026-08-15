/**
 * The adaptive enterprise surface, documented state by state.
 *
 * The matrix below is the review surface: the shell with and without a context
 * rail, the mobile sheets, the assistant with no provider (the default and the
 * only honest one today) and with one connected, the withheld-suggestion state,
 * the empty state, and the form layer including the custom select.
 *
 * Theme and density are Storybook globals, so light and dark are the same
 * stories viewed under the toolbar switch rather than duplicated exports. The
 * 320px cases carry an explicit viewport parameter, because the whole point of
 * a mobile-first shell is that the narrow layout is the primary one.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdaptiveAssistant } from "./AdaptiveAssistant";
import { AdaptiveShell } from "./AdaptiveShell";
import { NO_ASSISTANT_PROVIDER, type AssistantDataStatus, type AssistantSuggestion } from "./types";
import { AppForm, SelectField, TextField } from "../forms";
import { Select } from "../forms/Select";
import { Card } from "../composites";

const NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kokpit", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", shortLabel: "Kararlar", icon: "▤" },
  { to: "/firsatlar", label: "Fırsatlar", shortLabel: "Fırsat", icon: "◎" },
  { to: "/kaynaklar", label: "Kaynaklar", shortLabel: "Kaynak", icon: "❖" },
  { to: "/ayarlar/gorunum", label: "Ayarlar", shortLabel: "Ayar", icon: "⚙" },
];

const SUGGESTIONS: readonly AssistantSuggestion[] = [
  {
    id: "missing-facts",
    title: "3 kararda yanıtlanmamış olgu var",
    why:
      "Yüklenmiş 12 kararın 3 tanesinde en az bir olgu yanıtlanmamış. Yanıtlanmamış olgu " +
      "olumsuz sayılmaz; motor bunu bilinmiyor olarak işler.",
    basis: "loaded-data",
    readFrom: ["degerlendirmeler"],
    nextAction: { label: "Eksik olguları tamamla", to: "/organizasyon/profil" },
  },
  {
    id: "provider-summary",
    title: "Profilinizi özetleyeyim",
    why: "Bir dil modeline sorulması gerekir.",
    basis: "provider",
    readFrom: [],
    nextAction: { label: "Özet iste" },
  },
];

const DATA_STATUS: AssistantDataStatus = {
  label: "Karar listesi",
  lastLoadedAt: "2026-08-15T09:00:00Z",
  missing: ["Çalışan sayısı", "NACE kodu"],
  partial: true,
};

const MOBILE = { viewport: { defaultViewport: "mobile1" } };

const meta: Meta<typeof AdaptiveShell> = {
  title: "Uyarlanabilir/Kabuk",
  component: AdaptiveShell,
  args: {
    navItems: NAV,
    title: "Kokpit",
    breadcrumbs: <span>Kokpit</span>,
    headerUtilities: <button type="button" className="dt-btn dt-btn--ghost dt-btn--sm">Çıkış</button>,
    conversionAction: {
      label: "Uygunluk sihirbazını başlat",
      to: "/uygunluk/sihirbaz",
      hint: "Ön değerlendirme üretir; kurum kararı değildir.",
    },
    children: (
      <Card title="Sonuç dağılımı" headingLevel={2}>
        <p>Bu alan sayfanın kendi içeriğidir.</p>
      </Card>
    ),
  },
};
export default meta;

type ShellStory = StoryObj<typeof AdaptiveShell>;

/** Three columns at 1440: rail, content, assistant. */
export const UcKolonlu: ShellStory = {
  args: {
    contextRail: (
      <AdaptiveAssistant
        capabilities={NO_ASSISTANT_PROVIDER}
        suggestions={SUGGESTIONS}
        dataStatus={DATA_STATUS}
      />
    ),
  },
};

/** No context to show: the complementary landmark disappears entirely. */
export const RaysizIkiKolonlu: ShellStory = {
  args: { contextRail: undefined },
};

/** 320px: the navigation and assistant sheets, thumb bar and pinned conversion action. */
export const MobilTekKolon: ShellStory = {
  parameters: MOBILE,
  args: {
    contextRail: (
      <AdaptiveAssistant
        capabilities={NO_ASSISTANT_PROVIDER}
        suggestions={SUGGESTIONS}
        dataStatus={DATA_STATUS}
      />
    ),
  },
};

/** No conversion action offered by the route. */
export const DonusumEylemiYok: ShellStory = {
  parameters: MOBILE,
  args: { conversionAction: undefined, contextRail: undefined },
};

/* -------------------------------------------------------------- assistant */

type AssistantStory = StoryObj<typeof AdaptiveAssistant>;

/** The honest default: no provider, rule-derived suggestions only. */
export const YardimciSaglayiciYok: AssistantStory = {
  render: () => (
    <AdaptiveAssistant
      capabilities={NO_ASSISTANT_PROVIDER}
      suggestions={SUGGESTIONS}
      dataStatus={DATA_STATUS}
    />
  ),
};

/** A provider is genuinely connected, so its suggestion is allowed through. */
export const YardimciSaglayiciBagli: AssistantStory = {
  render: () => (
    <AdaptiveAssistant
      capabilities={{ providerState: "connected", providerReason: "" }}
      suggestions={SUGGESTIONS}
      dataStatus={{ ...DATA_STATUS, missing: [], partial: false }}
    />
  ),
};

/** Nothing matched. It says so, and does not invent reassurance. */
export const YardimciOneriYok: AssistantStory = {
  render: () => (
    <AdaptiveAssistant
      capabilities={NO_ASSISTANT_PROVIDER}
      suggestions={[]}
      dataStatus={{ ...DATA_STATUS, missing: [] }}
    />
  ),
};

export const YardimciMobil: AssistantStory = {
  parameters: MOBILE,
  render: () => (
    <AdaptiveAssistant
      capabilities={NO_ASSISTANT_PROVIDER}
      suggestions={SUGGESTIONS}
      dataStatus={DATA_STATUS}
    />
  ),
};

/* ------------------------------------------------------------- the form */

type FormStory = StoryObj<typeof AppForm>;

/** The custom select, closed. Identical on every platform by construction. */
export const SecimKutusu: FormStory = {
  render: () => (
    <Select
      label="Sonuç filtresi"
      value="aday"
      onValueChange={() => undefined}
      options={[
        { value: "aday", label: "Aday uygunluk" },
        { value: "kosullu", label: "Koşullu" },
        { value: "uygun-degil", label: "Uygun değil" },
        {
          value: "yetersiz",
          label: "Yetersiz veri",
          disabled: true,
          disabledReason: "Bu sonuç için yeterli olgu yok.",
        },
      ]}
    />
  ),
};

/** A react-hook-form surface with a required field and a bound select. */
export const DogrulananForm: FormStory = {
  render: () => (
    <AppForm
      label="Kullanıcı onayı"
      submitLabel="Kaydet"
      defaultValues={{ note: "", scope: "" }}
      onValid={() => undefined}
    >
      <TextField name="note" label="Not" required minLength={5} multiline />
      <SelectField
        name="scope"
        label="Kapsam"
        required
        options={[
          { value: "tam", label: "Tam" },
          { value: "kismi", label: "Kısmi" },
        ]}
      />
    </AppForm>
  ),
};

export const DogrulananFormMobil: FormStory = {
  parameters: MOBILE,
  render: () => (
    <AppForm
      label="Kullanıcı onayı"
      submitLabel="Kaydet"
      defaultValues={{ note: "", scope: "" }}
      onValid={() => undefined}
    >
      <TextField name="note" label="Not" required minLength={5} multiline />
      <SelectField
        name="scope"
        label="Kapsam"
        required
        options={[
          { value: "tam", label: "Tam" },
          { value: "kismi", label: "Kısmi" },
        ]}
      />
    </AppForm>
  ),
};
