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

/**
 * Was a demo deliberately ended in *this* document?
 *
 * The static publication rebuilds a demo from `?demo=<rol>` in the address, and
 * that raises one question immediately: after pressing Çıkış, does going back
 * to the address the visitor just left walk straight back in? It must not - a
 * button labelled "Çıkış" that the Back button undoes is not an exit.
 *
 * So leaving latches this, and `app.tsx` refuses to rebuild a demo from the
 * address while it is set. The latch is a module variable for exactly the
 * reason the session itself is: it must not outlive the document. And that
 * lifetime is also the honest limit of the guarantee, stated rather than
 * glossed: a *reload* of a demo URL opens the demo again, because a reload is
 * a new document and a new document cannot tell "I just left this demo" from
 * "somebody sent me this link" without persisting something - and persisting
 * something is precisely what this module refuses to do. Inside one document,
 * where the fact is genuinely known, it is honoured.
 */
let endedHere = false;

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
  // Entering again is a deliberate act by the same visitor, so the exit latch
  // is released here rather than left to expire with the document.
  endedHere = false;
  emit();
  return current;
}

/**
 * Has a demo been ended in this document since it loaded?
 *
 * Read by the static publication's workspace gate, which will not rebuild a
 * demo from the address once the answer is yes. See `endedHere` above for what
 * this does and does not promise.
 */
export function wasDemoEndedHere(): boolean {
  return endedHere;
}

/**
 * Ends the demo. Idempotent, and called in three places that must all agree:
 * the shell's exit button, the manual login before it posts, and test teardown.
 */
export function endDemoSession(): void {
  if (current === null) return;
  current = null;
  // A demo genuinely ended here; the address must not walk back into it.
  endedHere = true;
  emit();
}

/**
 * Test teardown only: hand the next test a document that has never seen a demo.
 *
 * Module memory is the whole storage mechanism, so it outlives React's
 * `cleanup()` - `endDemoSession()` has always been called in teardown for that
 * reason. The exit latch has the same lifetime and therefore the same problem:
 * one test that presses Çıkış would otherwise leave every later test in the
 * file inside a document that "has already left a demo".
 *
 * Kept separate from `endDemoSession()` rather than folded into it with a flag,
 * because the two mean different things and only one of them is a product
 * behaviour. No production module calls this.
 */
export function resetDemoSessionState(): void {
  current = null;
  endedHere = false;
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
