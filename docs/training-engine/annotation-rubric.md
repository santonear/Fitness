# Exercise Annotation Rubric v0.2 (动作标注标准)

v0.2 changes: added pattern `balance`; added position `plank` (hand-supported plank/push-up position, distinct from `prone` lying face-down); KB/DB swings are `modality: power` but may have a beginner dose; Turkish get-up → `locomotion_ground`; ladders re-ranked centrally by difficulty; new fields `equipment_required` and `equipment_alternatives` (see equipment-required.json).

Purpose: tag every exercise in the catalog (637 entries, RepDB-derived) so a deterministic training engine can select, filter, dose and substitute exercises. Evidence basis: evidence/04 (taxonomy, difficulty), evidence/05 (joint-caution, special-population flags), evidence/02 (dose, timing).

Annotate from the exercise's slug, English name, equipment, bodyPart, primary/secondary muscles, steps and cautions. Judge for a **typical untrained-to-intermediate adult** using the default execution described in the steps.

## Output record (JSON, one per exercise)

```json
{
  "id": "<catalog id>",
  "slug": "<slug>",
  "primary_pattern": "<enum>",
  "secondary_patterns": ["<enum>", "..."],
  "modality": "strength|isometric|plyometric|cardio|mobility|power",
  "laterality": "bilateral|unilateral|alternating",
  "nsca_class": "power|compound|isolation|none",
  "plane": "sagittal|frontal|transverse|multi",
  "difficulty": 1,
  "joint_load": {"knee":0,"back":0,"shoulder":0,"wrist":0,"hip":0,"ankle":0},
  "impact": 0,
  "noise": 0,
  "space": "mat|small|medium|large",
  "position": ["standing","supine","prone","plank","kneeling","seated","quadruped","side_lying","hanging","inverted"],
  "flags": ["deep_knee_flexion","loaded_spinal_flexion","loaded_spinal_rotation","overhead_load","heavy_axial_load","valsalva_prone","balance_demand","unstable_surface","jumping","running","high_fall_risk","grip_intensive","wrist_extension_loaded","kneeling_on_knee"],
  "use": ["main","accessory","warmup","cooldown","conditioning","skill"],
  "ladder": {"id": "<ladder id or null>", "step": 0},
  "default_dose": {
    "beginner": {"sets": [2,3], "reps": [8,12], "seconds": null, "rir": [2,3]},
    "intermediate": {"sets": [3,4], "reps": [6,12], "seconds": null, "rir": [1,2]}
  },
  "time": {"setup_s": 15, "s_per_rep": 3.5, "per_side": false},
  "equipment_required": ["dumbbell","flat-bench"],
  "equipment_alternatives": {"flat-bench": ["chair","box-or-step"]},
  "confidence": "high|medium|low",
  "review": false,
  "note": "<optional, <=120 chars, why a non-obvious choice was made>"
}
```

## Field definitions

### primary_pattern / secondary_patterns (enum, from evidence/04)
`squat` · `lunge` · `hinge` · `push_horizontal` · `push_vertical` · `pull_horizontal` · `pull_vertical` · `carry` · `anti_extension` · `anti_rotation` · `anti_lateral_flexion` · `rotation` · `trunk_flexion` · `isolation_upper` · `isolation_lower` · `locomotion_ground` · `jump_land` · `throw_upper` · `olympic` · `cardio_cyclic` · `mobility` · `balance`

Edge rules:
1. Lunges, split squats, step-ups, pistols, lateral/cossack → `lunge` (pistol/cossack: `lunge` primary).
2. Hip thrust, glute bridge, pull-through, swings, RDL, good morning, back extension → `hinge`.
3. Carries → `carry`; unilateral carries add `anti_lateral_flexion`; overhead carries add `anti_extension` and flag `overhead_load`.
4. Push-up family → `push_horizontal` + secondary `anti_extension`. Dips → `push_horizontal`. Pike/handstand push-up → `push_vertical`.
5. Renegade row → `pull_horizontal` + `anti_rotation`. Shrugs, face pulls, rear-delt rows → `pull_horizontal`. Pullovers/straight-arm pulldowns → `pull_vertical`.
6. Plyometrics → `jump_land`/`throw_upper` primary, strength pattern secondary. Med-ball slam → `throw_upper` + `trunk_flexion`.
7. Cardio machines, jumping jacks, high knees, jump rope, burpees, mountain climbers (if used as conditioning) → `cardio_cyclic` (mountain climbers: `cardio_cyclic` + `anti_extension`).
8. Complexes (thruster, clean-and-press, lunge-press) → most load-limiting pattern primary, rest secondary.
9. Isometric holds keep their pattern; set `modality: isometric` (wall sit → `squat`; plank → `anti_extension`; dead hang → `pull_vertical`; side-lying hip abduction hold → `isolation_lower`).
10. Stretches and yoga poses → `mobility` (modality `mobility`), even if they resemble a pattern. Yoga poses with clear strength demand (chair pose, warrior three, crow pose, boat pose, handstand) → their strength pattern with `modality: isometric`.
11. Lateral raises, curls, extensions, kickbacks, flyes, pec deck, wrist curls → `isolation_upper`. Leg extension/curl, calf raises, abduction/adduction, clamshell, fire hydrant, glute kickback, tibialis raise → `isolation_lower`. Nordic curl → `isolation_lower`.
12. Crunch/sit-up/leg raise/V-up/toes-to-bar → `trunk_flexion`. Russian twist/woodchop/windshield wipers → `rotation`. Pallof press, bird dog → `anti_rotation`. Side plank, side bend (loaded) → `anti_lateral_flexion`. Dead bug, hollow hold, rollout, plank → `anti_extension`.
13. Neck exercises (chin tuck, isometric neck) → `isolation_upper` with `use: ["warmup"]`. Savasana, mountain pose, easy pose → `mobility`, `use: ["cooldown"]`.

### modality
`strength` dynamic resistance · `isometric` static hold · `plyometric` jumps/throws · `cardio` sustained conditioning · `mobility` stretch/ROM · `power` Olympic/ballistic lifts (cleans, snatches, jerks, swings with KB snatch).

### nsca_class
`power` (Olympic lifts, jerks, push press, explosive KB snatch/clean) · `compound` (multi-joint) · `isolation` (single joint) · `none` (stretches, cardio).

### difficulty (1–5) — evidence/04 scale
1 Foundational: supported/assisted, stable base, ≤ ~50% bodyweight or very light load, low skill (wall push-up, glute bridge, band row, dead bug, walking, most gentle stretches).
2 Beginner: unsupported bilateral, light load, simple technique (incline/knee push-up, bodyweight squat, goblet squat, DB RDL, plank, low step-up, farmer carry, machines).
3 Intermediate: full bodyweight or moderate free weight, unilateral or more stability, moderate skill (push-up, split squat, reverse lunge, DB bench, KB swing, side plank, assisted pull-up, low box jump, most barbell assistance lifts).
4 Advanced: high relative load, high skill or high stability/coordination (barbell back/front squat, conventional deadlift, strict pull-up, dips, Bulgarian split squat loaded, Turkish get-up, ab rollout standing, hanging leg raise, depth/plyo push-ups).
5 Expert: gymnastic/Olympic skill or extreme leverage (one-arm push-up, pistol, muscle-up, handstand push-up, snatch, clean & jerk, full Nordic curl, human flag, front lever, planche, dragon flag).
Modifiers: +1 unilateral, unstable/suspended setup, high-skill barbell/Olympic, ≥70% bodyweight lever; −1 assisted/supported, machine path, reduced ROM. Clamp 1–5. Advanced yoga inversions/arm balances ≥4.

### joint_load (0–3 per joint) — how much the movement stresses that region for a typical user
0 none/negligible · 1 low (bodyweight, shallow range, supported) · 2 moderate (loaded, full range, or sustained) · 3 high (heavy axial/shear, deep loaded flexion, impact landing, end-range loaded, inverted bodyweight on joint).
Anchors:
- knee: walking 1, glute bridge 0, bodyweight squat 1, goblet squat 2, back squat 3, lunge 2, Bulgarian split squat 3, pistol 3, box jump 3, jump squat 3, leg extension 2, wall sit 2, kneeling exercises on the knee 1 (+flag `kneeling_on_knee`).
- back (lumbar): plank 1, bird dog 0, DB RDL 2, barbell deadlift 3, good morning 3, back squat 3, sit-ups 2, Jefferson curl 3, bent-over barbell row 3, chest-supported row 0, overhead press standing 2.
- shoulder: push-up 1, bench press 2, OHP 2, behind-the-neck press 3, dips 3, upright row 3, pull-up 2, handstand 3, lateral raise 1, face pull 1, hanging 2.
- wrist: plank on hands 2, forearm plank 0, push-up 2, front rack 2, straight-bar curl 1, wrist curl 1, handstand 3, crow pose 3, planche 3.
- hip: hip thrust 1, deep squat 2, cossack 2, pigeon stretch 1, hip abduction 1.
- ankle: running 2, jumping 3, calf raise 1, walking 1, deep squat 2.

### impact (0–2)
0 none · 1 low (marching, step-ups, jogging on the spot, skipping without jumps, low hops) · 2 high (running, jumping, burpees with jump, plyometrics, jump rope).

### noise (0–2)
0 quiet · 1 some (dropping light DBs, steps, moderate stomping) · 2 loud (jumping, slams, battle ropes, dropping barbells). Used for "楼下有人" constraint.

### space
`mat` fits on a yoga mat · `small` ≈2×2 m · `medium` needs walking/lunging room ≈ 4 m line · `large` needs a gym/lane/outdoors (running, sled, rope climb, walking lunges over distance).

### position (all that apply in normal execution)
Used for pregnancy (`supine` after week 13, `prone`), knee (`kneeling`), older adults (getting down/up from floor).

### flags (all that apply)
`deep_knee_flexion` loaded knee flexion past ~90° (deep squats, pistols, full lunges, sissy squat) · `loaded_spinal_flexion` (weighted sit-ups, Jefferson curl, cable crunch heavy) · `loaded_spinal_rotation` (loaded Russian twist, heavy woodchop) · `overhead_load` · `heavy_axial_load` (barbell squat/deadlift/OHP heavy) · `valsalva_prone` (exercises typically done with heavy breath-hold bracing: heavy barbell compound lifts, max holds) · `balance_demand` (single-leg standing, narrow base) · `unstable_surface` (stability ball, rings, TRX, BOSU) · `jumping` · `running` · `high_fall_risk` (eyes-closed balance, single-leg on unstable, plyometric landing, inverted) · `grip_intensive` (hangs, carries, heavy pulls) · `wrist_extension_loaded` (flat-palm push-up/plank, front rack, handstand) · `kneeling_on_knee`.

### use (all that apply)
`main` primary strength slot · `accessory` · `warmup` (low-load activation, dynamic mobility) · `cooldown` (static stretch, breathing) · `conditioning` (cardio, circuits, carries, swings) · `skill` (gymnastic/Olympic, not for general auto-programming unless user is advanced).

### ladder
Use these ladder ids where the exercise fits; otherwise null: `push_h` (wall→incline→knee→push-up→decline/deficit→archer→one-arm), `push_v` (pike→elevated pike→handstand hold→HSPU; DB press family step by load), `squat` (assisted/box→bodyweight→goblet→DB/KB front→barbell→pistol), `lunge` (split squat→reverse lunge→walking lunge→Bulgarian→loaded Bulgarian→pistol), `hinge` (glute bridge→hip thrust; bodyweight good morning→DB RDL→KB deadlift→single-leg RDL→barbell RDL/deadlift), `pull_v` (dead hang/scap pull→band pulldown→negatives→assisted pull-up→pull-up→weighted→muscle-up), `pull_h` (band row→high inverted row→low inverted row→feet-elevated row; DB row family), `core_ae` (dead bug→incline plank→plank→long-lever plank→rollout knees→standing rollout), `core_lat` (side plank knees→side plank→side plank leg lift→copenhagen). `step` = integer position (1 = easiest). Only steps are compared within the same ladder.

### default_dose
Ranges from evidence/02 & /04:
- Compound strength (main): beginner sets 2–3, reps 8–12, RIR 2–3; intermediate sets 3–4, reps 6–12, RIR 1–2.
- Isolation/accessory: beginner 2–3 × 10–15, RIR 2–3; intermediate 2–4 × 10–20, RIR 1–2.
- Bodyweight high-rep (push-ups, squats): use reps (beginner 6–15) and progress via ladder.
- Isometric: seconds (beginner 15–30 s × 2–3; intermediate 30–60 s × 3).
- Mobility/stretch: 1–2 sets × 20–30 s (per side if unilateral), total ≥60 s per muscle across sets.
- Cardio: seconds per bout (warm-up 180–300 s; conditioning intervals 20–60 s work), or continuous minutes; reps null.
- Power/Olympic: intermediate only (beginner null), sets 3–5, reps 2–5, RIR 2–3.
- Difficulty 5 or `use: skill`: beginner null.

### time
`setup_s` (5 bodyweight, 15 DB/KB/band, 30 machine/cable, 60 barbell) · `s_per_rep` (default 3.5; ballistic 1.5–2; slow eccentrics 5) · `per_side` true when each side is done separately (doubles time).

### confidence / review
`high` obvious; `medium` reasonable judgement; `low` unclear from data. Set `review: true` if confidence is low **or** any joint_load = 3 **or** flags include `high_fall_risk`/`valsalva_prone` **or** difficulty 5. These go to the human coach review queue.

## Consistency checks (run after annotation)
- `jumping` flag ⇔ impact = 2 (or 1 for low hops); jumping ⇒ knee ≥ 2 and ankle ≥ 2; noise ≥ 1.
- `running` ⇒ impact = 2, space = large unless treadmill.
- `mobility` modality ⇒ nsca_class none, use ∋ warmup|cooldown, dose in seconds.
- Barbell compound squat/hinge ⇒ heavy_axial_load, back ≥ 2.
- `deep_knee_flexion` ⇒ knee ≥ 2.
- Within a ladder, difficulty must be non-decreasing with step.
- Isolation pattern ⇒ nsca_class isolation.
- Supine position present for bench/floor press, dead bug, glute bridge, crunches, lying leg raise etc.
- Every pattern has ≥ 4 exercises with equipment `none` or bands (home coverage report).

14. Single-leg standing balance drills, tandem walking and standing balance yoga poses → `balance` (modality isometric or strength). Use `balance` as a secondary pattern for single-leg strength holds (warrior three, single-leg RDL hold).
