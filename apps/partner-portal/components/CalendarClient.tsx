"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Clock,
  Lock,
  Users,
  Briefcase,
  AlertCircle,
  Tag,
  Search,
  Filter,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns";
import { formatBdt, formatDateTime, formatDate } from "@/lib/format";
import { PortalPartner } from "@/lib/auth";

export interface CalendarEntry {
  id: string;
  title: string;
  description: string | null;
  entryType: string;
  status: string;
  priority: string;
  startDate: string | Date;
  endDate: string | Date | null;
  isAllDay: boolean;
  location: string | null;
  scope: string; // PERSONAL, COMPANY, VENTURE
  visibility: string;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  ventureId: string | null;
  ownerPartnerId: string;
  ownerName?: string | null;
  checklists: { id: string; title: string; isCompleted: boolean }[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon?: string | null;
}

export function CalendarClient({
  initialEntries,
  categories,
  partner,
}: {
  initialEntries: CalendarEntry[];
  categories: Category[];
  partner: PortalPartner;
}) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries);
  const [view, setView] = useState<"MONTH" | "WEEK" | "DAY" | "AGENDA">("MONTH");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedScope, setSelectedScope] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Note / Event Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("NOTE");
  const [formScope, setFormScope] = useState("COMPANY");
  const [formVentureId, setFormVentureId] = useState("");
  const [formCatId, setFormCatId] = useState(categories[0]?.id || "");
  const [formPriority, setFormPriority] = useState("MEDIUM");
  const [formStartDate, setFormStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [formChecklists, setFormChecklists] = useState<string[]>([""]);

  // Date Navigation handlers
  const handlePrev = () => {
    if (view === "MONTH") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "WEEK") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const handleNext = () => {
    if (view === "MONTH") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "WEEK") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  // Filter entries
  const filteredEntries = entries.filter((e) => {
    if (selectedScope !== "ALL" && e.scope !== selectedScope) return false;
    if (selectedCategory !== "ALL" && e.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchDesc = e.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Toggle checklist
  const handleToggleChecklist = async (checklistItemId: string) => {
    try {
      const res = await fetch("/api/calendar/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItemId }),
      });
      if (res.ok) {
        setEntries((prev) =>
          prev.map((entry) => ({
            ...entry,
            checklists: entry.checklists.map((c) =>
              c.id === checklistItemId ? { ...c, isCompleted: !c.isCompleted } : c
            ),
          }))
        );
      }
    } catch (err) {
      console.error("Toggle checklist failed", err);
    }
  };

  // Submit new calendar note / entry
  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setIsSubmitting(true);

    try {
      const validChecklists = formChecklists
        .filter((c) => c.trim().length > 0)
        .map((title) => ({ title, isCompleted: false }));

      const payload = {
        title: formTitle,
        description: formDesc,
        entryType: formType,
        scope: formScope,
        ventureId: formScope === "VENTURE" ? formVentureId : undefined,
        categoryId: formCatId,
        priority: formPriority,
        startDate: new Date(formStartDate).toISOString(),
        checklists: validChecklists,
      };

      const res = await fetch("/api/calendar/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create note");
      }

      const data = await res.json();
      setEntries((prev) => [data.entry, ...prev]);

      // Reset form & close
      setFormTitle("");
      setFormDesc("");
      setFormChecklists([""]);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to save calendar entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Printable Planner Trigger
  const handlePrint = () => {
    window.print();
  };

  // Month days computation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 6 }); // Saturday start in BD
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 6 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week days computation
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 6 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 6 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      {/* Top Calendar Toolbar */}
      <div className="no-print pb-3 border-b border-afk-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
            <span>Shared Executive Calendar</span>
            <span className="text-xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-gold font-mono">
              {format(currentDate, "MMMM yyyy")}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
            Personal notes, partner governance meetings, production milestones & venture tasks
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Print Planner Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-xs font-semibold shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5 text-afk-gold" />
            <span>Print Planner</span>
          </button>

          {/* New Note / Task Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Note / Task</span>
          </button>
        </div>
      </div>

      {/* View Switcher, Search, Scope & Navigation Controls */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-afk-card p-3 rounded-xl border border-afk-border">
        {/* Date Navigation & View Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs rounded-md bg-afk-surface border border-afk-border text-afk-secondary hover:text-afk-offwhite transition font-medium"
          >
            Today
          </button>

          <div className="flex items-center">
            <button
              onClick={handlePrev}
              className="p-1 rounded-l-md bg-afk-surface border border-afk-border text-afk-secondary hover:text-afk-offwhite"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded-r-md bg-afk-surface border-y border-r border-afk-border text-afk-secondary hover:text-afk-offwhite"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs font-bold text-afk-offwhite px-2">
            {view === "MONTH" && format(currentDate, "MMMM yyyy")}
            {view === "WEEK" &&
              `${format(weekStart, "dd MMM")} – ${format(weekEnd, "dd MMM yyyy")}`}
            {view === "DAY" && format(currentDate, "EEEE, dd MMMM yyyy")}
            {view === "AGENDA" && "All Scheduled Activities"}
          </span>
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center gap-1 bg-afk-surface p-1 rounded-lg border border-afk-border self-start lg:self-auto">
          {(["MONTH", "WEEK", "DAY", "AGENDA"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded text-2xs font-semibold uppercase tracking-wider transition ${
                view === v
                  ? "bg-afk-card text-afk-offwhite shadow-sm"
                  : "text-afk-muted hover:text-afk-secondary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Scope and Category Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Selector */}
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="bg-afk-surface border border-afk-border rounded-md px-2.5 py-1 text-xs text-afk-offwhite focus:outline-none"
          >
            <option value="ALL">All Scopes</option>
            <option value="COMPANY">Company Shared</option>
            <option value="PERSONAL">My Personal Notes</option>
            <option value="VENTURE">Venture Specific</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-afk-muted" />
            <input
              type="text"
              placeholder="Search calendar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-afk-surface border border-afk-border rounded-md pl-8 pr-2.5 py-1 text-xs text-afk-offwhite placeholder:text-afk-subtle focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* PRINT PLANNER HEADER (Only visible when printing A4) */}
      <div className="hidden print-only print-container mb-6 pb-3 border-b-2 border-black">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-black uppercase tracking-wider">
              AFK THEORY — Business Planner
            </h1>
            <p className="text-xs text-gray-700">
              Executive Calendar & Note Schedule • Printed for {partner.name} on {formatDate(new Date())}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-black">
              {format(currentDate, "MMMM yyyy")}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW: MONTH VIEW */}
      {view === "MONTH" && (
        <div className="bg-afk-card rounded-xl border border-afk-border overflow-hidden shadow-sm">
          {/* Weekday headers (Sat to Fri) */}
          <div className="grid grid-cols-7 border-b border-afk-border bg-afk-surface/60 text-center text-2xs font-semibold text-afk-secondary py-2">
            <span>Sat</span>
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-afk-border min-h-[500px]">
            {monthDays.map((day, idx) => {
              const dayEntries = filteredEntries.filter((e) =>
                isSameDay(new Date(e.startDate), day)
              );
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={idx}
                  className={`p-1.5 sm:p-2 min-h-[90px] flex flex-col justify-between transition ${
                    isCurrentMonth ? "bg-afk-card" : "bg-afk-black/40 text-afk-subtle"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        isToday
                          ? "bg-afk-olive text-afk-offwhite font-bold"
                          : isCurrentMonth
                          ? "text-afk-offwhite"
                          : "text-afk-muted"
                      }`}
                    >
                      {format(day, "d")}
                    </span>

                    {dayEntries.length > 0 && (
                      <span className="text-2xs text-afk-muted hidden sm:inline">
                        {dayEntries.length} items
                      </span>
                    )}
                  </div>

                  {/* Day Entry Pills */}
                  <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                    {dayEntries.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className="px-1.5 py-0.5 rounded text-2xs truncate flex items-center gap-1 border border-afk-border cursor-pointer hover:border-afk-olive transition"
                        style={{
                          backgroundColor: `${e.categoryColor || "#5A7352"}22`,
                          color: e.categoryColor || "#F4F5F1",
                        }}
                        title={`${e.title} (${e.entryType}) - ${formatDateTime(e.startDate)}`}
                      >
                        {e.scope === "PERSONAL" ? (
                          <Lock className="w-2.5 h-2.5 shrink-0" />
                        ) : e.scope === "VENTURE" ? (
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                        ) : null}
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEntries.length > 3 && (
                      <span className="text-2xs text-afk-muted font-medium pl-1 block">
                        +{dayEntries.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: WEEK VIEW */}
      {view === "WEEK" && (
        <div className="bg-afk-card rounded-xl border border-afk-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-afk-border bg-afk-surface/60 text-center py-2">
            {weekDays.map((day, idx) => (
              <div key={idx} className="space-y-0.5">
                <span className="text-2xs font-semibold text-afk-secondary uppercase block">
                  {format(day, "EEE")}
                </span>
                <span
                  className={`text-xs font-bold inline-block px-2 py-0.5 rounded-full ${
                    isSameDay(day, new Date())
                      ? "bg-afk-olive text-afk-offwhite"
                      : "text-afk-offwhite"
                  }`}
                >
                  {format(day, "dd MMM")}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-afk-border min-h-[450px]">
            {weekDays.map((day, idx) => {
              const dayEntries = filteredEntries.filter((e) =>
                isSameDay(new Date(e.startDate), day)
              );

              return (
                <div key={idx} className="p-2 space-y-2">
                  {dayEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-2 rounded-lg bg-afk-surface border border-afk-border space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${e.categoryColor || "#5A7352"}33`,
                            color: e.categoryColor || "#F4F5F1",
                          }}
                        >
                          {e.entryType}
                        </span>
                        {e.scope === "PERSONAL" && (
                          <Lock className="w-3 h-3 text-afk-gold" />
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-afk-offwhite leading-tight">
                        {e.title}
                      </h4>
                      {e.description && (
                        <p className="text-2xs text-afk-secondary line-clamp-2">
                          {e.description}
                        </p>
                      )}
                      {e.checklists && e.checklists.length > 0 && (
                        <div className="pt-1 border-t border-afk-border/50 space-y-1">
                          {e.checklists.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-1.5 text-2xs cursor-pointer text-afk-muted hover:text-afk-offwhite"
                            >
                              <input
                                type="checkbox"
                                checked={c.isCompleted}
                                onChange={() => handleToggleChecklist(c.id)}
                                className="rounded bg-afk-black border-afk-border text-afk-olive w-3 h-3"
                              />
                              <span className={c.isCompleted ? "line-through text-afk-subtle" : ""}>
                                {c.title}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: DAY VIEW */}
      {view === "DAY" && (
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-afk-border">
            <h3 className="text-base font-bold text-afk-offwhite">
              Daily Planner: {format(currentDate, "EEEE, dd MMMM yyyy")}
            </h3>
            <span className="text-xs text-afk-muted">
              {filteredEntries.filter((e) => isSameDay(new Date(e.startDate), currentDate)).length} items scheduled
            </span>
          </div>

          <div className="space-y-3">
            {filteredEntries
              .filter((e) => isSameDay(new Date(e.startDate), currentDate))
              .map((e) => (
                <div
                  key={e.id}
                  className="p-4 rounded-xl bg-afk-surface border border-afk-border flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-2xs px-2 py-0.5 rounded font-semibold uppercase"
                        style={{
                          backgroundColor: `${e.categoryColor || "#5A7352"}33`,
                          color: e.categoryColor || "#F4F5F1",
                        }}
                      >
                        {e.entryType}
                      </span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-afk-black border border-afk-border text-afk-secondary">
                        Scope: {e.scope}
                      </span>
                      <span className="text-xs font-mono text-afk-muted">
                        {format(new Date(e.startDate), "hh:mm a")}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-afk-offwhite">
                      {e.title}
                    </h4>

                    {e.description && (
                      <p className="text-xs text-afk-secondary leading-relaxed">
                        {e.description}
                      </p>
                    )}

                    {e.checklists && e.checklists.length > 0 && (
                      <div className="pt-2 border-t border-afk-border space-y-1.5">
                        <span className="text-2xs font-semibold text-afk-muted uppercase block">
                          Checklist:
                        </span>
                        {e.checklists.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleToggleChecklist(c.id)}
                            className="flex items-center gap-2 text-xs cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={c.isCompleted}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded bg-afk-black border-afk-border text-afk-olive"
                            />
                            <span
                              className={
                                c.isCompleted
                                  ? "line-through text-afk-subtle"
                                  : "text-afk-offwhite group-hover:text-afk-gold transition"
                              }
                            >
                              {c.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* VIEW: AGENDA VIEW */}
      {view === "AGENDA" && (
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-afk-offwhite pb-3 border-b border-afk-border">
            Agenda: All Active Notes, Meetings & Tasks
          </h3>

          <div className="divide-y divide-afk-border">
            {filteredEntries.map((e) => (
              <div key={e.id} className="py-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${e.categoryColor || "#5A7352"}33`,
                        color: e.categoryColor || "#F4F5F1",
                      }}
                    >
                      {e.entryType}
                    </span>
                    <span className="text-xs font-bold text-afk-offwhite">
                      {e.title}
                    </span>
                    {e.scope === "PERSONAL" && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800">
                        Private Note
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <p className="text-xs text-afk-secondary">{e.description}</p>
                  )}
                </div>

                <div className="text-right text-xs shrink-0">
                  <span className="text-afk-offwhite font-mono">
                    {formatDate(e.startDate)}
                  </span>
                  <p className="text-2xs text-afk-muted">
                    {format(new Date(e.startDate), "hh:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW NOTE / TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-afk-black/80 backdrop-blur-sm">
          <div className="bg-afk-card w-full max-w-lg rounded-2xl border border-afk-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-afk-border">
              <h3 className="text-base font-bold text-afk-offwhite">
                Create Partner Calendar Entry
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-afk-muted hover:text-afk-offwhite"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-afk-secondary mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Partner Strategy Review / Fabric Sample Fitting"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-afk-secondary mb-1">
                    Entry Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="NOTE">Note</option>
                    <option value="TASK">Task / To-Do</option>
                    <option value="MEETING">Meeting</option>
                    <option value="DEADLINE">Deadline</option>
                    <option value="REMINDER">Reminder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-afk-secondary mb-1">
                    Privacy / Scope
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="COMPANY">Company Shared (All Partners)</option>
                    <option value="PERSONAL">Personal Note (Only Me)</option>
                    <option value="VENTURE">Venture Specific</option>
                  </select>
                </div>
              </div>

              {formScope === "VENTURE" && (
                <div>
                  <label className="block text-xs font-medium text-afk-secondary mb-1">
                    Permitted Venture Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VENT-2026-0001"
                    value={formVentureId}
                    onChange={(e) => setFormVentureId(e.target.value)}
                    className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-afk-secondary mb-1">
                    Category
                  </label>
                  <select
                    value={formCatId}
                    onChange={(e) => setFormCatId(e.target.value)}
                    className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-afk-secondary mb-1">
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-afk-secondary mb-1">
                  Description / Meeting Agenda
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes, links, or bullet points..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-afk-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-afk-surface border border-afk-border text-xs text-afk-secondary hover:text-afk-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
