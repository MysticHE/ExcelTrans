import React, { useState } from 'react';

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
  primary:   'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm hover:shadow focus-visible:ring-indigo-400',
  secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-gray-300',
  ghost:     'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300',
  danger:    'bg-red-500 text-white hover:bg-red-600 shadow-sm focus-visible:ring-red-400',
  success:   'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm focus-visible:ring-emerald-400',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-base gap-2',
};

export function Button({ variant = 'primary', size = 'md', loading = false, children, className, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
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
        'bg-white border rounded-xl transition-all duration-150',
        hover && 'hover:shadow-md hover:-translate-y-px',
        selected
          ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-500/15 bg-indigo-50/40'
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
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  green:  'bg-green-50 border-green-200 text-green-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  gray:   'bg-gray-100 border-gray-200 text-gray-600',
  red:    'bg-red-50 border-red-200 text-red-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  teal:   'bg-teal-50 border-teal-200 text-teal-700',
};

export function Badge({ variant = 'gray', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
        BADGE_VARIANTS[variant] || BADGE_VARIANTS.gray,
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
        'focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400',
        'placeholder:text-gray-400 transition-all duration-150',
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
        'focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400',
        'placeholder:text-gray-400 transition-all duration-150',
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
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
          value ? 'bg-indigo-500' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200',
            value ? 'left-6' : 'left-1'
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
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.5)' }}
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
  error:   'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info:    'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

export function Alert({ variant = 'info', children, className }) {
  return (
    <div
      className={cn(
        'border rounded-xl p-3.5 text-sm flex items-start gap-2.5',
        ALERT_VARIANTS[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-gray-400" />
        </div>
      )}
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      {description && <p className="text-xs text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
export function Tooltip({ content, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && content && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap">
          <span className="block bg-gray-900 text-white text-xs font-medium px-2.5 py-1 rounded-lg shadow-lg">
            {content}
          </span>
          <span className="block w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1 rounded-sm" />
        </span>
      )}
    </span>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, className }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn('w-full bg-gray-100 rounded-full h-1.5 overflow-hidden', className)}>
      <div
        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
