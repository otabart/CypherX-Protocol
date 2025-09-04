import React from 'react';
import { FiAlertCircle, FiX, FiRefreshCw } from 'react-icons/fi';

interface ErrorDisplayProps {
  error: string;
  variant?: 'inline' | 'card' | 'toast';
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  variant = 'inline',
  onRetry,
  onDismiss,
  className = ''
}) => {
  if (variant === 'card') {
    return (
      <div className={`bg-red-900/20 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 text-sm">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 inline-flex items-center gap-2 text-xs text-red-300 hover:text-red-200 transition-colors"
              >
                <FiRefreshCw className="w-3 h-3" />
                Try Again
              </button>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'toast') {
    return (
      <div className={`bg-red-900/90 border border-red-500/50 rounded-lg p-3 shadow-lg ${className}`}>
        <div className="flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-200 text-sm">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-auto text-xs text-red-300 hover:text-red-200 transition-colors"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <FiX className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default inline variant
  return (
    <div className={`flex items-center gap-2 text-red-400 ${className}`}>
      <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm">{error}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-red-300 hover:text-red-200 transition-colors underline"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default ErrorDisplay;
