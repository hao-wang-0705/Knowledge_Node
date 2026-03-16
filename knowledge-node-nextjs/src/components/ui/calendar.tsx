'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = Omit<
  React.ComponentProps<typeof DayPicker>,
  'mode' | 'disabled' | 'selected' | 'onDayClick'
> & {
  /** 有笔记的日期 ID 列表（day-YYYY-MM-DD），仅这些日期可点击 */
  existingDayIds: string[];
  /** 当前选中的日期（对应当前聚焦的日笔记） */
  selectedDate: Date | null;
  /** 选择日期时回调（仅在有笔记的日期点击时触发） */
  onSelectDate: (date: Date) => void;
};

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `day-${y}-${m}-${d}`;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  existingDayIds,
  selectedDate,
  onSelectDate,
  ...props
}: CalendarProps) {
  const existingSet = React.useMemo(
    () => new Set(existingDayIds),
    [existingDayIds]
  );

  const disabled = React.useCallback(
    (date: Date) => !existingSet.has(toDateKey(date)),
    [existingSet]
  );

  const handleDayClick = React.useCallback(
    (day: Date, activeModifiers: { disabled?: boolean }, e: React.MouseEvent) => {
      if (activeModifiers.disabled) return;
      onSelectDate(day);
    },
    [onSelectDate]
  );

  return (
    <DayPicker
      mode="default"
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        nav_button: cn(
          'inline-flex items-center justify-center size-7 rounded-md border border-input bg-transparent opacity-50 hover:opacity-100 hover:bg-accent'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-x-1',
        head_row: 'flex',
        head_cell:
          'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day: cn(
          'inline-flex items-center justify-center size-8 rounded-md p-0 font-normal',
          'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        ),
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent/50 text-accent-foreground',
        day_outside: 'text-muted-foreground opacity-50',
        day_disabled: 'text-muted-foreground opacity-40 cursor-not-allowed',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: c, ...rest }) => (
          <ChevronLeft className={cn('size-4', c)} {...rest} />
        ),
        IconRight: ({ className: c, ...rest }) => (
          <ChevronRight className={cn('size-4', c)} {...rest} />
        ),
      }}
      modifiers={{
        hasNote: (date) => existingSet.has(toDateKey(date)),
      }}
      modifiersClassNames={{
        hasNote:
          'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary after:content-[\'\']',
      }}
      {...props}
      selected={selectedDate ?? undefined}
      disabled={disabled}
      onDayClick={handleDayClick}
    />
  );
}

export { Calendar };
