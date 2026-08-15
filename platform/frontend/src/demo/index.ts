/**
 * The demo surface, in one place.
 *
 * A permanent feature with a defined end: it stays until the owner removes it
 * after the enterprise frontend and customer review. Everything it needs lives
 * under this directory, so removing it is deleting one folder and the handful
 * of call sites that import from here - not archaeology across the codebase.
 */

export * from "./data";
export * from "./deployment";
export * from "./profiles";
export * from "./session";
