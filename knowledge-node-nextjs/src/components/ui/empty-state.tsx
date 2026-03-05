import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"
import { IconContainer, type IconContainerProps } from "./icon-container"

const emptyStateVariants = cva(
  "flex text-center",
  {
    variants: {
      variant: {
        default: "flex-col items-center justify-center py-12 px-6 gap-4",
        compact: "flex-col items-center justify-center py-6 px-4 gap-3",
        inline: "flex-row items-center justify-start py-4 px-4 gap-3 text-left",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const emptyStateTitleVariants = cva(
  "font-semibold text-foreground",
  {
    variants: {
      variant: {
        default: "text-base",
        compact: "text-sm",
        inline: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const emptyStateDescriptionVariants = cva(
  "text-muted-foreground",
  {
    variants: {
      variant: {
        default: "text-sm max-w-[280px]",
        compact: "text-xs max-w-[240px]",
        inline: "text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  icon?: React.ReactNode
  iconVariant?: IconContainerProps["variant"]
  title?: string
  description?: string
  action?: React.ReactNode
  animated?: boolean
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      variant = "default",
      icon,
      iconVariant = "gradient",
      title,
      description,
      action,
      animated = true,
      children,
      ...props
    },
    ref
  ) => {
    // 根据 variant 决定 IconContainer 的 size
    const iconSize = variant === "inline" ? "sm" : variant === "compact" ? "md" : "lg"

    return (
      <div
        ref={ref}
        className={cn(
          emptyStateVariants({ variant }),
          animated && "animate-fade-in-scale-up",
          className
        )}
        {...props}
      >
        {/* Icon */}
        {(icon || !children) && (
          <IconContainer
            size={iconSize}
            variant={iconVariant}
            className={cn(
              animated && "animation-delay-100",
              variant === "default" && "mb-2"
            )}
          >
            {icon || <Inbox />}
          </IconContainer>
        )}

        {/* Text Content */}
        {(title || description) && (
          <div
            className={cn(
              "flex flex-col",
              variant === "inline" ? "gap-0.5" : "gap-1.5",
              animated && "animation-delay-150"
            )}
          >
            {title && (
              <h3 className={cn(emptyStateTitleVariants({ variant }))}>
                {title}
              </h3>
            )}
            {description && (
              <p className={cn(emptyStateDescriptionVariants({ variant }))}>
                {description}
              </p>
            )}
          </div>
        )}

        {/* Action */}
        {action && (
          <div
            className={cn(
              variant === "default" && "mt-2",
              variant === "compact" && "mt-1",
              variant === "inline" && "ml-auto",
              animated && "animation-delay-200"
            )}
          >
            {action}
          </div>
        )}

        {/* Custom children */}
        {children}
      </div>
    )
  }
)

EmptyState.displayName = "EmptyState"

export { EmptyState, emptyStateVariants }
