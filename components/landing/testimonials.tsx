"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

const testimonialItems = [
  {
    quote: "The lessons are practical and easy to follow. English Dreams helped me build real speaking skills and confidence to present in client meetings and lead group projects at work.",
    author: "Daniel Carter",
    role: "Project Manager",
    avatar: "/student-character.png",
    tags: ["Speaking", "Business"],
  },
  {
    quote: "Submitting daily voice tasks and getting direct feedback from my coach completely transformed my pronunciation. It feels like having a private trainer on call every day.",
    author: "Sophia Martinez",
    role: "UX Researcher",
    avatar: "/student-girl.png",
    tags: ["Pronunciation", "Feedback"],
  },
  {
    quote: "I used to freeze up when answering questions in English. Following the structured 60-day plan taught me how to phrase answers quickly without overthinking.",
    author: "Amit Patel",
    role: "Software Engineer",
    avatar: "/student-character.png",
    tags: ["Conversational", "Structure"],
  },
];

export function Testimonials() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const current = testimonialItems[activeIdx];

  return (
    <section id="testimonials" className="bg-background py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Headline and CTA */}
          <div className="lg:col-span-5 text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
              What Our Learners Say
            </h2>
            <p className="mt-6 text-base text-body leading-relaxed max-w-md">
              Real feedback from professionals and students who completed their 60-day English Dreams path.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-[#043556] hover:bg-[#032e4d] text-white rounded-full px-6 py-5 font-bold shadow-sm">
                <Link href="/login" className="inline-flex items-center gap-2">
                  Explore Course <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Premium Interactive Card */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-[#043556] p-6 sm:p-8 text-white shadow-xl min-h-[300px] flex flex-col justify-between relative overflow-hidden">
              {/* Soft background shape */}
              <div className="absolute top-0 right-0 size-24 bg-white/5 rounded-full blur-xl" />

              <div>
                <Quote className="size-10 text-white/20" />
                <p className="mt-4 text-base sm:text-lg lg:text-xl font-medium leading-relaxed italic text-white/95">
                  "{current.quote}"
                </p>
              </div>

              {/* Card Footer row */}
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-white/15 overflow-hidden border border-white/20 shrink-0">
                    <img
                      src={current.avatar}
                      alt={current.author}
                      className="size-full object-cover scale-110 translate-y-0.5"
                    />
                  </div>
                  <div>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white leading-tight">
                      {current.author}
                    </h4>
                    <p className="text-xs text-white/70 mt-0.5 font-medium">
                      {current.role}
                    </p>
                  </div>
                </div>

                {/* Badges and slider dots */}
                <div className="flex items-center gap-4">
                  {/* Testimonial tags */}
                  <div className="hidden sm:flex items-center gap-2">
                    {current.tags.map((tag, i) => (
                      <span key={i} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Slider dots */}
                  <div className="flex items-center gap-1.5">
                    {testimonialItems.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        aria-label={`Go to testimonial ${i + 1}`}
                        className={`size-2 rounded-full transition-all duration-200 ${i === activeIdx ? "bg-[#b71a12] w-4" : "bg-white/30 hover:bg-white/50"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
