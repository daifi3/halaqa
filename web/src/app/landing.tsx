import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { AppDownloadPrompt } from '@/components/app-download-prompt';
import { StoreBadges } from '@/components/auth-art';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import type { DemoRequestInput } from '@/lib/types';
import { colors } from '@/theme';
import './landing.css';

/* ------------------------------------------------------------------ motion helpers */

/**
 * Fades and lifts `.reveal` elements in as they scroll into view (once each).
 * Without IntersectionObserver everything is simply shown.
 */
function useScrollReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.landing .reveal'));
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ nav */

const NAV: { id: string; label: string }[] = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'apps', label: 'Apps' },
  { id: 'faq', label: 'FAQ' },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="lp-wrap lp-nav-inner">
        <button type="button" className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="lp-logo"><Icon name="easel-outline" size={18} color="#fff" /></span>
          <span>Halaqa</span>
        </button>
        <nav className="lp-links" aria-label="Sections">
          {NAV.map((n) => <button key={n.id} type="button" onClick={() => scrollToId(n.id)}>{n.label}</button>)}
        </nav>
        <div className="lp-nav-actions">
          <Link to="/log-in" className="lp-login">Log in</Link>
          <button type="button" className="lp-cta-sm" onClick={() => scrollToId('demo')}>Request a demo</button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ hero mock-up */

const TILES = [
  { initials: 'DA', name: 'Dr. Amrani', color: colors.teacher },
  { initials: 'YB', name: 'Yasmine', color: colors.student },
  { initials: 'KH', name: 'Karim', color: colors.success },
  { initials: 'LM', name: 'Lina', color: '#C2410C' },
];

const CHAT = [
  { who: 'Yasmine', text: 'Is the vertex at x = 2?' },
  { who: 'Dr. Amrani', text: 'Exactly! f(2) = −1 👏' },
  { who: 'Karim', text: 'Got it, thanks!' },
];

/** A looping, purely decorative live class: speakers take turns, the board draws itself, chat pops in. */
function LiveClassMock() {
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock-bar">
        <span className="lp-live"><span className="lp-live-dot" />LIVE</span>
        <span className="lp-mock-title">Algebra · Terminale</span>
        <span className="lp-mock-time">24:18</span>
      </div>
      <div className="lp-mock-body">
        <div className="lp-board">
          <svg viewBox="0 0 320 200" className="lp-board-svg">
            <defs>
              <pattern id="lp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="320" height="200" fill="url(#lp-grid)" />
            <line x1="20" y1="150" x2="300" y2="150" className="lp-axis" />
            <line x1="60" y1="20" x2="60" y2="185" className="lp-axis" />
            <path className="lp-draw lp-curve" d="M 80 30 Q 160 250 240 30" />
            <circle className="lp-pop" cx="160" cy="140" r="5" />
            <path className="lp-draw lp-under" d="M 176 60 L 296 60" />
          </svg>
          <span className="lp-eq">f(x) = x² − 4x + 3</span>
          <span className="lp-cursor"><Icon name="brush" size={14} color="#fff" /></span>
        </div>
        <div className="lp-tiles">
          {TILES.map((t, i) => (
            <div key={t.name} className="lp-tile" style={{ ['--i' as string]: i } as CSSProperties}>
              <span className="lp-tile-avatar" style={{ backgroundColor: t.color }}>{t.initials}</span>
              <span className="lp-tile-name">{t.name}</span>
              <span className="lp-tile-wave"><i /><i /><i /></span>
            </div>
          ))}
        </div>
      </div>
      <div className="lp-chat">
        {CHAT.map((m, i) => (
          <div key={i} className={`lp-bubble${m.who === 'Dr. Amrani' ? ' mine' : ''}`} style={{ ['--i' as string]: i } as CSSProperties}>
            <b>{m.who}</b> {m.text}
          </div>
        ))}
      </div>
      <span className="lp-float r1">👏</span>
      <span className="lp-float r2">❤️</span>
      <span className="lp-float r3">🔥</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <span className="lp-blob b1" /><span className="lp-blob b2" /><span className="lp-blob b3" />
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-pill a-down"><Icon name="sparkles" size={14} color={colors.primary} />Live classes, without the hassle</span>
          <h1 className="lp-h1 a-up" style={{ animationDelay: '80ms' }}>
            Classrooms that <span className="lp-grad">feel close</span>, wherever you teach.
          </h1>
          <p className="lp-lead a-up" style={{ animationDelay: '160ms' }}>
            Halaqa brings live video, a shared whiteboard, homework, exams and recorded lessons together in one calm place —
            on Android, iPhone and the web.
          </p>
          <div className="lp-hero-ctas a-up" style={{ animationDelay: '240ms' }}>
            <button type="button" className="lp-cta" onClick={() => scrollToId('demo')}>
              Request a demo <Icon name="arrow-forward" size={18} color="#fff" />
            </button>
            <Link to="/log-in" className="lp-ghost">I already have an account</Link>
          </div>
          <ul className="lp-ticks a-up" style={{ animationDelay: '320ms' }}>
            {['Live video & screen sharing', 'Maths-ready whiteboard', 'One-tap recordings'].map((t) => (
              <li key={t}><Icon name="checkmark-circle" size={16} color={colors.success} />{t}</li>
            ))}
          </ul>
        </div>
        <div className="lp-hero-visual a-zoom" style={{ animationDelay: '200ms' }}>
          <LiveClassMock />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ sections */

const FEATURES: { icon: IconName; title: string; body: string; tone: string }[] = [
  { icon: 'videocam', title: 'Live video classes', body: 'HD video and audio, screen sharing, reactions and a class chat — with you in control of every mic.', tone: colors.teacher },
  { icon: 'easel', title: 'A shared whiteboard', body: 'Draw, add shapes, images and PDFs, and write real maths. Let students draw when you want them to.', tone: colors.student },
  { icon: 'ribbon', title: 'Exams that stay fair', body: 'Timed exams with several question types. Leaving the app submits the exam, so nobody looks things up.', tone: colors.success },
  { icon: 'document-text', title: 'Homework', body: 'Set work with a due date, collect answers and files, and review every submission in one place.', tone: '#C2410C' },
  { icon: 'play-circle', title: 'Recorded lessons', body: 'Record a class in one tap. Students who missed it can replay it whenever they need.', tone: colors.teacher },
  { icon: 'chatbubbles', title: 'Messages & calls', body: 'Direct chat with files and reactions, plus free audio calls between teachers and students.', tone: colors.student },
];

function Features() {
  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <SectionHead kicker="Features" title="Everything a class needs, nothing it doesn't."
          lead="Built for teachers who want to teach — not to juggle five different apps." />
        <div className="lp-features">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="lp-feature reveal" style={d(i * 70)}>
              <span className="lp-feature-icon" style={{ backgroundColor: f.tone + '1F', color: f.tone }}>
                <Icon name={f.icon} size={22} color={f.tone} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const teacher = ['Courses with a roster and a join code', 'Schedule sessions and see who is coming', 'Polls, quizzes and a board students can draw on', 'Grade exams and export the results'];
  const student = ['Join with an invite, a code or a QR scan', 'Follow the board and ask in the chat', 'Hand in homework from your phone', 'Replay any recorded class'];
  return (
    <section className="lp-section alt">
      <div className="lp-wrap lp-roles">
        <RoleCard icon="school" title="For teachers" tone={colors.teacher} items={teacher} delayMs={0} />
        <RoleCard icon="book" title="For students" tone={colors.student} items={student} delayMs={120} />
      </div>
    </section>
  );
}

function RoleCard({ icon, title, tone, items, delayMs }: { icon: IconName; title: string; tone: string; items: string[]; delayMs: number }) {
  return (
    <div className="lp-role reveal" style={d(delayMs)}>
      <span className="lp-role-icon" style={{ backgroundColor: tone }}><Icon name={icon} size={22} color="#fff" /></span>
      <h3>{title}</h3>
      <ul>
        {items.map((t) => <li key={t}><Icon name="checkmark" size={16} color={tone} />{t}</li>)}
      </ul>
    </div>
  );
}

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'mail', title: 'Request a demo', body: 'Tell us about you or your school with the form below.' },
  { icon: 'videocam', title: 'See Halaqa live', body: 'We walk you through a real class and answer your questions.' },
  { icon: 'card', title: 'Choose your plan', body: 'We agree the plan and payment with you. No surprises.' },
  { icon: 'person-add', title: 'Start teaching', body: 'We create your accounts. Sign in on any device and go live.' },
];

function HowItWorks() {
  return (
    <section id="how" className="lp-section">
      <div className="lp-wrap">
        <SectionHead kicker="How it works" title="From first hello to your first class." />
        <ol className="lp-steps reveal">
          {STEPS.map((s, i) => (
            <li key={s.title} className="lp-step" style={d(150 + i * 160)}>
              <span className="lp-step-icon"><Icon name={s.icon} size={20} color="#fff" /><em>{i + 1}</em></span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Apps() {
  return (
    <section id="apps" className="lp-section alt">
      <div className="lp-wrap lp-apps">
        <div className="lp-apps-copy reveal">
          <Text variant="label" color={colors.primary}>Apps</Text>
          <h2 className="lp-h2">Take your class with you.</h2>
          <p className="lp-lead">
            Teach and learn from the Android app, add Halaqa to your iPhone's Home Screen, or simply open it in a browser on
            any computer. One account works everywhere.
          </p>
          <StoreBadges />
        </div>
        <div className="lp-phone reveal" style={d(140)} aria-hidden="true">
          <div className="lp-phone-screen">
            <span className="lp-phone-notch" />
            <span className="lp-phone-greet">Good morning,</span>
            <span className="lp-phone-name">Yasmine</span>
            <div className="lp-phone-card"><span className="lp-live sm"><span className="lp-live-dot" />LIVE</span><b>Algebra</b><small>Dr. Amrani · now</small></div>
            <div className="lp-phone-card muted"><b>Physics lab</b><small>Tomorrow, 10:00</small></div>
            <div className="lp-phone-card muted"><b>Homework due</b><small>Friday</small></div>
            <div className="lp-phone-tabs"><i className="on" /><i /><i /><i /><i /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQS: { q: string; a: string }[] = [
  { q: 'How do I get an account?', a: 'Request a demo below. After the demo we agree a plan with you, and once it is paid the Halaqa team creates your accounts — you then sign in with the email and password we send you.' },
  { q: 'Can I sign up on my own?', a: 'Not at the moment. Every account is set up by our team, so each school and teacher gets the right access from day one.' },
  { q: 'How do my students join?', a: 'Their accounts are created for them too. You then invite them to your courses and sessions by email, or share a 6-letter code or a QR code.' },
  { q: 'Which devices does Halaqa work on?', a: 'Android phones and tablets (app), iPhone and iPad (add the web app to your Home Screen — a native iOS app is coming soon), and any computer with a modern browser.' },
  { q: 'Who can see my classes and recordings?', a: 'Only the people you invite: your course roster and the students on a session. Recordings follow the same rule.' },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="lp-section">
      <div className="lp-wrap lp-faq-wrap">
        <SectionHead kicker="FAQ" title="Questions, answered." />
        <div className="lp-faq">
          {FAQS.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className={`lp-faq-item reveal${on ? ' open' : ''}`} style={d(i * 60)}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)}>
                  <span>{f.q}</span>
                  <span className="lp-faq-sign"><Icon name="add" size={18} /></span>
                </button>
                <div className="lp-faq-answer"><p>{f.a}</p></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ demo request */

const EMPTY: DemoRequestInput = { name: '', email: '', phone: '', organization: '', message: '', website: '' };

function DemoForm() {
  const [form, setForm] = useState<DemoRequestInput>(EMPTY);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<DemoRequestInput>) => { setForm((f) => ({ ...f, ...patch })); setError(null); };
  const emailOk = isValidEmail(form.email.trim());
  const canSend = form.name.trim().length >= 2 && emailOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    try {
      await api.requestDemo({ ...form, email: form.email.trim().toLowerCase() });
      setSentTo(form.name.trim().split(' ')[0] ?? form.name.trim());
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t send your request. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="demo" className="lp-section lp-demo">
      <div className="lp-wrap lp-demo-grid">
        <div className="lp-demo-copy reveal">
          <Text variant="label" color="#A5A1FF">Request a demo</Text>
          <h2 className="lp-h2" style={{ color: '#fff' }}>See Halaqa with your own classes in mind.</h2>
          <p className="lp-lead" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Leave your details and we'll get back to you to book a short live demo. If Halaqa fits, we set up your accounts
            right after.
          </p>
          <ul className="lp-demo-points">
            <li><Icon name="time-outline" size={18} color="#A5A1FF" />A 20-minute walkthrough, at a time that suits you</li>
            <li><Icon name="people-outline" size={18} color="#A5A1FF" />For individual teachers and whole schools</li>
            <li><Icon name="shield-checkmark-outline" size={18} color="#A5A1FF" />We only use your details to contact you about Halaqa</li>
          </ul>
        </div>

        <div className="lp-demo-card reveal" style={d(120)}>
          {sentTo ? (
            <div className="lp-sent" role="status">
              <span className="lp-sent-check"><Icon name="checkmark" size={34} color="#fff" /></span>
              <Text variant="title">Thanks, {sentTo}!</Text>
              <Text color={colors.muted} style={{ textAlign: 'center' }}>
                Your request is in. We'll contact you soon to book your demo.
              </Text>
              <Button title="Send another request" variant="secondary" onPress={() => setSentTo(null)} style={{ marginTop: 8 }} />
            </div>
          ) : (
            <form className="v" style={{ gap: 14 }} onSubmit={submit} noValidate>
              <Input label="Full name" icon="person-outline" value={form.name} onChangeText={(name) => set({ name })}
                placeholder="e.g. Sara Belkacem" autoComplete="name" maxLength={120} required />
              <Input label="Email" icon="mail-outline" value={form.email} onChangeText={(email) => set({ email })} type="email"
                placeholder="you@school.dz" autoComplete="email" maxLength={255} required
                error={form.email.trim() && !emailOk ? 'That email doesn’t look right' : null} />
              <div className="lp-two">
                <Input label="Phone (optional)" icon="call-outline" value={form.phone} onChangeText={(phone) => set({ phone })}
                  type="tel" placeholder="+213 …" autoComplete="tel" maxLength={40} />
                <Input label="School (optional)" icon="business-outline" value={form.organization}
                  onChangeText={(organization) => set({ organization })} placeholder="School or organisation"
                  autoComplete="organization" maxLength={160} />
              </div>
              <Input label="Anything we should know? (optional)" icon="chatbox-ellipses-outline" value={form.message}
                onChangeText={(message) => set({ message })} multiline minHeight={90}
                placeholder="Subjects, number of teachers or students, what you teach today…" maxLength={1000} />
              {/* Honeypot: hidden from people (and screen readers); bots fill it in. */}
              <input className="lp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website}
                onChange={(e) => set({ website: e.target.value })} name="website" />
              {error && <Text variant="small" color={colors.danger}>{error}</Text>}
              <Button type="submit" title="Request my demo" icon="paper-plane-outline" loading={sending} disabled={!canSend} />
              <Text variant="small" color={colors.muted} style={{ textAlign: 'center' }}>
                Already a customer? <Link to="/log-in" className="lp-inline-link">Log in</Link>
              </Text>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ bits */

function SectionHead({ kicker, title, lead }: { kicker: string; title: string; lead?: ReactNode }) {
  return (
    <div className="lp-head reveal">
      <Text variant="label" color={colors.primary}>{kicker}</Text>
      <h2 className="lp-h2">{title}</h2>
      {lead && <p className="lp-lead">{lead}</p>}
    </div>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <span className="lp-brand static"><span className="lp-logo"><Icon name="easel-outline" size={16} color="#fff" /></span>Halaqa</span>
        <nav className="lp-footer-links" aria-label="Footer">
          {NAV.map((n) => <button key={n.id} type="button" onClick={() => scrollToId(n.id)}>{n.label}</button>)}
          <Link to="/log-in">Log in</Link>
        </nav>
        <small>© {new Date().getFullYear()} Halaqa</small>
      </div>
    </footer>
  );
}

/** The public front page: what Halaqa is, and the way in (request a demo, or log in). */
export default function Landing() {
  useScrollReveal();
  const { hash } = useLocation();
  const done = useRef(false);

  // /welcome#demo (e.g. from the log-in page or an old sign-up link) lands on the form.
  useEffect(() => {
    if (done.current || !hash) return;
    done.current = true;
    const id = hash.slice(1);
    window.setTimeout(() => scrollToId(id), 250);
  }, [hash]);

  return (
    <div className="landing">
      <Nav />
      <AppDownloadPrompt belowNav />
      <main>
        <Hero />
        <Features />
        <Roles />
        <HowItWorks />
        <Apps />
        <Faq />
        <DemoForm />
      </main>
      <Footer />
    </div>
  );
}
