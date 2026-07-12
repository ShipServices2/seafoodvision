'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission placeholder — backend integration pending
    setSent(true);
    toast.success('Message sent. We will get back to you shortly.');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl">
          {/* Left */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Contact</p>
            <h1 className="text-4xl font-bold text-foreground mb-4">Get in touch</h1>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Questions about licensing, the platform, or a custom enterprise arrangement? We&apos;re happy to help.
            </p>

            <div className="space-y-4">
              {[
                { label: 'Licensing enquiries', desc: 'Questions about commercial or editorial licenses' },
                { label: 'Enterprise & API', desc: 'Custom arrangements for large-scale use' },
                { label: 'Copyright claims', desc: 'Report unauthorized use of your content' },
                { label: 'General questions', desc: 'Anything else about the platform' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-card rounded-2xl border border-border p-8">
            {sent ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={24} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Message sent</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Thank you for reaching out. We will get back to you as soon as possible.
                </p>
                <Link href="/" className="btn-outline">Back to home</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="input-base w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input-base w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="input-base w-full"
                    required
                  >
                    <option value="">Select a subject</option>
                    <option value="licensing">Licensing enquiry</option>
                    <option value="enterprise">Enterprise / API</option>
                    <option value="copyright">Copyright claim</option>
                    <option value="general">General question</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Your message…"
                    rows={5}
                    className="input-base w-full resize-none"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary w-full justify-center mt-2">
                  Send message
                  <ArrowRight size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
