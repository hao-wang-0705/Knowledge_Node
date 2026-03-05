import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const alertBannerVariants = cva(
  [
    "relative flex items-start gap-3 px-4 py-3 rounded-lg overflow-hidden",
    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
    "transition-all duration-200",
  ],
  {
    variants: {
      variant: {
        success: [
          "bg-gradient-success-subtle",
          "border border-[oklch(0.72_0.17_142_/_0.2)]",
          "before:bg-[oklch(0.72_0.17_142)]",
          "text-[oklch(0.35_0.08_142)]",
          "dark:text-[oklch(0.85_0.12_142)]",
          "[&_svg]:text-[oklch(0.72_0.17_142)]",
        ],
        info: [
          "bg-gradient-info-subtle",
          "border border-[oklch(0.65_0.15_230_/_0.2)]",
          "before:bg-[oklch(0.65_0.15_230)]",
          "text-[oklch(0.35_0.08_230)]",
          "dark:text-[oklch(0.85_0.12_230)]",
          "[&_svg]:text-[oklch(0.65_0.15_230)]",
        ],
        warning: [
          "bg-gradient-warning-subtle",
          "border border-[oklch(0.80_0.15_85_/_0.2)]",
          "before:bg-[oklch(0.80_0.15_85)]",
          "text-[oklch(0.35_0.08_85)]",
          "dark:text-[oklch(0.90_0.10_85)]",
          "[&_svg]:text-[oklch(0.75_0.15_85)]",
        ],
        error: [
          "bg-gradient-error-subtle",
          "border border-[oklch(0.65_0.20_25_/_0.2)]",
          "before:bg-[oklch(0.65_0.20_25)]",
          "text-[oklch(0.35_0.10_25)]",
          "dark:text-[oklch(0.85_0.15_25)]",
          "[&_svg]:text-[oklch(0.65_0.20_25)]",
        ],
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const defaultIcons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
}

export interface AlertBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertBannerVariants> {
  icon?: React.ReactNode
}

const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ className, variant = "info", icon, children, ...props }, ref) => {
    const DefaultIcon = defaultIcons[variant || "info"]

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertBannerVariants({ variant }), className)}
        {...props}
      >
        <div className="flex-shrink-0 mt-0.5">
          {icon || <DefaultIcon className="w-5 h-5" />}
        </div>
        <div className="flex-1 text-sm leading-relaxed">{children}</div>
      </div>
    )
  }
)

AlertBanner.displayName = "AlertBanner"

export { AlertBanner, alertBannerVariants }
