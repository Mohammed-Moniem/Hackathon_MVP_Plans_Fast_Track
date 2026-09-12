# MentorOS — Hackathon MVP Plan

## 1. Goal

Build a **persistent personal mentor platform** where specialized agents understand the user's real-life context, proactively detect when plans should change, coordinate with one another, recommend a new plan, obtain approval, and then update the user's schedule and goals.

For the hackathon MVP:

- **Health Mentor = primary, polished demo experience**.
- **Career Mentor = functional enough to prove multi-mentor coordination**.
- **Finance Mentor = visible platform stub only**.

The demo must be fully achievable by end of day using **mock integrations and realistic historical data**, not real Apple Health, Google Health Connect, banking, messaging, or calendar integrations.

**Hackathon implementation rule:** choose the shortest technical path that proves proactive agency, personalization, coordination, approval, and visible action. Production plumbing is secondary.

Core loop:

> Life event/data change → context aggregation → pattern detection → mentor reasoning → mentor-to-mentor arbitration → proposed plan → human approval → schedule/plan mutation → progress memory

---

# 2. Product vision

MentorOS is not another assistant that waits for a question.

It is a platform of persistent domain mentors that:

- know the user's goals;
- continuously understand context;
- notice changes;
- make proactive recommendations;
- coordinate when goals conflict;
- take actions after approval;
- monitor adherence over time;
- learn what actually works for the user.

Potential mentors:

- Health Mentor;
- Career Mentor;
- Finance Mentor;
- Learning Mentor;
- Productivity Mentor;
- Relationship Mentor;
- Travel Mentor.

For the hackathon, we prove the platform through Health + Career coordination.

---

# 3. Why this can win

The strong version of MentorOS is not:

> “Ask AI for a workout.”

It is:

> “The system notices that today's context changed, predicts that the existing plan will fail based on your own history, negotiates priorities across mentors, proposes a better plan, and updates your schedule after approval.”

This demonstrates:

- ambient/proactive agency;
- multi-source context;
- personalization from longitudinal data;
- tool use;
- cross-agent coordination;
- human-in-the-loop action;
- memory and adaptation.

---

# 4. MVP scenario

## Hero scenario

The user has:

- a health goal to lose weight and improve consistency;
- a career goal to prepare for TOGAF;
- an existing evening workout;
- an existing 90-minute study block;
- a busy work calendar.

A new late work meeting is added to the calendar.

MentorOS automatically notices:

1. tonight's existing schedule is no longer realistic;
2. historical data shows workouts after 8:30 PM are frequently skipped;
3. sleep drops when the user studies too late;
4. TOGAF exam target requires a minimum study pace;
5. today's activity level is below target.

Health Mentor and Career Mentor negotiate a revised plan.

Suggested outcome:

- shorten workout from 60 to 25 minutes;
- move it to immediately after work;
- reduce study block from 90 to 45 minutes tonight;
- move remaining 45 minutes to tomorrow morning;
- preserve bedtime;
- adjust dinner recommendation to a fast high-protein meal based on remaining calories;
- create grocery items only if pantry mock indicates missing ingredients.

User approves.

MentorOS updates:

- mock calendar;
- workout plan;
- study plan;
- meal plan;
- progress dashboard.

---

# 5. Demo-first architecture

```text
┌─────────────────────────────┐
│ Mock Data Sources           │
│ Health / Calendar / Meals   │
│ Career / Study / Goals      │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Personal Context Hub        │
│ unified user state          │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Metrics / Pattern Engine    │
│ deterministic calculations │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Mentor Agents               │
│ Health + Career             │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Mentor Arbiter              │
│ resolves conflicts          │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Approval Layer              │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Action Executor             │
│ calendar/workout/study/meal │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Memory + Progress           │
└─────────────────────────────┘
```

---

# 5A. Fastest-track architecture decision

MentorOS has a potentially large platform vision, but the hackathon implementation should be intentionally small. The architecture must prove **proactive context awareness + multi-mentor coordination + action**, not build a production personal-data platform.

## Architecture principle

Build one **Next.js TypeScript monolith** with two logical mentor modules and one arbiter. Do not build separate agent services.

```text
Browser
  ↓
Next.js app
  ├─ Today / Timeline UI
  ├─ scenario trigger + reset
  ├─ personal context builder
  ├─ deterministic pattern engine
  ├─ Health Mentor call
  ├─ Career Mentor call
  ├─ deterministic constraints + Arbiter call
  └─ local action/state mutation
       ↓
OpenAI structured-output calls
```

All “connected apps” in the demo are adapter façades over local fixtures.

## Fastest viable stack

```text
Language: TypeScript end to end
Framework: Next.js App Router
UI: React + Tailwind CSS
Components: shadcn/ui only where it accelerates the UI
Validation/contracts: Zod
LLM: OpenAI SDK with structured outputs
Mock data: local JSON/TypeScript fixtures
Mutable state: in-memory state or a single local JSON state snapshot
Dates: date-fns if needed
Charts: avoid unless one tiny trend visualization adds clear value
Deployment: local laptop first; optional Vercel after stability
```

## Deliberate non-choices

Do not spend hackathon time on:

- Apple HealthKit / Google Health Connect native integration;
- bank APIs/open banking;
- OAuth;
- vector databases;
- real-time event buses;
- a generic multi-agent framework;
- LangGraph/CrewAI/AutoGen unless the team already has working code ready;
- separate services per mentor;
- mobile applications;
- production authentication;
- production-grade health-data security infrastructure;
- long-term database design.

Those are future architecture concerns. The judging value is in the mentor behavior.

## Two-mentor implementation without framework overhead

Run Health and Career mentor analysis in parallel after one context build:

```ts
async function runMentorOS(trigger: MentorEvent) {
  const context = await buildPersonalContext(trigger)
  const metrics = calculatePersonalMetrics(context)

  const [healthProposal, careerProposal] = await Promise.all([
    runHealthMentor({ context, metrics }),
    runCareerMentor({ context, metrics }),
  ])

  const combinedPlan = await arbitrateMentorPlans({
    context,
    metrics,
    healthProposal,
    careerProposal,
  })

  return createApprovalProposal(combinedPlan)
}
```

This gives the visible effect of multi-agent collaboration with only 2–3 model calls and almost no orchestration infrastructure.

## Arbiter design

Do not rely entirely on an LLM to resolve conflicts. Apply hard constraints first:

```text
1. immutable work meeting remains;
2. minimum sleep stays protected;
3. overlapping blocks are invalid;
4. deadline-critical goals receive minimum required progress;
5. favor historically successful time slots.
```

Then pass only the feasible options to the arbiter model for synthesis and explanation.

This creates a convincing “mentors disagree, system resolves” moment while keeping outcomes stable.

## LLM call budget

Target:

- 1 Health Mentor call;
- 1 Career Mentor call;
- 1 Arbiter call.

Run the first two concurrently. Total hero-flow latency should remain around 4–7 seconds. If latency is a concern, Health and Career proposals can be partly rule-generated and use one final arbiter LLM call.

## Mock integration implementation

Each source should have a tiny adapter contract:

```ts
interface HealthAdapter {
  getDailyMetrics(days: number): Promise<Array<HealthMetric>>
}

interface CalendarAdapter {
  getEvents(range: DateRange): Promise<Array<CalendarEvent>>
  applyChanges(changes: Array<CalendarChange>): Promise<void>
}
```

For today:

```ts
const healthAdapter = new MockHealthAdapter(fixtures)
const calendarAdapter = new MockCalendarAdapter(scenarioState)
```

The UI can label them “Apple Health,” “Google Calendar,” etc., with a clear demo/mock badge if desired. The adapter boundary makes the future integration story credible.

## State strategy

```text
Immutable user history     → /fixtures/mentoros/*.json
Current day + plans        → mutable scenario state
Approved changes           → mutate scenario state
Memory                      → append to local state
Reset                       → restore scenario seed
```

No database is required for a local hackathon demo.

## Recipe strategy

Do not use live internet recipe search in the critical path. Seed 10–20 realistic recipes with:

- calories;
- protein;
- prep time;
- ingredients;
- tags.

The agent selects the best matching local recipe based on remaining calories, protein gap, available cooking time, and pantry state. This is faster and more reliable, and still demonstrates tool use.

## Fastest architecture that still proves MentorOS

The judges need to see:

1. a real-world event changes the user's context;
2. the system reacts without a prompt;
3. longitudinal data produces a personalized pattern;
4. Health and Career mentors have competing objectives;
5. an arbiter creates a viable compromise;
6. the user approves;
7. calendar/workout/study/meal state visibly changes;
8. the system writes memory for the next decision.

Anything not contributing to those eight moments is secondary.

---

# 6. Frontend screens

## Screen A — Today

Top summary:

- energy/readiness;
- sleep;
- steps;
- calories;
- workout status;
- career study status;
- next major commitment.

Timeline:

```text
07:00 Breakfast
08:30 Work
18:00 Workout
19:15 Dinner
20:00 TOGAF study
22:30 Wind down
23:00 Sleep
```

When scenario triggers, show the conflicting meeting inserted into the timeline.

## Screen B — Mentor Activity

Live activity feed:

```text
Health Mentor detected schedule conflict
Health Mentor checked 30-day adherence history
Career Mentor checked TOGAF study pace
Health Mentor proposed shorter workout
Career Mentor requested 45 min protected study time
Mentor Arbiter generated combined plan
Waiting for approval
```

## Screen C — Proposal Diff

Before / after calendar.

Example:

```text
BEFORE
18:00–19:00 Workout
20:00–21:30 TOGAF Study

NEW EVENT
17:30–19:00 Work meeting

PROPOSED
19:15–19:40 25-min workout
19:45–20:10 quick dinner
20:15–21:00 TOGAF study
06:45–07:30 tomorrow: remaining TOGAF study
23:00 sleep preserved
```

Approve / Modify / Reject.

## Screen D — Mentor Marketplace / Platform View

Cards:

- Health Mentor — Active;
- Career Mentor — Active;
- Finance Mentor — Available / Demo Preview.

Do not spend significant engineering effort here. It exists to communicate extensibility.

## Screen E — Data / Evidence Drawer

Displays the exact personal patterns behind recommendations.

Example:

> “You complete 82% of workouts started before 7:30 PM, but only 29% after 8:30 PM.”

Show supporting days.

---

# 7. Mock integrations

The UI should display these as “Connected” sources even though adapters read local fixtures.

```text
Apple Health / Health Connect       → mock health adapter
Apple Calendar / Google Calendar    → mock calendar adapter
Nutrition / Meal Log                → mock nutrition adapter
Workout History                     → mock fitness adapter
Career Profile / CV                 → mock career profile adapter
Study Tracker                       → mock study adapter
Goals                               → local goal store
Pantry / Grocery list               → mock household adapter
```

The adapter interface is what matters. Later the local mocks can be replaced with actual APIs.

---

# 8. Entry points / triggers

MentorOS should act from events, not chat prompts.

Primary hackathon trigger:

```json
{
  "source": "calendar",
  "type": "calendar_event_created",
  "eventId": "CAL-NEW-001",
  "start": "2026-09-12T17:30:00+04:00",
  "end": "2026-09-12T19:00:00+04:00",
  "title": "Urgent architecture review",
  "priority": "high"
}
```

Other event types supported conceptually:

```text
health_metric_updated
sleep_completed
workout_missed
meal_logged
study_session_completed
study_session_missed
goal_deadline_changed
calendar_event_created
calendar_event_updated
```

Only one trigger needs to be polished today.

---

# 9. Personal Context Hub

Normalize all source data before mentor reasoning.

```ts
interface PersonalContext {
  profile: UserProfile
  goals: Array<Goal>
  health: HealthContext
  sleepHistory: Array<SleepRecord>
  activityHistory: Array<ActivityRecord>
  workouts: Array<WorkoutRecord>
  nutrition: Array<NutritionRecord>
  calendar: Array<CalendarEvent>
  career: CareerContext
  studyHistory: Array<StudySession>
  pantry: Array<PantryItem>
  mentorPreferences: MentorPreferences
  derivedMetrics: PersonalMetrics
}
```

---

# 10. Mock data required

The data should create believable longitudinal patterns, not random values.

## 10.1 User profile

```json
{
  "userId": "USER-001",
  "name": "Mo",
  "age": 35,
  "heightCm": 178,
  "weightKg": 86,
  "targetWeightKg": 80,
  "timezone": "Asia/Dubai",
  "workStart": "08:30",
  "workEnd": "17:30",
  "preferredBedtime": "23:00",
  "preferredWakeTime": "06:30",
  "cookingPreference": "quick meals",
  "maxWeekdayCookingMinutes": 20
}
```

Use fictionalized/demo values if needed; the exact personal values are not important to the architecture.

---

## 10.2 Health metrics — 30 days

Create **30 days** of:

- steps;
- active calories;
- resting heart rate;
- exercise minutes;
- weight;
- optionally HRV/readiness if useful.

Fields:

```json
{
  "date": "2026-09-11",
  "steps": 6420,
  "activeCalories": 410,
  "exerciseMinutes": 28,
  "restingHeartRate": 63,
  "weightKg": 85.8
}
```

Pattern to encode:

- low activity on meeting-heavy days;
- better adherence when workout starts before evening becomes late.

---

## 10.3 Sleep — 30 days

Fields:

```json
{
  "date": "2026-09-11",
  "bedtime": "23:22",
  "wakeTime": "06:18",
  "durationMinutes": 416,
  "qualityScore": 78
}
```

Pattern to encode:

- late study/work correlates with shorter sleep;
- sleep below 6.5 hours lowers next-day workout adherence.

---

## 10.4 Workout history — 20–30 workouts

Fields:

```json
{
  "workoutId": "WO-021",
  "scheduledStart": "20:45",
  "actualStart": null,
  "plannedMinutes": 60,
  "completedMinutes": 0,
  "type": "strength",
  "status": "skipped",
  "reason": "late_workday"
}
```

Deliberately encode the pattern:

- before 19:30 → ~80% completion;
- after 20:30 → ~30% completion.

Compute this from fixtures.

---

## 10.5 Nutrition — 14–30 days

Fields:

- calories;
- protein;
- carbs;
- fat;
- meal time;
- meal prep time;
- logged meal;
- skipped meal;
- takeout flag.

Example:

```json
{
  "date": "2026-09-11",
  "meal": "dinner",
  "calories": 710,
  "proteinG": 38,
  "prepMinutes": 0,
  "takeout": true,
  "time": "21:20"
}
```

Pattern to encode:

- late meetings increase takeout likelihood;
- quick pre-planned meals improve calorie adherence.

---

## 10.6 Calendar — 4 to 8 weeks

Create realistic events:

- work blocks;
- recurring standups;
- architecture meetings;
- commute/travel;
- workouts;
- study sessions;
- social commitments;
- sleep/wind-down blocks.

The mock data should allow metrics like:

- meeting-heavy day count;
- available focus windows;
- schedule fragmentation;
- conflict frequency.

---

## 10.7 Goals

```json
[
  {
    "goalId": "GOAL-HEALTH-001",
    "domain": "health",
    "title": "Reach 80 kg",
    "targetDate": "2026-12-31",
    "priority": 8,
    "status": "active"
  },
  {
    "goalId": "GOAL-CAREER-001",
    "domain": "career",
    "title": "Pass TOGAF 10",
    "targetDate": "2026-10-31",
    "priority": 9,
    "status": "active"
  }
]
```

---

## 10.8 Career profile

Mock fields:

- current role;
- years of experience;
- major skills;
- certifications;
- target roles;
- skill gaps;
- target salary band if desired;
- active learning plan.

For demo:

```json
{
  "currentRole": "Senior Software Engineer / Tech Lead",
  "targetRole": "Solution Architect",
  "certifications": ["PMP"],
  "recommendedNextCredential": "TOGAF 10",
  "examTargetDate": "2026-10-31"
}
```

---

## 10.9 TOGAF study plan

Create modules:

- Foundation concepts;
- ADM;
- Enterprise Continuum;
- governance;
- practice exams.

Fields:

```json
{
  "moduleId": "TOGAF-ADM",
  "plannedMinutes": 240,
  "completedMinutes": 150,
  "deadline": "2026-09-18",
  "masteryScore": 0.64
}
```

---

## 10.10 Study history — 20+ sessions

Encode patterns:

- 45–60 minute sessions have good completion;
- sessions scheduled after 10 PM often fail;
- morning makeup sessions succeed often.

Fields:

```json
{
  "sessionId": "STUDY-019",
  "plannedStart": "22:00",
  "plannedMinutes": 90,
  "completedMinutes": 25,
  "status": "partial",
  "topic": "ADM"
}
```

---

## 10.11 Pantry / groceries

Simple fixture:

```json
[
  { "item": "eggs", "quantity": 6 },
  { "item": "Greek yogurt", "quantity": 1 },
  { "item": "chicken breast", "quantity": 0 },
  { "item": "rice", "quantity": 1 },
  { "item": "mixed vegetables", "quantity": 1 }
]
```

Used to make the meal recommendation actionable.

---

## 10.12 Finance Mentor stub data

Only enough to show platform extensibility:

```json
{
  "monthlyIncome": 30000,
  "monthlySpend": 24500,
  "categories": {
    "housing": 8500,
    "groceries": 2600,
    "shopping": 4100,
    "transport": 1800,
    "subscriptions": 900
  },
  "savingsGoal": 6000
}
```

No finance agent execution is required today.

---

# 11. Deterministic metrics / pattern engine

Do not let the LLM invent the personal analytics.

Functions:

```ts
calculateWorkoutAdherenceByTimeOfDay()
calculateAverageSleep()
calculateSleepVsWorkoutCorrelation()
calculateMeetingLoad()
calculateAvailableFocusWindows()
calculateStudyAdherence()
calculateStudyPaceVsExamDate()
calculateRemainingCalories()
calculateProteinGap()
calculateDailyActivityGap()
calculateGoalRiskScores()
```

Example output:

```json
{
  "workoutCompletionBefore1930": 0.82,
  "workoutCompletionAfter2030": 0.29,
  "averageSleepHours": 6.9,
  "studyMinutesRequiredPerDay": 52,
  "studyMinutesCompletedToday": 0,
  "remainingCalories": 620,
  "remainingProteinG": 48,
  "activityGapSteps": 3400
}
```

---

# 12. Mentor tool map

## Shared read tools

```text
get_user_profile()
get_goals()
get_calendar(range)
get_health_history(range)
get_sleep_history(range)
get_workout_history(range)
get_nutrition_history(range)
get_career_profile()
get_study_plan()
get_study_history(range)
get_pantry()
get_derived_metrics()
```

## Health Mentor tools

```text
analyze_health_day()
recommend_workout_adjustment()
recommend_meal()
calculate_daily_health_risk()
```

## Career Mentor tools

```text
analyze_study_pace()
recommend_study_adjustment()
calculate_exam_readiness()
```

## Arbiter tools

```text
collect_mentor_proposals()
resolve_schedule_conflicts()
score_combined_plan()
create_plan_diff()
```

## Action tools

```text
request_plan_approval()
update_calendar()
update_workout_plan()
update_study_plan()
update_meal_plan()
update_grocery_list()
write_mentor_memory()
append_activity_event()
```

---

# 13. Mentor output contracts

## Health Mentor

```ts
interface HealthMentorProposal {
  issue: string
  evidence: Array<string>
  priority: number
  requestedTimeBlocks: Array<TimeBlock>
  workoutChange: WorkoutChange | null
  mealRecommendation: MealRecommendation | null
  impactIfIgnored: string
}
```

## Career Mentor

```ts
interface CareerMentorProposal {
  issue: string
  evidence: Array<string>
  priority: number
  requestedTimeBlocks: Array<TimeBlock>
  studyChange: StudyChange | null
  impactIfIgnored: string
}
```

## Arbiter

```ts
interface CombinedMentorPlan {
  rationale: string
  conflictsDetected: Array<string>
  mentorCompromises: Array<string>
  proposedCalendarChanges: Array<CalendarChange>
  proposedWorkoutChange: WorkoutChange | null
  proposedStudyChange: StudyChange | null
  proposedMealChange: MealRecommendation | null
  groceryChanges: Array<GroceryChange>
  confidence: number
}
```

---

# 14. Mentor arbitration rules

The arbiter should not simply let the LLM improvise priority.

Use explicit rules plus LLM synthesis.

Example rules:

1. Hard work/calendar commitments cannot be deleted automatically.
2. Preserve minimum sleep target unless user explicitly overrides.
3. Protect deadlines with high goal risk.
4. Prefer shorter viable sessions over cancellation.
5. Prefer time slots with historically higher adherence.
6. Do not schedule overlapping mentor activities.
7. Require approval before modifying calendar.

A simple scoring function can rank plans:

```text
Plan score =
  health adherence probability
+ career deadline protection
+ sleep preservation
+ user preference fit
- schedule disruption
- conflict penalty
```

---

# 15. Recommended hero insight

The strongest demo insight should be computed from mock data:

> “Your planned 8:45 PM workout now has only a 29% predicted completion rate based on the last 30 days. Moving to a 25-minute session at 7:15 PM preserves your weekly target and lets you keep 45 minutes of TOGAF study without reducing sleep.”

That single sentence proves:

- longitudinal data;
- personalization;
- prediction;
- health reasoning;
- career reasoning;
- schedule coordination.

---

# 16. Approval flow

MentorOS should never silently rewrite the user's life in the demo.

Proposal card:

```text
MentorOS found a conflict.

Why:
- late meeting added
- workout completion probability drops to 29%
- TOGAF study pace is already 8% behind
- bedtime must remain at 23:00

Proposed changes:
- workout: 60 min → 25 min
- study tonight: 90 min → 45 min
- add 45 min tomorrow morning
- dinner: 20-minute high-protein meal

[Approve plan] [Modify] [Reject]
```

Approval triggers visible mutations.

---

# 17. Meal / grocery mini-flow

Do not turn this into a separate product. Keep it as a supporting wow moment.

After schedule arbitration:

1. Health Mentor sees only ~20 minutes available for dinner.
2. Remaining calorie/protein target is calculated.
3. Pantry adapter is checked.
4. Agent recommends one quick meal.
5. Missing ingredient gets added to mock grocery list.

Example:

> “15-minute chicken-and-vegetable rice bowl. Approx. 560 kcal / 52g protein. Chicken is missing, so I added it to tonight's grocery list.”

If recipe search is too risky for today, use a local recipe fixture with 10–20 recipes instead of live web search.

---

# 18. Evidence and provenance

Every recommendation should show where it came from.

Example evidence drawer:

```text
Workout recommendation
- 11 workouts before 19:30 → 9 completed
- 7 workouts after 20:30 → 2 completed
- 4 skipped workouts followed meeting-heavy days

Career recommendation
- TOGAF target requires 52 min/day
- last 7-day average = 41 min/day
- morning makeup sessions completed 4/5 times
```

The numbers must be derived from fixtures.

---

# 19. Memory

After the user approves a plan, write a small memory object.

```json
{
  "memoryId": "MENTOR-MEM-001",
  "type": "schedule_adjustment",
  "observation": "User accepted shorter early-evening workouts to preserve study and sleep on meeting-heavy days.",
  "createdAt": "2026-09-12T20:00:00+04:00",
  "confidence": 0.8
}
```

Later scenarios can read this to make the system appear adaptive.

---

# 20. Failure / recovery path

Recommended controlled failure:

Career Mentor proposes a 90-minute late-night study block to recover exam pace.

Health Mentor rejects it because it would push sleep below the minimum threshold.

Arbiter resolves:

- 45 minutes tonight;
- 45 minutes tomorrow morning.

This is an excellent multi-agent demo moment because the mentors do not blindly agree.

---

# 21. Scenario manifests

```text
/scenarios
  /mentoros
    scenario-01-calendar-conflict.json
    scenario-02-low-sleep.json
    scenario-03-study-behind.json
```

Manifest shape:

```json
{
  "scenarioId": "MO-001",
  "name": "Late Work Meeting",
  "initialState": {},
  "triggerEvent": {},
  "expectedPatterns": [],
  "expectedMentorConflict": true,
  "expectedPlan": {},
  "expectedFinalState": {}
}
```

Reset = restore all fixture state.

---

# 22. Technical implementation — fastest track

This is the implementation contract for Codex/the build team.

## Mandatory implementation shape

Use one Next.js application, one codebase, and one local scenario state.

```text
Next.js
├─ app/                         screens + route handlers
├─ components/                  timeline, proposal diff, activity
├─ lib/
│  ├─ mentoros/
│  │  ├─ orchestrator.ts
│  │  ├─ context.ts
│  │  ├─ metrics.ts
│  │  ├─ health-mentor.ts
│  │  ├─ career-mentor.ts
│  │  ├─ arbiter.ts
│  │  └─ actions.ts
│  ├─ adapters/                 mock source adapters
│  └─ schemas/                  shared Zod contracts
├─ fixtures/mentoros/           longitudinal mock data
└─ scenarios/mentoros/          deterministic seeds
```

## Minimal packages

```text
next
react
zod
openai
date-fns (optional but useful)
(optional) existing shadcn/ui dependencies
```

No database/agent framework is required.

## Implementation order by value

### P0 — must exist

1. fixture generator/seed files;
2. resettable scenario state;
3. Today timeline;
4. calendar-event trigger;
5. deterministic metrics/pattern engine;
6. Health Mentor structured proposal;
7. Career Mentor structured proposal;
8. arbitration + combined plan;
9. approval card;
10. visible calendar/workout/study mutations.

### P1 — high-value polish

11. evidence drawer;
12. meal/pantry recommendation;
13. mentor activity feed;
14. memory write;
15. finance mentor teaser card.

### P2 — cut first

16. charts;
17. additional mentors;
18. multiple user profiles;
19. real health/calendar integrations;
20. live web recipe search.

## Fixture generation

Do not hand-write hundreds of records. Write one deterministic fixture generator script with a fixed seed.

Example responsibilities:

```text
generate 30 health days
generate 30 sleep days
generate 24 workouts with the required adherence pattern
generate 22 study sessions with the required late-night pattern
generate 6 weeks of calendar events
write JSON files
```

Then manually curate only the few records displayed in the evidence drawer. This saves substantial implementation time while keeping the dataset rich.

## Pattern engine

Keep analytics as plain TypeScript functions over arrays. Do not introduce ML.

```ts
const metrics = {
  workoutCompletionBefore1930: ratio(...),
  workoutCompletionAfter2030: ratio(...),
  studyMinutesRequiredPerDay: calculateStudyPace(...),
  averageSleepHours: average(...),
  remainingCalories: calculateRemainingCalories(...),
}
```

The agent explains the patterns; code computes them.

## Mentor prompts

Give each mentor only its relevant slice of the normalized context plus shared constraints. This reduces token count and keeps responses focused.

```text
Health Mentor → health, sleep, workout, nutrition, schedule constraints
Career Mentor → career goal, study history, deadline, schedule constraints
Arbiter → two mentor proposals + hard constraints + available time slots
```

Require Zod-valid structured output from every model call. Retry once; then use a scenario fallback.

## Demo-safe fallbacks

Store deterministic fallback outputs for:

```text
MO-001 health proposal
MO-001 career proposal
MO-001 combined plan
```

If a live model request fails, the demo continues and all approval/action behavior still works.

## UI speed strategy

Do not build a complex dashboard. One primary screen can contain:

```text
left/center: today's timeline
right top: mentor activity
right middle: evidence / metrics
right bottom: proposed changes + approval
```

A separate mentor marketplace can be a simple modal/drawer/card row shown only at the end.

## Action executor

Approving a plan should mutate local state synchronously:

```ts
applyCalendarChanges(plan.proposedCalendarChanges)
applyWorkoutChange(plan.proposedWorkoutChange)
applyStudyChange(plan.proposedStudyChange)
applyMealChange(plan.proposedMealChange)
appendMentorMemory(plan)
```

The UI should immediately rerender from the updated state. No asynchronous integration layer is needed.

## Optional real integration stretch goal

If the core demo is complete early, connect **one** real service with the lowest setup cost, preferably Google Calendar. Do not let OAuth or API setup threaten the stable mock-based hero flow.

## Technical success criterion

MentorOS is technically sufficient when the team can insert the late meeting, watch two mentor proposals appear from real data calculations, see a conflict resolved, approve the combined plan, and immediately see the user's day rewritten. That is the product; the production plumbing can come later.

---

# 23. Suggested repository structure

```text
/apps/web

/src
  /agents
    /health-mentor
      agent.ts
      prompts.ts
      schemas.ts
    /career-mentor
      agent.ts
      prompts.ts
      schemas.ts
    /arbiter
      agent.ts
      prompts.ts
      schemas.ts
  /tools
    health.tools.ts
    calendar.tools.ts
    nutrition.tools.ts
    career.tools.ts
    study.tools.ts
    pantry.tools.ts
    action.tools.ts
  /services
    context-hub.ts
    metrics-engine.ts
    arbitration-engine.ts
    scenario-engine.ts
  /repositories
    profile.repository.ts
    calendar.repository.ts
    health.repository.ts
    study.repository.ts
    memory.repository.ts
  /fixtures
    /mentoros
      profile.json
      goals.json
      health-30d.json
      sleep-30d.json
      workouts.json
      nutrition.json
      calendar.json
      career-profile.json
      study-plan.json
      study-history.json
      pantry.json
      recipes.json
      finance-preview.json
  /scenarios
```

---

# 24. Minimal API surface

```text
POST /api/scenarios/:id/reset
POST /api/scenarios/:id/trigger
GET  /api/context/today
GET  /api/metrics/today
POST /api/mentors/health/run
POST /api/mentors/career/run
POST /api/mentors/arbitrate
GET  /api/proposals/current
POST /api/proposals/:id/approve
POST /api/proposals/:id/reject
POST /api/proposals/:id/modify
GET  /api/activity
GET  /api/memory
```

---

# 25. End-of-day build sequence

## Phase 1 — Data and shell

- create profile fixture;
- create 30-day health/sleep data;
- create workout history;
- create calendar history;
- create TOGAF plan + study history;
- build Today screen;
- build scenario trigger/reset.

## Phase 2 — Metrics

- adherence by time-of-day;
- sleep average;
- meeting load;
- study pace;
- remaining calories/protein;
- available focus windows.

## Phase 3 — Mentor agents

- Health Mentor structured output;
- Career Mentor structured output;
- Arbiter structured output;
- evidence references.

## Phase 4 — Actions

- approval card;
- calendar mutation;
- workout mutation;
- study mutation;
- meal plan mutation;
- grocery list mutation;
- memory write.

## Phase 5 — Polish

- evidence drawer;
- mentor activity feed;
- failure/recovery scenario;
- mentor marketplace teaser;
- deterministic reset;
- rehearsal.

---

# 26. Team split

For 4 people:

### Person 1 — UI

- Today timeline;
- before/after diff;
- approval card;
- mentor activity feed.

### Person 2 — Data + metrics

- all fixtures;
- pattern engineering;
- derived metrics;
- provenance/evidence refs.

### Person 3 — Mentor agents

- Health Mentor;
- Career Mentor;
- arbiter;
- prompts and schemas.

### Person 4 — State + demo orchestration

- scenario reset;
- trigger;
- action executor;
- memory;
- testing/rehearsal.

---

# 27. 90-second demo script

### 0–10 sec — Vision

“Most AI assistants wait for you to ask. MentorOS understands your goals and context continuously and intervenes when your plan is about to fail.”

### 10–20 sec — Starting state

Show today's plan:

- work;
- 60-minute workout;
- dinner;
- 90-minute TOGAF study;
- 23:00 bedtime.

### 20–28 sec — Trigger

A new urgent work meeting appears from 17:30–19:00.

No prompt is typed.

### 28–45 sec — Data + mentor reasoning

Activity panel:

```text
✓ Health Mentor checked 30 days of activity
✓ Health Mentor checked 23 workout records
✓ Career Mentor checked TOGAF deadline and 22 study sessions
✓ Both mentors checked today's calendar
```

Surface pattern:

> “Workouts after 20:30 have only 29% completion. TOGAF pace is 8% behind. Late study also reduces sleep.”

### 45–60 sec — Mentor conflict

Health Mentor wants sleep preserved.

Career Mentor needs study time.

Arbiter creates compromise.

### 60–72 sec — Approval

Show plan diff:

- workout 60 → 25 min;
- study 90 → 45 min;
- move 45 min to tomorrow morning;
- quick high-protein dinner;
- preserve bedtime.

Click **Approve Plan**.

### 72–84 sec — Visible action

Calendar updates.

Workout plan updates.

Study plan updates.

Meal and grocery list update.

### 84–90 sec — Platform reveal

Show mentor cards:

- Health — Active;
- Career — Active;
- Finance — Next.

Close:

> “One life. Multiple mentors. One coordinated plan.”

---

# 28. Definition of done

MentorOS is ready when:

- [ ] calendar change proactively triggers the system;
- [ ] 30-day health/sleep data exists;
- [ ] 20+ workout records exist;
- [ ] 20+ study records exist;
- [ ] 4–8 weeks of calendar context exists;
- [ ] metrics are computed in code;
- [ ] Health Mentor creates a structured proposal;
- [ ] Career Mentor creates a structured proposal;
- [ ] mentors visibly disagree on at least one constraint;
- [ ] arbiter creates one combined plan;
- [ ] evidence/provenance is visible;
- [ ] approval changes calendar/workout/study state;
- [ ] meal/grocery mini-flow works;
- [ ] memory is written;
- [ ] scenario resets in one click;
- [ ] demo is reliable in < 90 seconds.

---

# 29. What to cut if time is tight

Cut in this order:

1. Finance Mentor functionality — keep only the card.
2. Fancy charts.
3. Live recipe/web search — use local recipe fixtures.
4. Multiple health scenarios.
5. Complex onboarding.

Do **not** cut:

1. proactive calendar trigger;
2. longitudinal mock data;
3. computed personal patterns;
4. Health + Career disagreement;
5. arbiter;
6. approval;
7. visible calendar/action mutation;
8. evidence/provenance.

Those are the features that make MentorOS feel genuinely agentic and distinct from a normal conversational assistant.
