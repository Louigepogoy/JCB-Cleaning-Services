import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import ServiceCarousel from '../components/ServiceCarousel.jsx';
import ContactForm from '../components/ContactForm.jsx';
import vennSatisfaction from '../assets/venn-satisfaction.jpg';
import vennQuality from '../assets/venn-quality.jpg';
import vennTeam from '../assets/venn-team.jpg';

const SERVICES = ['House Cleaning', 'Commercial Cleaning', 'Mattress Cleaning', 'Carpet Cleaning', 'Hard Floor Cleaning', 'Upholstery Cleaning'];

const WHY = [
  'Acknowledged the importance of customer satisfaction and does more than required to maintain a strong, loyal customer base and many repeat cleaning clients as a result.',
  'Consistently provide the highest quality cleaning service with the use of Allergy Cleaning System and environmentally safe cleaning products at a fair price.',
  'Offers one-time cleaning service or Long-Term Agreement, where we sign a contract with homeowners & companies to provide periodic professional cleaning service with trained team for the job.',
];

const STEPS = [['📝', 'Book Online Form'], ['✅', 'Get Confirmation'], ['✨', "Let's Enjoy"]];

export default function Home() {
  const { user } = useAuth();
  const bookTo = user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login';

  return (
    <>
      <nav className="nav">
        <Logo />
        <div className="nav-links">
          <a href="#home">HOME</a>
          <a href="#about">ABOUT US</a>
          <a href="#services">SERVICES</a>
          <a href="#contact">CONTACT US</a>
        </div>
        <div className="nav-right">
          <ThemeToggle />
          {user && <NotificationBell />}
          <Link className="nav-auth" to={bookTo}>{user ? 'DASHBOARD' : 'SIGN IN'}</Link>
        </div>
      </nav>

      <section id="home" className="hero">
        <h1>Your Cleaning Service Provider in Cebu, is just a call away...</h1>
        <p>Life is so short. Stop spending your time off cleaning and start spending it doing what you love.</p>
        <Link className="btn dark" to={bookTo}>Book a Service &nbsp;&gt;</Link>
      </section>

      <section id="about" className="why">
        <h2>Why Choose Us</h2>
        <div className="why-grid">
          <ul>
            {WHY.map((t) => (<li key={t}><span>✔</span><p>{t}</p></li>))}
          </ul>
          <div className="venn" role="img" aria-label="Three overlapping circles: customer satisfaction, quality products, trained team">
            <div className="venn-circle a"><img src={vennSatisfaction} alt="" /></div>
            <div className="venn-circle b"><img src={vennQuality} alt="" /></div>
            <div className="venn-circle c"><img src={vennTeam} alt="" /></div>
          </div>
        </div>
      </section>

      <section id="services" className="svc-section">
        <h2>Our Services</h2>
        <ServiceCarousel bookTo={bookTo} />
      </section>

      <section className="banner">
        <h2>Your time off, ain't made for cleaning.</h2>
        <Link className="btn dark" to={bookTo}>Book a Cleaning Services Now! &nbsp;&gt;</Link>
      </section>

      <section className="process">
        <h2>Our Working Process</h2>
        <div className="steps">
          {STEPS.map(([icon, label]) => (
            <div key={label}><div className="step-box">{icon}</div><h3>{label}</h3></div>
          ))}
        </div>
      </section>

      <section className="banner shine">
        <h2 className="script">Let's Shine!</h2>
        <Link className="btn dark" to={bookTo}>Book a Service &nbsp;&gt;</Link>
      </section>

      <section id="contact" className="contact">
        <h2>Contact Us</h2>
        <p className="contact-sub">Have a question or want a quote? Send us a message and we will reply.</p>
        <div className="contact-grid">
          <div className="contact-info">
            <div><span>📍</span><div><b>Address</b><p>Cebu City, Philippines 6000</p></div></div>
            <div><span>📞</span><div><b>Phone</b><p>+639912345678</p></div></div>
            <div><span>✉️</span><div><b>Email</b><p>JCBServices@gmail.com</p></div></div>
            <div><span>🕘</span><div><b>Hours</b><p>Mon–Sat, 8:00 AM – 6:00 PM</p></div></div>
          </div>
          <ContactForm />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <Logo size={110} />
          <div><h3>Services</h3>{SERVICES.map((s) => <p key={s}>&gt; {s}</p>)}</div>
          <div><h3>Our Links</h3><p>&gt; <a href="#services">Our Services</a></p><p>&gt; <Link to={bookTo}>Our Online Booking Form</Link></p></div>
          <div><h3>Address</h3><p>Cebu City, Philippines 6000</p><p>+639912345678</p><p>JCBServices@gmail.com</p></div>
        </div>
      </footer>
    </>
  );
}
