import React from 'react';

// Utility: merge class names
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ className }) {
  return (
    <svg
      className={cn('animate-spin', className || 'w-4 h-4')}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────
const BUTTON_VARIANTS = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm',
  secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300',
  ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, hover, selected, className, ...props }) {
  return (
    <div
      className={cn(
        'bg-white border rounded-xl transition-all',
        hover && 'hover:shadow-md',
        selected
          ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500/20 bg-indigo-50/30'
          : 'border-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_VARIANTS = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  gray: 'bg-gray-100 border-gray-200 text-gray-600',
  red: 'bg-red-50 border-red-200 text-red-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
};

export function Badge({ variant = 'gray', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        BADGE_VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'placeholder:text-gray-400 transition-shadow',
        className
      )}
      {...props}
    />
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────
export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'placeholder:text-gray-400 transition-shadow',
        className
      )}
      {...props}
    />
  );
}

// ── Toggle (pill switch with label/desc) ──────────────────────────────────────
export function Toggle({ label, desc, value, onChange }) {
  return (
    <div className="flex w-full items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="mr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative overflow-hidden flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          value ? 'bg-indigo-500' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
            value ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

// ── Modal (backdrop + centered dialog wrapper) ────────────────────────────────
export function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
const ALERT_VARIANTS = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-green-50 border-green-200 text-green-700',
};

export function Alert({ variant = 'info', children, className }) {
  return (
    <div
      className={cn(
        'border rounded-lg p-3 text-sm flex items-start gap-2',
        ALERT_VARIANTS[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
