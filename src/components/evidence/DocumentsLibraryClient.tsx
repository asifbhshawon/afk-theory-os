"use client";

import React, { useState } from "react";
import {
  FileText,
  UploadCloud,
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Download,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Plus,
} from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { EvidenceViewer, ViewerDocument } from "./EvidenceViewer";
import {
  verifyDocumentAction,
  updateDocumentMetadataAction,
  deleteDocumentAction,
} from "@/server/actions/documents";
import { VALID_CATEGORIES, EvidenceCategory } from "@/types/evidence";

interface Metrics {
  totalCount: number;
  totalSizeBytes: number;
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
}

interface DocumentsLibraryClientProps {
  initialDocuments: ViewerDocument[];
  metrics: Metrics;
  user: {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: string[];
  };
}

const MODULES = ["ALL", "FINANCE", "VENTURES", "INVENTORY", "MANUFACTURING", "SALES", "GENERAL"];

export function DocumentsLibraryClient({
  initialDocuments,
  metrics: initialMetrics,
  user,
}: DocumentsLibraryClientProps) {
  const [documents, setDocuments] = useState<ViewerDocument[]>(initialDocuments);
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Edit metadata modal
  const [editingDoc, setEditingDoc] = useState<ViewerDocument | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<EvidenceCategory>("GENERAL_EVIDENCE");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    if (selectedModule !== "ALL" && doc.module?.toUpperCase() !== selectedModule) {
      return false;
    }
    if (selectedCategory !== "ALL" && doc.category !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== "ALL" && doc.verificationStatus !== selectedStatus) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = (doc.displayTitle || "").toLowerCase().includes(q);
      const matchName = doc.originalName.toLowerCase().includes(q);
      const matchDesc = (doc.description || "").toLowerCase().includes(q);
      const matchRef = (doc.referenceId || "").toLowerCase().includes(q);
      const matchHash = doc.fileHash.toLowerCase().includes(q);
      if (!matchTitle && !matchName && !matchDesc && !matchRef && !matchHash) {
        return false;
      }
    }
    return true;
  });

  const handleVerification = async (
    docId: string,
    status: "VERIFIED" | "REJECTED" | "SUPERSEDED",
    notes?: string
  ) => {
    const res = await verifyDocumentAction(docId, status, notes);
    if (res.success && res.document) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...res.document } : d))
      );

      // Re-calculate metrics
      setMetrics((prev) => {
        const doc = documents.find((d) => d.id === docId);
        if (!doc) return prev;
        const oldStatus = doc.verificationStatus;
        return {
          ...prev,
          pendingCount:
            oldStatus === "PENDING" ? Math.max(0, prev.pendingCount - 1) : prev.pendingCount,
          verifiedCount: status === "VERIFIED" ? prev.verifiedCount + 1 : prev.verifiedCount,
          rejectedCount: status === "REJECTED" ? prev.rejectedCount + 1 : prev.rejectedCount,
        };
      });
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to permanently delete this evidence document?")) {
      return;
    }

    const res = await deleteDocumentAction(docId);
    if (res.success) {
      const targetDoc = documents.find((d) => d.id === docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (targetDoc) {
        setMetrics((prev) => ({
          ...prev,
          totalCount: Math.max(0, prev.totalCount - 1),
          totalSizeBytes: Math.max(0, prev.totalSizeBytes - targetDoc.fileSizeBytes),
          pendingCount:
            targetDoc.verificationStatus === "PENDING"
              ? Math.max(0, prev.pendingCount - 1)
              : prev.pendingCount,
          verifiedCount:
            targetDoc.verificationStatus === "VERIFIED"
              ? Math.max(0, prev.verifiedCount - 1)
              : prev.verifiedCount,
          rejectedCount:
            targetDoc.verificationStatus === "REJECTED"
              ? Math.max(0, prev.rejectedCount - 1)
              : prev.rejectedCount,
        }));
      }
    } else {
      alert(res.error || "Failed to delete document");
    }
  };

  const openEditModal = (doc: ViewerDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.displayTitle || doc.originalName);
    setEditCategory((doc.category as EvidenceCategory) || "GENERAL_EVIDENCE");
    setEditDescription(doc.description || "");
  };

  const saveEditModal = async () => {
    if (!editingDoc) return;
    setIsSavingEdit(true);

    const res = await updateDocumentMetadataAction(editingDoc.id, {
      displayTitle: editTitle,
      category: editCategory,
      description: editDescription,
    });

    setIsSavingEdit(false);
    if (res.success && res.document) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === editingDoc.id ? { ...d, ...res.document } : d))
      );
      setEditingDoc(null);
    } else {
      alert(res.error || "Failed to update metadata");
    }
  };

  const handleUploadDone = (newDocs: any[]) => {
    const formatted = newDocs.map((d) => ({
      ...d,
      uploaderName: user.name,
      createdAt: d.createdAt || new Date(),
    }));

    setDocuments((prev) => [...formatted, ...prev]);

    const addedSize = newDocs.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
    setMetrics((prev) => ({
      ...prev,
      totalCount: prev.totalCount + newDocs.length,
      totalSizeBytes: prev.totalSizeBytes + addedSize,
      pendingCount: prev.pendingCount + newDocs.length,
    }));

    setIsUploadOpen(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 KB";
    const k = 1024;
    const mb = bytes / (k * k);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / k).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-afk-offwhite">
              Evidence & Document Repository
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-afk-olive/20 text-afk-olive-accent border border-afk-olive">
              WebP Standard
            </span>
          </div>
          <p className="text-xs text-afk-muted mt-0.5">
            100% local, tamper-evident business proof storage with automatic WebP conversion and partner audit workflows.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="px-4 py-2 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-afk-olive/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Evidence</span>
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-afk-surface border border-afk-border space-y-1">
          <div className="flex items-center justify-between text-afk-muted">
            <span className="text-xs font-medium">Total Proofs</span>
            <FileText className="w-4 h-4 text-afk-olive" />
          </div>
          <p className="text-2xl font-bold text-afk-offwhite">{metrics.totalCount}</p>
          <p className="text-[10px] text-afk-muted font-mono">Originals & converted WebP</p>
        </div>

        <div className="p-4 rounded-xl bg-afk-surface border border-afk-border space-y-1">
          <div className="flex items-center justify-between text-afk-muted">
            <span className="text-xs font-medium">Local Footprint</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-sky-400">{formatBytes(Number(metrics.totalSizeBytes))}</p>
          <p className="text-[10px] text-afk-muted font-mono">Optimised WebP storage</p>
        </div>

        <div className="p-4 rounded-xl bg-afk-surface border border-afk-border space-y-1">
          <div className="flex items-center justify-between text-afk-muted">
            <span className="text-xs font-medium">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{metrics.pendingCount}</p>
          <p className="text-[10px] text-amber-400/80 font-mono">Awaiting partner verification</p>
        </div>

        <div className="p-4 rounded-xl bg-afk-surface border border-afk-border space-y-1">
          <div className="flex items-center justify-between text-afk-muted">
            <span className="text-xs font-medium">Verified Evidence</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{metrics.verifiedCount}</p>
          <p className="text-[10px] text-emerald-400/80 font-mono">Audited & confirmed</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-afk-surface border border-afk-border space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-afk-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, original name, SHA256 checksum or reference ID..."
              className="w-full bg-afk-black/80 border border-afk-border rounded-lg pl-9 pr-4 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted focus:border-afk-olive outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-afk-muted hover:text-afk-offwhite"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-afk-muted uppercase shrink-0">Module:</span>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-afk-black/80 border border-afk-border rounded-lg px-2.5 py-1.5 text-xs text-afk-offwhite outline-none focus:border-afk-olive"
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-afk-muted uppercase shrink-0">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-afk-black/80 border border-afk-border rounded-lg px-2.5 py-1.5 text-xs text-afk-offwhite outline-none focus:border-afk-olive"
            >
              <option value="ALL">ALL CATEGORIES</option>
              {VALID_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg bg-afk-black/80 p-0.5 border border-afk-border text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded transition ${
                viewMode === "grid"
                  ? "bg-afk-surface text-afk-offwhite shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="List View"
              className={`p-1.5 rounded transition ${
                viewMode === "list"
                  ? "bg-afk-surface text-afk-offwhite shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Verification Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-afk-border/40">
          {[
            { id: "ALL", label: "All Statuses", count: documents.length },
            { id: "PENDING", label: "Pending Verification", count: metrics.pendingCount },
            { id: "VERIFIED", label: "Verified Only", count: metrics.verifiedCount },
            { id: "REJECTED", label: "Rejected Only", count: metrics.rejectedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                selectedStatus === tab.id
                  ? "bg-afk-olive text-afk-offwhite shadow-sm"
                  : "bg-afk-black/40 text-afk-muted hover:text-afk-offwhite hover:bg-afk-black/80"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono opacity-80 px-1.5 py-0.2 rounded bg-black/40">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Evidence Grid / List View */}
      {filteredDocs.length === 0 ? (
        <div className="p-16 text-center rounded-xl bg-afk-surface/40 border border-afk-border text-afk-muted space-y-3">
          <FileText className="w-12 h-12 mx-auto text-afk-muted/30" />
          <p className="text-sm font-semibold text-afk-offwhite">No evidence records found</p>
          <p className="text-xs max-w-sm mx-auto">
            Try adjusting your search query, module filter, or upload new transaction evidence using the button above.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filteredDocs.map((doc, idx) => {
            const isPdf = doc.mimeType === "application/pdf" || doc.filename.endsWith(".pdf");
            const thumbUrl = doc.thumbnailUrl || doc.url || `/api/documents/${doc.id}/thumbnail`;

            return (
              <div
                key={doc.id}
                className="group rounded-xl bg-afk-surface border border-afk-border overflow-hidden hover:border-afk-olive/80 transition shadow-sm flex flex-col justify-between"
              >
                {/* Thumbnail Box */}
                <div
                  onClick={() => setViewerIndex(idx)}
                  className="aspect-square bg-afk-black flex items-center justify-center cursor-pointer relative overflow-hidden"
                >
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center">
                      <FileText className="w-10 h-10 text-amber-400 mb-1" />
                      <span className="text-[9px] font-mono text-zinc-400 uppercase">PDF Document</span>
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
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewerIndex(idx);
                      }}
                      className="p-1.5 rounded-full bg-zinc-900 text-white hover:bg-afk-olive transition"
                      title="Inspect"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={`/api/documents/${doc.id}?download=1`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-full bg-zinc-900 text-white hover:bg-afk-olive transition"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Badges on Thumbnail */}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] font-mono text-zinc-300 border border-white/10 uppercase">
                    {doc.category}
                  </span>
                </div>

                {/* Meta Details */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div className="min-w-0">
                    <p
                      onClick={() => setViewerIndex(idx)}
                      title={doc.displayTitle || doc.originalName}
                      className="text-xs font-semibold text-afk-offwhite truncate cursor-pointer hover:text-afk-olive"
                    >
                      {doc.displayTitle || doc.originalName}
                    </p>
                    <p className="text-[10px] text-afk-muted font-mono truncate mt-0.5">
                      {doc.module || "GENERAL"} {doc.referenceId && `· ${doc.referenceId}`}
                    </p>
                    <p className="text-[9px] text-afk-muted/80 font-mono truncate">
                      {(doc.fileSizeBytes / 1024).toFixed(0)} KB WebP · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status & Action Buttons */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-afk-border/40">
                    {doc.verificationStatus === "VERIFIED" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <ShieldCheck className="w-3 h-3" />
                        <span>VERIFIED</span>
                      </span>
                    ) : doc.verificationStatus === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
                        <ShieldAlert className="w-3 h-3" />
                        <span>REJECTED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span>PENDING</span>
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(doc)}
                        className="text-afk-muted hover:text-afk-offwhite p-1 transition"
                        title="Edit Info"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="text-afk-muted hover:text-red-400 p-1 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <div className="rounded-xl border border-afk-border bg-afk-surface overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-afk-charcoal/80 border-b border-afk-border text-[10px] font-mono text-afk-muted uppercase tracking-wider">
              <tr>
                <th className="p-3">Evidence Item</th>
                <th className="p-3">Category</th>
                <th className="p-3">Module & Ref</th>
                <th className="p-3">File Specs</th>
                <th className="p-3">Uploader</th>
                <th className="p-3">Verification</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/60">
              {filteredDocs.map((doc, idx) => (
                <tr
                  key={doc.id}
                  className="hover:bg-afk-charcoal/40 transition group cursor-pointer"
                  onClick={() => setViewerIndex(idx)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-afk-charcoal border border-afk-border flex items-center justify-center shrink-0 overflow-hidden">
                        {doc.mimeType === "application/pdf" ? (
                          <FileText className="w-4 h-4 text-amber-400" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={doc.thumbnailUrl || `/api/documents/${doc.id}/thumbnail`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-afk-offwhite block truncate">
                          {doc.displayTitle || doc.originalName}
                        </span>
                        <span className="text-[10px] text-afk-muted font-mono block truncate">
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
                  <td className="p-3 text-xs text-afk-offwhite">
                    {doc.uploaderName || "System"}
                  </td>
                  <td className="p-3">
                    {doc.verificationStatus === "VERIFIED" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>VERIFIED</span>
                      </span>
                    ) : doc.verificationStatus === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>REJECTED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>PENDING</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewerIndex(idx)}
                        className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-charcoal"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(doc)}
                        className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-charcoal"
                        title="Edit Info"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/documents/${doc.id}?download=1`}
                        download
                        className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-charcoal"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="p-1 rounded text-afk-muted hover:text-red-400 hover:bg-afk-charcoal"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal Drawer */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-afk-surface border border-afk-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-afk-border pb-3">
              <div>
                <h3 className="text-base font-bold text-afk-offwhite">Upload Evidence & Documents</h3>
                <p className="text-xs text-afk-muted mt-0.5">
                  Screenshots, transaction slips, challans, or contracts. Automatically converted to WebP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-charcoal transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <EvidenceUploader
              module="GENERAL"
              defaultCategory="GENERAL_EVIDENCE"
              onUploadComplete={handleUploadDone}
            />
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-afk-surface border border-afk-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-afk-border pb-3">
              <h3 className="text-sm font-bold text-afk-offwhite">Edit Evidence Details</h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-afk-muted hover:text-afk-offwhite"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-afk-muted block mb-1 uppercase">
                  Display Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-afk-black border border-afk-border text-afk-offwhite outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-afk-muted block mb-1 uppercase">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as EvidenceCategory)}
                  className="w-full text-xs p-2.5 rounded-lg bg-afk-black border border-afk-border text-afk-offwhite outline-none focus:border-afk-olive"
                >
                  {VALID_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-afk-muted block mb-1 uppercase">
                  Notes / Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg bg-afk-black border border-afk-border text-afk-offwhite outline-none focus:border-afk-olive resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-afk-border/40">
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={saveEditModal}
                className="flex-1 py-2 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold transition"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 rounded-lg bg-afk-charcoal text-afk-muted hover:text-afk-offwhite text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Viewer */}
      {viewerIndex !== null && (
        <EvidenceViewer
          documents={filteredDocs}
          initialIndex={viewerIndex}
          isOpen={true}
          onClose={() => setViewerIndex(null)}
          onVerify={handleVerification}
          canVerify={true}
        />
      )}
    </div>
  );
}
