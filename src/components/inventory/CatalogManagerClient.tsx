"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  saveProductStyleAndVariantsAction,
  deleteVariantAction,
  receiveLotAction,
  updateVariantStockAction,
} from "@/app/inventory/actions";
import {
  generateColorCode,
  generateVariantSku,
} from "@/lib/catalog";
import {
  Package,
  Layers,
  Palette,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowDownToLine,
  Boxes,
  Sparkles,
  Sliders,
  Edit3,
  X,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  styleCode: string;
  category: string;
  productType: string;
  retailPrice: string;
  targetCogs: string;
  status: string;
}

interface Variant {
  id: string;
  sku: string;
  size: string;
  color: string;
  sellingPrice: string;
  costPrice?: string;
  productId: string;
  inStockWithoutCount?: boolean;
  productName: string;
  styleCode: string;
}

interface Lot {
  id: string;
  lotNumber: string;
  sku: string;
  initialQuantity: number;
  currentQuantity: number;
  reservedQuantity: number;
  unitCost: string;
  totalCost: string;
  status: string;
  receivedDate: Date | string;
}

interface StockMovement {
  id: string;
  sku: string;
  movementType: string;
  quantity: number;
  unitCost: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date | string;
  notes: string | null;
}

interface PaymentAccount {
  id: string;
  name: string;
  type: string;
}

interface CatalogManagerClientProps {
  products: Product[];
  variants: Variant[];
  stockMap: Record<string, { currentQty: number; reservedQty: number; availableQty: number }>;
  lots: Lot[];
  movements: StockMovement[];
  payAccounts: PaymentAccount[];
  canManage: boolean;
}

// Preset color options for rapid 1-click addition in apparel
const COLOR_PRESETS = [
  { name: "Washed Black", hex: "#18181b", code: "BLK" },
  { name: "Charcoal Grey", hex: "#374151", code: "CHA" },
  { name: "Vintage White", hex: "#f3f4f6", code: "WHT" },
  { name: "Bottle Green", hex: "#166534", code: "BGR" },
  { name: "Maroon", hex: "#881337", code: "MAR" },
  { name: "Navy Blue", hex: "#1e3a8a", code: "NVY" },
  { name: "Olive Green", hex: "#4d7c0f", code: "OLV" },
  { name: "Desert Sand", hex: "#d97706", code: "SND" },
  { name: "Mocha Brown", hex: "#78350f", code: "BRN" },
  { name: "Slate Grey", hex: "#64748b", code: "GRY" },
];

// Preset size groups
const SIZE_PRESETS = [
  { label: "Apparel (S - XXL)", sizes: ["S", "M", "L", "XL", "XXL"] },
  { label: "Extended (XS - 3XL)", sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] },
  { label: "Bottoms (28 - 36)", sizes: ["28", "30", "32", "34", "36"] },
  { label: "One Size (FREE)", sizes: ["FREE"] },
  { label: "Raw Fabric (KG)", sizes: ["KG"] },
];

export function CatalogManagerClient({
  products,
  variants,
  stockMap,
  lots,
  movements,
  payAccounts,
  canManage,
}: CatalogManagerClientProps) {
  const router = useRouter();

  // Search and style filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [expandedStyleId, setExpandedStyleId] = useState<string | null>(products[0]?.id || null);

  // Form Mode: "CREATE_NEW" vs "ADD_TO_EXISTING"
  const [formMode, setFormMode] = useState<"CREATE_NEW" | "ADD_TO_EXISTING">("CREATE_NEW");
  const [selectedExistingStyleId, setSelectedExistingStyleId] = useState<string>(products[0]?.id || "");

  // Style form state
  const [styleName, setStyleName] = useState("");
  const [styleCode, setStyleCode] = useState("");
  const [category, setCategory] = useState("T-Shirts");
  const [productType, setProductType] = useState("FINISHED_GOODS");
  const [baseRetailPrice, setBaseRetailPrice] = useState("1450");
  const [baseCostPrice, setBaseCostPrice] = useState("420");

  // Multi-color & multi-size state
  const [selectedColors, setSelectedColors] = useState<string[]>(["Washed Black", "Charcoal Grey"]);
  const [customColorInput, setCustomColorInput] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["M", "L", "XL", "XXL"]);
  const [customSizeInput, setCustomSizeInput] = useState("");

  // Variant Matrix Customization overrides: [sku]: { excluded, sellingPrice, costPrice }
  const [matrixOverrides, setMatrixOverrides] = useState<
    Record<string, { excluded?: boolean; sellingPrice?: number; costPrice?: number }>
  >({});

  // Feedback states
  const [isSubmittingStyle, setIsSubmittingStyle] = useState(false);
  const [styleMessage, setStyleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lot Receipt Form State
  const [lotVariantId, setLotVariantId] = useState(variants[0]?.id || "");
  const [lotNumber, setLotNumber] = useState(`LOT-2026-${String(lots.length + 1).padStart(3, "0")}`);
  const [lotQuantity, setLotQuantity] = useState("50");
  const [lotUnitCost, setLotUnitCost] = useState("420");
  const [lotIsRawMaterial, setLotIsRawMaterial] = useState("false");
  const [lotPaymentAccountId, setLotPaymentAccountId] = useState(payAccounts[0]?.id || "");
  const [isSubmittingLot, setIsSubmittingLot] = useState(false);
  const [lotMessage, setLotMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Deleting variant state
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  // Edit Variant Stock Modal State
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [editStockCount, setEditStockCount] = useState<string>("0");
  const [editInStockWithoutCount, setEditInStockWithoutCount] = useState<boolean>(false);
  const [editSellingPrice, setEditSellingPrice] = useState<string>("0");
  const [editCostPrice, setEditCostPrice] = useState<string>("0");
  const [editNotes, setEditNotes] = useState<string>("");
  const [applyToColorGroup, setApplyToColorGroup] = useState<boolean>(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

  // Sync fields when switching to "ADD_TO_EXISTING"
  const handleExistingStyleSelect = (pId: string) => {
    setSelectedExistingStyleId(pId);
    const existing = products.find((p) => p.id === pId);
    if (existing) {
      setStyleName(existing.name);
      setStyleCode(existing.styleCode);
      setCategory(existing.category);
      setBaseRetailPrice(String(Number(existing.retailPrice)));
      setBaseCostPrice(String(Number(existing.targetCogs || 0)));

      // Extract existing colors and sizes from variants
      const existingVariants = variants.filter((v) => v.productId === pId);
      const uniqueColors = Array.from(new Set(existingVariants.map((v) => v.color)));
      const uniqueSizes = Array.from(new Set(existingVariants.map((v) => v.size)));
      if (uniqueColors.length > 0) setSelectedColors(uniqueColors);
      if (uniqueSizes.length > 0) setSelectedSizes(uniqueSizes);
    }
  };

  // Color management
  const addColor = (col: string) => {
    const trimmed = col.trim();
    if (!trimmed) return;
    if (!selectedColors.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedColors([...selectedColors, trimmed]);
    }
  };

  const removeColor = (col: string) => {
    setSelectedColors(selectedColors.filter((c) => c !== col));
  };

  const handleCustomColorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parts = customColorInput.split(",").map((s) => s.trim()).filter(Boolean);
      parts.forEach((p) => addColor(p));
      setCustomColorInput("");
    }
  };

  // Size management
  const addSize = (sz: string) => {
    const trimmed = sz.trim().toUpperCase();
    if (!trimmed) return;
    if (!selectedSizes.includes(trimmed)) {
      setSelectedSizes([...selectedSizes, trimmed]);
    }
  };

  const removeSize = (sz: string) => {
    setSelectedSizes(selectedSizes.filter((s) => s !== sz));
  };

  const handleCustomSizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parts = customSizeInput.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      parts.forEach((p) => addSize(p));
      setCustomSizeInput("");
    }
  };

  // Compute live generated variant matrix
  const currentStyleCode = (
    formMode === "CREATE_NEW" ? styleCode : products.find((p) => p.id === selectedExistingStyleId)?.styleCode || ""
  )
    .trim()
    .toUpperCase();

  const matrixVariants = useMemo(() => {
    if (!currentStyleCode || selectedColors.length === 0 || selectedSizes.length === 0) {
      return [];
    }

    const list: Array<{
      color: string;
      size: string;
      sku: string;
      sellingPrice: number;
      costPrice: number;
      isExcluded: boolean;
      alreadyExists: boolean;
    }> = [];

    const existingSkus = new Set(variants.map((v) => v.sku.toUpperCase()));

    for (const color of selectedColors) {
      for (const size of selectedSizes) {
        const sku = generateVariantSku(currentStyleCode, color, size);
        const override = matrixOverrides[sku] || {};
        const alreadyExists = existingSkus.has(sku);

        list.push({
          color,
          size,
          sku,
          sellingPrice: override.sellingPrice !== undefined ? override.sellingPrice : Number(baseRetailPrice || 0),
          costPrice: override.costPrice !== undefined ? override.costPrice : Number(baseCostPrice || 0),
          isExcluded: override.excluded || false,
          alreadyExists,
        });
      }
    }

    return list;
  }, [currentStyleCode, selectedColors, selectedSizes, baseRetailPrice, baseCostPrice, matrixOverrides, variants]);

  // Toggle variant inclusion
  const toggleVariantExcluded = (sku: string) => {
    setMatrixOverrides((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        excluded: !prev[sku]?.excluded,
      },
    }));
  };

  // Handle Save Style & Variant Matrix
  const handleSaveProductMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    setStyleMessage(null);

    const activeCode = currentStyleCode;
    const activeName = (formMode === "CREATE_NEW" ? styleName : products.find((p) => p.id === selectedExistingStyleId)?.name || "").trim();

    if (!activeCode || !activeName) {
      setStyleMessage({ type: "error", text: "Product Name and Style Code are required." });
      return;
    }

    const variantsToCreate = matrixVariants.filter((v) => !v.isExcluded);
    if (variantsToCreate.length === 0) {
      setStyleMessage({
        type: "error",
        text: "Please select at least 1 color and 1 size combination to generate SKU variants.",
      });
      return;
    }

    setIsSubmittingStyle(true);
    try {
      const res = await saveProductStyleAndVariantsAction({
        productId: formMode === "ADD_TO_EXISTING" ? selectedExistingStyleId : undefined,
        name: activeName,
        styleCode: activeCode,
        category,
        productType,
        retailPrice: Number(baseRetailPrice || 0),
        costPrice: Number(baseCostPrice || 0),
        variants: variantsToCreate.map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          sellingPrice: v.sellingPrice,
          costPrice: v.costPrice,
        })),
      });

      if (res.success) {
        setStyleMessage({
          type: "success",
          text: `Success! Style ${activeCode} saved with ${res.variantsCount} SKU variants created/updated.`,
        });
        if (formMode === "CREATE_NEW") {
          setStyleName("");
          setStyleCode("");
        }
        router.refresh();
      } else {
        setStyleMessage({ type: "error", text: res.error || "Failed to save product matrix." });
      }
    } catch (err: any) {
      setStyleMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmittingStyle(false);
    }
  };

  // Handle Receive Lot Submit
  const handleReceiveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLotMessage(null);
    setIsSubmittingLot(true);

    try {
      const res = await receiveLotAction({
        variantId: lotVariantId,
        lotNumber,
        quantity: Number(lotQuantity),
        unitCost: Number(lotUnitCost),
        paymentAccountId: lotPaymentAccountId,
        isRawMaterial: lotIsRawMaterial === "true",
      });

      if (res.success) {
        setLotMessage({
          type: "success",
          text: `Lot ${res.lotNumber} received successfully (${res.quantity} units)! Double-entry asset posted to GL.`,
        });
        setLotNumber(`LOT-2026-${String(lots.length + 2).padStart(3, "0")}`);
        router.refresh();
      } else {
        setLotMessage({ type: "error", text: res.error || "Failed to receive goods lot." });
      }
    } catch (err: any) {
      setLotMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmittingLot(false);
    }
  };

  // Handle Quick Pre-fill from Style Explorer to Receive Form
  const prefillReceiveForm = (variantId: string, cost?: string) => {
    setLotVariantId(variantId);
    if (cost && Number(cost) > 0) {
      setLotUnitCost(String(Number(cost)));
    }
    const el = document.getElementById("receive-lot-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle Delete Variant
  const handleDeleteVariant = async (variantId: string, sku: string) => {
    if (!confirm(`Are you sure you want to delete SKU variant ${sku}? This cannot be undone.`)) {
      return;
    }
    setDeletingVariantId(variantId);
    try {
      const res = await deleteVariantAction(variantId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Could not delete variant.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete variant.");
    } finally {
      setDeletingVariantId(null);
    }
  };

  // Open Edit Stock Modal
  const handleOpenEditStockModal = (v: Variant) => {
    const currentStock = stockMap[v.id]?.availableQty || 0;
    setEditingVariant(v);
    setEditStockCount(String(currentStock));
    setEditInStockWithoutCount(Boolean(v.inStockWithoutCount));
    setEditSellingPrice(String(Number(v.sellingPrice || 0)));
    setEditCostPrice(String(Number(v.costPrice || 0)));
    setEditNotes("");
    setApplyToColorGroup(false);
    setEditErrorMessage(null);
  };

  // Submit Variant Stock Edit
  const handleSaveVariantStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant) return;

    setIsSubmittingEdit(true);
    setEditErrorMessage(null);

    try {
      let applyToVariantIds: string[] | undefined = undefined;
      if (applyToColorGroup) {
        applyToVariantIds = variants
          .filter(
            (item) =>
              item.productId === editingVariant.productId &&
              item.color.toLowerCase() === editingVariant.color.toLowerCase()
          )
          .map((item) => item.id);
      }

      const res = await updateVariantStockAction({
        variantId: editingVariant.id,
        targetStock: Number(editStockCount || 0),
        inStockWithoutCount: editInStockWithoutCount,
        sellingPrice: Number(editSellingPrice || 0),
        costPrice: Number(editCostPrice || 0),
        notes: editNotes.trim() || undefined,
        applyToVariantIds,
      });

      if (res.success) {
        setEditingVariant(null);
        router.refresh();
      } else {
        setEditErrorMessage(res.error || "Failed to update variant stock.");
      }
    } catch (err: any) {
      setEditErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Group variants by Product for Catalog Explorer
  const groupedProducts = useMemo(() => {
    return products.map((prod) => {
      const prodVariants = variants.filter((v) => v.productId === prod.id);
      const uniqueColors = Array.from(new Set(prodVariants.map((v) => v.color)));
      const uniqueSizes = Array.from(new Set(prodVariants.map((v) => v.size)));

      let totalStock = 0;
      let hasInStockWithoutCount = false;
      for (const v of prodVariants) {
        totalStock += stockMap[v.id]?.availableQty || 0;
        if (v.inStockWithoutCount) hasInStockWithoutCount = true;
      }

      return {
        ...prod,
        variants: prodVariants,
        colors: uniqueColors,
        sizes: uniqueSizes,
        totalStock,
        hasInStockWithoutCount,
      };
    });
  }, [products, variants, stockMap]);

  // Filter styles by search & category
  const filteredProducts = useMemo(() => {
    return groupedProducts.filter((p) => {
      const matchesCategory =
        selectedCategoryFilter === "ALL" || p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.styleCode.toLowerCase().includes(q) ||
        p.colors.some((c) => c.toLowerCase().includes(q)) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [groupedProducts, selectedCategoryFilter, searchQuery]);

  // Calculate totals
  const totalStockCount = Object.values(stockMap).reduce((sum, item) => sum + (item.availableQty || 0), 0);
  const totalUncountedVariants = variants.filter((v) => v.inStockWithoutCount).length;
  const totalLotsValuation = lots.reduce((sum, lot) => sum + lot.currentQuantity * Number(lot.unitCost), 0);

  return (
    <div className="space-y-6">
      {/* KPI Overview Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Catalog Styles</span>
            <Package className="w-4 h-4 text-afk-olive-accent" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">{products.length}</p>
          <span className="text-[10px] text-afk-muted">Active styles in brand catalog</span>
        </div>

        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Total SKU Variants</span>
            <Layers className="w-4 h-4 text-afk-gold" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">{variants.length}</p>
          <span className="text-[10px] text-afk-muted">Color & size combinations</span>
        </div>

        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Available Finished Stock</span>
            <Boxes className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">
            {totalStockCount} pcs
            {totalUncountedVariants > 0 && (
              <span className="text-xs text-emerald-400 font-normal ml-1.5 font-sans">
                (+{totalUncountedVariants} in stock)
              </span>
            )}
          </p>
          <span className="text-[10px] text-afk-muted">Ready for courier dispatch</span>
        </div>

        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Total Inventory Asset</span>
            <Tag className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">
            ৳{totalLotsValuation.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-afk-muted">GL actual cost balance</span>
        </div>
      </div>

      {/* Catalog Style & SKU Variant Matrix Creator Card */}
      <div className="bg-afk-card border border-afk-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-afk-border">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-afk-gold" />
              <h3 className="text-sm font-semibold text-afk-offwhite">
                Catalog Style, Multiple Colors & SKU Variant Matrix
              </h3>
            </div>
            <p className="text-xs text-afk-muted mt-0.5">
              Create product styles with multiple colorways and sizes. Automatically generates standardized SKU combinations.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-afk-surface p-1 rounded-lg border border-afk-border text-xs self-start">
            <button
              type="button"
              onClick={() => {
                setFormMode("CREATE_NEW");
                setStyleMessage(null);
              }}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                formMode === "CREATE_NEW"
                  ? "bg-afk-olive text-afk-offwhite shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              ➕ New Product Style
            </button>
            <button
              type="button"
              onClick={() => {
                setFormMode("ADD_TO_EXISTING");
                setStyleMessage(null);
                if (products.length > 0) handleExistingStyleSelect(products[0].id);
              }}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                formMode === "ADD_TO_EXISTING"
                  ? "bg-afk-olive text-afk-offwhite shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              🎨 Add Colors/Sizes to Existing Style
            </button>
          </div>
        </div>

        {styleMessage && (
          <div
            className={`p-3 rounded-lg text-xs mb-4 flex items-center gap-2 ${
              styleMessage.type === "success"
                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
                : "bg-red-950/40 text-red-300 border border-red-700/50"
            }`}
          >
            {styleMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{styleMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProductMatrix} className="space-y-5 text-xs">
          {/* Target Style Selector or Inputs */}
          {formMode === "ADD_TO_EXISTING" ? (
            <div className="bg-afk-surface/60 border border-afk-border p-4 rounded-lg space-y-3">
              <label className="block text-[11px] text-afk-gold font-semibold uppercase tracking-wider">
                Select Existing Style to Expand
              </label>
              <select
                value={selectedExistingStyleId}
                onChange={(e) => handleExistingStyleSelect(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-2 text-afk-offwhite font-medium focus:outline-none focus:border-afk-olive"
              >
                {products.map((p) => {
                  const varCount = variants.filter((v) => v.productId === p.id).length;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.styleCode} — {p.name} ({p.category} | {varCount} variants)
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Product / Style Name *</label>
                <input
                  type="text"
                  required
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="e.g. Heavyweight Boxy Tee"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Style Code *</label>
                <input
                  type="text"
                  required
                  value={styleCode}
                  onChange={(e) => setStyleCode(e.target.value)}
                  placeholder="e.g. AFK-TS-001"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Category *</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. T-Shirts, Hoodies, Fabrics"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Classification</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  <option value="FINISHED_GARMENT">Finished Apparel</option>
                  <option value="RAW_MATERIAL">Raw Material (Fabric/Trim)</option>
                  <option value="PACKAGING">Packaging & Labels</option>
                </select>
              </div>
            </div>
          )}

          {/* Pricing defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Default Retail Selling Price (৳)</label>
              <input
                type="number"
                step="0.01"
                value={baseRetailPrice}
                onChange={(e) => setBaseRetailPrice(e.target.value)}
                placeholder="1450"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Default Target Cost Price (৳)</label>
              <input
                type="number"
                step="0.01"
                value={baseCostPrice}
                onChange={(e) => setBaseCostPrice(e.target.value)}
                placeholder="420"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>
          </div>

          {/* Multiple Color System Section */}
          <div className="bg-afk-surface/40 border border-afk-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-afk-gold" />
                <span className="text-[11px] font-semibold text-afk-offwhite uppercase tracking-wider">
                  Multiple Colors & Colorways ({selectedColors.length} Selected)
                </span>
              </div>
              <span className="text-[10px] text-afk-muted">Click presets or type multiple colors</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = selectedColors.some((c) => c.toLowerCase() === preset.name.toLowerCase());
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => (isSelected ? removeColor(preset.name) : addColor(preset.name))}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                      isSelected
                        ? "bg-afk-olive/30 border-afk-olive text-afk-offwhite shadow-sm"
                        : "bg-afk-surface border-afk-border text-afk-muted hover:text-afk-offwhite hover:border-afk-border/80"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.name}</span>
                    <span className="font-mono text-[9px] text-afk-muted">({preset.code})</span>
                    {isSelected && <span className="text-afk-olive-accent font-bold">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Selected Color Badges & Custom Input */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-afk-border/50">
              {selectedColors.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-afk-card border border-afk-border rounded-md text-xs text-afk-offwhite"
                >
                  <span className="w-2 h-2 rounded-full bg-afk-olive-accent" />
                  <span className="font-medium">{col}</span>
                  <span className="font-mono text-[10px] text-afk-muted">({generateColorCode(col)})</span>
                  <button
                    type="button"
                    onClick={() => removeColor(col)}
                    className="text-afk-muted hover:text-red-400 font-bold ml-1"
                    title="Remove color"
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={customColorInput}
                onChange={(e) => setCustomColorInput(e.target.value)}
                onKeyDown={handleCustomColorKeyDown}
                placeholder="Type custom color & press Enter (e.g. Acid Wash Grey)..."
                className="flex-1 min-w-[220px] bg-afk-surface border border-afk-border rounded px-3 py-1 text-afk-offwhite focus:outline-none focus:border-afk-olive text-xs"
              />
            </div>
          </div>

          {/* Multiple Size System Section */}
          <div className="bg-afk-surface/40 border border-afk-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-afk-olive-accent" />
                <span className="text-[11px] font-semibold text-afk-offwhite uppercase tracking-wider">
                  Multiple Sizes ({selectedSizes.length} Selected)
                </span>
              </div>
              <span className="text-[10px] text-afk-muted">Click preset groups or type sizes</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const merged = Array.from(new Set([...selectedSizes, ...preset.sizes]));
                    setSelectedSizes(merged);
                  }}
                  className="px-2.5 py-1 bg-afk-surface border border-afk-border hover:bg-afk-surfaceLight text-[11px] rounded text-afk-muted hover:text-afk-offwhite transition"
                >
                  + {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedSizes([])}
                className="px-2 py-1 text-[11px] text-afk-muted hover:text-red-400 transition"
              >
                Clear all
              </button>
            </div>

            {/* Selected Size Pills & Custom Input */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-afk-border/50">
              {selectedSizes.map((sz) => (
                <span
                  key={sz}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-afk-card border border-afk-border rounded-md text-xs font-mono font-semibold text-afk-offwhite"
                >
                  <span>{sz}</span>
                  <button
                    type="button"
                    onClick={() => removeSize(sz)}
                    className="text-afk-muted hover:text-red-400 font-bold ml-1"
                    title="Remove size"
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                onKeyDown={handleCustomSizeKeyDown}
                placeholder="Type size & press Enter (e.g. 3XL, FREE, KG)..."
                className="flex-1 min-w-[200px] bg-afk-surface border border-afk-border rounded px-3 py-1 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive text-xs"
              />
            </div>
          </div>

          {/* Generated SKU Variant Matrix Preview */}
          {matrixVariants.length > 0 && (
            <div className="border border-afk-border rounded-lg overflow-hidden bg-afk-surface/30">
              <div className="p-3 bg-afk-surface border-b border-afk-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-afk-offwhite">
                    Variant Matrix Preview ({matrixVariants.filter((v) => !v.isExcluded).length} of {matrixVariants.length} Active SKUs)
                  </span>
                  <span className="text-[11px] text-afk-muted ml-2">
                    ({selectedColors.length} Colors × {selectedSizes.length} Sizes)
                  </span>
                </div>
                <span className="text-[10px] text-afk-muted font-mono">Uncheck combinations you do not produce</span>
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-afk-surface/60 border-b border-afk-border text-afk-muted sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3 w-8">Active</th>
                      <th className="py-2 px-3 font-medium">Color</th>
                      <th className="py-2 px-3 font-medium">Size</th>
                      <th className="py-2 px-3 font-medium">Generated SKU</th>
                      <th className="py-2 px-3 font-medium text-right">Retail Price (৳)</th>
                      <th className="py-2 px-3 font-medium text-right">Cost Price (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-afk-border/30">
                    {matrixVariants.map((item) => (
                      <tr
                        key={item.sku}
                        className={`hover:bg-afk-surface/40 transition ${
                          item.isExcluded ? "opacity-40 bg-black/20" : ""
                        }`}
                      >
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={!item.isExcluded}
                            onChange={() => toggleVariantExcluded(item.sku)}
                            className="rounded accent-afk-olive cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-medium text-afk-offwhite">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-afk-olive" />
                            <span>{item.color}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-afk-offwhite">{item.size}</td>
                        <td className="py-2 px-3 font-mono text-afk-muted">
                          {item.sku}
                          {item.alreadyExists && (
                            <span className="ml-2 text-[9px] bg-afk-surfaceLight border border-afk-border px-1.5 py-0.5 rounded text-afk-gold">
                              Existing
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-afk-offwhite">
                          ৳{item.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-afk-muted">
                          ৳{item.costPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmittingStyle || matrixVariants.length === 0}
            className="w-full py-2.5 bg-afk-olive hover:bg-afk-olive-light disabled:opacity-50 text-afk-offwhite text-xs font-semibold rounded-lg transition shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmittingStyle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating and saving SKU variants...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {formMode === "CREATE_NEW" ? "Create Product Style & " : "Add to Style & "}
                  Save {matrixVariants.filter((v) => !v.isExcluded).length} SKU Variants
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Catalog Styles & Variants Explorer */}
      <div className="bg-afk-card border border-afk-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-afk-border">
          <div>
            <h3 className="text-sm font-semibold text-afk-offwhite">Product Catalog & Colorways Explorer</h3>
            <p className="text-xs text-afk-muted mt-0.5">
              Browse brand styles, inspect colorways and sizes, check real-time stock levels, and receive inventory lots.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-afk-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search style, SKU, or color..."
              className="w-full pl-8 pr-3 py-1.5 bg-afk-surface border border-afk-border rounded-lg text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
            />
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("ALL")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
              selectedCategoryFilter === "ALL"
                ? "bg-afk-olive text-afk-offwhite"
                : "bg-afk-surface border border-afk-border text-afk-muted hover:text-afk-offwhite"
            }`}
          >
            All Categories ({products.length})
          </button>
          {Array.from(new Set(products.map((p) => p.category))).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                selectedCategoryFilter === cat
                  ? "bg-afk-olive text-afk-offwhite"
                  : "bg-afk-surface border border-afk-border text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Styles Accordion Cards */}
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-xs text-afk-muted border border-afk-border/40 rounded-xl bg-afk-surface/20">
              No product styles found matching your filter. Use the form above to create your first style.
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isExpanded = expandedStyleId === prod.id;
              return (
                <div
                  key={prod.id}
                  className="border border-afk-border rounded-xl bg-afk-surface/20 overflow-hidden transition"
                >
                  {/* Style Header Card */}
                  <div
                    onClick={() => setExpandedStyleId(isExpanded ? null : prod.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-afk-surface/40 transition"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-afk-olive/20 border border-afk-olive/40 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-afk-olive-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-afk-offwhite text-sm">{prod.styleCode}</span>
                          <span className="font-semibold text-afk-offwhite text-sm">— {prod.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                            {prod.category}
                          </span>
                        </div>

                        {/* Colorway Pills */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[11px] text-afk-muted">Colorways:</span>
                          {prod.colors.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded text-[10px] bg-afk-surface border border-afk-border text-afk-offwhite font-medium inline-flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-afk-olive" />
                              <span>{c}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-center">
                      <div className="text-right">
                        <div className="font-mono font-bold text-afk-offwhite text-sm">
                          ৳{Number(prod.retailPrice).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] font-mono text-afk-muted">
                          Stock:{" "}
                          <span
                            className={
                              prod.totalStock > 0 || prod.hasInStockWithoutCount
                                ? "text-emerald-400 font-bold"
                                : "text-afk-danger font-bold"
                            }
                          >
                            {prod.totalStock > 0
                              ? `${prod.totalStock} pcs${prod.hasInStockWithoutCount ? " (+ In Stock)" : ""}`
                              : prod.hasInStockWithoutCount
                              ? "In Stock"
                              : "0 pcs"}
                          </span>{" "}
                          ({prod.variants.length} SKUs)
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExistingStyleSelect(prod.id);
                            setFormMode("ADD_TO_EXISTING");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-2.5 py-1 bg-afk-surface border border-afk-border hover:bg-afk-surfaceLight text-[11px] rounded text-afk-gold font-medium transition cursor-pointer"
                        >
                          + Add Colors/Sizes
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-afk-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-afk-muted" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Variants Table */}
                  {isExpanded && (
                    <div className="border-t border-afk-border p-4 bg-black/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-afk-border/60 text-afk-muted">
                              <th className="py-2 px-2 font-medium">SKU</th>
                              <th className="py-2 px-2 font-medium">Color</th>
                              <th className="py-2 px-2 font-medium">Size</th>
                              <th className="py-2 px-2 font-medium text-right">Retail Price</th>
                              <th className="py-2 px-2 font-medium text-right">Cost Price</th>
                              <th className="py-2 px-2 font-medium text-center">Available Stock</th>
                              <th className="py-2 px-2 font-medium text-center">Status</th>
                              <th className="py-2 px-2 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-afk-border/30">
                            {prod.variants.map((v) => {
                              const stock = stockMap[v.id]?.availableQty || 0;
                              return (
                                <tr key={v.id} className="hover:bg-afk-surface/40 transition">
                                  <td className="py-2 px-2 font-mono font-bold text-afk-offwhite">{v.sku}</td>
                                  <td className="py-2 px-2 text-afk-offwhite">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-afk-olive" />
                                      <span>{v.color}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 font-mono text-afk-offwhite font-bold">{v.size}</td>
                                  <td className="py-2 px-2 text-right font-mono text-afk-offwhite">
                                    ৳{Number(v.sellingPrice).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-afk-muted">
                                    ৳{Number(v.costPrice || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditStockModal(v)}
                                      className="group/stock inline-flex flex-col items-center justify-center hover:opacity-80 transition cursor-pointer"
                                      title="Click to edit stock count & availability"
                                    >
                                      {v.inStockWithoutCount ? (
                                        <span className="text-emerald-400 font-bold inline-flex items-center gap-1 group-hover/stock:underline">
                                          <span>In Stock</span>
                                          <Edit3 className="w-2.5 h-2.5 opacity-60 group-hover/stock:opacity-100" />
                                        </span>
                                      ) : (
                                        <span
                                          className={`font-bold inline-flex items-center gap-1 group-hover/stock:underline ${
                                            stock > 0 ? "text-emerald-400" : "text-afk-muted"
                                          }`}
                                        >
                                          <span>{stock} pcs</span>
                                          <Edit3 className="w-2.5 h-2.5 opacity-40 group-hover/stock:opacity-100" />
                                        </span>
                                      )}
                                    </button>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                        v.inStockWithoutCount || stock > 10
                                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                          : stock > 0
                                          ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                                          : "bg-afk-border text-afk-muted"
                                      }`}
                                    >
                                      {v.inStockWithoutCount || stock > 10
                                        ? "IN STOCK"
                                        : stock > 0
                                        ? "LOW STOCK"
                                        : "OUT OF STOCK"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right space-x-1.5 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditStockModal(v)}
                                      className="px-2 py-1 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border hover:border-afk-gold/60 text-afk-offwhite text-[11px] rounded transition cursor-pointer inline-flex items-center gap-1 font-medium"
                                      title="Edit stock count & in-stock option"
                                    >
                                      <Sliders className="w-3 h-3 text-afk-gold" />
                                      <span>Edit Stock</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => prefillReceiveForm(v.id, v.costPrice)}
                                      className="px-2 py-1 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-[11px] rounded transition cursor-pointer"
                                    >
                                      + Receive Lot
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingVariantId === v.id}
                                      onClick={() => handleDeleteVariant(v.id, v.sku)}
                                      title="Delete variant if no transactions exist"
                                      className="p-1 text-afk-muted hover:text-red-400 rounded transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 inline" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Receive Purchase / Raw Materials Lot Section */}
      <div id="receive-lot-section" className="bg-afk-card border border-afk-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine className="w-4 h-4 text-afk-olive-accent" />
          <h3 className="text-sm font-semibold text-afk-offwhite">Receive Goods / Raw Materials Lot</h3>
        </div>
        <p className="text-xs text-afk-muted mb-4">
          Receive finished inventory or raw fabrics against an actual purchase cost. Automatically debits inventory asset and credits payment account.
        </p>

        {lotMessage && (
          <div
            className={`p-3 rounded-lg text-xs mb-4 flex items-center gap-2 ${
              lotMessage.type === "success"
                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
                : "bg-red-950/40 text-red-300 border border-red-700/50"
            }`}
          >
            {lotMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{lotMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleReceiveLot} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">SKU Variant *</label>
              <select
                value={lotVariantId}
                onChange={(e) => {
                  setLotVariantId(e.target.value);
                  const selectedV = variants.find((v) => v.id === e.target.value);
                  if (selectedV && Number(selectedV.costPrice) > 0) {
                    setLotUnitCost(String(Number(selectedV.costPrice)));
                  }
                }}
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive font-mono"
              >
                <option value="">Select SKU Variant...</option>
                {variants.map((v) => {
                  const stock = stockMap[v.id]?.availableQty || 0;
                  return (
                    <option key={v.id} value={v.id}>
                      {v.sku} — {v.productName} ({v.color} / {v.size}) [In Stock: {stock}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Lot Number *</label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                required
                placeholder="e.g. LOT-2026-005"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={lotQuantity}
                onChange={(e) => setLotQuantity(e.target.value)}
                placeholder="Qty received"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Unit Cost (৳) *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={lotUnitCost}
                onChange={(e) => setLotUnitCost(e.target.value)}
                placeholder="Cost per unit"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Item Classification</label>
              <select
                value={lotIsRawMaterial}
                onChange={(e) => setLotIsRawMaterial(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="false">Finished Goods (1230 Finished Inventory)</option>
                <option value="true">Raw Material / Fabric (1210 Materials)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Payment Account (Credit) *</label>
              <select
                value={lotPaymentAccountId}
                onChange={(e) => setLotPaymentAccountId(e.target.value)}
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                {payAccounts.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name} ({pa.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-5">
              <button
                type="submit"
                disabled={isSubmittingLot}
                className="w-full py-2 bg-afk-olive hover:bg-afk-olive-light disabled:opacity-50 text-afk-offwhite text-xs font-semibold rounded transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingLot ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Posting lot & GL journal...</span>
                  </>
                ) : (
                  <span>
                    Receive Lot ({lotQuantity} units @ ৳{Number(lotUnitCost || 0).toFixed(2)}) & Post GL Asset
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Active Inventory Lots Table */}
      <div className="bg-afk-card rounded-xl border border-afk-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Inventory Lots (Traceable Actual Cost)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Lot Number</th>
                <th className="py-2.5 font-medium">SKU</th>
                <th className="py-2.5 font-medium text-right">Initial Qty</th>
                <th className="py-2.5 font-medium text-right">Available Qty</th>
                <th className="py-2.5 font-medium text-right">Reserved Qty</th>
                <th className="py-2.5 font-medium text-right">Unit Cost</th>
                <th className="py-2.5 font-medium text-right">Total Valuation</th>
                <th className="py-2.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {lots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-afk-muted">
                    No active inventory lots received yet. Receive a lot using the form above to stock inventory.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => (
                  <tr key={lot.id} className="hover:bg-afk-surface/30 transition">
                    <td className="py-2.5 font-mono text-afk-offwhite font-semibold">{lot.lotNumber}</td>
                    <td className="py-2.5 font-mono text-afk-muted">{lot.sku}</td>
                    <td className="py-2.5 text-right font-mono text-afk-muted">{lot.initialQuantity}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-afk-offwhite">{lot.currentQuantity}</td>
                    <td className="py-2.5 text-right font-mono text-afk-gold">{lot.reservedQuantity}</td>
                    <td className="py-2.5 text-right font-mono text-afk-muted">
                      ৳{Number(lot.unitCost).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-afk-offwhite">
                      ৳
                      {(lot.currentQuantity * Number(lot.unitCost)).toLocaleString("en-BD", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          lot.status === "ACTIVE"
                            ? "bg-afk-olive-dark text-afk-olive-accent"
                            : "bg-afk-border text-afk-muted"
                        }`}
                      >
                        {lot.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Stock Movement Ledger */}
      <div className="bg-afk-card rounded-xl border border-afk-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Stock Movement Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2 font-medium">SKU</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium text-right">Quantity</th>
                <th className="py-2 font-medium text-right">Unit Cost</th>
                <th className="py-2 font-medium">Reference</th>
                <th className="py-2 font-medium">Notes</th>
                <th className="py-2 font-medium text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-afk-muted">
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-afk-surface/30 transition">
                    <td className="py-2 font-mono text-afk-offwhite font-medium">{m.sku}</td>
                    <td className="py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                        {m.movementType}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono font-bold text-afk-offwhite">{m.quantity}</td>
                    <td className="py-2 text-right font-mono text-afk-muted">৳{Number(m.unitCost).toFixed(2)}</td>
                    <td className="py-2 font-mono text-afk-muted">{m.referenceId || "—"}</td>
                    <td className="py-2 text-afk-muted truncate max-w-xs">{m.notes}</td>
                    <td className="py-2 text-right font-mono text-afk-muted">
                      {new Date(m.createdAt).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Variant Stock & Availability Modal */}
      {editingVariant && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-afk-card border border-afk-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-afk-border flex items-center justify-between bg-afk-surface/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-afk-gold/15 flex items-center justify-center border border-afk-gold/30">
                  <Sliders className="w-4 h-4 text-afk-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-afk-offwhite">Edit Stock & Availability</h3>
                  <p className="text-[11px] text-afk-muted">
                    {editingVariant.productName} • {editingVariant.color} / {editingVariant.size}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingVariant(null)}
                className="p-1 text-afk-muted hover:text-afk-offwhite rounded-md hover:bg-afk-surface transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveVariantStock} className="p-5 space-y-4 overflow-y-auto text-xs">
              {editErrorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-700/50 rounded-lg text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{editErrorMessage}</span>
                </div>
              )}

              {/* SKU & Current Ledger Status */}
              <div className="bg-afk-surface/70 border border-afk-border/70 rounded-lg p-3 flex items-center justify-between font-mono">
                <div>
                  <div className="text-[10px] text-afk-muted uppercase tracking-wider">SKU Variant</div>
                  <div className="font-bold text-afk-offwhite text-sm mt-0.5">{editingVariant.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-afk-muted uppercase tracking-wider">Current Stock</div>
                  <div className="font-bold text-sm mt-0.5">
                    {editingVariant.inStockWithoutCount ? (
                      <span className="text-emerald-400">In Stock (Uncounted)</span>
                    ) : (stockMap[editingVariant.id]?.availableQty || 0) > 0 ? (
                      <span className="text-emerald-400">
                        {stockMap[editingVariant.id]?.availableQty || 0} pcs
                      </span>
                    ) : (
                      <span className="text-afk-muted">0 pcs (Out of stock)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock Count (pcs) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-afk-offwhite">
                    Stock Quantity (pcs) *
                  </label>
                  <span className="text-[10px] text-afk-muted font-mono">
                    Ledger lot inventory
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editStockCount}
                    onChange={(e) => setEditStockCount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-afk-surface border border-afk-border rounded-lg px-3 py-2 text-afk-offwhite font-mono text-sm focus:outline-none focus:border-afk-olive"
                  />
                  <div className="absolute right-3 top-2.5 text-xs font-mono text-afk-muted pointer-events-none">
                    pcs
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-afk-muted mr-1">Quick set:</span>
                  {[
                    { label: "0 pcs (Zero)", value: "0" },
                    { label: "10 pcs", value: "10" },
                    { label: "25 pcs", value: "25" },
                    { label: "50 pcs", value: "50" },
                    { label: "100 pcs", value: "100" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setEditStockCount(preset.value)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border transition cursor-pointer ${
                        editStockCount === preset.value
                          ? "bg-afk-olive text-afk-offwhite border-afk-olive-accent font-bold"
                          : "bg-afk-surface hover:bg-afk-surfaceLight border-afk-border text-afk-muted hover:text-afk-offwhite"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Say "In Stock" without any exact number Option */}
              <div className="p-3.5 rounded-lg border bg-afk-surface/40 border-afk-border space-y-2.5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editInStockWithoutCount}
                    onChange={(e) => setEditInStockWithoutCount(e.target.checked)}
                    className="mt-0.5 rounded accent-emerald-500 w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div>
                    <div className="text-xs font-semibold text-afk-offwhite flex items-center gap-2 group-hover:text-emerald-400 transition-colors">
                      <span>Say &ldquo;In Stock&rdquo; without any exact number</span>
                      {editInStockWithoutCount && (
                        <span className="px-1.5 py-0.2 bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 rounded text-[9px] font-mono font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-afk-muted mt-0.5 leading-relaxed">
                      Displays this variant as &ldquo;In Stock&rdquo; in the catalog and storefront without requiring or displaying an exact numeric piece count.
                    </p>
                  </div>
                </label>

                {/* Contextual notice when stock count is zero */}
                {editStockCount === "0" && (
                  <div
                    className={`p-2.5 rounded-md text-[11px] flex items-center gap-2 border ${
                      editInStockWithoutCount
                        ? "bg-emerald-950/50 text-emerald-300 border-emerald-700/50"
                        : "bg-amber-950/40 text-amber-300 border-amber-800/40"
                    }`}
                  >
                    {editInStockWithoutCount ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          Stock count is <strong>0</strong>, but with this option enabled it will be displayed as <strong>&ldquo;In Stock&rdquo;</strong> without any exact number.
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          Stock count is <strong>0</strong>. It will be marked as <strong>0 pcs (OUT OF STOCK)</strong>. Enable the option above if you want it to say &ldquo;In Stock&rdquo; instead.
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-black/40 border border-afk-border/50 rounded-lg">
                <div className="text-[10px] text-afk-muted uppercase tracking-wider mb-1.5 font-mono">
                  Catalog Row Preview
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-afk-surface/60 rounded border border-afk-border/60">
                    <span className="text-[10px] text-afk-muted block mb-0.5">Available Stock Column</span>
                    {editInStockWithoutCount ? (
                      <span className="text-emerald-400 font-bold font-mono text-xs">
                        In Stock
                      </span>
                    ) : (
                      <span
                        className={`font-mono font-bold text-xs ${
                          Number(editStockCount || 0) > 0 ? "text-emerald-400" : "text-afk-muted"
                        }`}
                      >
                        {Number(editStockCount || 0)} pcs
                      </span>
                    )}
                  </div>

                  <div className="p-2 bg-afk-surface/60 rounded border border-afk-border/60">
                    <span className="text-[10px] text-afk-muted block mb-0.5">Status Column</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        editInStockWithoutCount || Number(editStockCount || 0) > 10
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                          : Number(editStockCount || 0) > 0
                          ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                          : "bg-afk-border text-afk-muted"
                      }`}
                    >
                      {editInStockWithoutCount || Number(editStockCount || 0) > 10
                        ? "IN STOCK"
                        : Number(editStockCount || 0) > 0
                        ? "LOW STOCK"
                        : "OUT OF STOCK"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing (Optional edits) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Retail Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Cost Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              {/* Bulk Apply to Color Group Option */}
              <div className="pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] text-afk-muted hover:text-afk-offwhite cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToColorGroup}
                    onChange={(e) => setApplyToColorGroup(e.target.checked)}
                    className="rounded accent-afk-gold w-3.5 h-3.5"
                  />
                  <span>
                    Apply &ldquo;{editInStockWithoutCount ? "In Stock without count" : "Exact Count"}&rdquo; to all {editingVariant.color} sizes of this style
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Adjustment Note (Optional)</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Physical inventory count, restock update"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive text-[11px]"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-afk-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingVariant(null)}
                  disabled={isSubmittingEdit}
                  className="px-3 py-1.5 bg-afk-surface hover:bg-afk-surfaceLight text-afk-offwhite rounded border border-afk-border text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite rounded font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
