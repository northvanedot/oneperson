// The cryptography behind the game.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS REAL HERE AND WHAT IS NOT. This matters more than anything else in
// this file, and the interface says the same thing where players will see it.
//
// REAL:
//   · The 275 ring VRF public keys. Read from the Paseo People chain on the
//     date in data/ring-snapshot.json. Not invented, not sampled.
//   · The ring root and membership proofs. A genuine SHA-256 Merkle tree. A
//     verifier really can check membership holding nothing but the 32-byte
//     root — that is not a simulation, and you can watch it happen.
//
// SIMULATED:
//   · Anonymity. A Merkle proof names the leaf it proves. Real Bandersnatch
//     ring VRF proves "some member of this ring signed" WITHOUT revealing
//     which — that is the entire point of a ring signature and the one thing a
//     Merkle tree cannot do. We show the property by construction instead of
//     by mathematics.
//   · The alias. Real aliases are VRF outputs over the context, unforgeable
//     without the secret key and unlinkable across contexts. Ours is
//     SHA-256(secret ‖ context), which reproduces the properties the game
//     turns on — same key and context always give the same alias, different
//     contexts give unrelated ones, and you cannot get there without the
//     secret — but it is a hash, not a VRF, and carries no proof.
//
// Real ring VRF in a browser needs a Bandersnatch implementation, which is far
// outside this project's dependency budget. The honest move is to simulate and
// say so, not to imply cryptography we did not do.
// ─────────────────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

/** Web Crypto, so the hashing is genuine and the dependency count stays zero. */
async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const fromHex = (hex) =>
  Uint8Array.from(hex.replace(/^0x/, "").match(/../g).map((b) => parseInt(b, 16)));

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** Decode the snapshot's base64 blob back into 32-byte keys. */
export function decodeKeys(base64) {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const keys = [];
  for (let i = 0; i + 32 <= raw.length; i += 32) keys.push(raw.slice(i, i + 32));
  return keys;
}

// ── the ring ────────────────────────────────────────────────────────────────

/**
 * Build a Merkle tree over the member keys.
 *
 * An odd node at any level is promoted rather than duplicated. Duplicating the
 * last leaf is the classic CVE-2012-2459 shape, where two different member
 * lists produce the same root. It costs nothing to avoid and this is a teaching
 * tool, so it should not teach the broken version.
 */
export async function buildRing(keys) {
  if (!keys.length) throw new Error("a ring needs at least one member");
  const leaves = await Promise.all(keys.map((k) => sha256(concat(enc.encode("leaf:"), k))));
  const levels = [leaves];
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(
        i + 1 < level.length
          ? await sha256(concat(enc.encode("node:"), level[i], level[i + 1]))
          : level[i],
      );
    }
    levels.push(next);
    level = next;
  }
  return { root: level[0], levels, size: keys.length };
}

/** The sibling path proving `index` is in the ring. */
export function membershipProof(ring, index) {
  const path = [];
  let i = index;
  for (let d = 0; d < ring.levels.length - 1; d++) {
    const level = ring.levels[d];
    const sibling = i % 2 === 0 ? i + 1 : i - 1;
    // A promoted odd node has no sibling at this level; it just moves up.
    if (sibling < level.length) path.push({ hash: level[sibling], right: i % 2 === 0 });
    i = Math.floor(i / 2);
  }
  return path;
}

/**
 * Verify membership from the root alone.
 *
 * Note what this function does *not* receive: the member list, the ring size,
 * any chain connection. Thirty-two bytes and a path. That is the property that
 * makes it conceivable for another chain to consume Polkadot's people set — it
 * needs the root, not the people.
 */
export async function verifyMembership(key, path, root) {
  let node = await sha256(concat(enc.encode("leaf:"), key));
  for (const step of path) {
    node = step.right
      ? await sha256(concat(enc.encode("node:"), node, step.hash))
      : await sha256(concat(enc.encode("node:"), step.hash, node));
  }
  return toHex(node) === toHex(root);
}

// ── identity ────────────────────────────────────────────────────────────────

/** A fresh member. The secret never leaves the page; there is no server. */
export async function newMember() {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  return { secret, key: await sha256(concat(enc.encode("key:"), secret)) };
}

/**
 * The contextual alias.
 *
 * Deterministic in (secret, context). That single fact drives the whole game:
 * voting twice in one context always lands on the same alias, so a double vote
 * is not "detected" — it is arithmetically the same act. Change the context and
 * the output is unrelated, so nothing links your two votes.
 *
 * Simulated: a real alias is a VRF output carrying a proof. This is a hash.
 */
export async function contextAlias(secret, context) {
  return await sha256(concat(enc.encode("alias:"), secret, enc.encode("|" + context)));
}

/** Short display form. Aliases are compared by eye a lot in this game. */
export const short = (bytes, n = 8) => toHex(bytes).slice(0, n);
