"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const accordionItems = [
  {
    title: "Expert Mentors",
    description: "Learn directly from experienced trainers who grade your daily assignments, answer questions, and guide you step-by-step through correct speaking habits.",
  },
  {
    title: "Hands-On Projects & Tasks",
    description: "Submit audio recordings, write assignments, and participate in weekend assessments designed to simulate real conversational scenarios.",
  },
  {
    title: "Career-Focused Curriculum",
    description: "Engage with lessons designed for professional confidence: pitch presentation, business vocabularies, negotiation tactics, and office small talk.",
  },
  {
    title: "Recognized Certificates",
    description: "Complete your 60-day syllabus, submit your graduation task, and receive a verified PDF certificate of course completion signed by your mentor.",
  },
];

export function Features() {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  return (
    <section id="features" className="bg-[#f8fafc] py-16 md:py-24 border-b border-border/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Image/Illustration */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-lg max-w-lg aspect-[4/3] w-full">
              <img
                src="/classroom.png"
                alt="Teacher helping student"
                className="size-full object-cover select-none"
              />
            </div>
          </div>

          {/* Right Column: Accordion Features */}
          <div className="lg:col-span-6 text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
              Built for Learners, Driven by Outcomes
            </h2>

            <div className="mt-8 space-y-4">
              {accordionItems.map((item, idx) => {
                const isOpen = activeIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border-b border-border/60 pb-4 transition-all duration-200"
                  >
                    <button
                      onClick={() => setActiveIndex(isOpen ? -1 : idx)}
                      className="flex w-full items-center justify-between py-2 text-left group"
                    >
                      <span className={`font-display text-base sm:text-lg font-bold transition-colors ${isOpen ? "text-[#043556]" : "text-ink group-hover:text-[#043556]"}`}>
                        {item.title}
                      </span>
                      <span className={`inline-flex size-7 items-center justify-center rounded-full transition-all ${isOpen ? "bg-[#b71a12]/10 text-[#b71a12]" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"}`}>
                        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </span>
                    </button>

                    {/* Expandable description with transition */}
                    <div
                      className={`grid transition-all duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-xs sm:text-sm text-body leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
