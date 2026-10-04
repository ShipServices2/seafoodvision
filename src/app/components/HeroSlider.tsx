'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// `hd` images come from the full-resolution originals (1920 px) and fill the frame.
// The others are low-resolution captures: they are shown at their real size at most
// (never scaled up) and centred in the frame.
const slides = [
  { src: '/images/hero/hero-01.jpg', width: 708, height: 629, alt: 'Frozen sardinella packed head to tail in a pile of whole fish' },
  { src: '/images/hero/hero-02.jpg', width: 1920, height: 1440, hd: true, alt: 'Four whole mackerel laid side by side on a stainless steel table' },
  { src: '/images/hero/hero-03.jpg', width: 708, height: 486, alt: 'Whole orange-red fish lying on a speckled worktop' },
  { src: '/images/hero/hero-04.jpg', width: 709, height: 623, alt: 'Heap of whole silver sardinella with dark backs' },
  { src: '/images/hero/hero-05.jpg', width: 707, height: 606, alt: 'Pile of whole small pelagic fish, silver with dark backs' },
  { src: '/images/hero/hero-06.jpg', width: 703, height: 601, alt: 'Salmon fillets with the skin on, laid on a blue tray' },
  { src: '/images/hero/hero-07.jpg', width: 594, height: 541, alt: 'Frozen golden-brown fish blocks stacked in an open carton' },
  { src: '/images/hero/hero-08.jpg', width: 579, height: 644, alt: 'Horse mackerel packed head to tail in a cardboard carton' },
  { src: '/images/hero/hero-09.jpg', width: 1920, height: 1440, hd: true, alt: 'Pink whole fish with yellow fins packed in plastic bags in a carton' },
  { src: '/images/hero/hero-10.jpg', width: 705, height: 614, alt: 'Golden smoked mackerel laid in rows in a box' },
  { src: '/images/hero/hero-11.jpg', width: 711, height: 556, alt: 'Red whole fish with large eyes, frozen in a plastic bag' },
];

const AUTOPLAY_INTERVAL = 5000;

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const goTo = useCallback((index: number) => {
    setCurrent((index + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [paused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div
      className="w-full max-w-[700px] mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="SeafoodVision photo slider"
    >
      {/* Fixed-ratio card: images fade in and out, none is ever enlarged beyond its real size */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-black/40 shadow-lg ring-1 ring-white/10"
        style={{ aspectRatio: '6 / 5' }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-in-out ${
              i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
            aria-hidden={i !== current}
          >
            {slide.hd ? (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="object-cover"
                sizes="(max-width: 700px) 100vw, 700px"
                priority={i === 0}
                draggable={false}
              />
            ) : (
              <Image
                src={slide.src}
                alt={slide.alt}
                width={slide.width}
                height={slide.height}
                unoptimized
                className="w-auto h-auto max-w-full max-h-full"
                priority={i === 0}
                draggable={false}
              />
            )}
          </div>
        ))}

        <button
          onClick={() => goTo(current - 1)}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all duration-150 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => goTo(current + 1)}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all duration-150 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Dot indicators, below the card */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {slides.map((slide, i) => (
          <button
            key={`dot-${slide.src}`}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === current}
            className={`rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i === current ? 'w-6 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
