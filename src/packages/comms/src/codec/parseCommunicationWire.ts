/** @deprecated Use strictWireCodec — re-export for transitional imports. */
export {
  parseCommunicationWireFrame,
  encodeCommunicationWireFrame,
  digestCommunicationFrame,
  computeEnvelopeIntegrityDigest,
  verifyEnvelopeIntegrityDigest,
} from "./strictWireCodec.js";
