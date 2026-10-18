import {
  type PlannedItem,
  type SessionTemplate,
} from "../../domain/v8/contracts";
import { type EnginePrescription } from "../contracts";

export type Item = PlannedItem & { prescription?: EnginePrescription };

export type Template = Omit<SessionTemplate, "items"> & {
  items: Item[];
  estimatedSeconds?: number;
};
