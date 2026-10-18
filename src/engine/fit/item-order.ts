import { type SessionDraft } from "../contracts";
import { type Item } from "./types";

export function insertBeforeCooldown(session: SessionDraft, item: Item) {
  const work = ["main", "accessory"].includes(item.prescription?.block ?? "");
  const index = session.items.findIndex(
    (i) =>
      i.prescription?.block === "cooldown" ||
      (work &&
        ["conditioning", "mobility"].includes(i.prescription?.block ?? "")),
  );
  session.items.splice(index < 0 ? session.items.length : index, 0, item);
}
