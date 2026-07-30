import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/global/logo";

const features = [
  {
    icon: CalendarCheck,
    title: "A 60-day plan",
    body: "One focused lesson and task every day. No guesswork — just show up and follow the path.",
  },
  {
    icon: GraduationCap,
    title: "A personal trainer",
    body: "A dedicated coach reviews your work, grades tasks, and keeps you accountable.",
  },
  {
    icon: MessageSquare,
    title: "Daily practice",
    body: "Speaking, writing, and quizzes built into each day to build real confidence.",
  },
  {
    icon: Trophy,
    title: "Earn your certificate",
    body: "Finish the 60 days, pass the weekend assessments, and walk away with a certificate.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 text-center sm:py-28">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
          <span className="size-2 rounded-full bg-positive" />
          60-day English coaching
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Speak English with confidence in{" "}
          <span className="text-positive">60 days.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-body">
          A guided daily program with a personal trainer, real feedback, and
          quizzes — built to turn practice into fluency.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">
              Start your journey <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="tertiary">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-sage py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl bg-card p-6 text-left shadow-sm"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary-pale text-ink-deep">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="rounded-xl bg-ink px-8 py-14 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            Your 60-day journey starts today.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-sage">
            Join English Dreams and get matched with a trainer.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/login">
              Get started <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo />
          <p className="text-sm text-mute">
            © {new Date().getFullYear()} English Dreams. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
