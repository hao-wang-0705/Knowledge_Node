import { X } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { ContentWithReferences } from '@/components/ReferenceChip';
import UnifiedNodeEditor, { UnifiedNodeEditorHandle } from '@/components/editor/UnifiedNodeEditor';
import type { NodeReference } from '@/types';
import { getTagStyle } from '@/utils/tag-styles';
import type { Supertag } from '@/types';

interface NodeContentProps {
  nodeContent: string;
  showEditableContent: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  editorRef?: RefObject<UnifiedNodeEditorHandle | null>;
  onInput: () => void;
  onEditorChange?: (next: { content: string; references: NodeReference[] }) => void;
  onMentionTrigger?: (position: { x: number; y: number }) => void;
  onHashTrigger?: (position: { x: number; y: number }, searchTerm: string) => void;
  onHashDismiss?: () => void;
  onPlainEnter?: () => boolean;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onRowClick: (e: MouseEvent) => void;
  typeTags: Supertag[];
  onRemoveTag: (tagId: string) => void;
  onTagClick?: () => void;
  backlinksBadge?: ReactNode;
  references?: NodeReference[];
}

export default function NodeContent({
  nodeContent,
  showEditableContent,
  contentRef,
  editorRef,
  onInput,
  onEditorChange,
  onMentionTrigger,
  onHashTrigger,
  onHashDismiss,
  onPlainEnter,
  onKeyDown,
  onFocus,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  onRowClick,
  typeTags,
  onRemoveTag,
  onTagClick,
  backlinksBadge,
  references,
}: NodeContentProps) {
  return (
    <div className="pr-10 leading-6 min-h-[24px]">
      {showEditableContent ? (
        <>
          {FEATURE_FLAGS.UNIFIED_INPUT_KERNEL ? (
            <UnifiedNodeEditor
              ref={editorRef}
              value={nodeContent}
              references={references}
              contentRef={contentRef}
              onChange={onEditorChange}
              onMentionTrigger={onMentionTrigger}
              onHashTrigger={onHashTrigger}
              onHashDismiss={onHashDismiss}
              onPlainEnter={onPlainEnter}
              onInput={onInput}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              className={cn(
                'outline-none leading-6 inline',
                'text-gray-800 dark:text-gray-200 bg-transparent'
              )}
              placeholder="输入内容..."
            />
          ) : (
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
                'outline-none leading-6 inline',
                'text-gray-800 dark:text-gray-200 bg-transparent'
              )}
              data-placeholder="输入内容..."
            >
              {nodeContent}
            </div>
          )}
        </>
      ) : (
        <span
          onClick={onRowClick}
          className="leading-6 text-gray-800 dark:text-gray-200 cursor-text"
        >
          <ContentWithReferences content={nodeContent} references={references} interactive={false} />
        </span>
      )}

      {typeTags.map((tag) => {
        const typeStyle = getTagStyle(tag);
        return (
          <span key={tag.id} className="inline-flex items-center ml-2 align-middle group/tag relative">
            <span
              data-tag-badge
              role={onTagClick ? 'button' : undefined}
              tabIndex={onTagClick ? 0 : undefined}
              className={cn(
                'tag-badge inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full select-none',
                onTagClick ? 'cursor-pointer' : 'cursor-default',
                'shadow-sm transition-all duration-200',
                'hover:shadow-md hover:scale-105',
                typeStyle.gradient,
                typeStyle.text
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (onTagClick) onTagClick();
              }}
              onKeyDown={(e) => {
                if (onTagClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onTagClick();
                }
              }}
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
          </span>
        );
      })}

      {backlinksBadge}
    </div>
  );
}
