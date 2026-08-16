/**
 * P1C token contract: `.tsx` source never spells a colour, it reads a token.
 *
 * A hex literal (`#RRGGBB`, `#RGB`, `#RRGGBBAA`, ...) anywhere in a `.tsx`
 * file is the thing this rule exists to catch - a component that hard-codes
 * a colour instead of reading `--dt-color-*` from `tokens.css` is exactly
 * the drift `design-system-contract.test.ts` cannot see, because nothing
 * about a hard-coded colour ever touches a stylesheet.
 *
 * There is no exception. `src/components/analytics/EChart.tsx` used to
 * carry one - a hex "fallback" argument mirroring the token it was reading,
 * for the moment before a canvas can resolve `getComputedStyle` - but a
 * fallback that repeats a token's value by hand is still a hex literal that
 * silently agrees with `tokens.css` today and silently disagrees with it the
 * day the token changes without this file being part of that edit. That
 * component now throws a named error instead when a token is missing, so
 * this rule flags every hex literal in every `.tsx` file, unconditionally.
 */

const HEX_LITERAL = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u;
const HEX_ANYWHERE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/u;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow raw hex colour literals in .tsx source; read a --dt-color-* token instead",
    },
    schema: [],
    messages: {
      noHex:
        "Doğrudan hex renk yasak ({{value}}). Bir --dt-color-* token'ı kullanın (bkz. src/design/tokens.css).",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!HEX_LITERAL.test(node.value)) return;
        context.report({ node, messageId: "noHex", data: { value: node.value } });
      },
      TemplateElement(node) {
        const raw = node.value.raw;
        const match = HEX_ANYWHERE.exec(raw);
        if (!match) return;
        context.report({ node, messageId: "noHex", data: { value: match[0] } });
      },
    };
  },
};

export default rule;
