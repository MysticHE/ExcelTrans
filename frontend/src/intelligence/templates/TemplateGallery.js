import React, { useEffect, useState } from 'react';
import { User, Hospital, RefreshCw, MapPin, LayoutTemplate, ArrowRight, X } from 'lucide-react';
import { listTemplates, getTemplate } from '../services/intelApi';
import { Modal, Button, Badge, Spinner, Card } from '../ui';

const TEMPLATE_ICON_MAP = {
  mediacorp_el: User,
  gp_panel: Hospital,
  renewal_comparison: RefreshCw,
  clinic_matcher: MapPin,
};

export default function TemplateGallery({ onApply, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);

  useEffect(() => {
    listTemplates().then(data => {
      setTemplates(data.templates || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleApply = async (slug) => {
    setApplying(slug);
    try {
      const tmpl = await getTemplate(slug);
      if (!tmpl.error) onApply(tmpl);
    } finally {
      setApplying(null);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Template Gallery</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <Spinner className="w-6 h-6" />
              <span className="text-sm">Loading templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <LayoutTemplate className="w-8 h-8 text-gray-300" />
              <p className="text-sm">No templates available</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {templates.map(tmpl => {
                const IconComponent = TEMPLATE_ICON_MAP[tmpl.slug] || LayoutTemplate;
                return (
                  <Card
                    key={tmpl.slug}
                    hover
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <IconComponent className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tmpl.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{tmpl.description}</p>
                        {tmpl.is_builtin && (
                          <Badge variant="blue" className="mt-1.5">Built-in</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApply(tmpl.slug)}
                      disabled={applying === tmpl.slug}
                      loading={applying === tmpl.slug}
                    >
                      {applying !== tmpl.slug && (
                        <>Apply <ArrowRight className="w-3.5 h-3.5" /></>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
