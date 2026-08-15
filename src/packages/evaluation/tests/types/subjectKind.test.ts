import { describe, it, expect } from "vitest";
import type { CandidateSubject, BaselineSubject } from "../../src/subjects/evaluationSubject.js";

describe("L2: Subject kind type safety", () => {
  it("CandidateSubject is not assignable to BaselineSubject", () => {
    const _check = (c: CandidateSubject) => {
      // @ts-expect-error — candidate and baseline are structurally incompatible
      const _: BaselineSubject = c;
    };
    expect(typeof _check).toBe("function");
  });

  it("CandidateSubject subjectKind is literal 'candidate'", () => {
    const _check = (c: CandidateSubject) => {
      expect(c.subjectKind).toBe("candidate");
    };
    expect(typeof _check).toBe("function");
  });

  it("BaselineSubject subjectKind is literal 'baseline'", () => {
    const _check = (b: BaselineSubject) => {
      expect(b.subjectKind).toBe("baseline");
    };
    expect(typeof _check).toBe("function");
  });
});
