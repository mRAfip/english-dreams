import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/global/logo";

export function CTAFooter() {
  return (
    <div className="bg-background">
      {/* CTA Box */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#043556] to-[#021d30] px-8 py-14 text-center shadow-xl border border-[#043556]/20">
          {/* Subtle decoration */}
          <div className="absolute top-0 left-0 size-48 rounded-full bg-white/5 -translate-x-1/2 -translate-y-1/2 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 size-48 rounded-full bg-[#b71a12]/10 translate-x-1/2 translate-y-1/2 blur-2xl pointer-events-none" />

          <h2 className="relative z-10 mx-auto max-w-2xl font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Your 60-day journey starts today.
          </h2>
          <p className="relative z-10 mx-auto mt-4 max-w-md text-sm sm:text-base text-slate-300">
            Join English Dreams, work with a personal trainer, and build speaking fluency that lasts a lifetime.
          </p>
          <div className="relative z-10 mt-8">
            <Button asChild size="lg" className="bg-[#b71a12] hover:bg-[#99150e] text-white rounded-full px-8 py-6 font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all">
              <Link href="/login" className="inline-flex items-center gap-2">
                Get Started Now <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 md:py-16">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left: Logo and tagline */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3">
            <Logo className="h-10 w-36" />
            <p className="text-xs text-mute font-medium max-w-[200px]">
              Speak English with direct trainer guidance in 60 days.
            </p>
          </div>

          {/* Middle: Map links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-body">
            <Link href="/#" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link href="/#courses" className="hover:text-primary transition-colors">
              Courses
            </Link>
            <Link href="/#features" className="hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="/#about" className="hover:text-primary transition-colors">
              About Us
            </Link>
          </div>

          {/* Right: Copyright info */}
          <div className="text-center md:text-right">
            <p className="text-xs text-mute font-medium">
              © {new Date().getFullYear()} English Dreams. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
