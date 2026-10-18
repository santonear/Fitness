import keywords from "../../data/training-engine/body-change-keywords.json";

export type BodyChange = "pregnancy" | "postpartum" | "health";

/** Local-only conservative referral. Never modifies the profile or request. */
export function detectBodyChange(
  message: string,
  currentPopulation?: string,
): BodyChange | undefined {
  if (
    keywords.exclude.some((pattern) => new RegExp(pattern, "iu").test(message))
  )
    return undefined;
  // Delivery takes precedence when a message mentions both pregnancy and birth.
  for (const kind of ["postpartum", "pregnancy", "health"] as const) {
    if (
      kind === currentPopulation ||
      (kind === "pregnancy" && currentPopulation === "pregnant")
    )
      continue;
    if (
      keywords[kind].some((pattern) => new RegExp(pattern, "iu").test(message))
    )
      return kind;
  }
  return undefined;
}
