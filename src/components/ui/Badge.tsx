'use client';

import React from 'react';
import { CheckCircle2, Camera, Clock, Eye, ShoppingCart, FileText, Star, Archive, XCircle } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


export type BadgeVariant =
  | 'verified'
  | 'real-photo' |'coming-soon' |'editorial' |'commercial' |'draft' |'under-review' |'approved' |'preview-only' |'restricted' |'rejected' |'archived' |'demo' |'new';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const badgeConfig: Record<BadgeVariant, { label: string; className: string; icon: React.ElementType }> = {
  verified: { label: 'Verified', className: 'badge-verified', icon: CheckCircle2 },
  'real-photo': { label: 'Real Photo', className: 'badge-real-photo', icon: Camera },
  'coming-soon': { label: 'Coming Soon', className: 'badge-coming-soon', icon: Star },
  editorial: { label: 'Editorial', className: 'badge-editorial', icon: FileText },
  commercial: { label: 'Commercial', className: 'badge-commercial', icon: ShoppingCart },
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border border-border', icon: Clock },
  'under-review': { label: 'Under Review', className: 'bg-amber-50 text-amber-700 border border-amber-200', icon: Clock },
  approved: { label: 'Approved', className: 'badge-verified', icon: CheckCircle2 },
  'preview-only': { label: 'Preview Only', className: 'badge-real-photo', icon: Eye },
  restricted: { label: 'Restricted', className: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground border border-border', icon: Archive },
  demo: { label: 'Demo', className: 'bg-purple-50 text-purple-700 border border-purple-200', icon: Star },
  new: { label: 'New', className: 'bg-teal-50 text-teal-700 border border-teal-200', icon: Star },
};

export default function Badge({ variant, label, size = 'sm', showIcon = true, className = '' }: BadgeProps) {
  const config = badgeConfig[variant];
  const displayLabel = label || config.label;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
      } ${config.className} ${className}`}
    >
      {showIcon && <Icon size={size === 'sm' ? 10 : 12} />}
      {displayLabel}
    </span>
  );
}