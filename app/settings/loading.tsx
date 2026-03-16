export default function SettingsLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 rounded-lg" style={{ background: "#1E1E28" }} />
          <div className="h-4 w-64 rounded mt-1.5" style={{ background: "#1E1E28" }} />
        </div>
        <div className="h-9 w-28 rounded-lg" style={{ background: "#1E1E28" }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
            <div className="h-4 w-40 rounded mb-4" style={{ background: "#1E1E28" }} />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-10 rounded-lg mb-3" style={{ background: "#1A1A22" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
