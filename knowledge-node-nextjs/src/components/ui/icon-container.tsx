import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const iconContainerVariants = cva(
  "inline-flex items-center justify-center flex-shrink-0 transition-all duration-200",
  {
    variants: {
      size: {
        sm: "w-8 h-8 rounded-lg [&_svg]:w-4 [&_svg]:h-4",
        md: "w-12 h-12 rounded-xl [&_svg]:w-6 [&_svg]:h-6",
        lg: "w-16 h-16 rounded-2xl [&_svg]:w-8 [&_svg]:h-8",
      },
      variant: {
        solid: "bg-muted text-muted-foreground",
        gradient: [
          "bg-gradient-brand text-white",
          "shadow-brand",
          "hover:shadow-brand-lg hover:scale-105",
        ],
        glass: [
          "backdrop-blur-md",
          "bg-[oklch(0.55_0.2_265_/_0.1)]",
          "border border-[oklch(0.55_0.2_265_/_0.15)]",
          "text-brand-primary",
          "dark:bg-[oklch(0.65_0.2_265_/_0.15)]",
          "dark:border-[oklch(0.65_0.2_265_/_0.2)]",
        ],
        success: "bg-gradient-success text-white",
        warning: "bg-gradient-warning text-[oklch(0.25_0_0)]",
        error: "bg-gradient-error text-white",
        info: "bg-gradient-info text-white",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "solid",
    },
  }
)

export interface IconContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconContainerVariants> {
  asChild?: boolean
}

const IconContainer = React.forwardRef<HTMLDivElement, IconContainerProps>(
  ({ className, size, variant, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(iconContainerVariants({ size, variant, className }))}
        {...props}
      >
        {children}
      </div>
    )
  }
)

IconContainer.displayName = "IconContainer"

export { IconContainer, iconContainerVariants }
