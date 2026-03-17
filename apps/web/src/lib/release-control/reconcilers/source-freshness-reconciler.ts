import {
  reconcileSourceFreshness,
  type SourceFreshnessInput,
} from "../source-trust";

export function reconcileSourceFreshnessBatch(inputs: SourceFreshnessInput[]) {
  return inputs.map((input) => reconcileSourceFreshness(input));
}
