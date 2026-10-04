'use client';

import React from 'react';
import { Briefcase, ExternalLink, Mail, Globe } from 'lucide-react';

interface BusinessService {
  id: string;
  service_type: string;
  title: string;
  description: string | null;
  contact_info: {
    email?: string;
    phone?: string;
    company?: string;
  } | null;
  url: string | null;
}

interface Props {
  services: BusinessService[];
  speciesName: string;
}

const SERVICE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  sourcing: { label: 'Sourcing', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🎣' },
  processing: { label: 'Processing', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '🏭' },
  logistics: { label: 'Logistics', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🚢' },
  certification: { label: 'Certification', color: 'bg-green-50 text-green-700 border-green-200', icon: '✅' },
  consulting: { label: 'Consulting', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: '💼' },
  quality: { label: 'Quality Control', color: 'bg-red-50 text-red-700 border-red-200', icon: '🔬' },
};

// Default services shown when no custom services exist
const DEFAULT_SERVICES = [
  {
    id: 'default-1',
    service_type: 'sourcing',
    title: 'Find Verified Suppliers',
    description: 'Connect with verified suppliers and exporters for this species through our professional network.',
    contact_info: null,
    url: '/contact',
  },
  {
    id: 'default-2',
    service_type: 'consulting',
    title: 'Species Intelligence Consulting',
    description: 'Get expert advice on commercial use, regulations, and market opportunities for this species.',
    contact_info: null,
    url: '/contact',
  },
  {
    id: 'default-3',
    service_type: 'certification',
    title: 'Certification Assistance',
    description: 'Navigate certification requirements and connect with accredited certification bodies.',
    contact_info: null,
    url: '/contact',
  },
];

export default function HubBusinessServices({ services, speciesName }: Props) {
  const displayServices = services.length > 0 ? services : DEFAULT_SERVICES;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Business Services</h3>
      </div>

      <div className="space-y-3">
        {displayServices.map((service) => {
          const config = SERVICE_TYPE_CONFIG[service.service_type] || {
            label: service.service_type,
            color: 'bg-muted text-muted-foreground border-border',
            icon: '🔧',
          };

          return (
            <div key={service.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{config.icon}</span>
                  <h4 className="text-sm font-semibold text-foreground">{service.title}</h4>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${config.color}`}>
                  {config.label}
                </span>
              </div>

              {service.description && (
                <p className="text-xs text-muted-foreground mb-3">{service.description}</p>
              )}

              <div className="flex items-center gap-3">
                {service.contact_info?.email && (
                  <a
                    href={`mailto:${service.contact_info.email}`}
                    className="flex items-center gap-1 text-xs text-secondary hover:underline"
                  >
                    <Mail size={11} />
                    {service.contact_info.email}
                  </a>
                )}
                {service.url && (
                  <a
                    href={service.url}
                    className="flex items-center gap-1 text-xs text-secondary hover:underline"
                  >
                    <ExternalLink size={11} />
                    Learn more
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-br from-ocean-50 to-blue-50 border border-ocean-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={14} className="text-secondary" />
          <p className="text-sm font-semibold text-foreground">Need a custom service for {speciesName}?</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Contact our team to discuss sourcing, processing, logistics, or certification services tailored to your needs.
        </p>
        <a
          href="/contact"
          className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-ocean-800 transition-colors"
        >
          Contact Us
        </a>
      </div>
    </div>
  );
}
