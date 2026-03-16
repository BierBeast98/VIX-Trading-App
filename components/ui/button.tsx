import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "text-black font-semibold",
  secondary: "text-white font-medium",
  danger: "text-white font-medium",
  ghost: "text-white font-medium",
  outline: "font-medium",
};

const variantStyle: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "#B8E15A", color: "#000000" },
  secondary: { background: "#1E1E28", color: "#FFFFFF", border: "1px solid #2E2E3A" },
  danger: { background: "#FF4D4D22", color: "#FF4D4D", border: "1px solid #FF4D4D44" },
  ghost: { background: "transparent", color: "#8B8FA8" },
  outline: { background: "transparent", color: "#FFFFFF", border: "1px solid #1E1E28" },
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-base rounded-xl gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center transition-opacity",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "hover:opacity-80 active:opacity-70",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      style={variantStyle[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
