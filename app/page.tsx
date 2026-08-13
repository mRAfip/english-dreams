import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Hero } from "@/components/landing/hero";
import { About } from "@/components/landing/about";
import { Courses } from "@/components/landing/courses";
import { Features } from "@/components/landing/features";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQ } from "@/components/landing/faq";
import { CTAFooter } from "@/components/landing/cta-footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 1. Header Navigation */}
      <LandingNavbar />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <Hero />

        {/* 3. About Section */}
        <About />

        {/* 4. Courses Section */}
        <Courses />

        {/* 5. Features Section Accordions */}
        <Features />

        {/* 6. Testimonials Section Slider */}
        <Testimonials />

        {/* 7. FAQ Accordions */}
        <FAQ />

        {/* 8. CTA Banner & Footer */}
        <CTAFooter />
      </main>
    </div>
  );
}
