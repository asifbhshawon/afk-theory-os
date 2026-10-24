"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Printer,
  Download,
  Calendar,
  Check,
  FileText,
  Eye,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { PrintableCalendarView } from "@/components/calendar/PrintableCalendarView";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  entries: any[];
  categories: any[];
}

export function PrintConfigModal({
  isOpen,
  onClose,
  currentDate,
  entries,
  categories,
}: PrintConfigModalProps) {
  const [formatType, setFormatType] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeExtraNotesSpace, setIncludeExtraNotesSpace] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const element = previewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#FFFFFF",
      });

      const imgData = canvas.toDataURL("image/png");
      const isLandscape = formatType === "WEEKLY" || formatType === "MONTHLY";
      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = isLandscape ? 297 : 210;
      const pdfHeight = isLandscape ? 210 : 297;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`AFK-Planner-${formatType.toLowerCase()}-${format(selectedDate, "yyyy-MM-dd")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. You can use Print -> Save as PDF as a direct alternative.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none overflow-y-auto">
      <div
        className="w-full max-w-6xl bg-afk-card border border-afk-border rounded-2xl shadow-2xl flex flex-col my-auto max-h-[96vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-afk-border flex items-center justify-between bg-afk-surface/70 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-afk-secondary hover:text-afk-offwhite hover:bg-afk-elevated transition"
              title="Back to Calendar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base font-bold text-afk-offwhite flex items-center gap-2">
                <Printer className="w-5 h-5 text-afk-olive-accent" />
                <span>Printable Business Planner & PDF Export</span>
              </h2>
              <p className="text-xs text-afk-muted mt-0.5">
                Generate true A4 formatted daily agendas, weekly roadmaps, and monthly calendar sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-afk-olive-accent" />
              ) : (
                <Download className="w-4 h-4 text-afk-olive-accent" />
              )}
              <span>Download PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-elevated transition cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Configuration Panel */}
          <div className="w-full lg:w-80 p-5 border-b lg:border-b-0 lg:border-r border-afk-border bg-afk-surface/40 space-y-5 overflow-y-auto no-print">
            {/* Format Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-afk-secondary mb-2">
                Planner Format
              </label>
              <div className="space-y-1.5">
                {[
                  {
                    type: "DAILY",
                    label: "Daily Business Planner",
                    desc: "A4 Portrait · Schedule, tasks, deadlines & notes",
                  },
                  {
                    type: "WEEKLY",
                    label: "Weekly Planner",
                    desc: "A4 Landscape · 7-day spread & milestones",
                  },
                  {
                    type: "MONTHLY",
                    label: "Monthly Drop Calendar",
                    desc: "A4 Landscape · Complete 35-day grid",
                  },
                ].map((fmt) => (
                  <div
                    key={fmt.type}
                    onClick={() => setFormatType(fmt.type as any)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      formatType === fmt.type
                        ? "bg-afk-olive/20 border-afk-olive text-afk-offwhite shadow-sm"
                        : "bg-afk-surface border-afk-border text-afk-secondary hover:bg-afk-elevated"
                    }`}
                  >
                    <p className="text-xs font-bold">{fmt.label}</p>
                    <p className="text-[11px] text-afk-muted mt-0.5">{fmt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Date Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-afk-secondary mb-1.5">
                Selected Date
              </label>
              <input
                type="date"
                value={format(selectedDate, "yyyy-MM-dd")}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(new Date(e.target.value));
                  }
                }}
                className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-2 text-xs text-afk-offwhite"
              />
            </div>

            {/* Content Filters */}
            <div className="space-y-2.5 pt-2 border-t border-afk-border">
              <label className="block text-xs font-bold uppercase tracking-wider text-afk-secondary mb-1">
                Include in Output
              </label>

              <label className="flex items-center gap-2 text-xs text-afk-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTasks}
                  onChange={(e) => setIncludeTasks(e.target.checked)}
                  className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                />
                <span>Action tasks & checklists</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-afk-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                />
                <span>Business notes & minutes</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-afk-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                />
                <span>Completed task records</span>
              </label>

              {formatType === "DAILY" && (
                <label className="flex items-center gap-2 text-xs text-afk-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExtraNotesSpace}
                    onChange={(e) => setIncludeExtraNotesSpace(e.target.checked)}
                    className="rounded bg-afk-surface border-afk-border text-afk-olive focus:ring-0"
                  />
                  <span>Lined space for handwritten notes</span>
                </label>
              )}
            </div>
          </div>

          {/* Right Live Preview Area */}
          <div className="flex-1 bg-neutral-900/50 p-4 md:p-8 overflow-y-auto flex items-start justify-center">
            <div
              ref={previewRef}
              className="bg-white rounded-lg shadow-2xl transition-all scale-[0.85] sm:scale-100 origin-top"
            >
              <PrintableCalendarView
                formatType={formatType}
                targetDate={selectedDate}
                entries={entries}
                categories={categories}
                includeNotes={includeNotes}
                includeTasks={includeTasks}
                includeCompleted={includeCompleted}
                includeExtraNotesSpace={includeExtraNotesSpace}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
