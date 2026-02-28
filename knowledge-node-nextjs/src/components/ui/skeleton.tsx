import { cn } from '@/lib/utils';

/**
 * Skeleton 占位组件
 * 复用 Design Token --duration-fast / --duration-normal 实现加载动效
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        '[animation-duration:var(--duration-normal,200ms)]',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
