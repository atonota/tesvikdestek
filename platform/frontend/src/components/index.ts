/**
 * The single import surface for the component system.
 *
 * Everything named in `registry.ts` is re-exported here, plus the product
 * surfaces that are not part of the 75-component system.
 */

export * from "./primitives";
export * from "./composites";
export * from "./patterns";
export * from "./shells";
export * from "./domain";
export * from "./templates";

/**
 * The data-grid system. Exported from the same barrel as everything else, but
 * deliberately not counted in the 75-component registry: it is one subsystem
 * with a stable public surface, not seventy-five more named parts.
 */
export * from "./data-grid";

/**
 * The adaptive enterprise shell and assistant, plus the form layer they use.
 *
 * Both are re-exported here rather than reached by their own path - unlike the
 * provider connection centre - because real routes render them, so their weight
 * is in the production bundle either way.
 */
export * from "./adaptive";
export * from "./forms";

export { ALL_COMPONENT_NAMES, COMPONENT_LEVELS, DOCUMENTED_STATES, LEVEL_TITLES } from "./registry";
export type { ComponentLevel } from "./registry";
