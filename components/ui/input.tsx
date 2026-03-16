import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium" style={{ color: "#8B8FA8" }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-xl border px-3.5 py-2.5 text-sm text-white placeholder:text-[#4A4A5A]",
          "focus:outline-none focus:ring-2 transition-all",
          error ? "border-[#FF4D4D] focus:ring-[#FF4D4D33]" : "border-[#1E1E28] focus:ring-[#B8E15A33] focus:border-[#B8E15A]",
          className
        )}
        style={{ background: "#1A1A22" }}
        {...props}
      />
      {hint && !error && <p className="text-xs" style={{ color: "#8B8FA8" }}>{hint}</p>}
      {error && <p className="text-xs" style={{ color: "#FF4D4D" }}>{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium" style={{ color: "#8B8FA8" }}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "w-full rounded-xl border px-3.5 py-2.5 text-sm text-white placeholder:text-[#4A4A5A]",
          "focus:outline-none focus:ring-2 transition-all resize-none",
          error ? "border-[#FF4D4D] focus:ring-[#FF4D4D33]" : "border-[#1E1E28] focus:ring-[#B8E15A33] focus:border-[#B8E15A]",
          className
        )}
        style={{ background: "#1A1A22" }}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs" style={{ color: "#FF4D4D" }}>{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium" style={{ color: "#8B8FA8" }}>
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          "w-full rounded-xl border px-3.5 py-2.5 text-sm text-white",
          "focus:outline-none focus:ring-2 focus:ring-[#B8E15A33] focus:border-[#B8E15A] transition-all",
          "border-[#1E1E28]",
          className
        )}
        style={{ background: "#1A1A22" }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: "#1A1A22" }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
