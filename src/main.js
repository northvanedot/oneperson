import {
  decodeKeys, buildRing, membershipProof, verifyMembership,
  newMember, contextAlias, toHex,
} from "./ring.js";
import { aliasToken, avatar, ringCircle } from "./visuals.js";
import snapshot from "../data/ring-snapshot.json";

// ── cast ────────────────────────────────────────────────────────────────────
//
// Named people rather than "you" and "everyone else". When Mallory registers
// three times the player watches three new faces join the ring wearing a mask
// only the player can see — the whole lesson of the fee-path round in one picture.

const CAST = {
  alice:   { name: "Alice",   initial: "A", color: "#3f7fd0" },
  bob:     { name: "Bob",     initial: "B", color: "#2f9e73" },
  carol:   { name: "Carol",   initial: "C", color: "#8464c8" },
  mallory: { name: "Mallory", initial: "M", color: "#c9533a" },
};
const CONTEXT = "vote-2026";

const state = {
  ring: null,
  baseKeys: [],
  people: {},
  votes: [],
  extraRingFaces: [],
  round: 1,
};

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) n.append(k?.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
// Player-supplied text reaches the DOM only through textContent — there is no
// string concatenation into innerHTML anywhere in this file.
const say = (cls, ...kids) => el("p", { className: cls }, ...kids);

/** A face with a caption. The caption is who the *player* knows it to be. */
function facePlate(person, caption, disguised = false) {
  return el("div", { className: "plate" },
    avatar({ ...person, disguised }),
    el("span", { className: "cap" }, caption ?? person.name));
}

/** An alias, drawn. */
function votePlate(bytes, caption, tone) {
  const d = el("div", { className: `plate${tone ? " " + tone : ""}` });
  d.append(aliasToken(bytes));
  d.append(el("span", { className: "cap" }, caption));
  return d;
}

const row = (...kids) => el("div", { className: "row" }, ...kids);

// ── mechanics ───────────────────────────────────────────────────────────────

async function rebuildRing() {
  const extra = Object.values(state.people).map((p) => p.key);
  state.ring = await buildRing([...state.baseKeys, ...extra]);
  $("sbRing").textContent = String(state.ring.size);
  // Never let the captured 275 silently become 279. The real count and the
  // members this page invents are shown as separate quantities.
  $("sbRingNote").textContent = extra.length
    ? `${snapshot.memberCount} real + ${extra.length} played here`
    : `${snapshot.memberCount} real, captured`;
}

async function join(id) {
  if (state.people[id]) return state.people[id];
  const m = await newMember();
  m.index = state.baseKeys.length + Object.keys(state.people).length;
  state.people[id] = m;
  await rebuildRing();
  return m;
}

async function vote(id, context) {
  const m = await join(id);
  const alias = await contextAlias(m.secret, context);
  const path = membershipProof(state.ring, m.index);
  const valid = await verifyMembership(m.key, path, state.ring.root);
  const dup = state.votes.some((v) => v.context === context && toHex(v.alias) === toHex(alias));
  if (!dup) { state.votes.push({ alias, context, who: id, valid }); score(); }
  return { alias, dup, valid };
}

function score() {
  const inCtx = state.votes.filter((v) => v.context === CONTEXT);
  $("sbVotes").textContent = String(inCtx.length);
  $("sbPeople").textContent = String(new Set(
    inCtx.map((v) => (v.who.startsWith("mallory") ? "mallory" : v.who))).size);
  $("sbValid").textContent = `${state.votes.filter((v) => v.valid).length} / ${state.votes.length}`;
}

// ── caveats, placed where the claim is made ─────────────────────────────────

const caveat = (text) => el("p", { className: "caveat" }, text);

const CAVEAT_ANON =
  "Simulated: this page arranges anonymity by construction. Real ring VRF proves it — the " +
  "Merkle proof actually running here would name the signer.";
const CAVEAT_ALIAS =
  "Simulated: a real alias is a VRF output carrying a proof. This one is a hash of the " +
  "secret and the context — same behaviour, no proof.";

// ── rounds ──────────────────────────────────────────────────────────────────

const rounds = [
  {
    n: 1,
    setup: "Three ways to run a vote. Try each and see what it costs.",
    build(body, done) {
      // Round 1 is a warm-up: the votes here are thrown away, which is why the
      // scoreboard stays hidden until round 2. Counters that ignore the player
      // read as broken.
      body.append(say("small", "Nothing here is counted — the run starts in round 2."));
      const stage = el("div", { className: "stage" });
      const takeaway = el("div");
      const tried = new Set();

      const pick = (id, label, render) => el("button", { className: "ghost", onclick: async (e) => {
        tried.add(id);
        stage.replaceChildren();
        await render(stage);
        if (tried.size === 3) {
          takeaway.replaceChildren(say("take",
            "Only the third gives all three at once. That is what the complexity buys."));
          done();
        }
      } }, label);

      body.append(
        el("div", { className: "choices" },
          pick("acct", "Sign with your account", async (s) => {
            const m = await newMember();
            const a = await contextAlias(m.secret, "demo-account");
            s.append(
              row(facePlate(CAST.mallory, "Mallory"), el("span", { className: "arrow" }, "→"),
                  votePlate(a, "voted Yes", "bad")),
              say("verdict bad", "Counted once — but everyone can see it was Mallory."));
          }),
          pick("fresh", "A fresh key each time", async (s) => {
            const toks = [];
            for (let i = 0; i < 5; i++) {
              const m = await newMember();
              toks.push(votePlate(await contextAlias(m.secret, "demo-fresh"), `vote ${i + 1}`, "bad"));
            }
            s.append(row(facePlate(CAST.mallory, "Mallory"), el("span", { className: "arrow" }, "→"), ...toks),
              say("verdict bad", "Nobody knows who — and nobody stopped her at five."));
          }),
          pick("ring", "Ring VRF", async (s) => {
            const m = await newMember();
            const a = await contextAlias(m.secret, "demo-ring");
            const again = await contextAlias(m.secret, "demo-ring");
            s.append(
              ringCircle([CAST.alice, CAST.bob, CAST.carol, CAST.mallory], state.ring.size, { lit: true }),
              row(votePlate(a, "her vote"), el("span", { className: "arrow" }, "again →"),
                  votePlate(again, "the same token", "bad")),
              say("verdict ok", "Unknown which member, and a second vote is the same token."),
              caveat(CAVEAT_ANON));
          }),
        ),
        stage, takeaway,
      );
    },
  },

  {
    n: 2,
    setup: "Two words, now that you have seen what they do.",
    build(body, done) {
      const ringBox = el("div", { className: "stage" });
      const readout = el("div", { className: "readout" });
      const slider = el("input", {
        type: "range", min: 1, max: 275, value: 275, className: "sizer",
      });

      // Anonymous members: identical grey dots. Telling them apart would defeat
      // the thing this control exists to show.
      const filler = (n) => Array.from({ length: Math.min(n, 12) },
        () => ({ initial: "", color: "#8a8a80" }));

      function draw() {
        const n = Number(slider.value);
        ringBox.replaceChildren(ringCircle(filler(n), n, { lit: true }));
        const pct = (100 / n).toFixed(n >= 100 ? 1 : 0);
        readout.replaceChildren(
          el("p", { className: "big-read" },
            n === 1
              ? "An observer knows exactly who signed."
              : `An observer knows the signer is one of ${n}.`),
          el("p", { className: n <= 3 ? "verdict bad" : n <= 20 ? "verdict warn" : "verdict ok" },
            n === 1 ? "A ring of one hides nobody. They know exactly who signed."
            : n <= 3 ? `A 1 in ${n} guess — that is ${pct}%. Barely hidden at all.`
            : n <= 20 ? `1 in ${n}, about ${pct}%. Narrow enough to be worth guessing.`
            : `1 in ${n}, about ${pct}%. Effectively nothing.`),
        );
      }
      slider.oninput = draw;
      slider.onchange = done;
      draw();

      body.append(
        el("dl", { className: "defs" },
          el("dt", {}, "Ring"),
          el("dd", {}, "The set of everyone who could have signed. It is your hiding place, " +
            "and its size is exactly how well you are hidden."),
          el("dt", {}, "VRF"),
          el("dd", {}, "Verifiable random function. An output that looks random, is the same " +
            "every time for a given key and input, and can be proved correct without revealing " +
            "the key. That is precisely what the tokens do."),
        ),
        el("p", { className: "small" }, "Drag the ring smaller and watch the hiding place go."),
        row(el("span", { className: "small" }, "1"), slider,
            el("span", { className: "small" }, String(snapshot.memberCount))),
        ringBox, readout,
        caveat("Ring size is one of the properties that is genuinely real here — the anonymity " +
          "set is just how many members there are, and it works the same way in the real thing."),
      );
    },
  },

  {
    n: 3,
    setup: `Alice, Bob and Carol vote in ${CONTEXT}. Then Mallory does.`,
    build(body, done) {
      const stage = el("div", { className: "stage" });
      body.append(
        el("button", { onclick: async (e) => {
          e.target.disabled = true;
          const toks = [];
          for (const who of ["alice", "bob", "carol", "mallory"]) {
            const r = await vote(who, CONTEXT);
            toks.push(votePlate(r.alias, "?"));
          }
          toks.sort(() => Math.random() - 0.5);
          stage.replaceChildren(
            row(facePlate(CAST.alice), facePlate(CAST.bob), facePlate(CAST.carol), facePlate(CAST.mallory)),
            el("p", { className: "arrow-down" }, "↓"),
            row(...toks),
            say("take", "Four people, four tokens, and the tally cannot say which is whose."),
            caveat(CAVEAT_ALIAS));
          done();
        } }, "Everyone votes"),
        stage,
      );
    },
  },

  {
    n: 4,
    setup: "Mallory votes a second time, same context.",
    build(body, done) {
      const stage = el("div", { className: "stage" });
      body.append(
        el("button", { onclick: async (e) => {
          e.target.disabled = true;
          const first = state.votes.find((v) => v.who === "mallory" && v.context === CONTEXT);
          const r = await vote("mallory", CONTEXT);
          stage.replaceChildren(
            row(votePlate(first.alias, "her first vote"), el("span", { className: "arrow" }, "vs"),
                votePlate(r.alias, "her second", "bad")),
            say("verdict bad", "The same token. There is no second vote to count."),
            say("take", "Not detected — identical. Voting twice in one context is arithmetically impossible."));
          done();
        } }, "Vote again"),
        stage,
      );
    },
  },

  {
    n: 5,
    setup: "So Mallory votes somewhere else instead.",
    build(body, done) {
      const stage = el("div", { className: "stage" });
      const input = el("input", { value: "poll-b", spellcheck: false, className: "ctx" });
      const second = el("div");
      body.append(
        row(input, el("button", { onclick: async (e) => {
          e.target.disabled = true;
          input.disabled = true;
          const ctx = input.value.trim() || "poll-b";
          const first = state.votes.find((v) => v.who === "mallory" && v.context === CONTEXT);
          const r = await vote("mallory", ctx);
          stage.replaceChildren(
            row(votePlate(first.alias, CONTEXT), el("span", { className: "arrow" }, "vs"),
                votePlate(r.alias, ctx, "ok")),
            say("verdict ok", "Both counted. Nothing connects them."),
            say("take", "Same person, unrelated tokens. This is the design working, not failing."));
          // The undo belongs here, not three rounds later: it is this lesson
          // being taken back, and it lands while the two tokens are still on
          // screen to be joined up.
          second.replaceChildren(
            say("small", "Unless Mallory attaches both to the same account."),
            el("button", { onclick: async (ev) => {
              ev.target.disabled = true;
              stage.append(
                el("hr", { className: "rule" }),
                row(votePlate(first.alias, CONTEXT),
                    facePlate(CAST.mallory, "one account"),
                    votePlate(r.alias, ctx)),
                say("verdict bad", "AccountToAlias is public and holds one alias per account."),
                say("take", "The unlinkability you just watched, gone. Structural, not " +
                  "cryptographic — the aliases never linked, the account did."));
              done();
            } }, "Bind both to one account"));
        } }, "Vote there too")),
        stage, second,
      );
    },
  },

  {
    n: 6,
    id: "fee",
    setup: "Mallory stops attacking the proof and registers three more times instead.",
    build(body, done) {
      const stage = el("div", { className: "stage" });
      body.append(
        say("small",
          "register_with_fee takes a payment and a proof she owns the key. It checks nothing about a person."),
        el("button", { onclick: async (e) => {
          e.target.disabled = true;
          const toks = [];
          for (let i = 1; i <= 3; i++) {
            const r = await vote(`mallory${i}`, CONTEXT);
            state.extraRingFaces.push({ ...CAST.mallory, disguised: true });
            toks.push(votePlate(r.alias, "a stranger", "bad"));
          }
          const inCtx = state.votes.filter((v) => v.context === CONTEXT);
          const hers = inCtx.filter((v) => v.who.startsWith("mallory")).length;
          stage.replaceChildren(
            ringCircle([CAST.alice, CAST.bob, CAST.carol, CAST.mallory],
              state.ring.size, { extra: state.extraRingFaces }),
            say("small", "You can see the masks. The chain sees three new members."),
            row(...toks),
            el("div", { className: "verdict bad big" },
              `Mallory holds ${hers} of the ${inCtx.length} votes. Every proof is valid.`),
            say("take", "Nothing broke. Sybil resistance was never in the proof — it is in the registration gate."));
          done();
        } }, "Register three times, then vote with each"),
        stage,
      );
    },
  },

  {
    n: 7,
    setup: "Close that door: require an attester instead of a fee.",
    build(body, done) {
      const stage = el("div", { className: "stage" });
      body.append(
        el("button", { onclick: (e) => {
          e.target.disabled = true;
          stage.replaceChildren(
            row(facePlate(CAST.mallory, "Mallory"), el("span", { className: "arrow" }, "→"),
                el("div", { className: "blocked" }, "no attestation allowance")),
            say("verdict ok", "Blocked. She cannot vouch for herself."),
            say("take", "But this is an attester's claim, not mathematics. Corrupt them and it runs again — the trust moved, it did not vanish."));
          done();
        } }, "Try it under attestation"),
        stage,
      );
    },
  },

];

/** Which round is the fee-path attack, looked up rather than remembered. */
const FEE_ROUND = rounds.find((r) => r.id === "fee").n;

// ── sandbox ─────────────────────────────────────────────────────────────────

const GATES = [
  { id: "fee", name: "Fee only", sub: "cheap, open", trust: "Nobody",
    breaks: `Pay it n times. This is round ${FEE_ROUND}.` },
  { id: "one", name: "One attester", sub: "cheap, fast", trust: "One party, and whoever appoints them",
    breaks: "Corrupt or compel one party." },
  { id: "many", name: "Threshold", sub: "slower", trust: "A quorum, and whoever picks it",
    breaks: "Collusion — and a cartel is the shape that forms." },
  { id: "bio", name: "Biometric", sub: "costly, hardware", trust: "The vendor holding the templates",
    breaks: "Spoofing, exclusion, and now a biometric database exists." },
  { id: "person", name: "In person", sub: "slow, expensive", trust: "The people running the room",
    breaks: "Does not scale; excludes anyone who cannot attend." },
];

function buildSandbox(body) {
  const out = el("div");
  const chosen = new Set();
  const choices = el("div", { className: "choices" });
  for (const g of GATES) {
    const b = el("button", { className: "choice", type: "button" },
      el("b", {}, g.name), el("span", {}, g.sub));
    b.setAttribute("aria-pressed", "false");
    b.onclick = () => {
      chosen.has(g.id) ? chosen.delete(g.id) : chosen.add(g.id);
      b.setAttribute("aria-pressed", String(chosen.has(g.id)));
      render();
    };
    choices.append(b);
  }
  function render() {
    if (!chosen.size) { out.replaceChildren(say("small", "Pick a gate.")); return; }
    const t = el("table");
    t.innerHTML = "<thead><tr><th>Gate</th><th>You must trust</th><th>How it breaks</th></tr></thead>";
    const tb = el("tbody");
    for (const g of GATES.filter((x) => chosen.has(x.id))) {
      const tr = el("tr");
      tr.append(el("td", {}, g.name), el("td", {}, g.trust), el("td", {}, g.breaks));
      tb.append(tr);
    }
    t.append(tb);
    out.replaceChildren(t, say("take", "Every row still has a last column. No combination empties it."));
  }
  render();
  body.append(choices, out);
}

// ── shell: one round at a time ──────────────────────────────────────────────

function showRound(n) {
  const r = rounds.find((x) => x.n === n);
  if (!r) return finish();
  // The scoreboard appears with the first round whose votes actually count.
  if (n >= 2) $("scoreboard").classList.remove("hidden");
  const sec = el("section", { className: "round" },
    el("p", { className: "round-no" }, `Round ${n} of ${rounds.length}`),
    say("setup", r.setup));
  const body = el("div", { className: "body" });
  let advanced = false;
  r.build(body, () => {
    if (advanced) return;
    advanced = true;
    const next = el("button", { className: "next", onclick: (e) => {
      e.target.remove();
      showRound(n + 1);
    } }, n === rounds.length ? "Now you write the rules →" : "Next →");
    sec.append(next);
  });
  sec.append(body);
  $("rounds").append(sec);
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

function finish() {
  const sec = el("section", { className: "round" },
    el("p", { className: "round-no" }, "Sandbox"),
    say("setup", "Set the registration rule yourself. Try to make it unbreakable."));
  const body = el("div", { className: "body" });
  buildSandbox(body);
  body.append(
    el("p", { className: "closing" },
      "The mathematics can prove one key, and one action per context. It can never prove one human."),
    say("small",
      `Every uniqueness gate ends with somebody asserting it. In the captured ring all ` +
      `${snapshot.memberCount} people came through attestation — none through the fee path. ` +
      `Round ${FEE_ROUND} is live code nobody has walked through.`));
  sec.append(body);
  $("rounds").append(sec);
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── boot ────────────────────────────────────────────────────────────────────

(async function start() {
  state.baseKeys = decodeKeys(snapshot.keys);
  await rebuildRing();
  $("snapshotLine").textContent =
    `${snapshot.memberCount} real keys · ${snapshot.chain} block ${snapshot.block} · captured ${snapshot.capturedAt}`;
  score();
  showRound(1);
})();
