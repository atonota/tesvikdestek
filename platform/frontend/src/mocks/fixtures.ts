/**
 * Test fixtures - which are, deliberately, the demo data itself.
 *
 * These rows were always "the actual shapes and values the seeded catalogue
 * returns today", and the one-click demo needs exactly that. Keeping a second
 * copy here would have produced two catalogues free to drift, and the first
 * symptom of the drift would have been a test suite passing against rows the
 * demo no longer shows.
 *
 * So the canonical copy moved to `@/demo/data` - a production-named module, in
 * the production graph - and this file re-exports it. The direction matters and
 * is enforced by `demo-login.test.tsx`: production code may never import
 * `@/mocks`, but test code importing `@/demo` is ordinary.
 */

export {
  decisionFixtures,
  programFixtures,
  readinessFixture,
  snapshotFixtures,
} from "@/demo/data";
