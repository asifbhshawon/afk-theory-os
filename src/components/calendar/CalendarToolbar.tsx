"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Printer,
  Filter,
  Search,
  Check,
  Tag,
  Layers,
} from "lucide-react";
import { format } from "date-fns";

export type CalendarViewMode = "MONTH" | "WEEK" | "DAY" | "AGENDA";

interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
}

interface CalendarToolbarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  categories: Category[];
  selectedCategoryIds: string[];
  onCategoryToggle: (categoryId: string) => void;
  selectedScope: string;
  onScopeChange: (scope: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewEntry: (date?: Date) => void;
  onOpenPrintModal: () => void;
  onManageCategories: () => void;
}

export function CalendarToolbar({
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  categories,
  selectedCategoryIds,
  onCategoryToggle,
  selectedScope,
  onScopeChange,
  searchQuery,
  onSearchChange,
  onNewEntry,
  onOpenPrintModal,
  onManageCategories,
}: CalendarToolbarProps) {
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isYearMonthOpen, setIsYearMonthOpen] = useState(false);

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "MONTH") next.setMonth(next.getMonth() - 1);
    else if (viewMode === "WEEK") next.setDate(next.getDate() - 7);
    else if (viewMode === "DAY") next.setDate(next.getDate() - 1);
    else next.setMonth(next.getMonth() - 1);
    onDateChange(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "MONTH") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "WEEK") next.setDate(next.getDate() + 7);
    else if (viewMode === "DAY") next.setDate(next.getDate() + 1);
    else next.setMonth(next.getMonth() + 1);
    onDateChange(next);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = currentDate.getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="bg-afk-card border border-afk-border rounded-xl p-3 md:p-4 space-y-3 shadow-md select-none">
      {/* Top Bar: Navigation, Title & Views */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation & Date Display */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center rounded-lg bg-afk-surface border border-afk-border p-0.5">
            <button
              onClick={handlePrev}
              title="Previous"
              className="p-1.5 rounded-md text-afk-secondary hover:text-afk-offwhite hover:bg-afk-elevated transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-afk-secondary hover:text-afk-offwhite hover:bg-afk-elevated rounded-md transition cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              title="Next"
              className="p-1.5 rounded-md text-afk-secondary hover:text-afk-offwhite hover:bg-afk-elevated transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Month & Year Jump Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsYearMonthOpen(!isYearMonthOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-sm md:text-base font-bold transition cursor-pointer"
            >
              <CalendarIcon className="w-4 h-4 text-afk-olive-accent" />
              <span>{format(currentDate, "MMMM yyyy")}</span>
            </button>

            {isYearMonthOpen && (
              <div className="absolute left-0 mt-2 p-3 bg-afk-elevated border border-afk-border rounded-xl shadow-2xl z-50 w-64 animate-in fade-in duration-100">
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-afk-border text-xs font-semibold text-afk-muted">
                  <span>Select Month & Year</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {months.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => {
                        const next = new Date(currentDate);
                        next.setMonth(idx);
                        onDateChange(next);
                      }}
                      className={`px-2 py-1 text-xs rounded transition text-center ${
                        currentDate.getMonth() === idx
                          ? "bg-afk-olive text-afk-offwhite font-bold"
                          : "text-afk-secondary hover:bg-afk-surface hover:text-afk-offwhite"
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => {
                        const next = new Date(currentDate);
                        next.setFullYear(y);
                        onDateChange(next);
                        setIsYearMonthOpen(false);
                      }}
                      className={`px-2 py-1 text-xs rounded transition shrink-0 ${
                        currentDate.getFullYear() === y
                          ? "bg-afk-olive text-afk-offwhite font-bold"
                          : "text-afk-secondary hover:bg-afk-surface hover:text-afk-offwhite"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center rounded-lg bg-afk-surface border border-afk-border p-0.5">
            {(["MONTH", "WEEK", "DAY", "AGENDA"] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer capitalize ${
                  viewMode === mode
                    ? "bg-afk-card text-afk-offwhite shadow-sm border border-afk-border-strong"
                    : "text-afk-muted hover:text-afk-secondary"
                }`}
              >
                {mode.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <button
            onClick={onOpenPrintModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-secondary hover:text-afk-offwhite text-xs font-medium transition cursor-pointer"
            title="Print Daily, Weekly, or Monthly Planner"
          >
            <Printer className="w-3.5 h-3.5 text-afk-secondary" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          <button
            onClick={() => onNewEntry()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Activity</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="pt-2 border-t border-afk-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Category & Scope Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs text-afk-secondary hover:text-afk-offwhite transition cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-afk-olive-accent" />
              <span>
                Categories{" "}
                {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
              </span>
            </button>

            {isCategoryDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-afk-elevated border border-afk-border rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-100">
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-afk-border/80">
                  <span className="text-xs font-bold text-afk-muted">Filter Categories</span>
                  <button
                    onClick={onManageCategories}
                    className="text-[11px] text-afk-olive-accent hover:underline cursor-pointer"
                  >
                    Edit Categories
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 p-1">
                  {categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        onClick={() => onCategoryToggle(cat.id)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-afk-surface cursor-pointer text-xs transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-afk-offwhite truncate">{cat.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-afk-olive-accent" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Scope Filter Pills */}
          <div className="flex items-center rounded-lg bg-afk-surface border border-afk-border p-0.5 text-xs">
            {["ALL", "COMPANY", "VENTURE", "PERSONAL"].map((scope) => (
              <button
                key={scope}
                onClick={() => onScopeChange(scope)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer capitalize ${
                  selectedScope === scope
                    ? "bg-afk-card text-afk-offwhite font-bold"
                    : "text-afk-muted hover:text-afk-secondary"
                }`}
              >
                {scope.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Search */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-afk-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search activities or notes..."
            className="w-full bg-afk-surface border border-afk-border rounded-lg pl-8 pr-3 py-1 text-xs text-afk-offwhite placeholder:text-afk-muted focus:outline-none focus:border-afk-olive-accent"
          />
        </div>
      </div>
    </div>
  );
}
