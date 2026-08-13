import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-12 md:py-20 lg:py-24">
      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-0 -translate-x-1/2 w-96 h-96 rounded-full bg-[#043556]/5 blur-3xl" />
      <div className="absolute top-1/3 right-0 translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#b71a12]/5 blur-3xl" />

      <div className="mx-auto max-w-6xl px-6 relative z-10">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Headline and CTA */}
          <div className="lg:col-span-6 flex flex-col justify-center text-left">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#043556]/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#043556]">
              <span className="size-2 rounded-full bg-[#b71a12] animate-pulse" />
              60-Day Interactive English Coaching
            </span>

            <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink leading-[1.05]">
              Build Skills That Shape Your Future
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg text-body leading-relaxed">
              Practical online courses designed to help you gain real-world experience, speak English naturally, and grow with confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <Button asChild size="lg" className="bg-[#043556] hover:bg-[#032e4d] text-white rounded-full px-8 py-6 font-bold shadow-md hover:scale-[1.02] transition-transform">
                <Link href="/login" className="inline-flex items-center gap-2">
                  Explore Course <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Link
                href="/#courses"
                className="text-sm font-semibold text-mute hover:text-ink transition-colors px-4 py-2"
              >
                Learn more
              </Link>
            </div>

            {/* Bottom-left Card */}
            <div className="mt-12 max-w-sm rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#043556]/10 text-[#043556]">
                  <CheckCircle2 className="size-4" />
                </span>
                <span className="text-sm font-bold text-ink">Built for real growth</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-body leading-relaxed">
                Follow guided learning paths from beginner to fluent, with daily feedback and structural practice.
              </p>
            </div>
          </div>

          {/* Right Column: Grid of Images & Cards */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Left Column of Grid */}
              <div className="space-y-4">
                {/* 1. Student Girl Image */}
                <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm group">
                  <img
                    src="/student-girl.png"
                    alt="Student reading"
                    className="h-44 sm:h-56 w-full object-cover select-none group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* 2. Brand Quote Card */}
                <div className="rounded-2xl bg-[#043556] p-5 text-white shadow-md flex flex-col justify-between min-h-[140px]">
                  <div className="flex items-center justify-between">
                    {/* User Avatars stacked */}
                    <div className="flex -space-x-2">
                      <div className="size-6 rounded-full border border-white bg-slate-200 overflow-hidden">
                        <img src="/student-character.png" alt="User" className="size-full object-cover scale-150 translate-y-1" />
                      </div>
                      <div className="size-6 rounded-full border border-white bg-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-700">
                        JD
                      </div>
                    </div>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      Best
                    </span>
                  </div>
                  <p className="mt-4 text-xs sm:text-sm font-medium leading-relaxed">
                    "Hands-on lessons that helped me apply skills right away in conversations."
                  </p>
                </div>

                {/* 3. Stat Card */}
                <div className="rounded-2xl bg-[#0b1320] p-5 text-white shadow-md">
                  <div className="font-display text-3xl font-black text-white">60+</div>
                  <p className="mt-1 text-xs text-slate-300 font-medium">
                    Days of structured daily lessons and trainer-reviewed tasks.
                  </p>
                </div>
              </div>

              {/* Right Column of Grid */}
              <div className="space-y-4 pt-8 lg:pt-12">
                {/* 4. Classroom Image with Text Overlay */}
                <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm group">
                  <img
                    src="/classroom.png"
                    alt="Classroom study"
                    className="h-32 sm:h-40 w-full object-cover select-none group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Interactive Classrooms
                    </span>
                  </div>
                </div>

                {/* 5. Tall Student Image */}
                <div className="relative overflow-hidden rounded-2xl bg-[#f1f5f9] border border-border shadow-sm group">
                  <img
                    src="/student-character.png"
                    alt="Student thinking"
                    className="h-56 sm:h-72 w-full object-cover select-none group-hover:scale-105 transition-transform duration-300 translate-y-3 sm:translate-y-6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
