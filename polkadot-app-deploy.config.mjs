/**
 * Product manifest. `pad` finds this by walking up from the build dir and writes
 * two on-chain records on deploy:
 *
 *   manifest    → oneperson.dot       displayName, description, icon CID
 *   executable  → app.oneperson.dot   kind + appVersion (subname auto-registered)
 *
 * These are what dotmetrics counts as "published" on its
 * name-only → deployed → published ladder. Unrelated to `Publisher.publish` /
 * the Browse registry, which reverts NoPersonhood.
 * Budget is 1024 bytes per text record.
 *
 * The icon is one of those manifest fields, not a decoration: deploying without
 * it leaves the app a rung short of "published", which is how the first attempt
 * here failed ("product config icon must be an object").
 *
 * Deliberately plain — no `defineConfig` import. That helper is only for editor
 * IntelliSense, and its own docs cite `@parity/polkadot-app-deploy` while the
 * installed package is `@polkadot-community-foundation/...`. Not worth the
 * resolution risk for a type hint.
 */
export default {
  domain: "oneperson.dot",
  displayName: "One Person",
  description:
    "A game about proving you are one person without saying who you are, and where that proof stops working. You play the attacker. Built on a dated snapshot of 275 real ring VRF keys — no chain reads, nothing to rot.",
  // Drawn by the game's own token rules and seeded by the ring root of the
  // committed snapshot — the real 32-byte root of the 275 keys this app ships.
  // Generated once by hand-rolled PNG (node's zlib and sha256, no image
  // dependency) and committed.
  icon: {
    path: "icon.png",
    format: "png",
  },
  executables: [{ kind: "app", path: "dist", appVersion: [1, 0, 0] }],
};
