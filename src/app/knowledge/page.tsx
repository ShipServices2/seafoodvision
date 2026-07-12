'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Database, GitBranch, FileText, BookOpen, Award, Globe, ShoppingBag, Package, ArrowRight } from 'lucide-react';

export default function KnowledgePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-4">
            <Database className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Seafood Knowledge Engine</h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            A structured knowledge graph linking seafood species, commercial products, presentations, markets, certifications and documents — with traceable sources and human validation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {[
            { icon: Database, label: 'Knowledge Entities', desc: 'Species, products, markets, certifications and more', color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: GitBranch, label: 'Relations', desc: 'Traceable links between all knowledge entities', color: 'text-violet-600', bg: 'bg-violet-50' },
            { icon: FileText, label: 'Claims & Evidence', desc: 'Sourced assertions with validation status', color: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: BookOpen, label: 'Sources', desc: 'Origin and reliability of every piece of data', color: 'text-teal-600', bg: 'bg-teal-50' },
            { icon: Award, label: 'Certifications', desc: 'MSC, ASC, Halal, BRC and more — with claim status', color: 'text-green-600', bg: 'bg-green-50' },
            { icon: Globe, label: 'Markets', desc: 'Retail, wholesale, foodservice and regional markets', color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { icon: ShoppingBag, label: 'Commercial Products', desc: 'Products linked to species, forms and packaging', color: 'text-orange-600', bg: 'bg-orange-50' },
            { icon: Package, label: 'Packaging', desc: 'Configurations with weights, units and market links', color: 'text-pink-600', bg: 'bg-pink-50' },
          ]?.map((item) => (
            <div key={item?.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg ${item?.bg} flex items-center justify-center flex-shrink-0`}>
                <item.icon className={`w-4 h-4 ${item?.color}`} />
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{item?.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{item?.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 text-center">
          <p className="text-sm text-teal-700 mb-4">
            The Knowledge Graph is managed by administrators and reviewers. Public access to verified data is available through the catalogue.
          </p>
          <Link href="/admin/knowledge" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
            Open Knowledge Admin <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
