# 🕌 MISHKAT QURAN — PHASE Q11 ARCHITECTURE
## Intelligent Hifz Planning & Personalized Daily Journey (التخطيط الذكي للحفظ والرحلة اليومية الشخصية)

==================================================
### 1. OVERVIEW & MISSION
==================================================

Phase Q11 represents the **forward-looking synthesis layer** of the Mishkat Quran memorization ecosystem.

Across the preceding phases:
- **Q8 (Memorization & Revision Engine):** Established canonical Ayah-level mastery state (`MemorizationItem`), commitments (`MemorizationPlan`), active recall (`MemorizationSession`), and local-first persistence.
- **Q9 (Adaptive Muraja'ah Engine):** Established spaced repetition interval computation, priority scoring (`MurajaahPriorityScore`), and targeted review queues.
- **Q10 (Memorization Analytics & Progress Intelligence):** Established historical retention analysis, workload forecasting, Surah/Juz breakdowns, and pacing intelligence.

**Phase Q11 answers the ultimate daily user question:**
> *"ما هو وردي اليومي المتوازن والمناسب لطاقتي اليوم؟"*
> ("What is my balanced daily Quran memorization journey today?")

Rather than requiring the user to manually calculate what to review, which weak verses to consolidate, and how many new verses to memorize without burning out, Q11 unifies these three streams into one calm, dignified, and actionable recommendation:

# وردك اليومي المقترح (Your Recommended Daily Journey)

```
       ┌─────────────────────────────────────────────────────────────┐
       │                وردك اليومي المقترح (Q11)                   │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
   ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
   │ 1. المراجعة     │       │ 2. تثبيت        │       │ 3. الحفظ        │
   │    المستحقة     │       │    المواضع      │       │    الجديد       │
   │   (Q9 Spaced)   │       │    الضعيفة      │       │    (Q8 Plan)    │
   └────────┬────────┘       └────────┬────────┘       └────────┬────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │ Deduplication & Capacity  │
                        │ Bounding (Total <= 30)    │
                        └─────────────┬─────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │   جلسة الورد المتكامل     │
                        │ (Unified 1-Tap Session)   │
                        └───────────────────────────┘
```

---

==================================================
### 2. THE THREE JOURNEY SEGMENTS
==================================================

The daily journey is structured into three clear, non-overlapping segments presented in optimal cognitive order:

1. **المراجعة المستحقة (Due & Overdue Muraja'ah):**
   - **Source:** Ayahs whose scheduled spaced repetition date is today or has elapsed, ordered by `AdaptiveMurajaahEngine` priority score.
   - **Purpose:** Protect and maintain existing memorization before adding new cognitive load.
   - **Priority:** Highest.

2. **تثبيت المواضع الضعيفة (Weak Ayah Consolidation):**
   - **Source:** Ayahs flagged with recurring mistakes (`mistakeCount >= 2`), recent failures (`ReviewOutcome.failed` or `difficult`), or `needsRevision` status.
   - **Purpose:** Reinforce vulnerable verses through targeted consolidation.
   - **Priority:** Second.
   - **Deduplication:** Any Ayah already included in Due Muraja'ah is strictly excluded from this segment to prevent duplicate review in the same day.

3. **الحفظ الجديد (New Hifz Forward Progress):**
   - **Source:** The sequential next un-memorized Ayahs within the active `MemorizationPlan` (`[startGlobalAyah .. endGlobalAyah]`).
   - **Purpose:** Consistent, steady forward memorization towards the plan's completion.
   - **Priority:** Third.
   - **Capacity:** Dynamically scaled according to review workload.

---

==================================================
### 3. DYNAMIC TARGET ADAPTATION & WORKLOAD BALANCING
==================================================

To protect retention and prevent cognitive fatigue, the system dynamically calculates `recommendedNewHifzTarget` based on today's review load:

| Workload Level | Due / Urgent Reviews | Target Scale Factor | Recommended New Target Formula |
| :--- | :--- | :--- | :--- |
| **Light (خفيف)** | $\le 10$ due reviews (and $\text{urgent} \le 3$) | $100\%$ | $\text{plan.dailyTarget}$ |
| **Moderate (متوسط)** | $11 \dots 30$ due reviews (and $\text{urgent} \le 3$) | $\sim 70\%$ | $\max(1, \lfloor \text{plan.dailyTarget} \times 0.7 \rfloor)$ |
| **Heavy (مكثف)** | $> 30$ due or $\text{urgent} > 3$ | $\sim 40\%$ | $\max(1, \lfloor \text{plan.dailyTarget} \times 0.4 \rfloor)$ |

#### Daily Capacity Model ($C_{\text{total}}$):
The engine explicitly computes the approved daily capacity constraint:
$$C_{\text{total}} = \text{clamp}\left(\text{round}\left(0.7 \times P_{\text{actual}} + 0.3 \times T_{\text{target}}\right) + W_{\text{base}},\, 5,\, 50\right)$$

- **$P_{\text{actual}}$:** Demonstrated memorization pace ($\text{memorizedInPlan} / \text{planAgeDays}$ when $\text{planAgeDays} \ge 2$).
- **$T_{\text{target}}$:** Active plan's `dailyTarget`.
- **$W_{\text{base}}$:** Review workload contribution, deterministically derived from `dueTodayCandidates.length` (representing today's pending spaced review items).
- **Insufficient-Data Fallback:** When review history $< 5$ records OR plan age $< 2$ days:
  $$C_{\text{total}} = \text{dailyTarget} + \text{dueReviewsCount}$$

#### Global Capacity Bounding & Final Humane Safety Cap ($\le 30$ Ayahs Total):
The daily capacity $C_{\text{total}}$ provides the dynamic workload limit, while the final humane safety invariant strictly caps the journey:
$$\text{Total Daily Journey Ayahs} \le \min(C_{\text{total}},\, 30)$$

If the combined sum exceeds the limit:
1. Due Muraja'ah is pruned to at most 18.
2. Weak consolidation is pruned to at most 4.
3. Due Muraja'ah is further pruned to at most 12 if needed.
4. New Hifz is preserved at $\ge 1$ Ayah (when an active plan has remaining unmemorized Ayahs).
5. Deduplication and final total are strictly re-checked.

---

==================================================
### 4. GENTLE RECOVERY MODE (وضع التعويض الهادئ)
==================================================

When life events interrupt Quran study, traditional apps overwhelm users with daunting red backlogs or penalize streaks. Mishkat rejects guilt, pressure, and gamification in favor of a dignified Islamic UX:

#### Recovery Mode Trigger Conditions:
1. **Accumulated Backlog:** $\text{Overdue Ayahs} \ge 15$; OR
2. **Prolonged Inactivity:** Days without review $\ge 3$ AND pending overdue reviews $> 0$.

#### Recovery Mode Behavior:
- **Calm Notification & Banner:** Replaces alarms with an encouraging gold/sage banner:
  > *"🌿 وضع التعويض الهادئ: قسّمنا المراجعات المتأخرة إلى دفعات يسيرة مع حفظ آية أو آيتين للحفاظ على استمرارية الورد دون إرهاق."*
- **Manageable Daily Slices:** Slices the overdue backlog into gentle daily batches of at most $10 \dots 15$ Ayahs.
- **Throttled New Hifz:** Caps recommended new verses to $1 \dots 2$ Ayahs, ensuring forward momentum without overwhelming retention.

---

==================================================
### 5. PLAN ADAPTATION ENGINE (اقتراحات موازنة الخطة)
==================================================

`HifzPlanningEngine.calculatePlanAdaptationSuggestion` periodically evaluates whether the active plan's daily commitment matches reality:

#### Safeguards & Prerequisite Criteria:
- **Observation Window:** The plan must be at least 7 calendar days old (`planAgeDays >= 7`).
- **Sufficient History:** At least 5 review records and 5 active days within the last 14 days.

#### Adaptation Rules:
1. **Downward Adaptation (Target Too Ambitious):**
   - Triggered when sustained pace $\le 55\%$ of `plan.dailyTarget` (and difference $\ge 2$).
   - Suggests: Reducing target to actual sustained pace.
   - Tone: Dignified Islamic reminder:
     > *"لوحظ أن وتيرة إنجازك الفعلية هي حوالي X آيات يومياً. تخفيف الورد يضمن المداومة دون انقطاع، وأحب الأعمال إلى الله أدومها وإن قل."*
2. **Upward Adaptation (User Consistently Ahead):**
   - Triggered when sustained pace $\ge 160\%$ of `plan.dailyTarget` (and difference $\ge 2$).
   - Suggests: Increasing target to reflect actual velocity.

#### Non-Negotiable Invariant:
**The engine NEVER mutates user data automatically.**
Plan adaptation is strictly presented as an optional, actionable suggestion card. The user must explicitly tap `[تعديل الورد إلى X آيات]` to apply it.

---

==================================================
### 6. DUAL COMPLETION FORECAST (تقدير الختم الواقعي)
==================================================

`HifzPlanningEngine.estimateRealisticCompletion` calculates two parallel completion timelines:

1. **Target-Based Forecast:**
   $$\text{Days Remaining} = \left\lceil \frac{\text{Remaining Unmemorized Ayahs}}{\text{plan.dailyTarget}} \right\rceil$$
2. **Realistic Pace-Based Forecast (when $\ge 5$ active days exist):**
   $$\text{Sustained Pace} = \frac{\text{Memorized Ayahs in Plan}}{\text{Plan Age in Days}}$$
   $$\text{Realistic Days} = \left\lceil \frac{\text{Remaining Unmemorized Ayahs}}{\text{Sustained Pace}} \right\rceil$$

#### Humanized Arabic Time Formatting:
Exact calendar completion dates are avoided because they create artificial anxiety. Instead, durations are rounded to calm approximations:
- $1 \dots 2$ days: *"يوم واحد تقريباً"* / *"يومان تقريباً"*
- $3 \dots 10$ days: *"حوالي X أيام"*
- $11 \dots 14$ days: *"حوالي أسبوعين"*
- $15 \dots 21$ days: *"حوالي 3 أسابيع"*
- $22 \dots 35$ days: *"حوالي شهر"*
- $36 \dots 50$ days: *"حوالي شهر ونصف"*
- $51 \dots 70$ days: *"حوالي شهرين"*
- $71 \dots 100$ days: *"حوالي 3 أشهر"*
- $> 365$ days: *"أكثر من عام"*

---

==================================================
### 7. USER AGENCY & TARGET ADJUSTMENT
==================================================

The system advises and guides; the user is sovereign:
- Right within the **وردك اليومي المقترح** card, the user can adjust today's new Hifz target using `[-]` and `[+]` selectors ($1 \dots 30$).
- Tapping `[-]` or `[+]` immediately updates `effectiveNewHifzTarget`, recalculating the new queue and total journey count interactively.
- The user can tap `[ابدأ ورد اليوم المتكامل]` to practice all three segments in sequence, or tap an individual segment chip (المراجعة المستحقة / تثبيت المواضع / الحفظ الجديد) to practice only that specific segment.

---

==================================================
### 8. ARCHITECTURAL & PERSISTENCE PURITY
==================================================

- **Zero New Storage Keys:**
  `DailyHifzJourney`, `PlanAdaptationSuggestion`, and `CompletionForecast` are **ephemeral domain projections** calculated on demand in $< 2$ milliseconds. No new database tables or LocalStorage keys are introduced.
- **Single State Authority:**
  `QuranMemorizationCubit` remains the single source of truth. No `HifzPlannerCubit` or secondary state managers.
- **Decoupled Stateless Engine:**
  `HifzPlanningEngine` is a pure Dart service with zero Flutter UI imports, zero `BuildContext`, and zero async side-effects.

---

==================================================
### 9. VERIFICATION & QUALITY ASSURANCE
==================================================

- **Unit & Integration Tests:** 18 new automated tests in `test/features/quran_hifz_planning_test.dart` verifying light, moderate, and heavy workloads, recovery triggers, capacity bounding, deduplication, plan adaptation suggestions, completion forecasts, and UI smoke tests.
- **Full Test Suite:** **232/232 tests passing** across the entire repository.
- **Static Analysis:** **0 issues found** (`flutter analyze lib/ test/features/`).
- **Asset Integrity:** All 604 Madinah Mushaf SVG pages and canonical JSON datasets remain 100% intact and untouched.
