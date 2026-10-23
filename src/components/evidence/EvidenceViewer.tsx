"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Info,
  Loader2,
  ExternalLink,
} from "lucide-react";

export interface ViewerDocument {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | null;
  height?: number | null;
  displayTitle?: string | null;
  category: string;
  description?: string | null;
  verificationStatus: string;
  verifiedByUserId?: string | null;
  verifiedAt?: string | Date | null;
  verificationNotes?: string | null;
  module?: string;
  referenceId?: string | null;
  uploaderName?: string;
  createdAt: string | Date;
  fileHash: string;
  url?: string;
  thumbnailUrl?: string | null;
}

interface EvidenceViewerProps {
  documents: ViewerDocument[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onVerify?: (docId: string, status: "VERIFIED" | "REJECTED" | "SUPERSEDED", notes?: string) => Promise<void>;
  canVerify?: boolean;
}

export function EvidenceViewer({
  documents,
  initialIndex = 0,
  isOpen,
  onClose,
  onVerify,
  canVerify = false,
}: EvidenceViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPanActive, setIsPanActive] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);

  // Verification prompt modal state
  const [verifyAction, setVerifyAction] = useState<"VERIFIED" | "REJECTED" | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  }, [initialIndex, isOpen]);

  const currentDoc = documents[currentIndex];

  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < documents.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetTransform();
    }
  }, [currentIndex, documents.length, resetTransform]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetTransform();
    }
  }, [currentIndex, resetTransform]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in notes input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "0":
          resetTransform();
          break;
        case "r":
        case "R":
          handleRotateCw();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, resetTransform]);

  // Pan / Drag handlers when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanActive(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanActive || zoom <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanActive(false);
  };

  const copyHashToClipboard = () => {
    if (currentDoc?.fileHash) {
      navigator.clipboard.writeText(currentDoc.fileHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const submitVerification = async () => {
    if (!verifyAction || !currentDoc || !onVerify) return;
    setIsSubmittingVerify(true);
    try {
      await onVerify(currentDoc.id, verifyAction, verifyNotes);
      setVerifyAction(null);
      setVerifyNotes("");
    } catch {
      // error handled in caller
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  if (!isOpen || !currentDoc) return null;

  const isPdf = currentDoc.mimeType === "application/pdf" || currentDoc.filename.endsWith(".pdf");
  const docUrl = currentDoc.url || `/api/documents/${currentDoc.id}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Navigation & Controls Bar */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between text-white bg-black/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
            {currentIndex + 1} / {documents.length}
          </span>
          <div className="truncate">
            <h3 className="text-sm font-semibold text-white truncate leading-none">
              {currentDoc.displayTitle || currentDoc.originalName}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
              {currentDoc.originalName} · {(currentDoc.fileSizeBytes / 1024).toFixed(0)} KB WebP
            </p>
          </div>
        </div>

        {/* Center Viewer Controls (for Images) */}
        {!isPdf && (
          <div className="hidden md:flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700/60 rounded-lg p-1 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs text-zinc-300 min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (+)"
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-zinc-700 mx-1" />

            <button
              type="button"
              onClick={handleRotateCcw}
              title="Rotate Counter-Clockwise"
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRotateCw}
              title="Rotate Clockwise (R)"
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-zinc-700 mx-1" />

            <button
              type="button"
              onClick={resetTransform}
              title="Fit to screen (0)"
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          <a
            href={`${docUrl}?download=1`}
            download
            title="Download original file"
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </a>

          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            title="Toggle Info Drawer"
            className={`p-2 rounded-lg transition ${
              showInfo ? "bg-afk-olive/20 text-afk-olive" : "hover:bg-zinc-800 text-zinc-300 hover:text-white"
            }`}
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-zinc-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body: Viewer Canvas + Info Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Previous Button */}
        {documents.length > 1 && (
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 shadow-xl transition disabled:opacity-20 disabled:pointer-events-none hover:scale-105"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Button */}
        {documents.length > 1 && (
          <button
            type="button"
            disabled={currentIndex === documents.length - 1}
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 shadow-xl transition disabled:opacity-20 disabled:pointer-events-none hover:scale-105"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Canvas Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`flex-1 flex items-center justify-center p-4 overflow-hidden ${
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
        >
          {isPdf ? (
            <div className="w-full h-full max-w-5xl flex flex-col bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
              <div className="p-3 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>PDF Document Preview</span>
                </span>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <span>Open in Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <object
                data={docUrl}
                type="application/pdf"
                className="w-full h-full flex-1"
              >
                <div className="p-12 text-center text-zinc-400 space-y-4">
                  <p>Your browser doesn&apos;t support direct PDF rendering.</p>
                  <a
                    href={`${docUrl}?download=1`}
                    className="inline-block px-4 py-2 bg-afk-olive text-white rounded-lg text-sm font-semibold"
                  >
                    Download PDF File
                  </a>
                </div>
              </object>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={docUrl}
              alt={currentDoc.displayTitle || currentDoc.originalName}
              draggable={false}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isPanActive ? "none" : "transform 0.15s ease-out",
                maxHeight: "85vh",
                maxWidth: "85vw",
              }}
              className="object-contain shadow-2xl rounded-sm pointer-events-auto"
            />
          )}
        </div>

        {/* Right Info Drawer */}
        {showInfo && (
          <aside className="w-80 border-l border-white/10 bg-zinc-950/90 text-zinc-200 p-5 overflow-y-auto shrink-0 space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Evidence Details
              </h4>
              <p className="text-base font-bold text-white mt-1">
                {currentDoc.displayTitle || currentDoc.originalName}
              </p>
            </div>

            {/* Verification Status Banner */}
            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                currentDoc.verificationStatus === "VERIFIED"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : currentDoc.verificationStatus === "REJECTED"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              {currentDoc.verificationStatus === "VERIFIED" ? (
                <ShieldCheck className="w-5 h-5 shrink-0" />
              ) : currentDoc.verificationStatus === "REJECTED" ? (
                <ShieldAlert className="w-5 h-5 shrink-0" />
              ) : (
                <Clock className="w-5 h-5 shrink-0" />
              )}
              <div className="text-xs">
                <span className="font-bold uppercase tracking-wider block">
                  {currentDoc.verificationStatus}
                </span>
                {currentDoc.verificationNotes && (
                  <p className="mt-1 text-zinc-300 text-[11px] italic">
                    &quot;{currentDoc.verificationNotes}&quot;
                  </p>
                )}
                {currentDoc.verifiedAt && (
                  <p className="mt-1 text-[10px] text-zinc-400 font-mono">
                    Audit stamp: {new Date(currentDoc.verifiedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Partner Verification Actions (if permitted) */}
            {canVerify && onVerify && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2.5">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                  Audit / Partner Actions
                </span>

                {verifyAction ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-300">
                      Confirm <strong className="uppercase">{verifyAction}</strong> status:
                    </p>
                    <textarea
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="Add verification notes (optional)..."
                      className="w-full text-xs p-2 bg-black border border-zinc-700 rounded text-white outline-none focus:border-afk-olive resize-none h-16"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSubmittingVerify}
                        onClick={submitVerification}
                        className="flex-1 py-1.5 rounded bg-afk-olive hover:bg-afk-olive-light text-white text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        {isSubmittingVerify ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerifyAction(null)}
                        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVerifyAction("VERIFIED")}
                      className="flex-1 py-1.5 px-2.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifyAction("REJECTED")}
                      className="flex-1 py-1.5 px-2.5 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Metadata Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Category</span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                  {currentDoc.category}
                </span>
              </div>

              {currentDoc.description && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Notes / Description</span>
                  <p className="mt-0.5 text-zinc-300 text-xs leading-relaxed">
                    {currentDoc.description}
                  </p>
                </div>
              )}

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Module & Reference</span>
                <span className="text-zinc-300 font-mono text-xs">
                  {currentDoc.module || "GENERAL"} {currentDoc.referenceId && `· ${currentDoc.referenceId}`}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Uploaded By</span>
                <span className="text-zinc-300 text-xs">
                  {currentDoc.uploaderName || "System"} on {new Date(currentDoc.createdAt).toLocaleString()}
                </span>
              </div>

              {currentDoc.width && currentDoc.height && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Dimensions</span>
                  <span className="text-zinc-300 font-mono text-xs">
                    {currentDoc.width} × {currentDoc.height} px
                  </span>
                </div>
              )}

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Storage Format</span>
                <span className="text-zinc-300 font-mono text-xs">
                  {currentDoc.mimeType === "image/webp" ? "Converted WebP" : currentDoc.mimeType} ({(currentDoc.fileSizeBytes / 1024).toFixed(0)} KB)
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-[10px] uppercase font-mono">SHA-256 Checksum</span>
                  <button
                    type="button"
                    onClick={copyHashToClipboard}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedHash ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-400 break-all bg-black/60 p-2 rounded border border-zinc-800">
                  {currentDoc.fileHash}
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
