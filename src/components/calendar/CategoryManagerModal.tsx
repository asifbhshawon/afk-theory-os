"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Tag,
  Palette,
  Archive,
  Check,
  Edit2,
  Trash2,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon?: string | null;
  description?: string | null;
  isShared: boolean;
  isArchived: boolean;
  sortOrder: number;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onCategoriesUpdated: () => void;
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#F97316", // Orange
  "#E11D48", // Rose
  "#6366F1", // Indigo
  "#7D9472", // AFK Olive
  "#6B7280", // Gray
  "#E59E27", // Gold
];

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  onCategoriesUpdated,
}: CategoryManagerModalProps) {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingCatId(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setDescription("");
    setIsShared(true);
  };

  const handleStartEdit = (cat: Category) => {
    setIsCreatingNew(false);
    setEditingCatId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setDescription(cat.description || "");
    setIsShared(cat.isShared);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isCreatingNew) {
        const res = await fetch("/api/calendar/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            color,
            description: description.trim() || null,
            isShared,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to create category");
        }
      } else if (editingCatId) {
        const res = await fetch("/api/calendar/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCatId,
            name: name.trim(),
            color,
            description: description.trim() || null,
            isShared,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to update category");
        }
      }

      onCategoriesUpdated();
      setIsCreatingNew(false);
      setEditingCatId(null);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (catId: string) => {
    if (!confirm("Archive this category? Historical activities will be preserved with their category label intact.")) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/calendar/categories?id=${catId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to archive category");
      }
      onCategoriesUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to archive category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div
        className="w-full max-w-xl bg-afk-card border border-afk-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-afk-border flex items-center justify-between bg-afk-surface/60">
          <div>
            <h2 className="text-base font-bold text-afk-offwhite flex items-center gap-2">
              <Tag className="w-5 h-5 text-afk-olive-accent" />
              <span>Category Customisation</span>
            </h2>
            <p className="text-xs text-afk-muted mt-0.5">
              Manage color accents, category tags, and visibility for all business activities
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-elevated transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-afk-danger/10 border border-afk-danger/40 text-afk-danger text-xs">
              {errorMsg}
            </div>
          )}

          {/* Form when creating or editing */}
          {(isCreatingNew || editingCatId) && (
            <form onSubmit={handleSave} className="p-4 bg-afk-surface/60 rounded-xl border border-afk-border space-y-3 mb-4">
              <h4 className="text-xs font-bold text-afk-offwhite">
                {isCreatingNew ? "Create New Category" : "Edit Category"}
              </h4>

              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fabric Dyeing, Courier Remittance, Drop Review"
                  className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Color Accent
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition flex items-center justify-center ${
                        color === c ? "ring-2 ring-white ring-offset-2 ring-offset-afk-card" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief context or use case..."
                  className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingCatId(null);
                  }}
                  className="px-3 py-1 text-xs text-afk-secondary hover:text-afk-offwhite bg-afk-surface rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1 text-xs font-semibold text-afk-offwhite bg-afk-olive hover:bg-afk-olive-light rounded shadow-sm transition"
                >
                  {isSubmitting ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          )}

          {/* List of categories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-afk-muted">
                Configured Categories ({categories.length})
              </span>
              {!isCreatingNew && !editingCatId && (
                <button
                  onClick={handleStartCreate}
                  className="flex items-center gap-1 text-xs font-semibold text-afk-olive-accent hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              )}
            </div>

            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-xl bg-afk-surface border border-afk-border hover:bg-afk-elevated transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-afk-offwhite truncate">
                      {cat.name}
                    </p>
                    {cat.description && (
                      <p className="text-[11px] text-afk-muted truncate">
                        {cat.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleStartEdit(cat)}
                    className="p-1.5 text-afk-muted hover:text-afk-offwhite rounded hover:bg-afk-surface transition"
                    title="Edit category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchive(cat.id)}
                    className="p-1.5 text-afk-muted hover:text-red-400 rounded hover:bg-afk-surface transition"
                    title="Archive category"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-afk-border bg-afk-surface/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-afk-secondary hover:text-afk-offwhite bg-afk-surface hover:bg-afk-elevated border border-afk-border rounded-lg transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
