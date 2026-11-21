export interface ToolPropertyLike {
  type: string;
  description?: string;
  items?: { type: string };
}

export interface ToolDefinitionLike {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolPropertyLike>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolValidationResult {
  valid: boolean;
  args: Record<string, unknown>;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isRecord(value);
  return false;
}

export function validateToolCall(definition: ToolDefinitionLike, rawArgs: unknown): ToolValidationResult {
  const errors: string[] = [];
  if (!isRecord(rawArgs)) return { valid: false, args: {}, errors: ["Arguments must be a JSON object."] };
  const args = rawArgs;
  const properties = definition.parameters.properties ?? {};
  const required = definition.parameters.required ?? [];

  for (const name of required) {
    if (!(name in args) || args[name] === undefined || args[name] === null || args[name] === "") {
      errors.push(`Missing required argument: ${name}.`);
    }
  }
  if (definition.parameters.additionalProperties === false) {
    for (const name of Object.keys(args)) {
      if (!(name in properties)) errors.push(`Unexpected argument: ${name}.`);
    }
  }
  for (const [name, value] of Object.entries(args)) {
    const property = properties[name];
    if (!property || value === null || value === undefined) continue;
    if (!matchesType(value, property.type)) {
      errors.push(`Argument ${name} must be of type ${property.type}.`);
      continue;
    }
    if (property.type === "array" && property.items?.type === "string" && !(value as unknown[]).every((item) => typeof item === "string")) {
      errors.push(`Argument ${name} must contain only strings.`);
    }
  }
  return { valid: errors.length === 0, args, errors };
}

export interface ToolVerificationResult {
  verified: boolean;
  summary: string;
}

export function verifyToolResult(result: unknown): ToolVerificationResult {
  if (!isRecord(result)) return { verified: false, summary: "The tool returned no structured result." };
  if (result.ok === false || typeof result.error === "string") {
    return { verified: false, summary: typeof result.error === "string" ? result.error.slice(0, 240) : "The tool reported an error." };
  }
  if (result.truncated === true) {
    return { verified: true, summary: "The tool returned a successful but bounded/truncated result." };
  }
  return { verified: true, summary: "The tool returned a structured result that passed the server verification guard." };
}
