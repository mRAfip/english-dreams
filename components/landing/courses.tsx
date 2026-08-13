import { Briefcase, MessageSquare, BookOpen } from "lucide-react";

const courseItems = [
  {
    icon: BookOpen,
    title: "Basic Program",
    description: "Designed for beginners to build elementary grammar, basic daily vocabulary, and fundamental sentence construction for simple speaking tasks.",
    bgIcon: "bg-[#043556]/10 text-[#043556]",
  },
  {
    icon: MessageSquare,
    title: "Intermediate Program",
    description: "Focused on conversational confidence, speech rhythm, active listening, and mid-level structures for everyday social and office scenarios.",
    bgIcon: "bg-[#b71a12]/10 text-[#b71a12]",
  },
  {
    icon: Briefcase,
    title: "Advanced Program",
    description: "Tailored for professionals to master presentation pitching, interview strategies, debate delivery, and advanced vocabulary for complex career goals.",
    bgIcon: "bg-[#043556]/10 text-[#043556]",
  },
];

export function Courses() {
  return (
    <section id="courses" className="bg-background py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header Grid */}
        <div className="grid gap-6 md:grid-cols-2 items-end mb-12 sm:mb-16">
          <div className="text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
              Explore Our Core Programs
            </h2>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm sm:text-base text-body max-w-md md:ml-auto leading-relaxed font-medium">
              We decide based on your initial test which course is best for you. Follow a structured, personalized path designed to match your current level.
            </p>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courseItems.map((c, i) => (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card p-6 text-left shadow-sm hover:shadow-md hover:border-[#043556]/20 transition-all duration-200 group flex flex-col justify-between min-h-[220px]"
            >
              <div>
                {/* Circular Icon */}
                <span className={`inline-flex size-12 items-center justify-center rounded-2xl ${c.bgIcon} transition-transform group-hover:scale-105`}>
                  <c.icon className="size-5" />
                </span>
                <h3 className="mt-6 font-display text-lg font-bold text-ink group-hover:text-[#043556] transition-colors">
                  {c.title}
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-body">
                  {c.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
