// Mode matrix definition for the catch22 lab.
// Two families, one tag grammar, per mds/turbo-brilliance.md.

export const MODES = [
  "omni",
  "deeptree",
  "hyper",
  "socrates",
  "logic",
  "einstein",
  "spoon",
  "ultra",
  "high",
  "medium",
  "medium-low",
  "low",
];

export const FAMILIES = {
  reasoning: (mode) => `{REASON:${mode}}`,
  instruct: (mode) => `{REASON:i${mode}}`,
  // Baseline family: no tag travels in the prompt. Used for the
  // {REASON:off} idea on the tune and for the stock model control.
  off: () => "",
};

export function tagFor(family, mode) {
  const build = FAMILIES[family];
  if (!build) throw new Error(`unknown family: ${family}`);
  return build(mode);
}

export const DEFAULT_REASONING_FAMILY = "reasoning";
