/**
 * Which deployment this bundle is: the ordinary one, or the static demo.
 *
 * The application has exactly two shipping shapes and they differ in one fact
 * that no amount of client code can discover at runtime: whether there is a
 * server behind the origin.
 *
 *   - **the ordinary deployment.** Vite base `/uygulama/`, sitting behind the
 *     same origin as FastAPI. `POST /giris`, `POST /kayit` and `POST /cikis`
 *     all reach a real process. This is the default, and nothing below weakens
 *     it - the flag is opt-in and any value other than the exact string `true`
 *     leaves the backend in place.
 *   - **the GitHub Pages demo.** Built with `VITE_STATIC_DEMO_ONLY=true` and
 *     base `/tesvikdestek/uygulama/`, served by a file server. There is no
 *     FastAPI process. Every one of those three POSTs would 404.
 *
 * Why a build flag rather than a runtime probe: a probe is a request, and the
 * request it would make is the one there is no server to answer. "Ask the
 * backend whether there is a backend" fails slowly, once per visitor, and then
 * has to guess anyway. The build knows; the build says so.
 *
 * **Read at call time, never captured.** `isStaticDemoOnly()` is a function
 * rather than an exported constant so a test can exercise both deployments in
 * one process with `vi.stubEnv`. A module-level `const` would freeze whichever
 * value the first import saw, and the static-deployment tests would then be
 * silently asserting about the ordinary build - passing, and meaning nothing.
 * The cost is a property read per call, on a path that already does IO.
 */

/**
 * True only for the string `true`, and deliberately not for `"1"` or `"yes"`.
 *
 * The asymmetry is the point. Getting this wrong in the permissive direction
 * disables the backend in a deployment that has one - a real sign-in refused
 * offline, on the production login screen, because of a typo in an env var.
 * Getting it wrong in the strict direction merely publishes a Pages build that
 * behaves like the ordinary one, which its own contract test would catch. So
 * the comparison is exact and the default is "there is a server".
 */
export function isStaticDemoOnly(): boolean {
  return import.meta.env["VITE_STATIC_DEMO_ONLY"] === "true";
}

/**
 * What the visitor is told, in one sentence they can act on.
 *
 * Not "an error occurred". Nothing failed: the publication genuinely has no
 * backend, the form genuinely cannot work here, and the demo genuinely does.
 * Saying so is the difference between a screen that looks broken and a screen
 * that is honest about what it is.
 */
export const STATIC_DEMO_ONLY_MESSAGE =
  "Bu statik bir yayındır: arkasında sunucu yoktur, bu yüzden gerçek giriş ve kayıt burada " +
  "çalışmaz ve isteğiniz gönderilmedi. Yukarıdaki iki demo profilinden birini seçebilir ya da " +
  "kartlarda yazan demo e-posta ve parolayı bu forma yazabilirsiniz.";

/**
 * A request refused *before* it left, because there is nowhere for it to go.
 *
 * Thrown rather than returned so the refusal travels the mutation's ordinary
 * error path and lands in the same `role="alert"` a server failure would - one
 * error surface per screen, not two. `describeError` returns this message
 * verbatim: it is already written for the person reading it, and translating
 * it a second time could only make it vaguer.
 *
 * The alternative - letting the POST go and reporting the 404 - is the thing
 * this class exists to prevent. It would mean a static page collecting an
 * address and a password and dropping them, then blaming the network.
 */
export class StaticDemoOnlyError extends Error {
  constructor() {
    super(STATIC_DEMO_ONLY_MESSAGE);
    this.name = "StaticDemoOnlyError";
  }
}
