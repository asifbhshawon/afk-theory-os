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
  HardDrive,
  Cloud,
  User,
  Sparkles,
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
  origin?: string | null;
  checklists: { id: string; title: string; isCompleted: boolean }[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon?: string | null;
}

const PARTNER_OPTIONS = [
  { id: "ALL", name: "All Authors" },
  { id: "partner-shawon", name: "Shawon" },
  { id: "partner-rafi", name: "Rafi" },
  { id: "partner-tousif", name: "Tousif" },
  { id: "partner-midhat", name: "Midhat" },
  { id: "partner-mueid", name: "Mueid" },
];

function renderInlineStyles(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-afk-offwhite">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <span key={i} className="font-semibold text-afk-gold">
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

function FormattedNoteText({ text }: { text: string | null | undefined }) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs text-afk-offwhite leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Blockquote
        if (trimmed.startsWith(">")) {
          const quoteContent = trimmed.replace(/^>\s*/, "");
          return (
            <div
              key={idx}
              className="pl-3 py-1.5 border-l-2 border-afk-gold/80 bg-afk-surface/60 rounded-r text-afk-gold font-medium italic"
            >
              {renderInlineStyles(quoteContent)}
            </div>
          );
        }

        // Heading 1
        if (trimmed.startsWith("# ")) {
          return (
            <h4 key={idx} className="text-sm font-bold text-afk-offwhite tracking-tight mt-1 border-b border-afk-border/50 pb-1">
              {renderInlineStyles(trimmed.slice(2))}
            </h4>
          );
        }

        // Heading 2
        if (trimmed.startsWith("## ")) {
          return (
            <h5 key={idx} className="text-xs font-bold text-afk-gold tracking-tight mt-1">
              {renderInlineStyles(trimmed.slice(3))}
            </h5>
          );
        }

        // Bullet list
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-afk-olive-accent mt-1.5 shrink-0" />
              <span>{renderInlineStyles(trimmed.slice(2))}</span>
            </div>
          );
        }

        return <p key={idx}>{renderInlineStyles(line)}</p>;
      })}
    </div>
  );
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
  const [selectedAuthor, setSelectedAuthor] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<CalendarEntry | null>(null);

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
    if (selectedAuthor !== "ALL" && e.ownerPartnerId !== selectedAuthor) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchOwner = e.ownerName?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchOwner) return false;
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
        if (viewingEntry) {
          setViewingEntry((prev) =>
            prev
              ? {
                  ...prev,
                  checklists: prev.checklists.map((c) =>
                    c.id === checklistItemId ? { ...c, isCompleted: !c.isCompleted } : c
                  ),
                }
              : null
          );
        }
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
      const matchedCat = categories.find((c) => c.id === formCatId);
      const newEntry: CalendarEntry = {
        ...data.entry,
        ownerName: partner.name,
        categoryName: matchedCat?.name || "General",
        categoryColor: matchedCat?.color || "#5A7352",
        categoryIcon: matchedCat?.icon || "Calendar",
        origin: "PORTAL",
        checklists: data.entry.checklists || [],
      };

      setEntries((prev) => [newEntry, ...prev]);

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
            Transparent shared notes, production milestones, partner decisions & local entries for all partners
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
        <div className="flex items-center gap-2 flex-wrap">
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
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded-r-md bg-afk-surface border-y border-r border-afk-border text-afk-secondary hover:text-afk-offwhite"
              title="Next"
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

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Author Selector */}
          <select
            value={selectedAuthor}
            onChange={(e) => setSelectedAuthor(e.target.value)}
            className="bg-afk-surface border border-afk-border rounded-md px-2 py-1 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
          >
            {PARTNER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>

          {/* Scope Selector */}
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="bg-afk-surface border border-afk-border rounded-md px-2 py-1 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
          >
            <option value="ALL">All Scopes</option>
            <option value="COMPANY">Company Shared</option>
            <option value="PERSONAL">Personal Notes</option>
            <option value="VENTURE">Venture Specific</option>
          </select>

          {/* Category Selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-afk-surface border border-afk-border rounded-md px-2 py-1 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-afk-muted" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-afk-surface border border-afk-border rounded-md pl-8 pr-2.5 py-1 text-xs text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* Author Transparency Info Pill */}
      <div className="no-print px-4 py-2.5 rounded-lg bg-afk-surface/60 border border-afk-border flex items-center justify-between text-xs text-afk-secondary">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-afk-gold" />
          <span>
            Showing <strong className="text-afk-offwhite">{filteredEntries.length}</strong> active notes & schedule entries viewable by all founding partners.
          </span>
        </div>
        <div className="flex items-center gap-3 text-2xs text-afk-muted hidden sm:flex">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-emerald-400" /> Local ERP
          </span>
          <span className="flex items-center gap-1">
            <Cloud className="w-3 h-3 text-blue-400" /> Cloud Portal
          </span>
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
                  className={`p-1.5 sm:p-2 min-h-[95px] flex flex-col justify-between transition ${
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
                        onClick={() => setViewingEntry(e)}
                        className="px-1.5 py-1 rounded text-2xs truncate flex items-center justify-between gap-1 border border-afk-border cursor-pointer hover:border-afk-gold hover:shadow transition group"
                        style={{
                          backgroundColor: `${e.categoryColor || "#5A7352"}22`,
                          color: e.categoryColor || "#F4F5F1",
                        }}
                        title={`${e.title} (${e.entryType}) • By ${e.ownerName || "Partner"} • Click to view full details`}
                      >
                        <div className="flex items-center gap-1 truncate">
                          {e.origin === "LOCAL_ERP" ? (
                            <HardDrive className="w-2.5 h-2.5 shrink-0 text-emerald-400" />
                          ) : (
                            <Cloud className="w-2.5 h-2.5 shrink-0 text-blue-400" />
                          )}
                          <span className="truncate font-medium">{e.title}</span>
                        </div>
                        <span className="text-3xs px-1 rounded bg-black/40 text-afk-gold font-mono shrink-0">
                          {e.ownerName || "Shawon"}
                        </span>
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
                  {format(day, "d MMM")}
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
                <div key={idx} className="p-2 space-y-2 bg-afk-card">
                  {dayEntries.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => setViewingEntry(e)}
                      className="p-2 rounded-lg border border-afk-border hover:border-afk-gold cursor-pointer transition space-y-1.5"
                      style={{
                        backgroundColor: `${e.categoryColor || "#5A7352"}15`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-3xs px-1.5 py-0.2 rounded font-semibold uppercase"
                          style={{
                            backgroundColor: `${e.categoryColor || "#5A7352"}44`,
                            color: e.categoryColor || "#F4F5F1",
                          }}
                        >
                          {e.entryType}
                        </span>
                        <span className="text-3xs text-afk-gold font-mono flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" />
                          {e.ownerName || "Shawon"}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-afk-offwhite leading-tight">
                        {e.title}
                      </h4>

                      {e.description && (
                        <p className="text-3xs text-afk-secondary line-clamp-2">
                          {e.description.replace(/[#>*-]/g, "").trim()}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-afk-border/40 text-3xs text-afk-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(e.startDate), "hh:mm a")}
                        </span>
                        {e.origin === "LOCAL_ERP" ? (
                          <span className="text-emerald-400 font-mono">Local</span>
                        ) : (
                          <span className="text-blue-400 font-mono">Cloud</span>
                        )}
                      </div>
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
                  onClick={() => setViewingEntry(e)}
                  className="p-4 rounded-xl bg-afk-surface border border-afk-border hover:border-afk-gold transition cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-2xs px-2 py-0.5 rounded font-semibold uppercase"
                        style={{
                          backgroundColor: `${e.categoryColor || "#5A7352"}33`,
                          color: e.categoryColor || "#F4F5F1",
                        }}
                      >
                        {e.entryType}
                      </span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-afk-card border border-afk-border text-afk-gold font-medium flex items-center gap-1">
                        <User className="w-3 h-3" />
                        By: {e.ownerName || "Shawon"}
                      </span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-afk-black border border-afk-border text-afk-secondary">
                        Scope: {e.scope}
                      </span>
                      {e.origin === "LOCAL_ERP" && (
                        <span className="text-2xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
                          <HardDrive className="w-3 h-3" /> Local ERP
                        </span>
                      )}
                      <span className="text-xs font-mono text-afk-muted">
                        {format(new Date(e.startDate), "hh:mm a")}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-afk-offwhite">
                      {e.title}
                    </h4>

                    {e.description && (
                      <div className="p-3 rounded-lg bg-afk-card border border-afk-border/70">
                        <FormattedNoteText text={e.description} />
                      </div>
                    )}

                    {e.checklists && e.checklists.length > 0 && (
                      <div className="pt-2 border-t border-afk-border space-y-1.5">
                        <span className="text-2xs font-semibold text-afk-muted uppercase block">
                          Checklist:
                        </span>
                        {e.checklists.map((c) => (
                          <div
                            key={c.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleToggleChecklist(c.id);
                            }}
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
              <div
                key={e.id}
                onClick={() => setViewingEntry(e)}
                className="py-3 flex items-start justify-between gap-4 hover:bg-afk-surface/40 p-2 rounded-lg cursor-pointer transition"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
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
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-afk-card border border-afk-border text-afk-gold font-mono flex items-center gap-1">
                      <User className="w-2.5 h-2.5" />
                      {e.ownerName || "Shawon"}
                    </span>
                    {e.origin === "LOCAL_ERP" && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
                        <HardDrive className="w-2.5 h-2.5" /> Local ERP
                      </span>
                    )}
                    {e.scope === "PERSONAL" && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800">
                        Personal Note
                      </span>
                    )}
                  </div>

                  {e.description && (
                    <div className="text-xs text-afk-secondary">
                      <FormattedNoteText text={e.description} />
                    </div>
                  )}
                </div>

                <div className="text-right text-xs shrink-0 pl-2">
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

      {/* NOTE DETAIL MODAL (Opens when clicking any note) */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-afk-black/80 backdrop-blur-sm">
          <div className="bg-afk-card w-full max-w-xl rounded-2xl border border-afk-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div
              className="p-5 border-b border-afk-border flex items-start justify-between gap-4"
              style={{
                borderTop: `4px solid ${viewingEntry.categoryColor || "#5A7352"}`,
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-2xs px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${viewingEntry.categoryColor || "#5A7352"}33`,
                      color: viewingEntry.categoryColor || "#F4F5F1",
                    }}
                  >
                    {viewingEntry.categoryName || viewingEntry.entryType}
                  </span>
                  <span className="text-2xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary">
                    {viewingEntry.scope}
                  </span>
                  {viewingEntry.origin === "LOCAL_ERP" ? (
                    <span className="text-2xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
                      <HardDrive className="w-3 h-3" /> Provided Locally from AFK ERP
                    </span>
                  ) : (
                    <span className="text-2xs px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800 flex items-center gap-1 font-mono">
                      <Cloud className="w-3 h-3" /> Cloud Partner Portal
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-afk-offwhite leading-tight">
                  {viewingEntry.title}
                </h3>
              </div>

              <button
                onClick={() => setViewingEntry(null)}
                className="p-1 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Author & Timestamp meta card */}
              <div className="p-3 rounded-xl bg-afk-surface border border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-afk-olive/30 border border-afk-olive flex items-center justify-center font-bold text-xs text-afk-gold">
                    {viewingEntry.ownerName ? viewingEntry.ownerName.charAt(0) : "P"}
                  </div>
                  <div>
                    <span className="font-semibold text-afk-offwhite block">
                      Author: {viewingEntry.ownerName || "Founding Partner"}
                    </span>
                    <span className="text-2xs text-afk-muted">
                      Shared transparently with all founding partners
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right font-mono text-2xs text-afk-secondary">
                  <span>Scheduled: {formatDate(viewingEntry.startDate)}</span>
                  <span className="block text-afk-muted">{format(new Date(viewingEntry.startDate), "hh:mm a")}</span>
                </div>
              </div>

              {/* Note Description / Body */}
              <div>
                <h4 className="text-2xs font-semibold text-afk-muted uppercase tracking-wider mb-2">
                  Note Details & Specifications
                </h4>
                <div className="p-4 rounded-xl bg-afk-surface/80 border border-afk-border">
                  <FormattedNoteText text={viewingEntry.description || "No description text provided."} />
                </div>
              </div>

              {/* Checklists */}
              {viewingEntry.checklists && viewingEntry.checklists.length > 0 && (
                <div>
                  <h4 className="text-2xs font-semibold text-afk-muted uppercase tracking-wider mb-2">
                    Action Checklist
                  </h4>
                  <div className="p-3 rounded-xl bg-afk-surface border border-afk-border space-y-2">
                    {viewingEntry.checklists.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleToggleChecklist(c.id)}
                        className="flex items-center gap-2.5 text-xs cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={c.isCompleted}
                          onChange={() => {}}
                          className="w-4 h-4 rounded bg-afk-black border-afk-border text-afk-olive focus:ring-0"
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
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-afk-border bg-afk-surface/40 flex items-center justify-between">
              <span className="text-2xs text-afk-muted">
                Note ID: <code className="font-mono text-afk-secondary">{viewingEntry.id.slice(0, 8)}</code>
              </span>
              <button
                onClick={() => setViewingEntry(null)}
                className="px-4 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs font-semibold text-afk-offwhite transition"
              >
                Close View
              </button>
            </div>
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
                  placeholder="e.g. Fabric To Production / About Cutting / Sample Fitting"
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
                    Scope
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="COMPANY">Company Shared (All Partners)</option>
                    <option value="PERSONAL">Personal Note (Viewable by All)</option>
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
                    Scheduled Date & Time *
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
                  Description & Specifications (Markdown supported: # Headings, &gt; Quotes, *bullets*)
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. # Fabric Specifications&#10;> Provided Rib Fabric - 200KG&#10;Expected cutting date *Saturday, 31-Oct-26*"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive resize-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-afk-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-xs text-afk-secondary hover:text-afk-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Note / Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
