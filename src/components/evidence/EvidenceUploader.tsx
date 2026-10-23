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
} from "lucide-react";
import { VALID_CATEGORIES, EvidenceCategory } from "@/types/evidence";

interface StagedFile {
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

interface EvidenceUploaderProps {
  entityType?: string;
  entityId?: string;
  referenceId?: string;
  module?: string;
  defaultCategory?: EvidenceCategory;
  onUploadComplete?: (uploadedDocs: any[]) => void;
  className?: string;
  compact?: boolean;
}

export function EvidenceUploader({
  entityType,
  entityId,
  referenceId,
  module = "GENERAL",
  defaultCategory = "GENERAL_EVIDENCE",
  onUploadComplete,
  className = "",
  compact = false,
}: EvidenceUploaderProps) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Helper to create a staged file entry
  const stageFiles = useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null);
      const newStaged: StagedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate type
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (!isImage && !isPdf) {
          setGlobalError(`File "${file.name}" rejected: Only images (JPG, PNG, WebP) and PDF documents are allowed.`);
          continue;
        }

        // Max file size: 30MB
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
    [defaultCategory]
  );

  // Global Clipboard Paste Listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an active text input or textarea outside this component
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && activeEl.getAttribute("contenteditable") === "true");

      // Check if clipboard contains files/images
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
        // Prevent default only if we captured screenshot images
        e.preventDefault();
        stageFiles(imageFiles);
      } else if (!isInput) {
        // Ordinary text paste outside inputs - do nothing
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

  // Remove a staged file
  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Update metadata for a staged file
  const updateStagedMetadata = (
    id: string,
    updates: Partial<Pick<StagedFile, "category" | "displayTitle" | "description">>
  ) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  // Upload all pending staged files
  const handleUploadAll = async () => {
    const pending = stagedFiles.filter((f) => f.status === "idle" || f.status === "error");
    if (pending.length === 0) return;

    setIsUploading(true);
    setGlobalError(null);
    const successfullyUploaded: any[] = [];

    for (const item of pending) {
      // Set status to uploading
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
            f.id === item.id
              ? { ...f, status: "success", resultDoc: savedDoc }
              : f
          )
        );
      } catch (err: any) {
        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: "error", errorMessage: err.message || "Failed" }
              : f
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
    <div className={`space-y-4 ${className}`}>
      {/* Dropzone Box */}
      <div
        ref={dropzoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 outline-none p-6 text-center select-none ${
          isDragOver
            ? "border-afk-olive bg-afk-olive/15 scale-[1.005] shadow-lg shadow-afk-olive/10"
            : "border-afk-border hover:border-afk-olive/60 bg-afk-surface/50 hover:bg-afk-surface/80"
        } ${compact ? "p-4" : "p-6"}`}
      >
        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-afk-charcoal border border-afk-border flex items-center justify-center text-afk-olive">
            <UploadCloud className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <p className="text-sm font-semibold text-afk-offwhite">
              Drag & drop evidence here, or paste from clipboard (Ctrl+V)
            </p>
            <p className="text-xs text-afk-muted mt-1">
              Supports screenshots, JPG, PNG, WebP (auto-converted to WebP) & PDF documents up to 30MB
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-border/60 text-afk-offwhite text-xs font-medium border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Paperclip className="w-3.5 h-3.5 text-afk-olive" />
            <span>Browse Files</span>
          </button>

          {/* Mobile Camera Button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-border/60 text-afk-offwhite text-xs font-medium border border-afk-border flex items-center gap-1.5 transition-colors shadow-sm md:hidden"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span>Take Photo</span>
          </button>
        </div>

        {/* Hidden native inputs */}
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
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Staged Files Preview List */}
      {stagedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-afk-offwhite tracking-wider uppercase">
              Staged Attachments ({stagedFiles.length})
            </h4>

            {hasPending && (
              <button
                type="button"
                disabled={isUploading}
                onClick={handleUploadAll}
                className="px-3.5 py-1.5 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing & Converting...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload & Convert to WebP</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stagedFiles.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-afk-surface border border-afk-border flex gap-3 relative group"
              >
                {/* Thumbnail / Icon */}
                <div className="w-16 h-16 rounded bg-afk-charcoal border border-afk-border/80 flex items-center justify-center shrink-0 overflow-hidden relative">
                  {item.isImage && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-8 h-8 text-amber-400" />
                  )}

                  {/* Status Overlay */}
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-afk-olive animate-spin" />
                    </div>
                  )}
                  {item.status === "success" && (
                    <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5 text-black">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* File Details & Form Fields */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <input
                      type="text"
                      value={item.displayTitle}
                      disabled={item.status === "success" || item.status === "uploading"}
                      onChange={(e) => updateStagedMetadata(item.id, { displayTitle: e.target.value })}
                      placeholder="Title / description"
                      className="w-full text-xs font-medium text-afk-offwhite bg-transparent border-b border-transparent hover:border-afk-border focus:border-afk-olive outline-none px-0.5"
                    />
                    {item.status !== "uploading" && (
                      <button
                        type="button"
                        onClick={() => removeStagedFile(item.id)}
                        className="text-afk-muted hover:text-red-400 p-0.5 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={item.category}
                      disabled={item.status === "success" || item.status === "uploading"}
                      onChange={(e) =>
                        updateStagedMetadata(item.id, { category: e.target.value as EvidenceCategory })
                      }
                      className="text-[10px] bg-afk-charcoal text-afk-offwhite rounded px-1.5 py-0.5 border border-afk-border outline-none"
                    >
                      {VALID_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>

                    <span className="text-[10px] text-afk-muted font-mono">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  {/* Status Text */}
                  {item.status === "uploading" && (
                    <p className="text-[10px] text-afk-olive animate-pulse font-mono">
                      Converting to WebP & saving...
                    </p>
                  )}
                  {item.status === "success" && (
                    <p className="text-[10px] text-emerald-400 font-mono">
                      ✓ Stored as WebP / PDF
                    </p>
                  )}
                  {item.status === "error" && (
                    <p className="text-[10px] text-red-400 truncate font-mono">
                      {item.errorMessage || "Upload failed"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
