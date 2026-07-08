"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
        style={{ background: checked ? "#B8E15A" : "#1E1E28" }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
          style={{
            background: "#FFFFFF",
            transform: checked ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </div>
      {label != null && (
        <span className="text-sm" style={{ color: "#8B8FA8" }}>
          {label}
        </span>
      )}
    </label>
  );
}
