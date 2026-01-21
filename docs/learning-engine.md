# Learning behavior engine + accuracy upgrades

This document outlines a path to improve response accuracy and add a per-user learning behavior engine that adapts mock strategy over time while keeping the UI focused on mock analysis + next-best actions.

## Goals
- **More accurate insights**: make confidence/strategy grounded in measurable signals instead of heuristics alone.
- **Per-user learning**: learn patterns from a user's sequence of mocks, drills, and outcomes to recommend the highest-impact next steps.
- **UI focus**: keep the main surface tight—analysis summary + top next actions—with deeper details behind progressive disclosure.

## Data signals to capture (incrementally)
### Immediate (low effort)
- Probe outcomes: accuracy/time/self-confidence already exist in the UI (currently local-only).
- Mock metadata: score, time to finish, sections, topic tags (already in reports).
- Behavior signals: cadence, responsiveness, stuck loops (already in strategy plan).

### Next iteration
- **Outcome deltas**: track change between last 3 mocks (score, accuracy, speed).
- **Topic-level outcomes**: capture per-topic correctness where possible.
- **Error taxonomy**: reasoning vs. formula vs. reading vs. speed errors.

## Per-user learning behavior engine
### 1) Feature store (lightweight)
Create a small “derived features” collection per user:
- **user_learning_state**: `{ userId, exam, rollingAccuracy, rollingSpeed, weakTopics, behaviorTrend, lastUpdated }`
- Update after each mock analysis or probe completion.

### 2) Strategy memory + ranking
Use the existing `strategy_memory` snapshots plus a ranking layer:
- Store each strategy snapshot with **observed outcome** (next mock delta).
- Learn which levers improve outcomes per user (e.g., “timed sprints → +4% accuracy”).
- Rank suggested actions by:
  - **Expected impact** (personalized)
  - **Recency relevance** (last 2 mocks weighted)
  - **Feasibility** (time budget + minutes per day)

### 3) Recommendation engine (v1)
Start with a rules + scoring model, then evolve:
- Score = `impact_weight * evidence_strength * feasibility`.
- Evidence strength comes from per-user deltas and global priors (if user data sparse).
- Only return the **top 3 next actions**, each with a “why this now” line.

### 4) Continuous learning loop
After each mock:
- Compare predicted impact vs. actual delta.
- Adjust lever weights in the user learning state.
- Use exponential decay so newer results matter more.

## Improving accuracy of responses
1. **Persist probe metrics** to the backend (not just local storage).
2. **Add outcome deltas** to better detect real improvement vs. noise.
3. **Blend user data + global priors** for early-stage users.
4. **Calibrate confidence** using data volume + consistency (not just completion).

## UI strategy: keep focus on analysis + next best actions
### Main report page (above the fold)
1. **Analysis summary** (what went wrong, top 2–3 insights)
2. **Next-best actions** (3 cards, ranked)
3. **Progress bar + confidence** (simple, stable)

### Progressive disclosure
- “See more detail” expands:
  - Deep topic breakdown
  - Historical trends
  - Strategy memory + evidence

### Interaction guardrails
- Avoid overwhelming: cap to 3 actions.
- Each action has: effort + expected impact + reason.

## Implementation roadmap
### Phase 1 (1–2 sprints)
- Persist probe metrics (`/api/progress` or new `/api/metrics`)
- Create `user_learning_state` collection
- Add outcome delta computation after each mock
- Add API endpoint: `/api/next-actions`

### Phase 2 (2–3 sprints)
- Strategy ranking by personalized weights
- UI: “Next Best Actions” panel with 3 cards
- Add evidence display (small badge or tooltip)

### Phase 3 (ongoing)
- Evaluate with A/B tests on improvements
- Switch ranking to a lightweight model if data is sufficient

