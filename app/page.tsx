import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { ModelsSection } from "@/components/ModelsSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { FaqSection } from "@/components/FaqSection";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-void">
      <Nav />
      <Hero />
      <ModelsSection />
      <FeaturesSection />
      <FaqSection />
      <Footer />
    </main>
  );
}
