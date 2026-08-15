import { describe, expect, it } from "vitest";
import {
  buildOrchestrationSchema,
  createDefaultSchema,
  defaultCreateSessionTemplate,
  defaultDelegateTemplate,
  defaultForkBranchTemplate,
  defaultIntroduceTemplate,
  defaultPublishArtifactTemplate,
  defaultTemplates,
  defaultTransferSessionTemplate,
} from "../../../src/schema/defaultSchema.js";

describe("defaultSchema", () => {
  it("creates default schema with all templates", () => {
    const schema = createDefaultSchema();
    expect(schema.templates.length).toBeGreaterThanOrEqual(6);
    expect(schema.operationTypes.size).toBeGreaterThanOrEqual(6);
  });

  it("builds custom schema with override templates", () => {
    const custom = buildOrchestrationSchema("custom-v2", [defaultIntroduceTemplate()]);
    expect(custom.schemaId).toBe("custom-v2");
    expect(custom.templates).toHaveLength(1);
  });

  it("exposes individual default templates", () => {
    expect(defaultIntroduceTemplate().operationTypeId).toBe("introduce_artifact");
    expect(defaultDelegateTemplate().operationTypeId).toBe("delegate");
    expect(defaultCreateSessionTemplate().operationTypeId).toBe("create_session");
    expect(defaultForkBranchTemplate().operationTypeId).toBe("fork_branch");
    expect(defaultPublishArtifactTemplate().operationTypeId).toBe("publish_artifact");
    expect(defaultTransferSessionTemplate().operationTypeId).toBe("transfer_session");
    expect(defaultTemplates().length).toBeGreaterThanOrEqual(6);
  });
});
