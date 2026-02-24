import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '../ui';

const TEMPLATE_LABELS = {
  mediacorp_el: 'Mediacorp Employee ADC',
  gp_panel: 'GP Panel Comparison',
  renewal_comparison: 'Renewal Comparison',
  clinic_matcher: 'Clinic Matcher',
};

export default function AISuggestionBanner({ slug, onApply, onDismiss }) {
  if (!slug || slug === 'none') return null;

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-indigo-900">Template Detected</p>
          <p className="text-xs text-indigo-700">
            This looks like a{' '}
            <span className="font-bold">{TEMPLATE_LABELS[slug] || slug}</span>{' '}
            file. Apply the template to pre-fill all settings.
          </p>
        </div>
      </div>
      <div className="flex gap-2 ml-4 shrink-0">
        <Button variant="primary" size="sm" onClick={onApply}>
          Apply Template
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
