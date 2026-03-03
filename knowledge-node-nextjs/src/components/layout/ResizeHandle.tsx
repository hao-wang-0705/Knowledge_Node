'use client';

import React, { memo, useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  /** 拖拽宽度变化回调 */
  onResize: (deltaX: number) => void;
  /** 拖拽开始回调 */
  onResizeStart?: () => void;
  /** 拖拽结束回调 */
  onResizeEnd?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 可拖拽的垂直分割线组件
 * 实现主内容区与查询面板之间的宽度调整
 */
const ResizeHandle: React.FC<ResizeHandleProps> = memo(({
  onResize,
  onResizeStart,
  onResizeEnd,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const startXRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    startXRef.current = e.clientX;
    setIsDragging(true);
    onResizeStart?.();
    
    // 设置全局鼠标样式
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResizeStart]);

  // 处理鼠标移动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 使用 RAF 节流
      if (rafRef.current !== null) return;
      
      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - startXRef.current;
        startXRef.current = e.clientX;
        onResize(-deltaX); // 向左拖拽增加宽度，所以取反
        rafRef.current = null;
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onResizeEnd?.();
      
      // 恢复全局鼠标样式
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // 清理 RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize, onResizeEnd]);

  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        'relative flex-shrink-0 cursor-col-resize group',
        'w-[1px] hover:w-[3px] transition-all duration-150',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 可视分割线 */}
      <div
        className={cn(
          'absolute inset-0 transition-all duration-150',
          isDragging || isHovering
            ? 'bg-blue-500 w-[3px] -translate-x-[1px]'
            : 'bg-gray-200 dark:bg-gray-700 w-[1px]'
        )}
      />
      
      {/* 扩展的点击区域 */}
      <div
        className={cn(
          'absolute inset-y-0 -left-2 -right-2 z-10',
          'cursor-col-resize'
        )}
      />
      
      {/* 拖拽时的视觉反馈 - 中间的拖拽指示器 */}
      {(isDragging || isHovering) && (
        <div 
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-1 h-8 rounded-full',
            'bg-blue-500 opacity-80'
          )}
        />
      )}
    </div>
  );
});

ResizeHandle.displayName = 'ResizeHandle';

export default ResizeHandle;
