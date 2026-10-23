"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud,
  Camera,
  Image as ImageIcon,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  Eye,
  Trash2,
  Sparkles,
} from "lucide-react";
import { VALID_CATEGORIES, EvidenceCategory } from "@/types/evidence";

export interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  isImage: boolean;
  isPdf: boolean;
  category: EvidenceCategory;
  displayTitle: string;
  description: string;
  status: "idle" | "uploading" | "success" | "error";
  errorMessage?: string;
  resultDoc?: any;
}

export interface EvidenceUploaderProps {
  /**
   * "form" = Mode A: stages files inside parent form before saving.
   * "standalone" = Mode B: immediately uploads to an existing record.
   */
  mode?: "form" | "standalone";

  // Mode A (form mode) props:
  stagedFiles?: StagedFile[];
  onStagedFilesChange?: (files: StagedFile[]) => void;

  // Mode B (standalone mode) props:
  entityType?: string;
  entityId?: string;
  referenceId?: string;
  module?: string;
  onUploadComplete?: (uploadedDocs: any[]) => void;

  // Common customization:
  defaultCategory?: EvidenceCategory;
  label?: string;
  helperText?: string;
  className?: string;
  compact?: boolean;
}

export function EvidenceUploader({
  mode = "form",
  stagedFiles: externalStagedFiles,
  onStagedFilesChange,
  entityType,
  entityId,
  referenceId,
  module = "GENERAL",
  defaultCategory = "PAYMENT_PROOF",
  onUploadComplete,
  label,
  helperText,
  className = "",
  compact = false,
}: EvidenceUploaderProps) {
  // Internal state when not controlled from parent
  const [internalStagedFiles, setInternalStagedFiles] = useState<StagedFile[]>([]);
  const stagedFiles = externalStagedFiles ?? internalStagedFiles;

  const setStagedFiles = useCallback(
    (updater: (prev: StagedFile[]) => StagedFile[]) => {
      if (onStagedFilesChange) {
        onStagedFilesChange(updater(stagedFiles));
      } else {
        setInternalStagedFiles(updater);
      }
    },
    [onStagedFilesChange, stagedFiles]
  );

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [previewModalFile, setPreviewModalFile] = useState<StagedFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to process & stage incoming files
  const stageFiles = useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null);
      const newStaged: StagedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Format validation
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (!isImage && !isPdf) {
          setGlobalError(`File "${file.name}" rejected: Only images (JPG, PNG, WebP) and PDF documents are allowed.`);
          continue;
        }

        // 30MB limit
        if (file.size > 30 * 1024 * 1024) {
          setGlobalError(`File "${file.name}" exceeds maximum allowed size (30MB).`);
          continue;
        }

        const previewUrl = isImage ? URL.createObjectURL(file) : "";
        const cleanName = file.name.replace(/\.[^/.]+$/, "");

        newStaged.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file,
          previewUrl,
          isImage,
          isPdf,
          category: defaultCategory,
          displayTitle: cleanName,
          description: "",
          status: "idle",
        });
      }

      setStagedFiles((prev) => [...prev, ...newStaged]);
    },
    [defaultCategory, setStagedFiles]
  );

  // Paste Screenshot (Ctrl+V) listener - handles pastes safely without intercepting normal inputs
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      // Don't intercept if user is typing text in an input or textarea
      const isTextInput =
        activeEl instanceof HTMLInputElement && activeEl.type !== "file" ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && activeEl.getAttribute("contenteditable") === "true");

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const file = new File([blob], `Screenshot_${timestamp}.png`, { type: blob.type });
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        // Only prevent default if paste contains image data
        e.preventDefault();
        stageFiles(imageFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [stageFiles]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      stageFiles(e.dataTransfer.files);
    }
  };

  // Remove staged file
  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Mode B: Upload directly to existing record
  const handleStandaloneUpload = async () => {
    const pending = stagedFiles.filter((f) => f.status === "idle" || f.status === "error");
    if (pending.length === 0) return;

    setIsUploading(true);
    setGlobalError(null);
    const successfullyUploaded: any[] = [];

    for (const item of pending) {
      setStagedFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f))
      );

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("module", module);
        if (entityType) formData.append("entityType", entityType);
        if (entityId) formData.append("entityId", entityId);
        if (referenceId) formData.append("referenceId", referenceId);
        formData.append("category", item.category);
        if (item.displayTitle) formData.append("displayTitle", item.displayTitle);
        if (item.description) formData.append("description", item.description);

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Upload failed");
        }

        const savedDoc = data.documents?.[0];
        successfullyUploaded.push(savedDoc);

        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "success", resultDoc: savedDoc } : f
          )
        );
      } catch (err: any) {
        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "error", errorMessage: err.message || "Failed" } : f
          )
        );
      }
    }

    setIsUploading(false);

    if (successfullyUploaded.length > 0 && onUploadComplete) {
      onUploadComplete(successfullyUploaded);
    }
  };

  const hasPending = stagedFiles.some((f) => f.status === "idle" || f.status === "error");

  return (
    <div ref={containerRef} className={`space-y-2.5 ${className}`}>
      {/* Label & Description */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-afk-offwhite flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-afk-olive" />
          <span>{label || "Supporting Proof / Attachments (Optional)"}</span>
        </label>
        {stagedFiles.length > 0 && (
          <span className="text-[10px] font-mono text-afk-olive font-medium bg-afk-olive/10 px-2 py-0.5 rounded border border-afk-olive/30">
            {stagedFiles.length} {stagedFiles.length === 1 ? "file staged" : "files staged"}
          </span>
        )}
      </div>

      {helperText && <p className="text-[10px] text-afk-muted">{helperText}</p>}

      {/* Dropzone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 outline-none text-center select-none ${
          isDragOver
            ? "border-afk-olive bg-afk-olive/15 scale-[1.005] shadow-lg shadow-afk-olive/10"
            : "border-afk-border hover:border-afk-olive/60 bg-afk-surface/40 hover:bg-afk-surface/70"
        } ${compact ? "p-3" : "p-4"}`}
      >
        <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
          <div className="w-9 h-9 rounded-full bg-afk-charcoal border border-afk-border flex items-center justify-center text-afk-olive">
            <UploadCloud className="w-4 h-4 animate-pulse" />
          </div>

          <div>
            <p className="text-xs font-semibold text-afk-offwhite">
              Drag & drop proof here, or paste screenshot <span className="text-afk-olive font-mono">(Ctrl+V)</span>
            </p>
            <p className="text-[10px] text-afk-muted mt-0.5">
              Receipts, bank slips, bKash screenshots (auto WebP conversion) & PDFs up to 30MB
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 rounded-lg bg-afk-surface hover:bg-afk-border/70 text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Paperclip className="w-3 h-3 text-afk-olive" />
            <span>Choose Files</span>
          </button>

          {/* Mobile Camera Button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-1 rounded-lg bg-afk-surface hover:bg-afk-border/70 text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm md:hidden cursor-pointer"
          >
            <Camera className="w-3 h-3 text-sky-400" />
            <span>Take Photo</span>
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) stageFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) stageFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Staged Files List with Thumbnails, View & Remove */}
      {stagedFiles.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-afk-muted">
            <span className="font-semibold text-afk-offwhite uppercase tracking-wider text-[10px]">
              Attached Proof Preview ({stagedFiles.length})
            </span>

            {/* Standalone mode upload button */}
            {mode === "standalone" && hasPending && (
              <button
                type="button"
                disabled={isUploading}
                onClick={handleStandaloneUpload}
                className="px-3 py-1 rounded bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Converting to WebP & Linking...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3 h-3" />
                    <span>Attach & Save Proof</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stagedFiles.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-afk-surface border border-afk-border flex items-center gap-2.5 relative group hover:border-afk-olive/50 transition-colors"
              >
                {/* Thumbnail Preview */}
                <div
                  onClick={() => item.isImage && setPreviewModalFile(item)}
                  className={`w-12 h-12 rounded bg-afk-charcoal border border-afk-border/80 flex items-center justify-center shrink-0 overflow-hidden relative ${
                    item.isImage ? "cursor-pointer hover:opacity-90" : ""
                  }`}
                  title={item.isImage ? "Click to preview full size" : item.file.name}
                >
                  {item.isImage && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-amber-400" />
                  )}

                  {item.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-afk-olive animate-spin" />
                    </div>
                  )}

                  {item.status === "success" && (
                    <div className="absolute top-0.5 right-0.5 bg-emerald-500 rounded-full p-0.5 text-black">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-afk-offwhite truncate" title={item.file.name}>
                    {item.displayTitle || item.file.name}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-afk-muted">
                    <span className="font-mono">{(item.file.size / 1024).toFixed(0)} KB</span>
                    {item.isImage && (
                      <span className="text-afk-olive font-mono flex items-center gap-0.5 text-[9px]">
                        <Sparkles className="w-2.5 h-2.5" /> WebP
                      </span>
                    )}
                    {item.isPdf && <span className="text-amber-400 font-mono text-[9px]">PDF</span>}
                  </div>
                </div>

                {/* Action buttons: View & Remove */}
                <div className="flex items-center gap-1">
                  {item.isImage && (
                    <button
                      type="button"
                      onClick={() => setPreviewModalFile(item)}
                      className="p-1 text-afk-muted hover:text-afk-offwhite rounded hover:bg-afk-border/50 transition cursor-pointer"
                      title="View preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {item.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => removeStagedFile(item.id)}
                      className="p-1 text-afk-muted hover:text-red-400 rounded hover:bg-afk-border/50 transition cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal for Staged Image */}
      {previewModalFile && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewModalFile(null)}
        >
          <div
            className="max-w-3xl max-h-[90vh] bg-afk-charcoal border border-afk-border rounded-xl p-4 flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-afk-border">
              <span className="text-xs font-semibold text-afk-offwhite truncate">
                {previewModalFile.file.name} ({(previewModalFile.file.size / 1024).toFixed(0)} KB)
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="text-afk-muted hover:text-afk-offwhite p-1 rounded hover:bg-afk-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto max-h-[70vh] flex items-center justify-center bg-black/40 rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalFile.previewUrl}
                alt="Preview"
                className="max-w-full max-h-[65vh] object-contain rounded"
              />
            </div>

            <p className="text-[10px] text-afk-muted text-center font-mono">
              Will be automatically converted to high-quality .webp upon saving
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
