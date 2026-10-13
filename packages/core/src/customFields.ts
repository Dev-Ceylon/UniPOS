/** Custom fields (ADR-010): JSONB per entity, validated by a per-tenant schema. */
import { z } from "zod";

export const CustomFieldDefSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lowercase letters, digits and underscores"),
  label: z.string().min(1).max(60),
  type: z.enum(["text", "number", "boolean", "date", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
});
export type CustomFieldDef = z.infer<typeof CustomFieldDefSchema>;

export const CUSTOM_FIELD_ENTITIES = ["product", "customer"] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export function buildCustomFieldSchema(defs: readonly CustomFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const d of defs) {
    let s: z.ZodTypeAny;
    switch (d.type) {
      case "number":
        s = z.coerce.number();
        break;
      case "boolean":
        s = z.union([z.boolean(), z.enum(["true", "false", "on"]).transform((v) => v !== "false")]);
        break;
      case "date":
        s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
        break;
      case "select":
        s = z.enum((d.options && d.options.length ? d.options : [""]) as [string, ...string[]]);
        break;
      default:
        s = z.string().max(500);
    }
    if (!d.required) {
      s = z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());
    }
    shape[d.key] = s;
  }
  return z.object(shape).strip();
}

export function parseCustomFields(defs: readonly CustomFieldDef[], input: unknown) {
  return buildCustomFieldSchema(defs).parse(input ?? {});
}
