import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-muted rounded-md ${className}`} />
  );
}

export function AssetCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5 mt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function FilterPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`filter-skel-${i + 1}`} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center">
      <div className="text-center max-w-3xl px-4 flex flex-col items-center gap-6">
        <Skeleton className="h-12 w-96 bg-white/10" />
        <Skeleton className="h-6 w-72 bg-white/10" />
        <Skeleton className="h-14 w-full max-w-2xl bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}

export default Skeleton;