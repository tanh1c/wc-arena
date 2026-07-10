# PvE/PvP LLM Agent Harness

## Product direction — decided

Build an automatic football-card match game on top of Squad Builder.

- Start with **PvE**, then add **async PvP**.
- The player sets a squad, formation, tactics, and optional pre-match decisions; the match then runs automatically.
- Each of the 22 players, both coaches, and the referee is an LLM-directed agent.
- The game should be a **football drama/chaos** experience: VAR, scandals, rivalries, controversial calls, and believable upsets matter more than strict competitive balance.
- A match runs and resolves in **20–30 seconds**, then shows a compact text timeline with rich event/highlight cards.
- Stamina, cards, injuries, and morale matter **only for the current match**.

## Core match harness

```txt
Squad Builder + Card Stats
  -> Match setup
      -> 22 Player Agents
      -> Home Coach Agent
      -> Away Coach Agent
      -> Referee Agent
      -> Event Resolver / State Guardrails
      -> Timeline + Highlight Cards
```

The LLM is the decision-making brain, but it must return a constrained action schema. The harness owns the authoritative match state and validates every action before it can change the match.

```ts
type AgentAction = {
  actorId: string;
  type: 'pass' | 'dribble' | 'shoot' | 'tackle' | 'press' | 'hold_shape' | 'substitute' | 'call_foul' | 'play_advantage' | 'review_var';
  targetId?: string;
  reasoning: string;
};
```

This lets agents be imaginative while keeping the match playable, inspectable, and resistant to impossible events.

## Agent roles

### Player agents

Each player receives a compact view of:

- Own card stats and traits.
- Position, formation role, stamina, discipline, confidence.
- Nearby players, ball zone, score, clock, and coach instruction.
- Recent event summary rather than the full match transcript.

Example agent personalities:

- Messi-like creator: seeks tight-space dribbles, through balls, and high-value shots.
- Aggressive defender: challenges early, but raises foul/card risk.
- Nervous goalkeeper: safer distribution, mistake risk under sustained pressure.
- Clinical striker: shoots earlier when a high-quality chance appears.
- Leader: stabilizes team behavior after conceding.

### Coach agents

Before each match, the user configures both a tactical deck and a free-text manager instruction for the coach agent.

The tactical deck contains five callable game-plan cards. The coach may use every selected card at most once during the match.

Example cards:

- Defensive block.
- Counterattack.
- High press.
- Keep possession.
- Target a weak flank.
- Protect a lead.
- Desperate final push.

The user can also write a plain-language instruction and choose its enforcement level: `Flexible`, `Balanced`, or `Obsessive`.

- `Flexible`: the coach treats it as a preference and abandons it when the match state demands it.
- `Balanced`: the coach follows it unless a clear tactical emergency occurs.
- `Obsessive`: the coach pursues it even when that creates obvious risks.

Example instruction:

```txt
Exploit their slow left-back. Keep Messi central, do not waste long balls,
and if we lead after 70 minutes switch to a compact low block.
```

The harness stores the raw instruction, lets the coach agent interpret it into valid tactical constraints, and rejects instructions that cannot map to supported tactics. The coach chooses when to deploy deck cards at checkpoints or after major events, while following the user's stated priorities where possible.

### Referee agent

The referee decides interpretation of ambiguous events: foul/no foul, advantage, yellow/red, penalty, and whether VAR should review a call.

Referees carry hidden tendencies such as:

- Strict vs lenient.
- Home bias.
- Star bias: famous/high-status players get a softer interpretation on borderline contact.
- Drama tendency: more likely to stop and review controversial incidents.
- Integrity / corruptibility.

The referee does not fabricate impossible calls; it chooses among legally valid outcomes proposed by the event resolver.

## Referee influence mechanic

The desired fantasy is not a guaranteed “buy a win.” It is a risky attempt to find and influence a corruptible referee before any match, in every game mode.

Potential loop:

1. Before the match, both players see the referee's name and public tendencies; integrity and corruptibility stay hidden.
2. The player can spend existing **Coins** on an **approach** or **influence attempt**.
3. A corruptible referee may subtly favor the player's star players or borderline decisions.
4. Strong influence increases the chance of scandal, reputation loss, reward loss, or tournament disqualification.
5. VAR can overturn an extreme decision and exposes suspicious behavior.
6. The opponent may also have attempted influence, so the referee can become a contested or chaotic match factor rather than one-sided insurance.

Important design boundary: this should use only fictional in-game currency and be framed as a satirical/dark football-game mechanic, never a real-money purchase.

## LLM-first simulation constraints

Calling a model for every football touch would be slow and expensive. The harness should run in phases and batch decisions:

- Simulate 3–10 minute phases, plus major incidents.
- Ask only relevant nearby players to act during a possession.
- Let off-ball agents submit short intents in parallel.
- Keep one compact state snapshot per phase.
- Require JSON actions, validate them, resolve consequences, then ask agents again.

This still gives every player a distinct agent identity without needing 22 sequential model calls each minute.

## Match pacing and agent turns — decided

A 20–30 second match uses **dynamic hot-spot phases**, not fixed five- or ten-minute turns. The harness calls agents when a decisive context appears: transition, final-third chance, duel, tackle, foul, VAR review, goal, red card, or tactical checkpoint.

The preferred actor model is a hybrid of the two options still under discussion:

1. The harness selects a valid local actor set from match state: ball carrier, 1–2 nearby opponents, and 1–2 relevant support players.
2. The coach agent supplies the current tactical intent — for example `force left overload`, `slow the game`, or `attack immediately after turnover` — but does not invent the actor or take control of the ball.
3. Relevant player agents return constrained individual intents in parallel.
4. The authoritative resolver validates intents, applies stats/randomness/referee rules, and produces the event.

This avoids asking one player to narrate an entire phase while preserving a meaningful coach role. It also avoids calling all 22 players on every event.

### Agent context and response contract — decided

Each agent receives a compact structured state snapshot plus a narrative context summary from a hybrid Match Director layer:

- Code produces authoritative current state: clock, score, ball zone, eligible local actors, tactical state, stamina, cards, active event rules, and the last few relevant events.
- The Match Director LLM turns that safe state into compact narrative context for the current highlight only. It does not alter state, choose outcomes, or create gameplay facts.
- The agent receives the combined context, not the full match transcript.

Agents return strict JSON action data first, followed by separate optional commentary text. The action JSON contains only supported action, valid target, requested risk, and one short rationale summary. Commentary cannot change the action or match state.

For model timeout or provider failure:

```txt
1. Retry the same model request once with the same match snapshot and idempotency key.
2. If it fails again, pause the match at that exact phase.
3. Persist the state and show the player a clear retry/resume notice.
4. Do not silently choose an engine fallback for a model outage.
```

This failure path is separate from invalid football actions. Invalid action JSON remains subject to the action-validation retry/fallback rules.

The result screen includes a **Behind the Scenes** tab. It shows short, player-safe rationale summaries for selected player, coach, referee, and VAR decisions — not raw private model reasoning.

## PvE opponents — decided

PvE uses fixed tier/chapter encounters, but each encounter is assembled from the existing card database. This keeps difficulty controllable while letting the game create themed squads and refresh rosters from real available cards.

Example chapters:

- Starter XI: low-rating squad that teaches the match flow.
- Pressing Academy: high-energy midfield and aggressive coach policy.
- Anti-Messi XI: defenders and referee tendencies intended to frustrate star dribblers.
- Chaos Cup: volatile squad, lenient referee, high upset potential.

## Match output

Primary output: a Football Manager-style timeline, enhanced with card-art highlight panels.

```txt
67'  PENALTY — HOME
Mbappé darts past Romero and goes down under pressure.
The referee points to the spot immediately. VAR checks it, but stays with the call.

Referee note: borderline contact; home-bias tendency increased confidence in the original decision.
```

The post-match screen can include:

- Score and key timeline.
- Man of the match.
- Tactical turning point.
- Referee rating and controversial decisions.
- Agent reasoning excerpts for selected moments.
- LLM match report / newspaper headline.

## Event scope — decided

The first playable PvE vertical slice is deliberately small:

- Possession phases.
- Passes and dribbles.
- Shots, goalkeeper saves, and goals.

The engine simulates routine transitions internally and surfaces only turning points and key chances. Tackles, interceptions, fouls, cards, set pieces, offside, penalties, VAR, substitutions, injuries, weather, crowd pressure, referee controversy, and rivalry intensity are deferred until the base LLM harness is proven fun, fast, and reliable.

The fuller football event catalog remains the expansion target after the vertical slice.

## Agent action validation and recovery — decided

Agent output is never executed as free-form prose. It must satisfy a constrained action schema, actor/target eligibility rules, and a match-state risk budget.

```txt
1. Validate: Is this action legal football behavior for this actor, position, ball state, and phase?
2. Validate: Does its requested risk fit the current configured threshold?
3. If invalid but football-plausible: reject it, return a short structured reason, and ask the agent once for a valid retry.
4. If still invalid or non-football-related: discard it and let the resolver choose a safe fallback action.
5. If valid but highly reckless: resolve it as a football mistake/drama event, such as a failed dribble, wild shot, bad tackle, or positional error.
```

Examples:

- A striker attempting an impossible 50-yard bicycle kick is valid but reckless; it can fail spectacularly.
- A defender trying to tackle a player on the other side of the pitch is invalid; retry with a local valid action.
- An action unrelated to football, or an action exceeding the hard risk ceiling, is discarded rather than narrated.

The hard ceiling is distinct from normal risk. A `risk > 90%` request may still be allowed only when it maps to an explicit, legal football action in the event catalog. It must never permit arbitrary behavior outside the match simulation.

## Behind the Scenes — decided

The default **Behind the Scenes** view shows concise rationale summaries for the coach, referee/VAR, and players directly involved in a highlight.

An advanced **Full Match Log** view exposes all stored agent decisions with filters for player, coach, referee, minute, event type, accepted/rejected status, retry reason, and resolver outcome. It shows structured decision summaries and validation results, not private chain-of-thought.

## Card stats

A player-stat CSV exists at:

```txt
C:\Users\LG\Desktop\Study Material\AI\25-05-2026\renderz\pyfifarenderz\exports\players - Copy.csv
```

The planned data work is to inspect its schema, match rows against existing Supabase `player_cards`, quantify unmatched or ambiguous players, then import **every useful available stat** at the start. The game can derive higher-level traits from those raw values later, but the import should not prematurely discard useful source data.

### Manual-match exception

The GOAT Salah card is intentionally excluded from automated CSV stat import. Its live art does not match either of the two CSV Salah rows with the same name/team/position, so selecting one automatically would be unsafe. Once player-stat editing exists in `/admin`, the administrator will enter and maintain that GOAT card's stats, PlayStyles, and Traits manually.

### Stat pipeline — decided

```txt
Raw CSV stats + PlayStyles + Traits
  -> percentile ranks within the imported player database
  -> bounded rarity bias
  -> code-derived gameplay traits
  -> LLM personality flavor
  -> event resolver and constrained player-agent context
```

Raw values remain stored. The resolver should use percentile ranks instead of assuming the CSV uses a 0–100 scale. For example, a player’s `Finishing` percentile is measured against all eligible attacking players in the imported data.

Card rarity receives a bounded bias so rarer cards feel special, but it cannot erase matchups or upset potential. The exact rarity-bias formula remains to be chosen; it must be capped per event and visible in the final resolver breakdown.

### Available source data

- Core: `PAC`, `SHO`, `PAS`, `DRI`, `DEF`, `PHY`, `OVR`.
- Pace: `Acceleration`, `Sprint Speed`.
- Shooting: `Finishing`, `Shot Power`, `Long Shot`, `Volleys`, `Penalties`.
- Passing: `Short Passing`, `Long Passing`, `Vision`, `Crossing`, `Curve`, `Free Kick`.
- Control: `Agility`, `Balance`, `Reactions`, `Ball Control`, `Dribbling`.
- Defending: `Marking`, `Standing Tackle`, `Sliding Tackle`, `Awareness`.
- Physical: `Strength`, `Aggression`, `Jumping`, `Stamina`, `Heading`.
- Goalkeeper: `GK Diving`, `GK Handling`, `GK Kicking`, `GK Reflexes`, `Positioning`.
- Profile: positions, alternate positions, skill moves, strong/weak foot, height, weight, and attack/defence work rates.
- New fields: `PlayStyles` and `Traits`.

### Trait ownership — decided

Gameplay traits are derived deterministically in code from stats, position, work rates, PlayStyles, and functional Traits. The LLM receives those traits and creates only narrative/personality flavor; it does not invent hidden gameplay modifiers.

### Real-player identity — decided

Use hybrid canonical + derived identity:

- Every player receives a data-derived gameplay profile.
- A curated, versioned set of star players receives a canonical identity profile.
- Canonical profiles alter only player-agent action preferences and commentary flavor; they never add hidden stat, probability, or resolver modifiers.
- Commentary can use the full real-player identity for headlines, rivalries, and narrative.
- Players without a canonical profile remain fully expressive through their data-derived profile.

Example: a canonical Messi profile may prefer central half-spaces, late decisive creation, and tight-space dribbles. Its pass/shot success remains determined only by approved event stats, percentile rank, bounded rarity bias, match state, and resolver randomness.

Rarity, formation, player-agent behavior, match state, referee tendencies, and randomness should remain capable of overturning a stronger squad.

### Rarity, PlayStyle, and Trait rules — decided

Rarity uses a capped hybrid influence:

- A small direct modifier to the relevant event percentile.
- Permission/preference for more ambitious or special actions.
- A bounded clutch modifier for decisive phases: high-quality chances, late match moments, penalties, and direct match-winning duels.

No single rarity component can decide an event alone. The resolver caps the combined rarity contribution per event so tactical matchups and weaker squads retain credible upset potential.

Rarity effects are shown only after the match in the Full Match Log, alongside the event breakdown. They remain hidden from the standard timeline to preserve match drama without making ranked outcomes unauditable.

PlayStyles apply percentage multipliers only to their relevant event categories. For example, `Bullet Pass` can modify eligible progressive-pass resolution and `Rush Out` can modify eligible goalkeeper sweep decisions. Each multiplier must be capped and recorded in the event breakdown.

Functional Traits use individually designed upside/downside pairs rather than being universally positive. For example, `Dives Into Tackles` can increase tackle attempts and success in appropriate situations while increasing foul/card risk; `Long Thrower (GK)` can improve a quick launch but make possession retention less likely. Cosmetic traits and celebration/skill-move flavor do not alter resolver probabilities unless explicitly mapped to a supported football action.

## Economy and progression — decided

### PvE rewards

Winning PvE awards:

- Coins.
- Pack progress.
- Chapter unlock progress.
- Manager reputation.

A loss still awards reduced Coins and pack/chapter progress. A player should be able to recover from a bad squad matchup, chaotic referee, or unlucky match without becoming stuck in a zero-reward grind.

The first progression format is a short PvE campaign: each chapter has roughly 5–10 matches and a controlled difficulty/story arc. League seasons, promotion/relegation, and cup tournaments are explicitly deferred until the core match simulation is fun.

### Manager reputation

Manager reputation gates all three of the following:

- New chapters and stronger bot squads.
- Better referee dossiers: additional public tendency and integrity/corruptibility clues before a match.
- Story events, rare tactical cards, and special opponents.

### Campaign presentation

The campaign uses a visual node map as the primary selector, while a manager inbox supplies the story: rival messages, referee rumors, board expectations, chapter introductions, and special challenges. Inbox messages unlock or point toward nodes rather than replacing the map.

### Opening encounter

The first PvE match is a clear `Prove Your Squad` tutorial encounter against a weak starter team. It introduces squad selection, tactics, the short match timeline, a few agent decisions, and basic rewards before adding referee corruption or deeper drama.

### Influence consequences

If referee influence is detected, the player loses the Coins spent on the attempt and forfeits that match's rewards. This is intentionally a sharp but self-contained consequence: no account ban, no lasting lockout, and no permanent punishment in the first version.

### Duplicates and player growth

Duplicates remain collection/forge material only in the first match mode release. They do not add stats, familiarity, chemistry, or match power.

Player levelling, permanent stat growth, and duplicate-based synergy are future options, to be considered only after the base campaign, data import, match harness, and rewards are proven fun.

## Proposed build order

### Phase 1 — Data and playable PvE

- Import/match player stats.
- Create one bot squad.
- Create match state, time phases, and a simple event resolver.
- Run one automatic PvE match with a timeline.

### Phase 2 — Multi-agent LLM harness

- Add player/coach agent prompts and constrained action JSON.
- Introduce compact state snapshots, turn batches, event validation, and stored match logs.
- Add rich narration only for major events.

### Phase 3 — Referee and VAR

- Add referee personalities, rulings, VAR, cards, and bias.
- Add the optional influence/scandal system.

### Phase 4 — Async PvP

- Snapshot both submitted squads.
- Simulate server-side with a versioned harness and auditable log.
- Show both players the same immutable result and report.

### Phase 5 — Campaign expansion

- Add further PvE chapters, themed opponents, and manager-reputation gates.
- Consider league seasons, promotion/relegation, and cup tournaments.
- Consider player levels, stat growth, duplicate familiarity, and chemistry only if the core loop needs deeper long-term progression.

## Match setup — decided

### Starting tactical deck

Every new manager starts with five one-use tactical cards:

- `Balanced Shape`
- `High Press`
- `Counter Attack`
- `Keep Possession`
- `Feed the Star`

### Feed the Star selection

The player selects a preferred star before the match. The coach agent follows that preference by default, but may override it when the match state makes the preferred star unavailable or tactically harmful. Every override must be recorded with a short explanation in Behind the Scenes and the Full Match Log.

### Opponent intelligence and manager reputation

Before every PvE match, the player sees the complete opponent lineup, player stats, formation, and tactic deck. Difficulty comes from execution, agent behavior, drama, referee effects, and matchup dynamics rather than hidden roster information.

Manager reputation improves pre-match intelligence through a full scouting report:

- Reveal hidden functional PlayStyles and Traits on bot players.
- Show the bot's projected tactical plan.
- Generate an AI scouting report with matchup weaknesses, key duels, and predicted drama/referee pressure points.

The report is advisory: bot coach/player agents can still adapt during the match.

### Simulation presentation

The 20–30 second simulation uses a TV-broadcast ticker and a live compact event timeline. Headlines, score straps, possession/momentum snippets, and pundit-style updates animate while the match runs; key highlights receive player-card art panels as they occur.

No 2D pitch animation is part of the first version. It would require a separate spatial-rendering engine and is deliberately deferred.

### Match Director log visibility

Match Director context is stored with the match but becomes visible in the Full Match Log only after the match has completed. This prevents context from revealing future-sensitive information when a paused match is resumed.

### Campaign presentation style

The campaign node map and manager inbox use a TV-broadcast / sports-news presentation: headlines, breaking-news straps, pundit cards, fixture graphics, referee rumors, and match-card panels.

## MVP delivery decisions — decided

### Match entry

`Squad Builder` remains where the player prepares formation, preferred star, tactical deck, and free-text manager instruction. The player then enters PvE through the Campaign page, selects a campaign node/opponent, and opens a separate TV-broadcast-style pre-match screen before simulation begins.

### Agent-call budget

Each hot spot calls a fast model for the Match Director, current coach context, and a dynamic local set of relevant player agents. The harness begins with 2–5 related players, then can expand the set only when the hot spot warrants it — for example, a crowded final-third move, a contested dribble, or a rebound. It must never default to all 22 players.

### Model tier

Version 1 uses the existing DeepSeek API integration and the same DeepSeek V4 Flash model used by the We Speak Football page for Director, coach, player, and future referee roles. This keeps latency and behavior consistent while the harness is validated.

The concrete API model identifier must be read from the existing integration/configuration when implementation begins; do not hard-code or guess it in the match code. Role-specific model tiers can be added only after real match cost, failure, and quality data exists.

## Final match guardrails — decided

### Rarity cap per event

Rarity has a context-specific cap:

- Passing events: maximum `±3` percentile points.
- Shots and tackles: maximum `±5` percentile points.
- Clutch phases: maximum `±7` percentile points.

The cap applies to the combined rarity contribution, including direct, action-permission, and clutch components. It does not cap ordinary stat, PlayStyle, Trait, tactic, referee, or randomness effects.

### Tactic cards and manager instruction

The user's `Flexible` / `Balanced` / `Obsessive` instruction level determines how strongly the coach follows the free-text plan. Tactical cards are tools the coach uses to pursue that plan, not rules that outrank it.

For example, an `Obsessive` instruction to exploit the left flank makes the coach more likely to deploy `Counter Attack` or `Feed the Star` in ways that create left-sided attacks, rather than treating those cards as unrelated tactics.

### Paused match abandonment

A player may abandon a paused match. The match is finalised as abandoned, rewards are forfeited, and the match report remains available. This prevents a model/provider outage from trapping the player while avoiding a reward exploit.

### Match persistence

The first version stores the final event log and match outcome only, rather than random seeds, prompt versions, model snapshots, or full replay inputs. This keeps database storage and implementation light; deterministic replay/audit can be added later if async PvP or serious competitive integrity requires it.

## Data and pre-match decisions — decided

### CSV card matching

Match CSV players to existing `player_cards` using normalized `name + team + position` first. Produce a report of unmatched and ambiguous rows for manual review before applying any stat updates; do not silently pick a candidate for ambiguous names.

### Chapter-one bot squad

Build the opening bot from a curated position pool drawn from the existing card database. This allows a stable formation and controlled difficulty while avoiding fragile hard-coded owned-card assumptions. The pool can later support themed and chapter-specific opponent construction.

### Pre-match screen

The initial TV-broadcast pre-match screen shows only:

- Home and away squads.
- Formation.
- Preferred star.
- Tactical deck.
- Manager instruction and enforcement level.

Scout reports, key duels, pundit prediction, and referee dossier are deferred to later campaign/reputation layers.

## Vertical-slice match contract — decided

### Core event stat mapping

The first resolver uses detailed relevant stats rather than only six headline stats:

```txt
Pass:
  Short Passing + Long Passing + Vision + Ball Control

Dribble / chance creation:
  Dribbling + Agility + Balance + Ball Control + Pace

Shot:
  Finishing + Shot Power + Reactions
  + Pace for breakaway chances
  + Strength to resist relevant defensive pressure

Save:
  GK Reflexes + GK Diving + GK Handling + Positioning
```

The resolver can later add specific contextual counters, such as defender Awareness against a through ball or Strength/Aggression in a physical duel. It should not add unused stats merely because they exist in the CSV.

### Hot-spot budget

A match simulates 10–14 dynamic possession hot spots. This aims for a 20–30 second run time while allowing enough buildup, chances, saves, and turning points to feel like a real match rather than a coin flip.

### Squad snapshot and templates

When the player enters a campaign node, the harness automatically snapshots the current Squad Builder selection. The player may optionally give that snapshot a name and save it as a reusable squad template; saving is never required to start a match.

### Event presentation

The timeline uses TV-broadcast highlight cards. Each surfaced event has a score strap, short commentary, and relevant player-card art. A decisive possession can be presented as one compact broadcast card containing its pass/dribble chain and final shot, save, or goal rather than as noisy individual micro-events.

## Simulation and reward presentation — decided

### Live broadcast UI

During the 20–30 second simulation, show:

- Changing TV-broadcast headlines and compact event cards.
- A `key moments` counter, such as `7 / 12`.
- Lightweight derived momentum and possession bars.

Momentum and possession are derived from resolved events. Momentum then has a small, capped effect on both agent risk/preference and relevant event probability. Its contribution must be recorded in the final event breakdown, so it is never an unauditable hidden buff.

### Scoreline distribution

The default target is medium drama: scorelines such as `1–1`, `2–1`, and `3–2` are common. The distribution must still allow credible low-scoring matches (`0–0`, `1–0`) and occasional chaos matches (`3–3`, `4–2`, `5–4`) when agent behavior, stats, match state, and randomness justify them.

### Opening tutorial adaptation

`Prove Your Squad` is adaptive. The player can win or lose; both outcomes progress the onboarding narrative. Draws and losses receive rewards close to a win so the first experience never feels punitive; winning primarily grants bonus Coins and manager reputation. A loss should explain a concrete tactical or squad lesson rather than feeling scripted.

### Post-match broadcast card

The first result screen presents:

- Coins.
- Chapter progress.
- Manager reputation.
- Pack-progress meter.
- A `Highlight of the Match` player-card panel by default.

A non-player story card is reserved for rare, major drama, such as an extreme referee controversy or a campaign-defining coach decision.

Post-match actions are deliberately simple:

- `Return to Campaign`
- `Adjust Squad`

## Progression and highlight rules — decided

### Momentum cap

Momentum has a dynamic cap based on match phase:

- Early match: maximum `±2%` relevant event probability contribution.
- Late/clutch phase: maximum `±5%` relevant event probability contribution.

It also shifts agent risk/preference within a matching bounded range. Momentum cannot overcome hard event validation, stat gaps, rarity caps, or other resolver guardrails, and its contribution remains visible in the final event breakdown.

### Player of the Match / Highlight of the Match

The resolver computes an auditable event-impact score from goal, assist, save, key dribble, clutch contribution, and matchup difficulty. The Match Director then selects the presentation narrative from the scored candidates: headline, summary, and why the moment mattered.

The LLM cannot nominate a player whose score is not among the eligible top candidates. This preserves dramatic storytelling without allowing arbitrary Player of the Match selection.

### Campaign node completion

Main campaign nodes require a win to unlock the next main node. A loss unlocks a rematch/training node rather than blocking all progress. These side nodes provide reduced rewards, a clearer tactical lesson, and a route back to the main encounter.

### Campaign navigation

Campaign is a primary navigation destination. If the player has no valid current squad, it routes them into Squad Builder first; otherwise it opens the campaign node map directly.

## Campaign fallback and replay rules — decided

### Draws on main nodes

A draw grants partial main-node progress but does not unlock the next main node. The player must win a rematch to advance; the draw remains a meaningful result rather than being treated as a pure loss.

### Soft route after losses

After three losses on the same main node, the campaign offers a softer route: an optional training/rematch node with a clear tactical lesson and reduced rewards. Before the third loss, the game expects the player to adjust squad construction, tactical cards, or manager instruction.

### Replaying completed nodes

Completed nodes remain replayable through a rotating daily/weekly reward pool. This gives replay value without allowing unlimited static reward farming.

### Opening chapter identity

The opening chapter is a generic, approachable starter squad. Its purpose is to teach Squad Builder snapshotting, campaign entry, pre-match instructions, the broadcast simulation, timeline interpretation, and basic rewards before introducing specialized bot tactics.

## Training and Chapter 2 — decided

### Training/rematch objective

Training/rematch nodes use explicit tactical objectives rather than simply weakening the opponent. Examples include:

- Create three clear chances.
- Sustain possession through a set number of hot spots.
- Execute `Feed the Star` successfully.
- Escape an opponent press with successful progressive passes.

The objective is chosen by the campaign author for the node and must map to an auditable resolver event, not vague LLM judgement.

### Draw progress

A draw awards `25%` of the chapter progress granted by a win. It recognizes a competitive match without making draws an efficient route through main-node gates.

### Replay rewards

The rotating replay-reward pool reveals only the reward tier/rarity before a replay begins. The exact reward stays hidden until the match completes.

### Chapter 2: Pressing Academy

Chapter 2 introduces the `Pressing Academy`: a high-energy midfield, aggressive coach policy, and scenarios that teach possession security, progressive passing, and counterattack responses.

## Early campaign structure — decided

### Chapter 1 training lesson

After three losses in Chapter 1, the training/rematch node asks the player to create three clear chances. This teaches chance creation without requiring a win and gives the report a direct, explainable lesson when the objective fails.

### Chapter 2 boss: Pressing Academy

The Chapter 2 boss combines all selected pressure points:

- Relentless early press that costs the bot stamina over time.
- A star midfielder with `Bullet Pass`, making turnovers especially dangerous.
- A lenient referee tendency, allowing a more physical match before calls are made.

The intended counterplay is to survive the opening pressure, protect possession, and punish the late stamina drop with controlled counterattacks.

### Chapter size and difficulty

Early campaign chapters have five nodes each. Node difficulty is fixed: opponent card pool, formation, agent profile, tactical deck, and chapter rules do not adapt to the player's squad strength. This makes campaign progression learnable and predictable.

## Chapter 1 — decided outline

Chapter 1 combines a clear tutorial progression with light TV-broadcast drama:

1. `Unknown Challengers` — teaches squad snapshotting, campaign entry, and the broadcast match flow.
2. `First Chance` — teaches pass, dribble, shot, save, and goal sequences.
3. `Star Under Pressure` — teaches `Feed the Star` while showing why the coach may need a secondary option.
4. `Shape Test` — teaches the tactical deck, free-text manager instruction, and instruction discipline level.
5. `Prove Your Squad` — the Chapter 1 boss, combining the full opening loop.

## Chapter 1 opponent and reward rules — decided

### Formations and bot construction

Chapter 1 uses the following fixed formations and teaching identities:

| Node | Formation | Identity / lesson |
| --- | --- | --- |
| `Unknown Challengers` | 4-4-2 | Balanced starter; learn squad snapshotting and match flow. |
| `First Chance` | 4-3-3 | Open defensive shape; learn pass, dribble, shot, save, and goal chains. |
| `Star Under Pressure` | 4-1-4-1 | A defensive midfielder focuses on the preferred star; learn `Feed the Star` and alternatives. |
| `Shape Test` | 3-5-2 | Dense midfield; learn tactical cards and manager instruction discipline. |
| `Prove Your Squad` | 4-2-3-1 | Balanced boss; combines the opening loop. |

Each node draws its player lineup from its curated position pool. Formation and tactical identity stay stable, while the exact bot cards can rotate within the approved pool.

### Chapter 1 boss drama

`Prove Your Squad` combines three lightweight drama systems that fit the vertical slice:

- Pundit predictions dismiss the player squad before kick-off; narrative only.
- A stronger late-match momentum swing creates a comeback/hold-your-nerve scenario within normal momentum caps.
- The player’s preferred star receives constant close attention, reducing easy access and forcing the coach to use secondary options.

No foul, VAR, referee, injury, or unimplemented event system is introduced by this boss.

### Node rewards

Early-node rewards increase predictably:

```txt
Node 1: Bronze
Node 2: Silver
Node 3: Gold
Node 4: Gold
Node 5: Chapter Pack
```

The existing win/draw/loss reward multipliers still apply to each tier.

### Campaign node status

The map combines explicit lock requirements and visible partial progress:

- Locked main nodes show a lock and `Win previous node` requirement.
- A drawn current node shows its `25%` progress bar.
- Training/rematch nodes are visually distinct side paths with their tactical objective and reduced-reward indicator.

## Bot-pool and Chapter 2 entry rules — decided

### Bot curated-pool rotation

Bot position pools are fixed per chapter and change only through intentional content updates. This keeps campaign matchups learnable, avoids daily RNG frustration, and lets the team tune each chapter's difficulty/story identity.

### Chapter 1 difficulty bands

Every Chapter 1 node can use a mixed rarity lineup. Difficulty rises through a fixed target OVR range and curated squad composition, not by locking individual nodes to specific rarity tiers. This avoids an artificial “Common then Uncommon then Rare” ladder while still allowing varied player cards and credible upsets.

### Chapter Pack

The Chapter Pack combines both guarantees:

- Award a card not already owned when an eligible card remains in the configured pack pool.
- Guarantee a minimum `Rare` result.

If no eligible new card remains, the pack can award a duplicate while preserving the minimum-rarity floor.

### Chapter 2 manager inbox introduction

The manager inbox combines all three hooks:

1. A breaking-news challenge: `Pressing Academy has challenged you.`
2. A scouting report warning about their midfield press and `Bullet Pass` star.
3. A board message demanding proof that the squad can survive sustained pressure.

The message unlocks the Chapter 2 node map and establishes its tactical lesson before the player enters the chapter.

## Chapter pacing and reward rules — decided

### Chapter 1 OVR curve

Target OVR rises in a stepped curve rather than a flat increment:

- Nodes 1–2 stay close, so the player can learn the core loop.
- Nodes 3–4 step up meaningfully as tactics and preferred-star pressure enter.
- Node 5 makes the strongest jump as the chapter boss.

Exact target ranges should be chosen only after matching/importing the real player-stat data and inspecting the available card catalog.

### Chapter Pack pool

Chapter Pack rewards draw from the global eligible player-card pool, subject to the existing new-card preference and minimum `Rare` floor. Chapter themes do not restrict the collection reward pool.

### Replay reward cadence

Completed-node replay pools rotate weekly. This gives players enough time to pursue a desired tier without turning the campaign into daily maintenance.

### Chapter 3: Defensive Wall

Chapter 3 introduces `Defensive Wall`: compact shape, low block, disciplined protection of the box, and a tactical lesson about patience, creative chance creation, and avoiding forced low-probability shots.

## Chapter 3–4 and replay economy — decided

### Chapter 3 boss: Defensive Wall

The Defensive Wall boss combines both selected strengths:

- A goalkeeper-specialist profile that rewards high-quality chance creation and makes low-quality shots unreliable.
- Elite aerial defending that makes crossing and routine headers less effective.

The intended answer is not to grind shots or crosses, but to use patience, dribbling, creative passing, and `Feed the Star` to create a clean central chance.

### Chapter 4: Star Lockdown

Chapter 4 introduces `Star Lockdown`: the opponent prioritizes denying the player's preferred star and forces the coach/player to build secondary routes, switch the preferred-star focus, and use the manager instruction tactically.

### Pack progress

Match and campaign rewards grant pack fragments. Players collect fragments and exchange them for pack openings. This makes progress legible across wins, draws, losses, chapters, and replay rewards without requiring a single hidden threshold.

### Weekly replay economy

Completed-node replay rewards use one shared weekly campaign pool, not a separate reset per node. The pool constrains farming across the campaign while still letting players choose the matchups they prefer to replay.

## Fragments, Star Lockdown, and Chapter 5 — decided

### Fragment economy

Different pack tiers have different fragment costs. The exact costs and win/draw/loss fragment payouts remain a balancing task after the first playable campaign loop generates real reward data.

### Preferred-star shortlist

Before a Chapter 4 `Star Lockdown` match, the player selects two preferred stars. The coach can switch focus between only those two players during the match when the current star is denied or a tactical situation demands it. The switch and its reason are visible in Behind the Scenes and Full Match Log.

### Chapter 5: Chaos Cup

Chapter 5 is `Chaos Cup`, the first chapter to introduce the expanded football systems:

- Fouls, cards, penalties, offside, VAR, substitutions, and referee personalities.
- The fictional in-game referee-influence mechanic, its Coins cost, and detection/reward-forfeit consequences.
- More volatile momentum, rivalry narrative, and controversial broadcast moments.

The chapter must add these capabilities only after the pass/dribble/shot vertical slice and its LLM harness are stable.

### Weekly replay caps

The shared weekly replay pool uses both a hard match-attempt cap and a hard fragment cap. Either cap prevents further replay rewards for that week, while completed nodes can still be played for practice and match reports.

## Chaos Cup and replay economy — decided

### Pack tiers

The fragment economy uses the existing four paid-pack-style tiers:

- `Starter`
- `Premium`
- `Elite`
- `Icon Chase`

Each tier will have a progressively higher fragment cost and its existing/approved card-pool identity. The free Daily pack remains outside the campaign-fragment economy.

### Weekly replay caps

The initial shared weekly replay pool grants rewards for up to `30` matches and up to `300` fragments. Reaching either cap disables replay rewards for the week but leaves practice matches and reports available.

### First Chaos Cup referee node: Unknown Ref

Chaos Cup opens with `Unknown Ref`: public referee tendencies are withheld and the player must read decisions from the match. It introduces referee personality through ambiguous calls before the campaign reveals clearer strict, lenient, home-bias, or corruptibility patterns.

### Influence timing

Referee influence has two possible opportunities:

1. A pre-match approach after the referee is assigned.
2. One limited mid-match attempt at an eligible dramatic checkpoint.

Both use Coins, both carry detection risk, and neither guarantees a decision. The harness must enforce at most one mid-match attempt and record every attempt in the final match log.

## Influence economy details — decided

### Fragment costs

Campaign fragments exchange for packs at these initial costs:

```txt
Starter:    100 fragments
Premium:    200 fragments
Elite:      350 fragments
Icon Chase: 600 fragments
```

These are balancing defaults, subject to revision after real campaign reward and pack-opening data exists.

### Mid-match influence eligibility

The referee agent may mark any major borderline decision as eligible for one mid-match influence attempt. This covers disputed penalty decisions, red-card decisions, goal/offside review, and other close calls supported by the current event catalog.

The referee must expose only a player-safe prompt such as `A close call is under review`; it does not reveal hidden integrity, exact probability, or the outcome before the attempt.

### Unknown Ref public label

`Unknown Ref` still shows a vague reputation label, such as `Calm`, `Unpredictable`, or `Intense`. The label is atmospheric and deliberately insufficient to identify strictness, bias, integrity, or corruptibility.

### Detection odds

Pre-match and mid-match influence attempts each have independent detection odds. Attempting one does not mechanically increase detection risk for the other in the first version. Both outcomes are nevertheless recorded in the match log and can create separate narrative consequences.

## Influence resolution and Chaos Cup boss — decided

### Dynamic influence cost

Pre-match and mid-match influence costs scale with referee public reputation and match importance. A higher-profile match or a referee with a stronger public reputation costs more Coins to approach. Exact pricing remains hidden from the player only when `Unknown Ref` is active; otherwise the in-game Coin cost is shown before confirmation.

### Dynamic influence effect

A successful attempt has an integrity-dependent effect on a future eligible borderline decision:

- A highly corruptible referee can receive up to a `+25%` directional decision bias.
- A hard-to-influence referee receives as little as a `+5%` bias.
- The effect applies only to a supported close-call decision, never to goals, player stats, or arbitrary match events.

Exact integrity and probability are not shown before the match. The resolver caps the influence contribution, records it after the match, and preserves enough baseline randomness that the result is never guaranteed.

### Attempt feedback

The player receives a result label after attempting influence — for example `Contact established`, `Approach rejected`, or `Attention drawn` — without seeing the exact hidden modifier, integrity score, detection roll, or future decision outcome. Full structured details become available after match completion in the Full Match Log.

### Chaos Cup boss drama

The first Chaos Cup boss combines all selected safeguards and drama:

- Random major close calls, all with complete post-match audit entries.
- A public `Unpredictable` referee label and a higher frequency of eligible influence checkpoints.
- The opponent may also make fictional in-game influence attempts, creating contested borderline decisions.

The boss must still satisfy normal resolver caps, valid football event rules, and transparent post-match logging. It should feel volatile, not predetermined or unfair.

## Referee campaign presentation — decided

### Public referee reputation

Referee reputation uses four public bands:

- `Amateur`
- `Professional`
- `Elite`
- `Untouchable`

The band drives the displayed influence price in ordinary matches and contributes to player expectations. It does not disclose hidden integrity, strictness, bias, or corruptibility.

### Attention drawn

`Attention drawn` does not show a live scandal meter or explicit risk escalation. Its meaning, detection result, and any reward-forfeit consequence remain uncertain until the post-match audit. This preserves drama and avoids turning the mechanic into a solved visible-probability puzzle.

### Opponent influence broadcast treatment

If the opponent makes an influence attempt, the live broadcast uses both subtle presentation layers:

- Commentary hint: `Something feels off around that decision…`
- News-ticker hint: `Officials under pressure`

Neither layer confirms an attempt or exposes the opponent's outcome. Full details remain post-match-only.

### Repeated detected influence

In version 1, repeated detected influence attempts have no permanent campaign penalty. Each detected match independently applies the existing consequence: spent Coins are lost and that match's rewards are forfeited. Manager reputation and future referee assignment remain unchanged until the core mechanic is proven fun.

## Campaign dashboard and reward timing — decided

### Reward timing

Coins and progress are paid immediately after every match. The Chapter Pack is awarded only when the chapter is completed. This makes each match feel rewarding while preserving a meaningful chapter-completion prize.

### Campaign dashboard

The Campaign screen top row shows:

- Current Chapter.
- Pack Fragments.
- Manager Reputation.
- Weekly Replay Pool status.
- Current Squad summary.

### Chaos Cup referee dossier timing

For Chaos Cup, the referee dossier remains unavailable until the match has started. The pre-match screen may show only the referee assignment/public label where applicable; detailed dossier information unfolds through the live match and the post-match audit. This keeps the chapter's `Unknown Ref` fantasy intact.

### Influence confirmation

Every influence attempt opens a confirmation modal with the Coin cost, a concise risk warning, and the relevant context. Example:

```txt
Influence this close call?
Spend 240 Coins. Detection can forfeit this match's rewards.
[Cancel] [Attempt influence]
```

The modal confirms the action, but never reveals hidden integrity, chance, effect magnitude, or future decision outcome.

## Final campaign UX decisions — decided

### Mid-match influence

The player may configure a pre-match auto-preference, such as `Always attempt on penalties`, but every real mid-match influence action still requires the confirmation modal. The preference only determines when the harness offers the modal; it never spends Coins automatically.

### Chapter Pack presentation

After completing a chapter, Campaign shows a broadcast reward card confirming the earned Chapter Pack. The player then opens it from the existing Cards page, reusing the established pack-opening experience rather than creating a second reveal flow.

### Campaign without a valid squad

Campaign remains visible as a preview for users without a valid squad. The map and dashboard render, campaign nodes are disabled, and a prominent `Build your squad` CTA routes to Squad Builder. This communicates the mode's goal without silently redirecting the user away.

### Weekly replay reset

The shared weekly replay pool resets at a fixed UTC time. The Campaign dashboard must show the next reset time in UTC and use the same timezone convention as existing daily-card-pack mechanics.

## Campaign eligibility and V1 boundary — decided

### Valid squad

Campaign requires exactly 11 distinct owned cards assigned to the active formation. Each card must match its slot through either its primary position or one of its alternate positions. This preserves meaningful squad construction while supporting flexible modern player roles.

### Match entry resource

Campaign match entry uses a separate energy/ticket resource. Coins remain reserved for existing card-pack/forge systems and fictional referee-influence attempts. The ticket economy, refill cadence, and storage model are deferred until the match harness is proven fun.

### Replay-attempt consumption

Every replay match with active weekly rewards consumes one weekly replay attempt, regardless of win, draw, or loss. This is simple to understand and prevents repeated loss/draw rerolls for favorable rewards.

### First implementation UI boundary

The first implementation is a focused match-test screen, not the full Campaign map/story/dashboard. It exists to validate the player-stat import, squad snapshot, bot construction, DeepSeek agent harness, constrained action resolution, 10–14 hot spots, broadcast event cards, and final outcome.

Campaign map, manager inbox, reputation, fragments, rewards, replay economy, Chapters 1–5, referee systems, and influence UI remain specification-only until this vertical slice feels reliable and fun.

## Match Lab and V1 exit criteria — decided

### Match Lab access

The focused test screen lives on a temporary developer route: `/match-lab`. It is separate from Squad Builder and Campaign so experimentation does not expose an unfinished loop to normal players.

### Future out-of-position rules

Future Campaign allows a position-mismatched card, but applies an explicit, visible out-of-position penalty. The exact penalty formula is deferred; it must be shown before match entry and included in the final match breakdown.

### V1 success criteria

Match Lab is ready to graduate into Campaign UI work only when it satisfies all of the following:

1. It completes at least 20 representative matches without crashes, invalid state transitions, or unrecoverable action failures.
2. Event logs have coherent football flow and results are not routinely implausible.
3. Players who test it report that the match is fun/interesting, rather than merely technically functional.
4. Typical match latency stays below 30 seconds, including DeepSeek V4 Flash agent requests and broadcast presentation.

### Ticket economy

Do not set ticket capacity, refill time, or paid recovery numbers until Match Lab produces real match duration, replay behavior, and engagement data.

## Match Lab access and diagnostics — decided

### Access

`/match-lab` is available to every signed-in user. It must be visibly marked as an experimental test mode and stay isolated from Campaign rewards, fragments, reputation, tickets, and normal player progression.

### Bot selection

Match Lab lets the user select chapter-preview bots:

- `Starter`
- `Pressing Academy`
- `Defensive Wall`

This tests the same curated-pool and tactical identities planned for Campaign without first building the Campaign map.

### Diagnostics

Match Lab includes an opt-in Debug panel. It can show structured agent actions, validation/retry results, resolver inputs/contributions, actor-set selection, latency, and final event breakdown. It must show summaries and structured fields only, never private chain-of-thought or credentials.

### Model-error pause

A paused model-error match offers both:

- `Retry phase`
- `Abandon match`

Retry resumes the exact persisted phase. Abandon finalizes the experimental match without Campaign rewards or progression.

## Match Lab squads, history, and feedback — decided

### Lab squad selection

Match Lab has its own lightweight selection surface: users choose any 11 cards from their collection for the experiment rather than being limited to the currently saved Squad Builder lineup. Formation and position validation still apply to the selected Lab squad.

### Report history

Completed Match Lab reports are stored in a personal history without an artificial record-count limit. Reports include the final broadcast timeline, outcome, bot choice, squad snapshot, feedback, and structured debug summaries where enabled. Credentials and private chain-of-thought are never persisted.

### Feedback prompt

After a completed match, ask for a `1–5` rating of:

- Fun
- Clarity
- Fairness

Free-text feedback is optional. These ratings directly measure the V1 graduation criteria instead of relying only on technical telemetry.

### Debug visibility

Every signed-in Match Lab user can see and toggle the Debug panel. The panel stays opt-in and contains only structured action/resolver/latency summaries.

## Match Lab integrity and retention — decided

### Duplicate-card rule

Match Lab permits at most one copy of each exact player card in a squad, even when the user owns duplicates. Duplicates remain collection/forge material; they do not create an experimental lineup advantage.

### Lab formations

Version 1 Lab supports three formations:

- `4-3-3`
- `4-2-3-1`
- `3-5-2`

This gives meaningful tactical variety while constraining early agent/resolver testing.

### History retention

Personal Match Lab reports are retained for 90 days, then automatically deleted. This keeps useful short-term testing history without indefinitely storing experimental match/debug data.

### Error-abandon feedback

Do not prompt for feedback after an ordinary player-initiated abandonment. If a model-error-paused match is abandoned, ask the same optional 1–5 `Fun` / `Clarity` / `Fairness` feedback so the team can distinguish model-failure frustration from normal gameplay feedback.

## Match Lab data-model decisions — decided

### Position eligibility

Match Lab enforces primary-position or alternate-position eligibility for every selected slot. It does not test future out-of-position penalties; experimental results should start with valid squads and reduce unnecessary variables.

### Formation-slot source

Match Lab reuses the exact supported formation and slot definitions from Squad Builder. It must not create duplicate, Lab-specific football-position logic.

### History payload

Store the final broadcast timeline plus a compact structured summary, capped at `25 KB` per report. Do not persist the full raw agent/resolver trace in report history. The opt-in Debug panel can expose detailed data live, but the retained report stays small and focused.

### Historical visual replay

A historical Match Lab report supports visual replay of the stored broadcast cards and timeline without re-running any LLM calls. It replays persisted events only; it does not simulate a new outcome.

## Match Lab replay and report UX — decided

### Historical replay controls

Historical broadcast replays use manual `Previous` and `Next` event controls. This makes it easy to inspect decisive moments and avoids adding autoplay timing/animation complexity to the first Lab report viewer.

### Retained report summary

The 25 KB summary includes aggregate match metrics plus compact resolver breakdowns for key highlights only. Routine events remain represented in the broadcast timeline without a retained per-event diagnostic payload.

### Bot-selection cards

Each Match Lab bot card shows all three decision inputs:

- Formation.
- OVR band.
- Tactical identity.

### Manager instruction retention

Reports store a concise code/LLM-generated summary of the user's manager instruction, not its verbatim text. The summary is sufficient to explain coach behavior in history while minimizing retained free-form user input.

## Match Lab final micro-UX — decided

### Manager instruction summary

The retained manager-instruction summary includes:

- Priorities.
- Discipline level.
- Detected tactical constraints.

This lets historical reports explain coach behavior without retaining the original free-text instruction.

### Historical feedback

A historical report displays that match's stored `Fun`, `Clarity`, and `Fairness` ratings alongside its result. This helps a player compare their own feedback with specific match behavior and supports later product analysis.

### Bot lineup visibility

Bot-selection cards initially show formation, OVR band, and tactical identity. After a user selects a bot, its full starting XI is revealed before the match begins, giving time to inspect matchups and revise the Lab squad.

### Experimental disclaimer

`/match-lab` displays:

```txt
Experimental match simulation. Results and balance are still being tuned.
AI agents can produce experimental behavior and occasional errors.
```

## Match Lab final flow — decided

### Bot selection

After revealing a bot XI, the player may freely switch bots before starting. This supports matchup exploration without forcing unnecessary reset steps.

### Squad changes after bot selection

If the Lab squad changes after a bot has been selected, show a confirmation that lets the player either keep the current bot matchup or return to bot selection. This makes the consequence explicit without forcing either path.

### Guided entry

The first Match Lab screen uses a short guided checklist:

```txt
1. Choose 11 eligible cards and a formation.
2. Choose a chapter-preview bot.
3. Inspect its starting XI and your matchup.
4. Start the experimental simulation.
```

### Access requirement

Match Lab requires the user to own at least 11 eligible cards. There is no demo squad path in Version 1; valid player-owned squads keep test feedback representative of the real collection loop.

## Brainstorm outcome

The product and Match Lab V1 specifications are now complete enough to create an implementation blueprint. Before implementation, inspect the current DeepSeek integration, `player_cards` schema/catalog, Squad Builder formation helpers, existing Cards pack/reward behavior, and Supabase conventions; then map this agreed scope to the smallest viable set of migrations, Edge Functions, routes, services, UI components, and tests.
