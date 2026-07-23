# Cantilune, for the Curious (no math required)

| Field | Value |
|---|---|
| Status | **Draft** — intuitive companion, not a normative document |
| Audience | Readers who want to understand *what* cantilune is and *why* before any formal notation |
| Paired with | the formal spec `docs/spec/formal-semantics.md` and RFC-0001 |

> **A note on rigor.** This primer is deliberately notation-light. But "easy to read" is not the same as "loose with the truth." Every claim here has a precise version in the spec, and the same honesty rules apply: three of cantilune's four pillars are solid *by construction*, the fourth (agent communication) is something we still have to **earn** and have not yet proven, and the whole framework is **unverified** until the proofs are written and reviewed. If a sentence here feels too good to be true, the spec will tell you exactly how good it actually is.

---

## 1. The feeling everyone has

If you have used the current batch of agent tools, you have probably felt the same thing the cantilune project started from: they work, sort of, until they don't — and when they don't, it is hard to say *why*. A run gets stuck. A step happens "too early." Two agents seem to disagree about what was decided. You replay a run and the replay shows something subtly different from what you remember. None of these are bugs in the usual sense; they are the symptom of a deeper thing.

The deeper thing is this: in these tools, **the shape of the work and the running of the work are described in two different languages that nobody connects.** The shape is a graph you draw, or a config file you write. The running is scheduler code that someone wrote that week. Those two things are *supposed* to describe the same thing, but there is nothing forcing them to agree. So over time, they drift — the graph says one thing, the code does another, and "what actually happened" becomes a matter of opinion. Every guarantee you'd want ("it won't deadlock," "you can replay it," "you can audit it") has to be argued by hand, fresh, each time, against code that keeps changing.

This is why the tools end up the way they are: some freeze the shape into one rigid mold so nothing can drift (Cursor's fixed plan→subagent→loop); some give up on the shape and let the model improvise, which is flexible but uncontrollable (Codex); some wedge the gap open with a thick layer of prompts and rules that nobody fully understands (Claude Code); some just accumulate code until the weight of it stalls everything (OpenClaw-family). Each is a different way of *coping* with the missing connection between shape and running.

cantilune's premise: **stop coping with the missing connection; build the connection.**

## 2. The small realization that changes everything

Here is the observation that the whole project turns on. When you orchestrate work — any work, agent or not — you really only ever do two things to combine pieces:

- **Put two pieces side by side**, so they both happen (parallel).
- **Plug one piece's output into another piece's input**, so the second waits for the first (sequence).

That is it. Everything fancier — loops, branches, fan-out, fan-in, retries, handoffs — is built out of those two moves, the way every dish in a kitchen is built out of a small set of basic operations.

Now the interesting part: those two moves, "side by side" and "plug in," already come with a few obvious rules that everyone agrees on and nobody has to enforce — they are just true:

- If you do three things in sequence, it does not matter whether you think of it as "(A then B) then C" or "A then (B then C)" — the order is the same. (Sequence *associates*.)
- Doing nothing in the middle changes nothing. (There is a *do-nothing* that is a neutral unit.)
- If two things are truly side by side and independent, you can swap their left-right order without changing what happens. (Parallel independent work *commutes*.)

Mathematicians have a name for a place where exactly these two moves and these three rules live: a **symmetric monoidal category** (SMC). That is a intimidating name for a very friendly idea. It just means: "a world with two ways of combining things — side-by-side and plug-in — that behave sensibly." The two moves are the $\otimes$ (side-by-side) and $\circ$ (plug-in) you will see in the spec; the three rules are the axioms.

Here is the realization: **orchestration is already one of these.** We are not *choosing* to use an SMC as a tool for orchestration, the way you might choose Redis for caching. We are noticing that orchestration *already is* an SMC — the way a database *already is* relational algebra, whether or not you've ever heard the term. The $\otimes$ and $\circ$ are not symbols we imposed on the problem; they are the names for the two things you were already doing. This is the fulcrum of cantilune: if orchestration is an SMC, then its *running* should be a way of *stepping through that SMC* — not a second pile of scheduler code talking *about* it. One language, not two.

## 3. But a shape is not yet a running

An SMC, by itself, is a *shape*: it tells you which combinations are legal. It does not tell you how the shape *moves*. A recipe describes a dish, but you still have to cook it.

So cantilune adds a way for the shape to move: **rewriting**. The image to hold in your head is a flowchart drawn on a whiteboard, and "one step of execution" means "erase a small part of the drawing and replace it with a different small part, following a rule." You had a box that said "plan"; after one step, that box is gone and in its place is a box that says "plan done," with an arrow leading onward. That replacement — match a small pattern, swap it for another — is one execution step. A whole run is just a sequence of such swaps.

Why this way, and not a plain state machine? Because of what we need in the next section. We need *four different descriptions* of the same run to all agree on what each step was. If each description had its own independent state machine, "they agree" would be a never-ending argument. With rewriting, the run is *one* sequence of swaps, and the four descriptions are just four ways of reading the same swaps. Agreement becomes something you can prove, not something you hope for.

## 4. Four pairs of glasses on one thing

So we have one object — the SMC-with-rewriting — and we want to look at it four ways, because each way answers a different question a different person cares about:

- **The DAG view** answers *"what depends on what?"* — it shows the data flowing from output to input. This is the view a developer draws on the whiteboard.
- **The Petri view** answers *"what can run at the same time, and what is held up waiting for a resource?"* — it treats resources (an API quota, a human's attention, a context window) as things that get occupied and freed.
- **The π view** answers *"who is talking to whom?"* — it shows the channels between agents and the messages on them.
- **The morphism view** answers *"how do small pieces compose into big ones, and how do I swap one piece for an equivalent one?"* — it is the view for reuse and refactor.

The crucial claim — and the one that makes cantilune different from "four modules glued together" — is that these are **four readings of one thing**, not four things taped together. The analogy: one database can be described through relational algebra, through transactions, through storage layout, through concurrency — and they had better all describe the same database, or something is wrong. cantilune's four views had better all describe the same run.

That "had better" is where the project lives or dies, and we are honest about it: three of the four views are *straightforwardly* readings of the same object (the spec calls this "by construction"), but the communication view (π) is harder, because of a choice we made to let agents talk freely rather than by a fixed script. So the π view is something we still have to **prove** agrees with the others — we have not proven it yet, and if we cannot, we will honestly scale back what "free conversation" means rather than pretend. This single open question is important enough that it has its own document (RFC-0002) and is called, with some drama, the project's *life-line*.

### 4.1 Three things easy to misread (read this if "agree" feels vague)

The paragraph above packs a lot into the word "agree." It is worth slowing down, because this is exactly where "I sort of get it, but not really" lives.

**First: "agree" does not mean "look the same."** The four views describing the same run will, and should, say *different-looking* things about each step — the way a finance section reports "the stock rose 3%" and a tech section reports "the launch went ahead" about the *same* event. They do not need to match word-for-word; they need to refer to the same underlying fact. In cantilune the underlying fact is **one rewriting sequence** (§3), and each view is a *translation* of that sequence into its own language. "Agree" means: each view is translating the *same* step $n$ of the *same* sequence — not one view quietly describing step 5 while another describes step 6.

**Second: the opposite of "agree" is "four engines arguing forever," not "four slightly different printouts."** Suppose you did *not* build cantilune, but instead built four independent engines — a DAG engine, a Petri engine, a π engine, a morphism engine — each stepping on its own. Now you want to claim "they all describe the same run." But there is no shared sequence underneath; each engine is its own book. You can only write glue code asserting "when the DAG engine does X, the Petri engine should do Y." Glue is code; glue has bugs; timestamps drift by a second; and when something disagrees, there is **no higher authority** to settle it, because there is no "the fact itself," only four engines each telling its own story. *That* is the argument that never ends. cantilune avoids it by making the rewriting sequence the single fact, and the four views *translations* of it — so a disagreement is a localizable bug in one translation, not a philosophical dispute about which engine is right. One book, four translations — not four authors each writing a book and then reconciling.

**Third — and this is the one that matters for "why only π": a view can "invent a step" only if its translation is not yet trusted, and only π's translation is not yet trusted.** Here is the distinction that is easy to miss. *Every* view, in principle, faces a "is my translation faithful?" question — could the DAG view quietly turn one real step into two, or the Petri view collapse two steps into one? In principle, yes, for all four. The difference is **where the guarantee comes from**:

- For DAG, there is essentially no translation — the view *is* the graph you started with — so nothing can be invented.
- For the morphism view, the view *is* the object itself, so again nothing to invent.
- For the Petri view, there is a standing theorem in the mathematics literature ("Petri nets are a kind of monoidal category," Meseguer–Montanari, plus a known fix called *pre-nets*). The faithfulness of the Petri translation is *already proven by others*; cantilune just cites it.
- For the π view, **the translation does not come from a standing theorem**, because of our own choice. We chose *free conversation* (agents talk however they like at runtime) over a *fixed script* (agents follow a declared protocol). Had we chosen the fixed script, the π translation would *also* be a standing result — but we chose freedom, and the free version's natural semantics live in a heavier structure (a *presheaf*) that is not in the same mathematical family as our object. So cantilune has to **build a new bridge** from our object to that heavier structure, and **prove** the bridge is faithful.

So the honest, precise statement of "why only π" is: **all four views could in principle invent a step, but for three of them the no-inventing guarantee is already supplied by existing mathematics, while for π the guarantee must be supplied by a bridge we have to build and verify ourselves — and we have not verified it yet.** It is not that the π *theory* is special; it is that *we chose a freer version of it*, and that version needs a bridge that is not off-the-shelf. "Proving" the π view means proving that bridge is faithful — that a real rewriting step in our object genuinely corresponds to a real reduction step on the π side, not a pseudo-step the bridge fabricated. And we are only confident we can build that bridge for the "declared channels" part; for fully-free "open any channel at runtime," the bridge may not hold, in which case we honestly limit it.

### 4.2 A concrete run, four readings of one step

Suppose a run has three agents — **Planner, Coder, Reviewer** — with one resource constraint: Reviewer needs to occupy a single *human-approval slot* (only one task may hold a human's attention at a time). The run's rewriting sequence has three steps:

1. Planner produces a TaskPlan.
2. Coder takes the TaskPlan and produces Code.
3. Reviewer takes the Code, occupies the human-approval slot, and produces Feedback.

Now focus on **step 2 (Coder produces Code)** and see how the four views translate the *same* step:

- **DAG view:** the edge `planner→coder` was already satisfied; now the edge `coder→reviewer` carries the Code artifact, and that edge's contract flips from "pending" to "satisfied."
- **Petri view:** the "Code ready" place gains a token; meanwhile the "human-approval slot" place still has 0 tokens, so Reviewer's transition **cannot fire yet** — the resource is not free.
- **π view:** Coder sends a message `{Code}` on the channel `c_coder_to_reviewer`.
- **morphism view:** the morphism `f_code : TaskPlan → Code` is applied; TaskPlan is consumed, Code is produced.

These four sentences **look completely different** — "edge satisfied," "place has a token and the slot is empty," "message sent on a channel," "a morphism was applied." They do *not* need to look the same. They *agree* because all four are translating **step 2 of the one sequence**.

Contrast the four-independent-engines nightmare: the DAG engine logs `14:03:02 edge satisfied`; the Petri engine logs `14:03:03 place gained token`. Are these the same event? You cannot tell from inside either engine — you wrote glue to align them, the glue might be wrong, the timestamps differ by a second, and you have to guess. In cantilune, step 2 *is* the fact; the views are translations of it; if a view disagrees, that is a localizable translation bug, not a dispute about reality.

Now vary step 2 slightly to show "why π": suppose Coder does not just produce Code, but **opens a brand-new channel at runtime** to ask Planner a question — a "free conversation" move, where the channel did not exist when the run was authored.

- In the DAG, Petri, and morphism views, this is just "an extra edge / transition / morphism appeared" and the step proceeds — these views use *off-the-shelf* translations that are already proven faithful, so they cannot invent a step here.
- In the π view, the fact is "a channel was created at runtime and a message flowed on it." *This* is where a not-yet-trusted bridge could fabricate a pseudo-step: the π view might show a "channel creation + message" that does not correspond to any real rewriting step in the object — the bridge invented it. Proving the π view faithful is exactly preventing that. And we are only confident the bridge holds for declared-channel (request/accept) conversation; the fully-free "open any channel at runtime" may not be provable, in which case that freedom is deferred and we say so.

This is why the π view, alone, is 待证 — and why, even so, the other three views are not a free pass: they are a free pass *because existing mathematics already vouches for them*, not because the question does not arise.

## 5. What this actually buys you (the point)

If the four views really do agree, then a few things you normally have to build as separate products just *come for free*, because of the shape:

- **The trace is the run.** Since a run is a sequence of swaps, the trace *is* that sequence. You do not "add logging" and hope you logged enough; the run is the log.
- **Replay cannot drift.** In other tools, the replay engine and the real engine are two pieces of code, and over time they disagree. Here, replay is just running the same swaps again — there is no second engine to drift.
- **The four views cannot lie to each other.** Because they are readings of the same swaps, what you see in the data-flow view, the resource view, the comms view, and the composition view are guaranteed to be the same run. In other tools, each view is a separate story that may or may not match.
- **There is a clean line for "what the model decides."** The model decides *what happens inside one box* (read input, produce output, call a tool). Everything *between* boxes — what runs in parallel, what waits, who messages whom — is decided by the shape and a policy, not by the model improvising. This is the answer to the "thick control plane" problem: not a thinner control plane, but a line you can actually point to.

These are not promises; they are the *consequences* of the shape, *if* the agreement in §4 holds. That "if" is why the project is structured the way it is: prove the agreement first, then build on it.

## 6. Where to go next

If this made sense and you want the precise version:

- **RFC-0001 §6.1** — the same "orchestration is an SMC" argument, written for engineers, with the minimal notation needed to be unambiguous.
- **`docs/spec/formal-semantics.md`** — the actual definitions and proofs. This is where the notation lives and where claims like "by construction" are actually justified.
- **RFC-0002** — the document dedicated to proving the four views agree (and to honestly reporting how far that proof has gotten, especially on the π view).

If you are not a mathematician, you do not need to read the spec to understand the project — you just finished the understanding part. The spec is for the people who need to *check* it, and for the few decisions where "it feels right" is not enough.
