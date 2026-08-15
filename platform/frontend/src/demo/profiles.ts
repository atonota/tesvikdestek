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
 * against. They are shown because a printed pair is the shape a reviewer
 * already knows how to use, and hiding it behind a button would mean the only
 * way into the demo was the one way we happened to think of.
 *
 * Which is exactly what went wrong once, and is worth recording rather than
 * quietly fixing. An earlier version of this comment reasoned that a reviewer
 * who typed these into the credential form "must find them refused by the
 * server" - and the code obliged: the form posted them to `/giris`, a backend
 * that has never heard of them answered 401, and the screen said "E-posta veya
 * parola hatalı." about credentials it had printed itself, correct, a
 * centimetre above. Being refused by the server was not honesty; it was the
 * interface contradicting itself in the one place a first-time visitor cannot
 * adjudicate. `matchDemoProfile` below is the correction: a printed pair opens
 * the demo *whichever door it is typed into*, and it never reaches the network
 * at all, so there is no server left to disagree with the card.
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

/**
 * The address, folded to the one form the comparison uses.
 *
 * Two liberties are taken and both are boring on purpose. Surrounding
 * whitespace is dropped, because copying an address out of a card picks up a
 * trailing space and that space is not a different account. `A-Z` is lowered,
 * because a phone keyboard capitalises the first letter of a field it thinks
 * is a sentence.
 *
 * The lowering is deliberately **ASCII-only** rather than `toLowerCase()`, and
 * this is the detail that would otherwise bite exactly this product. Under a
 * `tr-TR` locale the capital `I` lowercases to the dotless `ı`, so a reviewer
 * whose phone helpfully sent `MUSTERI@…` would be compared against `musterı@…`
 * and refused - on a Turkish-language screen, for a Turkish-named profile,
 * which is the worst place to discover a locale-sensitive comparison. Folding
 * only `A-Z` gives the same answer on every device and in every locale.
 *
 * Nothing here touches the password. See `matchDemoProfile`.
 */
export function normalizeDemoEmail(value: string): string {
  return value.trim().replace(/[A-Z]/gu, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
}

/**
 * The one place that decides whether a typed pair is a demo pair.
 *
 * Canonical by construction: it reads `DEMO_PROFILES`, the same list the login
 * card renders. There is no second table of credentials to fall out of step
 * with the one on screen - and if there were, the failure would be the worst
 * available: the card printing one password while the form accepted another.
 * `demo-login.test.tsx` scans the route, the template and the query layer for
 * a copied literal, so the single source is enforced rather than intended.
 *
 * The **pair** matches, never the address alone. An address-only match would
 * turn a printed e-mail into a skeleton key for a screen that is about to say
 * "Demo", and it would also swallow a genuine typo in the password field
 * instead of letting the real sign-in answer it. The password is compared byte
 * for byte for the same reason trimming it would be wrong: accepting a
 * password the visitor did not type is not leniency, it is a different
 * password.
 *
 * Returns the profile so the caller has the role *and* the label without a
 * second lookup, and `null` for everything else - which is the ordinary case,
 * and must keep flowing to the real backend untouched.
 */
export function matchDemoProfile(eposta: string, parola: string): DemoProfile | null {
  if (typeof eposta !== "string" || typeof parola !== "string") return null;
  const address = normalizeDemoEmail(eposta);
  if (address === "" || parola === "") return null;
  return (
    DEMO_PROFILES.find(
      (profile) => normalizeDemoEmail(profile.email) === address && profile.password === parola,
    ) ?? null
  );
}

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
