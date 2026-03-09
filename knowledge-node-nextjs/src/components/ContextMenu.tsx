'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Copy, Scissors, Hash, Indent, Outdent, Plus, Link2, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, getDisabledMessage } from '@/lib/feature-flags';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onAddTag?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onAddChild?: () => void;
  onInsertReference?: () => void;
  onAddCommandNode?: () => void;
  onAddSearchNode?: () => void;
  canIndent?: boolean;
  canOutdent?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onDelete,
  onCopy,
  onCut,
  onAddTag,
  onIndent,
  onOutdent,
  onAddChild,
  onInsertReference,
  onAddCommandNode,
  onAddSearchNode,
  canIndent = true,
  canOutdent = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [isVisible, setIsVisible] = useState(false);

  // 渲染后测量菜单尺寸并调整位置
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8; // 距离屏幕边缘的最小间距

      let adjustedX = x;
      let adjustedY = y;

      // 检查右侧边界：如果菜单超出右边界，则向左偏移
      if (x + menuRect.width + padding > viewportWidth) {
        adjustedX = Math.max(padding, viewportWidth - menuRect.width - padding);
      }

      // 检查底部边界：如果菜单超出底边界，则向上偏移
      if (y + menuRect.height + padding > viewportHeight) {
        adjustedY = Math.max(padding, viewportHeight - menuRect.height - padding);
      }

      // 检查左侧边界
      if (adjustedX < padding) {
        adjustedX = padding;
      }

      // 检查顶部边界
      if (adjustedY < padding) {
        adjustedY = padding;
      }

      setPosition({ x: adjustedX, y: adjustedY });
      // 位置调整完成后显示菜单，添加入场动画
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // 滚动时关闭菜单
    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const menuItems = [
    {
      icon: Plus,
      label: '添加子节点',
      onClick: onAddChild,
      shortcut: '',
      enabled: true,
    },
    {
      icon: Hash,
      label: '添加标签',
      onClick: onAddTag,
      shortcut: '#',
      enabled: true,
    },
    {
      icon: Link2,
      label: '🔗 插入引用',
      onClick: onInsertReference,
      shortcut: '@',
      enabled: true,
      highlight: true,
    },
    {
      icon: Sparkles,
      label: '🤖 新建指令',
      onClick: onAddCommandNode,
      shortcut: '/ai',
      enabled: FEATURE_FLAGS.AI_COMMAND_NODE,
      highlight: true,
      disabledTooltip: getDisabledMessage('AI_COMMAND_NODE'),
    },
    {
      icon: Search,
      label: '🔎 新建搜索节点',
      onClick: onAddSearchNode,
      shortcut: '/search',
      enabled: FEATURE_FLAGS.SEARCH_NODE,
      highlight: true,
      disabledTooltip: getDisabledMessage('SEARCH_NODE'),
    },
    { type: 'separator' as const },
    {
      icon: Indent,
      label: '缩进',
      onClick: onIndent,
      shortcut: 'Tab',
      enabled: canIndent,
    },
    {
      icon: Outdent,
      label: '反缩进',
      onClick: onOutdent,
      shortcut: 'Shift+Tab',
      enabled: canOutdent,
    },
    { type: 'separator' as const },
    {
      icon: Copy,
      label: '复制',
      onClick: onCopy,
      shortcut: 'Ctrl+C',
      enabled: true,
    },
    {
      icon: Scissors,
      label: '剪切',
      onClick: onCut,
      shortcut: 'Ctrl+X',
      enabled: true,
    },
    { type: 'separator' as const },
    {
      icon: Trash2,
      label: '删除节点',
      onClick: onDelete,
      shortcut: 'Del',
      enabled: true,
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[9999] min-w-[200px] max-w-[280px]",
        "bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "rounded-xl shadow-xl",
        "py-1.5 px-1",
        // 添加背景模糊效果
        "backdrop-blur-sm bg-white/95 dark:bg-gray-800/95",
        // 动画效果
        "transition-all duration-150 ease-out",
        isVisible 
          ? "opacity-100 scale-100 translate-y-0" 
          : "opacity-0 scale-95 -translate-y-1"
      )}
      style={{ 
        left: position.x, 
        top: position.y,
        boxShadow: 'var(--shadow-dropdown)',
      }}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return (
            <div
              key={index}
              className="h-px bg-gray-200 dark:bg-gray-700 my-1.5 mx-2"
            />
          );
        }

        const Icon = item.icon!;
        return (
          <button
            key={index}
            onClick={() => {
              if (item.enabled && item.onClick) {
                item.onClick();
                onClose();
              }
            }}
            disabled={!item.enabled}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-lg mx-0.5",
              "transition-all duration-100",
              item.enabled
                ? item.danger
                  ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 text-gray-700 dark:text-gray-300"
                  : item.highlight
                    ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                : "text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
            )}
          >
            <span className={cn(
              "flex items-center justify-center w-5 h-5",
              item.highlight && "text-blue-500",
              item.danger && item.enabled && "text-gray-500"
            )}>
              <Icon size={16} />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                "bg-gray-100 dark:bg-gray-700",
                "text-gray-500 dark:text-gray-400",
                "font-mono"
              )}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;