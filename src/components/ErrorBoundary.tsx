/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ErrorBoundary — Catches unhandled React rendering errors
 *
 * Uses a thin class-based wrapper (required by React's error boundary API)
 * but avoids @types/react by using createElement directly.
 * Shows a recoverable error UI with a retry button.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// React's error boundary API requires class components.
// We use createElement to avoid TypeScript class-property issues
// in projects without @types/react.

function ErrorFallback({ error, onRetry, title }: {
  error: Error | null;
  onRetry: () => void;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0a0c0f] p-6 select-none">
      <div className="bg-[#111318] border border-red-500/20 rounded-2xl p-6 max-w-sm w-full flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-[15px] font-bold text-neutral-200 mb-1">
          {title}
        </h2>
        <p className="text-[11px] text-neutral-500 mb-4 font-mono break-all">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider active:scale-95 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

// Minimal class-based error boundary — uses `any` typing to work
// in projects without @types/react class component declarations.
const ErrorBoundaryClass = (function () {
  function EB(this: any, props: ErrorBoundaryProps) {
    React.Component.call(this, props);
    this.state = { hasError: false, error: null };
  }

  EB.prototype = Object.create(React.Component.prototype);
  EB.prototype.constructor = EB;

  EB.getDerivedStateFromError = function (error: Error) {
    return { hasError: true, error };
  };

  EB.prototype.componentDidCatch = function (this: any, error: Error, info: any) {
    console.error('[ErrorBoundary] Caught rendering error:', error, info?.componentStack);
  };

  EB.prototype.render = function (this: any) {
    if (this.state.hasError) {
      return React.createElement(ErrorFallback, {
        error: this.state.error,
        onRetry: () => this.setState({ hasError: false, error: null }),
        title: this.props.fallbackTitle || 'Something went wrong',
      });
    }
    return this.props.children;
  };

  return EB as any;
})();

export default ErrorBoundaryClass as React.ComponentType<ErrorBoundaryProps>;
