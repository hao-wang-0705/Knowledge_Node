import { Hash, X } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContentWithReferences } from '@/components/ReferenceChip';
import { getTagStyle } from '@/utils/tag-styles';
import type { Supertag } from '@/types';

interface NodeContentProps {
  nodeContent: string;
  showEditableContent: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  onInput: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onRowClick: (e: MouseEvent) => void;
  typeTags: Supertag[];
  onRemoveTag: (tagId: string) => void;
  onOpenTagSelector: (e: MouseEvent<HTMLButtonElement>) => void;
  backlinksBadge?: ReactNode;
}

export default function NodeContent({
  nodeContent,
  showEditableContent,
  contentRef,
  onInput,
  onKeyDown,
  onFocus,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  onRowClick,
  typeTags,
  onRemoveTag,
  onOpenTagSelector,
  backlinksBadge,
}: NodeContentProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showEditableContent ? (
        <div className="relative flex-1 min-w-[120px]">
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onInput}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            className={cn(
              "relative outline-none min-h-[24px] leading-6 text-gray-800 dark:text-gray-200 w-full",
              "empty:before:content-['输入内容...'] empty:before:text-gray-400",
              'bg-transparent'
            )}
            style={{
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'plaintext',
            }}
            data-placeholder="输入内容..."
          >
            {nodeContent}
          </div>
        </div>
      ) : (
        <div
          onClick={onRowClick}
          className={cn('min-h-[24px] leading-6 text-gray-800 dark:text-gray-200 flex-1 min-w-[80px] cursor-text')}
        >
          <ContentWithReferences content={nodeContent} />
        </div>
      )}

      {typeTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          {typeTags.map((tag) => {
            const typeStyle = getTagStyle(tag);
            return (
              <div key={tag.id} className="group/tag relative inline-flex items-center">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full cursor-default select-none',
                    'shadow-sm transition-all duration-200',
                    'hover:shadow-md hover:scale-105',
                    typeStyle.gradient,
                    typeStyle.text
                  )}
                >
                  <span className="text-sm">{typeStyle.icon}</span>
                  <span>{tag.name}</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTag(tag.id);
                  }}
                  className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center rounded-full bg-gray-500 hover:bg-red-500 text-white opacity-0 group-hover/tag:opacity-100 transition-all shadow-sm"
                  title={`移除 #${tag.name}`}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="tag-selector opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 flex-shrink-0"
        title="添加标签 (#)"
        onClick={onOpenTagSelector}
      >
        <Hash size={12} />
      </Button>

      {backlinksBadge}
    </div>
  );
}
