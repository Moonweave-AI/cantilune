import { contentRef } from "@cantilune/core";

/** SHA-256 of an empty blob, used when observability tests need a valid content-addressed input. */
export const testArtifactContentRef = contentRef(
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
);
