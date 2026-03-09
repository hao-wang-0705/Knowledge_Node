/**
 * 解析错误提示组件
 * v3.5: 展示 AI 解析失败的错误信息和建议
 */

import React from 'react';
import { AlertCircle, Lightbulb, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ParseErrorAlertProps {
  /** 错误信息 */
  error: string;
  /** 建议列表 */
  suggestions?: string[];
  /** 重试回调 */
  onRetry?: () => void;
  /** 切换到手动模式回调 */
  onSwitchToManual?: () => void;
  /** 额外的类名 */
  className?: string;
}

const ParseErrorAlert: React.FC<ParseErrorAlertProps> = ({
  error,
  suggestions,
  onRetry,
  onSwitchToManual,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-rose-50',
        className
      )}
    >
      {/* 错误信息 */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-4 w-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700">解析失败</p>
          <p className="mt-0.5 text-sm text-red-600">{error}</p>
        </div>
      </div>

      {/* 建议列表 */}
      {suggestions && suggestions.length > 0 && (
        <div className="border-t border-red-100 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>建议</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((suggestion, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-slate-600"
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 border-t border-red-100 px-4 py-3">
        {onSwitchToManual && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSwitchToManual}
            className="gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>手动配置</span>
          </Button>
        )}
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>重试</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default ParseErrorAlert;
