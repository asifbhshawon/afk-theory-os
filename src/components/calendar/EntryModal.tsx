"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  FileText,
  CheckSquare,
  AlertCircle,
  Plus,
  Trash2,
  Paperclip,
  Layers,
  Users,
  Repeat,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { EvidenceUploader, StagedFile } from "@/components/evidence/EvidenceUploader";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Partner {
  id: string;
  name: string;
}

interface Venture {
  id: string;
  title: string;
  ventureNumber: string;
}

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryToEdit?: any | null;
  initialDate?: Date;
  categories: Category[];
  partners: Partner[];
  ventures: Venture[];
  currentUserId: string;
  onSaved: () => void;
}

export function EntryModal({
  isOpen,
  onClose,
  entryToEdit,
  initialDate,
  categories,
  partners,
  ventures,
  currentUserId,
  onSaved,
}: EntryModalProps) {
  const [entryType, setEntryType] = useState<"EVENT" | "NOTE" | "TASK" | "DEADLINE" | "REMINDER">("NOTE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [status, setStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">("PENDING");
  const [scope, setScope] = useState<"COMPANY" | "VENTURE" | "PERSONAL">("COMPANY");
  const [startDateStr, setStartDateStr] = useState("");
  const [startTimeStr, setStartTimeStr] = useState("10:00");
  const [endDateStr, setEndDateStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("11:00");
  const [isAllDay, setIsAllDay] = useState(true);
  const [location, setLocation] = useState("");
  const [ventureId, setVentureId] = useState("");
  const [assignedPartnerId, setAssignedPartnerId] = useState("");
  const [checklists, setChecklists] = useState<{ id?: string; title: string; isCompleted: boolean }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("WEEKLY");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (entryToEdit) {
      setTitle(entryToEdit.title || "");
      setDescription(entryToEdit.description || "");
      setEntryType(entryToEdit.entryType || "NOTE");
      setCategoryId(entryToEdit.categoryId || categories[0]?.id || "");
      setPriority(entryToEdit.priority || "MEDIUM");
      setStatus(entryToEdit.status || "PENDING");
      setScope(entryToEdit.scope || "COMPANY");
      setIsAllDay(entryToEdit.isAllDay ?? true);
      setLocation(entryToEdit.location || "");
      setVentureId(entryToEdit.ventureId || "");
      setAssignedPartnerId(entryToEdit.assignedPartnerId || "");
      setChecklists(entryToEdit.checklists || []);

      const s = new Date(entryToEdit.startDate);
      setStartDateStr(format(s, "yyyy-MM-dd"));
      setStartTimeStr(format(s, "HH:mm"));

      if (entryToEdit.endDate) {
        const e = new Date(entryToEdit.endDate);
        setEndDateStr(format(e, "yyyy-MM-dd"));
        setEndTimeStr(format(e, "HH:mm"));
      } else {
        setEndDateStr(format(s, "yyyy-MM-dd"));
        setEndTimeStr("11:00");
      }

      setIsRecurring(!!entryToEdit.recurrenceRule);
      if (entryToEdit.recurrenceRule) {
        setRecurrenceFreq(entryToEdit.recurrenceRule.frequency || "WEEKLY");
        setRecurrenceInterval(entryToEdit.recurrenceRule.interval || 1);
      }
    } else {
      // Default creation
      const targetDate = initialDate || new Date();
      setTitle("");
      setDescription("");
      setEntryType("NOTE");
      setCategoryId(categories[0]?.id || "");
      setPriority("MEDIUM");
      setStatus("PENDING");
      setScope("COMPANY");
      setIsAllDay(true);
      setLocation("");
      setVentureId("");
      setAssignedPartnerId("");
      setChecklists([]);
      setStartDateStr(format(targetDate, "yyyy-MM-dd"));
      setStartTimeStr("10:00");
      setEndDateStr(format(targetDate, "yyyy-MM-dd"));
      setEndTimeStr("11:00");
      setIsRecurring(false);
      setRecurrenceFreq("WEEKLY");
      setRecurrenceInterval(1);
      setStagedFiles([]);
    }
    setErrorMsg(null);
  }, [entryToEdit, initialDate, categories, isOpen]);

  if (!isOpen) return null;

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklists([...checklists, { title: newChecklistText.trim(), isCompleted: false }]);
    setNewChecklistText("");
  };

  const handleRemoveChecklistItem = (idx: number) => {
    setChecklists(checklists.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please provide an activity title or note subject.");
      return;
    }
    if (!startDateStr) {
      setErrorMsg("Please select a date.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Construct start and end timestamps
      const startIso = isAllDay
        ? new Date(`${startDateStr}T00:00:00+06:00`).toISOString()
        : new Date(`${startDateStr}T${startTimeStr}:00+06:00`).toISOString();

      let endIso: string | null = null;
      if (!isAllDay && endDateStr) {
        endIso = new Date(`${endDateStr}T${endTimeStr}:00+06:00`).toISOString();
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        entryType,
        categoryId: categoryId || null,
        priority,
        status,
        scope,
        startDate: startIso,
        endDate: endIso,
        isAllDay,
        location: location.trim() || null,
        ventureId: ventureId || null,
        assignedPartnerId: assignedPartnerId || null,
        checklists,
        recurrence: isRecurring
          ? {
              frequency: recurrenceFreq,
              interval: recurrenceInterval,
            }
          : undefined,
      };

      let entryId = entryToEdit?.id;

      if (entryToEdit) {
        const res = await fetch(`/api/calendar/entries/${entryToEdit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update entry");
        }
      } else {
        const res = await fetch("/api/calendar/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create entry");
        }
        entryId = data.entry.id;
      }

      // If staged files exist, upload and link them to the calendar entry
      if (stagedFiles.length > 0 && entryId) {
        for (const staged of stagedFiles) {
          const form = new FormData();
          form.append("file", staged.file);
          form.append("module", "GENERAL");
          form.append("category", "GENERAL_EVIDENCE");
          form.append("entityType", "CALENDAR_ENTRY");
          form.append("entityId", entryId);
          form.append("displayTitle", staged.displayTitle || title);

          await fetch("/api/documents/upload", {
            method: "POST",
            body: form,
          });
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entryToEdit) return;
    if (!confirm("Are you sure you want to remove this activity from the calendar?")) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/calendar/entries/${entryToEdit.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete entry");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto select-none">
      <div
        className="w-full max-w-2xl bg-afk-card border border-afk-border rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-afk-border flex items-center justify-between bg-afk-surface/60">
          <div>
            <h2 className="text-base font-bold text-afk-offwhite flex items-center gap-2">
              <Calendar className="w-5 h-5 text-afk-olive-accent" />
              <span>{entryToEdit ? "Edit Activity / Note" : "New Calendar Activity or Note"}</span>
            </h2>
            <p className="text-xs text-afk-muted mt-0.5">
              Plan drop milestones, supplier follow-ups, factory batches, or personal work notes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-elevated transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-afk-danger/10 border border-afk-danger/40 text-afk-danger text-xs">
              {errorMsg}
            </div>
          )}

          {/* Item Type Tabs */}
          <div className="flex items-center rounded-xl bg-afk-surface border border-afk-border p-1 gap-1">
            {[
              { type: "NOTE", label: "Note", icon: FileText },
              { type: "EVENT", label: "Event", icon: Calendar },
              { type: "TASK", label: "Task", icon: CheckSquare },
              { type: "DEADLINE", label: "Deadline", icon: AlertCircle },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = entryType === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setEntryType(t.type as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-afk-elevated text-afk-offwhite shadow-sm border border-afk-border"
                      : "text-afk-muted hover:text-afk-secondary"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-afk-secondary mb-1">
              Title / Subject *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow up with fabric supplier, Photoshoot call, Origin Drop Launch"
              className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-sm text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-afk-surface/40 rounded-xl border border-afk-border">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-afk-secondary">Date *</label>
                <label className="flex items-center gap-1.5 text-xs text-afk-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                  />
                  <span>All-Day</span>
                </label>
              </div>
              <input
                type="date"
                required
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
              />
            </div>

            {!isAllDay && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Category, Priority & Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-afk-secondary mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-afk-secondary mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-afk-secondary mb-1">
                Scope / Visibility
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
              >
                <option value="COMPANY">AFK Business (Shared)</option>
                <option value="VENTURE">Venture Drop</option>
                <option value="PERSONAL">Private (Only You)</option>
              </select>
            </div>
          </div>

          {/* Related Venture & Assigned Partner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-afk-secondary mb-1">
                Related Venture / Drop
              </label>
              <select
                value={ventureId}
                onChange={(e) => setVentureId(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
              >
                <option value="">None / Standalone</option>
                {ventures.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.ventureNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-afk-secondary mb-1">
                Assigned Partner
              </label>
              <select
                value={assignedPartnerId}
                onChange={(e) => setAssignedPartnerId(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
              >
                <option value="">Unassigned</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description & Note Body */}
          <div>
            <label className="block text-xs font-semibold text-afk-secondary mb-1">
              Description / Discussion Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Record details, supplier quotes, tech pack specs, meeting minutes..."
              className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2.5 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
            />
          </div>

          {/* Action Checklist (for Tasks / Events) */}
          {(entryType === "TASK" || entryType === "EVENT" || checklists.length > 0) && (
            <div className="p-3.5 bg-afk-surface/40 rounded-xl border border-afk-border space-y-2.5">
              <label className="block text-xs font-semibold text-afk-secondary">
                Action Checklist Items
              </label>

              {checklists.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={(e) => {
                        const updated = [...checklists];
                        updated[idx].isCompleted = e.target.checked;
                        setChecklists(updated);
                      }}
                      className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                    />
                    <span className={item.isCompleted ? "line-through text-afk-muted" : "text-afk-offwhite"}>
                      {item.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(idx)}
                    className="text-afk-muted hover:text-red-400 p-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Add a checklist item (press Enter)..."
                  className="flex-1 bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs text-afk-secondary hover:text-afk-offwhite transition"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Supporting Evidence Uploader (Universal Sharp WebP system) */}
          <div className="p-3.5 bg-afk-surface/40 rounded-xl border border-afk-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-afk-secondary flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-afk-olive-accent" />
                <span>Supporting Proof & Attachments</span>
              </label>
              <span className="text-[11px] text-afk-muted">Auto WebP + SHA-256</span>
            </div>
            <EvidenceUploader
              mode="form"
              stagedFiles={stagedFiles}
              onStagedFilesChange={setStagedFiles}
              compact
            />
          </div>

          {/* Actions Bar */}
          <div className="pt-4 border-t border-afk-border flex items-center justify-between">
            {entryToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-afk-secondary hover:text-afk-offwhite bg-afk-surface hover:bg-afk-elevated border border-afk-border rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-afk-offwhite bg-afk-olive hover:bg-afk-olive-light rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : entryToEdit ? "Save Changes" : "Save Activity"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
