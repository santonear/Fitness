import {
  createPregnancyReconfirmationDraft,
  updatePregnancyReconfirmationDraft,
  pregnancyPopulationFromDraft,
  pregnancyAbsoluteKeys,
  pregnancyRelativeKeys,
  type PregnancyReconfirmationEvent,
} from "../../../application/pregnancy-safety";
import { CmrSymptomsQuestions, cmrAnswerSummary } from "./CmrSymptomsQuestions";
import { Rules } from "../../../engine/data";
import {
  engineCopy,
  engineCopyList,
  screeningExpired,
} from "../../../coach/engine-copy";
import { useState } from "react";
import type { EngineProfileFields } from "../../../application/engine-profile";
import type { EngineProfile } from "../../../engine/contracts";

const fallKeys = [
  "fell_in_past_12_months",
  "afraid_of_falling",
  "frequent_dizziness",
  "uses_walking_aid",
] as const;
const olderAge = new Rules()
  .get("older.activation")
  .trigger.any.find((condition: { user?: string }) => condition.user === "age")
  .gte as number;

export interface EngineProfileDraftProps {
  value: EngineProfileFields;
  onChange: (value: EngineProfileFields) => void;
  locale: "zh" | "en";
  ageYears?: number;
}
export { fallKeys as engineFallKeys, olderAge as engineOlderAge };
/**
 * Shared screening draft for the settings editor and the one-question-per-screen onboarding.
 * Both write exactly the same fields: screening is only written once every answer is explicit.
 */
export function useEngineProfileDraft({
  value,
  onChange,
  locale,
  ageYears,
}: EngineProfileDraftProps) {
  const zh = locale === "zh",
    storedScreen = value.screening,
    screen =
      storedScreen?.rescreenRequired ||
      screeningExpired(storedScreen?.completedAt)
        ? undefined
        : storedScreen;
  const absoluteList = engineCopyList(
      "pregnancy.gate.copy.absolute_list",
      locale,
    ).map((row, index) => ({ ...row, key: pregnancyAbsoluteKeys[index] })),
    relativeList = engineCopyList(
      "pregnancy.gate.copy.relative_list",
      locale,
    ).map((row, index) => ({
      ...row,
      text: row.text.replace(/\s*(?:（待核实）|\(to verify\))/g, ""),
      key: pregnancyRelativeKeys[index],
    }));
  const [pregnancyDraft, setPregnancyDraft] = useState(() =>
    createPregnancyReconfirmationDraft(
      value.population?.kind === "pregnant" ? value.population : undefined,
      storedScreen?.rescreenRequired === true ||
        screeningExpired(storedScreen?.completedAt),
    ),
  );
  const contraindicationAnswers = pregnancyDraft.answers;
  const [fallsAnswers, setFallsAnswers] = useState<(boolean | undefined)[]>(
    () =>
      Array.from({ length: fallKeys.length }, (_, index) =>
        value.population?.kind === "older_adult"
          ? value.population.fallsAnswers?.[index]
          : undefined,
      ),
  );
  const birth = value.birthYearMonth?.split("-").map(Number),
    today = new Date();
  const currentAge = birth
    ? today.getFullYear() - birth[0] - (today.getMonth() + 1 < birth[1] ? 1 : 0)
    : ageYears;
  const [populationKind, setPopulationKind] = useState(
    value.population?.kind === "older_adult" && currentAge !== undefined && currentAge < olderAge
      ? "general" : value.population?.kind ?? "",
  );
  const [populationDraft, setPopulationDraft] = useState<{
    weeks?: number;
    provider?: boolean;
    contraindicationsNone?: boolean;
    delivery?: "vaginal" | "assisted_or_tear" | "cesarean";
    absolute?: string[];
    relative?: string[];
  }>(() => {
    const p = value.population;
    return p?.kind === "pregnant"
      ? { weeks: pregnancyDraft.week, provider: pregnancyDraft.provider }
      : p?.kind === "postpartum"
        ? {
            weeks: p.weeksSinceBirth,
            provider: p.cleared,
            delivery: p.delivery,
          }
        : {};
  });
  function changePregnancy(event: PregnancyReconfirmationEvent) {
    const next = updatePregnancyReconfirmationDraft(pregnancyDraft, event);
    setPregnancyDraft(next);
    setPopulationDraft({ weeks: next.week, provider: next.provider });
    onChange({ ...value, population: pregnancyPopulationFromDraft(next) });
  }
  function updatePopulation(next: typeof populationDraft) {
    if (populationKind === "pregnant") {
      if (next.weeks !== pregnancyDraft.week)
        changePregnancy({ type: "week", week: next.weeks });
      else if (next.provider !== undefined)
        changePregnancy({ type: "provider", answer: next.provider });
      return;
    }
    setPopulationDraft(next);
    onChange({
      ...value,
      population:
        populationKind === "postpartum" &&
        next.weeks !== undefined &&
        next.provider !== undefined &&
        next.delivery
          ? {
              kind: "postpartum",
              weeksSinceBirth: next.weeks,
              delivery: next.delivery,
              cleared: next.provider,
            }
          : undefined,
    });
  }
  const [answers, setAnswers] = useState<(boolean | undefined)[]>(
    screen?.parqAnswers ?? Array.from({ length: 7 }, () => undefined),
  );
  const [extra, setExtra] = useState<
    Partial<
      Pick<
        EngineProfile["screening"],
        | "knownCondition"
        | "symptoms"
        | "acuteIllness"
        | "activityStatus"
        | "restingBp"
      >
    >
  >({
    knownCondition: screen?.knownCondition,
    symptoms: screen?.symptoms,
    acuteIllness: screen?.acuteIllness,
    activityStatus: screen?.activityStatus,
    restingBp: screen?.restingBp,
  });
  const [cmrAnswers, setCmrAnswers] = useState<Record<string, boolean>>(
    screen?.cmrSymptoms ?? {},
  );
  function update(
    nextAnswers = answers,
    nextExtra = extra,
    nextCmr = cmrAnswers,
  ) {
    setAnswers(nextAnswers);
    setExtra(nextExtra);
    setCmrAnswers(nextCmr);
    const cmr = cmrAnswerSummary(nextCmr);
    const ready =
      nextAnswers.every((answer) => answer !== undefined) &&
      nextExtra.knownCondition !== undefined &&
      cmr.complete &&
      nextExtra.acuteIllness !== undefined &&
      nextExtra.activityStatus !== undefined &&
      nextExtra.restingBp !== undefined;
    onChange({
      ...value,
      ...(populationKind === "pregnant"
        ? { population: pregnancyPopulationFromDraft(pregnancyDraft) }
        : {}),
      screening: ready
        ? {
            ...storedScreen,
            ...nextExtra,
            parqAnswers: nextAnswers as boolean[],
            parqAllNo: nextAnswers.every((answer) => answer === false),
            knownCondition: nextExtra.knownCondition!,
            knownCmrDisease: nextExtra.knownCondition!,
            symptoms: cmr.symptoms,
            cmrSymptoms: nextCmr,
            completedAt: new Date().toISOString(),
            lastScreenedAt: new Date().toISOString(),
            rescreenRequired: false,
            clearance: undefined,
          }
        : storedScreen
          ? { ...storedScreen, rescreenRequired: true, clearance: undefined }
          : undefined,
    });
  }
  /** Several contraindication answers at once (for “以上都没有”); same reducer as single answers. */
  function changePregnancyAll(events: PregnancyReconfirmationEvent[]) {
    const next = events.reduce(updatePregnancyReconfirmationDraft, pregnancyDraft);
    setPregnancyDraft(next);
    setPopulationDraft({ weeks: next.week, provider: next.provider });
    onChange({ ...value, population: pregnancyPopulationFromDraft(next) });
  }
  return {
    zh, storedScreen, screen, absoluteList, relativeList, pregnancyDraft, setPregnancyDraft,
    contraindicationAnswers, fallsAnswers, setFallsAnswers, currentAge, populationKind, setPopulationKind,
    populationDraft, setPopulationDraft, changePregnancy, changePregnancyAll, updatePopulation, answers, extra, cmrAnswers, update,
  };
}

/** Answers remain incomplete until explicitly supplied; no unchecked box means “no”. */
export function EngineProfileEditor(props: EngineProfileDraftProps) {
  const { value, onChange, locale } = props;
  const {
    zh, screen, absoluteList, relativeList, pregnancyDraft, setPregnancyDraft,
    contraindicationAnswers, fallsAnswers, setFallsAnswers, currentAge, populationKind, setPopulationKind,
    populationDraft, setPopulationDraft, changePregnancy, updatePopulation, answers, extra, cmrAnswers, update,
  } = useEngineProfileDraft(props);
  const yesNo = (
    label: string,
    selected: boolean | undefined,
    change: (answer: boolean) => void,
  ) => (
    <label>
      {label}
      <select
        value={selected === undefined ? "" : String(selected)}
        onChange={(event) => {
          if (event.target.value !== "") change(event.target.value === "true");
        }}
      >
        <option value="">{zh ? "请选择" : "Choose"}</option>
        <option value="false">{zh ? "否" : "No"}</option>
        <option value="true">{zh ? "是" : "Yes"}</option>
      </select>
    </label>
  );
  return (
    <section>
      <p>{engineCopy("safety.copy.disclaimer", locale)}</p>
      <label>
        <input
          type="checkbox"
          checked={!!value.healthStorageConsent}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    ...value,
                    healthStorageConsent: {
                      acceptedAt: new Date().toISOString(),
                    },
                  }
                : {},
            )
          }
        />
        {engineCopy("safety.copy.local_health_consent", locale)}
      </label>
      {value.healthStorageConsent && (
        <>
          <label>
            {zh ? "出生年月" : "Year and month of birth"}
            <input
              type="month"
              value={value.birthYearMonth ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  birthYearMonth: event.target.value || undefined,
                })
              }
            />
          </label>
          <fieldset>
            <legend>PAR-Q+</legend>
            {Array.from({ length: 7 }, (_, index) =>
              engineCopy(`safety.copy.parq_${index + 1}`, locale),
            ).map((label, index) => (
              <div key={index}>
                {yesNo(label, answers[index], (answer) => {
                  const next = [...answers];
                  next[index] = answer;
                  update(next);
                })}
              </div>
            ))}
            {yesNo(
              zh
                ? "已知心血管、代谢或肾脏疾病"
                : "Known cardiovascular, metabolic or kidney disease",
              extra.knownCondition,
              (answer) => update(answers, { ...extra, knownCondition: answer }),
            )}
            <CmrSymptomsQuestions
              locale={locale}
              answers={cmrAnswers}
              onChange={(next) => update(answers, extra, next)}
            />
            {yesNo(
              zh
                ? "当前有感冒、发烧等急性不适"
                : "Current acute illness or fever",
              extra.acuteIllness,
              (answer) => update(answers, { ...extra, acuteIllness: answer }),
            )}
            <label>
              {zh
                ? "过去至少 3 个月，每周至少 3 天、每次至少 30 分钟中等强度运动"
                : "At least 3 days a week, 30 minutes of moderate exercise each time, for at least 3 months"}
              <select
                value={extra.activityStatus ?? ""}
                onChange={(event) => {
                  if (event.target.value)
                    update(answers, {
                      ...extra,
                      activityStatus: event.target.value as
                        | "active"
                        | "inactive",
                    });
                }}
              >
                <option value="">{zh ? "请选择" : "Choose"}</option>
                <option value="active">{zh ? "是" : "Yes"}</option>
                <option value="inactive">
                  {zh ? "否 / 不确定" : "No / unsure"}
                </option>
              </select>
            </label>
            <label>
              {zh ? "静息血压" : "Resting blood pressure"}
              <select
                value={extra.restingBp ?? ""}
                onChange={(event) => {
                  if (event.target.value)
                    update(answers, {
                      ...extra,
                      restingBp: event.target
                        .value as EngineProfile["screening"]["restingBp"],
                    });
                }}
              >
                <option value="">{zh ? "请选择" : "Choose"}</option>
                <option value="known_below_threshold">
                  {zh ? "已知低于 160/90 mmHg" : "Known below 160/90 mmHg"}
                </option>
                <option value="ge_160_90">≥160/90 mmHg</option>
                <option value="unknown">{zh ? "不知道" : "Unknown"}</option>
              </select>
            </label>
          </fieldset>
          <label>
            {zh ? "孕期 / 产后状态" : "Pregnancy / postpartum status"}
            <select
              value={
                populationKind === "older_adult" ? "general" : populationKind
              }
              onChange={(event) => {
                const kind = event.target.value;
                setPopulationKind(kind);
                setPopulationDraft({});
                setPregnancyDraft(createPregnancyReconfirmationDraft());
                setFallsAnswers(
                  Array.from({ length: fallKeys.length }, () => undefined),
                );
                onChange({
                  ...value,
                  population:
                    kind === "pregnant"
                      ? pregnancyPopulationFromDraft(
                          createPregnancyReconfirmationDraft(),
                        )
                      : kind === "general"
                        ? { kind: "general" }
                        : kind === "older_adult"
                          ? { kind: "older_adult" }
                          : undefined,
                });
              }}
            >
              <option value="">{zh ? "请选择" : "Choose"}</option>
              <option value="pregnant">{zh ? "我在孕期" : "Pregnant"}</option>
              <option value="postpartum">
                {zh ? "我在产后" : "Postpartum"}
              </option>
              <option value="general">
                {zh ? "非孕期或产后" : "Neither pregnant nor postpartum"}
              </option>
            </select>
          </label>
          {((populationKind === "older_adult" && (currentAge===undefined||currentAge>=olderAge)) ||
            (populationKind === "general" &&
              currentAge !== undefined &&
              currentAge >= olderAge)) && (
            <fieldset>
              <legend>{engineCopy("older.screen.copy.intro", locale)}</legend>
              {fallKeys.map((key, index) => (
                <div key={key}>
                  {yesNo(
                    engineCopy(`older.screen.copy.${key}`, locale),
                    fallsAnswers[index],
                    (answer) => {
                      const next = [...fallsAnswers];
                      next[index] = answer;
                      setFallsAnswers(next);
                      setPopulationKind("older_adult");
                      const prior =
                        value.population?.kind === "older_adult"
                          ? value.population
                          : { kind: "older_adult" as const };
                      onChange({
                        ...value,
                        population: {
                          ...prior,
                          fallsAnswers: next.every(
                            (value) => typeof value === "boolean",
                          )
                            ? (next as boolean[])
                            : undefined,
                          walkingAid: next[3],
                          balanceCautious: next.some((value) => value === true)
                            ? true
                            : next.every((value) => typeof value === "boolean")
                              ? false
                              : undefined,
                        },
                      });
                    },
                  )}
                </div>
              ))}
            </fieldset>
          )}
          {(populationKind === "pregnant" ||
            populationKind === "postpartum") && (
            <fieldset>
              <legend>
                {zh ? "孕产资料" : "Pregnancy / postpartum information"}
              </legend>
              <label>
                {populationKind === "pregnant"
                  ? zh
                    ? "孕周"
                    : "Gestation week"
                  : zh
                    ? "产后周数"
                    : "Weeks since birth"}
                <input
                  type="number"
                  min="0"
                  value={populationDraft.weeks ?? ""}
                  onChange={(event) =>
                    updatePopulation({
                      ...populationDraft,
                      weeks:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              {populationKind === "pregnant" &&
                yesNo(
                  engineCopy(
                    "pregnancy.gate.copy.prenatal_checkups_question",
                    locale,
                  ),
                  pregnancyDraft.prenatalCareConfirmed,
                  (answer) => changePregnancy({ type: "prenatal", answer }),
                )}
              {yesNo(
                populationKind === "pregnant"
                  ? engineCopy("pregnancy.gate.copy.provider_question", locale)
                  : zh
                    ? "产后复查时，医生或助产士是否已经确认你可以开始运动？"
                    : "At your postnatal check, did your doctor or midwife confirm you can start exercising?",
                populationKind === "pregnant" &&
                  populationDraft.provider !== undefined
                  ? !populationDraft.provider
                  : populationDraft.provider,
                (answer) =>
                  updatePopulation({
                    ...populationDraft,
                    provider: populationKind === "pregnant" ? !answer : answer,
                  }),
              )}
              {populationKind === "pregnant" ? (
                <>
                  {pregnancyDraft.prenatalCareConfirmed === false && (
                    <p>
                      {engineCopy("pregnancy.gate.copy.ask_provider", locale)}
                    </p>
                  )}
                  <p>{engineCopy("pregnancy.gate.copy.intro", locale)}</p>
                  {[...absoluteList, ...relativeList].map((row) => (
                    <div key={row.key}>
                      {yesNo(
                        row.text,
                        contraindicationAnswers[row.key],
                        (answer) =>
                          changePregnancy({
                            type: "contraindication",
                            key: row.key,
                            answer,
                          }),
                      )}
                    </div>
                  ))}
                  <p>{engineCopy("pregnancy.gate.copy.app_limit", locale)}</p>
                </>
              ) : (
                <label>
                  {zh ? "分娩方式" : "Delivery"}
                  <select
                    value={populationDraft.delivery ?? ""}
                    onChange={(event) => {
                      if (event.target.value)
                        updatePopulation({
                          ...populationDraft,
                          delivery: event.target.value as
                            | "vaginal"
                            | "assisted_or_tear"
                            | "cesarean",
                        });
                    }}
                  >
                    <option value="">{zh ? "请选择" : "Choose"}</option>
                    <option value="vaginal">{zh ? "顺产" : "Vaginal"}</option>
                    <option value="assisted_or_tear">
                      {zh
                        ? "器械助产 / 会阴损伤"
                        : "Assisted / perineal injury"}
                    </option>
                    <option value="cesarean">
                      {zh ? "剖宫产" : "Cesarean"}
                    </option>
                  </select>
                </label>
              )}
            </fieldset>
          )}
          {currentAge !== undefined &&
            currentAge >=
              new Rules().get("safety.age45.vigorous_advisory").age_min_years &&
            screen?.completedAt && (
              <label>
                <input
                  type="checkbox"
                  checked={
                    screen.age45AdvisoryAck?.screenedAt === screen.completedAt
                  }
                  onChange={(event) =>
                    onChange({
                      ...value,
                      screening: {
                        ...screen,
                        age45AdvisoryAck: event.target.checked
                          ? {
                              acknowledgedAt: new Date().toISOString(),
                              screenedAt: screen.completedAt!,
                            }
                          : undefined,
                      },
                    })
                  }
                />
                {engineCopy("safety.copy.age45_advisory", locale)}
              </label>
            )}
          {populationKind === "pregnant" && (
            <aside>
              <p>{engineCopy("pregnancy.environment.copy.heat", locale)}</p>
              <p>{engineCopy("pregnancy.environment.copy.altitude", locale)}</p>
            </aside>
          )}
          <label>
            {zh ? "水平" : "Level"}
            <select
              value={value.level ?? "beginner"}
              onChange={(event) =>
                onChange({
                  ...value,
                  level: event.target.value as "beginner" | "intermediate",
                })
              }
            >
              <option value="beginner">{zh ? "新手" : "Beginner"}</option>
              <option value="intermediate">
                {zh ? "中级" : "Intermediate"}
              </option>
            </select>
          </label>
          {(["noJump", "quiet"] as const).map((key, index) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={value.constraints?.[key] ?? false}
                onChange={(event) =>
                  onChange({
                    ...value,
                    constraints: {
                      noJump: false,
                      quiet: false,
                      space: "small",
                      ...value.constraints,
                      [key]: event.target.checked,
                    },
                  })
                }
              />
              {(zh ? ["不能跳", "保持安静"] : ["No jumping", "Quiet"])[index]}
            </label>
          ))}
          <label>
            {zh ? "空间" : "Space"}
            <select
              value={value.constraints?.space ?? "small"}
              onChange={(event) =>
                onChange({
                  ...value,
                  constraints: {
                    noJump: false,
                    quiet: false,
                    ...value.constraints,
                    space: event.target
                      .value as EngineProfile["constraints"]["space"],
                  },
                })
              }
            >
              {(["mat", "small", "medium", "large"] as const).map(
                (space, index) => (
                  <option key={space} value={space}>
                    {
                      (zh
                        ? ["一张垫子", "小", "中", "大"]
                        : ["Mat", "Small", "Medium", "Large"])[index]
                    }
                  </option>
                ),
              )}
            </select>
          </label>
        </>
      )}
    </section>
  );
}
