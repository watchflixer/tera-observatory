import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Copy, Globe2, Heart, Sparkles } from 'lucide-react';
import { AboutDisclosures } from './AboutDisclosures';

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  const [donationOpen, setDonationOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const accountNumber = '16070561909';

  const copyAccountNumber = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(accountNumber);
      setCopyStatus('Account number copied.');
    } catch {
      setCopyStatus('Copy unavailable. Select the account number and copy it manually.');
    }
  };

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
          <div className="about-donate-copy">
            <p className="shop-eyebrow">SUPPORT THE PROJECT</p>
            <h2 id="donate-heading">Keep curiosity alive.</h2>
            <p>Terra Observatory is made for exploring and learning. If you would like to support the project, you can make an optional donation by bank transfer.</p>
          </div>
          <div className="about-donate-action">
            <button type="button" aria-expanded={donationOpen} aria-controls="donation-details" onClick={() => { setDonationOpen((open) => !open); setCopyStatus(''); }}>
              <Heart className="h-4 w-4" aria-hidden="true" /> {donationOpen ? 'Hide details' : 'Donate'}
            </button>
            <p>Transfer through your own banking app.</p>
          </div>
          <div id="donation-details" className="donation-details" hidden={!donationOpen}>
            <div className="donation-details-heading"><div><p className="shop-eyebrow">BANK TRANSFER</p><h3>Support via MariBank</h3></div><span>VOLUNTARY</span></div>
            <p>You can send from GCash or a participating bank or e-wallet app that supports transfers to MariBank. Availability and transfer fees depend on your app.</p>
            <dl className="donation-account">
              <div><dt>Bank</dt><dd>MariBank Philippines <span>(formerly SeaBank)</span></dd></div>
              <div><dt>Account name <span>(masked)</span></dt><dd>NI*O IA* **M*O</dd></div>
              <div><dt><label htmlFor="donation-account-number">Account number</label></dt><dd className="donation-account-number"><input id="donation-account-number" readOnly value={accountNumber} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={copyAccountNumber} aria-label="Copy MariBank account number">{copyStatus === 'Account number copied.' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} Copy</button></dd></div>
            </dl>
            <p className="donation-copy-status" role="status" aria-live="polite">{copyStatus}</p>
            <ol>
              <li>Open your banking or e-wallet app and choose Bank Transfer or Send to Bank.</li>
              <li>Select MariBank Philippines, enter the account number, and follow your app’s recipient-name requirements.</li>
              <li>Check the recipient and any fees in your app before confirming your transfer.</li>
            </ol>
            <p className="donation-note">The name above is intentionally masked, not a complete account name. Some apps may require the full name. The transfer happens outside this site; Terra Observatory cannot process or confirm your payment. Never share your PIN, password, or one-time codes.</p>
          </div>
        </section>

        <AboutDisclosures />
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-[#8f8985]"><span>Terra Observatory <span className="mx-1.5">·</span> Made for curious minds.</span><button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[#cac4c0] hover:text-white"><ArrowLeft className="h-3 w-3" /> Back to the globe</button></footer>
      </div>
    </main>
  );
}
