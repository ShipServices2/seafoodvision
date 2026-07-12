'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Heart, FolderOpen, Building2, LogOut, ChevronRight, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


export default function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router?.replace('/auth?next=/account');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router?.replace('/');
    } catch {
      // ignore
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const menuItems = [
    {
      href: '/account/profile',
      icon: User,
      label: 'Profile',
      description: 'Edit your name, company, country and preferences',
    },
    {
      href: '/account/favorites',
      icon: Heart,
      label: 'Favorites',
      description: 'Assets you have saved for quick access',
    },
    {
      href: '/account/collections',
      icon: FolderOpen,
      label: 'Collections',
      description: 'Organize assets into private collections',
    },
    {
      href: '/account/company',
      icon: Building2,
      label: 'Company Profile',
      description: 'B2B profile for professional use',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/10 border border-secondary/20 flex items-center justify-center">
              <User size={24} className="text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.display_name || user?.email?.split('@')?.[0] || 'My Account'}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize font-medium">
                  {profile?.role || 'member'}
                </span>
                {profile?.company && (
                  <span className="text-xs text-muted-foreground">· {profile?.company}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {menuItems?.map((item) => {
            const Icon = item?.icon;
            return (
              <Link
                key={item?.href}
                href={item?.href}
                className="group bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:border-secondary/30 hover:shadow-card transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-secondary/10 transition-colors">
                  <Icon size={18} className="text-muted-foreground group-hover:text-secondary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{item?.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item?.description}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:text-secondary transition-colors" />
              </Link>
            );
          })}
        </div>

        {/* Admin link for elevated roles */}
        {profile && ['reviewer', 'administrator', 'super_admin']?.includes(profile?.role) && (
          <div className="mb-6">
            <Link
              href="/admin"
              className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl px-5 py-4 hover:bg-primary/10 transition-colors"
            >
              <Shield size={18} className="text-primary" />
              <div>
                <p className="text-sm font-semibold text-primary">Administration</p>
                <p className="text-xs text-muted-foreground">Access the admin dashboard</p>
              </div>
              <ChevronRight size={16} className="text-primary ml-auto" />
            </Link>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors font-medium"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </main>
      <Footer />
    </div>
  );
}
