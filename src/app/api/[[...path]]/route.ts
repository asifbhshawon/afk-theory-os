import { NextRequest, NextResponse } from "next/server";
import { handleHealthGet } from "@/server/api/handlers/health";
import { handleBackupPost } from "@/server/api/handlers/backup";
import {
  handleCalendarCategoriesGet,
  handleCalendarCategoriesPost,
  handleCalendarCategoriesPatch,
  handleCalendarCategoriesDelete,
  handleCalendarEntriesGet,
  handleCalendarEntriesPost,
  handleCalendarEntryByIdGet,
  handleCalendarEntryByIdPatch,
  handleCalendarEntryByIdDelete,
  handleCalendarChecklistPatch,
} from "@/server/api/handlers/calendar";
import {
  handleDocumentsUploadPost,
  handleDocumentByIdGet,
  handleDocumentThumbnailGet,
} from "@/server/api/handlers/documents";
import {
  handleExportFinancialStatementsGet,
  handleExportInventoryGet,
  handleExportOrdersGet,
} from "@/server/api/handlers/export";
import {
  handleFinanceEntryWithEvidencePost,
  handleFinanceReversePost,
} from "@/server/api/handlers/finance";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const AVAILABLE_ENDPOINTS = [
  "GET    /api/health",
  "POST   /api/backup",
  "GET    /api/calendar/categories",
  "POST   /api/calendar/categories",
  "PATCH  /api/calendar/categories",
  "DELETE /api/calendar/categories",
  "GET    /api/calendar/entries",
  "POST   /api/calendar/entries",
  "GET    /api/calendar/entries/:id",
  "PATCH  /api/calendar/entries/:id",
  "DELETE /api/calendar/entries/:id",
  "PATCH  /api/calendar/checklist/:id",
  "POST   /api/documents/upload",
  "GET    /api/documents/:id",
  "GET    /api/documents/:id/thumbnail",
  "GET    /api/export/financial-statements",
  "GET    /api/export/inventory",
  "GET    /api/export/orders",
  "POST   /api/finance/entry-with-evidence",
  "POST   /api/finance/reverse",
];

function notFoundResponse(method: string, path: string[]) {
  const joined = path.length > 0 ? `/${path.join("/")}` : "";
  return NextResponse.json(
    {
      error: "Not Found",
      message: `Endpoint '/api${joined}' does not support method ${method}.`,
      availableEndpoints: AVAILABLE_ENDPOINTS,
    },
    { status: 404 }
  );
}

function apiIndexResponse() {
  return NextResponse.json(
    {
      name: "AFK THEORY Business OS - Unified API Router",
      version: "1.0.0",
      status: "online",
      description:
        "High-performance consolidated serverless API layer optimized for Vercel Hobby tier.",
      endpoints: AVAILABLE_ENDPOINTS,
    },
    { status: 200 }
  );
}

// ==========================================
// GET Handlers
// ==========================================
export async function GET(req: NextRequest, context: RouteContext) {
  const { path = [] } = (await context?.params) || {};

  // /api (root index)
  if (path.length === 0) {
    return apiIndexResponse();
  }

  // /api/health
  if (path.length === 1 && path[0] === "health") {
    return handleHealthGet();
  }

  // /api/calendar/...
  if (path[0] === "calendar") {
    if (path.length === 2 && path[1] === "categories") {
      return handleCalendarCategoriesGet();
    }
    if (path.length === 2 && path[1] === "entries") {
      return handleCalendarEntriesGet(req);
    }
    if (path.length === 3 && path[1] === "entries") {
      return handleCalendarEntryByIdGet(req, path[2]);
    }
  }

  // /api/documents/...
  if (path[0] === "documents") {
    if (path.length === 2 && path[1] !== "upload") {
      return handleDocumentByIdGet(req, path[1]);
    }
    if (path.length === 3 && path[2] === "thumbnail") {
      return handleDocumentThumbnailGet(req, path[1]);
    }
  }

  // /api/export/...
  if (path[0] === "export") {
    if (path.length === 2 && path[1] === "financial-statements") {
      return handleExportFinancialStatementsGet(req);
    }
    if (path.length === 2 && path[1] === "inventory") {
      return handleExportInventoryGet(req);
    }
    if (path.length === 2 && path[1] === "orders") {
      return handleExportOrdersGet(req);
    }
  }

  return notFoundResponse("GET", path);
}

// ==========================================
// POST Handlers
// ==========================================
export async function POST(req: NextRequest, context: RouteContext) {
  const { path = [] } = (await context?.params) || {};

  // /api/backup
  if (path.length === 1 && path[0] === "backup") {
    return handleBackupPost();
  }

  // /api/calendar/...
  if (path[0] === "calendar") {
    if (path.length === 2 && path[1] === "categories") {
      return handleCalendarCategoriesPost(req);
    }
    if (path.length === 2 && path[1] === "entries") {
      return handleCalendarEntriesPost(req);
    }
  }

  // /api/documents/upload
  if (path.length === 2 && path[0] === "documents" && path[1] === "upload") {
    return handleDocumentsUploadPost(req);
  }

  // /api/finance/...
  if (path[0] === "finance") {
    if (path.length === 2 && path[1] === "entry-with-evidence") {
      return handleFinanceEntryWithEvidencePost(req);
    }
    if (path.length === 2 && path[1] === "reverse") {
      return handleFinanceReversePost(req);
    }
  }

  return notFoundResponse("POST", path);
}

// ==========================================
// PATCH Handlers
// ==========================================
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path = [] } = (await context?.params) || {};

  // /api/calendar/...
  if (path[0] === "calendar") {
    if (path.length === 2 && path[1] === "categories") {
      return handleCalendarCategoriesPatch(req);
    }
    if (path.length === 3 && path[1] === "entries") {
      return handleCalendarEntryByIdPatch(req, path[2]);
    }
    if (path.length === 3 && path[1] === "checklist") {
      return handleCalendarChecklistPatch(req, path[2]);
    }
  }

  return notFoundResponse("PATCH", path);
}

// ==========================================
// DELETE Handlers
// ==========================================
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path = [] } = (await context?.params) || {};

  // /api/calendar/...
  if (path[0] === "calendar") {
    if (path.length === 2 && path[1] === "categories") {
      return handleCalendarCategoriesDelete(req);
    }
    if (path.length === 3 && path[1] === "entries") {
      return handleCalendarEntryByIdDelete(req, path[2]);
    }
  }

  return notFoundResponse("DELETE", path);
}

// ==========================================
// OPTIONS Handler
// ==========================================
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
