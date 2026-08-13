import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function About() {
  return (
    <section id="about" className="bg-[#f8fafc] py-16 md:py-24 border-y border-border/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Description & Action */}
          <div className="lg:col-span-5 text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
              Learning Built for Real Careers
            </h2>
            <p className="mt-6 text-base sm:text-lg text-body leading-relaxed">
              English Dreams is a premium coaching platform focused on practical, everyday conversational speaking. We cut out boring lectures and focus entirely on daily task submissions, trainer feedback, and building direct, real-world speaking confidence.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-[#b71a12] hover:bg-[#99150e] text-white rounded-full px-6 py-5 font-bold shadow-sm">
                <Link href="/login" className="inline-flex items-center gap-2">
                  Explore Programs <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Image Container */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-xl aspect-square sm:aspect-[4/3] bg-[#043556]">
              <img
                src="/landing-page-img.jpg"
                alt="Student success"
                className="w-full h-full object-cover select-none"
              />
            </div>
          </div>
        </div>

        {/* Bottom Statistics Bar */}
        <div className="mt-16 sm:mt-24 border-t border-border/60 pt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 text-center">
            {/* Stat 1 */}
            <div className="md:border-r border-border/60 md:px-4">
              <div className="font-display text-4xl sm:text-5xl font-black text-[#043556]">98%</div>
              <p className="mt-2 text-xs sm:text-sm text-mute font-semibold">Learner Satisfaction</p>
            </div>
            {/* Stat 2 */}
            <div className="md:border-r border-border/60 md:px-4">
              <div className="font-display text-4xl sm:text-5xl font-black text-[#043556]">60+</div>
              <p className="mt-2 text-xs sm:text-sm text-mute font-semibold">Structured Lessons</p>
            </div>
            {/* Stat 3 */}
            <div className="md:border-r border-border/60 md:px-4">
              <div className="font-display text-4xl sm:text-5xl font-black text-[#043556]">10K+</div>
              <p className="mt-2 text-xs sm:text-sm text-mute font-semibold">Tasks Evaluated</p>
            </div>
            {/* Stat 4 */}
            <div className="md:px-4">
              <div className="font-display text-4xl sm:text-5xl font-black text-[#043556]">1-on-1</div>
              <p className="mt-2 text-xs sm:text-sm text-mute font-semibold">Personal Trainer</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
