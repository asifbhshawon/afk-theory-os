"use client";

import React from "react";
import { format, isToday, isTomorrow, isPast, isSameDay } from "date-fns";
import {
  Calendar as CalendarIcon,
  FileText,
  CheckSquare,
  Square,
  AlertCircle,
  Paperclip,
  Clock,
  ArrowRight,
  Plus,
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
  categoryIcon?: string | null;
  scope: string;
  evidenceCount?: number;
}

interface AgendaViewProps {
  entries: CalendarEntry[];
  onSelectEntry: (entry: CalendarEntry) => void;
  onNewEntry: () => void;
  onToggleTaskComplete?: (entryId: string, isCompleted: boolean) => void;
}

export function AgendaView({
  entries,
  onSelectEntry,
  onNewEntry,
  onToggleTaskComplete,
}: AgendaViewProps) {
  // Group entries by date
  const groups: { date: Date; dateStr: string; items: CalendarEntry[] }[] = [];
  const map: Record<string, CalendarEntry[]> = {};

  for (const entry of entries) {
    const d = new Date(entry.startDate);
    const dStr = format(d, "yyyy-MM-dd");
    if (!map[dStr]) {
      map[dStr] = [];
    }
    map[dStr].push(entry);
  }

  // Sort dates chronologically
  const sortedDates = Object.keys(map).sort();
  for (const dStr of sortedDates) {
    groups.push({
      date: new Date(dStr),
      dateStr: dStr,
      items: map[dStr],
    });
  }

  if (groups.length === 0) {
    return (
      <div className="bg-afk-card border border-afk-border rounded-xl p-12 text-center shadow-lg space-y-4">
        <div className="w-12 h-12 rounded-full bg-afk-surface border border-afk-border mx-auto flex items-center justify-center text-afk-muted">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-afk-offwhite">
          No Scheduled Activities Found
        </h3>
        <p className="text-xs text-afk-secondary max-w-sm mx-auto">
          There are no events, deadlines, tasks, or notes matching your current filter criteria.
        </p>
        <button
          onClick={onNewEntry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Activity</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {groups.map((group) => {
        const isCurrentDay = isToday(group.date);
        const isNextDay = isTomorrow(group.date);

        return (
          <div
            key={group.dateStr}
            className="bg-afk-card border border-afk-border rounded-xl overflow-hidden shadow-md"
          >
            {/* Date Group Header */}
            <div
              className={`px-4 py-3 border-b border-afk-border flex items-center justify-between ${
                isCurrentDay
                  ? "bg-afk-olive/20 text-afk-offwhite"
                  : "bg-afk-surface/60 text-afk-secondary"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm text-afk-offwhite">
                  {format(group.date, "EEEE, MMMM d, yyyy")}
                </span>
                {isCurrentDay && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-afk-olive text-afk-offwhite shadow-sm">
                    Today
                  </span>
                )}
                {isNextDay && (
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-muted">
                    Tomorrow
                  </span>
                )}
              </div>

              <span className="text-xs text-afk-muted">
                {group.items.length} {group.items.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            {/* List of Entries */}
            <div className="divide-y divide-afk-border/40">
              {group.items.map((entry) => {
                const isTask = entry.entryType === "TASK";
                const isCompleted = entry.status === "COMPLETED";
                const isDeadline = entry.entryType === "DEADLINE";
                const isNote = entry.entryType === "NOTE";
                const isEvent = entry.entryType === "EVENT";

                return (
                  <div
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-afk-surface/50 transition cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Left icon / status */}
                      <div className="mt-0.5 shrink-0">
                        {isTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleTaskComplete) {
                                onToggleTaskComplete(entry.id, !isCompleted);
                              }
                            }}
                            className="text-afk-muted hover:text-afk-offwhite transition"
                          >
                            {isCompleted ? (
                              <CheckSquare className="w-4 h-4 text-afk-success" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {isDeadline && (
                          <AlertCircle className="w-4 h-4 text-afk-danger" />
                        )}
                        {isNote && (
                          <FileText className="w-4 h-4 text-afk-secondary" />
                        )}
                        {isEvent && (
                          <CalendarIcon className="w-4 h-4 text-afk-olive-accent" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={`text-sm font-semibold text-afk-offwhite truncate ${
                              isCompleted ? "line-through text-afk-muted" : ""
                            }`}
                          >
                            {entry.title}
                          </p>

                          {/* Category Badge */}
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${entry.categoryColor || "#7D9472"}20`,
                              color: entry.categoryColor || "#96AF8A",
                              border: `1px solid ${entry.categoryColor || "#7D9472"}40`,
                            }}
                          >
                            {entry.categoryName || "General"}
                          </span>

                          {/* Scope pill */}
                          {entry.scope !== "COMPANY" && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-afk-surface border border-afk-border text-afk-muted capitalize">
                              {entry.scope.toLowerCase()}
                            </span>
                          )}

                          {/* Priority pill */}
                          {(entry.priority === "HIGH" || entry.priority === "URGENT") && (
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase ${
                                entry.priority === "URGENT"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {entry.priority}
                            </span>
                          )}
                        </div>

                        {entry.description && (
                          <p className="text-xs text-afk-secondary mt-1 line-clamp-1 leading-relaxed">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Metadata */}
                    <div className="flex items-center gap-3 shrink-0 text-xs text-afk-muted">
                      {entry.evidenceCount ? (
                        <span className="flex items-center gap-1 text-afk-secondary" title="Attached Evidence">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{entry.evidenceCount}</span>
                        </span>
                      ) : null}

                      {!entry.isAllDay ? (
                        <span className="font-mono text-afk-secondary">
                          {format(new Date(entry.startDate), "HH:mm")}
                        </span>
                      ) : (
                        <span className="text-[11px] text-afk-muted">All-Day</span>
                      )}

                      <ArrowRight className="w-4 h-4 text-afk-muted group-hover:text-afk-offwhite group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
