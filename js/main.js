// ===== NAV SCROLL EFFECT =====
const nav = document.querySelector('.nav');
const hamburger = document.querySelector('.nav-hamburger');
const mobileNav = document.querySelector('.nav-mobile');

window.addEventListener('scroll', () => {
  if (window.scrollY > 24) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

hamburger && hamburger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  if (mobileNav.classList.contains('open')) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});

// Close mobile nav on link click
document.querySelectorAll('.nav-mobile a').forEach(a => {
  a.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });
});

// ===== FADE-UP ANIMATIONS =====
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });

document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));

// ===== FAQ ACCORDION =====
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ===== STATS COUNTER ANIMATION =====
function animateCounter(el, target, suffix, duration = 1800) {
  const start = performance.now();
  const isDecimal = target % 1 !== 0;

  const update = (time) => {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = isDecimal
      ? (eased * target).toFixed(1)
      : Math.round(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const raw = el.dataset.count;
      const suffix = el.dataset.suffix || '';
      animateCounter(el, parseFloat(raw), suffix);
      statsObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => statsObserver.observe(el));

// ===== APPLICATION FORM =====
const form = document.getElementById('applicationForm');
const confirmation = document.getElementById('formConfirmation');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const data = new FormData(form);
    const fields = Object.fromEntries(data.entries());

    // Build email body
    const body = Object.entries(fields)
      .map(([k, v]) => `${k.replace(/_/g, ' ').toUpperCase()}: ${v || '—'}`)
      .join('\n\n');

    // EmailJS send
    try {
      if (typeof emailjs !== 'undefined') {
        await emailjs.send('service_emotfit', 'template_application', {
          to_email: 'starjessetaylor@gmail.com',
          subject: 'New Coaching Application',
          applicant_name: fields.full_name || 'Applicant',
          message: body,
          reply_to: fields.email || '',
        });
      } else {
        // Fallback: mailto (opens email client)
        const mailto = `mailto:starjessetaylor@gmail.com?subject=New%20Coaching%20Application&body=${encodeURIComponent(body)}`;
        window.open(mailto);
      }

      form.style.display = 'none';
      if (confirmation) {
        confirmation.classList.add('visible');
        confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      console.error('Send error:', err);
      // Fallback gracefully
      const mailto = `mailto:starjessetaylor@gmail.com?subject=New%20Coaching%20Application&body=${encodeURIComponent(body)}`;
      window.open(mailto);
      form.style.display = 'none';
      if (confirmation) confirmation.classList.add('visible');
    }
  });
}

// ===== COHORT WAITLIST FORM =====
const waitlistForm = document.getElementById('waitlistForm');
const waitlistConfirmation = document.getElementById('waitlistConfirmation');

if (waitlistForm) {
  waitlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = waitlistForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding you...';

    const data = new FormData(waitlistForm);
    const name = data.get('waitlist_name') || '';
    const email = data.get('waitlist_email') || '';

    try {
      await fetch('/api/cohort-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      if (typeof window.starTrack === 'function') {
        window.starTrack('cohort_waitlist_signup', { value: 0 });
      }
    } catch (err) {
      console.warn('Cohort waitlist API error:', err);
      // Continue to confirmation either way; we don't want to block the UX
    }

    waitlistForm.style.display = 'none';
    if (waitlistConfirmation) waitlistConfirmation.style.display = 'block';
  });
}

// ===== EMAIL CAPTURE FORM — Free Chapter Lead Magnet =====
const emailCaptureForm = document.getElementById('emailCaptureForm');
const emailCaptureConfirmation = document.getElementById('emailCaptureConfirmation');

if (emailCaptureForm) {
  emailCaptureForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = emailCaptureForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const data = new FormData(emailCaptureForm);
    const firstName = data.get('first_name') || '';
    const email = data.get('subscriber_email') || '';
    const interests = data.getAll('interests');

    try {
      const res = await fetch('/api/free-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, interests })
      });
      if (!res.ok) throw new Error('Subscribe failed');
    } catch (err) {
      console.warn('Email capture error:', err);
    }

    emailCaptureForm.style.display = 'none';
    if (emailCaptureConfirmation) emailCaptureConfirmation.style.display = 'block';
  });
}

// ===== INTENSIVE WAITLIST FORMS =====
['intensiveWaitlist', 'intensiveWaitlistServices'].forEach(function(id) {
  var f = document.getElementById(id);
  if (!f) return;
  f.addEventListener('submit', async function(e) {
    e.preventDefault();
    var data = new FormData(f);
    var name = data.get('intensive_name') || '';
    var email = data.get('intensive_email') || '';
    var body = 'Intensive Waitlist\n\nName: ' + name + '\nEmail: ' + email;
    try {
      if (typeof emailjs !== 'undefined') {
        await emailjs.send('service_emotfit', 'template_application', {
          to_email: 'starjessetaylor@gmail.com',
          subject: 'Intensive Waitlist',
          applicant_name: name,
          message: body,
          reply_to: email,
        });
      } else {
        window.open('mailto:starjessetaylor@gmail.com?subject=Intensive%20Waitlist&body=' + encodeURIComponent(body));
      }
    } catch(err) {
      window.open('mailto:starjessetaylor@gmail.com?subject=Intensive%20Waitlist&body=' + encodeURIComponent(body));
    }
    f.style.display = 'none';
    var confirm = document.getElementById(id + 'Confirm');
    if (confirm) confirm.style.display = 'block';
  });
});

// ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  });
});
