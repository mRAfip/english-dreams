"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqItems = [
  {
    question: "How does the 60-day program work?",
    answer: "Every day, a new lesson and a corresponding speaking or writing task are unlocked for you. You watch the lesson video, read the notes, record/type your response, and send it to your personal trainer. The next day unlocks once you submit.",
  },
  {
    question: "Who reviews my daily tasks?",
    answer: "A dedicated native or professional English trainer is assigned to you. They review every submission, grade your output, and provide specific audio/written feedback within 24 hours.",
  },
  {
    question: "What happens if I miss a day or fall behind?",
    answer: "The program is self-paced! You won't lose your progress or access. However, to maintain a daily learning habit and keep your streak active, we recommend completing one lesson every calendar day.",
  },
  {
    question: "Will I receive a certificate upon completion?",
    answer: "Yes! Once you complete all 60 days, pass the weekend assessments, and submit your final graduation speaking task, your trainer will issue a signed certificate of achievement.",
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-[#f8fafc] py-16 md:py-24 border-y border-border/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Left Column: Heading */}
          <div className="lg:col-span-4 text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-sm text-body leading-relaxed max-w-sm">
              Have questions about how our English Dreams coaching works? Find answers to commonly asked questions here.
            </p>
          </div>

          {/* Right Column: FAQs */}
          <div className="lg:col-span-8 space-y-4">
            {faqItems.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/50 bg-card p-5 shadow-xs transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between text-left group"
                  >
                    <span className="font-display text-base font-bold text-ink group-hover:text-[#043556] transition-colors pr-4">
                      {item.question}
                    </span>
                    <span className={`inline-flex size-6 items-center justify-center rounded-full shrink-0 transition-colors ${isOpen ? "bg-[#b71a12]/10 text-[#b71a12]" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"}`}>
                      {isOpen ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                    </span>
                  </button>

                  <div
                    className={`grid transition-all duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm text-body leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
