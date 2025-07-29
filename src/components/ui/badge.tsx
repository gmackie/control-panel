import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline'
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-gray-800 text-gray-100 border-gray-700',
      secondary: 'bg-gray-800/50 text-gray-400 border-gray-700',
      success: 'bg-green-900/20 text-green-400 border-green-900',
      warning: 'bg-yellow-900/20 text-yellow-400 border-yellow-900',
      error: 'bg-red-900/20 text-red-400 border-red-900',
      outline: 'bg-transparent text-gray-400 border-gray-700',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }