/**
 * A2A 1.0.0 AgentCard and discovery objects.
 * Official spec: https://a2a-protocol.org/latest/specification/ §4.4 / §8.
 */
import { type Result, err, ok } from "@cantilune/core";
import { type PeerEndpoint } from "../../../peer/peerDescriptor.js";
import { A2A_PROTOCOL_VERSION_V1 } from "../../../foundation/commsLimits.js";
import {
  a2aProtocolError,
  isJsonObject,
  type A2AMetadata,
  type A2AProtocolError,
} from "./a2aMessage.js";

export const A2A_AGENT_CARD_WELL_KNOWN_PATH = "/.well-known/agent-card.json" as const;
export const A2A_JSON_CONTENT_TYPE = "application/a2a+json" as const;

export type A2AProtocolBinding = "JSONRPC" | "GRPC" | "HTTP+JSON";

export const A2A_PROTOCOL_BINDINGS: readonly A2AProtocolBinding[] = [
  "JSONRPC",
  "GRPC",
  "HTTP+JSON",
];

export interface A2AAgentProvider {
  readonly url: string;
  readonly organization: string;
}

export interface A2AAgentExtension {
  readonly uri?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly params?: A2AMetadata;
}

export interface A2AAgentCapabilities {
  readonly streaming?: boolean;
  readonly pushNotifications?: boolean;
  readonly extensions?: readonly A2AAgentExtension[];
  readonly extendedAgentCard?: boolean;
}

export interface A2AAgentSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly examples?: readonly string[];
  readonly inputModes?: readonly string[];
  readonly outputModes?: readonly string[];
  readonly securityRequirements?: readonly A2ASecurityRequirement[];
}

export interface A2AAgentInterface {
  readonly url: string;
  readonly protocolBinding: string;
  readonly protocolVersion: string;
  readonly tenant?: string;
}

export interface A2AAgentCardSignature {
  readonly protected: string;
  readonly signature: string;
  readonly header?: A2AMetadata;
}

export interface A2ASecurityRequirement {
  readonly schemes: Readonly<Record<string, { readonly list: readonly string[] }>>;
}

export interface A2AApiKeySecurityScheme {
  readonly location: "query" | "header" | "cookie";
  readonly name: string;
  readonly description?: string;
}

export interface A2AHttpAuthSecurityScheme {
  readonly scheme: string;
  readonly description?: string;
  readonly bearerFormat?: string;
}

export interface A2AOpenIdConnectSecurityScheme {
  readonly openIdConnectUrl: string;
  readonly description?: string;
}

export interface A2AMutualTlsSecurityScheme {
  readonly description?: string;
}

export interface A2AOAuth2SecurityScheme {
  readonly flows: A2AOAuthFlows;
  readonly description?: string;
  readonly oauth2MetadataUrl?: string;
}

export interface A2AOAuthFlows {
  readonly authorizationCode?: {
    readonly authorizationUrl: string;
    readonly tokenUrl: string;
    readonly scopes: Readonly<Record<string, string>>;
    readonly refreshUrl?: string;
    readonly pkceRequired?: boolean;
  };
  readonly clientCredentials?: {
    readonly tokenUrl: string;
    readonly scopes: Readonly<Record<string, string>>;
    readonly refreshUrl?: string;
  };
  readonly implicit?: {
    readonly authorizationUrl: string;
    readonly scopes: Readonly<Record<string, string>>;
    readonly refreshUrl?: string;
  };
  readonly password?: {
    readonly tokenUrl: string;
    readonly scopes: Readonly<Record<string, string>>;
    readonly refreshUrl?: string;
  };
  readonly deviceCode?: {
    readonly deviceAuthorizationUrl: string;
    readonly tokenUrl: string;
    readonly scopes: Readonly<Record<string, string>>;
    readonly refreshUrl?: string;
  };
}

export type A2ASecurityScheme =
  | { readonly apiKeySecurityScheme: A2AApiKeySecurityScheme }
  | { readonly httpAuthSecurityScheme: A2AHttpAuthSecurityScheme }
  | { readonly oauth2SecurityScheme: A2AOAuth2SecurityScheme }
  | { readonly openIdConnectSecurityScheme: A2AOpenIdConnectSecurityScheme }
  | { readonly mtlsSecurityScheme: A2AMutualTlsSecurityScheme };

export interface A2AAgentCard {
  readonly name: string;
  readonly description: string;
  readonly supportedInterfaces: readonly A2AAgentInterface[];
  readonly version: string;
  readonly capabilities: A2AAgentCapabilities;
  readonly defaultInputModes: readonly string[];
  readonly defaultOutputModes: readonly string[];
  readonly skills: readonly A2AAgentSkill[];
  readonly provider?: A2AAgentProvider;
  readonly documentationUrl?: string;
  readonly securitySchemes?: Readonly<Record<string, A2ASecurityScheme>>;
  readonly securityRequirements?: readonly A2ASecurityRequirement[];
  readonly signatures?: readonly A2AAgentCardSignature[];
  readonly iconUrl?: string;
}

export function isA2AProtocolBinding(value: unknown): value is A2AProtocolBinding {
  return value === "JSONRPC" || value === "GRPC" || value === "HTTP+JSON";
}

export function agentInterfaceFromPeerEndpoint(
  endpoint: PeerEndpoint,
  protocolBinding: A2AProtocolBinding,
  protocolVersion: string = A2A_PROTOCOL_VERSION_V1,
): A2AAgentInterface {
  return {
    url: endpoint.uri,
    protocolBinding,
    protocolVersion,
  };
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<string, A2AProtocolError> {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    return err(a2aProtocolError("InvalidParamsError", `${path} is required`, { path }));
  }
  return ok(value);
}

function requiredStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<readonly string[], A2AProtocolError> {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string")) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path} must be a non-empty string array`, { path }),
    );
  }
  return ok(value as readonly string[]);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<string | undefined, A2AProtocolError> {
  if (!(key in record) || record[key] === undefined) {
    return ok(undefined);
  }
  if (typeof record[key] !== "string") {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be a string`, { path }));
  }
  return ok(record[key]);
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<readonly string[] | undefined, A2AProtocolError> {
  if (!(key in record) || record[key] === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(record[key]) || record[key].some((item) => typeof item !== "string")) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path} must be an array of strings`, { path }),
    );
  }
  return ok(record[key] as readonly string[]);
}

function parseSecurityRequirement(
  value: unknown,
  path: string,
): Result<A2ASecurityRequirement, A2AProtocolError> {
  if (!isJsonObject(value) || !isJsonObject(value.schemes)) {
    return err(a2aProtocolError("InvalidParamsError", `${path}.schemes is required`, { path }));
  }
  const schemes: Record<string, { readonly list: readonly string[] }> = {};
  for (const [name, entry] of Object.entries(value.schemes)) {
    if (!isJsonObject(entry) || !Array.isArray(entry.list) || entry.list.some((item) => typeof item !== "string")) {
      return err(
        a2aProtocolError("InvalidParamsError", `${path}.schemes.${name}.list must be strings`, {
          path: `${path}.schemes.${name}`,
        }),
      );
    }
    schemes[name] = { list: entry.list as readonly string[] };
  }
  return ok({ schemes });
}

function parseOAuthScopes(
  value: unknown,
  path: string,
): Result<Readonly<Record<string, string>>, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const scopes: Record<string, string> = {};
  for (const [key, description] of Object.entries(value)) {
    if (typeof description !== "string") {
      return err(
        a2aProtocolError("InvalidParamsError", `${path}.${key} must be a string`, {
          path: `${path}.${key}`,
        }),
      );
    }
    scopes[key] = description;
  }
  return ok(scopes);
}

function parseOAuthFlows(
  value: unknown,
  path: string,
): Result<A2AOAuthFlows, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const keys = [
    "authorizationCode",
    "clientCredentials",
    "implicit",
    "password",
    "deviceCode",
  ] as const;
  const present = keys.filter((key) => key in value);
  const selected = present[0];
  if (present.length !== 1 || selected === undefined) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path} must contain exactly one OAuth flow`, {
        path,
      }),
    );
  }
  const flow = value[selected];
  if (!isJsonObject(flow)) {
    return err(a2aProtocolError("InvalidParamsError", `${path}.${selected} must be an object`, { path }));
  }
  const scopes = parseOAuthScopes(flow.scopes, `${path}.${selected}.scopes`);
  if (!scopes.ok) {
    return scopes;
  }
  const refreshUrl = optionalString(flow, "refreshUrl", `${path}.${selected}.refreshUrl`);
  if (!refreshUrl.ok) {
    return refreshUrl;
  }
  return parseSelectedOAuthFlow(selected, flow, path, scopes.value, refreshUrl.value);
}

function parseSelectedOAuthFlow(
  selected: "authorizationCode" | "clientCredentials" | "implicit" | "password" | "deviceCode",
  flow: Record<string, unknown>,
  path: string,
  scopes: Readonly<Record<string, string>>,
  refreshUrl: string | undefined,
): Result<A2AOAuthFlows, A2AProtocolError> {
  const extra = refreshUrl !== undefined ? { refreshUrl } : {};
  const parsers = {
    authorizationCode: parseAuthorizationCodeFlow,
    clientCredentials: parseClientCredentialsFlow,
    implicit: parseImplicitFlow,
    password: parsePasswordFlow,
    deviceCode: parseDeviceCodeFlow,
  } as const;
  return parsers[selected](flow, path, scopes, extra);
}

function parseAuthorizationCodeFlow(
  flow: Record<string, unknown>,
  path: string,
  scopes: Readonly<Record<string, string>>,
  extra: { readonly refreshUrl?: string },
): Result<A2AOAuthFlows, A2AProtocolError> {
  const authorizationUrl = requiredString(flow, "authorizationUrl", `${path}.authorizationCode.authorizationUrl`);
  if (!authorizationUrl.ok) {
    return authorizationUrl;
  }
  const tokenUrl = requiredString(flow, "tokenUrl", `${path}.authorizationCode.tokenUrl`);
  if (!tokenUrl.ok) {
    return tokenUrl;
  }
  return ok({
    authorizationCode: {
      authorizationUrl: authorizationUrl.value,
      tokenUrl: tokenUrl.value,
      scopes,
      ...extra,
      ...(typeof flow.pkceRequired === "boolean" ? { pkceRequired: flow.pkceRequired } : {}),
    },
  });
}

function parseClientCredentialsFlow(
  flow: Record<string, unknown>,
  path: string,
  scopes: Readonly<Record<string, string>>,
  extra: { readonly refreshUrl?: string },
): Result<A2AOAuthFlows, A2AProtocolError> {
  const tokenUrl = requiredString(flow, "tokenUrl", `${path}.clientCredentials.tokenUrl`);
  if (!tokenUrl.ok) {
    return tokenUrl;
  }
  return ok({ clientCredentials: { tokenUrl: tokenUrl.value, scopes, ...extra } });
}

function parseImplicitFlow(
  flow: Record<string, unknown>,
  path: string,
  scopes: Readonly<Record<string, string>>,
  extra: { readonly refreshUrl?: string },
): Result<A2AOAuthFlows, A2AProtocolError> {
  const authorizationUrl = requiredString(flow, "authorizationUrl", `${path}.implicit.authorizationUrl`);
  if (!authorizationUrl.ok) {
    return authorizationUrl;
  }
  return ok({ implicit: { authorizationUrl: authorizationUrl.value, scopes, ...extra } });
}

function parsePasswordFlow(
  flow: Record<string, unknown>,
  path: string,
  scopes: Readonly<Record<string, string>>,
  extra: { readonly refreshUrl?: string },
): Result<A2AOAuthFlows, A2AProtocolError> {
  const tokenUrl = requiredString(flow, "tokenUrl", `${path}.password.tokenUrl`);
  if (!tokenUrl.ok) {
    return tokenUrl;
  }
  return ok({ password: { tokenUrl: tokenUrl.value, scopes, ...extra } });
}

function parseDeviceCodeFlow(
  flow: Record<string, unknown>,
  path: string,
  scopes: Readonly<Record<string, string>>,
  extra: { readonly refreshUrl?: string },
): Result<A2AOAuthFlows, A2AProtocolError> {
  const deviceAuthorizationUrl = requiredString(
    flow,
    "deviceAuthorizationUrl",
    `${path}.deviceCode.deviceAuthorizationUrl`,
  );
  if (!deviceAuthorizationUrl.ok) {
    return deviceAuthorizationUrl;
  }
  const tokenUrl = requiredString(flow, "tokenUrl", `${path}.deviceCode.tokenUrl`);
  if (!tokenUrl.ok) {
    return tokenUrl;
  }
  return ok({
    deviceCode: {
      deviceAuthorizationUrl: deviceAuthorizationUrl.value,
      tokenUrl: tokenUrl.value,
      scopes,
      ...extra,
    },
  });
}

export function parseA2ASecurityScheme(
  value: unknown,
  path = "securityScheme",
): Result<A2ASecurityScheme, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const keys = [
    "apiKeySecurityScheme",
    "httpAuthSecurityScheme",
    "oauth2SecurityScheme",
    "openIdConnectSecurityScheme",
    "mtlsSecurityScheme",
  ] as const;
  const present = keys.filter((key) => key in value);
  const selected = present[0];
  if (present.length !== 1 || selected === undefined) {
    return err(
      a2aProtocolError(
        "InvalidParamsError",
        `${path} must contain exactly one security scheme variant`,
        { path },
      ),
    );
  }
  const body = value[selected];
  if (!isJsonObject(body)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.${selected} must be an object`, { path }),
    );
  }
  const description = optionalString(body, "description", `${path}.${selected}.description`);
  if (!description.ok) {
    return description;
  }
  return parseSelectedSecurityScheme(selected, body, path, description.value);
}

function parseSelectedSecurityScheme(
  selected:
    | "apiKeySecurityScheme"
    | "httpAuthSecurityScheme"
    | "oauth2SecurityScheme"
    | "openIdConnectSecurityScheme"
    | "mtlsSecurityScheme",
  body: Record<string, unknown>,
  path: string,
  description: string | undefined,
): Result<A2ASecurityScheme, A2AProtocolError> {
  const described = description !== undefined ? { description } : {};
  if (selected === "apiKeySecurityScheme") {
    return parseApiKeyScheme(body, path, described);
  }
  if (selected === "httpAuthSecurityScheme") {
    return parseHttpAuthScheme(body, path, described);
  }
  if (selected === "oauth2SecurityScheme") {
    return parseOAuth2Scheme(body, path, described);
  }
  if (selected === "openIdConnectSecurityScheme") {
    const openIdConnectUrl = requiredString(
      body,
      "openIdConnectUrl",
      `${path}.openIdConnectSecurityScheme.openIdConnectUrl`,
    );
    if (!openIdConnectUrl.ok) {
      return openIdConnectUrl;
    }
    return ok({
      openIdConnectSecurityScheme: { openIdConnectUrl: openIdConnectUrl.value, ...described },
    });
  }
  return ok({ mtlsSecurityScheme: { ...described } });
}

function parseApiKeyScheme(
  body: Record<string, unknown>,
  path: string,
  described: { readonly description?: string },
): Result<A2ASecurityScheme, A2AProtocolError> {
  const location = body.location;
  if (location !== "query" && location !== "header" && location !== "cookie") {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.apiKeySecurityScheme.location is invalid`, {
        path: `${path}.apiKeySecurityScheme.location`,
      }),
    );
  }
  const name = requiredString(body, "name", `${path}.apiKeySecurityScheme.name`);
  if (!name.ok) {
    return name;
  }
  return ok({ apiKeySecurityScheme: { location, name: name.value, ...described } });
}

function parseHttpAuthScheme(
  body: Record<string, unknown>,
  path: string,
  described: { readonly description?: string },
): Result<A2ASecurityScheme, A2AProtocolError> {
  const scheme = requiredString(body, "scheme", `${path}.httpAuthSecurityScheme.scheme`);
  if (!scheme.ok) {
    return scheme;
  }
  const bearerFormat = optionalString(body, "bearerFormat", `${path}.httpAuthSecurityScheme.bearerFormat`);
  if (!bearerFormat.ok) {
    return bearerFormat;
  }
  return ok({
    httpAuthSecurityScheme: {
      scheme: scheme.value,
      ...described,
      ...(bearerFormat.value !== undefined ? { bearerFormat: bearerFormat.value } : {}),
    },
  });
}

function parseOAuth2Scheme(
  body: Record<string, unknown>,
  path: string,
  described: { readonly description?: string },
): Result<A2ASecurityScheme, A2AProtocolError> {
  const flows = parseOAuthFlows(body.flows, `${path}.oauth2SecurityScheme.flows`);
  if (!flows.ok) {
    return flows;
  }
  const oauth2MetadataUrl = optionalString(
    body,
    "oauth2MetadataUrl",
    `${path}.oauth2SecurityScheme.oauth2MetadataUrl`,
  );
  if (!oauth2MetadataUrl.ok) {
    return oauth2MetadataUrl;
  }
  return ok({
    oauth2SecurityScheme: {
      flows: flows.value,
      ...described,
      ...(oauth2MetadataUrl.value !== undefined ? { oauth2MetadataUrl: oauth2MetadataUrl.value } : {}),
    },
  });
}

function parseExtension(
  value: unknown,
  path: string,
): Result<A2AAgentExtension, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const uri = optionalString(value, "uri", `${path}.uri`);
  if (!uri.ok) {
    return uri;
  }
  const description = optionalString(value, "description", `${path}.description`);
  if (!description.ok) {
    return description;
  }
  if (value.required !== undefined && typeof value.required !== "boolean") {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.required must be a boolean`, {
        path: `${path}.required`,
      }),
    );
  }
  if (value.params !== undefined && !isJsonObject(value.params)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.params must be an object`, {
        path: `${path}.params`,
      }),
    );
  }
  return ok({
    ...(uri.value !== undefined ? { uri: uri.value } : {}),
    ...(description.value !== undefined ? { description: description.value } : {}),
    ...(typeof value.required === "boolean" ? { required: value.required } : {}),
    ...(isJsonObject(value.params) ? { params: value.params } : {}),
  });
}

function parseRequirementList(
  value: unknown,
  path: string,
): Result<readonly A2ASecurityRequirement[] | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an array`, { path }));
  }
  const parsed: A2ASecurityRequirement[] = [];
  for (const [index, requirement] of value.entries()) {
    const item = parseSecurityRequirement(requirement, `${path}[${index}]`);
    if (!item.ok) {
      return item;
    }
    parsed.push(item.value);
  }
  return ok(parsed);
}

function parseInterfaceList(
  value: unknown,
): Result<readonly A2AAgentInterface[], A2AProtocolError> {
  if (!Array.isArray(value) || value.length === 0) {
    return err(
      a2aProtocolError("InvalidParamsError", "supportedInterfaces must be a non-empty array", {
        path: "supportedInterfaces",
      }),
    );
  }
  const parsed: A2AAgentInterface[] = [];
  for (const [index, item] of value.entries()) {
    const next = parseInterface(item, `supportedInterfaces[${index}]`);
    if (!next.ok) {
      return next;
    }
    parsed.push(next.value);
  }
  return ok(parsed);
}

function parseSkillList(value: unknown): Result<readonly A2AAgentSkill[], A2AProtocolError> {
  if (!Array.isArray(value)) {
    return err(a2aProtocolError("InvalidParamsError", "skills must be an array", { path: "skills" }));
  }
  const parsed: A2AAgentSkill[] = [];
  for (const [index, skill] of value.entries()) {
    const next = parseSkill(skill, `skills[${index}]`);
    if (!next.ok) {
      return next;
    }
    parsed.push(next.value);
  }
  return ok(parsed);
}

function parseProvider(
  value: unknown,
): Result<A2AAgentProvider | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", "provider must be an object", { path: "provider" }));
  }
  const url = requiredString(value, "url", "provider.url");
  if (!url.ok) {
    return url;
  }
  const organization = requiredString(value, "organization", "provider.organization");
  if (!organization.ok) {
    return organization;
  }
  return ok({ url: url.value, organization: organization.value });
}

function parseSecuritySchemeMap(
  value: unknown,
): Result<Readonly<Record<string, A2ASecurityScheme>> | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!isJsonObject(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", "securitySchemes must be an object", {
        path: "securitySchemes",
      }),
    );
  }
  const schemes: Record<string, A2ASecurityScheme> = {};
  for (const [key, scheme] of Object.entries(value)) {
    const parsed = parseA2ASecurityScheme(scheme, `securitySchemes.${key}`);
    if (!parsed.ok) {
      return parsed;
    }
    schemes[key] = parsed.value;
  }
  return ok(schemes);
}

function parseSignatureList(
  value: unknown,
): Result<readonly A2AAgentCardSignature[] | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(value)) {
    return err(a2aProtocolError("InvalidParamsError", "signatures must be an array", { path: "signatures" }));
  }
  const parsed: A2AAgentCardSignature[] = [];
  for (const [index, signature] of value.entries()) {
    const item = parseSignature(signature, `signatures[${index}]`);
    if (!item.ok) {
      return item;
    }
    parsed.push(item.value);
  }
  return ok(parsed);
}

function parseSignature(
  value: unknown,
  path: string,
): Result<A2AAgentCardSignature, A2AProtocolError> {
  if (!isJsonObject(value) || typeof value.protected !== "string" || typeof value.signature !== "string") {
    return err(a2aProtocolError("InvalidParamsError", `${path} is invalid`, { path }));
  }
  if (value.header !== undefined && !isJsonObject(value.header)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.header must be an object`, {
        path: `${path}.header`,
      }),
    );
  }
  return ok({
    protected: value.protected,
    signature: value.signature,
    ...(isJsonObject(value.header) ? { header: value.header } : {}),
  });
}

function parseSkill(value: unknown, path: string): Result<A2AAgentSkill, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const id = requiredString(value, "id", `${path}.id`);
  if (!id.ok) {
    return id;
  }
  const name = requiredString(value, "name", `${path}.name`);
  if (!name.ok) {
    return name;
  }
  const description = requiredString(value, "description", `${path}.description`);
  if (!description.ok) {
    return description;
  }
  const tags = requiredStringArray(value, "tags", `${path}.tags`);
  if (!tags.ok) {
    return tags;
  }
  const examples = optionalStringArray(value, "examples", `${path}.examples`);
  if (!examples.ok) {
    return examples;
  }
  const inputModes = optionalStringArray(value, "inputModes", `${path}.inputModes`);
  if (!inputModes.ok) {
    return inputModes;
  }
  const outputModes = optionalStringArray(value, "outputModes", `${path}.outputModes`);
  if (!outputModes.ok) {
    return outputModes;
  }
  const securityRequirements = parseRequirementList(
    value.securityRequirements,
    `${path}.securityRequirements`,
  );
  if (!securityRequirements.ok) {
    return securityRequirements;
  }
  return ok({
    id: id.value,
    name: name.value,
    description: description.value,
    tags: tags.value,
    ...(examples.value !== undefined ? { examples: examples.value } : {}),
    ...(inputModes.value !== undefined ? { inputModes: inputModes.value } : {}),
    ...(outputModes.value !== undefined ? { outputModes: outputModes.value } : {}),
    ...(securityRequirements.value !== undefined
      ? { securityRequirements: securityRequirements.value }
      : {}),
  });
}

function parseInterface(
  value: unknown,
  path: string,
): Result<A2AAgentInterface, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const url = requiredString(value, "url", `${path}.url`);
  if (!url.ok) {
    return url;
  }
  const protocolBinding = requiredString(value, "protocolBinding", `${path}.protocolBinding`);
  if (!protocolBinding.ok) {
    return protocolBinding;
  }
  const protocolVersion = requiredString(value, "protocolVersion", `${path}.protocolVersion`);
  if (!protocolVersion.ok) {
    return protocolVersion;
  }
  const tenant = optionalString(value, "tenant", `${path}.tenant`);
  if (!tenant.ok) {
    return tenant;
  }
  return ok({
    url: url.value,
    protocolBinding: protocolBinding.value,
    protocolVersion: protocolVersion.value,
    ...(tenant.value !== undefined ? { tenant: tenant.value } : {}),
  });
}

function parseCapabilities(
  value: unknown,
  path: string,
): Result<A2AAgentCapabilities, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", `${path} must be an object`, { path }));
  }
  const flags = parseCapabilityFlags(value, path);
  if (!flags.ok) {
    return flags;
  }
  const extensions = parseCapabilityExtensions(value.extensions, path);
  if (!extensions.ok) {
    return extensions;
  }
  return ok({
    ...flags.value,
    ...(extensions.value !== undefined ? { extensions: extensions.value } : {}),
  });
}

function parseCapabilityFlags(
  value: Record<string, unknown>,
  path: string,
): Result<
  Pick<A2AAgentCapabilities, "streaming" | "pushNotifications" | "extendedAgentCard">,
  A2AProtocolError
> {
  for (const flag of ["streaming", "pushNotifications", "extendedAgentCard"] as const) {
    if (value[flag] !== undefined && typeof value[flag] !== "boolean") {
      return err(
        a2aProtocolError("InvalidParamsError", `${path}.${flag} must be a boolean`, {
          path: `${path}.${flag}`,
        }),
      );
    }
  }
  return ok({
    ...(typeof value.streaming === "boolean" ? { streaming: value.streaming } : {}),
    ...(typeof value.pushNotifications === "boolean"
      ? { pushNotifications: value.pushNotifications }
      : {}),
    ...(typeof value.extendedAgentCard === "boolean"
      ? { extendedAgentCard: value.extendedAgentCard }
      : {}),
  });
}

function parseCapabilityExtensions(
  value: unknown,
  path: string,
): Result<readonly A2AAgentExtension[] | undefined, A2AProtocolError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!Array.isArray(value)) {
    return err(
      a2aProtocolError("InvalidParamsError", `${path}.extensions must be an array`, {
        path: `${path}.extensions`,
      }),
    );
  }
  const parsed: A2AAgentExtension[] = [];
  for (const [index, extension] of value.entries()) {
    const item = parseExtension(extension, `${path}.extensions[${index}]`);
    if (!item.ok) {
      return item;
    }
    parsed.push(item.value);
  }
  return ok(parsed);
}

export function parseA2AAgentCard(value: unknown): Result<A2AAgentCard, A2AProtocolError> {
  if (!isJsonObject(value)) {
    return err(a2aProtocolError("InvalidParamsError", "AgentCard must be an object", { path: "card" }));
  }
  const required = parseRequiredCardFields(value);
  if (!required.ok) {
    return required;
  }
  const optional = parseOptionalCardFields(value);
  if (!optional.ok) {
    return optional;
  }
  return ok({ ...required.value, ...optional.value });
}

function parseRequiredCardFields(
  value: Record<string, unknown>,
): Result<
  Pick<
    A2AAgentCard,
    | "name"
    | "description"
    | "version"
    | "supportedInterfaces"
    | "capabilities"
    | "defaultInputModes"
    | "defaultOutputModes"
    | "skills"
  >,
  A2AProtocolError
> {
  const name = requiredString(value, "name", "name");
  if (!name.ok) {
    return name;
  }
  const description = requiredString(value, "description", "description");
  if (!description.ok) {
    return description;
  }
  const version = requiredString(value, "version", "version");
  if (!version.ok) {
    return version;
  }
  const supportedInterfaces = parseInterfaceList(value.supportedInterfaces);
  if (!supportedInterfaces.ok) {
    return supportedInterfaces;
  }
  const capabilities = parseCapabilities(value.capabilities, "capabilities");
  if (!capabilities.ok) {
    return capabilities;
  }
  const defaultInputModes = requiredStringArray(value, "defaultInputModes", "defaultInputModes");
  if (!defaultInputModes.ok) {
    return defaultInputModes;
  }
  const defaultOutputModes = requiredStringArray(value, "defaultOutputModes", "defaultOutputModes");
  if (!defaultOutputModes.ok) {
    return defaultOutputModes;
  }
  const skills = parseSkillList(value.skills);
  if (!skills.ok) {
    return skills;
  }
  return ok({
    name: name.value,
    description: description.value,
    version: version.value,
    supportedInterfaces: supportedInterfaces.value,
    capabilities: capabilities.value,
    defaultInputModes: defaultInputModes.value,
    defaultOutputModes: defaultOutputModes.value,
    skills: skills.value,
  });
}

function parseOptionalCardFields(
  value: Record<string, unknown>,
): Result<
  Pick<
    A2AAgentCard,
    "provider" | "documentationUrl" | "iconUrl" | "securitySchemes" | "securityRequirements" | "signatures"
  >,
  A2AProtocolError
> {
  const provider = parseProvider(value.provider);
  if (!provider.ok) {
    return provider;
  }
  const documentationUrl = optionalString(value, "documentationUrl", "documentationUrl");
  if (!documentationUrl.ok) {
    return documentationUrl;
  }
  const iconUrl = optionalString(value, "iconUrl", "iconUrl");
  if (!iconUrl.ok) {
    return iconUrl;
  }
  const securitySchemes = parseSecuritySchemeMap(value.securitySchemes);
  if (!securitySchemes.ok) {
    return securitySchemes;
  }
  const securityRequirements = parseRequirementList(value.securityRequirements, "securityRequirements");
  if (!securityRequirements.ok) {
    return securityRequirements;
  }
  const signatures = parseSignatureList(value.signatures);
  if (!signatures.ok) {
    return signatures;
  }
  return ok({
    ...(provider.value !== undefined ? { provider: provider.value } : {}),
    ...(documentationUrl.value !== undefined ? { documentationUrl: documentationUrl.value } : {}),
    ...(iconUrl.value !== undefined ? { iconUrl: iconUrl.value } : {}),
    ...(securitySchemes.value !== undefined ? { securitySchemes: securitySchemes.value } : {}),
    ...(securityRequirements.value !== undefined
      ? { securityRequirements: securityRequirements.value }
      : {}),
    ...(signatures.value !== undefined ? { signatures: signatures.value } : {}),
  });
}
