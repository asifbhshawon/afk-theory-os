import { Skeleton } from "@/components/ui/primitives";

/** Shown instantly while a portal page streams in. */
export default function PortalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="xl:col-span-2 h-[330px] rounded-xl" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
      <Skeleton className="h-[240px] rounded-xl" />
    </div>
  );
}
