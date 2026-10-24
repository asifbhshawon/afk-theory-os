"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarToolbar,
  CalendarViewMode,
} from "@/components/calendar/CalendarToolbar";
import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { AgendaView } from "@/components/calendar/AgendaView";
import { EntryModal } from "@/components/calendar/EntryModal";
import { CategoryManagerModal } from "@/components/calendar/CategoryManagerModal";
import { PrintConfigModal } from "@/components/calendar/PrintConfigModal";
import { Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon?: string | null;
  description?: string | null;
  isShared: boolean;
  isArchived: boolean;
  sortOrder: number;
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

interface CalendarWorkspaceClientProps {
  initialCategories: Category[];
  partners: Partner[];
  ventures: Venture[];
  currentUserId: string;
}

export function CalendarWorkspaceClient({
  initialCategories,
  partners,
  ventures,
  currentUserId,
}: CalendarWorkspaceClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("MONTH");
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<any | null>(null);
  const [newEntryDate, setNewEntryDate] = useState<Date | undefined>(undefined);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Check URL query action=new
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setIsEntryModalOpen(true);
      setEntryToEdit(null);
    }
  }, [searchParams]);

  // Load entries from server API
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategoryIds.length > 0) {
        params.set("categories", selectedCategoryIds.join(","));
      }
      if (selectedScope !== "ALL") {
        params.set("scopes", selectedScope);
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }

      const res = await fetch(`/api/calendar/entries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("Failed to load calendar entries:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategoryIds, selectedScope, searchQuery]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCategoryToggle = (catId: string) => {
    if (selectedCategoryIds.includes(catId)) {
      setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== catId));
    } else {
      setSelectedCategoryIds([...selectedCategoryIds, catId]);
    }
  };

  const handleCategoriesUpdated = async () => {
    try {
      const res = await fetch("/api/calendar/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    }
    fetchEntries();
  };

  const handleNewEntry = (date?: Date) => {
    setEntryToEdit(null);
    setNewEntryDate(date || currentDate);
    setIsEntryModalOpen(true);
  };

  const handleSelectEntry = (entry: any) => {
    setEntryToEdit(entry);
    setNewEntryDate(new Date(entry.startDate));
    setIsEntryModalOpen(true);
  };

  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
    setViewMode("DAY");
  };

  const handleToggleTaskComplete = async (entryId: string, isCompleted: boolean) => {
    try {
      // Optimistic update
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, status: isCompleted ? "COMPLETED" : "PENDING" }
            : e
        )
      );

      await fetch(`/api/calendar/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: isCompleted ? "COMPLETED" : "PENDING",
        }),
      });
      fetchEntries();
    } catch (err) {
      console.error(err);
      fetchEntries();
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Calendar Toolbar */}
      <CalendarToolbar
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onCategoryToggle={handleCategoryToggle}
        selectedScope={selectedScope}
        onScopeChange={setSelectedScope}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewEntry={handleNewEntry}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onManageCategories={() => setIsCategoryModalOpen(true)}
      />

      {/* Main View Area */}
      {isLoading ? (
        <div className="bg-afk-card border border-afk-border rounded-xl p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-afk-olive-accent" />
          <p className="text-xs text-afk-muted">Loading business calendar...</p>
        </div>
      ) : (
        <>
          {viewMode === "MONTH" && (
            <MonthView
              currentDate={currentDate}
              entries={entries}
              firstDayOfWeek={6} // Saturday
              onSelectDate={handleSelectDate}
              onSelectEntry={handleSelectEntry}
              onNewEntryForDate={handleNewEntry}
              onToggleTaskComplete={handleToggleTaskComplete}
            />
          )}

          {viewMode === "WEEK" && (
            <WeekView
              currentDate={currentDate}
              entries={entries}
              firstDayOfWeek={6}
              onSelectDate={handleSelectDate}
              onSelectEntry={handleSelectEntry}
              onNewEntryForDate={handleNewEntry}
            />
          )}

          {viewMode === "DAY" && (
            <DayView
              currentDate={currentDate}
              entries={entries}
              onSelectEntry={handleSelectEntry}
              onNewEntryForDate={handleNewEntry}
              onToggleTaskComplete={handleToggleTaskComplete}
            />
          )}

          {viewMode === "AGENDA" && (
            <AgendaView
              entries={entries}
              onSelectEntry={handleSelectEntry}
              onNewEntry={() => handleNewEntry()}
              onToggleTaskComplete={handleToggleTaskComplete}
            />
          )}
        </>
      )}

      {/* Activity / Note Modal */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        entryToEdit={entryToEdit}
        initialDate={newEntryDate}
        categories={categories}
        partners={partners}
        ventures={ventures}
        currentUserId={currentUserId}
        onSaved={fetchEntries}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onCategoriesUpdated={handleCategoriesUpdated}
      />

      {/* Printable Planner Modal */}
      <PrintConfigModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        currentDate={currentDate}
        entries={entries}
        categories={categories}
      />
    </div>
  );
}
