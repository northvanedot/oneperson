# One Person

A game about proving you are one person without saying who you are — and about
where that proof stops working. You play the attacker.

**Play it → https://oneperson.dev-dot.li** (published as `oneperson.dot` on the
Polkadot Products Devnet)

It runs on a dated snapshot of **275 real ring VRF public keys**, read from the Paseo
People chain and committed to this repo. No chain access at runtime, no endpoints, nothing
to rot. Seven rounds, about ten minutes.

The point of it: the cryptography can prove one key and one action per context. It can
never prove one human. Every uniqueness gate ends in somebody asserting it, and the game
is built to make you find that out by breaking it rather than by being told.

```bash
npm install
npm run build && npm run preview      # http://localhost:4175
```

## How it plays

You are **Mallory**. Alice, Bob and Carol are honest members of the ring. One round is on
screen at a time; the next appears when the current one is done.

| Round | What happens | What it shows |
|---|---|---|
| 1 | Try three ways to run a vote | Account: uniqueness without anonymity. Fresh keys: anonymity without uniqueness. Ring VRF: all three |
| 2 | **The two words, and a slider** | *Ring* — the set of everyone who could have signed, which is exactly how big your hiding place is. *VRF* — an output that looks random, is identical every time for a given key and input, and can be proved correct without revealing the key. Then drag the ring from 275 down to 1 and watch anonymity collapse |
| 3 | Alice, Bob, Carol and Mallory vote | Four faces, four tokens, none attributable |
| 4 | Mallory votes again | The identical token. Not detected — *the same* |
| 5 | Mallory votes in another context, **then binds both to one account** | Unrelated tokens, nothing links them — and then the player undoes that themselves. Structural, not cryptographic |
| 6 | Mallory registers three more times via the fee path | Three masked faces join the ring. Every proof valid |
| 7 | Require an attester instead | Blocked — but this is an attester's claim, not mathematics |
| Sandbox | Set the registration rule yourself | Every gate still has a "how it breaks" column |

**Round 6 is the payload:** the cryptography worked perfectly and the attack still
succeeded, because sybil resistance was never in the proof. It is in the registration gate.
Rounds 6, 7 and the sandbox are one continuous argument about registration.

**The ring-size slider is the most transferable thing here**, and one of the few properties
that is genuinely real rather than simulated — the anonymity set is simply how many members
there are, and it behaves identically in the real construction. At 275, "one of these
signed" tells an observer nothing. At 3 it tells them a great deal. At 1 the ring draws a
single dot, still captioned *one of these signed*, and the readout says the observer knows
exactly who it was.

## Design notes

A few decisions that are easy to get wrong, written down because they were not obvious:

**The alias token carries most of the teaching.** It is a small drawn shape derived from
(person, context). Same person and context always draws the identical token; a different
context draws one with no visual relationship to it. The player sees the duplicate get
caught in round 4, and sees that two aliases cannot be matched in round 5, without reading
a word or comparing a hex string.

**When a proof verifies, the whole ring lights — not one member.** Lighting one would draw
the opposite of what a ring signature does.

**The captured 275 is never conflated with members the page invents.** The scoreboard shows
the total with a breakdown beneath it — *275 real + 7 played here* — and the ring diagram
derives its "and N more" from what is actually drawn rather than a constant. A number
advertised as real snapshot data must not quietly absorb simulated members, in an app whose
whole subject is claims meaning no more than they should.

**Round 1's votes are thrown away** and the scoreboard stays hidden until round 2. Counters
sitting at zero while the player clicks read as broken.

## Honesty about the cryptography

Real Bandersnatch ring VRF in a browser needs a library far outside this project's
dependency budget, so parts are simulated. The app says so itself — one line at the top,
the full four rows behind an expander, and then **each specific caveat repeated inline where
its claim is made**: the anonymity caveat beside the anonymity claim in round 1, the alias
caveat beside the tokens in round 3. A wall of disclosure before the player has seen why it
matters is a wall nobody reads.

| | |
|---|---|
| **Real** | The 275 ring VRF public keys — read from `PeopleLite.LitePeople` on Paseo People at block 6488033 on 2026-09-05 |
| **Real** | The ring root and membership proofs — a genuine SHA-256 Merkle tree. Verification from the 32-byte root alone is not simulated |
| **Simulated** | **Anonymity.** A Merkle proof names the leaf it proves. Real ring VRF proves *some member of this ring signed* without revealing which — a Merkle tree cannot do that. The property is arranged by construction here, not proved |
| **Simulated** | **The alias.** Real aliases are VRF outputs carrying a proof, unforgeable without the secret key. Ours is `SHA-256(secret ‖ context)`, which reproduces every property the game turns on but proves nothing on its own |

The Merkle tree promotes an odd node rather than duplicating it, avoiding the
CVE-2012-2459 shape where two different member lists yield one root. It costs nothing, and
a teaching tool should not teach the broken version.

## The snapshot

`data/ring-snapshot.json` — 275 real keys, captured once and committed.

| | |
|---|---|
| Chain | Paseo People |
| Block | 6488033 |
| Captured | 2026-09-05 |
| Members | 275, all `UniqueDevice`, none `Fee` |
| Encoding | base64 of the concatenated raw 32-byte keys |

Accounts are deliberately omitted — only the keys and the registration-method counts.
Because nothing is read at runtime, the page keeps working after a devnet state wipe, which
a live-reading app would not.

That every member came through the attested path is the game's closing fact: round 6's hole
is live code that nobody has walked through.

## Where the claims come from

The registration paths, the alias derivation and the `AccountToAlias` structure are read
from `paritytech/individuality-community` — `pallets/people-lite`, `pallets/alias-accounts`
and `precompiles/personhood`. `register_with_fee` takes a payment and a proof of key
ownership and checks nothing about a person.

## Constraints

Plain HTML/CSS/JS, no framework. **Zero runtime dependencies** — hashing is Web Crypto,
which the browser already has. Vite is a build-time devDependency only. Read-only, no chain
access at runtime, and no links off the app.

Devnet only. Tokens have no value and state may be reset. The underlying protocol is an
unaudited prototype.

## Licence

MIT.
