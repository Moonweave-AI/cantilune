import { err, ok, type Result } from "@cantilune/core";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import { hasRole, type AdministrationContext } from "./administrationContext.js";
import {
  admissionEvidenceSubjectDigest,
  type AdmissionEvidenceSubject,
} from "./evidenceSubject.js";
import type { SchemaExtensionPlan } from "../schema/monotoneExtensionValidator.js";
import { extensionPlanCanonicalDigest } from "../schema/extensionPlanDigest.js";

export interface QualificationEvidence {
  readonly subjectDigest: ReturnType<typeof admissionEvidenceSubjectDigest>;
  readonly extensionPlanDigest: ReturnType<typeof extensionPlanCanonicalDigest>;
  readonly qualifiedBy: string;
  readonly qualifiedAt: string;
  readonly evaluatorVersion: string;
}

export interface QualificationEvaluator {
  qualify(input: {
    readonly context: AdministrationContext;
    readonly subject: AdmissionEvidenceSubject;
    readonly extensionPlan: SchemaExtensionPlan;
  }): Result<QualificationEvidence, ControlPlaneViolation>;
}

export function createQualificationEvaluator(): QualificationEvaluator {
  return {
    qualify({ context, subject, extensionPlan }) {
      if (!hasRole(context, "schema-qualifier")) {
        return err(
          controlPlaneViolation("qualification_failed", "qualify", "missing schema-qualifier role"),
        );
      }
      const planDig = extensionPlanCanonicalDigest(extensionPlan);
      if (planDig !== subject.extensionPlanDigest) {
        return err(
          controlPlaneViolation(
            "qualification_failed",
            "qualify",
            "extension plan digest mismatch with admission subject",
          ),
        );
      }
      if (extensionPlan.fromSchemaRef.digest !== subject.fromSchemaRef.digest) {
        return err(
          controlPlaneViolation("qualification_failed", "qualify", "from schema ref mismatch"),
        );
      }
      if (extensionPlan.toSchemaRef.digest !== subject.toSchemaRef.digest) {
        return err(
          controlPlaneViolation("qualification_failed", "qualify", "to schema ref mismatch"),
        );
      }
      return ok({
        subjectDigest: admissionEvidenceSubjectDigest(subject),
        extensionPlanDigest: planDig,
        qualifiedBy: context.principal.actorRef.actorId as string,
        qualifiedAt: new Date().toISOString(),
        evaluatorVersion: "qualification/1.0",
      });
    },
  };
}
