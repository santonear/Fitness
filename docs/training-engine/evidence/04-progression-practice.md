# 04 — Progression, Beginners, Practitioner Frameworks

Scope: adults 18+, general fitness, home or gym. Evidence grades:
- **A** = position stand / guideline
- **B** = systematic review / meta-analysis (or, where noted, a controlled trial)
- **C** = respected practitioner consensus (books, coaching frameworks, Delphi panels of coaches). C does **not** mean "proven". It means "widely used and reasonable".

Source keys like [S1] point to the source list at the end. "(secondary)" means I read a summary of the paper, not the paper itself.

---

## Topic 1 — Progression models

### Key conclusions
1. **Progressive overload is the main variable. The exact model matters less for general-fitness adults.** The 2026 ACSM position stand says to increase load gradually over time. It also says complex periodization, training to failure, and machines vs free weights did not consistently change outcomes for the average healthy adult. Its anchors: each major muscle group at least 2x/week, about 10 sets/muscle/week for hypertrophy, 2–3 sets per exercise at about 80% 1RM for strength. — **A** [S1, S2]
2. **Load increment rule (ACSM 2009).** Increase load by 2–10% once the trainee does 1–2 reps more than the target on two consecutive sessions. Use the smaller end for small-muscle and single-joint lifts and the larger end for large-muscle and multi-joint lifts. Novice prescription: 60–70% 1RM, 8–12 reps, 1–3 sets, 2–3 full-body days/week, slow-to-moderate tempo. — **A** [S3]
3. **Periodized vs non-periodized (volume-equated).** Moesgaard et al. 2022 pooled 35 RCTs (n≈1,187). Periodization gave a small extra strength benefit (ES ≈0.31) and no meaningful hypertrophy benefit (ES ≈0.13). Undulating beat linear periodization for strength in trained people (ES ≈0.61) but not in beginners (ES ≈0.06). — **B** (secondary) [S4]
4. **Autoregulated vs fixed loading.**
   - Hickmott et al. 2022 (15 studies in the meta-analysis): load autoregulation vs standardized loading gave a non-significant 1RM difference of about +2 kg (SMD 0.21). The RIR-based RPE subgroup was near-significant (SMD 0.30, p=0.06). Velocity-based training was null (SMD 0.10).
   - For volume autoregulation, velocity-loss thresholds of ≤25% favored strength and >25% favored hypertrophy.
   - Bottom line: autoregulation is at least as good as fixed loading, with possibly a small edge for RPE/RIR. — **B** [S5]
5. **Larsen et al. 2021 (systematic review, 14 studies).** Both subjective (RPE/RIR) and objective (velocity) autoregulation work well for maximal strength. RPE/RIR may give small benefits over percent-based loading when no velocity device is available. Evidence for APRE and flexible nonlinear models is thin. — **B** [S6]
6. **Proximity to failure.** Robinson et al. 2024 (meta-regressions) found that hypertrophy improves as sets end closer to failure. Strength gain was largely unrelated to estimated RIR. — **B** [S7]
7. **Progression rate depends on training age (practitioner consensus, Helms).**
   - Novices can add load or reps every session.
   - Intermediates progress week to week in higher rep ranges, or month to month in heavier ranges.
   - Advanced trainees may gain only 1–2 reps a month.
   - Use double progression for essentially all exercises: work in a rep range, and add load once the top of the range is reached at the target RIR. — **C** [S8]
8. **Bodyweight double progression (trial evidence).** In Kotarsky 2018, progressing push-up variants after reaching the rep target on 2 consecutive sessions gave bench 1RM gains similar to progressive bench pressing over 4 weeks. — **B (single RCT, secondary)** [S9]

### Engine implications
- **Default model: double progression with an RIR gate.** It applies to every load-able exercise.
  - Each exercise has `rep_min` and `rep_max` (e.g., 8–12) and `target_rir` (beginner 2–3, general 1–3).
  - Trigger to increase load: **all working sets reach `rep_max` at RIR ≥ target_rir − 0**, in **2 consecutive sessions** (ACSM's "two consecutive sessions" rule). The engine can use 1 session for novices in weeks 5+ if logged RIR ≥ 2.
  - Increment: lower-body compound **+5% (min +2.5 kg / 5 lb)**; upper-body compound **+2.5–5% (min +1–2.5 kg)**; isolation **+2–2.5% or the smallest available jump**. Hard cap: **≤10% per step** (ACSM). When a dumbbell jump would exceed 10%, reset reps to `rep_min` and climb again. In practice this is the double progression.
  - After an increase, reset the target to `rep_min`.
- **Bodyweight exercises.** Progress by reps, then by **variation step** along the ladder (Topic 5) when the rep threshold is met for 2 sessions. On the new step, start at `rep_min`.
- **Stall/regress rule (C).** If reps fall below `rep_min` on 2 consecutive sessions at the same load, reduce load 5–10% and rebuild. Three stalls across different lifts in the same week count as a deload signal (Topic 2).
- **Do not require formal periodization for general users.** A simple block alternation (e.g., 4–6 weeks at 8–12 reps, then 4–6 weeks at 5–8 reps for compounds) is optional. It can be enabled for intermediate+ strength-goal users only.
- **RIR logging is optional but preferred.** If a user does not log RIR, infer it: hitting `rep_max` easily = RIR ≥2; failing reps = RIR 0.

### Disagreements / uncertainty
- The ACSM 2026 statement that failure "did not consistently change outcomes" sits in tension with Robinson 2024 (hypertrophy improves closer to failure). Reconcile by keeping RIR 0–3 and reserving RIR 0 for isolation and machine work.
- Novices rate RIR inaccurately (practitioner observation, C). Treat early RIR logs as noisy.
- I only read Moesgaard's effect sizes through a secondary summary.

---

## Topic 2 — Deloads and fatigue management

### Key conclusions
1. **Definition and use (Delphi consensus, Bell et al. 2023).** A deload is a planned or reactive period of reduced training stress meant to reduce physical and mental fatigue.
   - The panel agreed **volume should be reduced**, through fewer sets, fewer reps, or lower frequency.
   - Intensity of effort can drop or stay the same, but only stays the same if volume is cut.
   - Deloads may be pre-planned **or** autoregulated (triggered by fatigue).
   - No numeric consensus was reached on duration. Coaches typically cite about 7 days.
   - — **C (formal Delphi)** [S10]
2. **Practical numbers (Bell et al., Strength & Conditioning Journal practical guide).**
   - Planned deloads every **4–8 weeks**, lasting **5–7 days**. A reactive deload can be a single session.
   - Volume cut of **25–45% (low recovery need), 40–60% (moderate), 60–90% (high)**.
   - Either cut load by about 10% at the same reps, or keep load and cut reps so that 1–3 RIR remain.
   - Keep frequency unchanged. Apply the reduction as one step at the start, not a taper.
   - Keep the main multi-joint lifts and focus on technique.
   - For low-to-moderate training status, 1–3 days off may be enough.
   - — **C** [S11]
3. **Experimental evidence is limited and does not favor full rest for strength.** Coleman et al. 2024 (n=39 trained adults, 9-week high-volume program): a full week off at week 5 produced **no hypertrophy difference** but **slightly worse lower-body strength** than continuous training. — **B (single RCT)** [S12]
4. **RP volume model (practitioner).** Mesocycles of about 4–6 weeks add volume each week, then a deload week at about maintenance volume (example: 6 sets/muscle). — **C** [S13]
5. **Helms reactive deload checklist.** Weekly yes/no questions: dreading training, worse sleep, stalled or declining performance, increased aches. Two or more "yes" answers means consider a deload. — **C** [S8]

### Engine implications
- **Default for general-fitness users: reactive plus a soft cap. Do not use rigid frequent deloads.**
  - **Scheduled check:** offer a deload week after **6 weeks** of continuous progression for beginners and intermediates, or after **4–5 weeks** for high-volume plans. The user can skip it if no fatigue flags are present.
  - **Reactive trigger:** deload when **≥2 of these 4 flags** are present in the past 7–10 days:
    - (a) performance drop of ≥1 rep or a missed load on ≥2 exercises in consecutive sessions
    - (b) self-reported fatigue or motivation ≤2/5 twice
    - (c) poor sleep reported ≥3 nights
    - (d) new or worsening joint pain (pain also routes to a substitution or regression)
- **Deload prescription (default "moderate"):**
  - Keep exercises and frequency.
  - Cut **sets by about 50%** (round down, minimum 1 set).
  - Keep load, and cap effort at **RIR ≥3**. Alternatively, keep sets and reduce load by 10%.
  - Duration is **1 week**. Then resume at the last successful loads, not a reset.
  - **Light:** −30% sets. **Heavy:** −70% sets. Choose heavy when ≥3 flags are present.
- **Beginners in months 0–3 rarely need structured deloads.** Use only the reactive trigger. Prefer 1–3 easy or rest days.
- Avoid a full week off as the default for strength-goal users (Coleman 2024).

### Disagreements / uncertainty
- Bell's consensus panel was made of strength and physique athletes and coaches. Generalizing to recreational users is extrapolation.
- No trial has tested reduced-volume deloads, which is what most coaches actually use. Coleman tested complete cessation only.
- The optimal frequency is unknown. The 4–8 week range is convention, not evidence.

---

## Topic 3 — Beginners, sedentary adults, and returning after a break

### Key conclusions
1. **Novice entry dose (ACSM 2009).** 60–70% 1RM (8–12 reps), 1–3 sets, 2–3 non-consecutive full-body days/week, slow-to-moderate tempo, 2–3 min rest on main lifts. — **A** [S3]
2. **Minimal dose works.** Starting any resistance training gives the biggest relative gain (ACSM 2026). Iversen et al. 2021 (narrative review) describe time-efficient programs. A summary of that work cites about 4 sets/muscle/week as a workable minimum when effort is high. — **A** [S1, S2] / **B–C** [S14]
3. **Rhabdomyolysis risk in novices** comes from high-volume and eccentric-heavy first sessions. A case report (Khalil & Saab 2016) advises "start low and go slow", with ACSM-style novice loads and supervision or instruction on technique. — **C (clinical case report)** [S15]
4. **Detraining timeline (Bosquet et al. 2013, meta-analysis of 103 studies).**
   - In younger adults, maximal strength is largely preserved for up to about **4 weeks** off and declines faster after that.
   - Losses are larger in adults ≥65 (g≈0.76 vs 0.31).
   - Strength endurance declines sooner and more than maximal strength.
   - — **B** [S16, via S17 for effect-size details]
5. **"Muscle memory" and retraining (Ogasawara et al. 2013).**
   - Young men trained bench press for 24 weeks either continuously or as 3 cycles of **6 weeks on / 3 weeks off**.
   - Final strength and hypertrophy were similar between groups. Losses after each break were regained within about 3 weeks.
   - Practitioner synthesis: retraining takes roughly **⅓–⅔ (about ½)** of the time spent off.
   - — **B (RCT)** [S18] / **C** [S17]
6. **Technique first.** NSCA-based ordering puts power and complex lifts first while fresh, then multi-joint lifts, then assistance lifts. Practitioner ladders (Topic 5) start novices on supported or regressed variants and move them up only once form is consistent. — **C** [S19, S20, S21]

### Engine implications
- **Experience classification at onboarding:**
  - `new` (never trained or <3 months)
  - `returning_short` (≤4 weeks off)
  - `returning_mid` (4–12 weeks off)
  - `returning_long` (>12 weeks off or >6 months)
  - `trained`
  - Add an `age≥65` flag. It shortens the detraining thresholds by about half (Bosquet; S17 author estimate).
- **First 4 weeks caps for `new`:**
  - Wk 1: 2 sessions, **1–2 sets** per exercise, 4–6 exercises, **RIR ≥3**, no failure, eccentric tempo ≤3 s, no plyometrics above difficulty 2.
  - Wk 2: 2–3 sessions, 2 sets, RIR 3.
  - Wk 3–4: 3 sessions, 2–3 sets, RIR 2–3.
  - **Weekly sets per muscle:** start at 4–6 and add no more than +2/week, capped at 10 through week 4.
  - Exercise difficulty ≤2 (scale in Topic 5) in weeks 1–2, ≤3 in weeks 3–4.
  - Load progression is allowed every session, but only by reps or the smallest increment.
- **Returning users:**
  - `returning_short`: resume at **90%** of the last working loads and full volume. Prior loads are restored after 1 week.
  - `returning_mid`: resume at **80%** load and 60–70% volume. Ramp to 100% over **2–3 weeks**.
  - `returning_long`: resume at **60–70%** load and 50% volume. Ramp over **4–6 weeks**. Retraining length ≈ ½ × weeks off, capped at 8 weeks.
  - Never resume at or above the previous best on the first session.
- **Technique gates:** the user must complete the prior ladder step for 2 sessions at target reps before the engine offers a harder variant. Free-weight barbell lifts are unlocked only after their supported or goblet equivalents.
- **DOMS messaging:** expect soreness in weeks 1–2. Severe swelling or dark urine should go to a medical referral message (S15).

### Disagreements / uncertainty
- I have no meta-analysis that pins down how conservative weeks 1–4 should be. The caps above are a conservative synthesis (C).
- Ogasawara studied trained-then-detrained young men on a single exercise. Extrapolating to long breaks or older adults is uncertain.
- The mechanism behind muscle memory (myonuclear retention) is debated (S17). The faster retraining itself is better supported than any proposed mechanism.

---

## Topic 4 — Movement-pattern taxonomy

### Practitioner frameworks reviewed
- **Dan John (C):**
  - Five basic human movements: **push, pull, hinge, squat, loaded carry** [S22, S23].
  - He later proposed a sixth group, sometimes called "integrity with the environment". It covers groundwork (rolling, crawling, get-ups) and brachiation/climbing [S24].
  - Other coaches add **lunge** (Rusin) or **rotation/anti-rotation** [S24].
- **Mike Boyle / functional training (C):** knee-dominant vs hip-dominant, bilateral vs unilateral, push/pull balance, and core trained as **anti-extension, anti-lateral-flexion, anti-rotation** [S25].
- **Science for Sport (C):** 12 categories. They are hip hinge, hip dominant, knee dominant, vertical and horizontal push and pull, rotational/diagonal, anti-rotation, anti-flexion, anti-extension and anti-lateral-flexion. Lunges count as knee dominant, and carries as anti-lateral-flexion [S21].
- **NSCA (C/A-textbook):** classifies by **power / core (multi-joint) / assistance (single-joint)**. This scheme drives exercise order, not movement pattern [S19].

### Proposed consolidated taxonomy (enum)
Tag each exercise with **one `primary_pattern`** and **0–2 `secondary_patterns`**. Add the orthogonal attributes `laterality` {bilateral, unilateral, alternating}, `nsca_class` {power, compound, isolation}, `plane` {sagittal, frontal, transverse, multi}, and `modality` {strength, plyometric, cardio, mobility, isometric}.

| Enum | Definition | Examples |
|---|---|---|
| `squat` | Bilateral knee- and hip-flexion pattern, torso relatively upright, both feet planted symmetrically | goblet squat, back squat, leg press, wall sit (isometric) |
| `lunge` | Split-stance or single-leg knee-dominant pattern | split squat, reverse/walking lunge, Bulgarian split squat, step-up, pistol, lateral lunge (`plane`=frontal) |
| `hinge` | Hip flexion/extension with minimal knee bend and a neutral spine | deadlift, RDL, KB swing, good morning, hip thrust and glute bridge (secondary none) |
| `push_horizontal` | Press away from the torso, perpendicular to it | push-up, bench press, chest press, dips (convention: dips go here, not `push_vertical`, because the load is chest and triceps) |
| `push_vertical` | Press overhead, parallel to the torso | OHP, landmine press (secondary `push_horizontal`), handstand push-up, pike push-up |
| `pull_horizontal` | Pull toward the torso, perpendicular to it | rows, inverted row, face pull |
| `pull_vertical` | Pull from overhead, parallel to the torso | pull-up, chin-up, lat pulldown |
| `carry` | Locomotion while holding external load | farmer, suitcase (secondary `anti_lateral_flexion`), overhead and front-rack carries, sled drag |
| `anti_extension` | Resist lumbar extension | plank, ab rollout, dead bug, body-saw |
| `anti_rotation` | Resist trunk rotation | Pallof press, bird dog, single-arm plank, renegade row (primary `pull_horizontal`) |
| `anti_lateral_flexion` | Resist side-bending | side plank, suitcase hold, Copenhagen plank |
| `rotation` | Produce or control trunk rotation, including flexion-rotation | woodchop, cable rotation, med-ball rotational throw, Russian twist |
| `trunk_flexion` | Produce spinal flexion or hip flexion with a trunk focus | crunch, hanging leg raise, sit-up |
| `isolation_upper` | Single-joint upper-limb work | curl, triceps extension, lateral raise, rear-delt fly |
| `isolation_lower` | Single-joint lower-limb work | leg extension, leg curl, calf raise, hip abduction/adduction |
| `locomotion_ground` | Groundwork: crawling, rolling, get-ups, plus climbing | bear crawl, Turkish get-up (secondary `push_vertical`, `lunge`), rope climb |
| `jump_land` | Plyometric or ballistic lower-body work | box jump, jump squat, bounds, skater hops, landing drills |
| `throw_upper` | Ballistic upper-body release or clap | med-ball chest pass, slam (secondary `trunk_flexion`), plyo push-up |
| `olympic` | Triple-extension power lifts | clean, snatch, high pull (`nsca_class`=power) |
| `cardio_cyclic` | Sustained rhythmic conditioning | run, row erg, bike, jump rope, burpee (secondary `jump_land`, `push_horizontal`) |
| `mobility` | ROM and stretching drills, not loaded for strength | hip airplane, thoracic rotation, couch stretch, CARs |

### Edge-case rules
1. **Lunges and step-ups** → `lunge`, never `squat`. A high-box step-up keeps `lunge` as primary and adds a secondary `hinge`, following the Science for Sport rule that a high box makes it hip dominant.
2. **Hip thrust and glute bridge** → `hinge`. A single-leg bridge adds `laterality`=unilateral.
3. **Carries** → `carry` is primary. Unilateral carries get a secondary `anti_lateral_flexion`.
4. **Push-up** → `push_horizontal`, with secondary `anti_extension`. **Renegade row** → `pull_horizontal` with secondary `anti_rotation` and `anti_extension`.
5. **Plyometrics** use `jump_land` or `throw_upper` as primary. Use the strength pattern as secondary: jump squat → `squat`, split jump → `lunge`, broad jump → `hinge`.
6. **Cardio machines and intervals** use `cardio_cyclic`. Do not tag strength patterns unless the exercise is loaded (e.g., thrusters → `squat` + `push_vertical`, with `modality`=strength).
7. **Complexes** (thruster, clean-and-press): primary is the most load-limiting pattern; secondary is the rest.
8. **Isometrics** use their pattern plus `modality`=isometric (e.g., wall sit → `squat`).
9. **Mobility** drills use `mobility` even if they resemble a pattern. A bodyweight squat used as a warm-up stays `squat` with difficulty 1.
- **Balance check for the engine (Boyle):** per week, aim for pull sets ≥ push sets, and keep hinge sets within ±30% of squat+lunge sets. Each week should include at least 1 anti-extension, 1 anti-rotation or anti-lateral-flexion, and 1 carry or groundwork exercise when the user's equipment allows.

### Disagreements / uncertainty
- Taxonomies are coach judgment, not empirical constructs. Science for Sport says so explicitly [S21].
- Bilateral squats load both knee and hip. Labeling them `squat` vs `hinge` is a convention.
- Dan John's sixth movement exists only in secondary descriptions [S24]. The original book source was not confirmed.

---

## Topic 5 — Difficulty grading and progression ladders

### Key conclusions
1. **Push-up load ladder (biomechanics).** Peak ground reaction force as a % of body mass (Wurm/Ebben 2010):
   - hands elevated 61 cm: **41%**
   - knees: **49%**
   - hands elevated 30 cm: **55%**
   - floor: **64%**
   - feet elevated 30 cm: **70%**
   - feet elevated 61 cm: **74%**

   This gives objective support for wall → incline → knee → full → decline. Knee and high-incline variants are close to each other, so their order is interchangeable. — **B (lab study)** [S26, S27]
2. **Contreras et al. classify push-up variants.** Novice is wall, torso-elevated and knee push-ups. Intermediate is standard, hand-width variations, feet-elevated and suspension push-ups. Advanced is clap, one-arm and weighted push-ups. — **C/B** [S27]
3. **Calisthenic ladder used in a trial.** Kotarsky 2018 used a 10-level push-up ladder (wall = level 1 → one-arm = level 10). Participants moved up a level after hitting the top rep target in 2 consecutive sessions. — **B** [S9]
4. **Squat ladder (practitioner).** Assisted squat → wall/ball squat → bodyweight box squat → goblet squat → split squat → Bulgarian split squat → front-rack KB squat → barbell box squat → front squat → back squat. Progress when all sets and reps are done with good form and a small load jump is tolerated. — **C** [S20]
5. **Dan John's teaching ladder (C).** Isometric "plank" versions of each pattern come first. The goblet squat is the teaching squat. Carries start with the farmer walk [S22, S23].

### Difficulty scale (1–5) for tagging
Rate each exercise on **the skill, stability and relative-load demands it places on a typical untrained adult**:
- **1 — Foundational:** supported or assisted, stable base, at most about 50% bodyweight or a very light load, low skill. *Wall push-up, box squat to high box, glute bridge, band row, dead bug, assisted squat, march in place.*
- **2 — Beginner:** unsupported bilateral, moderate bodyweight share or light external load, simple technique. *Incline/knee push-up, bodyweight squat, goblet squat (light), DB RDL, inverted row (high bar), plank, step-up (low box), farmer carry.*
- **3 — Intermediate:** full bodyweight or a moderate free-weight load, unilateral or more stability demand, moderate skill. *Full push-up, split squat, reverse lunge, DB bench, KB swing, inverted row (low bar), side plank, band-assisted pull-up, box jump (low).*
- **4 — Advanced:** high relative load, high skill, or high stability/coordination demands. *Decline push-up, Bulgarian split squat (loaded), barbell back/front squat, conventional deadlift, strict pull-up, dips, Turkish get-up, depth jumps, ab rollout from knees to standing.*
- **5 — Expert:** gymnastic or Olympic skill, or extreme leverage. *One-arm push-up, pistol squat, muscle-up, handstand push-up, snatch/clean, Nordic curl (full), weighted pull-up.*

**Rules for assigning a level:**
- Start at the level of the base variant.
- Add **+1** for unilateral, for an unstable or suspended setup, for a high-skill barbell/Olympic lift, or for a bodyweight share of 70% or more.
- Add **−1** for assisted/supported variants, a machine path, or a reduced range of motion.
- Clamp the result to 1–5.

### Engine implications
- Each exercise gets `difficulty` (1–5), `ladder_id` (e.g., `pushup_ladder`), `ladder_step` (an integer), and `regression_id` / `progression_id` links.
- **Step-up rule:** move to `progression_id` when the user completes **≥3×`rep_max`** (default 3×12 for bodyweight, 3×8 for unilateral) at RIR ≥1 in **2 consecutive sessions**.
- **Step-down rule:** move to `regression_id` if the user cannot reach **`rep_min`** (default 5) on the first set, or reports pain.
- **Starter ladders** (each step should be about 1 difficulty level or less apart):
  - Push: wall → high incline → knee/low incline → full → feet-elevated → archer/pseudo-planche → one-arm
  - Squat: assisted → box squat → bodyweight squat → goblet → split squat → Bulgarian → barbell/front squat → pistol
  - Hinge: glute bridge → hip hinge with dowel → DB/KB RDL → KB deadlift → single-leg RDL → barbell RDL/deadlift → Nordic/single-leg variants (C)
  - Vertical pull: dead hang/scap pull → band pulldown → negatives → band-assisted pull-up → pull-up → weighted pull-up (C)
  - Horizontal pull: band row → high inverted row → low inverted row → feet-elevated row → archer row (C)
  - Core (anti-extension): dead bug → incline plank → plank → long-lever plank → rollout (C)
- The hinge, pull and core ladders are practitioner convention. No kinetic data were found for them.

### Disagreements / uncertainty
- Published ladders differ in order. In the squat ladder, for example, Bulgarian split squat is ranked by some coaches as harder than a light barbell squat and by others as easier.
- Difficulty also depends on the person: limb length, body mass and mobility all affect it. Let user feedback (too easy / too hard) override the default step.

---

## Topic 6 — Volume landmarks (RP) and Helms' Pyramid (practitioner consensus)

### Key conclusions
1. **RP volume landmarks (Israetel / RP).** — **C** [S13]
   - **MV**, maintenance, is about 6 sets/muscle/week when the muscle is trained at least 2x/week.
   - **MEV** is the smallest volume that grows muscle. It is the start of a mesocycle and is close to MV in beginners.
   - **MAV** is the productive range between MEV and MRV.
   - **MRV** is the most volume the person can recover from.
   - Example mesocycle: 12 → 14 → 16 → 18 → 20 sets/week, then a deload at about 6.
   - Week-to-week adjustment uses soreness and performance scores from 1 to 4. When both are good, add 2–3 sets. When scores are mixed, add 1 set. When soreness is still present or performance struggles, hold. When performance drops, take recovery or a deload.
   - Caveats: RP calls these values starting points, not fixed truths. Only direct sets count. A "working set" is 5–30 reps at 0–4 RIR.
2. **Empirical backdrop.** Weekly sets show a positive, diminishing-returns relationship with hypertrophy and strength. Diminishing returns are stronger for strength. Frequency matters little for hypertrophy when volume is equated (Pelland et al. 2024 meta-regressions, preprint). This supports the *shape* of the RP model but not individual landmark numbers. — **B (preprint, secondary)** [S28]
3. **Helms' Muscle & Strength Pyramid.** Priorities in order: **adherence → volume/intensity/frequency → progression → exercise selection → rest periods → tempo**. — **C** [S8]
   - Frequency is at least 2 days/week, and usually 3 or more for continued progress.
   - Hypertrophy volume is about **10–20 sets/muscle/week**. The floor is about 4, and the upper end is about 30, used only for specialization.
   - Keep each session to about 11 fractional sets per muscle or fewer.
   - RIR targets: free-weight compounds at RPE 6–8 (4–8 reps), machine compounds up to failure, isolation at RPE 8–10.
   - Use double progression throughout.
   - Strength novices can start at about 1 set/lift/session.

### Engine implications
- **Weekly sets per muscle (direct + 0.5 × indirect, per S28 "fractional" counting):**
  - `new`: start 4–6, ramp to ~10 by wk 4–6
  - `intermediate`: 10–16
  - `advanced` or opt-in: up to 20
  - Never auto-program more than 20 for general fitness. Use the ACSM ~10 sets as the anchor.
- **Mesocycle volume ramp (optional, intermediate+):** start at MEV ≈ the user's previous comfortable volume. Add **+1–2 sets/muscle/week** only when performance ≥ last week and soreness has resolved before the next session. Hold otherwise. Deload after 4–6 weeks or when a trigger fires (Topic 2).
- **Session cap:** ≤10–11 sets per muscle per session. Spread volume across ≥2 sessions/week (ACSM 2026; Helms).
- **Priority order in the engine logic:** a schedule the user can keep beats any optimization. Pick frequency from user availability first, then fit volume, then apply progression, then choose exercises.

### Disagreements / uncertainty
- MEV/MAV/MRV are conceptual and individual. No study has validated RP's numeric defaults, and they are commercial practitioner guidance.
- The volume ceiling is contested. Some data suggest benefits above 20 sets, but with diminishing returns and greater fatigue. For general-fitness users the ACSM ~10 sets is sufficient.
- The Pelland meta-regression was read as a preprint via a secondary summary.

---

## Sources (opened or confirmed unless marked)

- [S1] American College of Sports Medicine (2026). *ACSM Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews.* Medicine & Science in Sports & Exercise. Phillips SM is among the authors; the full author list and DOI are [unverified]. Opened the ACSM summary page: https://acsm.org/resistance-training-guidelines-update/
- [S2] ACSM (2026). Resistance Training Position Stand infographic. https://acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf
- [S3] Ratamess NA, et al. (2009). ACSM Position Stand: Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41(3):687–708. DOI: 10.1249/MSS.0b013e3181915670. https://sfu.ca/~ryand/kin343/ACSMresistance.pdf
- [S4] Moesgaard L, Beck MM, Christiansen L, Aagaard P, Lundbye-Jensen J (2022). Effects of periodization on strength and muscle hypertrophy in volume-equated resistance training programs: a systematic review and meta-analysis. *Sports Med* 52(7):1647–1666. DOI: 10.1007/s40279-021-01636-1 (confirmed via Crossref). Content read via a secondary summary: https://sci-sport.com/en/effects-intensity-volume-periodization-strength-hypertrophy-238/
- [S5] Hickmott LM, Chilibeck PD, Shaw KA, Butcher SJ (2022). The effect of load and volume autoregulation on muscular strength and hypertrophy: a systematic review and meta-analysis. *Sports Med Open* 8:9. DOI: 10.1186/s40798-021-00404-9. https://sportsmedicine-open.springeropen.com/articles/10.1186/s40798-021-00404-9
- [S6] Larsen S, Kristiansen E, van den Tillaar R (2021). Effects of subjective and objective autoregulation methods for intensity and volume on enhancing maximal strength during resistance-training interventions: a systematic review. *PeerJ* 9:e10663. DOI: 10.7717/peerj.10663. The co-author names beyond Larsen are [unverified].
- [S7] Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC (2024). Exploring the dose–response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions. *Sports Med* 54(9):2209–2231. DOI: 10.1007/s40279-024-02069-2
- [S8] Helms E, Morgan A, Valdez A (2019, updated 2025). How to build training programs (sample from *The Muscle and Strength Pyramid: Training*, 3rd ed.). RippedBody. https://rippedbody.com/how-to-build-training-programs/
- [S9] Kotarsky CJ, Christensen BK, Miller JS, Hackney KJ (2018). Effect of progressive calisthenic push-up training on muscle strength and thickness. *J Strength Cond Res* 32(3):651–659. DOI [unverified]. Read via secondary summary: https://sci-sport.com/en/progressive-push-up-training-what-is-the-impact-on-muscle-mass-and-strength-161/
- [S10] Bell L, Strafford BW, Coleman M, Androulakis Korakakis P, ... Nolan D (2023). Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. *Sports Med Open* 9:87. DOI: 10.1186/s40798-023-00633-0
- [S11] Bell L, Darragh IAJ, Travis SK, Rogerson D, Nolan D (2024/2025). A practical approach to deloading: recommendations and considerations for strength and physique sports. *Strength Cond J*. The volume/pages and DOI are [unverified]. https://doras.dcu.ie/31501/
- [S12] Coleman M, et al. (2024). Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. *PeerJ* 12:e16777. DOI: 10.7717/peerj.16777
- [S13] RP Strength (2017). Training volume landmarks for muscle growth. https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth
- [S14] Iversen VM, Norum M, Schoenfeld BJ, Fimland MS (2021). No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review. *Sports Med* 51(10):2079–2095. DOI [unverified]. The content was seen only via a conference slide deck citing it: https://www.ideafit.com/wp-content/uploads/2022/10/334_Time-Efficient-Resistance-Training-Programs_Get-Maximal-Gains-in-Minimal-Time.pdf
- [S15] Khalil MA, Saab BR (2016). Resistance exercise–induced rhabdomyolysis: need for immediate intervention and proper counselling. *Aust Fam Physician* 45(12). https://www.racgp.org.au/afp/2016/december/resistance-exercise%E2%80%93induced-rhabdomyolysis-need-for-immediate-intervention-and-proper-counselling/
- [S16] Bosquet L, Berryman N, Dupuy O, Mekary S, Arvisais D, Bherer L, Mujika I (2013). Effect of training cessation on muscular performance: a meta-analysis. *Scand J Med Sci Sports* 23(3). DOI: 10.1111/sms.12047. The abstract was not read directly; the effect sizes come from S17.
- [S17] Stronger By Science (n.d.). Detraining: how long does it take to lose strength and muscle? (author [unverified]). https://www.strongerbyscience.com/detraining/
- [S18] Ogasawara R, Yasuda T, Ishii N, Abe T (2013). Comparison of muscle hypertrophy following 6-month of continuous and periodic strength training. *Eur J Appl Physiol* 113:975–985. DOI: 10.1007/s00421-012-2511-9. The fourth author is [unverified].
- [S19] HPRC / Uniformed Services University (2021). Choosing the right exercises to optimize your resistance training (citing NSCA *Essentials of Strength Training and Conditioning*). https://www.hprc-online.org/physical-fitness/training-performance/choosing-right-exercises-optimize-your-resistance-training
- [S20] Silverberg A, Woodruff J (2024). Squat progressions. PowerliftingTechnique.com. https://powerliftingtechnique.com/squat-progressions/
- [S21] Saville W (2016, updated 2025). Basic movement patterns. Science for Sport. https://www.scienceforsport.com/basic-movement-patterns/
- [S22] Cook M / John D (2016). Dan John: 5 basic human movements (excerpt from *Intervention*). On Target Publications. https://www.otpbooks.com/?p=17307
- [S23] John D (2018). Planks as a program. Medium. https://medium.com/@danjohn84123/planks-as-a-program-6e14fc1bdb78
- [S24] Trotter S (2021). Go beyond the 5 fundamental movement patterns. Breaking Muscle. https://breakingmuscle.com/go-beyond-the-5-fundamental-movement-patterns/
- [S25] Boyle M (n.d.). Insights on functional athletic performance training (interview). SimpliFaster. https://simplifaster.com/articles/insights-functional-athletic-performance-training-michael-boyle/
- [S26] Wurm B, VanderZanden T, Spadavecchia M, Durocher J, Bickham C, Petushek E, Ebben W (2010). Kinetic analysis of several variations of push-ups. *ISBS Conference Proceedings* (28th International Conference on Biomechanics in Sports). https://ojs.ub.uni-konstanz.de/cpa/article/view/4457
- [S27] Contreras B, Schoenfeld B, Mike J, Tiryaki-Sonmez G, Cronin J (c. 2012). The biomechanics of the push-up: implications for resistance training programs. Accepted manuscript; journal [unverified] (likely *Strength Cond J*). https://www.lookgreatnaked.com/articles/biomechanics_of_the_Pushup.pdf
- [S28] Pelland JC, et al. (2024). The resistance training dose-response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gain. SportRxiv preprint. DOI: 10.51224/SRXIV.460. Read via secondary summary: https://biolayne.com/reps/issue-31/the-king-of-volume-metas/
- Not opened: Psilander et al. 2019 (detraining/retraining, J Appl Physiol) [unverified]; Calatayud et al. 2015 (bench vs band push-up) [unverified]; Overcoming Gravity (Low, 2nd ed.) progression charts [unverified]. None of these is used above.
