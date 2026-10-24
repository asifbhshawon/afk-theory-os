"use client";

import React from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameDay,
} from "date-fns";
import { Clock, Plus, Paperclip, CheckSquare, Square, AlertCircle } from "lucide-react";

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

interface WeekViewProps {
  currentDate: Date;
  entries: CalendarEntry[];
  firstDayOfWeek?: number;
  onSelectDate: (date: Date) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
  onNewEntryForDate: (date: Date) => void;
}

export function WeekView({
  currentDate,
  entries,
  firstDayOfWeek = 6,
  onSelectDate,
  onSelectEntry,
  onNewEntryForDate,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: firstDayOfWeek as any });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: firstDayOfWeek as any });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Hours 08:00 to 21:00
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);

  return (
    <div className="bg-afk-card border border-afk-border rounded-xl overflow-hidden shadow-lg select-none">
      {/* 7-Day Header */}
      <div className="grid grid-cols-8 border-b border-afk-border bg-afk-surface/70">
        <div className="p-3 text-xs font-semibold text-afk-muted text-center border-r border-afk-border/60">
          Time
        </div>
        {days.map((day) => {
          const isCurrentDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`p-2.5 text-center border-r border-afk-border/60 last:border-r-0 cursor-pointer transition hover:bg-afk-surface/50 ${
                isCurrentDay ? "bg-afk-olive/15" : ""
              }`}
            >
              <p className="text-xs uppercase font-semibold text-afk-muted">
                {format(day, "EEE")}
              </p>
              <span
                className={`inline-block mt-0.5 text-sm font-bold px-2 py-0.5 rounded ${
                  isCurrentDay
                    ? "bg-afk-olive text-afk-offwhite shadow-sm"
                    : "text-afk-secondary"
                }`}
              >
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-Day Shelf */}
      <div className="grid grid-cols-8 border-b border-afk-border bg-afk-charcoal/60 divide-x divide-afk-border/40">
        <div className="p-2 text-[11px] font-semibold text-afk-muted flex items-center justify-center">
          All-Day
        </div>
        {days.map((day) => {
          const allDayItems = entries.filter(
            (e) => (e.isAllDay || e.entryType === "NOTE" || e.entryType === "DEADLINE") &&
              isSameDay(new Date(e.startDate), day)
          );

          return (
            <div key={day.toISOString()} className="p-1 space-y-1 min-h-[44px]">
              {allDayItems.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  className="px-1.5 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer bg-afk-surface border border-afk-border hover:bg-afk-elevated transition"
                  style={{
                    borderLeftWidth: "3px",
                    borderLeftColor: entry.categoryColor || "#7D9472",
                  }}
                  title={entry.title}
                >
                  {entry.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Hourly Timetable Grid */}
      <div className="max-h-[600px] overflow-y-auto divide-y divide-afk-border/30">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 min-h-[48px] divide-x divide-afk-border/40">
            {/* Hour Label */}
            <div className="p-2 text-right text-[11px] font-mono text-afk-muted/80 bg-afk-surface/20">
              {String(hour).padStart(2, "0")}:00
            </div>

            {/* Day Hour Cells */}
            {days.map((day) => {
              const timedEntries = entries.filter((e) => {
                if (e.isAllDay || e.entryType === "NOTE" || e.entryType === "DEADLINE") return false;
                const s = new Date(e.startDate);
                return isSameDay(s, day) && s.getHours() === hour;
              });

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    const d = new Date(day);
                    d.setHours(hour, 0, 0, 0);
                    onNewEntryForDate(d);
                  }}
                  className="p-1 relative hover:bg-afk-surface/20 transition cursor-pointer min-h-[48px]"
                >
                  {timedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntry(entry);
                      }}
                      className="p-1.5 rounded text-xs font-medium cursor-pointer shadow-sm mb-1 transition hover:scale-[1.01]"
                      style={{
                        backgroundColor: entry.categoryColor
                          ? `${entry.categoryColor}25`
                          : "rgba(125, 148, 114, 0.2)",
                        borderLeft: `3px solid ${entry.categoryColor || "#7D9472"}`,
                      }}
                    >
                      <p className="font-semibold text-afk-offwhite truncate text-[11px]">
                        {entry.title}
                      </p>
                      <span className="text-[10px] text-afk-muted">
                        {format(new Date(entry.startDate), "HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
