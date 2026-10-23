import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listDocuments } from "@/server/services/evidence";
import { DocumentsLibraryClient } from "@/components/evidence/DocumentsLibraryClient";

export const metadata = {
  title: "Evidence & Document Repository | AFK THEORY Business OS",
  description: "Central repository of transaction proof, invoices, slips and agreements",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const result = await listDocuments({
    search: params.search,
    module: params.module,
    category: params.category,
    verificationStatus: params.status,
    limit: 100,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <DocumentsLibraryClient
        initialDocuments={result.items}
        metrics={result.metrics}
        user={user}
      />
    </div>
  );
}
