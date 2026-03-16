import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "danger" | "warning" | "accent" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default: { bg: "#1E1E28", color: "#FFFFFF", border: "#2E2E3A" },
  success: { bg: "#22C55E22", color: "#22C55E", border: "#22C55E44" },
  danger: { bg: "#FF4D4D22", color: "#FF4D4D", border: "#FF4D4D44" },
  warning: { bg: "#F59E0B22", color: "#F59E0B", border: "#F59E0B44" },
  accent: { bg: "#B8E15A22", color: "#B8E15A", border: "#B8E15A44" },
  muted: { bg: "#1E1E28", color: "#8B8FA8", border: "#1E1E28" },
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", className)}
      style={{
        background: styles.bg,
        color: styles.color,
        borderColor: styles.border,
      }}
    >
      {children}
    </span>
  );
}
