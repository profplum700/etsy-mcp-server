import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EtsyMcpApiClient } from "../etsy-api-client.js";
import { V1_TOOL_CONTRACT, type JsonSchema, type V1ToolContract } from "../tool-contract.js";

const REFERENCE_TOOL_NAMES = [
  "etsy_get_taxonomy_properties",
  "etsy_get_shipping_profiles",
] as const;

type ReferenceToolName = (typeof REFERENCE_TOOL_NAMES)[number];

type JsonObject = Record<string, unknown>;

function contractFor(name: ReferenceToolName): V1ToolContract {
  const tool = V1_TOOL_CONTRACT.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing V1 tool contract for ${name}`);
  }
  return tool;
}

export const tools = REFERENCE_TOOL_NAMES.map((name) => {
  const tool = contractFor(name);
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
});

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateArgs(toolName: ReferenceToolName, args: unknown): JsonObject {
  const schema = contractFor(toolName).inputSchema;
  if (!isObject(args)) {
    throw new McpError(ErrorCode.InvalidParams, `${toolName} arguments must be an object`);
  }

  const allowedKeys = new Set(Object.keys(schema.properties ?? {}));
  const extraKeys = Object.keys(args).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${toolName} received unsupported argument(s): ${extraKeys.join(", ")}`
    );
  }

  for (const key of schema.required ?? []) {
    if (!(key in args)) {
      throw new McpError(ErrorCode.InvalidParams, `${toolName} missing required argument: ${key}`);
    }
  }

  for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
    if (key in args) {
      validateProperty(toolName, key, args[key], propertySchema);
    }
  }

  return args;
}

function validateProperty(
  toolName: ReferenceToolName,
  key: string,
  value: unknown,
  schema: JsonSchema
): void {
  if (schema.type === "string") {
    if (typeof value !== "string" || value.trim() === "") {
      throw new McpError(
        ErrorCode.InvalidParams,
        `${toolName} argument ${key} must be a non-empty string`
      );
    }
    if ((key === "shop_id" || key === "taxonomy_id") && !/^\d+$/.test(value)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `${toolName} argument ${key} must be a decimal string`
      );
    }
    return;
  }

  throw new McpError(ErrorCode.InvalidParams, `${toolName} argument ${key} has unsupported type`);
}

function arrayPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isObject(value) && Array.isArray(value.results)) {
    return value.results;
  }
  return [];
}

function getString(source: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

function getNumber(source: JsonObject, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) {
      return Number(value);
    }
  }
  return null;
}

function getBoolean(source: JsonObject, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function thinPossibleValue(value: unknown): JsonObject | null {
  if (!isObject(value)) {
    return null;
  }

  return removeNullish({
    value_id: getNumber(value, ["value_id", "property_value_id", "id"]),
    name: getString(value, ["name", "display_name", "value"]),
    scale_id: getNumber(value, ["scale_id"]),
    equal_to: getNumber(value, ["equal_to"]),
  });
}

function thinTaxonomyProperty(value: unknown): JsonObject | null {
  if (!isObject(value)) {
    return null;
  }

  const possibleValues = arrayPayload(value.possible_values)
    .map(thinPossibleValue)
    .filter((item): item is JsonObject => item !== null)
    .slice(0, 50);
  const scales = arrayPayload(value.scales)
    .filter(isObject)
    .map((scale) =>
      removeNullish({
        scale_id: getNumber(scale, ["scale_id", "id"]),
        display_name: getString(scale, ["display_name", "name"]),
        description: getString(scale, ["description"]),
      })
    )
    .slice(0, 25);

  return removeNullish({
    property_id: getNumber(value, ["property_id", "id"]),
    name: getString(value, ["name"]),
    display_name: getString(value, ["display_name", "name"]),
    is_required: getBoolean(value, ["is_required", "required"]),
    supports_attributes: getBoolean(value, ["supports_attributes"]),
    supports_variations: getBoolean(value, ["supports_variations"]),
    supports_scale: getBoolean(value, ["supports_scale"]),
    possible_values: possibleValues.length ? possibleValues : null,
    scales: scales.length ? scales : null,
  });
}

function thinShippingProfile(value: unknown): JsonObject | null {
  if (!isObject(value)) {
    return null;
  }

  return removeNullish({
    shipping_profile_id: getNumber(value, ["shipping_profile_id", "id"]),
    title: getString(value, ["title", "name"]),
    origin_country_iso: getString(value, ["origin_country_iso", "origin_country"]),
    destination_country_iso: getString(value, ["destination_country_iso"]),
    primary_cost: getNumber(value, ["primary_cost", "primary_cost_amount"]),
    secondary_cost: getNumber(value, ["secondary_cost", "secondary_cost_amount"]),
    min_processing_days: getNumber(value, ["min_processing_days"]),
    max_processing_days: getNumber(value, ["max_processing_days"]),
    processing_days_display_label: getString(value, ["processing_days_display_label"]),
    profile_type: getString(value, ["profile_type"]),
    is_deleted: getBoolean(value, ["is_deleted"]),
  });
}

function removeNullish(input: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined)
  );
}

export const handlers: Record<
  ReferenceToolName,
  (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>
> = {
  etsy_get_taxonomy_properties: async (args, client) => {
    const parsed = validateArgs("etsy_get_taxonomy_properties", args);
    const response = await client.getPropertiesByTaxonomyId(parsed.taxonomy_id as string);
    return arrayPayload(response)
      .map(thinTaxonomyProperty)
      .filter((item): item is JsonObject => item !== null);
  },

  etsy_get_shipping_profiles: async (args, client) => {
    const parsed = validateArgs("etsy_get_shipping_profiles", args);
    const response = await client.getShopShippingProfiles(parsed.shop_id as string);
    return arrayPayload(response)
      .map(thinShippingProfile)
      .filter((item): item is JsonObject => item !== null);
  },
};
