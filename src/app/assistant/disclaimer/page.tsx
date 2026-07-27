'use client';

import React from 'react';
import Link from 'next/link';
import { TriangleAlert as AlertTriangle, ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const DISCLAIMER_SECTIONS = [
  {
    title: 'Database limitations',
    content: 'The Seafood Vision knowledge base is continuously updated but may not contain all species, products, certifications, or regulations. Absence of information does not imply non-existence.',
  },
  {
    title: 'Possibility of error',
    content: 'Despite verification processes, information may contain inaccuracies. Data may have changed since last verification. Always cross-reference critical information with primary sources.',
  },
  {
    title: 'Evolving data',
    content: 'Seafood regulations, certifications, market conditions, and scientific classifications evolve. Information displayed reflects the state of the Seafood Vision database at the time of the query.',
  },
  {
    title: 'No legal advice',
    content: 'Nothing in this assistant constitutes legal advice. For legal matters related to seafood trade, import/export, labeling, or intellectual property, consult a qualified legal professional.',
  },
  {
    title: 'No medical advice',
    content: 'Information about allergens, nutritional content, or health properties is provided for reference only and does not constitute medical advice. Consult a healthcare professional for medical decisions.',
  },
  {
    title: 'No commercial guarantee',
    content: 'The assistant does not guarantee product availability, pricing, supplier relationships, or commercial terms. Commercial information is for reference only.',
  },
  {
    title: 'No regulatory validation',
    content: 'The assistant cannot validate regulatory compliance for any specific market, product, or use case. Regulatory requirements vary by country and change frequently.',
  },
  {
    title: 'Certification information',
    content: 'Certification references are informational only. The assistant cannot confirm current certification status, scope, or validity. Contact the relevant certification body for official confirmation.',
  },
  {
    title: 'Consult competent authorities',
    content: 'For food safety, import/export compliance, customs requirements, health regulations, and certification validation, always consult the relevant national authority or certification body.',
  },
];

export default function AssistantDisclaimerPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link href="/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Back to Assistant
          </Link>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Disclaimer</h1>
              <p className="text-sm text-muted-foreground mt-1">Important limitations and terms of use</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
            <p className="text-sm text-amber-800 font-medium">
              This assistant is a professional reference tool based on the Seafood Vision knowledge base. It is not a substitute for expert advice, regulatory verification, or official certification.
            </p>
          </div>

          <div className="space-y-4">
            {DISCLAIMER_SECTIONS?.map((section, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-2">{section?.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{section?.content}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-5 bg-muted/50 rounded-2xl border border-border">
            <p className="text-xs text-muted-foreground text-center">
              By using the Seafood Vision Assistant, you acknowledge these limitations and agree that responses are for professional reference purposes only. Last updated: July 2026.
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <Link href="/assistant" className="btn-primary text-sm">
              Return to Assistant
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
