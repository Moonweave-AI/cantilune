import { err, ok, type Result } from "@cantilune/core";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import { actorIdsEqual, hasRole, type AdministrationContext } from "./administrationContext.js";
import {
  admissionEvidenceSubjectDigest,
  type AdmissionEvidenceSubject,
} from "./evidenceSubject.js";
import type { QualificationEvidence } from "./qualificationEvaluator.js";

export interface AuthorizationEvidence {
  readonly subjectDigest: ReturnType<typeof admissionEvidenceSubjectDigest>;
  readonly qualificationDigest: string;
  readonly authorizedBy: string;
  readonly authorizedAt: string;
  readonly expiresAt: string;
  readonly authorizerVersion: string;
}

export interface AdministrationAuthorizer {
  authorize(input: {
    readonly context: AdministrationContext;
    readonly subject: AdmissionEvidenceSubject;
    readonly qualification: QualificationEvidence;
    readonly proposer: string;
  }): Result<AuthorizationEvidence, ControlPlaneViolation>;
  verify(input: {
    readonly subject: AdmissionEvidenceSubject;
    readonly qualification: QualificationEvidence;
    readonly authorization: AuthorizationEvidence;
    readonly operator: string;
    readonly now?: number;
  }): Result<void, ControlPlaneViolation>;
}

const AUTHORIZATION_TTL_MS = 15 * 60_000;

export function createAdministrationAuthorizer(): AdministrationAuthorizer {
  return {
    authorize({ context, subject, qualification, proposer }) {
      if (!hasRole(context, "schema-authorizer")) {
        return err(
          controlPlaneViolation(
            "authorization_denied",
            "authorize",
            "missing schema-authorizer role",
          ),
        );
      }
      if (actorIdsEqual(context.principal.actorRef, proposer)) {
        return err(
          controlPlaneViolation(
            "separation_of_duties_violation",
            "authorize",
            "proposer cannot self-authorize",
          ),
        );
      }
      const subjectDigest = admissionEvidenceSubjectDigest(subject);
      if (qualification.subjectDigest !== subjectDigest) {
        return err(
          controlPlaneViolation(
            "authorization_denied",
            "authorize",
            "qualification subject digest mismatch",
          ),
        );
      }
      const now = Date.now();
      return ok({
        subjectDigest,
        qualificationDigest: JSON.stringify(qualification),
        authorizedBy: context.principal.actorRef.actorId as string,
        authorizedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + AUTHORIZATION_TTL_MS).toISOString(),
        authorizerVersion: "authorizer/1.0",
      });
    },
    verify({ subject, qualification, authorization, operator, now = Date.now() }) {
      if (Date.parse(authorization.expiresAt) < now) {
        return err(
          controlPlaneViolation("authorization_denied", "commit", "authorization expired"),
        );
      }
      if (!actorIdsEqual(authorization.authorizedBy, operator)) {
        return err(
          controlPlaneViolation(
            "authorization_denied",
            "commit",
            "commit operator must match authorized actor",
          ),
        );
      }
      const subjectDigest = admissionEvidenceSubjectDigest(subject);
      if (authorization.subjectDigest !== subjectDigest) {
        return err(
          controlPlaneViolation("authorization_denied", "commit", "authorization subject mismatch"),
        );
      }
      if (qualification.subjectDigest !== subjectDigest) {
        return err(
          controlPlaneViolation("authorization_denied", "commit", "qualification subject mismatch"),
        );
      }
      return ok(undefined);
    },
  };
}
