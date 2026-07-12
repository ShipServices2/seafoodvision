'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Clock, AlertCircle, BookOpen, Layers, Shield, Users, Database, GitBranch } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


const STATUS_LEGEND = [
  { label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, desc: 'Confirmed by a human reviewer with at least one traceable source.' },
  { label: 'Under Review', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, desc: 'Proposed data awaiting validation by a qualified reviewer.' },
  { label: 'Source Available', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: BookOpen, desc: 'A source document or reference is attached but not yet fully validated.' },
  { label: 'Demo', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Layers, desc: 'Sample data for platform demonstration. Excluded from real statistics.' },
  { label: 'Disputed', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, desc: 'Conflicting information exists. Resolution is pending.' },
  { label: 'Obsolete', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertCircle, desc: 'Previously valid data that is no longer current.' },
];

const ROLES = [
  { role: 'Public', access: 'Read verified, public, non-confidential data only. No write access.' },
  { role: 'Member', access: 'Same as public. No write access to the Knowledge Graph.' },
  { role: 'Reviewer', access: 'Can create proposals, add comments, and perform assigned validations.' },
  { role: 'Administrator', access: 'Can validate, manage relations, resolve conflicts, manage sources.' },
  { role: 'Super Admin', access: 'Can restore versions, manage sensitive permissions, configure the system.' },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Methodology</span>
        </nav>

        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Knowledge Methodology</p>
          <h1 className="text-3xl font-bold text-foreground mb-4">How Seafood Vision Knowledge Works</h1>
          <p className="text-muted-foreground leading-relaxed mb-10">
            The Seafood Vision encyclopedia is built on a structured, traceable knowledge graph. Every piece of information has a status, a source, and a validation history. Nothing is presented as certain without human review and a reliable source.
          </p>

          {/* Data pipeline */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Database size={18} className="text-secondary" /> Data Preparation Pipeline
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {[
                { step: '1', title: 'Source Collection', desc: 'Data originates from real media assets, supplier documents, official databases, scientific publications, and internal professional experience. No automatic internet scraping.' },
                { step: '2', title: 'Codex Preparation', desc: 'Codex processes local media libraries, extracts structured metadata, prepares cleaned exports, and flags candidates for human review. All outputs remain unverified until validated.' },
                { step: '3', title: 'Human Validation', desc: 'Reviewers and administrators examine each data point. A claim cannot reach "Verified" status without a traceable source and a human decision.' },
                { step: '4', title: 'Versioning', desc: 'Every modification is recorded. Previous versions are preserved. Corrections are traceable. No data is silently overwritten.' },
                { step: '5', title: 'Conflict Resolution', desc: 'When contradictory information exists, a conflict record is created. Both values remain visible until a qualified reviewer resolves the conflict.' },
                { step: '6', title: 'Public Publication', desc: 'Only verified, public, non-confidential data is visible to the public. Demo data is clearly labeled and excluded from real statistics.' },
              ]?.map((item) => (
                <div key={item?.step} className="flex gap-4 p-5 border-b border-border last:border-0">
                  <div className="w-7 h-7 rounded-full bg-ocean-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item?.step}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{item?.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item?.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Status legend */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Shield size={18} className="text-secondary" /> Knowledge Status Legend
            </h2>
            <div className="space-y-3">
              {STATUS_LEGEND?.map((s) => {
                const Icon = s?.icon;
                return (
                  <div key={s?.label} className="flex items-start gap-3 bg-card rounded-xl border border-border p-4">
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${s?.color}`}>
                      <Icon size={11} /> {s?.label}
                    </span>
                    <p className="text-sm text-muted-foreground">{s?.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Roles */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Users size={18} className="text-secondary" /> Access Roles
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {ROLES?.map((r) => (
                <div key={r?.role} className="flex gap-4 px-5 py-3.5 border-b border-border last:border-0">
                  <span className="text-sm font-semibold text-foreground w-28 shrink-0">{r?.role}</span>
                  <p className="text-sm text-muted-foreground">{r?.access}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Versioning */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <GitBranch size={18} className="text-secondary" /> Versioning & Conflicts
            </h2>
            <div className="bg-card rounded-xl border border-border p-5 space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>Every entity in the knowledge graph maintains a full version history. When a value is corrected, the previous version is preserved and traceable.</p>
              <p>When two sources provide contradictory information, a conflict record is created. Both values remain visible with their respective sources until a qualified reviewer resolves the conflict.</p>
              <p>Restorations to previous versions are audited and require administrator-level access.</p>
            </div>
          </section>

          {/* Limits */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4">What This System Does Not Do</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                'Automatically import data from the internet or Wikipedia',
                'Scrape external websites',
                'Use AI to generate or infer knowledge claims',
                'Provide definitive regulatory or legal advice',
                'Certify companies, products, or facilities',
                'Validate origins from images alone',
                'Display unverified market prices',
                'Expose confidential documents',
              ]?.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex gap-3">
            <Link href="/knowledge/sources" className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:border-secondary/40 transition-colors">
              View Sources
            </Link>
            <Link href="/knowledge/disclaimer" className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:border-secondary/40 transition-colors">
              Disclaimer
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
