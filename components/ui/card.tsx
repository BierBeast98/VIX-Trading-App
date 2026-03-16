import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export function Card({ children, className, hover, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        hover && "transition-colors hover:border-[#2E2E3A] cursor-pointer",
        className
      )}
      style={{
        background: "#141418",
        borderColor: "#1E1E28",
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-sm font-medium", className)} style={{ color: "#8B8FA8" }}>
      {children}
    </h3>
  );
}
