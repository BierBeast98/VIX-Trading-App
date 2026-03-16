export default function TradesLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-24 rounded-lg" style={{ background: "#1E1E28" }} />
          <div className="h-4 w-32 rounded mt-1.5" style={{ background: "#1E1E28" }} />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg" style={{ background: "#1E1E28" }} />
          <div className="h-9 w-32 rounded-lg" style={{ background: "#1E1E28" }} />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
            <div className="h-3 w-20 rounded mb-2" style={{ background: "#1E1E28" }} />
            <div className="h-7 w-16 rounded" style={{ background: "#1E1E28" }} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-5 space-y-3" style={{ background: "#141418", borderColor: "#1E1E28" }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded" style={{ background: "#1E1E28" }} />
        ))}
      </div>
    </div>
  );
}
