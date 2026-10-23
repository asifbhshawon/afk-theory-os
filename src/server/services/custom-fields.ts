import { db } from "@/db";
import {
  customFieldDefinitions,
  customFieldValues,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export interface CustomFieldDefinitionInput {
  entityType: string;
  fieldKey: string;
  fieldLabel: string;
  dataType: "TEXT" | "NUMBER" | "DECIMAL" | "MONEY" | "PERCENTAGE" | "DATE" | "SELECT" | "CHECKBOX" | "URL";
  options?: string[];
  isRequired?: boolean;
  defaultValue?: string;
  helpText?: string;
}

// Create or update a custom field definition
export async function createFieldDefinition(input: CustomFieldDefinitionInput) {
  const [definition] = await db
    .insert(customFieldDefinitions)
    .values({
      entityType: input.entityType,
      fieldKey: input.fieldKey,
      fieldLabel: input.fieldLabel,
      dataType: input.dataType,
      options: input.options || null,
      isRequired: input.isRequired || false,
      defaultValue: input.defaultValue || null,
      helpText: input.helpText || null,
      isActive: true,
    })
    .returning();

  return definition;
}

// Get all active custom field definitions for an entity type
export async function getFieldDefinitions(entityType?: string) {
  const query = db
    .select()
    .from(customFieldDefinitions)
    .where(entityType ? eq(customFieldDefinitions.entityType, entityType) : undefined)
    .orderBy(asc(customFieldDefinitions.createdAt));

  return await query;
}

// Save field values for a specific entity
export async function saveEntityCustomFieldValues(
  entityId: string,
  values: Record<string, any> // map of fieldKey -> value
) {
  return await db.transaction(async (tx) => {
    // 1. Get all definitions for the keys passed
    const definitions = await tx.select().from(customFieldDefinitions);
    const defMap = new Map(definitions.map((d) => [d.fieldKey, d]));

    for (const [key, val] of Object.entries(values)) {
      const def = defMap.get(key);
      if (!def) continue;

      // Delete existing value for this entity & definition
      await tx
        .delete(customFieldValues)
        .where(
          and(
            eq(customFieldValues.entityId, entityId),
            eq(customFieldValues.definitionId, def.id)
          )
        );

      if (val === undefined || val === null || val === "") continue;

      const insertData: any = {
        definitionId: def.id,
        entityId,
      };

      if (
        def.dataType === "NUMBER" ||
        def.dataType === "DECIMAL" ||
        def.dataType === "MONEY" ||
        def.dataType === "PERCENTAGE"
      ) {
        insertData.valueNumeric = String(val);
      } else if (def.dataType === "DATE") {
        insertData.valueDate = val instanceof Date ? val : new Date(val);
      } else {
        insertData.valueText = String(val);
      }

      await tx.insert(customFieldValues).values(insertData);
    }

    return true;
  });
}

// Retrieve values for an entity as a typed key-value dictionary
export async function getEntityCustomFieldValues(entityId: string): Promise<Record<string, any>> {
  const rows = await db
    .select({
      def: customFieldDefinitions,
      val: customFieldValues,
    })
    .from(customFieldValues)
    .innerJoin(customFieldDefinitions, eq(customFieldValues.definitionId, customFieldDefinitions.id))
    .where(eq(customFieldValues.entityId, entityId));

  const result: Record<string, any> = {};

  for (const { def, val } of rows) {
    if (
      def.dataType === "NUMBER" ||
      def.dataType === "DECIMAL" ||
      def.dataType === "MONEY" ||
      def.dataType === "PERCENTAGE"
    ) {
      result[def.fieldKey] = val.valueNumeric ? parseFloat(val.valueNumeric) : null;
    } else if (def.dataType === "DATE") {
      result[def.fieldKey] = val.valueDate;
    } else {
      result[def.fieldKey] = val.valueText;
    }
  }

  return result;
}
