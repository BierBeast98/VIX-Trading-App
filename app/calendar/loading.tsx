export default function CalendarLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-pulse">
      <div className="h-7 w-52 rounded-lg" style={{ background: "#1E1E28" }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
            <div className="h-6 w-40 rounded mx-auto mb-6" style={{ background: "#1E1E28" }} />
            <div className="grid grid-cols-7 gap-1">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg" style={{ background: "#1E1E28" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-5" style={{ background: "#141418", borderColor: "#1E1E28" }}>
          <div className="h-4 w-32 rounded mb-4" style={{ background: "#1E1E28" }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl mb-2" style={{ background: "#1A1A22" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
