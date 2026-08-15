/**
 * The two demo profiles the login screen offers.
 *
 * **What differs between them, exactly: the label and the review context.**
 * Nothing else. Both profiles open the same screens, with the same navigation,
 * against the same example data. There is no role model, no permission check,
 * no per-role surface and no second data set - and this file previously implied
 * otherwise, which an independent review caught. That implication was a product
 * hypothesis written as if it were delivered behaviour, and the distance
 * between those two is the thing this repository exists to keep visible.
 *
 * Why two at all, then: a review session needs to be able to say which context
 * it was conducted in - "we walked the operations focus" versus "we walked the
 * organisation's own focus" - and to carry that context in the screenshot. The
 * `emphasis` list is a *review focus*, a suggestion of where to look. It is not
 * a claim that the other profile cannot reach those screens; both can, because
 * both see the identical application.
 *
 * **The credentials below are not secrets and are not accounts.** They are
 * printed on screen deliberately, they end in the reserved `.local` suffix so
 * they can never resolve to a real mailbox, and no backend has ever heard of
 * them: there is no user table entry, no role row, nothing to authenticate
 * against. They are shown because a demo card that displays credentials reads
 * as a real account with a real password, and a reviewer who copies them into
 * the manual form must find them refused by the server rather than discovering
 * later that the "demo account" was imaginary.
 *
 * What a role means here, stated exactly: it selects a label on this device.
 * It grants nothing and restricts nothing, because there is nothing to grant -
 * `domain/capabilities.ts` records `roles` as blocked, and this feature does
 * not change that. Any wording here that implied server-side authorisation, or
 * that one profile sees something the other cannot, would be a false claim
 * about software that does not exist. `demo-login.test.tsx` scans this file for
 * exactly those phrasings.
 */

export type DemoRole = "superadmin" | "customer";

export interface DemoProfile {
  readonly id: DemoRole;
  /** The card heading. */
  readonly title: string;
  /** How the role is named in the shell badge and on the card. */
  readonly roleLabel: string;
  /** What this profile is for, in one sentence a non-technical reader can use. */
  readonly summary: string;
  /** Non-secret, `.local`, and unknown to every backend. */
  readonly email: string;
  readonly password: string;
  /** Distinct per profile: two identical labels would be two identical buttons. */
  readonly actionLabel: string;
  /**
   * Where this review context suggests looking first. Shown on the card.
   *
   * A focus, not an entitlement: every screen named here is reachable by both
   * profiles, because both profiles open the same application.
   */
  readonly emphasis: readonly string[];
}

export const DEMO_PROFILES: readonly DemoProfile[] = [
  {
    id: "superadmin",
    title: "Süperadmin demo",
    roleLabel: "Süperadmin",
    summary:
      "Operasyon odaklı inceleme için önerilen tur: katalog, kaynak kayıtları, sağlık ekranı ve yetenek kütüğü. Ekranların tamamı her iki profilde de açıktır.",
    email: "superadmin@demo.destektesvik.local",
    password: "demo-superadmin-2026",
    actionLabel: "Süperadmin demosunu aç",
    emphasis: ["Operasyon sağlığı", "Kaynak kayıtları", "Yetenek kütüğü"],
  },
  {
    id: "customer",
    title: "Müşteri demo",
    roleLabel: "Müşteri",
    summary:
      "Organizasyon odaklı inceleme için önerilen tur: fırsatlar, kararlar, hazırlık ve olgunluk. Ekranların tamamı her iki profilde de açıktır.",
    email: "musteri@demo.destektesvik.local",
    password: "demo-musteri-2026",
    actionLabel: "Müşteri demosunu aç",
    emphasis: ["Fırsatlar", "Karar tezgâhı", "Hazırlık ve olgunluk"],
  },
];

export function demoProfile(role: DemoRole): DemoProfile {
  const found = DEMO_PROFILES.find((profile) => profile.id === role);
  if (!found) throw new Error(`Tanımsız demo rolü: ${String(role)}`);
  return found;
}

/**
 * What the running application shows in its header.
 *
 * The word "Demo" comes first and is never dropped: a reviewer glancing at one
 * screenshot has to be able to tell demo data from tenant data without knowing
 * the product. The role follows it, because "which role am I looking at" is the
 * question the two profiles exist to answer.
 */
export function demoBadgeLabel(role: DemoRole): string {
  return `Demo · ${demoProfile(role).roleLabel}`;
}
