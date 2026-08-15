/** Closed rule inventory for comms product conformance (M2 scaffold). */
export const COMMS_RULE_INVENTORY = [
  { ruleId: "comms.messaging.send", ruleKind: "native", theoryRef: "Pi/P1cOperationRegistry" },
  { ruleId: "comms.session.open", ruleKind: "native", theoryRef: "Pi/P1cOperationRegistry" },
  { ruleId: "comms.admission.reconnect", ruleKind: "admission", theoryRef: "Admission.lean" },
] as const;

export type CommsRuleId = (typeof COMMS_RULE_INVENTORY)[number]["ruleId"];
