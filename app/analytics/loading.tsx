export default function AnalyticsLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-pulse">
      <div className="h-7 w-28 rounded-lg" style={{ background: "#1E1E28" }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
            <div className="h-3 w-16 rounded mb-3" style={{ background: "#1E1E28" }} />
            <div className="h-8 w-20 rounded" style={{ background: "#1E1E28" }} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
        <div className="h-4 w-48 rounded mb-4" style={{ background: "#1E1E28" }} />
        <div className="h-[200px] rounded-lg" style={{ background: "#1E1E28" }} />
      </div>
    </div>
  );
}
