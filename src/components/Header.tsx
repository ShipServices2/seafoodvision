'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { Menu, X, ChevronDown, Globe, User, BookOpen, Tag, HelpCircle, DollarSign, Info, Library, Database, ShoppingBag, Compass, Sparkles, Microscope, Building2 } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';


const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸', soon: true },
  { code: 'pt', label: 'Português', flag: '🇵🇹', soon: true },
];

const navLinks = [
  { href: '/library', label: 'Library', icon: Library },
  { href: '/species', label: 'Species', icon: BookOpen },
  { href: '/knowledge', label: 'Knowledge', icon: Database },
  { href: '/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/identify', label: 'Identify', icon: Microscope },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/products', label: 'Products', icon: ShoppingBag },
  { href: '/how-it-works', label: 'How it works', icon: HelpCircle },
  { href: '/licensing', label: 'Licensing', icon: Tag },
  { href: '/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/enterprise', label: 'Enterprise', icon: Building2 },
  { href: '/about', label: 'About', icon: Info },
];

interface HeaderProps {
  transparent?: boolean;
}

export default function Header({ transparent = false }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [activeLang, setActiveLang] = useState('en');
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isTransparent = transparent && !scrolled && !mobileOpen;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // ignore
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isTransparent
            ? 'bg-transparent' :'bg-white/95 backdrop-blur-md border-b border-border shadow-sm'
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
          <div className="flex items-center h-20 gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <AppLogo size={80} />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 ml-4">
              {navLinks.map((link) => (
                <Link
                  key={`nav-${link.href}`}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground ${
                    isTransparent
                      ? 'text-white/80 hover:bg-white/10 hover:text-white' :'text-muted-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2">
              {/* Language selector */}
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isTransparent
                      ? 'text-white/80 hover:bg-white/10 hover:text-white' :'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  aria-label="Select language"
                  aria-expanded={langOpen}
                >
                  <Globe size={15} />
                  <span>{languages.find((l) => l.code === activeLang)?.flag}</span>
                  <span className="hidden xl:inline">
                    {languages.find((l) => l.code === activeLang)?.label}
                  </span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
                </button>

                {langOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-card rounded-xl border border-border shadow-modal animate-fade-in overflow-hidden z-50">
                    {languages.map((lang) => (
                      <button
                        key={`lang-${lang.code}`}
                        onClick={() => {
                          if (!lang.soon) {
                            setActiveLang(lang.code);
                            setLangOpen(false);
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150 ${
                          lang.soon
                            ? 'text-muted-foreground cursor-default'
                            : activeLang === lang.code
                            ? 'bg-muted text-foreground font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                        {lang.soon && (
                          <span className="ml-auto text-xs badge-coming-soon px-1.5 py-0.5 rounded-full">
                            Soon
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Auth */}
              {user ? (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    href="/account"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isTransparent
                        ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <User size={15} />
                    {profile?.display_name?.split(' ')[0] || 'Account'}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 ${
                      isTransparent
                        ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-primary-foreground hover:bg-ocean-800'
                    }`}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/auth"
                    className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isTransparent
                        ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <User size={15} />
                    Sign in
                  </Link>
                  <Link
                    href="/auth"
                    className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 ${
                      isTransparent
                        ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-primary-foreground hover:bg-ocean-800'
                    }`}
                  >
                    Join
                  </Link>
                </>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className={`lg:hidden p-2 rounded-lg transition-colors duration-150 ${
                  isTransparent
                    ? 'text-white hover:bg-white/10' :'text-muted-foreground hover:bg-muted'
                }`}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-card shadow-modal flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 h-16 border-b border-border">
              <span className="font-bold text-foreground">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={`mobile-nav-${link.href}`}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors duration-150"
                  >
                    <Icon size={16} className="text-muted-foreground" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 pb-6 border-t border-border pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {languages.map((lang) => (
                  <button
                    key={`mobile-lang-${lang.code}`}
                    onClick={() => !lang.soon && setActiveLang(lang.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                      lang.soon
                        ? 'text-muted-foreground cursor-default opacity-60'
                        : activeLang === lang.code
                        ? 'bg-secondary/10 text-secondary' :'hover:bg-muted text-foreground'
                    }`}
                  >
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>
              <Link
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="btn-outline w-full justify-center mt-2"
              >
                <User size={15} />
                Sign in
              </Link>
              <Link
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full justify-center"
              >
                Join SeafoodVision
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}