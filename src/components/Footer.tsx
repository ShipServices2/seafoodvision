import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { Mail } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';



// Social icon SVGs
function InstagramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function TwitterIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function LinkedinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12" fill="currentColor"/>
      <circle cx="4" cy="4" r="2" fill="currentColor"/>
    </svg>
  );
}

function YoutubeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
    </svg>
  );
}

const footerLinks = {
  platform: {
    title: 'Platform',
    links: [
      { href: '/library', label: 'Visual Library' },
      { href: '/species', label: 'Species Index' },
      { href: '/collections', label: 'Collections' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/pricing/compare', label: 'Compare Plans' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/licensing', label: 'Licensing' },
      { href: '/enterprise', label: 'Enterprise' },
      { href: '/pricing/faq', label: 'Pricing FAQ' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  coming: {
    title: 'Coming Soon',
    links: [
      { href: '/identify', label: 'Species Identifier ★' },
      { href: '/marketing-kit', label: 'Marketing Kit ★' },
      { href: '/knowledge', label: 'Knowledge Base ★' },
      { href: '/api-access', label: 'API Access ★' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Use' },
      { href: '/copyright', label: 'Copyright' },
      { href: '/licensing', label: 'Licensing Terms' },
    ],
  },
};

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground mt-20">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-16 pb-8">
        {/* Top row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <AppLogo size={40} />
              <span className="font-bold text-lg tracking-tight text-white">
                SeafoodVision
              </span>
            </div>
            <p className="text-sm text-white/65 leading-relaxed mb-5 max-w-xs">
              The global platform of real photos, visual content and professional knowledge on seafood products.
            </p>
            <p className="text-xs font-mono-data text-white/40 italic mb-5">
              "Real Seafood. Real Images. Trusted Worldwide."
            </p>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[
                { IconComp: InstagramIcon, label: 'Instagram' },
                { IconComp: TwitterIcon, label: 'Twitter / X' },
                { IconComp: LinkedinIcon, label: 'LinkedIn' },
                { IconComp: YoutubeIcon, label: 'YouTube' },
              ]?.map(({ IconComp, label }) => {
                const Icon = IconComp as React.FC<{ size?: number }>;
                return (
                  <button
                    key={`social-${label}`}
                    aria-label={label}
                    className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/40 transition-all duration-150"
                  >
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(footerLinks)?.map(([key, section]) => (
            <div key={`footer-section-${key}`}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
                {section?.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {section?.links?.map((link) => (
                  <li key={`footer-link-${link?.href}`}>
                    <Link
                      href={link?.href}
                      className="text-sm text-white/65 hover:text-white transition-colors duration-150"
                    >
                      {link?.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="border-t border-white/10 pt-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-xl">
            <div className="flex-1">
              <p className="text-sm font-semibold text-white mb-1">
                Stay informed
              </p>
              <p className="text-xs text-white/50">
                New species, collections and platform updates. No spam.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="input-base bg-white/10 border-white/15 text-white placeholder:text-white/35 focus:ring-secondary flex-1 sm:w-52"
                aria-label="Email address for newsletter"
              />
              <button className="btn-secondary shrink-0">
                <Mail size={14} />
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            © 2024 SeafoodVision. All rights reserved. All images are real photographs — no AI-generated content.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/35">
              Preview platform — commercial terms subject to change before launch.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}