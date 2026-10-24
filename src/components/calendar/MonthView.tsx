"use client";

import React, { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  FileText,
  CheckSquare,
  Square,
  Clock,
  AlertCircle,
  Plus,
  Paperclip,
  CheckCircle2,
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

interface MonthViewProps {
  currentDate: Date;
  entries: CalendarEntry[];
  firstDayOfWeek?: number; // 0 = Sun, 1 = Mon, 6 = Sat
  onSelectDate: (date: Date) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
  onNewEntryForDate: (date: Date) => void;
  onToggleTaskComplete?: (entryId: string, isCompleted: boolean) => void;
}

export function MonthView({
  currentDate,
  entries,
  firstDayOfWeek = 6, // Saturday default for Bangladesh
  onSelectDate,
  onSelectEntry,
  onNewEntryForDate,
  onToggleTaskComplete,
}: MonthViewProps) {
  const [dayPopoverDate, setDayPopoverDate] = useState<Date | null>(null);

  // Compute month bounds
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek as any });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek as any });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Weekday column headers based on firstDayOfWeek
  const weekdayNames = [];
  const sampleWeek = eachDayOfInterval({
    start: calendarStart,
    end: new Date(calendarStart.getTime() + 6 * 24 * 60 * 60 * 1000),
  });
  for (const day of sampleWeek) {
    weekdayNames.push(format(day, "EEE"));
  }

  // Group entries by day string YYYY-MM-DD
  const entriesByDay: Record<string, CalendarEntry[]> = {};
  for (const entry of entries) {
    const dStr = format(new Date(entry.startDate), "yyyy-MM-dd");
    if (!entriesByDay[dStr]) {
      entriesByDay[dStr] = [];
    }
    entriesByDay[dStr].push(entry);
  }

  return (
    <div className="bg-afk-card border border-afk-border rounded-xl overflow-hidden shadow-lg select-none">
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-afk-border bg-afk-surface/70 text-xs font-semibold text-afk-secondary py-2.5 px-1 text-center">
        {weekdayNames.map((name, i) => (
          <div
            key={name}
            className={`tracking-wide ${
              i === 0 || i === 6 ? "text-afk-muted" : "text-afk-secondary"
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-afk-border/60 bg-afk-charcoal/40">
        {days.map((day) => {
          const dStr = format(day, "yyyy-MM-dd");
          const dayEntries = entriesByDay[dStr] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          const visibleEntries = dayEntries.slice(0, 3);
          const overflowCount = dayEntries.length - visibleEntries.length;

          return (
            <div
              key={dStr}
              onClick={() => onSelectDate(day)}
              className={`min-h-[110px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer group relative ${
                !isCurrentMonth ? "bg-afk-black/40 opacity-45" : "hover:bg-afk-surface/40"
              } ${isCurrentDay ? "bg-afk-olive/10" : ""}`}
            >
              {/* Day Cell Header */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs sm:text-sm font-semibold rounded-md px-1.5 py-0.5 leading-tight ${
                    isCurrentDay
                      ? "bg-afk-olive text-afk-offwhite font-bold shadow-sm"
                      : isCurrentMonth
                      ? "text-afk-secondary group-hover:text-afk-offwhite"
                      : "text-afk-muted"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Quick Add Button on Hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewEntryForDate(day);
                  }}
                  title="Add activity for this date"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-afk-elevated text-afk-muted hover:text-afk-offwhite transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Day Entries List */}
              <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                {visibleEntries.map((entry) => {
                  const isTask = entry.entryType === "TASK";
                  const isCompleted = entry.status === "COMPLETED";
                  const isDeadline = entry.entryType === "DEADLINE";
                  const isNote = entry.entryType === "NOTE";

                  return (
                    <div
                      key={entry.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntry(entry);
                      }}
                      className="group/entry flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-medium truncate transition cursor-pointer border border-afk-border/40 hover:border-afk-border-strong hover:bg-afk-surface"
                      style={{
                        borderLeftWidth: "3px",
                        borderLeftColor: entry.categoryColor || "#7D9472",
                      }}
                    >
                      <div className="flex items-center gap-1 min-w-0 truncate">
                        {isTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleTaskComplete) {
                                onToggleTaskComplete(entry.id, !isCompleted);
                              }
                            }}
                            className="text-afk-muted hover:text-afk-offwhite shrink-0"
                          >
                            {isCompleted ? (
                              <CheckSquare className="w-3 h-3 text-afk-success" />
                            ) : (
                              <Square className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        {isDeadline && (
                          <AlertCircle className="w-3 h-3 text-afk-danger shrink-0" />
                        )}
                        {isNote && (
                          <FileText className="w-3 h-3 text-afk-muted shrink-0" />
                        )}

                        <span
                          className={`truncate text-afk-offwhite ${
                            isCompleted ? "line-through text-afk-muted" : ""
                          }`}
                        >
                          {entry.title}
                        </span>
                      </div>

                      {entry.evidenceCount ? (
                        <Paperclip className="w-2.5 h-2.5 text-afk-muted shrink-0" />
                      ) : null}
                    </div>
                  );
                })}

                {/* Overflow Pill */}
                {overflowCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDayPopoverDate(day);
                    }}
                    className="w-full text-left px-1.5 py-0.5 text-[11px] font-semibold text-afk-olive-accent hover:text-afk-offwhite hover:underline transition"
                  >
                    +{overflowCount} more...
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Overflow Popover Modal */}
      {dayPopoverDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setDayPopoverDate(null)}
        >
          <div
            className="w-full max-w-md bg-afk-card border border-afk-border rounded-xl shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-afk-border">
              <div>
                <h3 className="font-bold text-sm text-afk-offwhite">
                  {format(dayPopoverDate, "EEEE, MMMM d, yyyy")}
                </h3>
                <p className="text-xs text-afk-muted">
                  All scheduled activities & notes
                </p>
              </div>
              <button
                onClick={() => {
                  onNewEntryForDate(dayPopoverDate);
                  setDayPopoverDate(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-afk-olive text-afk-offwhite hover:bg-afk-olive-light transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 py-1">
              {(entriesByDay[format(dayPopoverDate, "yyyy-MM-dd")] || []).map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => {
                    onSelectEntry(entry);
                    setDayPopoverDate(null);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border cursor-pointer transition"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: entry.categoryColor || "#7D9472",
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold text-afk-offwhite">
                      {entry.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-afk-muted">
                      <span>{entry.categoryName || "General"}</span>
                      <span>·</span>
                      <span className="capitalize">{entry.entryType.toLowerCase()}</span>
                      {entry.priority && (
                        <>
                          <span>·</span>
                          <span className="uppercase">{entry.priority}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {entry.evidenceCount ? (
                    <span className="text-xs text-afk-muted flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" />
                      {entry.evidenceCount}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-afk-border flex justify-end">
              <button
                onClick={() => setDayPopoverDate(null)}
                className="px-3 py-1.5 text-xs text-afk-secondary hover:text-afk-offwhite rounded bg-afk-surface hover:bg-afk-elevated transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
