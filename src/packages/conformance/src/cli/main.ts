#!/usr/bin/env node
import { cliExitCode } from "./exitCodes.js";
import { inspectCommand, inspectUsage } from "./inspectCommand.js";
import { verifyRuleCommand, verifyRuleUsage } from "./verifyRuleCommand.js";
import { verifyPackageCommand, verifyPackageUsage } from "./verifyPackageCommand.js";
import {
  verifyLeanAttestationCommand,
  verifyLeanAttestationUsage,
} from "./verifyLeanAttestationCommand.js";
import { listMissingCommand, listMissingUsage } from "./listMissingCommand.js";
import { explainCommand, explainUsage } from "./explainCommand.js";
import type { CliResult } from "./exitCodes.js";

const USAGE = `conformance-cli <command> [options]

Commands:
  inspect                 ${inspectUsage()}
  verify-rule             ${verifyRuleUsage()}
  verify-package          ${verifyPackageUsage()}
  verify-lean-attestation ${verifyLeanAttestationUsage()}
  list-missing            ${listMissingUsage()}
  explain                 ${explainUsage()}

Global options:
  --store-dir <path>      Persist evidence, trust roots, and audit events to disk

Exit codes:
  0 ok
  1 violations
  2 usage
  3 tool failure
`;

async function dispatch(command: string, args: readonly string[]): Promise<CliResult> {
  switch (command) {
    case "inspect":
      return inspectCommand(args);
    case "verify-rule":
      return verifyRuleCommand(args);
    case "verify-package":
      return verifyPackageCommand(args);
    case "verify-lean-attestation":
      return verifyLeanAttestationCommand(args);
    case "list-missing":
      return listMissingCommand(args);
    case "explain":
      return explainCommand(args);
    case "help":
    case "--help":
    case "-h":
      return { kind: "ok", output: USAGE };
    default:
      return { kind: "usage", message: `unknown command: ${command}\n\n${USAGE}` };
  }
}

function emit(result: CliResult): void {
  if ((result.kind === "ok" || result.kind === "violations") && result.output !== undefined) {
    process.stdout.write(`${result.output}\n`);
  }
  if (result.kind === "usage") {
    process.stderr.write(`${result.message}\n`);
  }
  if (result.kind === "tool_failure") {
    process.stderr.write(`${result.message}\n`);
  }
  if (result.kind === "violations") {
    for (const violation of result.violations) {
      process.stderr.write(`${violation.code}: ${violation.message}\n`);
    }
  }
}

const argv = process.argv.slice(2);
const command = argv[0] ?? "";
const result = await dispatch(command, argv.slice(1));
emit(result);
process.exit(cliExitCode(result));
