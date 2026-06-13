import { useEffect, useMemo, useState } from 'react'
import './App.css'
import logoBanner from './assets/logo-banner-t.png'
import logoEmblem from './assets/logo-emblem-t.png'
import { formatPrice, listActiveServices } from './lib/services'
import type { Service } from './lib/services'
import { listActiveBarbers } from './lib/barbers'
import type { Barber } from './lib/barbers'
import { bookAppointment, getAvailableSlots } from './lib/booking'

/* ---------- data ---------- */
type Why = { n: string; t: string; d: string }
type PriceCard = { cat: string; rows: [string, string][]; feature?: boolean; tag?: string }
type Product = { l: string; t: string; d: string }
type Testimonial = { q: string; n: string; c: string }
type Hour = [day: string, hours: string, open: boolean]

const why: Why[] = [
  { n: 'I', t: 'Savoir-faire', d: "Des barbiers d'expérience, un geste précis et maîtrisé à chaque passage." },
  { n: 'II', t: 'Ambiance authentique', d: 'Bois, cuir et métal pour une atmosphère chaleureuse et vintage.' },
  { n: 'III', t: 'Sans rendez-vous', d: 'Passez quand ça vous chante : on vous accueille en tout temps.' },
  { n: 'IV', t: 'Produits Aura', d: 'Une sélection de soins premium, disponibles directement en boutique.' },
]
const aura: Product[] = [
  { l: 'Coiffage', t: 'Pommade', d: 'Fixation forte, fini mat.' },
  { l: 'Barbe', t: 'Huile à barbe', d: 'Nourrit et adoucit le poil.' },
  { l: 'Soin', t: 'Shampoing', d: 'Nettoyant doux quotidien.' },
  { l: 'Après-rasage', t: 'Baume apaisant', d: 'Calme la peau après la lame.' },
]
const testi: Testimonial[] = [
  { q: 'Meilleur barbier de Saint-Sauveur. Service impeccable et coupe parfaite à chaque visite.', n: 'Marc-André L.', c: 'Client fidèle' },
  { q: 'Une ambiance authentique et chaleureuse. On ressort comme un vrai gentleman.', n: 'Jean-Philippe R.', c: 'Client' },
  { q: 'Accueil chaleureux et savoir-faire au rendez-vous. Je recommande les yeux fermés.', n: 'Olivier T.', c: 'Client' },
]
const hours: Hour[] = [
  ['Lundi', 'Fermé', false],
  ['Mardi', '10h00 – 17h00', true],
  ['Mercredi', '10h00 – 17h00', true],
  ['Jeudi', '10h00 – 20h00', true],
  ['Vendredi', '10h00 – 20h00', true],
  ['Samedi', '09h00 – 16h00', true],
  ['Dimanche', 'Fermé', false],
]

const PHONE = '+15142943419'
const PHONE_DISPLAY = '514 294 3419'

const navLinks = [
  ['#services', 'Services'],
  ['#tarifs', 'Tarifs'],
  ['#produits', 'Produits Aura'],
  ['#contact', 'Contact'],
] as const

const todayIdx = (new Date().getDay() + 6) % 7 // Mon = 0

function App() {
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDone, setModalDone] = useState(false)
  const [svcSel, setSvcSel] = useState(0)
  const [barberSel, setBarberSel] = useState(0)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotSel, setSlotSel] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookConfirmed, setBookConfirmed] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])

  /* services + barbiers depuis Supabase */
  useEffect(() => {
    listActiveServices()
      .then(setServices)
      .catch((e) => console.error('Chargement des services échoué', e))
    listActiveBarbers()
      .then(setBarbers)
      .catch((e) => console.error('Chargement des barbiers échoué', e))
  }, [])

  /* créneaux disponibles (réservation en ligne) */
  useEffect(() => {
    const svc = services[svcSel]
    const barber = barbers[barberSel]
    let active = true
    if (modalOpen && svc && barber && date) {
      getAvailableSlots(svc.id, barber.id, date)
        .then((s) => active && setSlots(s))
        .catch(() => active && setSlots([]))
    }
    return () => {
      active = false
    }
  }, [modalOpen, services, barbers, svcSel, barberSel, date])

  /* cartes de tarifs dérivées : regroupées par catégorie */
  const prices = useMemo<PriceCard[]>(() => {
    const byCat = new Map<string, [string, string][]>()
    for (const s of services) {
      const rows = byCat.get(s.category) ?? []
      rows.push([s.name, formatPrice(s.price_cents)])
      byCat.set(s.category, rows)
    }
    return Array.from(byCat, ([cat, rows]) => ({
      cat,
      rows,
      feature: cat === 'Combo',
      tag: cat === 'Combo' ? 'Populaire' : undefined,
    }))
  }, [services])

  /* nav scroll state */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* reveal on scroll */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in')
            io.unobserve(en.target)
          }
        }),
      { threshold: 0.12 },
    )
    els.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 60}ms`
      io.observe(el)
    })
    return () => io.disconnect()
  }, [services])

  /* modal: lock scroll + escape to close */
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : ''
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  function openModal() {
    setModalDone(false)
    setBookError(null)
    setBookConfirmed(false)
    setSlotSel('')
    setModalOpen(true)
    setDrawerOpen(false)
    if (!date) {
      setDate(new Date(Date.now() + 864e5).toISOString().slice(0, 10))
    }
  }
  function closeModal() {
    setModalOpen(false)
  }

  async function submitBooking() {
    const svc = services[svcSel]
    const barber = barbers[barberSel]
    if (!svc || !barber || !date || !slotSel || !fullName.trim()) {
      setBookError('Choisissez un service, un barbier, une date, une heure et indiquez votre nom.')
      return
    }
    setBooking(true)
    setBookError(null)
    try {
      const start = new Date(`${date}T${slotSel}:00`)
      const res = await bookAppointment({
        serviceId: svc.id,
        barberId: barber.id,
        startsAt: start.toISOString(),
        firstName: fullName.trim(),
        phone,
      })
      setBookConfirmed(res.status === 'confirmed')
      setModalDone(true)
    } catch (e) {
      setBookError(e instanceof Error ? e.message : 'La réservation a échoué. Réessayez.')
    } finally {
      setBooking(false)
    }
  }

  const todayHours = hours[todayIdx][2] ? hours[todayIdx][1].replace(/\s/g, '') : 'Fermé'

  return (
    <>
      {/* ============ NAV ============ */}
      <header className={scrolled ? 'scrolled' : ''}>
        <div className="wrap nav">
          <a href="#top">
            <img className="logo" src={logoBanner} alt="Les Frères Barbiers" />
          </a>
          <nav className="links">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <a href={`tel:${PHONE}`} className="phone">
            <span>☎</span> {PHONE_DISPLAY}
          </a>
          <button className="btn btn-primary" onClick={openModal} style={{ padding: '12px 22px' }}>
            Rendez-vous
          </button>
          <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Menu">
            ☰
          </button>
        </div>
      </header>

      <div className={`drawer${drawerOpen ? ' open' : ''}`}>
        <button className="x" onClick={() => setDrawerOpen(false)} aria-label="Fermer">
          ✕
        </button>
        {navLinks.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setDrawerOpen(false)}>
            {label}
          </a>
        ))}
        <a href={`tel:${PHONE}`} onClick={() => setDrawerOpen(false)}>
          ☎ {PHONE_DISPLAY}
        </a>
        <button className="btn btn-primary" onClick={openModal} style={{ marginTop: 18 }}>
          Prendre rendez-vous
        </button>
      </div>

      {/* ============ HERO ============ */}
      <section className="hero" id="top">
        <div className="hero-bg"></div>
        <div className="wrap">
          <div className="hero-content">
            <div className="eyebrow">Barber Shop · Saint-Sauveur</div>
            <h1>
              Le savoir-faire<em>au service des gentlemen</em>
            </h1>
            <p className="sub">
              Coupe, taille de barbe et rasage traditionnel à la lame, dans une ambiance vintage où le bois, le cuir et
              le métal racontent un métier d'artisan.
            </p>
            <div className="cta-row">
              <button className="btn btn-primary" onClick={openModal}>
                <span className="ic">✂</span> Prendre rendez-vous
              </button>
              <a href="#tarifs" className="btn btn-outline">
                Voir les tarifs
              </a>
            </div>
            <div className="facts">
              <div className="f">
                <span className="stars">★★★★★</span>
                <span>Avis Google</span>
              </div>
              <div className="f">
                <b>Sans rendez-vous</b>
                <span>En tout temps</span>
              </div>
              <div className="f">
                <b>Aujourd'hui</b>
                <span>{todayHours}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="scrolldown">
          <span>Découvrir</span>
          <span className="line"></span>
        </div>
      </section>

      {/* ============ TRUST ============ */}
      <div className="trust">
        <div className="wrap">
          <div className="t">
            <span className="ic">★</span>
            <div>
              4,9 / 5<small>Avis clients</small>
            </div>
          </div>
          <div className="t">
            <span className="ic">✂</span>
            <div>
              Barbiers d'expérience<small>Geste maîtrisé</small>
            </div>
          </div>
          <div className="t">
            <span className="ic">⚑</span>
            <div>
              246 Rue Principale<small>Saint-Sauveur, QC</small>
            </div>
          </div>
          <div className="t">
            <span className="ic">✦</span>
            <div>
              Produits Aura<small>En boutique</small>
            </div>
          </div>
        </div>
      </div>

      {/* ============ SERVICES ============ */}
      <section className="block" id="services">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Nos prestations</span>
            <h2>Des services à l'ancienne</h2>
            <div className="lead">Précision, tradition et un soin du détail à chaque fauteuil.</div>
          </div>
          <div className="services-grid">
            {services.map((s, i) => (
              <article className="svc reveal" key={s.id}>
                <div className="num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <div className="price">
                  <span style={{ opacity: 0.6, fontWeight: 400 }}>à partir de</span> {formatPrice(s.price_cents)}
                </div>
              </article>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 46 }} className="reveal">
            <button className="btn btn-ghost" onClick={openModal}>
              Réserver une prestation
            </button>
          </div>
        </div>
      </section>

      {/* ============ WHY US ============ */}
      <section className="block why on-dark" id="why">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Pourquoi nous choisir</span>
            <h2>L'esprit barbershop</h2>
            <div className="lead">Un savoir-faire traditionnel, une expérience moderne.</div>
          </div>
          <div className="why-grid">
            {why.map((w) => (
              <div className="w reveal" key={w.n}>
                <div className="n">{w.n}</div>
                <div className="bar"></div>
                <h3>{w.t}</h3>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TARIFS ============ */}
      <section className="block" id="tarifs">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Tarifs</span>
            <h2>Des prix clairs</h2>
            <div className="lead">Aucun rendez-vous requis — passez quand ça vous chante.</div>
          </div>
          <div className="price-grid">
            {prices.map((p) => (
              <div className={`pcard${p.feature ? ' feature' : ''} reveal`} key={p.cat}>
                <div className="cat">
                  {p.cat}
                  {p.tag ? <span className="tag">{p.tag}</span> : null}
                </div>
                {p.rows.map((r) => (
                  <div className="pline" key={r[0]}>
                    <span className="nm">{r[0]}</span>
                    <span className="pr">{r[1]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="price-note reveal">« Sans rendez-vous en tout temps »</div>
        </div>
      </section>

      {/* ============ PRODUITS AURA ============ */}
      <section className="block aura" id="produits">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">La boutique</span>
            <h2>Produits Aura</h2>
            <div className="lead">Les soins premium que nous utilisons, à emporter chez vous.</div>
          </div>
          <div className="aura-grid">
            {aura.map((a) => (
              <article className="prod reveal" key={a.t}>
                <div className="ph">
                  <span>
                    PHOTO PACKSHOT
                    <br />
                    {a.t.toUpperCase()}
                  </span>
                </div>
                <div className="meta">
                  <div className="l">{a.l}</div>
                  <h4>{a.t}</h4>
                  <p>{a.d}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TÉMOIGNAGES ============ */}
      <section className="block testi on-dark">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Témoignages</span>
            <h2>Ils nous font confiance</h2>
          </div>
          <div className="testi-grid">
            {testi.map((t) => (
              <figure className="quote reveal" key={t.n}>
                <div className="stars">★★★★★</div>
                <blockquote>“{t.q}”</blockquote>
                <figcaption className="who">
                  <div className="av">{t.n[0]}</div>
                  <div>
                    <div className="nm">{t.n}</div>
                    <small>{t.c}</small>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section className="block aura" id="contact">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Nous trouver</span>
            <h2>Coordonnées &amp; horaires</h2>
          </div>
          <div className="contact-grid">
            <div className="reveal">
              <div className="map">
                <div className="pin">
                  CARTE GOOGLE (embed)
                  <br />
                  246 Rue Principale
                  <br />
                  Saint-Sauveur, QC J0R 1R0
                </div>
              </div>
              <div className="info-block">
                <a className="info-row" href={`tel:${PHONE}`}>
                  <div className="ic">☎</div>
                  <div className="t">
                    <b>Téléphone</b>
                    <span>+1 {PHONE_DISPLAY}</span>
                  </div>
                </a>
                <a className="info-row" href="mailto:info@les-freres-barbiers.com">
                  <div className="ic">✉</div>
                  <div className="t">
                    <b>Courriel</b>
                    <span>info@les-freres-barbiers.com</span>
                  </div>
                </a>
                <div className="info-row">
                  <div className="ic">⚑</div>
                  <div className="t">
                    <b>Adresse</b>
                    <span>246 Rue Principale, Saint-Sauveur, QC J0R 1R0</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn btn-primary"
                  onClick={openModal}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span className="ic">✂</span> Prendre rendez-vous
                </button>
              </div>
            </div>
            <div className="reveal">
              <div className="hours">
                <h4>Heures d'ouverture</h4>
                {hours.map((h, i) => (
                  <div className={`hrow${h[2] ? '' : ' closed'}${i === todayIdx ? ' today' : ''}`} key={h[0]}>
                    <span className="d">
                      {h[0]}
                      {i === todayIdx ? ' · aujourd’hui' : ''}
                    </span>
                    <span className="h">{h[1]}</span>
                  </div>
                ))}
                <div className="walkin">Sans rendez-vous en tout temps</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="final">
        <div className="final-bg"></div>
        <div className="wrap">
          <div className="eyebrow" style={{ color: 'var(--copper-light)' }}>
            Prêt pour une coupe ?
          </div>
          <h2>
            Réservez votre <em>fauteuil</em>
          </h2>
          <p>
            Quelques clics suffisent pour réserver. Et si l'envie vous prend, passez sans rendez-vous : on vous accueille
            en tout temps.
          </p>
          <div className="cta-row">
            <button className="btn btn-primary" onClick={openModal}>
              <span className="ic">✂</span> Prendre rendez-vous
            </button>
            <a href={`tel:${PHONE}`} className="btn btn-outline">
              <span className="ic">☎</span> Appeler maintenant
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="site">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <img className="logo" src={logoEmblem} alt="Les Frères Barbiers" />
              <div className="slogan">Le savoir-faire au service des gentlemen.</div>
            </div>
            <div>
              <h5>Navigation</h5>
              <ul>
                {navLinks.map(([href, label]) => (
                  <li key={href}>
                    <a href={href}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5>Horaires</h5>
              <ul>
                {hours.map((h) => (
                  <li key={h[0]} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{h[0]}</span>
                    <span style={{ color: h[2] ? 'rgba(247,239,219,.65)' : 'var(--pole-red)' }}>{h[1]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5>Coordonnées</h5>
              <div className="fline">
                <span className="ic">⚑</span> 246 Rue Principale,
                <br />
                Saint-Sauveur, QC J0R 1R0
              </div>
              <div className="fline">
                <span className="ic">☎</span> +1 {PHONE_DISPLAY}
              </div>
              <div className="fline">
                <span className="ic">✉</span> info@les-freres-barbiers.com
              </div>
              <button className="btn btn-primary" onClick={openModal} style={{ marginTop: 10, padding: '12px 22px' }}>
                Rendez-vous
              </button>
            </div>
          </div>
          <div className="foot-bottom">
            <div>© 2026 Les Frères Barbiers — Tous droits réservés.</div>
            <div>Barbier · Saint-Sauveur · Coupe homme · Taille de barbe · Rasage traditionnel</div>
          </div>
        </div>
      </footer>

      {/* ============ MODAL ============ */}
      <div
        className={`modal-bg${modalOpen ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal()
        }}
      >
        <div className="modal">
          <div className="mhead">
            <button className="x" onClick={closeModal} aria-label="Fermer">
              ✕
            </button>
            <div className="kick">Réservation</div>
            <h3>Prendre rendez-vous</h3>
            <p>Les Frères Barbiers · 246 Rue Principale, Saint-Sauveur</p>
          </div>
          {!modalDone && (
            <div className="mbody">
              <div className="field">
                <label>Service souhaité</label>
                <div className="chips">
                  {services.map((s, i) => (
                    <span
                      className={`chip${svcSel === i ? ' on' : ''}`}
                      key={s.id}
                      onClick={() => {
                        setSvcSel(i)
                        setSlotSel('')
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
              {barbers.length > 1 && (
                <div className="field">
                  <label>Barbier</label>
                  <div className="chips">
                    {barbers.map((b, i) => (
                      <span
                        className={`chip${barberSel === i ? ' on' : ''}`}
                        key={b.id}
                        onClick={() => {
                          setBarberSel(i)
                          setSlotSel('')
                        }}
                      >
                        {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="row2">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value)
                      setSlotSel('')
                    }}
                  />
                </div>
                <div className="field">
                  <label>Nom complet</label>
                  <input type="text" placeholder="Votre nom" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Heure</label>
                <div className="chips">
                  {slots.length === 0 ? (
                    <span className="msmall">Aucun créneau disponible pour cette date.</span>
                  ) : (
                    slots.map((t) => (
                      <span className={`chip${slotSel === t ? ' on' : ''}`} key={t} onClick={() => setSlotSel(t)}>
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input
                  type="tel"
                  placeholder="+1 ( ___ ) ___ - ____"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {bookError && <div className="msmall" style={{ color: 'var(--pole-red)' }}>{bookError}</div>}
              <button className="btn btn-primary" onClick={submitBooking} disabled={booking}>
                <span className="ic">✓</span> {booking ? 'Envoi…' : 'Confirmer la demande'}
              </button>
              <div className="msmall">Réponse rapide par téléphone · Sans rendez-vous accepté en tout temps</div>
            </div>
          )}
          {modalDone && (
            <div className="mdone" style={{ display: 'block' }}>
              <div className="check">✓</div>
              <h3>{bookConfirmed ? 'Rendez-vous confirmé' : 'Demande envoyée'}</h3>
              <p>
                {bookConfirmed
                  ? 'Votre rendez-vous est confirmé. À très bientôt au salon !'
                  : 'Merci ! Nous vous confirmerons votre rendez-vous dans les plus brefs délais. À très bientôt au salon.'}
              </p>
              <button className="btn btn-ghost" onClick={closeModal} style={{ marginTop: 22 }}>
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
