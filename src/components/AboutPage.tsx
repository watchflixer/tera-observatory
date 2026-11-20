import { useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Globe2, Heart, LockKeyhole, Sparkles } from 'lucide-react';
import { AboutDisclosures } from './AboutDisclosures';

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  useEffect(() => {
    const scrollToSection = () => {
      const hash = window.location.hash.slice(1);
      // Keep previously shared shop links working after the page's redesign.
      const legacySections: Record<string, string> = {
        'shop-plans': 'about-donate',
        'shop-terms': 'about-terms',
        'shop-privacy': 'about-privacy',
        'shop-sources': 'about-sources',
      };
      const id = legacySections[hash] ?? hash;
      if (id !== 'about' && id !== 'shop') document.getElementById(id)?.scrollIntoView();
    };
    scrollToSection();
    window.addEventListener('hashchange', scrollToSection);
    return () => window.removeEventListener('hashchange', scrollToSection);
  }, []);

  return (
    <main className="shop-page fixed inset-0 overflow-y-auto text-[#f5f3f1]" aria-label="About and support Terra Observatory">
      <header className="shop-nav">
        <button type="button" onClick={onBack} className="shop-nav-back" aria-label="Back to observatory"><ArrowLeft className="h-4 w-4" /> <span>Back to observatory</span></button>
        <div className="shop-nav-brand"><Globe2 className="h-4 w-4" /> <span>Terra Observatory</span></div>
        <a href="#about-overview" className="shop-nav-details">Details <ArrowUpRight className="h-3 w-3" /></a>
      </header>

      <div className="shop-content mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <section className="about-intro">
          <p className="shop-overline"><span /> ABOUT US · TERRA OBSERVATORY <span /></p>
          <h1>For curious minds.</h1>
          <p>Explore our planet, travel through deep time, and discover the stories of life on Earth.</p>
          <div className="about-intro-links">
            <a href="#about-overview">About the project <span aria-hidden="true">↓</span></a>
            <a href="#about-donate">Support the project <span aria-hidden="true">↓</span></a>
          </div>
        </section>

        <div className="about-feature-grid" aria-label="Explore Terra Observatory">
          <article><Globe2 aria-hidden="true" /><h2>Our planet</h2><p>Explore the globe, its interior, atmosphere and geological history.</p></article>
          <article><BookOpen aria-hidden="true" /><h2>TerraPedia</h2><p>Discover articles, images and stories from across the natural world.</p></article>
          <article><Sparkles aria-hidden="true" /><h2>Life through time</h2><p>Meet extinct species and explore their habitats and reconstructions.</p></article>
        </div>

        <section id="about-donate" className="about-donate scroll-mt-8" aria-labelledby="donate-heading">
          <div className="about-donate-copy"><p className="shop-eyebrow">SUPPORT THE PROJECT</p><h2 id="donate-heading">Keep curiosity alive.</h2><p>Terra Observatory is made for exploring and learning. In the future, an optional donation will be a way to support the project and its continued development.</p></div>
          <div className="about-donate-action"><button type="button" disabled><Heart className="h-4 w-4" /> Donate <LockKeyhole className="h-3.5 w-3.5" /></button><p>Donations are not available yet.</p><p>A verified donation link has not been connected.</p></div>
        </section>

        <AboutDisclosures />
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-[#8f8985]"><span>Terra Observatory <span className="mx-1.5">·</span> Made for curious minds.</span><button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[#cac4c0] hover:text-white"><ArrowLeft className="h-3 w-3" /> Back to the globe</button></footer>
      </div>
    </main>
  );
}
