// ===== SHARED COUNTRY DATALIST =====
// Injects a single <datalist id="countries"> into the body so every signup
// form can use list="countries" for country autocomplete.
(function injectCountryDatalist() {
  if (document.getElementById('countries')) return;
  const COUNTRIES = [
    'United States','United Kingdom','Canada','Australia','Germany','France','Spain','Italy','Netherlands','Sweden','Norway','Denmark','Finland','Ireland','Belgium','Switzerland','Austria','Portugal','Poland','Greece','Czech Republic','Hungary','Romania','Bulgaria','Croatia','Slovenia','Slovakia','Estonia','Latvia','Lithuania','Iceland','Luxembourg','Malta','Cyprus',
    'Mexico','Brazil','Argentina','Chile','Colombia','Peru','Venezuela','Uruguay','Ecuador','Bolivia','Paraguay','Costa Rica','Panama','Guatemala','Honduras','Nicaragua','El Salvador','Dominican Republic','Cuba','Puerto Rico',
    'Japan','China','South Korea','India','Singapore','Hong Kong','Taiwan','Malaysia','Thailand','Vietnam','Philippines','Indonesia','Pakistan','Bangladesh','Sri Lanka','Nepal','Cambodia','Laos','Myanmar','Mongolia','Kazakhstan','Uzbekistan',
    'United Arab Emirates','Saudi Arabia','Israel','Turkey','Egypt','Jordan','Lebanon','Qatar','Kuwait','Bahrain','Oman','Iran','Iraq','Syria','Yemen','Palestine','Morocco','Tunisia','Algeria','Libya',
    'South Africa','Nigeria','Kenya','Ghana','Ethiopia','Tanzania','Uganda','Rwanda','Senegal','Cameroon','Ivory Coast','Zimbabwe','Zambia','Botswana','Namibia',
    'Russia','Ukraine','Belarus','Georgia','Armenia','Azerbaijan','Moldova','Serbia','Bosnia and Herzegovina','Albania','North Macedonia','Montenegro','Kosovo',
    'New Zealand','Fiji','Papua New Guinea',
    'Other'
  ];
  const dl = document.createElement('datalist');
  dl.id = 'countries';
  dl.innerHTML = COUNTRIES.map(c => `<option value="${c}">`).join('');
  if (document.body) {
    document.body.appendChild(dl);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(dl));
  }
})();

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
const confirmationCourses = document.getElementById('formConfirmationCourses');
const confirmationAsk = document.getElementById('formConfirmationAsk');
const confirmationCohort = document.getElementById('formConfirmationCohort');

function pickConfirmation(investmentValue) {
  if (investmentValue && investmentValue.indexOf('Under $500') === 0) {
    return confirmationCourses || confirmation;
  }
  if (investmentValue && investmentValue.indexOf('Message Star first') === 0) {
    return confirmationAsk || confirmation;
  }
  if (investmentValue && investmentValue.indexOf('$2,200') === 0) {
    return confirmationCohort || confirmation;
  }
  return confirmation;
}

async function pingCohortWaitlist(fields) {
  try {
    const fullName = (fields.full_name || '').trim();
    const parts = fullName.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || 'Applicant';
    const location = (fields.location || '').trim();
    const country = location.split(',').pop().trim() || 'Unknown';
    await fetch('/api/cohort-waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: firstName,
        lastName: lastName,
        email: fields.email || '',
        country: country,
        phone: fields.phone || '',
        website_url: ''
      })
    });
  } catch (err) {
    console.warn('Cohort AC ping failed (non-fatal):', err);
  }
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot: silently fake-success if filled
    const hp = form.querySelector('input[name="website_url"]');
    if (hp && hp.value) {
      form.style.display = 'none';
      if (confirmation) confirmation.classList.add('visible');
      return;
    }

    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const data = new FormData(form);
    const fields = Object.fromEntries(data.entries());

    const targetConfirmation = pickConfirmation(fields.investment);

    // If they picked the cohort path, also add them to the AC cohort waitlist
    if (fields.investment && fields.investment.indexOf('$2,200') === 0) {
      pingCohortWaitlist(fields);
    }

    // Post to the real backend. Will email Star via Resend, add to AC,
    // and send the applicant a confirmation. If this fails, we DO NOT
    // show a success message — we show the user an error so they know
    // their application did not go through.
    try {
      const res = await fetch('/api/coaching-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Submission failed (' + res.status + ')');
      }

      form.style.display = 'none';
      if (targetConfirmation) {
        targetConfirmation.style.display = 'block';
        targetConfirmation.classList.add('visible');
        targetConfirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      console.error('Application submission error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit My Application';
      alert(
        'We hit a problem submitting your application. ' +
        'Please email starjessetaylor@gmail.com directly and we will not lose your message. ' +
        'Your message: ' + (err && err.message ? err.message : 'unknown error')
      );
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
    const firstName = data.get('waitlist_first_name') || data.get('waitlist_name') || '';
    const lastName = data.get('waitlist_last_name') || '';
    const email = data.get('waitlist_email') || '';
    const country = data.get('waitlist_country') || '';
    const phone = data.get('waitlist_phone') || '';
    const website_url = data.get('website_url') || '';

    try {
      await fetch('/api/cohort-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: firstName, lastName, email, country, phone, website_url })
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

// ===== EMAIL CAPTURE FORM — REMOVED 2026-07-03 =====
// The free-chapter lead magnet was retired. No HTML page references
// emailCaptureForm anymore, so the handler + selector were dead code
// pointing at a deliberately-410 endpoint. Star confirmed: "we don't
// give away free chapters." Endpoint /api/free-chapter stays at HTTP 410
// as a tombstone for old bookmarks; nothing on-site can reach it.

// ===== INTENSIVE WAITLIST FORMS =====
['intensiveWaitlist', 'intensiveWaitlistServices'].forEach(function(id) {
  var f = document.getElementById(id);
  if (!f) return;
  f.addEventListener('submit', async function(e) {
    e.preventDefault();
    var data = new FormData(f);

    // Honeypot: silently fake-success if filled
    if (data.get('website_url')) {
      f.style.display = 'none';
      var conf = document.getElementById(id + 'Confirm');
      if (conf) conf.style.display = 'block';
      return;
    }

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
