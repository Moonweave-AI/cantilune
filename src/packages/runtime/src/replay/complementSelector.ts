/** Lean complementTag — selects DPO complement / preserved context slice. */
export interface ComplementSelector {
  readonly tag: number;
}

export const DEFAULT_COMPLEMENT_TAG = 0;

export function defaultComplementSelector(): ComplementSelector {
  return { tag: DEFAULT_COMPLEMENT_TAG };
}

export function complementTagFromSelector(selector: ComplementSelector): number {
  return selector.tag;
}
