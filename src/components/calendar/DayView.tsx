"use client";

import React, { useState } from "react";
import { format, isSameDay } from "date-fns";
import {
  Clock,
  Plus,
  FileText,
  CheckSquare,
  Square,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Calendar as CalendarIcon,
} from "lucide-react";

interface CalendarEntry {
  id: string;
  title: string;
  description?: string | null;
  entryType: "EVENT" | "NOTE" | "TASK" | "DEADLINE" | "REMINDER";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startDate: string | Date;
  endDate?: string | Date | null;
  isAllDay: boolean;
  categoryName?: string | null;
  categoryColor?: string | null;
  scope: string;
  evidenceCount?: number;
}

interface DayViewProps {
  currentDate: Date;
  entries: CalendarEntry[];
  onSelectEntry: (entry: CalendarEntry) => void;
  onNewEntryForDate: (date: Date) => void;
  onToggleTaskComplete?: (entryId: string, isCompleted: boolean) => void;
}

export function DayView({
  currentDate,
  entries,
  onSelectEntry,
  onNewEntryForDate,
  onToggleTaskComplete,
}: DayViewProps) {
  // Filter entries for the selected day
  const dayEntries = entries.filter((e) =>
    isSameDay(new Date(e.startDate), currentDate)
  );

  const timedEvents = dayEntries.filter(
    (e) => !e.isAllDay && e.entryType === "EVENT"
  );
  const tasks = dayEntries.filter((e) => e.entryType === "TASK");
  const deadlines = dayEntries.filter((e) => e.entryType === "DEADLINE");
  const notes = dayEntries.filter((e) => e.entryType === "NOTE");

  const hours = Array.from({ length: 14 }, (_, i) => i + 8);

  return (
    <div className="bg-afk-card border border-afk-border rounded-xl p-4 md:p-6 space-y-6 shadow-lg select-none">
      {/* Day Title & Date Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-afk-border">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-afk-olive-accent" />
            <span>{format(currentDate, "EEEE, MMMM d, yyyy")}</span>
          </h2>
          <p className="text-xs text-afk-muted mt-1">
            {dayEntries.length} scheduled {dayEntries.length === 1 ? "item" : "items"} on this date
          </p>
        </div>

        <button
          onClick={() => onNewEntryForDate(currentDate)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite rounded-lg text-xs font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Activity / Note</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Timeline Grid (08:00 - 21:00) */}
        <div className="lg:col-span-7 bg-afk-surface/40 rounded-xl border border-afk-border p-4">
          <h3 className="text-sm font-semibold text-afk-offwhite mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-afk-olive-accent" />
            <span>Daily Schedule & Timeline</span>
          </h3>

          <div className="space-y-1 divide-y divide-afk-border/40">
            {hours.map((hour) => {
              const hourItems = timedEvents.filter((e) => {
                const s = new Date(e.startDate);
                return s.getHours() === hour;
              });

              return (
                <div
                  key={hour}
                  onClick={() => {
                    const d = new Date(currentDate);
                    d.setHours(hour, 0, 0, 0);
                    onNewEntryForDate(d);
                  }}
                  className="flex items-start gap-4 py-2 hover:bg-afk-elevated/40 rounded-lg px-2 transition cursor-pointer group"
                >
                  <span className="font-mono text-xs text-afk-muted w-14 shrink-0 pt-0.5">
                    {String(hour).padStart(2, "0")}:00
                  </span>

                  <div className="flex-1 space-y-1.5 min-h-[28px]">
                    {hourItems.length === 0 ? (
                      <span className="text-xs text-afk-muted/40 italic group-hover:text-afk-muted/70 transition">
                        —
                      </span>
                    ) : (
                      hourItems.map((entry) => (
                        <div
                          key={entry.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEntry(entry);
                          }}
                          className="p-2.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border shadow-sm flex items-center justify-between cursor-pointer transition"
                          style={{
                            borderLeftWidth: "4px",
                            borderLeftColor: entry.categoryColor || "#7D9472",
                          }}
                        >
                          <div>
                            <p className="text-xs font-bold text-afk-offwhite">
                              {entry.title}
                            </p>
                            <span className="text-[11px] text-afk-muted">
                              {format(new Date(entry.startDate), "HH:mm")}
                              {entry.endDate && ` – ${format(new Date(entry.endDate), "HH:mm")}`}
                              {" · "}
                              {entry.categoryName || "General"}
                            </span>
                          </div>
                          {entry.evidenceCount ? (
                            <span className="text-xs text-afk-muted flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5" />
                              {entry.evidenceCount}
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deadlines, Tasks & Notes Pad */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Deadlines */}
          {deadlines.length > 0 && (
            <div className="bg-afk-surface/40 rounded-xl border border-afk-border p-4">
              <h3 className="text-sm font-semibold text-afk-danger mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-afk-danger" />
                <span>Important Deadlines Due Today</span>
              </h3>
              <div className="space-y-2">
                {deadlines.map((dl) => (
                  <div
                    key={dl.id}
                    onClick={() => onSelectEntry(dl)}
                    className="p-2.5 rounded-lg bg-afk-danger/10 border border-afk-danger/30 flex items-center justify-between cursor-pointer hover:bg-afk-danger/20 transition"
                  >
                    <div>
                      <p className="text-xs font-bold text-afk-offwhite">{dl.title}</p>
                      <p className="text-[11px] text-afk-secondary mt-0.5">
                        {dl.categoryName || "Deadline"} · Priority: {dl.priority}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Tasks & Action Checklist */}
          <div className="bg-afk-surface/40 rounded-xl border border-afk-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-afk-offwhite flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-afk-olive-accent" />
                <span>Action Checklist & Tasks ({tasks.length})</span>
              </h3>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-afk-muted italic">No tasks assigned for this date.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const isCompleted = task.status === "COMPLETED";
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectEntry(task)}
                      className="p-2.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border flex items-center justify-between cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleTaskComplete) {
                              onToggleTaskComplete(task.id, !isCompleted);
                            }
                          }}
                          className="text-afk-muted hover:text-afk-offwhite shrink-0"
                        >
                          {isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-afk-success" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span
                          className={`text-xs font-medium text-afk-offwhite truncate ${
                            isCompleted ? "line-through text-afk-muted" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-afk-border text-afk-muted font-mono uppercase">
                        {task.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Business Notes */}
          <div className="bg-afk-surface/40 rounded-xl border border-afk-border p-4">
            <h3 className="text-sm font-semibold text-afk-offwhite mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-afk-olive-accent" />
              <span>Notes & Observations ({notes.length})</span>
            </h3>

            {notes.length === 0 ? (
              <p className="text-xs text-afk-muted italic">No notes recorded on this date.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onSelectEntry(note)}
                    className="p-3 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border cursor-pointer transition"
                  >
                    <p className="text-xs font-bold text-afk-offwhite">{note.title}</p>
                    {note.description && (
                      <p className="text-xs text-afk-secondary mt-1 line-clamp-2 leading-relaxed">
                        {note.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-afk-muted">
                      <span>{note.categoryName || "General"}</span>
                      {note.evidenceCount ? (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {note.evidenceCount} attachments
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
