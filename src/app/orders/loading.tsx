/** Instant skeleton while the orders workspace loads. */
export default function OrdersLoading() {
  const block = "animate-pulse rounded-xl bg-afk-surface";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading orders">
      <div className="space-y-2">
        <div className={`${block} h-8 w-64`} />
        <div className={`${block} h-4 w-96 max-w-full`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${block} h-[82px]`} />
        ))}
      </div>
      <div className={`${block} h-[360px]`} />
      <div className={`${block} h-[420px]`} />
    </div>
  );
}
