export default function AlertsLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-20 rounded-lg" style={{ background: "#1E1E28" }} />
          <div className="h-4 w-56 rounded mt-1.5" style={{ background: "#1E1E28" }} />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
            <div className="h-3 w-20 rounded mb-3" style={{ background: "#1E1E28" }} />
            <div className="h-7 w-12 rounded" style={{ background: "#1E1E28" }} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-5 space-y-2" style={{ background: "#141418", borderColor: "#1E1E28" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl" style={{ background: "#1A1A22" }} />
        ))}
      </div>
    </div>
  );
}
