"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Heading1,
  Heading2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Eye,
  Edit3,
  MapPin,
  Tag,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Minus,
} from "lucide-react";
import { format, differenceInDays, isPast, isToday } from "date-fns";
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
  const [entryType, setEntryType] = useState<"NOTE" | "EVENT" | "TASK" | "DEADLINE">("NOTE");
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

  // Note editor tab: 'edit' or 'preview'
  const [noteTab, setNoteTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (entryToEdit) {
      setTitle(entryToEdit.title || "");
      setDescription(entryToEdit.description || "");
      setEntryType((entryToEdit.entryType as any) || "NOTE");
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
      setNoteTab("edit");
    }
    setErrorMsg(null);
  }, [entryToEdit, initialDate, categories, isOpen]);

  if (!isOpen) return null;

  // Insert markdown formatting into textarea
  const insertFormatting = (prefix: string, suffix = "", defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = description;
    const selectedText = currentVal.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    setDescription(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  // Add subtask item
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklists([...checklists, { title: newChecklistText.trim(), isCompleted: false }]);
    setNewChecklistText("");
  };

  // Remove subtask item
  const handleRemoveChecklistItem = (idx: number) => {
    setChecklists(checklists.filter((_, i) => i !== idx));
  };

  // Toggle subtask item completion
  const handleToggleChecklist = (idx: number) => {
    const updated = [...checklists];
    updated[idx].isCompleted = !updated[idx].isCompleted;
    setChecklists(updated);
  };

  // Deadline urgency calculator
  const getDeadlineInfo = () => {
    if (!startDateStr) return null;
    try {
      const target = new Date(`${startDateStr}T${endTimeStr || "23:59"}:00`);
      const now = new Date();
      const daysDiff = differenceInDays(target, now);
      if (isPast(target) && !isToday(target)) {
        return {
          label: `🚨 OVERDUE by ${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? "day" : "days"}! Immediate action required.`,
          badge: "OVERDUE",
          color: "bg-red-500/15 text-red-400 border-red-500/40",
        };
      }
      if (isToday(target)) {
        return {
          label: "⚡ CRITICAL: DUE TODAY! Cutoff approaching.",
          badge: "DUE TODAY",
          color: "bg-amber-500/15 text-amber-400 border-amber-500/40",
        };
      }
      if (daysDiff === 1) {
        return {
          label: "⏱️ Approaching: Due tomorrow.",
          badge: "DUE TOMORROW",
          color: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        };
      }
      return {
        label: `📅 Target deadline due in ${daysDiff} days (${format(target, "MMMM d, yyyy")}).`,
        badge: `${daysDiff} DAYS LEFT`,
        color: "bg-afk-olive/15 text-afk-olive-accent border-afk-olive/40",
      };
    } catch {
      return null;
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please provide a title or subject.");
      return;
    }
    if (!startDateStr) {
      setErrorMsg("Please select a date.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const allDayActive = entryType === "NOTE" ? true : isAllDay;
      const startIso = allDayActive
        ? new Date(`${startDateStr}T00:00:00+06:00`).toISOString()
        : new Date(`${startDateStr}T${startTimeStr}:00+06:00`).toISOString();

      let endIso: string | null = null;
      if (!allDayActive && endDateStr) {
        endIso = new Date(`${endDateStr}T${endTimeStr}:00+06:00`).toISOString();
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        entryType,
        categoryId: categoryId || null,
        priority: entryType === "DEADLINE" && priority === "LOW" ? "HIGH" : priority,
        status,
        scope,
        startDate: startIso,
        endDate: endIso,
        isAllDay: allDayActive,
        location: entryType === "EVENT" ? location.trim() || null : null,
        ventureId: ventureId || null,
        assignedPartnerId: assignedPartnerId || null,
        checklists: entryType === "TASK" || checklists.length > 0 ? checklists : [],
        recurrence:
          entryType === "EVENT" && isRecurring
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
    if (!confirm("Are you sure you want to remove this item from the calendar?")) return;

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

  // Helper for rendering note markdown preview
  const renderMarkdownPreview = (text: string) => {
    if (!text || !text.trim()) {
      return (
        <p className="text-afk-muted italic text-xs py-8 text-center">
          Note body is empty. Switch to &quot;Write&quot; tab to type notes using formatting tools.
        </p>
      );
    }
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2.5" />;
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-lg font-bold text-afk-offwhite border-b border-afk-border pb-1 mt-3 mb-1">
            {trimmed.slice(2)}
          </h1>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-base font-semibold text-afk-offwhite mt-2.5 mb-1">
            {trimmed.slice(3)}
          </h2>
        );
      }
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-sm font-semibold text-afk-offwhite mt-2 mb-0.5">
            {trimmed.slice(4)}
          </h3>
        );
      }
      if (trimmed.startsWith("> ")) {
        return (
          <blockquote key={idx} className="border-l-2 border-afk-olive pl-3 py-1 my-1.5 text-xs italic text-afk-secondary bg-afk-surface/40 rounded-r">
            {trimmed.slice(2)}
          </blockquote>
        );
      }
      if (trimmed.startsWith("- [x] ") || trimmed.startsWith("- [X] ")) {
        return (
          <div key={idx} className="flex items-center gap-2 text-xs py-0.5 text-afk-muted line-through">
            <CheckSquare className="w-3.5 h-3.5 text-afk-olive shrink-0" />
            <span>{trimmed.slice(6)}</span>
          </div>
        );
      }
      if (trimmed.startsWith("- [ ] ")) {
        return (
          <div key={idx} className="flex items-center gap-2 text-xs py-0.5 text-afk-offwhite">
            <div className="w-3.5 h-3.5 rounded border border-afk-border bg-afk-surface shrink-0" />
            <span>{trimmed.slice(6)}</span>
          </div>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <li key={idx} className="ml-5 list-disc text-xs text-afk-offwhite py-0.5">
            {trimmed.slice(2)}
          </li>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-5 list-decimal text-xs text-afk-offwhite py-0.5">
            {numMatch[2]}
          </li>
        );
      }
      if (trimmed === "---") {
        return <hr key={idx} className="border-afk-border my-2.5" />;
      }
      return (
        <p key={idx} className="text-xs text-afk-offwhite leading-relaxed">
          {line}
        </p>
      );
    });
  };

  const completedChecklistCount = checklists.filter((c) => c.isCompleted).length;
  const checklistPercent =
    checklists.length > 0 ? Math.round((completedChecklistCount / checklists.length) * 100) : 0;
  const deadlineInfo = entryType === "DEADLINE" ? getDeadlineInfo() : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div
        className="w-full max-w-3xl bg-afk-card border border-afk-border rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-afk-border flex items-center justify-between bg-afk-surface/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-afk-elevated border border-afk-border text-afk-olive-accent">
              {entryType === "NOTE" && <FileText className="w-4 h-4" />}
              {entryType === "EVENT" && <Calendar className="w-4 h-4" />}
              {entryType === "TASK" && <CheckSquare className="w-4 h-4" />}
              {entryType === "DEADLINE" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-afk-offwhite flex items-center gap-2">
                <span>{entryToEdit ? "Edit Calendar Item" : "Create New Calendar Item"}</span>
              </h2>
              <p className="text-xs text-afk-muted">
                {entryType === "NOTE" && "Lightweight rich-text notes with H1, H2, bullets & checklists"}
                {entryType === "EVENT" && "Schedule meetings, photo sessions, launches & factory visits"}
                {entryType === "TASK" && "Execution tasks with interactive checkout checklists"}
                {entryType === "DEADLINE" && "Urgent milestone tracking with countdown alerts"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-elevated transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-afk-danger/10 border border-afk-danger/40 text-afk-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Type Switcher Tabs */}
          <div className="grid grid-cols-4 rounded-xl bg-afk-surface border border-afk-border p-1 gap-1 shrink-0">
            {[
              { type: "NOTE", label: "Note", icon: FileText, desc: "Quick rich notes" },
              { type: "EVENT", label: "Event", icon: Calendar, desc: "Timed schedule" },
              { type: "TASK", label: "Task", icon: CheckSquare, desc: "Checkout checklist" },
              { type: "DEADLINE", label: "Deadline", icon: AlertCircle, desc: "Urgent milestone" },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = entryType === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setEntryType(t.type as any)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-afk-elevated text-afk-offwhite shadow-sm border border-afk-border text-afk-olive-accent"
                      : "text-afk-muted hover:text-afk-secondary hover:bg-afk-surface/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? "text-afk-olive-accent" : "text-afk-muted"}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* 1. NOTE TAB — EASY, CLEAN, RICH TEXT NOTE EDITOR                          */}
          {/* ========================================================================= */}
          {entryType === "NOTE" && (
            <div className="space-y-3.5 animate-in fade-in duration-100">
              {/* Note Title */}
              <div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title (e.g. Fabric pricing breakdown, Tech pack notes, Factory feedback)..."
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-4 py-2.5 text-base font-semibold text-afk-offwhite placeholder:text-afk-muted/60 focus:outline-none focus:border-afk-olive-accent transition"
                />
              </div>

              {/* Compact Meta Bar (Date, Category, Scope, Venture) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Date */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-afk-secondary">
                  <Calendar className="w-3.5 h-3.5 text-afk-olive-accent shrink-0" />
                  <input
                    type="date"
                    required
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="bg-transparent text-xs text-afk-offwhite focus:outline-none cursor-pointer"
                  />
                </div>

                {/* Category */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-afk-secondary">
                  <Tag className="w-3.5 h-3.5 text-afk-olive-accent shrink-0" />
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="bg-transparent text-xs text-afk-offwhite focus:outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-afk-card text-afk-offwhite">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scope */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-afk-secondary">
                  <Shield className="w-3.5 h-3.5 text-afk-olive-accent shrink-0" />
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="bg-transparent text-xs text-afk-offwhite focus:outline-none cursor-pointer"
                  >
                    <option value="COMPANY" className="bg-afk-card text-afk-offwhite">Shared (Team)</option>
                    <option value="VENTURE" className="bg-afk-card text-afk-offwhite">Venture Drop</option>
                    <option value="PERSONAL" className="bg-afk-card text-afk-offwhite">Private (Only You)</option>
                  </select>
                </div>

                {/* Venture Link */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-afk-secondary">
                  <Layers className="w-3.5 h-3.5 text-afk-olive-accent shrink-0" />
                  <select
                    value={ventureId}
                    onChange={(e) => setVentureId(e.target.value)}
                    className="bg-transparent text-xs text-afk-offwhite focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-afk-card text-afk-muted">No Venture Project</option>
                    {ventures.map((v) => (
                      <option key={v.id} value={v.id} className="bg-afk-card text-afk-offwhite">
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rich Text Editor Container */}
              <div className="rounded-xl border border-afk-border bg-afk-surface/40 overflow-hidden shadow-inner">
                {/* Editor Toolbar */}
                <div className="px-3 py-2 bg-afk-surface border-b border-afk-border flex flex-wrap items-center justify-between gap-2 select-none">
                  <div className="flex items-center flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => insertFormatting("# ", "", "Main Heading")}
                      title="Heading 1 (# text)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer flex items-center gap-0.5 text-xs font-bold"
                    >
                      <Heading1 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("## ", "", "Subheading")}
                      title="Heading 2 (## text)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer flex items-center gap-0.5 text-xs font-semibold"
                    >
                      <Heading2 className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-afk-border mx-1" />
                    <button
                      type="button"
                      onClick={() => insertFormatting("**", "**", "bold text")}
                      title="Bold (**text**)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("*", "*", "italic text")}
                      title="Italic (*text*)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-afk-border mx-1" />
                    <button
                      type="button"
                      onClick={() => insertFormatting("- ", "", "Bullet point")}
                      title="Bullet List (- item)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("1. ", "", "Step item")}
                      title="Numbered List (1. item)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("- [ ] ", "", "Action item")}
                      title="Checklist Item (- [ ] item)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4 text-afk-olive-accent" />
                    </button>
                    <div className="w-px h-4 bg-afk-border mx-1" />
                    <button
                      type="button"
                      onClick={() => insertFormatting("> ", "", "Important quote or callout")}
                      title="Quote / Callout (> text)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <Quote className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("`", "`", "code")}
                      title="Code Snippet (`code`)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("\n---\n", "")}
                      title="Horizontal Divider (---)"
                      className="p-1.5 rounded hover:bg-afk-elevated text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Write vs Preview Mode Toggle */}
                  <div className="flex items-center rounded-lg bg-afk-elevated p-0.5 border border-afk-border text-[11px]">
                    <button
                      type="button"
                      onClick={() => setNoteTab("edit")}
                      className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
                        noteTab === "edit"
                          ? "bg-afk-surface text-afk-offwhite shadow-sm"
                          : "text-afk-muted hover:text-afk-secondary"
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Write</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteTab("preview")}
                      className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
                        noteTab === "preview"
                          ? "bg-afk-surface text-afk-offwhite shadow-sm"
                          : "text-afk-muted hover:text-afk-secondary"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>

                {/* Editor Content Box */}
                {noteTab === "edit" ? (
                  <textarea
                    ref={textareaRef}
                    rows={9}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write detailed notes here... Use the toolbar above or type markdown (# Heading, ## Subheading, - Bullets, 1. Numbering, - [ ] Checklists, > Quotes)."
                    className="w-full bg-transparent p-4 text-sm text-afk-offwhite placeholder:text-afk-muted/50 focus:outline-none resize-y leading-relaxed font-sans"
                  />
                ) : (
                  <div className="p-4 min-h-[200px] max-h-[350px] overflow-y-auto text-sm text-afk-offwhite leading-relaxed space-y-1 bg-afk-card/30">
                    {renderMarkdownPreview(description)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. EVENT TAB — STRUCTURED TIMETABLE, LOCATION, ATTENDEES & RECURRENCE     */}
          {/* ========================================================================= */}
          {entryType === "EVENT" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Event Title */}
              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Event / Meeting Name *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Origin Drop Photoshoot Session, Fabric Price Negotiation with Aman Mill, Bi-Weekly Partner Review"
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-sm text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                />
              </div>

              {/* Schedule: Date, All-Day, Times */}
              <div className="p-3.5 bg-afk-surface/40 rounded-xl border border-afk-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-afk-secondary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-afk-olive-accent" />
                    <span>Time & Schedule</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs text-afk-offwhite cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAllDay}
                      onChange={(e) => setIsAllDay(e.target.checked)}
                      className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                    />
                    <span>All-Day Event</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-afk-muted mb-1">Event Date</label>
                    <input
                      type="date"
                      required
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                    />
                  </div>

                  {!isAllDay && (
                    <>
                      <div>
                        <label className="block text-[11px] text-afk-muted mb-1">Start Time</label>
                        <input
                          type="time"
                          value={startTimeStr}
                          onChange={(e) => setStartTimeStr(e.target.value)}
                          className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-afk-muted mb-1">End Time</label>
                        <input
                          type="time"
                          value={endTimeStr}
                          onChange={(e) => setEndTimeStr(e.target.value)}
                          className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Location & Partner Attendees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-afk-olive-accent" />
                    <span>Location / Meeting Link</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Gazipur Factory 2, Showroom, or Google Meet link"
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-afk-olive-accent" />
                    <span>Lead Partner / Organizer</span>
                  </label>
                  <select
                    value={assignedPartnerId}
                    onChange={(e) => setAssignedPartnerId(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="">All Partners / Unassigned</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category, Venture & Recurrence */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Category</label>
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
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Related Venture</label>
                  <select
                    value={ventureId}
                    onChange={(e) => setVentureId(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="">None / General Operations</option>
                    {ventures.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-afk-olive-accent" />
                    <span>Recurrence / Repeat</span>
                  </label>
                  <select
                    value={isRecurring ? recurrenceFreq : "NONE"}
                    onChange={(e) => {
                      if (e.target.value === "NONE") {
                        setIsRecurring(false);
                      } else {
                        setIsRecurring(true);
                        setRecurrenceFreq(e.target.value as any);
                      }
                    }}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="NONE">Does not repeat</option>
                    <option value="WEEKLY">Repeats weekly</option>
                    <option value="DAILY">Repeats daily</option>
                    <option value="MONTHLY">Repeats monthly</option>
                  </select>
                </div>
              </div>

              {/* Event Agenda & Minutes */}
              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Meeting Agenda & Discussion Points
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Topics to discuss, decisions needed, or previous action items..."
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. TASK TAB — CHECKOUT SUBTASKS, STATUS, PRIORITY & ASSIGNEE             */}
          {/* ========================================================================= */}
          {entryType === "TASK" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Approve 320 GSM Terry sample lab dips, Settle Pathao COD remittance, QC 100pcs hoodies"
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-sm text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                />
              </div>

              {/* Due Date, Priority & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Priority</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { val: "LOW", label: "Low", color: "text-blue-400 border-blue-500/30" },
                      { val: "MEDIUM", label: "Med", color: "text-afk-secondary border-afk-border" },
                      { val: "HIGH", label: "High", color: "text-amber-400 border-amber-500/30" },
                      { val: "URGENT", label: "Urgent", color: "text-red-400 border-red-500/30" },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setPriority(p.val as any)}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer text-center ${
                          priority === p.val
                            ? "bg-afk-elevated text-afk-offwhite border-afk-olive shadow-sm"
                            : "bg-afk-surface text-afk-muted hover:text-afk-offwhite"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="PENDING">Pending (To-Do)</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Assignee & Venture */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-afk-olive-accent" />
                    <span>Assigned Partner</span>
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

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-afk-olive-accent" />
                    <span>Related Venture</span>
                  </label>
                  <select
                    value={ventureId}
                    onChange={(e) => setVentureId(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="">Standalone / General</option>
                    {ventures.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* INTERACTIVE CHECKOUT SUBTASKS (CHECKLIST) */}
              <div className="p-4 bg-afk-surface/50 rounded-xl border border-afk-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-afk-offwhite flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-afk-olive-accent" />
                      <span>Checkout / Action Subtasks</span>
                    </h3>
                    <p className="text-[11px] text-afk-muted">
                      Check items off as you complete them
                    </p>
                  </div>
                  {checklists.length > 0 && (
                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold text-afk-olive-accent">
                        {completedChecklistCount} of {checklists.length} done ({checklistPercent}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {checklists.length > 0 && (
                  <div className="w-full h-1.5 bg-afk-surface rounded-full overflow-hidden border border-afk-border/50">
                    <div
                      className="h-full bg-afk-olive transition-all duration-300"
                      style={{ width: `${checklistPercent}%` }}
                    />
                  </div>
                )}

                {/* Existing checklist items */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {checklists.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-afk-surface/80 hover:bg-afk-surface border border-afk-border transition"
                    >
                      <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => handleToggleChecklist(idx)}
                          className="w-4 h-4 rounded bg-afk-card border-afk-border text-afk-olive focus:ring-0 cursor-pointer"
                        />
                        <span
                          className={`text-xs transition truncate ${
                            item.isCompleted
                              ? "line-through text-afk-muted"
                              : "text-afk-offwhite font-medium"
                          }`}
                        >
                          {item.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(idx)}
                        className="p-1 rounded text-afk-muted hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete subtask"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Quick Add Subtask Input */}
                <div className="flex items-center gap-2 pt-1">
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
                    placeholder="Add a checkout subtask (press Enter)..."
                    className="flex-1 bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-1.5 rounded-lg bg-afk-elevated hover:bg-afk-surface border border-afk-border text-xs font-semibold text-afk-offwhite transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Task Specifications / Instructions */}
              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Instructions & Specifications
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Technical specs, GSM requirements, delivery addresses, or special constraints..."
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. DEADLINE TAB — CRITICAL MILESTONES, COUNTDOWN ALERTS & BLOCKERS       */}
          {/* ========================================================================= */}
          {entryType === "DEADLINE" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Dynamic Countdown Alert Banner */}
              {deadlineInfo && (
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${deadlineInfo.color}`}>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{deadlineInfo.label}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-current bg-black/20">
                    {deadlineInfo.badge}
                  </span>
                </div>
              )}

              {/* Deadline Name */}
              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Critical Deadline / Milestone Name *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Fabric Supplier 50% Balance Payment Due, Origin Drop Official Website Release, Batch QC Cutoff"
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-sm text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Target Cutoff Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-afk-surface/40 rounded-xl border border-afk-border">
                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">
                    Hard Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">
                    Cutoff Time (e.g. 18:00 or 23:59)
                  </label>
                  <input
                    type="time"
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-1.5 text-xs text-afk-offwhite"
                  />
                </div>
              </div>

              {/* Urgency Level & Associated Venture */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Urgency Level</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPriority("HIGH")}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                        priority === "HIGH"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                          : "bg-afk-surface text-afk-muted border-afk-border"
                      }`}
                    >
                      High
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority("URGENT")}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                        priority === "URGENT"
                          ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm"
                          : "bg-afk-surface text-afk-muted border-afk-border"
                      }`}
                    >
                      Critical / Urgent
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Impacted Venture</label>
                  <select
                    value={ventureId}
                    onChange={(e) => setVentureId(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="">Whole Company</option>
                    {ventures.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-afk-secondary mb-1">Resolution Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-afk-surface border border-afk-border rounded-xl px-3 py-2 text-xs text-afk-offwhite cursor-pointer"
                  >
                    <option value="PENDING">Active (Pending)</option>
                    <option value="COMPLETED">Resolved / Met</option>
                    <option value="CANCELLED">Waived / Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Action Required & Consequences */}
              <div>
                <label className="block text-xs font-semibold text-afk-secondary mb-1">
                  Action Required & Impact if Missed
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specify who needs to approve, what payments must clear, or manufacturing delays if missed..."
                  className="w-full bg-afk-surface border border-afk-border rounded-xl px-3.5 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ATTACHMENTS (UNIVERSAL PROOF ENGINE — CLEAN SINGLE-CONTAINER UI)         */}
          {/* ========================================================================= */}
          <div className="pt-2 border-t border-afk-border">
            <EvidenceUploader
              mode="form"
              label="Supporting Proof & Attachments"
              helperText="Auto WebP + SHA-256 verification (bills, tech packs, specs, receipts, or screenshots)"
              stagedFiles={stagedFiles}
              onStagedFilesChange={setStagedFiles}
              compact
            />
          </div>

          {/* Modal Actions Footer */}
          <div className="pt-3 border-t border-afk-border flex items-center justify-between shrink-0">
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

            <div className="flex items-center gap-2.5">
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
                {isSubmitting
                  ? "Saving..."
                  : entryToEdit
                  ? "Save Changes"
                  : entryType === "NOTE"
                  ? "Save Note"
                  : entryType === "TASK"
                  ? "Create Task"
                  : entryType === "DEADLINE"
                  ? "Set Deadline"
                  : "Save Event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
