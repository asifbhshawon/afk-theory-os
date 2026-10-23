"use client";

import React, { useState } from "react";
import {
  Grid,
  List,
  Eye,
  Download,
  Trash2,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { EvidenceViewer, ViewerDocument } from "./EvidenceViewer";

interface EvidenceGalleryProps {
  documents: ViewerDocument[];
  onDelete?: (id: string) => Promise<void>;
  onVerify?: (id: string, status: "VERIFIED" | "REJECTED" | "SUPERSEDED", notes?: string) => Promise<void>;
  canVerify?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
  showTitle?: boolean;
}

export function EvidenceGallery({
  documents,
  onDelete,
  onVerify,
  canVerify = false,
  canDelete = false,
  emptyMessage = "No evidence documents attached yet.",
  showTitle = true,
}: EvidenceGalleryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filteredDocs = documents.filter((doc) => {
    if (filterStatus === "ALL") return true;
    return doc.verificationStatus === filterStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            <span>VERIFIED</span>
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-3 h-3" />
            <span>REJECTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Gallery Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showTitle && (
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-afk-offwhite tracking-wider uppercase">
              Attached Evidence ({documents.length})
            </h4>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Status Filter Tabs */}
          <div className="flex items-center rounded-lg bg-afk-charcoal p-0.5 border border-afk-border text-xs">
            {["ALL", "PENDING", "VERIFIED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${
                  filterStatus === st
                    ? "bg-afk-surface text-afk-offwhite shadow-sm"
                    : "text-afk-muted hover:text-afk-offwhite"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-afk-charcoal p-0.5 border border-afk-border text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1 rounded transition ${
                viewMode === "grid" ? "bg-afk-surface text-afk-offwhite shadow-sm" : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="List View"
              className={`p-1 rounded transition ${
                viewMode === "list" ? "bg-afk-surface text-afk-offwhite shadow-sm" : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredDocs.length === 0 && (
        <div className="p-8 text-center rounded-xl bg-afk-surface/40 border border-afk-border text-afk-muted text-xs">
          <FileText className="w-8 h-8 mx-auto text-afk-muted/40 mb-2" />
          <p>{emptyMessage}</p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && filteredDocs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredDocs.map((doc, idx) => {
            const isPdf = doc.mimeType === "application/pdf" || doc.filename.endsWith(".pdf");
            const thumbUrl = doc.thumbnailUrl || doc.url || `/api/documents/${doc.id}/thumbnail`;

            return (
              <div
                key={doc.id}
                className="group relative rounded-xl bg-afk-surface border border-afk-border overflow-hidden hover:border-afk-olive/60 transition shadow-sm flex flex-col"
              >
                {/* Image / Thumbnail Container */}
                <div
                  onClick={() => setActiveViewerIndex(idx)}
                  className="aspect-square bg-afk-charcoal flex items-center justify-center cursor-pointer relative overflow-hidden"
                >
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <FileText className="w-10 h-10 text-amber-400 mb-1" />
                      <span className="text-[10px] font-mono text-afk-muted uppercase">PDF Document</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl}
                      alt={doc.displayTitle || doc.originalName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveViewerIndex(idx);
                      }}
                      className="p-1.5 rounded-full bg-afk-charcoal/80 text-white hover:bg-afk-olive transition"
                      title="Inspect Evidence"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={`/api/documents/${doc.id}?download=1`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-full bg-afk-charcoal/80 text-white hover:bg-afk-olive transition"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Category Pill Tag */}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono text-zinc-300 border border-white/10 uppercase">
                    {doc.category}
                  </span>
                </div>

                {/* Card Meta Footer */}
                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
                  <div className="min-w-0">
                    <p
                      onClick={() => setActiveViewerIndex(idx)}
                      title={doc.displayTitle || doc.originalName}
                      className="text-xs font-semibold text-afk-offwhite truncate cursor-pointer hover:text-afk-olive"
                    >
                      {doc.displayTitle || doc.originalName}
                    </p>
                    <p className="text-[10px] text-afk-muted font-mono truncate">
                      {(doc.fileSizeBytes / 1024).toFixed(0)} KB · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-afk-border/40">
                    {getStatusBadge(doc.verificationStatus)}

                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(doc.id)}
                        title="Delete Evidence"
                        className="text-afk-muted hover:text-red-400 p-0.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List / Table View */}
      {viewMode === "list" && filteredDocs.length > 0 && (
        <div className="rounded-xl border border-afk-border bg-afk-surface overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-afk-charcoal/80 border-b border-afk-border text-[10px] font-mono text-afk-muted uppercase tracking-wider">
              <tr>
                <th className="p-3">File / Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Module</th>
                <th className="p-3">Size / Format</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/60">
              {filteredDocs.map((doc, idx) => (
                <tr
                  key={doc.id}
                  className="hover:bg-afk-charcoal/40 transition group cursor-pointer"
                  onClick={() => setActiveViewerIndex(idx)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-afk-charcoal border border-afk-border flex items-center justify-center shrink-0">
                        {doc.mimeType === "application/pdf" ? (
                          <FileText className="w-4 h-4 text-amber-400" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={doc.thumbnailUrl || `/api/documents/${doc.id}/thumbnail`}
                            alt=""
                            className="w-full h-full object-cover rounded"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-afk-offwhite block truncate">
                          {doc.displayTitle || doc.originalName}
                        </span>
                        <span className="text-[10px] text-afk-muted font-mono block">
                          {doc.originalName}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-[10px] text-zinc-300">
                    {doc.category}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-afk-muted">
                    {doc.module || "GENERAL"} {doc.referenceId && `· ${doc.referenceId}`}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-afk-muted">
                    {(doc.fileSizeBytes / 1024).toFixed(0)} KB WebP
                  </td>
                  <td className="p-3">
                    {getStatusBadge(doc.verificationStatus)}
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveViewerIndex(idx)}
                        className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-charcoal"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/documents/${doc.id}?download=1`}
                        download
                        className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-charcoal"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {canDelete && onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(doc.id)}
                          className="p-1 rounded text-afk-muted hover:text-red-400 hover:bg-afk-charcoal"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox Viewer */}
      {activeViewerIndex !== null && (
        <EvidenceViewer
          documents={filteredDocs}
          initialIndex={activeViewerIndex}
          isOpen={true}
          onClose={() => setActiveViewerIndex(null)}
          onVerify={onVerify}
          canVerify={canVerify}
        />
      )}
    </div>
  );
}
