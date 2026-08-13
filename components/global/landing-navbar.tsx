"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/global/logo";

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/80 border-b border-border/40 backdrop-blur-md">
      <nav className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        {/* Desktop Left Nav (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-8 w-1/3 justify-start">
          <Link
            href="/#curriculum"
            className="text-[15px] font-medium text-body hover:text-ink transition-colors duration-150"
          >
            Curriculum
          </Link>
          <Link
            href="/#features"
            className="text-[15px] font-medium text-body hover:text-ink transition-colors duration-150"
          >
            Features
          </Link>
        </div>

        {/* Mobile Menu Toggle Button (hidden on desktop) */}
        <div className="flex md:hidden w-1/3 justify-start">
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            className="text-body p-2 hover:bg-secondary rounded-xl transition-colors duration-150"
          >
            {isOpen ? <X className="size-6 text-ink" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Centered Logo */}
        <div className="flex items-center justify-center w-1/3">
          <Link href="/" className="hover:opacity-90 transition-opacity duration-150">
            <Logo />
          </Link>
        </div>

        {/* Desktop Right Nav (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-6 w-1/3 justify-end">
          <Link
            href="/login"
            className="text-[15px] font-medium text-body hover:text-ink transition-colors duration-150"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-active hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            Start now
          </Link>


        </div>

        {/* Mobile CTA (shown on mobile instead of right nav) */}
        <div className="flex md:hidden w-1/3 justify-end">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-active active:scale-[0.98] transition-all duration-150"
          >
            Start now
          </Link>
        </div>
      </nav>

      {/* Mobile Menu Dropdown Overlay */}
      {isOpen && (
        <div className="absolute top-20 left-0 right-0 bg-background/95 border-b border-border py-6 px-6 flex flex-col gap-4 shadow-lg md:hidden animate-in fade-in slide-in-from-top-5 duration-200">
          <Link
            href="/#curriculum"
            onClick={() => setIsOpen(false)}
            className="text-base font-medium text-body hover:text-ink py-2 border-b border-border/40"
          >
            Curriculum
          </Link>
          <Link
            href="/#features"
            onClick={() => setIsOpen(false)}
            className="text-base font-medium text-body hover:text-ink py-2 border-b border-border/40"
          >
            Features
          </Link>
          <Link
            href="/login"
            onClick={() => setIsOpen(false)}
            className="text-base font-medium text-body hover:text-ink py-2"
          >
            Log in
          </Link>
        </div>
      )}
    </header>
  );
}
