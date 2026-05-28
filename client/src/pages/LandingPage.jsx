import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="font-sans">
      <nav className="sticky top-0 z-50 border-b border-stone-800" style={{ backgroundColor: '#1c1917' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold" style={{ color: '#ea580c' }}>LeadCatch Solutions</div>
            <div className="text-stone-500 text-xs">useleadcatch.com</div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#why-us" className="text-stone-400 hover:text-white text-sm transition">Why Us</a>
            <a href="#knocktrakr" className="text-stone-400 hover:text-white text-sm transition">KnockTrakr</a>
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg text-sm font-semibold border transition hover:bg-orange-600 hover:border-orange-600 hover:text-white"
              style={{ borderColor: '#ea580c', color: '#ea580c' }}
            >
              Login
            </Link>
          </div>
          <button className="md:hidden text-stone-400" onClick={() => setMobileMenuOpen(o => !o)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-800 px-4 py-4 space-y-3" style={{ backgroundColor: '#1c1917' }}>
            <a href="#why-us" onClick={() => setMobileMenuOpen(false)} className="block text-stone-400 text-sm py-1">Why Us</a>
            <a href="#knocktrakr" onClick={() => setMobileMenuOpen(false)} className="block text-stone-400 text-sm py-1">KnockTrakr</a>
            <Link to="/login" className="block text-sm font-semibold py-2 px-4 rounded-lg text-center" style={{ backgroundColor: '#ea580c', color: 'white' }}>Login</Link>
          </div>
        )}
      </nav>

      <section className="py-24 px-4" style={{ backgroundColor: '#1c1917' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            Software and guidance for teams that sell in the field.
          </h1>
          <p className="text-stone-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
            We work with owners who are tired of guessing what happens after the truck rolls out.
            We learn how you sell, fix what is costing you money, and build tools your team will
            actually use. We started with door knocking crews.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl text-white font-semibold text-base transition active:scale-95"
              style={{ backgroundColor: '#ea580c' }}
            >
              Get KnockTrakr
            </Link>
            <a
              href="#why-us"
              className="px-6 py-3 rounded-xl text-white font-semibold text-base border border-white/30 hover:border-white/60 transition"
            >
              Why we do this
            </a>
          </div>
        </div>
      </section>

      <section id="why-us" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-6">Why we built this</h2>
          <p className="text-stone-600 text-lg leading-relaxed mb-10 max-w-2xl">
            You hire reps to knock doors. You hope they are out working. Most days you are going
            off gut feel and whatever they tell you at the end of the shift. We sit down with you,
            watch how the team really runs, and put a system in place that fits your company.
            Not a bloated CRM. Something a rep can tap through between houses.
          </p>
          <div className="space-y-4">
            {[
              'We learn your process before we sell you anything',
              'Built for roofing and home service teams that knock',
              'Works on a phone. Setup is not a month long project.',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: '#ea580c' }}
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-stone-700 text-base">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="knocktrakr" className="py-24 px-4" style={{ backgroundColor: '#1c1917' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#ea580c' }}>
            OUR FIRST PRODUCT
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">KnockTrakr</h2>
          <p className="text-stone-400 text-xl mb-12 max-w-xl">
            See what your reps did today without riding around behind them.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                n: '1',
                title: 'Rep at the door',
                body: 'Tap no answer or answered. Log the address. Save a lead when someone bites.',
              },
              {
                n: '2',
                title: 'Manager dashboard',
                body: 'Knocks, leads, and who is active today. All in one screen.',
              },
              {
                n: '3',
                title: 'Export and follow up',
                body: 'Pull a CSV and run your normal follow up from there.',
              },
            ].map(card => (
              <div key={card.n} className="bg-stone-800 rounded-2xl p-6 border border-stone-700">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg mb-4"
                  style={{ backgroundColor: '#ea580c' }}
                >
                  {card.n}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{card.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          <Link
            to="/login"
            className="inline-block px-8 py-4 rounded-xl text-white font-bold text-lg transition active:scale-95"
            style={{ backgroundColor: '#ea580c' }}
          >
            Get KnockTrakr
          </Link>
        </div>
      </section>

      <footer className="py-12 px-4 border-t border-stone-800" style={{ backgroundColor: '#1c1917' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <div>
              <div className="text-white font-bold text-lg">LeadCatch Solutions</div>
              <div className="text-stone-500 text-sm">useleadcatch.com</div>
            </div>
            <div className="flex gap-6">
              <a href="#why-us" className="text-stone-400 hover:text-white text-sm transition">Why Us</a>
              <a href="#knocktrakr" className="text-stone-400 hover:text-white text-sm transition">KnockTrakr</a>
              <Link to="/login" className="text-stone-400 hover:text-white text-sm transition">Login</Link>
            </div>
          </div>
          <p className="text-stone-500 text-sm max-w-2xl mb-6 leading-relaxed">
            Why start here? A lot of roofing companies still book jobs off knocks. Almost none of them
            track it well. KnockTrakr gives you a real number on activity and puts interested homeowners
            in one list.
          </p>
          <div className="border-t border-stone-800 pt-6">
            <span className="text-stone-500 text-sm">Already have an account? </span>
            <Link to="/login" className="text-sm font-medium" style={{ color: '#ea580c' }}>Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
