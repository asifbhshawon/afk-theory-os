"use client";

import React from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
} from "date-fns";

export interface PrintableCalendarProps {
  formatType: "DAILY" | "WEEKLY" | "MONTHLY";
  targetDate: Date;
  entries: any[];
  categories: any[];
  includeNotes?: boolean;
  includeTasks?: boolean;
  includeCompleted?: boolean;
  includeExtraNotesSpace?: boolean;
  firstDayOfWeek?: number;
}

export function PrintableCalendarView({
  formatType,
  targetDate,
  entries,
  categories,
  includeNotes = true,
  includeTasks = true,
  includeCompleted = true,
  includeExtraNotesSpace = true,
  firstDayOfWeek = 6,
}: PrintableCalendarProps) {
  // Filter entries based on options
  const filtered = entries.filter((e) => {
    if (!includeTasks && e.entryType === "TASK") return false;
    if (!includeNotes && e.entryType === "NOTE") return false;
    if (!includeCompleted && e.status === "COMPLETED") return false;
    return true;
  });

  if (formatType === "DAILY") {
    const dayEntries = filtered.filter((e) =>
      isSameDay(new Date(e.startDate), targetDate)
    );
    const timed = dayEntries.filter((e) => !e.isAllDay && e.entryType === "EVENT");
    const tasks = dayEntries.filter((e) => e.entryType === "TASK");
    const deadlines = dayEntries.filter((e) => e.entryType === "DEADLINE");
    const notes = dayEntries.filter((e) => e.entryType === "NOTE");

    const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 - 21:00

    return (
      <div className="bg-white text-neutral-900 p-8 max-w-[210mm] mx-auto min-h-[297mm] font-sans text-sm flex flex-col justify-between leading-normal select-none print:p-0 print:max-w-none">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-wider uppercase text-neutral-900">
                  AFK THEORY
                </span>
                <span className="text-xs uppercase tracking-widest text-neutral-500 font-mono">
                  Clothing Co.
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mt-1">
                Daily Business Planner
              </h1>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-neutral-900">
                {format(targetDate, "EEEE")}
              </p>
              <p className="text-sm font-semibold text-neutral-700">
                {format(targetDate, "MMMM d, yyyy")}
              </p>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                Asia/Dhaka · BDT (৳)
              </p>
            </div>
          </div>

          {/* Deadlines Banner if any */}
          {deadlines.length > 0 && (
            <div className="mb-6 p-3 bg-neutral-100 border-l-4 border-neutral-900 rounded-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-1">
                Critical Deadlines Due Today
              </p>
              <div className="space-y-1">
                {deadlines.map((dl) => (
                  <div key={dl.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-900">• {dl.title}</span>
                    <span className="font-mono text-[11px] text-neutral-600">
                      {dl.categoryName || "Deadline"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Grid: Schedule Timeline + Action Tasks & Notes */}
          <div className="grid grid-cols-12 gap-6">
            {/* Timeline (08:00 - 21:00) */}
            <div className="col-span-7 border border-neutral-300 rounded-md p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider border-b border-neutral-200 pb-2 mb-2 text-neutral-800">
                Hourly Schedule & Timeline
              </h3>
              <div className="divide-y divide-neutral-200 text-xs">
                {hours.map((hour) => {
                  const hourItems = timed.filter((e) => {
                    const s = new Date(e.startDate);
                    return s.getHours() === hour;
                  });

                  return (
                    <div key={hour} className="py-2 flex items-start gap-3 min-h-[32px]">
                      <span className="font-mono text-neutral-500 w-12 shrink-0 text-[11px]">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                      <div className="flex-1">
                        {hourItems.length > 0 ? (
                          hourItems.map((entry) => (
                            <div key={entry.id} className="font-medium text-neutral-900">
                              <span className="font-bold">{entry.title}</span>
                              {entry.categoryName && (
                                <span className="text-neutral-500 text-[11px] ml-1.5">
                                  ({entry.categoryName})
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="border-b border-neutral-100 h-3" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Tasks & Notes */}
            <div className="col-span-5 space-y-4">
              {/* Tasks Checklist */}
              <div className="border border-neutral-300 rounded-md p-3">
                <h3 className="text-xs font-bold uppercase tracking-wider border-b border-neutral-200 pb-2 mb-2 text-neutral-800">
                  Priority Action Checklist
                </h3>
                <div className="space-y-2 text-xs">
                  {tasks.length > 0 ? (
                    tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-2">
                        <span className="inline-block w-3.5 h-3.5 border border-neutral-400 rounded-xs mt-0.5 shrink-0" />
                        <span
                          className={`font-medium ${
                            task.status === "COMPLETED" ? "line-through text-neutral-400" : "text-neutral-900"
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-neutral-400 italic text-[11px]">No scheduled tasks</p>
                  )}

                  {/* Extra Blank Checkboxes for handwritten tasks */}
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 pt-1">
                      <span className="inline-block w-3.5 h-3.5 border border-neutral-300 rounded-xs shrink-0" />
                      <div className="border-b border-neutral-200 flex-1 h-3" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes & Discussions */}
              <div className="border border-neutral-300 rounded-md p-3">
                <h3 className="text-xs font-bold uppercase tracking-wider border-b border-neutral-200 pb-2 mb-2 text-neutral-800">
                  Business Notes & Minutes
                </h3>
                {notes.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {notes.map((n) => (
                      <div key={n.id} className="border-b border-neutral-100 pb-1.5 last:border-b-0">
                        <p className="font-bold text-neutral-900">{n.title}</p>
                        {n.description && (
                          <p className="text-neutral-600 mt-0.5 text-[11px] leading-relaxed">
                            {n.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-400 italic text-[11px] mb-2">No notes recorded</p>
                )}
              </div>
            </div>
          </div>

          {/* Lined writing space for handwritten notes */}
          {includeExtraNotesSpace && (
            <div className="mt-6 border border-neutral-300 rounded-md p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                Handwritten Notes & Follow-ups
              </h3>
              <div className="space-y-4 pt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-b border-neutral-200 h-4" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-8 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span>AFK THEORY Business OS · Daily Planner</span>
          <span>Printed on {format(new Date(), "yyyy-MM-dd HH:mm")} (Asia/Dhaka)</span>
        </div>
      </div>
    );
  }

  if (formatType === "WEEKLY") {
    const weekStart = startOfWeek(targetDate, { weekStartsOn: firstDayOfWeek as any });
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: firstDayOfWeek as any });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="bg-white text-neutral-900 p-8 max-w-[297mm] mx-auto min-h-[210mm] font-sans text-xs flex flex-col justify-between select-none print:p-0 print:max-w-none">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3 mb-4">
            <div>
              <span className="font-extrabold text-lg tracking-wider uppercase text-neutral-900">
                AFK THEORY
              </span>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 mt-0.5">
                Weekly Business Planner
              </h1>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-neutral-900">
                Week of {format(weekStart, "MMMM d")} – {format(weekEnd, "MMMM d, yyyy")}
              </p>
              <p className="text-[11px] text-neutral-500 font-mono">
                Currency: BDT (৳) · Timezone: Asia/Dhaka
              </p>
            </div>
          </div>

          {/* 7 Columns */}
          <div className="grid grid-cols-7 border border-neutral-300 rounded-md overflow-hidden divide-x divide-neutral-300 min-h-[140mm]">
            {days.map((day) => {
              const dayItems = filtered.filter((e) =>
                isSameDay(new Date(e.startDate), day)
              );

              return (
                <div key={day.toISOString()} className="flex flex-col bg-white">
                  {/* Day Header */}
                  <div className="p-2 border-b border-neutral-300 bg-neutral-100 text-center">
                    <p className="font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
                      {format(day, "EEE")}
                    </p>
                    <p className="text-sm font-extrabold text-neutral-900">
                      {format(day, "d")}
                    </p>
                  </div>

                  {/* Day Content */}
                  <div className="p-2 flex-1 space-y-2 overflow-y-auto">
                    {dayItems.length > 0 ? (
                      dayItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-1.5 border border-neutral-200 rounded-sm bg-neutral-50"
                          style={{
                            borderLeftWidth: "3px",
                            borderLeftColor: item.categoryColor || "#7D9472",
                          }}
                        >
                          <p className="font-bold text-neutral-900 text-[11px] leading-tight">
                            {item.title}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1 font-mono">
                            <span>{item.categoryName || "General"}</span>
                            {!item.isAllDay && (
                              <span>{format(new Date(item.startDate), "HH:mm")}</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-neutral-300 text-[10px] italic text-center pt-2">
                        No entries
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-200 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <span>AFK THEORY Business OS · Weekly Planner (A4 Landscape)</span>
          <span>Printed on {format(new Date(), "yyyy-MM-dd HH:mm")}</span>
        </div>
      </div>
    );
  }

  // MONTHLY FORMAT (A4 Landscape)
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek as any });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek as any });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Sample week for column headers
  const sampleWeek = eachDayOfInterval({
    start: calendarStart,
    end: new Date(calendarStart.getTime() + 6 * 24 * 60 * 60 * 1000),
  });

  return (
    <div className="bg-white text-neutral-900 p-8 max-w-[297mm] mx-auto min-h-[210mm] font-sans text-xs flex flex-col justify-between select-none print:p-0 print:max-w-none">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3 mb-4">
          <div>
            <span className="font-extrabold text-lg tracking-wider uppercase text-neutral-900">
              AFK THEORY
            </span>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 mt-0.5">
              Monthly Calendar & Drop Schedule
            </h1>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-neutral-900">
              {format(targetDate, "MMMM yyyy")}
            </p>
            <p className="text-[11px] text-neutral-500 font-mono">
              Currency: BDT (৳) · Asia/Dhaka
            </p>
          </div>
        </div>

        {/* Calendar 7x5 or 7x6 Grid */}
        <div className="border border-neutral-300 rounded-md overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-neutral-100 border-b border-neutral-300 text-center font-bold text-neutral-800 py-1.5 text-[11px] uppercase tracking-wider">
            {sampleWeek.map((d) => (
              <div key={d.toISOString()}>{format(d, "EEEE")}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 divide-x divide-y divide-neutral-200">
            {days.map((day) => {
              const inMonth = isSameMonth(day, targetDate);
              const dayItems = filtered.filter((e) =>
                isSameDay(new Date(e.startDate), day)
              );

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[24mm] p-1.5 flex flex-col justify-between ${
                    !inMonth ? "bg-neutral-50 opacity-40" : "bg-white"
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="font-bold text-neutral-800 text-xs">
                      {format(day, "d")}
                    </span>
                  </div>

                  <div className="space-y-1 my-1 overflow-hidden">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-1 rounded-xs border border-neutral-200 text-[10px] leading-tight truncate font-medium"
                        style={{
                          borderLeftWidth: "3px",
                          borderLeftColor: item.categoryColor || "#7D9472",
                        }}
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <p className="text-[9px] font-bold text-neutral-500">
                        +{dayItems.length - 3} more...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-neutral-200 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
        <span>AFK THEORY Business OS · Monthly Calendar (A4 Landscape)</span>
        <span>Printed on {format(new Date(), "yyyy-MM-dd HH:mm")}</span>
      </div>
    </div>
  );
}
