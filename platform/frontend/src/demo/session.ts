/**
 * The demo session: one module-level variable, and deliberately nothing else.
 *
 * Not zustand's `persist`, not a cookie, not a token. The reason is not taste.
 * A demo role written to `localStorage` survives the tab, survives the reviewer
 * handing the laptop back, and - the failure that actually matters - looks
 * exactly like a real session marker to anyone auditing the browser afterwards.
 * `truth-guard.test.ts` already bans storage across `src/`; this module is the
 * one that would have had the best excuse to ask for an exemption, so it takes
 * none. Close the tab and the demo is gone, which is the correct lifetime for
 * something the server never knew about.
 *
 * `useSyncExternalStore` rather than a React context: the session is read by
 * the login route, the shell and the query layer, and the query layer is not a
 * component. A context would force the non-component reader through a hook it
 * cannot call, and a second copy of the state is exactly how "the badge says
 * customer while the data is superadmin" happens.
 */

import { useSyncExternalStore } from "react";

import { demoProfile, type DemoProfile, type DemoRole } from "./profiles";

export interface DemoSession {
  readonly role: DemoRole;
  readonly profile: DemoProfile;
}

/** The entire storage mechanism. */
let current: DemoSession | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Readable from anywhere, component or not. */
export function getDemoSession(): DemoSession | null {
  return current;
}

export function isDemoSession(): boolean {
  return current !== null;
}

export function startDemoSession(role: DemoRole): DemoSession {
  current = { role, profile: demoProfile(role) };
  emit();
  return current;
}

/**
 * Ends the demo. Idempotent, and called in three places that must all agree:
 * the shell's exit button, the manual login before it posts, and test teardown.
 */
export function endDemoSession(): void {
  if (current === null) return;
  current = null;
  emit();
}

/** Subscribe a React tree to the session. */
export function useDemoSession(): DemoSession | null {
  return useSyncExternalStore(subscribe, getDemoSession, getDemoSession);
}

/**
 * A write refused because it would have claimed a server record.
 *
 * The demo has no backend, so a save has exactly two honest outcomes: refuse
 * it, or perform something genuinely local and say so. There is no third option
 * where the interface shows "kaydedildi" - that is the failure this product is
 * built around, and it would be worse in a demo than in production, because a
 * demo is where a buying decision gets made.
 */
export class DemoWriteRefusedError extends Error {
  constructor(readonly what: string) {
    super(
      `Demo oturumundasınız: "${what}" sunucuya kaydedilmez, bu yüzden yapılmadı. ` +
        `Gerçek bir kayıt için demodan çıkıp giriş yapın.`,
    );
    this.name = "DemoWriteRefusedError";
  }
}
