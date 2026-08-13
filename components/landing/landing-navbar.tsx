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
        {/* Left Logo */}
        <div className="flex items-center justify-start">
          <Link href="/" className="hover:opacity-90 transition-opacity duration-150">
            <Logo className="h-10 w-36" />
          </Link>
        </div>

        {/* Desktop Middle Links (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-8 justify-center">
          <Link
            href="/#"
            className="text-[15px] font-semibold text-body hover:text-primary transition-colors duration-150"
          >
            Home
          </Link>
          <Link
            href="/#courses"
            className="text-[15px] font-semibold text-body hover:text-primary transition-colors duration-150"
          >
            Courses
          </Link>
          <Link
            href="/#features"
            className="text-[15px] font-semibold text-body hover:text-primary transition-colors duration-150"
          >
            Features
          </Link>
          <Link
            href="/#about"
            className="text-[15px] font-semibold text-body hover:text-primary transition-colors duration-150"
          >
            About Us
          </Link>
        </div>

        {/* Desktop Right CTA (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-4 justify-end">
          <Link
            href="/login"
            className="text-[15px] font-medium text-body hover:text-primary transition-colors duration-150 pr-2"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 justify-center rounded-full bg-[#043556] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#032e4d] hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            Contact Us ↗
          </Link>
        </div>

        {/* Mobile Menu Toggle Button (hidden on desktop) */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            className="text-body p-2 hover:bg-secondary rounded-xl transition-colors duration-150"
          >
            {isOpen ? <X className="size-6 text-ink" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown Overlay */}
      {isOpen && (
        <div className="absolute top-20 left-0 right-0 bg-background/95 border-b border-border py-6 px-6 flex flex-col gap-4 shadow-lg md:hidden animate-in fade-in slide-in-from-top-5 duration-200">
          <Link
            href="/#"
            onClick={() => setIsOpen(false)}
            className="text-base font-semibold text-body hover:text-primary py-2 border-b border-border/40"
          >
            Home
          </Link>
          <Link
            href="/#courses"
            onClick={() => setIsOpen(false)}
            className="text-base font-semibold text-body hover:text-primary py-2 border-b border-border/40"
          >
            Courses
          </Link>
          <Link
            href="/#features"
            onClick={() => setIsOpen(false)}
            className="text-base font-semibold text-body hover:text-primary py-2 border-b border-border/40"
          >
            Features
          </Link>
          <Link
            href="/#about"
            onClick={() => setIsOpen(false)}
            className="text-base font-semibold text-body hover:text-primary py-2 border-b border-border/40"
          >
            About Us
          </Link>
          <div className="flex items-center justify-between gap-4 mt-2">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="text-base font-medium text-body hover:text-primary"
            >
              Log in
            </Link>
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center rounded-full bg-[#043556] px-5 py-2 text-sm font-bold text-white hover:bg-[#032e4d]"
            >
              Contact Us ↗
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
