import { db } from "@/db";
import { customFieldDefinitions, workflowDefinitions, ventureTypes } from "@/db/schema";
import { createFieldDefinition } from "@/server/services/custom-fields";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  CircleDot,
  Layers,
  Sliders,
  Plus,
  Shield,
  Workflow,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const params = await searchParams;
  const currentEntity = params.entity || "VENTURE";

  const allDefinitions = await db
    .select()
    .from(customFieldDefinitions)
    .orderBy(customFieldDefinitions.createdAt);

  const filteredDefs = allDefinitions.filter((d) => d.entityType === currentEntity);
  const allWorkflows = await db.select().from(workflowDefinitions);
  const allVentureTypes = await db.select().from(ventureTypes);

  async function handleCreateField(formData: FormData) {
    "use server";
    await requireRole(["ADMIN", "FINANCE_MGR"]);

    const entityType = formData.get("entityType") as string;
    const fieldKey = (formData.get("fieldKey") as string).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const fieldLabel = formData.get("fieldLabel") as string;
    const dataType = formData.get("dataType") as any;
    const isRequired = formData.get("isRequired") === "on";
    const defaultValue = formData.get("defaultValue") as string;
    const helpText = formData.get("helpText") as string;

    if (!entityType || !fieldKey || !fieldLabel || !dataType) {
      throw new Error("Entity, Key, Label, and Type are required.");
    }

    await createFieldDefinition({
      entityType,
      fieldKey,
      fieldLabel,
      dataType,
      isRequired,
      defaultValue: defaultValue || undefined,
      helpText: helpText || undefined,
    });

    revalidatePath("/studio");
  }

  const ENTITIES = [
    { code: "VENTURE", label: "Ventures & Projects" },
    { code: "PRODUCT", label: "Garment Products" },
    { code: "INVENTORY_LOT", label: "Inventory Lots & Batches" },
    { code: "PRODUCTION_ORDER", label: "Production Orders" },
    { code: "AGREEMENT", label: "Participation Agreements" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-afk-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-afk-olive/20 text-afk-olive-accent border border-afk-olive">
              ENTERPRISE CONFIGURATION
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Business Customisation Studio
          </h1>
          <p className="text-sm text-afk-muted">
            Configure dynamic fields, lifecycle workflows, and drop parameters without code modifications.
          </p>
        </div>

        <Link
          href="/ventures"
          className="px-4 py-2 text-xs font-semibold text-white bg-afk-surface border border-afk-border hover:border-afk-olive rounded-lg transition-colors flex items-center gap-2"
        >
          &larr; Back to Ventures
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-afk-border">
        {ENTITIES.map((ent) => {
          const isActive = currentEntity === ent.code;
          return (
            <Link
              key={ent.code}
              href={`/studio?entity=${ent.code}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-afk-olive-accent text-white font-semibold"
                  : "text-afk-muted hover:text-white bg-afk-surface/50 hover:bg-afk-surface"
              }`}
            >
              {ent.label}
            </Link>
          );
        })}
      </div>

      {/* Studio Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Defined Fields Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Custom Fields for {currentEntity}
              </h3>
              <span className="text-xs font-mono text-afk-muted">
                {filteredDefs.length} Fields Defined
              </span>
            </div>

            {filteredDefs.length === 0 ? (
              <div className="p-8 text-center text-xs text-afk-muted">
                No custom fields defined for {currentEntity} yet. Use the form on the right to add attributes like Fabric GSM, Factory Code, or Delivery Partner.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-afk-charcoal text-afk-muted font-mono uppercase text-[10px] border-b border-afk-border">
                    <tr>
                      <th className="py-2.5 px-3">Field Key</th>
                      <th className="py-2.5 px-3">Label</th>
                      <th className="py-2.5 px-3">Data Type</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-afk-border/50">
                    {filteredDefs.map((d) => (
                      <tr key={d.id} className="hover:bg-afk-surface-light/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-afk-olive-accent">
                          {d.fieldKey}
                        </td>
                        <td className="py-2.5 px-3 text-white font-medium">{d.fieldLabel}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-afk-border text-afk-muted">
                            {d.dataType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-afk-muted">
                          {d.isRequired ? "Yes" : "Optional"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-afk-muted">
                          {d.defaultValue || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Workflows Inspector */}
          <div className="p-4 bg-afk-surface border border-afk-border rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-4 h-4 text-afk-olive-accent" />
              Active System Workflows
            </h3>
            <div className="space-y-3">
              {allWorkflows.map((wf) => {
                const config = wf.stagesJson as any;
                const stages = config?.stages || [];

                return (
                  <div key={wf.id} className="p-3 bg-afk-charcoal rounded-lg border border-afk-border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{wf.name}</span>
                      <span className="text-[10px] font-mono text-afk-olive-accent px-1.5 py-0.5 rounded bg-afk-olive/20">
                        {wf.workflowType}
                      </span>
                    </div>
                    <p className="text-[11px] text-afk-muted">{wf.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stages.map((st: string) => (
                        <span key={st} className="px-2 py-0.5 rounded bg-afk-surface text-[10px] font-semibold text-white">
                          {st}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Add Custom Field Form */}
        <div className="p-5 bg-afk-surface border border-afk-border rounded-xl space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-2 border-b border-afk-border">
            <Plus className="w-4 h-4 text-afk-olive-accent" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Add Custom Attribute
            </h3>
          </div>

          <form action={handleCreateField} className="space-y-3.5 text-xs">
            <input type="hidden" name="entityType" value={currentEntity} />

            <div>
              <label className="block text-afk-muted uppercase font-semibold mb-1">
                Target Entity
              </label>
              <input
                type="text"
                disabled
                value={currentEntity}
                className="w-full px-3 py-2 bg-afk-charcoal border border-afk-border rounded text-afk-muted font-mono"
              />
            </div>

            <div>
              <label className="block text-afk-muted uppercase font-semibold mb-1">
                Field Key *
              </label>
              <input
                type="text"
                name="fieldKey"
                required
                placeholder="e.g. fabric_composition"
                className="w-full px-3 py-2 bg-afk-charcoal border border-afk-border rounded text-white font-mono lowercase focus:border-afk-olive-accent focus:outline-none"
              />
              <span className="text-[10px] text-afk-muted">Unique alphanumeric key for queries.</span>
            </div>

            <div>
              <label className="block text-afk-muted uppercase font-semibold mb-1">
                Field Label *
              </label>
              <input
                type="text"
                name="fieldLabel"
                required
                placeholder="e.g. Fabric Composition"
                className="w-full px-3 py-2 bg-afk-charcoal border border-afk-border rounded text-white focus:border-afk-olive-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-afk-muted uppercase font-semibold mb-1">
                Data Type *
              </label>
              <select
                name="dataType"
                required
                className="w-full px-3 py-2 bg-afk-charcoal border border-afk-border rounded text-white focus:border-afk-olive-accent focus:outline-none"
              >
                <option value="TEXT">Text String</option>
                <option value="NUMBER">Number (Integer)</option>
                <option value="DECIMAL">Decimal / Float</option>
                <option value="MONEY">Currency (৳ BDT)</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="DATE">Calendar Date</option>
                <option value="CHECKBOX">Checkbox (Boolean)</option>
                <option value="URL">Web / Spec Link</option>
              </select>
            </div>

            <div>
              <label className="block text-afk-muted uppercase font-semibold mb-1">
                Default Value
              </label>
              <input
                type="text"
                name="defaultValue"
                placeholder="Optional default..."
                className="w-full px-3 py-2 bg-afk-charcoal border border-afk-border rounded text-white focus:border-afk-olive-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-afk-muted uppercase font-semibold mb-1">
                Help / Tooltip Text
              </label>
              <input
                type="text"
                name="helpText"
                placeholder="Guidance for operators..."
                className="w-full px-3 py-2 bg-afk-charcoal border border-afk-border rounded text-white focus:border-afk-olive-accent focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isRequired"
                name="isRequired"
                className="rounded bg-afk-charcoal border-afk-border text-afk-olive-accent"
              />
              <label htmlFor="isRequired" className="text-afk-muted">
                Mandatory field for this entity
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-bold text-white bg-afk-olive-accent hover:bg-afk-olive rounded shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Field Definition
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
