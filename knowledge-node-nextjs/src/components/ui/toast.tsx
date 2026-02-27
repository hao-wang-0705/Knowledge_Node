/**
 * Toast 通知组件
 * 
 * 轻量级通知系统，用于显示操作反馈
 * 
 * @author Knowledge Node Team
 * @version 1.0.0
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertCircle, Info, X, Loader2 } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, toast: Partial<Omit<Toast, 'id'>>) => void;
}

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ============================================
// Toast Provider
// ============================================

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    
    // 自动移除（除了 loading 类型）
    if (toast.type !== 'loading' && toast.duration !== 0) {
      const duration = toast.duration || (toast.type === 'error' ? 5000 : 3000);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    
    // 如果更新为非 loading 类型，设置自动移除
    if (updates.type && updates.type !== 'loading') {
      const duration = updates.duration || (updates.type === 'error' ? 5000 : 3000);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// ============================================
// Toast Container
// ============================================

const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
};

// ============================================
// Toast Item
// ============================================

const ToastItem: React.FC<{
  toast: Toast;
  onRemove: () => void;
}> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 200);
  }, [onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check size={16} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'info':
        return <Info size={16} className="text-blue-500" />;
      case 'loading':
        return <Loader2 size={16} className="text-gray-500 animate-spin" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800';
      case 'loading':
        return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border',
        'backdrop-blur-sm min-w-[250px] max-w-[400px]',
        'transition-all duration-200 ease-out',
        getStyles(),
        isExiting
          ? 'animate-out fade-out-0 slide-out-to-right-full'
          : 'animate-in fade-in-0 slide-in-from-right-full zoom-in-95'
      )}
    >
      <span className="shrink-0">{getIcon()}</span>
      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
        {toast.message}
      </span>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-md',
            'bg-white/50 dark:bg-black/20',
            'hover:bg-white dark:hover:bg-black/40',
            'text-gray-700 dark:text-gray-300',
            'transition-colors'
          )}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleRemove}
        className={cn(
          'shrink-0 w-5 h-5 rounded-full',
          'flex items-center justify-center',
          'text-gray-400 hover:text-gray-600',
          'hover:bg-gray-200/50 dark:hover:bg-gray-700/50',
          'transition-colors'
        )}
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ============================================
// 便捷 Hook
// ============================================

/**
 * 便捷的 toast 方法
 */
export const useToastActions = () => {
  const { addToast, removeToast, updateToast } = useToast();

  return {
    success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => 
      addToast({ type: 'success', message, ...options }),
    
    error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => 
      addToast({ type: 'error', message, ...options }),
    
    info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => 
      addToast({ type: 'info', message, ...options }),
    
    loading: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => 
      addToast({ type: 'loading', message, duration: 0, ...options }),
    
    dismiss: removeToast,
    update: updateToast,
    
    /**
     * 异步操作的 toast 辅助函数
     */
    promise: async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: Error) => string);
      }
    ): Promise<T> => {
      const toastId = addToast({ type: 'loading', message: messages.loading, duration: 0 });
      
      try {
        const result = await promise;
        updateToast(toastId, {
          type: 'success',
          message: typeof messages.success === 'function' ? messages.success(result) : messages.success,
        });
        return result;
      } catch (error) {
        updateToast(toastId, {
          type: 'error',
          message: typeof messages.error === 'function' ? messages.error(error as Error) : messages.error,
        });
        throw error;
      }
    },
  };
};

export default ToastProvider;
