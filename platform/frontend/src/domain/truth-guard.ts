/**
 * The language this product is not allowed to use.
 *
 * The engine produces a four-valued *pre-assessment*. Any wording that implies
 * an institutional decision, an entitlement, or a sum of money the user will
 * receive is a lie the code must refuse to render. This guard runs both as a
 * unit test over the source tree and at runtime in development.
 */

export interface ForbiddenClaim {
  readonly pattern: string;
  readonly match: string;
  readonly why: string;
}

interface Rule {
  readonly id: string;
  readonly test: RegExp;
  readonly why: string;
}

/**
 * Turkish is agglutinative, so these match stems rather than whole words.
 * `İ`/`ı` casing is handled by lowercasing with the Turkish locale first.
 */
const RULES: readonly Rule[] = [
  {
    id: "approved",
    test: /onaylandı|onaylanmıştır|onay aldınız/u,
    why: "Kurum onayı ima eder; sistem yalnızca ön değerlendirme üretir.",
  },
  {
    id: "entitled",
    test: /hak kazan|hak ettiğiniz|hak edilmiş/u,
    why: "Hak doğduğunu ima eder; uygunluk hak değildir.",
  },
  {
    id: "award-amount",
    test: /alacağınız tutar|kazanacağınız tutar|size verilecek tutar/u,
    why: "Ödenecek tutar iddiası; sistem tutar hesaplamaz.",
  },
  {
    id: "guaranteed",
    // Sentence-final "garanti" is a promise. The bare noun is not: "garanti"
    // is also the name of a support instrument (guarantee) in the catalogue,
    // and banning the word outright would ban a real financial product.
    // Anchored to end-of-clause as well as punctuation, because the scan splits
    // on sentence terminators before matching.
    test: /garanti(?:dir|li)?\s*(?:[.!]|$)|garanti ediyoruz|garanti edilir|kesinlikle alırsınız|kesin destek/u,
    why: "Kesinlik iddiası; sonuç bağlayıcı değildir.",
  },
  {
    id: "granted",
    test: /destek verildi|destek sağlandı|başvurunuz kabul edildi/u,
    why: "Gerçekleşmiş bir kurum işlemi ima eder.",
  },
];

/**
 * "Kullanıcı onayı" is the one permitted use of the approval stem: it names the
 * user's own recorded note, never an institution's decision.
 */
const ALLOWED = /kullanıcı onayı/u;

/**
 * Denial cues.
 *
 * This product talks about the forbidden claims constantly - in order to say it
 * does *not* make them ("hak edilmiş tutar hesaplamaz", "'Onaylandı' diye bir
 * değer yoktur"). A guard that cannot tell an assertion from its denial would
 * force the product to stop explaining itself.
 *
 * Scope is one clause, so a denial elsewhere in the file does not excuse a
 * claim here. This is a linter and not a proof: a sentence that both claims and
 * denies would pass, which is why the outcome vocabulary is *also* pinned by an
 * exact-equality test.
 */
const NEGATION =
  /\bdeğil|\bdegil|\byok\b|yoktur|\basla\b|yasak|hiçbir|\bnever\b|\bno\b|ma[zy]\b|me[zy]\b|mıyor|miyor/u;

function clausesOf(text: string): string[] {
  return text.split(/[.!?;\n]/u);
}

export function findForbiddenClaims(text: string): ForbiddenClaim[] {
  const lowered = text.toLocaleLowerCase("tr");
  const claims: ForbiddenClaim[] = [];
  for (const rule of RULES) {
    for (const clause of clausesOf(lowered)) {
      const found = rule.test.exec(clause);
      if (!found) continue;
      // The sanctioned phrase, and any clause that denies the claim it names.
      if (rule.id === "approved" && ALLOWED.test(clause)) continue;
      if (NEGATION.test(clause)) continue;
      claims.push({ pattern: rule.id, match: found[0], why: rule.why });
      break;
    }
  }
  return claims;
}

export function assertNoForbiddenClaims(text: string, where: string): void {
  const claims = findForbiddenClaims(text);
  if (claims.length > 0) {
    throw new Error(
      `${where}: yasakli ifade -> ${claims.map((c) => `${c.pattern} (${c.match})`).join(", ")}`,
    );
  }
}
