import { ArrowUpRight, Globe2, Layers3, LockKeyhole, ShieldCheck } from 'lucide-react';

const sources = [
  { name: 'Wikipedia', note: 'TerraPedia retrieves articles, search results and some images. Article text is generally available under CC BY-SA 4.0; consult the article history and applicable terms for attribution and other conditions.', href: 'https://en.wikipedia.org/wiki/Wikipedia:Copyrights' },
  { name: 'Wikimedia Commons', note: 'The gallery also retrieves images from Commons. Each file has its own creator, source and license; check its file page before reuse.', href: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia' },
  { name: 'Creative Commons BY-SA 4.0', note: 'License information for much of Wikipedia’s text, including attribution and share-alike requirements.', href: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'Esri and imagery contributors', note: 'The globe uses Esri World Imagery and reference boundaries. Esri service-specific terms, contributor credits and commercial-use permissions must be reviewed.', href: 'https://www.esri.com/content/dam/arcgisonline/docs/tou_summary.pdf' },
  { name: 'OpenStreetMap contributors', note: 'Place search uses OpenStreetMap data through Nominatim; the code also includes an OpenStreetMap tile source. © OpenStreetMap contributors.', href: 'https://www.openstreetmap.org/copyright' },
  { name: 'Nominatim usage policy', note: 'The public geocoding service has usage and attribution requirements that must be respected.', href: 'https://operations.osmfoundation.org/policies/nominatim/' },
  { name: 'Google Fonts', note: 'The site loads DM Sans, JetBrains Mono, Plus Jakarta Sans and Source Serif 4 through Google Fonts. Review the license for each font.', href: 'https://fonts.google.com/' },
  { name: 'Project dependencies', note: 'React, Three.js, Leaflet, Lucide, Motion and other packages are subject to their own licenses and notices; the package list is not a complete license audit.', href: 'https://github.com/watchflixer/tera-observatory/blob/main/package.json' },
  { name: 'Magnific AI', note: 'The creator reports using Magnific for AI-generated videos. The applicable plan, creation-date terms and commercial rights for each video must be checked.', href: 'https://www.magnific.com/ai/docs/ai-content-and-copyright' },
];

export function AboutDisclosures() {
  return (
    <section className="mt-12 border-t border-white/10 pt-10 sm:mt-16" aria-label="About this website, draft terms, privacy and credits">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="shop-eyebrow">ABOUT &amp; TRANSPARENCY</p><h2 className="mt-2 font-display text-2xl font-semibold text-white">The whole picture.</h2><p className="mt-2 text-sm text-[#aaa29e]">What this website does, how it uses services, and where its materials come from.</p></div>
        <nav aria-label="Website information" className="flex flex-wrap gap-4 text-xs font-medium text-[#e2b87e]"><a href="#about-terms">Terms</a><a href="#about-privacy">Privacy</a><a href="#about-sources">Rights &amp; credits</a></nav>
      </div>
      <div role="note" className="mt-5 flex gap-3 rounded-xl border border-[#d6a264]/25 bg-[#d6a264]/[0.07] p-4 text-xs leading-5 text-[#e3cfb4]"><ShieldCheck className="h-4 w-4 shrink-0" /><p><strong>Draft information for review, not legal clearance.</strong> The operator’s identity and contact, payment and refund rules, actual privacy practices and individual asset licenses are not yet confirmed. This page is not a complete rights clearance or a final legal policy.</p></div>

      <article id="about-overview" className="shop-legal-card mt-6 scroll-mt-8">
        <div className="flex items-center gap-2 text-[#e5b474]"><Globe2 className="h-4 w-4" /><span className="shop-eyebrow">ABOUT THE WEBSITE</span></div>
        <h3>Explore Earth, life and deep time.</h3>
        <p>Terra Observatory is an interactive educational and exploratory website. Its globe presents Earth’s surface and planetary systems alongside visualizations of its interior, atmosphere and geological history. The Field Guide provides context and controls, and visitors can explore locations, landmarks, maps, cloud cover, rotation, tectonic features, satellites and asteroids.</p>
        <p>TerraPedia connects visitors to encyclopedia articles, search, languages and image galleries. The extinct-life showcase presents species and habitats using illustrations, reconstructions, videos and sound. Some views are modeled or artistic representations, not live observations. Images, scientific figures, maps and descriptions may be simplified, incomplete or out of date; they are not a substitute for navigation, safety advice or professional research.</p>
        <p>This page also explains the project, its sources and the intended optional donation feature. Donations are not currently active.</p>
      </article>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article id="about-terms" className="shop-legal-card scroll-mt-24">
          <div className="flex items-center gap-2 text-[#e5b474]"><Layers3 className="h-4 w-4" /><span className="shop-eyebrow">TERMS OF USE / DRAFT</span></div>
          <h3>Using Terra Observatory</h3>
          <h4>Scope and responsible use</h4>
          <p>These draft terms describe the website and proposed services; they are not a final agreement. Visitors should use the site lawfully, avoid disrupting or overloading it or its providers, and respect third-party terms, copyrights and privacy. Automated or bulk use may also be restricted by the underlying services.</p>
          <h4>Educational content and availability</h4>
          <p>The site is intended for general education and exploration. Information and imagery can contain errors or change without notice. Features depend on browser support, internet access and outside providers and may be unavailable or changed. No specific uptime, accuracy or performance level has been established.</p>
          <h4>Donations</h4>
          <p>Donations are intended as optional support for the project. The donation button is disabled and no donation provider is connected, so no donation is currently accepted through this page. Before accepting donations, the operator must identify the recipient and provider and confirm the intended use of funds, any fees and applicable refund policy. A MariBank account alone does not connect a donation service.</p>
          <h4>Ownership and links</h4>
          <p>Project materials and third-party materials may have different owners and licenses. No project-wide license or ownership claim is established here. Visitors must obtain any permissions needed for copying, commercial use or redistribution; links to other sites do not imply endorsement or transfer of rights. See Rights &amp; credits below.</p>
          <h4>Operator and questions</h4>
          <p>Operator name, business or legal details, support contact, applicable jurisdiction and final consumer terms are pending. These details and the final policy need legal review before collecting donations.</p>
        </article>

        <article id="about-privacy" className="shop-legal-card scroll-mt-24">
          <div className="flex items-center gap-2 text-[#e5b474]"><LockKeyhole className="h-4 w-4" /><span className="shop-eyebrow">PRIVACY / DRAFT</span></div>
          <h3>How information is used</h3>
          <h4>What the current site sends</h4>
          <p>To display the website, the browser requests files from its host (the public deployment uses GitHub Pages). Map tiles and labels may be requested from Esri; the code also includes an OpenStreetMap tile source. Fonts load from Google Fonts. These providers can receive network information such as your IP address, request time, browser information and requested resources, subject to their own practices.</p>
          <p>When you search for a place or inspect a location, the browser sends the place name or selected map coordinates to Nominatim to obtain a result. Those coordinates describe the location you select, not necessarily your physical location. The current source does not request the browser’s device geolocation permission.</p>
          <p>When you use TerraPedia, article titles, search terms, selected language and related image queries are sent to Wikipedia or Wikimedia Commons. Images and thumbnails may be loaded from Wikimedia servers. Searches could contain personal information, so avoid entering sensitive details.</p>
          <h4>Storage, accounts and payments</h4>
          <p>The inspected application code keeps some location and encyclopedia results in memory while it runs. Browsers and service providers may independently cache resources or keep logs; their retention periods have not been verified. The current site has no account registration, payment form or donation processor. No site-specific analytics or advertising integration was identified in the inspected source; this is not a statement about all host or provider logging.</p>
          <p>If accounts, payment or donations are added, the operator must explain what information is collected, why, the payment provider and recipients, legal basis, safeguards, international transfers and retention periods before processing begins. Do not send banking passwords, PINs or one-time codes through the site or to the operator.</p>
          <h4>Your choices and rights</h4>
          <p>You can avoid optional searches, leave the site, manage browser caches and settings, and consult each provider’s privacy policy. Applicable privacy laws may give you rights relating to your personal data. The operator must publish a privacy contact, how to make a request, complaint details and the actual retention and deletion practices; these are not yet supplied.</p>
          <p>Third-party services control their own processing. This draft requires review for the actual deployment and applicable law, including the Philippine Data Privacy Act where applicable.</p>
        </article>
      </div>

      <article id="about-sources" className="shop-legal-card mt-4 scroll-mt-24">
        <div className="flex items-center gap-2 text-[#e5b474]"><Globe2 className="h-4 w-4" /><span className="shop-eyebrow">RIGHTS, SOURCES &amp; CREDITS</span></div>
        <h3>Materials behind the experience</h3>
        <p>Terra Observatory combines project code, illustrations, audio, video, maps and outside information. Rights are specific to each item: listing a source below does not transfer ownership or replace required attribution, license notices or permission. Third-party names and marks belong to their respective owners.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{sources.map((item) => <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 hover:border-[#d2a568]/40"><span className="flex items-center justify-between gap-2 text-sm font-semibold text-[#eee9e6]">{item.name}<ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#a89c95] group-hover:text-[#e5b474]" /></span><span className="mt-1 block text-xs leading-5 text-[#a9a29e]">{item.note}</span></a>)}</div>
        <h4>Project visuals and audio</h4>
        <p>The project includes locally stored Earth textures, habitat and extinct-species images, T-rex and dodo videos, and generated or synthesized sound. The T-rex soundtrack was synthesized for the project. The creator reports using AI tools for images, video and audio; authorship, source inputs, licenses and commercial-use rights must be verified item by item. AI generation does not itself establish copyright ownership or permission to commercialize.</p>
        <h4>Outstanding attribution and license work</h4>
        <p>Wikipedia articles should be credited with their source, contributors and applicable license, and each displayed image must be checked for its own author, license and permitted uses; some images may not be freely reusable. The current gallery does not yet provide complete per-image license attribution. Map attribution must remain visible where required, and Esri and Nominatim usage and commercial terms must be reviewed. The project repository has no confirmed project-wide license. Credits, rights and permissions are therefore not complete or independently cleared.</p>
      </article>
    </section>
  );
}
