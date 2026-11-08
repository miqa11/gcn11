# Gaicanian residents: implementation and acceptance status

This is a three-resident prototype. Live provider and production multiplayer acceptance checks are still required for the larger civilization vision. Controlled provider responses verify the integration contract; they are not evidence of real language-model intelligence or dialogue quality.

## Server setup

Set secrets in the hosting platform, never in browser code or a committed file:

```text
GAICANIAN_PROVIDER=groq
GROQ_API_KEY=<server secret from console.groq.com/keys>
GAICANIAN_MODEL=openai/gpt-oss-120b
DATA_DIR=<persistent disk directory>
CHAT_KEY=<existing stable encryption secret, at least 20 characters>
```

`CHAT_KEY` is the existing site's shared encryption setting. Do not replace an existing value: doing so makes previously encrypted private chats unreadable. The resident state uses the existing `server-chatcrypt` helper; without this setting the file is plaintext inside the protected server data directory. All resident data is stored in `gaicanians.json`, written atomically. An unreadable/encrypted-with-another-key save disables this feature rather than resetting citizens or breaking the other City systems.

No new npm dependencies are required. No API calls occur without a key for the selected provider. Movement, routines and persistence continue while dialogue is unavailable. Configuration is read at server startup; restart after configuring secrets.

Both provider adapters use structured JSON output, no tools, a 15-second timeout, two concurrent requests, 100 requests per UTC day globally and at most 24 autonomous requests per day. Quotas are persisted before sending the request. A provider error starts a 60-second circuit breaker. Autonomous identical-context responses have a bounded one-minute cache. Player speech is processed in a FIFO queue, with at most six outstanding messages per account and 24 globally (including the active reply). There is no additional eight-second delay or 20-turn account ceiling. Replies run one at a time, after existing autonomous calls finish; new autonomous generations yield while player speech is queued. The shared persisted 100-call UTC-day budget still applies. These limits are intentionally conservative for a three-character experiment; provider quotas and free-tier availability still apply.

### Free Groq setup on Render

1. Create an account on the **Groq Free Plan**, then create a server API key at [Groq API Keys](https://console.groq.com/keys). Do not upgrade to the paid Developer Plan.
2. Set the three provider variables shown above on the Render Web Service. If an old `GAICANIAN_MODEL` is present, replace its Gemini model name with `openai/gpt-oss-120b`.
3. Deploy the latest `main`, then run `node scripts/gaicanians-live-check.js` in Render Shell. This makes three real requests; it does not print the key. Test Georgian dialogue and grounded personality before claiming live acceptance.

Groq's official FAQ states that requests on the Free Plan are not charged: exceeding quota returns an error. Availability and quotas remain provider-controlled; free does not mean unlimited. The code retains its conservative local budgets and never falls back from Groq to Gemini or another provider when a request fails. Stay on the Free Plan to preserve the no-charge requirement; the application cannot determine the billing plan attached to a secret key.

The selected Groq model is `openai/gpt-oss-120b`. Its chat-completions adapter uses strict JSON schema with all properties required and validates grounded references and actions afterward. Reasoning effort is low and the completion ceiling is 1,600 tokens. Hostnames are fixed; arbitrary provider endpoints cannot be configured. Prompt data goes only to the selected provider.

`GAICANIAN_PROVIDER=groq` requires `GROQ_API_KEY` even if a Gemini key remains. If no provider is explicitly selected, a nonempty Groq key takes precedence; otherwise the previous Gemini setup remains supported. Explicit `GAICANIAN_PROVIDER=gemini` uses `GEMINI_API_KEY` and defaults to `gemini-3.1-flash-lite`. Gemini's `store:false` Interactions adapter remains available, but the user's Google project reports Free tier unavailable and is not a free working connection. Provider changes do not reset the persisted local budget.

The player-facing information panel displays the selected provider and its data terms without adding a consent gate or separate composer.

Primary references:

- [Groq Free Plan billing FAQ](https://community.groq.com/t/do-i-get-charged-for-anything-on-the-groq-free-plan/832)
- [Groq model availability](https://console.groq.com/docs/models)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq strict structured output](https://console.groq.com/docs/structured-outputs)
- [Groq data handling](https://console.groq.com/docs/your-data)
- [Gemini Interactions API reference](https://ai.google.dev/api/interactions-api)

## Three citizens

Lumo is a cautious arcade technician from a repair-family household. Miko is a sociable gardener who previously delivered parcels. Nela is an independent musician, Lumo's cousin. Each has a persistent adult age, birthday, biography, private memory, values, fear, household, traits, skills and preferred activity. Private biography fields are never broadcast or included in dialogue prompts.

The species is drawn directly in pixel canvas code: a small broad-headed yellow humanoid, large eyes, small limbs, distinctive hair and individual clothing/accessories. Walking, blinking, stretching/head-scratching idle poses, waving, dancing, sleeping, tripping and job-specific tool animations use the shared citizen state. Overhead labels say AI; the interaction panel explicitly explains that these are fictional characters with simulated emotions.

## Simulation and consequences

A simulated day is 24 real minutes. Jobs have shift windows, actual walkable outdoor work locations and fictional wages. Hunger, energy, social needs and fun compete with responsibility, personality, emotional stress and current goals. Walkable-grid search, segment validation and nearby-car avoidance execute travel through the existing map. These citizens neither occupy player vehicle seats nor change Casino, Arcade or Garden game rules.

Work pays a private citizen wallet, advances skills and consumes energy. Food consumes that wallet. Rest restores energy. Practice improves the skill required by a current goal at the relevant job site. Saving enough money and developing sufficient skill buys a visible personal project near home; completing a project selects another feasible ambition. Eligible model intentions can influence utility choices or a job change, but cannot set money, execute commands or alter accounts. Skills and thresholds are authoritative. A validated optional goal proposal selects an executable project from the registered goal catalog; conversation-tone appraisal can affect simulated mood and trust within bounded rules. Citizen needs keep evolving without players, using bounded catch-up and no offline AI calls.

Nearby citizens meet, gain familiarity/trust, learn some of each other's skills, share witnessed facts with `heard` provenance, disagree according to traits, and reconcile. Relationship and emotional variables persist. Emotion changes have explicit causes and decay; stress and attachment influence decisions. Personality confidence/extraversion change gradually through social experience. Birthday and milestone records extend their life histories. This is a computational model, not a claim of subjective feelings.

Player gestures, invitations, gifts and help requests are proximity-checked. A gift consumes one real sticker from the player's existing City inventory, is limited to one per citizen per day, and does not buy instant friendship. Friendship requires existing familiarity and trust. Workload, stress and energy can cause refusal. The model never directly consumes player inventory; the explicit validated gift endpoint does.

## Dialogue, knowledge and privacy

Substantive conversation and reflection use the selected provider. Routine greetings and gesture acknowledgments are the only scripted chatter. An unavailable model returns an explicit unavailable response, never a fake generated answer. Residents pause while nearby street speech is queued, answer even when working or stressed, and then resume their plans. Their wording and boundaries still follow the character. Each queued turn builds its history after the previous answer is saved. Excess queue submissions get an explicit Georgian error; accepted messages are never overwritten by a later follow-up. Presence, proximity and memory revision are checked again before calling the provider and before delivering its answer; forgetting or leaving cancels stale turns. Citizen-to-citizen generated exchanges appear as staggered speech bubbles. Old private transcripts are excluded from public conversation prompts.

Every character receives only its own biography, current state and relevant bounded memories/beliefs. Public street conversation uses only records tagged `nearby`; pre-existing private chat records are never injected into a public answer. Observations are proximity-limited. Existing tower signals are witnessed anonymously; private user messages are not City news. Shared facts retain witnessed/heard/reflection provenance. Output speaker IDs, referenced fact IDs, lengths and intention enums are validated; unknown event references are rejected. Semantic truth and personality consistency still require live model evaluation: valid fact references alone cannot prove every generated sentence is accurate.

Players speak to residents through the existing **საუბარი** button and the ordinary validated `city:message` endpoint. No separate resident composer, language selector or consent/remember checkboxes are required. A resident must be within 110 world units, outdoors and reachable without a wall between them. The player cannot be in a vehicle, ride, locked activity or game. Only validated street messages reach the resident engine; private/vehicle/garden/ride and Casino messages do not. The closest listener answers, or a nearby resident named in the message. One listener answers per message, preventing multiple simultaneous responses. Georgian/English is detected from the message. Replies use the existing public message channel and shared resident speech bubbles, visible to other players. Long bubbles wrap instead of losing most of the reply.

Street conversations and relationships are remembered automatically under a salted pseudonymous account identifier, with per-record 30-day retention. The information panel retains **forget**: it deletes player-linked dialogue/relations and cancels an in-flight answer. New conversations can establish new memories afterward. Session context is bounded to eight turns and expires after 30 minutes. Player-specific dialogue is excluded from autonomous prompts; provider retention is governed separately by the selected service. The informational disclosure and terms link are present without blocking gameplay.

Memory is bounded to 48 entries per citizen. Significant milestones survive routine eviction. This prioritizes bounded storage over unlimited autobiography; older minor history is not a complete transcript. No private character secret is automatically disclosed.

## Validation and remaining acceptance

Run the deterministic/integration suite:

```sh
node --test tests/gaicanians.test.js
```

Twenty-one resident tests currently cover distinct persisted biographies, autonomous/offline purchases and learning, relationships and knowledge transfer, route safety, caused moods, differing choices, public multi-turn context, restart memory, forgetting during a request, retention, observation scope, validated intentions, REST payloads and quota persistence, outage handling and private/autonomous isolation. The language-model responses in these tests are controlled fixtures.

The combined suite has 58 passing tests, including three integration checks that execute the production `city:message` handler to verify validation, immediate acknowledgements, occupied states and Casino isolation. The resident tests include no-checkbox public replies, named/nearest listener selection, distance/walls, stale reply cancellation, old private transcript isolation and provider error classification.

A local two-client browser harness checked desktop (1440×1000) and mobile (390×844): the production message handler, ordinary Talk composer, public synchronized replies, Georgian/English detection, memory through a simulation restart, forgetting, no private composer/checkboxes, no page errors and no mobile overflow. Both Gemini and Groq responses in local browser checks were controlled fixtures; this is not live model proof.

After configuring the actual server secret, run:

```sh
node scripts/gaicanians-live-check.js
```

This makes three real calls to the selected provider with artificial test dialogue, validates multi-turn English recall across a saved simulation restart and Georgian output, and then forgets the test player. It writes only to `work/gaicanians-live-check/state.json`. No key is printed. It exits with code 2 when the key is missing. Review its transcript for coherent personality, job/location truth and grounded intentions; automated assertions alone are insufficient.

Before marking the feature complete, also demonstrate on the deployed server: two real clients observing a walking/working resident; original citizen-to-citizen dialogue grounded in actual learned events; a real multi-turn player conversation with mood/personality effects; street-conversation memory after a process restart; successful forgetting; autonomous goals/skills and relationships over several simulated days; continued evolution while offline; and expected behavior under quota/provider failure. Live provider and full production checks remain pending.

The current prototype deliberately stays at three residents. Dynamic romance, household formation, descendants, unlimited new occupations/items, a full psychological model of every listed emotion, and unrestricted invention of executable new goals are not implemented. The identity, relationship, needs, memory, validated-intention and project registries provide extension points. Do not describe those future systems or the complete civilization vision as finished.

## Diagnosing the provider on Render

Keep the selected provider key on the running Web Service and deploy/restart after setting it. The adapter trims whitespace around the key/model setting and accepts a model ID with or without `models/`. No key, prompt or raw provider response is printed. Six additional provider tests cover Groq selection, strict request/response schema, shared budgets, quota backoff without fallback, output validation and missing-key behavior.

The old generic error did not identify why a request failed. Server logs now report `[GAICANIANS] Dialogue failed: CODE` with:

| Code | Meaning / next step |
| --- | --- |
| `AI_AUTH` | HTTP 401/403: check the key's validity, project restrictions and API access. |
| `AI_QUOTA` | HTTP 429: check this model's account/model quota in the selected provider console; wait for quota reset. |
| `AI_MODEL` | HTTP 404: check `GAICANIAN_MODEL` availability for the project. |
| `AI_REQUEST` | HTTP 400: request/configuration rejected; review the adapter contract. |
| `AI_OUTPUT` | JSON, completion status or grounding validation failed. |
| `AI_TIMEOUT` | The 15-second request deadline elapsed. |
| `AI_UNAVAILABLE` | Other provider/network failure. |
| `AI_LIMIT` | Local request/concurrency budget reached. |

Auth/quota/model/request failures also get distinct Georgian feedback in the ordinary City toast. A 60-second backoff retains the underlying failure code. The Google project reports Free tier unavailable. Switch to the Groq Free Plan as described above; use the live-check script or these log codes for any remaining failure. The request/response contract was checked against the [official Interactions API reference](https://ai.google.dev/api/interactions-api); no real provider key was available in the development workspace.

## Rapid conversation regression checks

The follow-up queue is covered by deterministic delayed-provider tests for multiple quick messages, context ordering, more than 20 turns without an artificial account ceiling, background-generation priority, real-adapter concurrency, stressed working residents, separate account histories, forgetting active/queued turns, disconnect/distance cancellation, bounded queues, provider failure cleanup and a resident staying put during slow replies. These use controlled provider responses; they do not establish live availability. The existing City street-message spam interval remains 1.2 seconds; rejected submissions retain the composer draft and show an error. Provider failures and the shared daily/free-provider quotas still return explicit errors, and no paid fallback is introduced. Queued speech is in memory and is not replayed after a server restart.
