# Evidence Base 01: Guidelines, Safety and Scope

Scope: adults aged 18 and over, general fitness, home or gym. Compiled 2026-10-13.
Evidence grades:
- **A** = official guideline or position stand
- **B** = systematic review or meta-analysis, or a large pooled cohort analysis
- **C** = practitioner consensus, a single trial or cohort, or a secondary source

Source IDs in [brackets] refer to the source list at the end of each topic.

---

## Topic 1: Global physical activity guidelines for adults

### Key conclusions

1. **Aerobic dose (adults 18–64).** WHO 2020 and PAG 2018 set the same aerobic targets. The weekly target is 150–300 min of moderate-intensity activity, or 75–150 min of vigorous activity, or an equivalent mix. Equivalence is 1 vigorous minute ≈ 2 moderate minutes. Both rate this a strong recommendation. [WHO20][PAG18] **A**
   - UK CMO 2019 sets the floor at ≥150 min moderate or ≥75 min vigorous. It also says shorter durations of *very* vigorous activity count, such as sprinting or stair climbing. [UKCMO] **A**
2. **More is better beyond the target.** Activity above 300 min moderate (or above 150 min vigorous) per week gives additional benefit. WHO rates this as conditional. [WHO20][PAG18] **A**
3. **Muscle strengthening.** Do it on ≥2 days per week, at moderate or greater intensity, covering all major muscle groups. All three guidelines agree. [WHO20][PAG18][UKCMO] **A**
   - ACSM 2011 recommends 2–3 days per week of resistance training for each major muscle group. It also recommends flexibility work on ≥2 days per week (about 60 s total per muscle group) and neuromotor/balance work on 2–3 days per week. [GARBER11] **A**
4. **Older adults (65+).**
   - WHO adds varied multicomponent activity (balance plus strength) at moderate or greater intensity on ≥3 days per week, to prevent falls. [WHO20] **A**
   - UK CMO asks for strength, balance and flexibility on ≥2 days per week. [UKCMO] **A**
   - PAG asks for multicomponent activity, with effort set relative to the person's own fitness. [PAG18] **A**
5. **Bouts of any length count.** The old minimum of 10 minutes per bout was dropped in 2018 (PAG) and 2020 (WHO). [WHO20][PAG18] **A**
   - Supporting cohort data comes from VILPA (vigorous intermittent lifestyle physical activity, i.e. short vigorous bursts during daily life) in non-exercisers. A median of 3 bursts per day (1–2 min each, about 4.4 min/day in total) was associated with 26–40% lower all-cause mortality and 32–49% lower CVD mortality. [STAM22] **C** (observational)
6. **Sedentary time.** All three guidelines say to limit sitting and replace it with activity of any intensity, light included. None of them sets a numeric cap. [WHO20][PAG18][UKCMO] **A**
   - WHO adds that people with high sedentary time should aim *above* the moderate-to-vigorous physical activity (MVPA) target.
   - A harmonised meta-analysis of more than 1 million adults found that about 60–75 min/day of moderate activity appeared to eliminate the excess mortality linked to more than 8 h/day of sitting. For TV viewing of ≥3 h/day it attenuated the risk but did not eliminate it. [EKE16] **B**
7. **Some is better than none.** All three guidelines state this explicitly. Inactive people benefit from small amounts and should increase gradually. [WHO20][PAG18][UKCMO] **A**
8. **Status of updates.**
   - No new WHO adult targets have been published since 2020.
   - The next US edition (PAG 3rd ed.) is not expected before 2028. The literature cut-off for its review is 31 Dec 2025. [ODPHP24] **A**
   - The UK CMO guideline page shows a 2026 "updated" date, but the adult targets are unchanged from 2019. [UKCMO]

### Engine implications

- **Weekly targets per user:**
  - Default aerobic target: `aerobic_moderate_equiv_min_week = 150`, with a stretch goal of 300.
  - Count vigorous minutes at 2×: `moderate_equiv = moderate_min + 2 * vigorous_min`.
  - Strength: `strength_days_week >= 2`, covering all major muscle groups (legs, hips, back, chest, shoulders, arms, core) at least once per week.
- **Age ≥65 module:** add `balance_days_week >= 2`. Use 3 as the default, to match WHO's ≥3 days of multicomponent work. Balance can be combined with strength sessions.
- **Bouts:** credit sessions or "snacks" of any length (≥1 min) toward weekly minutes. Do not enforce a 10-minute minimum.
- **Sedentary nudges:** offer optional prompts to break up sitting, for example every 30–60 min. This interval is a product choice; no guideline specifies it. If a user reports more than 8 h/day of sitting, raise the aerobic stretch goal.
- **Onboarding for beginners:** if current activity is below target, set week-1 targets well under 150 min (for example 60–90 min) and ramp up. Copy hint: "Every minute counts — start where you are."
- **Ceiling:** do not cap at 300 min/week. Above that, apply the recovery and overuse logic from the progression rules.

### Disagreements and uncertainty

- **Flexibility:** UK CMO lists flexibility for older adults, and ACSM recommends it for all adults. WHO and PAG give it no numeric target.
- **Sedentary limits:** there is no agreed numeric sitting limit. The 60–75 min/day offset figure is observational.
- **VILPA:** the data are wearable-based observational associations and may be confounded.
- **Vigorous credit:** the 1:2 equivalence is a convention based on METs. It is not physiologically exact.

### Sources (Topic 1)

- [WHO20] Bull FC, Al-Ansari SS, Biddle S, et al. 2020. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 54(24):1451–1462. DOI 10.1136/bjsports-2020-102955 (opened via PMC7719906)
- [PAG18] Piercy KL, Troiano RP, Ballard RM, et al. 2018. The Physical Activity Guidelines for Americans. *JAMA* 320(19):2020–2028. DOI 10.1001/jama.2018.14854 (opened via CDC Stacks)
- [PAG18] US DHHS. 2018. *Physical Activity Guidelines for Americans*, 2nd ed. https://odphp.health.gov/sites/default/files/2019-09/Physical_Activity_Guidelines_2nd_edition.pdf (opened)
- [UKCMO] UK Chief Medical Officers. 2019 (page updated 2026). UK Chief Medical Officers' Physical Activity Guidelines. https://www.gov.uk/government/publications/physical-activity-guidelines-uk-chief-medical-officers-report (opened)
- [UKCMO] UK DHSC. Physical activity for adults and older adults (infographic text). https://www.gov.uk/government/publications/physical-activity-guidelines-adults-and-older-adults/physical-activity-for-adults-and-older-adults-19-and-over-text-of-the-infographic (opened)
- [GARBER11] Garber CE, Blissmer B, Deschenes MR, et al. 2011. Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults. *Med Sci Sports Exerc* 43(7):1334–1359. DOI 10.1249/MSS.0b013e318213fefb (abstract opened)
- [EKE16] Ekelund U, Steene-Johannessen J, Brown WJ, et al. 2016. Does physical activity attenuate, or even eliminate, the detrimental association of sitting time with mortality? *Lancet* 388(10051):1302–1310. DOI 10.1016/S0140-6736(16)30370-1 (abstract opened)
- [STAM22] Stamatakis E, Ahmadi MN, Gill JMR, et al. 2022. Association of wearable device-measured vigorous intermittent lifestyle physical activity with mortality. *Nat Med*. DOI 10.1038/s41591-022-02100-x (summary opened)
- [ODPHP24] ODPHP. 2024. Get Involved: Contribute to the Next Edition of the Physical Activity Guidelines. https://odphp.health.gov/news/202410/get-involved-contribute-next-edition-physical-activity-guidelines (opened)

---

## Topic 2: Pre-participation screening and safety boundaries

### Key conclusions

1. **The ACSM 2015 algorithm uses three factors:** (a) whether the person currently exercises regularly, (b) known cardiovascular, metabolic or renal (CMR) disease, and/or signs or symptoms suggesting it, and (c) the intensity they want to do. Risk-factor counting was dropped from the screening decision. Pulmonary disease alone no longer triggers referral. [RIEBE15] **A**
   - "Regular exercise" means planned, structured activity of ≥30 min at moderate intensity, on ≥3 days per week, for ≥3 months. [RIEBE15; definition confirmed via secondary source OEP] **A/C**

2. **Branches of the algorithm.** [RIEBE15][FRANK20] **A**

   | Group | Medical clearance | Starting intensity and progression |
   |---|---|---|
   | Inactive, no CMR disease, no symptoms | Not needed | Light to moderate; progress gradually to vigorous |
   | Inactive, known CMR disease, no symptoms | Recommended before starting | After clearance: light to moderate, progress as tolerated |
   | Inactive, any symptoms | Recommended before any exercise | After clearance: light to moderate |
   | Active, no CMR disease, no symptoms | Not needed | Continue at moderate or vigorous; progress gradually |
   | Active, known CMR disease, no symptoms | Not needed for moderate; recommended for vigorous (ideally within the past 12 months) | Continue at moderate while awaiting clearance |
   | Active, any new symptoms | Required: stop exercising and seek clearance | Resume after clearance |

3. **Signs and symptoms that trigger clearance.** [RIEBE15 via secondary source OEP] **A/C**
   - chest, neck, jaw or arm pain or discomfort of ischaemic type
   - unusual shortness of breath at rest or on mild exertion
   - dizziness or fainting (syncope)
   - breathlessness when lying flat (orthopnoea) or waking at night breathless (paroxysmal nocturnal dyspnoea)
   - ankle swelling
   - palpitations or a racing heart (tachycardia)
   - calf pain when walking that eases with rest (intermittent claudication)
   - a known heart murmur
   - unusual fatigue or breathlessness during usual activities

4. **PAR-Q+ (2023 consensus version).** [PARQ23][PARQ25] **A**
   - It is the current official self-screen and supersedes earlier editions. A form dated 01-11-2024 carries a 2025 copyright; its questions are unchanged.
   - Seven yes/no questions:
     1. heart condition or high blood pressure diagnosed by a doctor
     2. chest pain at rest, during daily activities or during activity
     3. loss of balance from dizziness, or loss of consciousness, in the past 12 months (excluding dizziness from over-breathing)
     4. another diagnosed chronic condition
     5. prescribed medication for a chronic condition
     6. a current (or past-12-month) bone, joint or soft-tissue problem that more activity could worsen
     7. a doctor's advice to do only medically supervised activity
   - **All NO:** the person is cleared. Start slowly and build up gradually.
   - **Any YES:** the person completes condition-specific follow-up questions (arthritis/osteoporosis/back, cancer, heart, hypertension, diabetes/metabolic, mental health, respiratory, spinal cord injury, stroke, other).
   - **Any YES on the follow-ups:** before becoming more active, the person should complete ePARmed-X+ and/or see a qualified exercise professional.
   - **Examples of follow-up flags:** resting BP ≥160/90 mmHg or unknown; frequent low blood sugar after exercise; a recent fracture or osteoporotic fracture; a stroke within 6 months; blackout or concussion within 12 months; two or more medical conditions.
   - **Delay becoming more active** during a temporary illness such as a cold or fever. Talk to a provider (or use ePARmed-X+) if pregnant, or if health changes. Clearance is valid for up to 12 months.
   - **Age 45+:** anyone over 45 who is not used to vigorous or maximal exercise should consult a qualified exercise professional before doing it.
   - **Suggested starting dose** for people who answer YES: 20–60 min of low-to-moderate exercise, 3–5 days per week, aerobic plus strength, building toward ≥150 min/week.

5. **Absolute risk is low, and higher with unaccustomed vigorous effort.** [FRANK20] **A**
   - Vigorous exercise raises sudden cardiac death (SCD) risk transiently, by 3–17×, during and up to 30 min after the session. It raises heart attack (MI) risk by 2–10× within 1 h.
   - Absolute risk stays small. Example: 0.39 cardiac arrests per 100,000 marathon participants.
   - Risk is highest with strenuous, sudden, unaccustomed or highly anaerobic efforts in inactive people.
   - Mitigation: warm-up and cool-down; inactive people should avoid unaccustomed vigorous exercise; learn the warning signs; adjust for the environment (heat, altitude).
   - Habitually active people have a much lower relative risk (the ACSM rationale [RIEBE15]).

6. **Symptoms that mean "stop now" during exercise.** Stop and seek care for:
   - chest pressure, squeezing or fullness
   - pain spreading to the arm, back, neck, jaw or stomach
   - unusual breathlessness out of proportion to the effort
   - dizziness, light-headedness or near-fainting
   - palpitations or an irregular, skipping heartbeat
   - cold sweat or nausea

   Chest discomfort lasting more than a few minutes should be treated as a medical emergency (call emergency services). [Healthline citing AHA: **C**; consistent with the ACSM symptom list and AHA advice to "recognize warning signs": **A**]

7. **Safety principle: start low, go slow.** Physical activity is safe for almost everyone, and benefits far outweigh risks. Musculoskeletal injury risk rises with volume and is higher in less-fit people doing the same activity, so increase load gradually. [PAG18][UKCMO] **A**

### Engine implications

- **Onboarding safety gate (mandatory, before the first plan):**
  - Ask the 7 PAR-Q+ questions in paraphrased form, plus: currently pregnant or postpartum, currently ill or feverish, and current activity status (≥30 min moderate, ≥3×/week, for ≥3 months).
  - **Any PAR-Q YES or a symptom flag:** set `requires_clearance = true`. Until the user confirms clearance:
    - block vigorous, HIIT, maximal-effort and plyometric content
    - allow only light-to-moderate templates (RPE ≤ 4–5/10, or "can talk comfortably")
    - show "Check with your doctor or a qualified exercise professional before increasing intensity"
  - **Hard stop:** chest pain or fainting in the past 12 months. Generate no plan until the user acknowledges clearance. The product team should decide whether to show only gentle mobility content in the meantime.
  - **Pregnancy:** route to the pregnancy module. ACOG/GAQ-P evidence is out of scope for this file.
  - **Temporary illness:** offer "pause/rest" mode.
- **Intensity gate by activity status:**
  - Inactive users: start with `max_intensity = moderate`. Unlock vigorous or HIIT only after ≥4–8 weeks of adherence with no reported symptoms. The 4–8-week window is a product heuristic consistent with ACSM's "gradual progression", not a published number.
  - Age 45+ and not used to vigorous exercise: show an advisory before the first HIIT or max-effort session, and require the user to acknowledge it.
- **In-session red-flag button.** A persistent "Something feels wrong" control lists the stop symptoms. Selecting one ends the session, shows emergency guidance for chest pain or fainting, and locks the plan until the user confirms they have seen a clinician.
- **Re-screen** every 12 months and whenever the user reports a new diagnosis, medication, or symptom.
- **Always include warm-up and cool-down blocks**, minimum 5 min each for any session at moderate or higher intensity. The 5-minute value is a convention; [FRANK20] recommends warm-up and cool-down but gives no duration.
- **Copy rules:** never state that the app "clears" anyone medically. The app is not a medical device. Avoid fear framing; the message is that exercise is safe for most people.

### Disagreements and uncertainty

- **Effect of screening:** there is little evidence that medical clearance or exercise testing reduces exercise-related cardiac deaths [RIEBE15]. Screening mainly serves triage and liability.
- **Over-referral:** PAR-Q+ is more conservative than ACSM. Any chronic condition or medication triggers follow-up questions. That reduces false negatives but can deter people from starting. ACSM explicitly aims to reduce over-referral.
- **Symptom list sourcing:** the exact ACSM symptom list was confirmed only via secondary sources, because the full text was paywalled and PubMed blocked access. It matches standard ACSM GETP teaching.
- **Very-high-volume training:** possible harms (atrial fibrillation, coronary calcification) remain unproven [FRANK20], so they are not relevant to default consumer volumes.

### Sources (Topic 2)

- [RIEBE15] Riebe D, Franklin BA, Thompson PD, Garber CE, Whitfield GP, Magal M, Pescatello LS. 2015. Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473–2479. DOI 10.1249/MSS.0000000000000664 (abstract opened via URI Digital Commons; algorithm opened via ACSM summary slides, https://uwi.edu/sport/sites/sport/files/ACSM-ReccommendationsforPHEScreening.pdf)
- [OEP] Open Exam Prep. PAR-Q+ and ACSM Preparticipation Screening (secondary source, used to confirm the symptom list and "regular exercise" definition). https://open-exam-prep.com/study-guides/ace-cpt/health-screening/preparticipation-health-screening (opened) **C**
- [PARQ23] Warburton D, Jamnik V, Bredin SSD, Shephard RJ, Gledhill N. 2023. The 2023 Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) and electronic Physical Activity Readiness Medical Examination (ePARmed-X+). *Health & Fitness Journal of Canada* 16(1):46–49. DOI 10.14288/hfjc.v16i1.839 (opened, including the PDF)
- [PARQ25] PAR-Q+ Collaboration. PAR-Q+ form, version date 01-11-2024, © 2025. https://southlake.ca/wp-content/uploads/2025/02/PARQPlus2025-Form-fillable.pdf (opened; a third-party host of the official form)
- [FRANK20] Franklin BA, Thompson PD, Al-Zaiti SS, et al. 2020. Exercise-related acute cardiovascular events and potential deleterious adaptations following long-term exercise training: placing the risks into perspective. AHA Scientific Statement. *Circulation* 141:e705–e736. DOI 10.1161/CIR.0000000000000749 (opened ACC "Ten Points to Remember" summary; DOI confirmed via search result)
- Healthline. Problems during exercise: warning signs (cites AHA). https://www.healthline.com/health/heart-disease/problems-during-exercise (opened) **C**: replace with a primary AHA page if possible.
- [PAG18], [UKCMO]: see Topic 1.

---

## Topic 3: Exercise for fat loss and health, spot reduction, steps and NEAT

### Key conclusions

1. **ACSM 2009 position stand on weight.** [DONN09] **A**
   - 150–250 min/week of moderate activity prevents weight gain, but gives only modest weight loss.
   - More than 250 min/week is associated with clinically significant weight loss.
   - 150–250 min/week adds to weight loss under *moderate* diet restriction, but not under severe restriction.
   - More than 250 min/week may help maintain weight after loss. This rests on observational data, not RCTs.
   - Resistance training does not enhance weight loss, but may increase fat-free mass and fat loss and lowers health risk.
   - Health benefits occur even when no weight is lost.
2. **PAG 2018 on weight.** Many people need more than 150 min/week to maintain weight. Losing more than 5% of body weight, or keeping substantial loss off, may need more than 300 min/week of moderate activity. [PAG18] **A**
3. **Dose-response for aerobic exercise.** Jayedi 2024 analysed 116 RCTs (n = 6,880, adults with overweight or obesity). [JAYEDI24] **B**
   - Each additional 30 min/week of aerobic exercise gave about −0.52 kg body weight, −0.56 cm waist, −0.37 percentage points body fat, and −1.6 cm² visceral fat. Certainty was moderate to high.
   - At 150 min/week: about −2.8 kg weight and about −2.1 percentage points body fat.
   - At 300 min/week: about −4.2 kg weight and −4 to −5 cm waist.
   - Exercise alone produces modest weight loss. Diet drives most of the deficit.
4. **Resistance training reduces fat even without diet.** In healthy adults, resistance training alone reduced body fat by about 1.5 percentage points, fat mass by about 0.55 kg, and visceral fat (SMD −0.49) versus control. [WEW22] (58 studies) **B**
5. **Aerobic vs resistance vs combined.** In the 8-month STRRIDE AT/RT RCT (n = 119, adults with overweight):
   - Aerobic training reduced body mass and fat mass more than resistance training.
   - Resistance training (alone or combined) increased lean mass more than aerobic training.
   - Combined training took twice the time and gave no significant extra fat loss over aerobic alone. [WILLIS12] **C** (single RCT, but widely cited)
   - **Practical synthesis:** combine both. Aerobic volume drives the energy deficit; resistance training preserves or builds lean mass.
6. **HIIT vs moderate continuous training (MICT) for fat.** [VIANA19] **B**
   - Total fat mass fell with both. Interval training produced greater absolute fat-mass loss (between-group about −2.3 kg; the authors report 28.5% more).
   - Body fat percentage changes did not differ between the two.
   - Sprint interval training favoured fat-mass loss over MICT.
   - Heterogeneity is notable, so HIIT is an option, not a requirement.
7. **Spot reduction does not work.** A meta-analysis of 13 controlled studies (37 trained-versus-untrained limb comparisons, n = 1,158) found no localized fat loss from training a specific region: g = −0.03, p = 0.51. [RC21] **B**
8. **Daily steps.**
   - **Paluch 2022** (15 cohorts, n = 47,471). Mortality fell progressively with more steps, then levelled off. [PALUCH22] **B**
     - Plateau at about 6,000–8,000 steps/day in adults ≥60, and about 8,000–10,000 steps/day in adults <60.
     - Hazard ratios for quartiles 2–4 versus quartile 1 (median about 3,500 steps/day): 0.60, 0.55, 0.47.
     - Faster stepping cadence added little once total steps were accounted for.
   - **Ding 2025** (57 studies). Versus 2,000 steps/day, 7,000 steps/day was associated with 47% lower all-cause mortality (similar to 10,000) and 38% lower dementia risk. Gains were significant from 2,000 up to 5,000–7,000 steps/day. [DING25] **B**
9. **Sitting and non-exercise activity thermogenesis (NEAT).** NEAT means the calories burned through daily movement outside formal exercise. Light activity and less sitting carry independent benefit (see Topic 1, [EKE16]). Steps are the practical NEAT proxy. **A/B**

### Engine implications

- **Goal = fat loss:**
  - Default to ≥150 min/week of moderate-equivalent aerobic activity plus 2–3 resistance sessions per week. Progress toward 200–300 min/week over 8–12 weeks if the user tolerates it.
  - Pair the plan with a nutrition prompt; the engine should not imply exercise alone will drive large losses.
  - Expected-results copy: about 0.5 kg per 30 min/week over the program length (roughly 2.5–3 kg at 150 min/week, about 4 kg at 300 min/week). Phrase this as "on average, alongside your nutrition".
- **Always include resistance training** for fat-loss goals, to protect lean mass and reduce visceral fat. Never generate cardio-only plans for a fat-loss goal.
- **Spot reduction:** never label exercises as "burn belly fat" or "tone thighs to lose fat". Copy hint: "You can't choose where fat comes off. Core work builds strength; overall activity and nutrition reduce fat."
- **Step goal module:**
  - Baseline: measure or ask for current steps, then add about 1,000–2,000 steps/day every 1–2 weeks. This increment is a product heuristic.
  - Default targets: 7,000–8,000 steps/day for age ≥60, and 8,000–10,000 for age <60.
  - Treat 10,000 as optional, not required. Show any increase from a low baseline as meaningful.
  - Steps count toward NEAT, not automatically toward MVPA minutes. Only brisk walking (talk-test moderate) counts as MVPA.
- **HIIT for fat loss:** offer it as an optional, time-efficient substitute for part of the weekly volume. It is subject to the Topic 2 safety gate.

### Disagreements and uncertainty

- **Dose thresholds:** ACSM 2009 thresholds (>250 min/week) and Jayedi's continuous dose-response broadly agree. Individual response varies widely, and compensatory eating and NEAT reduction can blunt losses.
- **HIIT fat-mass advantage:** this is inconsistent across meta-analyses and small in absolute terms. Body fat percentage did not differ.
- **Resistance vs aerobic for fat loss:** in direct comparisons, aerobic training tends to win on total fat mass and resistance training wins on lean mass. Recent meta-analyses show resistance training alone does reduce fat.
- **Step data:** associations are observational; reverse causation is possible. Different devices count steps differently.
- **Ding 2025 citation:** details come from a university press release and the DOI was not checked on the journal site. Verify before quoting specific numbers.

### Sources (Topic 3)

- [DONN09] Donnelly JE, Blair SN, Jakicic JM, Manore MM, Rankin JW, Smith BK. 2009. Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults (ACSM Position Stand). *Med Sci Sports Exerc* 41(2):459–471. DOI 10.1249/MSS.0b013e3181949333 (abstract opened via secondary host; DOI confirmed via search result)
- [JAYEDI24] Jayedi A, Soltani S, Emadi A, Zargar MS, Najafi A. 2024. Aerobic exercise and weight loss in adults: a systematic review and dose-response meta-analysis. *JAMA Netw Open* 7(12):e2452185. DOI 10.1001/jamanetworkopen.2024.52185 (full text opened)
- [WEW22] Wewege MA, Desai I, Honey C, et al. 2022. The effect of resistance training in healthy adults on body fat percentage, fat mass and visceral fat: a systematic review and meta-analysis. *Sports Med* 52(2):287–300. PMID 34536199 (abstract opened; DOI not confirmed)
- [WILLIS12] Willis LH, Slentz CA, Bateman LA, et al. 2012. Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults. *J Appl Physiol* 113(12):1831–1837. PMID 23019316 (abstract opened via PEDro; DOI not confirmed)
- [VIANA19] Viana RB, Naves JPA, Coswig VS, et al. 2019. Is interval training the magic bullet for fat loss? A systematic review and meta-analysis comparing MICT with HIIT. *Br J Sports Med* 53(10):655–664. DOI 10.1136/bjsports-2018-099928 (abstract opened)
- [RC21] Ramirez-Campillo R, Andrade D, Clemente F, Afonso J, Pérez-Castilla A, Gentil P. 2021/2022. A proposed model to test the hypothesis of exercise-induced localized fat reduction (spot reduction), including a systematic review with meta-analysis. *Human Movement* 23(3):1–14. DOI 10.5114/hm.2022.110373 (opened)
- [PALUCH22] Paluch AE, Bajpai S, Bassett DR, et al. 2022. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. *Lancet Public Health* 7(3):e219–e228. DOI 10.1016/S2468-2667(21)00302-9 (abstract opened)
- [DING25] Ding D, Owen K, et al. 2025. Daily steps and health outcomes in adults: a systematic review and dose-response meta-analysis. *Lancet Public Health*. DOI 10.1016/S2468-2667(25)00164-1 (University of Sydney press release opened; DOI not checked on the journal site)
- [PAG18], [EKE16]: see Topic 1.

---

## Topic 4: Aerobic intensity without equipment; HIIT; low-impact options

### Key conclusions

1. **Talk test.** [CDC-INT][PAG18] **A**; validity [BOK22] **B**
   - **Moderate:** you can talk but not sing.
   - **Vigorous:** you cannot say more than a few words without pausing for breath.
   - A 2022 review found the talk test and RPE valid for locating the ventilatory threshold (VT) and the respiratory compensation threshold (RCT), so they can steer people into the moderate, heavy and severe intensity domains without testing.
   - The "equivocal" talk stage (speech becoming somewhat uncomfortable) roughly marks VT. The "negative" stage (cannot speak comfortably) roughly marks RCT.
2. **Relative effort on a 0–10 scale.** 0 = sitting, 10 = maximal effort. Moderate = 5–6; vigorous starts at 7–8. [CDC-INT] **A**
   - Bok 2022 places VT at RPE about 10–11 and RCT at about 13–15. The abstract does not name the scale; the values fit the Borg 6–20 scale. [BOK22] **B**
3. **Absolute intensity in METs.** Light <3.0 METs, moderate 3.0–5.9, vigorous ≥6.0. Examples: brisk walking is moderate; jogging and stair climbing are vigorous. [PAG18] **A**
4. **Maximum heart rate (HRmax).** [TANAKA01] **B**
   - Tanaka formula: `HRmax ≈ 208 − 0.7 × age`. Derived from 351 studies (18,712 people) plus a lab study of 514 people. The formula does not differ by sex or training status.
   - The older `220 − age` formula overestimates HRmax in young adults and underestimates it after about age 40 (by roughly 10 bpm at age 70).
   - Individual SD is about 10 bpm. Predicted HRmax can be off by more than 20 bpm.
   - The formula does not apply to people on beta-blockers or with cardiovascular disease.
   - **%HRmax bands** (commonly cited ACSM/CDC values): moderate about 64–76% HRmax; vigorous about 77–93/95% HRmax. [unverified in opened sources; from ACSM GETP/CDC as recalled and per search titles, so confirm before release] **A (unverified)**
5. **HIIT effectiveness.** HIIT is effective and time-efficient but is not superior to MICT on most health outcomes.
   - **Cochrane 2026** (58 RCTs, n = 2,075, healthy sedentary adults 18–64) [COCH26] **B**
     - Versus no exercise: HIIT likely improves VO2max and slightly reduces waist circumference.
     - Versus MICT: HIIT may slightly improve VO2max, with little or no difference in waist, blood pressure or lipids.
     - Certainty is low to very low. All included trials were *supervised*. None reported adverse events.
   - **Meta-review** (33 systematic reviews): HIIT improves fitness and cardiometabolic markers, adherence is above 80% in trials, and no acute injuries were reported. [MART20] **B**
6. **HIIT safety.** [ROG12][WEW18][FRANK20] **B/C**
   - **Cardiac rehabilitation (Rognmo 2012):** in 4,846 patients over 175,820 supervised hours, there was 1 cardiac arrest per 129,456 h of moderate training versus 1 per 23,182 h of high-intensity training. Both rates are low. [ROG12] **C**
   - **Cardiovascular disease patients (Wewege 2018):** 23 studies, 1 major event per about 11,333 HIIT training hours. [WEW18] **B**
   - **General population:** risk is concentrated in *unaccustomed* vigorous effort in inactive or at-risk people. [FRANK20]
   - **Unsupervised consumer HIIT:** evidence is thin.
7. **Low-impact alternatives.** The guidelines count any aerobic activity that reaches the target intensity, for example brisk walking, cycling, swimming, stair climbing, or dancing. [PAG18][UKCMO] **A**
   - Intensity is defined by effort (talk test or RPE), not by impact. Low-impact moves can therefore reach moderate or vigorous intensity.
   - Higher volume raises musculoskeletal injury risk, especially in less-fit people. [PAG18] **A**
   - No impact-specific meta-analysis was reviewed for this file. **C** for impact-substitution rules.

### Engine implications

- **Primary intensity cue = talk test plus 0–10 RPE.** These need no device. Encode each aerobic block with:
  - `target_rpe_0_10`: moderate 5–6, vigorous 7–8, HIIT work intervals 8–9, recovery 2–4
  - `talk_cue`: "can talk, not sing" or "only a few words"
  - optional `%HRmax`, computed with Tanaka (208 − 0.7 × age) and shown as a range with a "± about 10 bpm" note
  - If the user reports beta-blockers or a heart condition: hide HR targets and use RPE only.
- **HIIT eligibility gate:** all of the following must be true:
  - passed screening (no clearance flag)
  - completed ≥4 weeks of regular moderate training (product heuristic)
  - no new symptoms
  - for age ≥45 and new to vigorous exercise, acknowledged the advisory
- **HIIT defaults for the general population (C, practitioner convention):**
  - 1–2 sessions per week, never on consecutive days
  - start with 4–6 intervals of 30–60 s at RPE 8, with equal or longer recovery
  - 5–10 min warm-up and 5 min cool-down
  - progress by adding intervals before raising intensity
  - all-out sprint intervals only for advanced users
- **Low-impact toggle:** swap jumps, burpees and running for:
  - marching or step-ups
  - a shadow-boxing circuit
  - incline or brisk walking
  - stair climbing
  - cycling or rowing (gym)

  Keep the same RPE target. Use this as the default for users who report joint pain, high body mass, pelvic-floor concerns, or older age (≥65).
- **Volume progression:** increase weekly aerobic minutes gradually; vary modalities to spread impact load. The commonly used limit is about 10% or a small step per week. This rule is practitioner-level only (C) and was not verified here.
- **Copy hints:** "Moderate = you can chat but not sing." "Hard = only a few words at a time." "Stop and seek help if you feel chest pain, dizziness, or an irregular heartbeat."

### Disagreements and uncertainty

- **RPE anchors:** they vary by scale and source. Bok 2022's values (about 10–11 at VT) sit lower than the ACSM classification many textbooks use for moderate intensity (12–13 on 6–20). Be consistent in-app and prefer the 0–10 scale used by CDC/PAG.
- **HRmax formulas:** individual error is large, so treat any computed heart rate as guidance only.
- **HIIT safety in unsupervised settings:** this is under-studied. Cochrane notes no adverse-event reporting and only supervised trials.
- **HIIT vs MICT:** most outcomes show equivalence. Preference and enjoyment should drive the choice.

### Sources (Topic 4)

- [CDC-INT] CDC. How to Measure Physical Activity Intensity. https://www.cdc.gov/physical-activity-basics/measuring/index.html (opened)
- CDC. Target Heart Rate and Estimated Maximum Heart Rate. https://www.cdc.gov/physicalactivity/basics/measuring/heartrate.htm [unverified: fetch failed; the %HRmax values above are not confirmed]
- [BOK22] Bok D, Rakovac M, Foster C. 2022. An examination and critique of subjective methods to determine exercise intensity: the Talk Test, Feeling Scale, and Rating of Perceived Exertion. *Sports Med* 52(9):2085–2109. DOI 10.1007/s40279-022-01690-3 (abstract opened)
- [TANAKA01] Tanaka H, Monahan KD, Seals DR. 2001. Age-predicted maximal heart rate revisited. *J Am Coll Cardiol* 37(1):153–156. DOI 10.1016/s0735-1097(00)01054-8 (full text opened)
- [COCH26] Strauss JA, Kirwan R, Ranasinghe C, et al. 2026. High-intensity interval training for reducing cardiometabolic syndrome in healthy but sedentary populations. *Cochrane Database Syst Rev* Issue 3. DOI 10.1002/14651858.CD013617.pub2 (PEDro record opened)
- [MART20] Martland R, Mondelli V, Gaughran F, Stubbs B. 2020. Can high-intensity interval training improve physical and mental health outcomes? A meta-review of 33 systematic reviews across the lifespan. *J Sports Sci* 38(4):430–469. DOI 10.1080/02640414.2019.1706829 (PEDro record opened)
- [ROG12] Rognmo Ø, et al. 2012. Cardiovascular risk of high- versus moderate-intensity aerobic exercise in coronary heart disease patients. *Circulation*. (ACC journal-scan summary opened; author list and DOI [unverified])
- [WEW18] Wewege MA, et al. 2018. High-intensity interval training for patients with cardiovascular disease: is it safe? A systematic review. *J Am Heart Assoc*. (DOAJ abstract opened; author list and DOI [unverified])
- [PAG18], [UKCMO], [FRANK20]: see Topics 1–2.

---

## Cross-topic default parameter summary for the engine

| Parameter | Default | Range / rule | Grade |
|---|---|---|---|
| Aerobic, moderate-equivalent min/week | 150 | 150–300+ (fat loss: progress to 200–300) | A |
| Vigorous credit | ×2 | — | A |
| Strength days/week | 2 | 2–3, all major muscle groups | A |
| Balance days/week (≥65) | 3 | ≥2 (UK) to ≥3 (WHO) | A |
| Minimum bout counted | 1 min | no 10-min rule | A |
| Steps/day target | 7,000–8,000 (≥60); 8,000–10,000 (<60) | +1,000–2,000 per 1–2 weeks from baseline | B / C (ramp) |
| Moderate intensity | RPE 5–6/10; talk, not sing | 3.0–5.9 METs | A |
| Vigorous intensity | RPE 7–8/10; few words | ≥6 METs | A |
| HRmax estimate | 208 − 0.7 × age | SD ±10 bpm; hide if beta-blockers or heart condition | B |
| HIIT sessions/week | 0 (locked) → 1–2 | unlock after screening plus ≥4 weeks of training | B / C |
| Clearance gate | any PAR-Q+ YES or ACSM symptom | lock to light-to-moderate | A |
| Re-screen interval | 12 months | or on any health change | A |
