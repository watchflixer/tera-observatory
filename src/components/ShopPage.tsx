import { useEffect } from 'react';
import {
  ArrowLeft, ArrowUpRight, Check, Globe2, Heart, LockKeyhole, Sparkles,
} from 'lucide-react';
import { ShopDisclosures } from './ShopDisclosures';

interface ShopPageProps {
  onBack: () => void;
}

const plans = [
  { name: 'Weekly', description: 'For a little time to explore.', price: '50', period: 'week', limit: '100', limitPeriod: 'per day', speed: 'Slow', accent: false },
  { name: 'Monthly', description: 'For the endlessly curious.', price: '200', period: 'month', limit: '600', limitPeriod: 'per day', speed: 'Fast', accent: true },
  { name: 'Yearly', description: 'For your longer journey.', price: '2,200', period: 'year', limit: '20,000', limitPeriod: 'per month', speed: 'Smooth and fast', accent: false },
] as const;

export function ShopPage({ onBack }: ShopPageProps) {
  useEffect(() => {
    const scrollToSection = () => {
      const id = window.location.hash.slice(1);
      if (id !== 'shop') document.getElementById(id)?.scrollIntoView();
    };
    scrollToSection();
    window.addEventListener('hashchange', scrollToSection);
    return () => window.removeEventListener('hashchange', scrollToSection);
  }, []);

  return (
    <main className="shop-page fixed inset-0 overflow-y-auto text-[#f5f3f1]" aria-label="Terra Observatory shop">
      <header className="shop-nav">
        <button type="button" onClick={onBack} className="shop-nav-back" aria-label="Back to observatory"><ArrowLeft className="h-4 w-4" /> <span>Back to observatory</span></button>
        <div className="shop-nav-brand"><Globe2 className="h-4 w-4" /> <span>Terra Observatory</span></div>
        <a href="#shop-terms" className="shop-nav-details">Details <ArrowUpRight className="h-3 w-3" /></a>
      </header>

      <div className="shop-content mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <section id="shop-plans" className="shop-pricing scroll-mt-24">
          <div className="shop-pricing-intro">
            <p className="shop-overline"><span /> TERRA OBSERVATORY <span /></p>
            <h1>Pricing Plan</h1>
            <p className="shop-intro-copy">Find your place in the universe, one discovery at a time.</p>
            <div className="shop-preview-pill"><Sparkles className="h-3.5 w-3.5" /> <span>Plan preview</span><span className="shop-pill-divider" /> Prices in PHP</div>
          </div>

          <div className="shop-plan-viewport" role="region" aria-label="Pricing plans" tabIndex={0}>
            <div className="shop-plan-grid">
              {plans.map((plan) => (
                <article key={plan.name} className={`shop-plan-card${plan.accent ? ' shop-plan-card-featured' : ''}`}>
                  <div className="shop-plan-top">
                    <div className="shop-plan-heading"><h2>{plan.name}</h2>{plan.accent && <span className="shop-featured-label">FEATURED</span>}</div>
                    <p className="shop-plan-description">{plan.description}</p>
                    <div className="shop-price"><span>₱{plan.price}</span><small> / {plan.period}</small></div>
                    <button type="button" disabled className="shop-pay-button">Payment unavailable</button>
                  </div>
                  <div className="shop-plan-features">
                    <p className="shop-feature-heading">PLAN DETAILS</p>
                    <div><span className="shop-check"><Check /></span><span><strong>{plan.limit} limit</strong> {plan.limitPeriod}</span></div>
                    <div><span className="shop-check"><Check /></span><span>Planned speed: <strong>{plan.speed}</strong></span></div>
                    <div><span className="shop-check"><Check /></span><span>Prices in Philippine pesos</span></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="shop-pricing-notice" role="note"><span className="shop-notice-dot" /><p><strong>Coming soon.</strong> Plans and payments are not available yet. Limits and speed tiers are not implemented, and the limit unit and reset rules still need to be defined.</p></div>
          <p className="shop-pricing-footnote">Speed descriptions are goals, not guarantees. To activate checkout, the operator must connect a suitable payment provider or verified payment link and implement billing and plan access. A MariBank account alone does not connect checkout.</p>
        </section>

        <section className="mt-12 flex flex-col gap-6 rounded-2xl border border-[#e6b673]/20 bg-[#121212] p-6 sm:mt-16 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div><p className="shop-eyebrow">02 / SUPPORT THE PROJECT</p><h2 className="mt-2 font-display text-xl font-semibold text-white">Keep curiosity alive.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#aaa6a3]">Donations will be optional and separate from the plans. Thank you for supporting independent exploration.</p></div>
          <div className="shrink-0"><button type="button" disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#d5a167]/35 bg-[#d5a167]/10 px-5 py-3 text-sm font-semibold text-[#c7ad88]"><Heart className="h-4 w-4" /> Donate <LockKeyhole className="h-3 w-3" /></button><p className="mt-2 text-[11px] text-[#a09a96]">Donation link not connected.</p></div>
        </section>

        <ShopDisclosures />
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-[#8f8985]"><span>Terra Observatory <span className="mx-1.5">·</span> Made for curious minds.</span><button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[#cac4c0] hover:text-white"><ArrowLeft className="h-3 w-3" /> Back to the globe</button></footer>
      </div>
    </main>
  );
}
