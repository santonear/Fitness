# 05 — Special Populations and Joint-Caution Substitution

Scope: evidence base for a deterministic training engine in a consumer fitness app (adults 18+). The app does not diagnose, treat or rehabilitate. It may only (a) adapt general training conservatively, (b) substitute exercises, and (c) tell users to stop and seek professional advice.

Evidence grades: **A** = official guideline or position stand; **B** = systematic review or meta-analysis; **C** = practitioner consensus, expert opinion, or a single biomechanical study.

Access notes (Oct 2026): PubMed/PMC pages returned a bot check and the Europe PMC API was blocked, so several items were confirmed through publisher pages, Cochrane abstracts or institutional repositories. The ACOG Committee Opinion 804 full text on acog.org and journals.lww.com could not be loaded. Its content below comes from three independent secondary summaries that agree with each other (marked "via secondary"). Confirm against the primary before shipping copy.

---

## 1. Older adults (65+)

### Key conclusions
- **Aerobic dose is the same as for younger adults:** 150–300 min/week moderate, or 75–150 min/week vigorous, or an equivalent mix. **(A, WHO 2020)**
- **Muscle strengthening:** at moderate or greater intensity, working all major muscle groups, on 2 or more days/week. **(A, WHO 2020)**
- **Multicomponent training:** varied activity that emphasises functional balance and strength, at moderate or greater intensity, on **3 or more days/week**. It counts toward the weekly total and aims to improve function and prevent falls. **(A, WHO 2020)**
- **Falls prevention:** exercise reduces the rate of falls by about **23%** (RaR 0.77; 59 studies, about 13,000 participants; high certainty). That is roughly 195 fewer falls per 1,000 people per year. **(B, Sherrington 2019 Cochrane)**
  - Balance and functional exercise: about 24% fewer falls (high certainty).
  - Multiple types, usually balance/functional plus resistance: about 34% fewer falls (moderate certainty).
  - Tai chi: about 19% fewer falls (low certainty for rate of falls).
  - Resistance training alone, dance or walking alone: evidence insufficient.
  - Flexibility or endurance alone: no trials.
  - Most effective programmes lasted 12 weeks or longer. Programmes that safely challenge balance appear particularly effective.
- **Resistance training prescription (NSCA position statement, via secondary summary of Fragala 2019):** **(A)**
  - Frequency: 2–3 days/week.
  - Volume: 1–3 sets per major muscle group. Single sets are acceptable for beginners. Use 8–10 exercises.
  - Reps: 10–15 for beginners; 6–12 for strength.
  - Intensity: progress toward 70–85% 1RM where appropriate. Moderate loads (about 50–70% 1RM) may be sufficient. Training to failure is not needed.
  - Power training: about 40–60% 1RM with fast (explosive) concentric actions.
  - Frail adults: start very light (about 20–30% 1RM) and build to 3 sets of 8–12. Include functional moves such as sit-to-stand.
  - Machines are a reasonable starting point for frail, beginner or limited users.
- **Safety (NSCA, via secondary):** Most injuries occur in inexperienced lifters and relate to heavy loads, poor technique or poor exercise choice. Take extra care with the shoulder, knee, hip and spine. Avoid acute blood-pressure spikes with uncontrolled hypertension. People with unstable medical conditions should consult a physician first. With osteoarthritis, adjust exercise choice, range, intensity and volume. **(A/C)**
- **ACSM 2009 position stand:** an exercise programme for older adults should include aerobic, muscle-strengthening and flexibility work. Inactivity should be avoided. **(A)** Per-component details were not re-verified in this pass.

### Engine implications
- **Eligibility gate:** at age 65 or older, run the general screening gate from Topic 5. Also ask about falls in the past 12 months, fear of falling, dizziness and use of a walking aid. If the user reports any of these, start the "balance-cautious" profile: supported or near-wall balance work, no unsupported single-leg or eyes-closed drills, and no plyometrics.
- **Programme template:** at least 2 strength days and at least 3 days/week with a balance/functional component. These can be combined; for example, 10 minutes of balance at the end of a strength session.
- **Progression rules:** start at an RPE of about 5–6/10 (10–15 reps) for 2–4 weeks before moving toward 6–12 reps. Raise load by small steps, at most about 5–10% per step. Progress balance from static to dynamic, and from wide to narrow base, before removing hand support.
- **Power:** offer only after at least 4–6 weeks of consistent training with no flagged symptoms. Use light loads (about 40–60% of a working weight) with "lift fast, lower slowly" cues. Prefer seated or machine options such as fast sit-to-stand or band push. Do not offer jumps by default.
- **Exclusion flags:** `high_fall_risk` (unsupported single-leg balance, eyes-closed balance, plyometrics, unstable-surface drills); `heavy_valsalva` (heavy low-rep max efforts) when hypertension is reported.
- **Warning copy:** "Stop and seek medical advice if you feel chest pain or pressure, unusual breathlessness, dizziness or faintness, a racing or irregular heartbeat, or if you fall and hit your head."
- **Never:** prescribe a falls "treatment" programme, assess fall risk clinically, or tell users with osteoporosis/fracture history which loads are "safe". Refer them to a professional instead.

### Disagreements and uncertainty
- Resistance training alone has not been shown to prevent falls (Cochrane). Strength-only templates are therefore insufficient for fall-prevention goals; balance must be included.
- Power training dose (load, velocity) varies across sources. The NSCA ranges are from a secondary summary; check them against the full text.
- WHO sets multicomponent training at 3 days/week but does not specify session length.

---

## 2. Pregnancy

### Key conclusions
- **Everyone without a contraindication should be active throughout pregnancy, including previously inactive women.** **(A, Canada 2019; WHO 2020; ACOG 804 via secondary)**
- **Dose:** at least **150 min/week moderate** activity over at least **3 days/week**, with daily activity encouraged. Combine aerobic and resistance work. Yoga or gentle stretching may help. **(A)** ACOG suggests 20–30 min on most days (via secondary).
- **Intensity check:** use the talk test (can talk, but not sing) or a Borg RPE of about 13–14/20. High-intensity work only in a monitored setting (Canada). **(A)**
- **Pelvic floor training:** daily pelvic floor muscle training may reduce urinary incontinence risk (Canada weak/low; WHO). **(A)** Cochrane: antenatal pelvic floor training in continent women probably lowers incontinence risk in late pregnancy (RR 0.38; moderate certainty) and slightly lowers it at 3–6 months postnatal (RR 0.71; high certainty). **(B)**
- **Supine position:**
  - WHO: avoid lying flat on the back after the first trimester. **(A)**
  - Canada: if supine exercise causes lightheadedness, nausea or feeling unwell, change position (weak/very low). **(A)**
  - ACOG (via secondary): after about 20 weeks, supine positions may reduce venous return and cause hypotension; modify or avoid prolonged supine positions. **(A)**
  - A systematic review found insufficient evidence on whether supine exercise is safe. Acute supine exercise was associated with abnormal fetal heart rate patterns in 31% of cases in the included studies. **(B, Mottola 2019 BJSM)**
- **Activities to avoid:** **(A)**
  - Contact sports, and activities with high fall or abdominal-trauma risk (e.g., off-road cycling, horse riding, skiing, gymnastics).
  - Scuba diving and skydiving.
  - Hot yoga or hot Pilates.
  - Exercise in extreme heat or humidity.
  - High-altitude exertion if not acclimatised.
  - Stay hydrated.
- **Previously active people:** they may continue running, strength training and similar activity with provider input. Competitive or high-volume athletes should be supervised. **(A)**
- **Absolute contraindications (Canada 2019; ACOG similar):** **(A)**
  - Ruptured membranes; premature/preterm labour.
  - Unexplained persistent vaginal bleeding.
  - Placenta praevia after 28 weeks (ACOG: after 26 weeks).
  - Pre-eclampsia; incompetent cervix.
  - Intrauterine growth restriction (relative in ACOG).
  - High-order multiples.
  - Uncontrolled type 1 diabetes, hypertension or thyroid disease.
  - Serious cardiovascular, respiratory or systemic disorder. ACOG specifies haemodynamically significant heart disease, restrictive lung disease and severe anaemia.
- **Relative contraindications (Canada):** **(A)**
  - Recurrent pregnancy loss; history of spontaneous preterm birth.
  - Gestational hypertension.
  - Mild/moderate cardiovascular or respiratory disease.
  - Symptomatic anaemia; malnutrition; eating disorder.
  - Twin pregnancy after 28 weeks.
  - Other significant conditions.
  - ACOG adds: extreme under- or overweight, heavy smoking, poorly controlled seizure disorder, unevaluated arrhythmia, and orthopaedic limitations.
- **Stop and consult (combined Canada + ACOG):** **(A)**
  - Vaginal bleeding.
  - Regular painful contractions.
  - Fluid leaking from the vagina.
  - Breathlessness that persists with rest, or laboured breathing before exertion.
  - Chest pain.
  - Dizziness or faintness that does not resolve with rest; headache.
  - Muscle weakness affecting balance.
  - Calf pain or swelling.
  - Abdominal pain.

### Engine implications
- **Eligibility gate (mandatory):** if the user indicates pregnancy, require explicit confirmation that a prenatal care provider has said there is no reason to avoid exercise, and that none of the listed absolute contraindications apply. Show the list in plain language.
  - If the user answers "yes" to any absolute contraindication: block the training programme and show "please talk to your prenatal care provider".
  - If the user answers "yes" to any relative contraindication: block until they confirm provider approval.
  - Re-confirm each trimester (about weeks 13 and 28).
- **Exclusion flags:**
  - `supine`: from week 13 (WHO cut-off), substitute incline/side-lying/seated versions. For example, incline dumbbell press for bench press, side-lying or standing core for crunches, and wall or incline positions for dead bug. This is more conservative than ACOG's 20 weeks and is chosen deliberately.
  - `high_impact` / `plyometric`: exclude by default for users who were previously inactive. For users already running before pregnancy, allow with "if comfortable and your provider agrees".
  - `fall_risk`: exclude unstable surfaces, agility drills and balance challenges in the later stages. Balance changes as pregnancy progresses.
  - `contact` and `heat`: never schedule, and add a hot-environment warning.
  - `heavy_valsalva`: exclude max or near-max lifts and breath-hold bracing; cue exhale on exertion. Graded C, as precautionary consensus; see uncertainty.
  - `prone`: exclude lying face-down once the bump makes it uncomfortable (C).
  - `deep_abdominal_flexion`: no full sit-ups or crunches after the first trimester; this follows from the supine flag (C).
- **Intensity cap:** moderate (talk test, RPE about 13–14/20 or 5–6/10). No HIIT unless the user was previously trained and confirms provider approval. Even then, cap at short intervals with the talk test respected between efforts.
- **Weekly target:** 150 min over at least 3 days, combining aerobic and strength work. Include a daily pelvic floor reminder ("ask a health professional for technique").
- **Warning copy:** "Stop exercising now and contact your maternity care provider if you have vaginal bleeding, fluid leaking, regular painful contractions, chest pain, dizziness or faintness that doesn't settle with rest, breathlessness before or that doesn't ease after exercise, headache, calf pain or swelling, or weakness affecting your balance."
- **Never:** advise on whether a specific complication is compatible with exercise, interpret symptoms, or suggest exercise to "induce labour" or treat gestational diabetes.

### Disagreements and uncertainty
- **Supine timing:** WHO says after the first trimester; ACOG says about 20 weeks; Canada says only if symptomatic. The systematic review found the evidence insufficient. The engine takes the most conservative timing.
- **Placenta praevia cut-off:** 26 weeks (ACOG) vs 28 weeks (Canada).
- **Valsalva and heavy lifting:** no guideline-quality evidence was located in this pass, so heavy-Valsalva exclusion is precautionary (C).
- **IUGR:** absolute contraindication in Canada, relative in ACOG.

---

## 3. Postpartum

### Key conclusions
- **Activity target:** at least 150 min/week moderate activity postpartum; strength work 2 days/week; restart gradually; pelvic floor exercise daily from as soon as possible. **(A, WHO 2020; UK DHSC infographic 2022, updated 2026)**
- **After caesarean:** consult a provider before returning (WHO). **(A)**
- **Early postpartum (ACOG via secondary):** pelvic floor exercise can start immediately postpartum. Exercise does not affect milk supply; feeding or expressing beforehand reduces discomfort. **(A)**
- **Running timeline (Goom, Donnelly & Brockwell 2019, expert consensus):** earliest return to running is about **3 months (12 weeks)**, typically 3–6 months. **(C)**
  - Weeks 0–2: walking, pelvic floor, gentle core.
  - Weeks 2–4: progress walking; consider squats, lunges and bridges.
  - Weeks 4–6: static bike or cross-trainer.
  - Weeks 6–8: power walking, light resistance work.
  - Weeks 8–12: swimming once bleeding has stopped and wounds have healed; spin.
  - Offer a specialist pelvic health physiotherapy assessment from 6 weeks.
- **Readiness checks before running (Goom 2019):** all of these without pain, heaviness, dragging or leakage:
  - Walk 30 min.
  - Single-leg balance 10 s.
  - Single-leg squat ×10 each side.
  - Jog on the spot 1 min.
  - Forward bounds ×10.
  - Hop ×10 each leg.
  - Running man ×10 each side.

  Strength targets of about 20 reps (single-leg calf raise, bridge, sit-to-stand, side-lying abduction) guide training but are not a gate. **(C)**
- **Risk modifiers that slow progression (Goom 2019):**
  - Less than 3 months postpartum.
  - Caesarean or perineal trauma.
  - Breastfeeding.
  - BMI over 30.
  - Poor sleep.
  - Hypermobility.
  - Pre-existing pelvic floor or lumbopelvic problems.
  - Low energy availability.
  - Psychological drivers of over-exercise.
  - Caesarean tissue healing continues beyond 6 weeks. **(C)**
- **Pelvic floor muscle training (Cochrane, Woodley 2020):**
  - Antenatal training helps prevent incontinence (see Topic 2).
  - Postnatal training as treatment for women who are already incontinent shows no clear effect at 6–12 months (low certainty).
  - Postnatal training started after delivery in mixed populations is uncertain (moderate certainty).

  The takeaway for an app is that pelvic floor reminders are reasonable, but leakage needs professional assessment, not app-driven therapy. **(B)**
- **Diastasis recti:** a 2025 BJSM systematic review and meta-analysis (Beamish, Davenport et al.) found abdominal training reduced inter-recti distance by about 0.5 cm more than control. Certainty was low at rest and moderate during head-lift. The clinical significance is uncertain. **(B, via secondary)** ACOG notes that abdominal strengthening, including drawing-in exercises, may reduce diastasis (via secondary). **(A)** Goom 2019: function (pressure control, no doming) matters more than gap width for running readiness. **(C)**
- **Pelvic floor dysfunction signs needing referral (Goom 2019):** **(C)**
  - Urinary or faecal leakage; urgency.
  - Heaviness, pressure, bulge or dragging.
  - Pain with intercourse; obstructed defecation.
  - Abdominal separation with doming or poor function.
  - Lumbopelvic pain.
  - Vaginal bleeding beyond 8 weeks not linked to periods.

### Engine implications
- **Eligibility gate:** ask how long ago the birth was and how (vaginal, assisted/perineal tear, caesarean).
  - Before the routine postnatal check (about 6–8 weeks, varies by country): allow only the "early postpartum" bundle, which is walking, pelvic floor reminders and gentle mobility. Show "check with your provider before starting".
  - After the check: require confirmation that the user has been cleared for exercise.
  - After a caesarean: always require confirmation of clearance before anything beyond walking (WHO).
- **Phased template (all deliveries):**
  - Phase 1 (0–6 weeks): walking, pelvic floor, breathing and gentle core.
  - Phase 2 (6–12 weeks, after clearance): low-impact cardio (bike, cross-trainer, swim once healed); bodyweight to light resistance, 2 days/week.
  - Phase 3 (12 weeks or later): high-impact or running is eligible only if the user confirms the readiness checklist with no symptoms.
  - After a caesarean or reported perineal trauma: add a 2–4 week buffer to each phase. This buffer is an engine choice (C).
- **Exclusion flags:**
  - `high_impact` / `plyometric` / `running`: excluded before 12 weeks.
  - `heavy_valsalva` and heavy loaded spinal flexion: excluded before 12 weeks (C).
  - `crunch/sit-up` if the user reports abdominal "doming": substitute exhale-led bracing and side-lying or quadruped variations (C). Do not label this as diastasis treatment.
- **Symptom-driven regression:** if the user reports leakage, heaviness, dragging, pain or bleeding during or after a session, regress to the previous phase. Remove impact and heavy lifting, and show referral copy. Do not auto-progress again until the user confirms they have seen a professional or symptoms are absent for 2 consecutive weeks (engine rule, C).
- **Warning copy:** "Leaking, a feeling of heaviness or dragging, pelvic or abdominal pain, or bleeding that returns or continues aren't things to push through. Pause impact and heavy lifting, and speak to your GP, midwife or a pelvic health physiotherapist." Use urgent copy for heavy bleeding, fever, a hot/red/oozing wound, calf pain or swelling, chest pain or breathlessness: "seek medical care promptly".
- **Never:** diagnose or "measure" diastasis or prolapse, prescribe a pelvic floor rehabilitation protocol, or promise to "close the gap".

### Disagreements and uncertainty
- Running timing comes from expert consensus (level 4), not trials. Some clinicians individualise earlier or later.
- Typical timing of the postnatal medical check differs by country (UK 6–8 weeks; ACOG favours ongoing care in the first 12 weeks). The ACOG timing was not verified in primary text.
- Diastasis evidence shows small, low-certainty effects, and the definitions of a meaningful gap vary.

---

## 4. Joint-caution substitution (not treatment)

### Key conclusions
- **Knee OA:**
  - Structured land-based exercise (strength, aerobic, neuromuscular/balance) and mind-body exercise (tai chi, yoga) are core, strongly recommended treatments. They are safe regardless of comorbidity. **(A, OARSI 2019)**
  - ACR/AF 2019 strongly recommends exercise and tai chi, and weight loss for overweight users. It found no hierarchy among exercise types (walking, cycling, resistance/isometric, aquatic) and no single best dose. Supervision and adherence improve results. **(A)**
- **Squat depth (biomechanics review):** modelled retropatellar compressive force peaks around 90° knee flexion. Deep squats are not shown to be harmful in trained people with good technique. Heavy partial squats may raise joint stress. This is not guidance for symptomatic knees. **(C, Hartmann 2013)**
- **Pain-monitoring heuristic (from tendinopathy RCT, not knee-specific):**
  - Activity is acceptable if pain stays below 5/10 during exercise.
  - Any flare should settle by the next morning.
  - Pain and stiffness should not increase week to week.

  This is a widely used practitioner rule. **(C, Silbernagel 2007)**
- **Low back pain (NICE NG59):** encourage continuing normal activities and give self-management advice. Consider group exercise (biomechanical, aerobic, mind-body or combination) based on needs and preferences. Exercise-led care is central. The 2026 update withdrew the psychological therapy recommendations, but the exercise and self-management advice is unchanged. Clinicians should consider alternative causes (cancer, infection, trauma, inflammatory disease). Cauda equina and progressive neurological deficit are outside the guideline's scope and are emergencies. **(A)**
- **Shoulder pressing modifications (practitioner text):** **(C, Somerset & Pope)**
  - Lower the load or slow the reps.
  - Reduce pressing frequency and volume.
  - Narrow the grip.
  - Switch to dumbbells, kettlebells or a landmine.
  - Use a lower plane (incline instead of overhead).
  - For bench press, use a neutral grip or reduced depth (floor press).
  - If no pain-free press works, swap to rows.
- **Wrist:** in a small lab study (n=14), push-ups on a neutral wrist distributed force more uniformly than hyperextended-wrist push-ups. The authors suggested the neutral position is likely safer, but no injury outcomes were measured. **(C, Polovinets 2018)**

### Engine implications

**Joint-caution flags (user self-report, not diagnosis):** `knee_caution`, `back_caution`, `shoulder_caution`, `wrist_caution`. Each flag triggers its substitution table and the pain rule. Each also triggers the red-flag screen, and a positive screen blocks training and refers the user.

**Substitution rules (deterministic, in priority order; pick the first that the user has equipment for):**

| Flag | Avoid or de-prioritise | Substitute with |
|---|---|---|
| knee | jumps, bounding, running intervals; deep loaded knee flexion (heavy full squats, deep lunges, pistols); kneeling on the affected knee | box squat to a comfortable height; partial-range or tempo squat; leg press with limited range; wall-sit or Spanish-squat-style isometric holds (20–45 s); glute bridge or hip thrust; step-up to a low box; hamstring curls; stationary bike, elliptical, swimming or walking for cardio |
| back | heavy axial loading at max effort; loaded spinal flexion or twisting under load (weighted sit-ups, Jefferson curls); high-impact | goblet or box squat; trap-bar or kettlebell deadlift from blocks; supported rows (chest-supported, one-arm with bench support); bird dog, side plank, dead bug (if not pregnant); walking, cycling; keep the user active (do not prescribe rest) |
| shoulder | barbell overhead press, behind-neck press or pulldown, wide-grip deep bench, dips, upright rows, kipping | landmine press; incline dumbbell press; neutral-grip dumbbell press; floor press; push-up with reduced depth; reduce sets/frequency; if all pressing hurts, rows and face-pulls only |
| wrist | flat-palm push-ups and planks, front-rack barbell, straight-bar curls | push-ups on handles, dumbbells or fists (neutral wrist); forearm plank; incline push-up; neutral-grip dumbbells; EZ-bar; goblet hold instead of front rack |

**Pain rule (all joint flags):**
- If pain during a set is 3/10 or less and settles: continue.
- If pain is 4–5/10: stop that exercise and use the next substitute.
- If pain is above 5/10, lasts into the next morning, or worsens week to week: drop the movement pattern for that session and the next. Raise the user's caution level; if it repeats twice, show referral copy.
- The thresholds are an engine choice informed by the Silbernagel model (C).

**Progression with a flag:** hold load until 2 consecutive sessions meet the pain rule, then increase volume before load. Restore range of motion gradually, about 10–15° or one box height at a time (C).

**Red flags (block and refer).** Show "stop and seek medical advice", and mark as urgent where stated:
- **Any joint:**
  - Pain after a fall or impact.
  - Inability to bear weight or use the limb.
  - A joint that is hot, red and swollen, or comes with fever.
  - Locking or giving way.
  - Pain at night or at rest that is unexplained.
  - Visible deformity.
  - Numbness, tingling or weakness spreading into the limb.
- **Back, urgent:**
  - Numbness around the groin or buttocks.
  - New bladder or bowel problems.
  - Progressive leg weakness.
  - Back pain with fever or feeling unwell.
  - Back pain with a history of cancer.
  - Unexplained weight loss.
  - Back pain after significant trauma.
  - Severe constant pain unrelated to movement.

  Groin numbness, bladder/bowel changes and leg weakness are cauda equina features; send the user to emergency care.
- **Shoulder:** pain with chest pain or breathlessness (route to Topic 5 cardiac copy); sudden loss of arm movement after injury.

**Never:**
- Name a diagnosis ("you have patellofemoral pain").
- Label sessions as "rehab" or "treatment".
- Prescribe a condition protocol (e.g., McKenzie, eccentric programmes).
- Tell users to rest completely for back pain.
- Encourage training through red-flag symptoms.

### Disagreements and uncertainty
- Deep squats are not intrinsically harmful in healthy trained people (Hartmann 2013), yet the engine reduces depth for flagged knees. This is a tolerance and comfort heuristic, not evidence of harm. State it as "a shorter range is often more comfortable".
- OA guidelines found no best exercise type. Substitutions should therefore respect user preference and tolerance rather than implying one modality is superior.
- The shoulder and wrist heuristics rest on practitioner texts and small biomechanical studies only (C).
- The red-flag list is general clinical consensus. NICE NG59 delegates specific red-flag lists to other guidance, which was not verified here.

---

## 5. Conditions requiring medical clearance (ACSM 2015 algorithm)

### Key conclusions
- **Screening factors:** ACSM's 2015 update screens on three factors: (1) current physical activity, (2) known cardiovascular, metabolic (type 1/2 diabetes) or renal disease, or signs/symptoms of it, and (3) desired intensity. Risk-factor counting was removed to cut unnecessary referrals. **(A, Riebe 2015)**
- **Algorithm logic (via ACE summary of ACSM GETP 10th ed.):** **(A/C)**
  - **Not regularly active:**
    - Known disease or symptoms: medical clearance before starting.
    - Asymptomatic with no disease: start light to moderate and progress gradually.
  - **Regularly active:**
    - Any new signs or symptoms: stop and get clearance.
    - Known disease, asymptomatic: may continue moderate. Clearance is recommended before vigorous work.
  - **Resistance training:** evidence is insufficient to require formal pre-screening.
  - **Self-screening tool:** PAR-Q+.
- **Signs and symptoms prompting clearance:**
  - Chest, neck, jaw or arm pain or discomfort.
  - Breathlessness at rest or with mild exertion.
  - Dizziness or fainting.
  - Breathlessness when lying down or at night.
  - Ankle swelling.
  - Palpitations.
  - Calf pain when walking (claudication).
  - Known heart murmur.
  - Unusual fatigue. **(A)**
- **Uncontrolled hypertension:** avoid acute pressure spikes from heavy, breath-holding efforts (NSCA). Uncontrolled hypertension is also an absolute pregnancy contraindication (Canada). **(A)**

### Engine implications
- **Onboarding gate (all users):** a PAR-Q+-style questionnaire covering:
  - Diagnosed heart, metabolic (diabetes) or kidney disease.
  - Each sign or symptom above.
  - Uncontrolled high blood pressure.
  - Pregnancy or recent birth.
  - Current activity level.
  - Any "yes" to disease and the user is inactive: block, and require confirmation of medical clearance.
  - Any "yes" to symptoms: block, and refer.
  - Known disease, regularly active, asymptomatic: allow moderate only (RPE 6/10 or less). Vigorous/HIIT is locked until clearance is confirmed.
- **Uncontrolled or unknown-status hypertension:** set `heavy_valsalva` exclusion; cap sets at 8 or more reps at RPE 7/10 or less; no isometric max holds (C).
- **In-app symptom check:** add a "Stop" button available during sessions. If any cardiac symptom is selected, end the session and show urgent copy ("If chest pain or severe breathlessness doesn't settle with rest, call emergency services"). Lock training until the user confirms clearance.
- **Re-screening:** every 12 months, and whenever the user updates health status. This interval is an engine choice (C).
- **Never:** interpret symptoms, adjust for medications, or present clearance as optional once a gate is triggered.

### Disagreements and uncertainty
- The ACSM guidance treats regularly active, asymptomatic people with known disease as fine at moderate intensity. A consumer app cannot verify "asymptomatic", so the engine stays conservative.
- The detailed algorithm figure was confirmed via a secondary summary (ACE). The Riebe 2015 abstract confirms the three factors.

---

## Sources

**Opened and confirmed (bibliographic details checked on the publisher, Cochrane, repository or official page):**
1. Bull FC, Al-Ansari SS, Biddle S, et al. 2020. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462. DOI: 10.1136/bjsports-2020-102955.
2. World Health Organization. 2020. WHO guidelines on physical activity and sedentary behaviour. https://www.who.int/publications/i/item/9789240015128 (landing page only; full PDF failed to load).
3. Sherrington C, Fairhall N, Wallbank G, et al. 2019. Exercise for preventing falls in older people living in the community. *Cochrane Database Syst Rev* (1):CD012424. DOI: 10.1002/14651858.CD012424.pub2. Plain-language summary opened at cochrane.org; abridged version: *Br J Sports Med* 2020;54(15):885, https://bjsm.bmj.com/content/54/15/885.
4. Fragala MS, Cadore EL, Dorgo S, Izquierdo M, Kraemer WJ, Peterson MD, Ryan ED. 2019. Resistance training for older adults: position statement from the National Strength and Conditioning Association. *J Strength Cond Res* 33(8):2019–2052. DOI: 10.1519/JSC.0000000000003230. Citation confirmed via UTEP repository; recommendation numbers from IDEA Fit secondary summary (https://www.ideafit.com/resistance-training-for-older-adults-new-nsca-position-stand); full text not opened.
5. Chodzko-Zajko WJ, Proctor DN, Fiatarone Singh MA, et al. 2009. Exercise and physical activity for older adults (ACSM position stand). *Med Sci Sports Exerc* 41(7):1510–1530. DOI: 10.1249/MSS.0b013e3181a0c95c. Abstract only.
6. Mottola MF, Davenport MH, Ruchat S-M, et al. 2018/2019. 2019 Canadian guideline for physical activity throughout pregnancy. *Br J Sports Med* 52(21):1339–1346 (https://bjsm.bmj.com/content/52/21/1339); co-published *J Obstet Gynaecol Can* 40(11):1549–1559, DOI: 10.1016/j.jogc.2018.07.001.
7. Mottola MF, Nagpal TS, Bgeginski R, et al. 2019. Is supine exercise associated with adverse maternal and fetal outcomes? A systematic review. *Br J Sports Med* 53(2):82–89. DOI: 10.1136/bjsports-2018-099919.
8. American College of Obstetricians and Gynecologists. 2020. Physical Activity and Exercise During Pregnancy and the Postpartum Period. Committee Opinion No. 804. *Obstet Gynecol* 135(4):e178–e188. https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/04/physical-activity-and-exercise-during-pregnancy-and-the-postpartum-period. Primary text could not be loaded; content confirmed via secondary summaries at obgproject.com, lamaze.org and dona.org. DOI [unverified].
9. Woodley SJ, Lawrenson P, Boyle R, Cody JD, Mørkved S, Kernohan A, Hay-Smith EJC. 2020. Pelvic floor muscle training for preventing and treating urinary and faecal incontinence in antenatal and postnatal women. *Cochrane Database Syst Rev* (5):CD007471. DOI: 10.1002/14651858.CD007471.pub4.
10. Goom T, Donnelly G, Brockwell E. 2019. Returning to running postnatal: guideline for medical, health and fitness professionals managing this population. Self-published guideline, March 2019. https://athleticsni.org/download/files/Returning_to_running_postnatal_guideline_for_medical_health_and_fitness_professionals_managing_this_population.05.pdf
11. Department of Health and Social Care (UK). 2022, updated 2026. Physical activity for women after childbirth (birth to 12 months): text of the infographic. https://www.gov.uk/government/publications/physical-activity-guidelines-pregnancy-and-after-childbirth/physical-activity-for-women-after-childbirth-birth-to-12-months-text-of-the-infographic
12. Bannuru RR, Osani MC, Vaysbrot EE, et al. 2019. OARSI guidelines for the non-surgical management of knee, hip, and polyarticular osteoarthritis. *Osteoarthritis Cartilage* 27:1578–1589. DOI: 10.1016/j.joca.2019.06.011.
13. Kolasinski SL, Neogi T, Hochberg MC, et al. 2020. 2019 American College of Rheumatology/Arthritis Foundation guideline for the management of osteoarthritis of the hand, hip, and knee. *Arthritis Rheumatol* 72(2):220–233. DOI: 10.1002/art.41142.
14. National Institute for Health and Care Excellence. 2016, updated 2020 and July 2026. Low back pain and sciatica in over 16s: assessment and management (NG59). https://www.nice.org.uk/guidance/ng59. Recommendations PDF opened (2020 version); 2026 changes via Physitrack summary, https://www.physitrack.com/en-gb/insights/nice-low-back-pain-guideline-update-2026.
15. Riebe D, Franklin BA, Thompson PD, et al. 2015. Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473–2479. DOI: 10.1249/MSS.0000000000000664. Abstract via URI repository.
16. American Council on Exercise. 2018. New preparticipation guidelines remove barriers to exercise. https://www.acefitness.org/continuing-education/certified/february-2018/6898/new-preparticipation-guidelines-remove-barriers-to-exercise (secondary summary of the ACSM algorithm).
17. Hartmann H, Wirth K, Klusemann M. 2013. Analysis of the load on the knee joint and vertebral column with changes in squatting depth and weight load. *Sports Med* 43:993–1008. DOI: 10.1007/s40279-013-0073-6.
18. Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. 2007. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy: a randomized controlled study. *Am J Sports Med* 35(6):897–906. DOI: 10.1177/0363546506298279. Rules confirmed via secondary summary.
19. Polovinets O, Wolf A, Wollstein R. 2018. Force transmission through the wrist during performance of push-ups on a hyperextended and a neutral wrist. *J Hand Ther* 31(3):322–330. DOI: 10.1016/j.jht.2017.04.005.
20. Somerset D, Pope D. Rock Solid Resilience (Human Kinetics), ch. 8 excerpt: How to modify weight training due to shoulder pain. https://us.humankinetics.com/blogs/excerpt/how-to-modify-weight-training-due-to-shoulder-pain. Year [unverified].
21. Beamish NF, Davenport MH, Ali MU, et al. 2025. Impact of postpartum exercise on pelvic floor disorders and diastasis recti abdominis: a systematic review and meta-analysis. *Br J Sports Med* 59(8):562–575. https://bjsm.bmj.com/content/59/8/562. Seen via secondary summary (physiotutors); DOI [unverified].

**Not opened (mentioned only for context):**
- PAR-Q+ 2017 questionnaire [unverified].
- Gluppe et al. 2021 systematic review on diastasis recti and abdominal/pelvic floor training (PMC8721086) [unverified; page blocked].
