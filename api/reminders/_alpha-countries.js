// Approved build scope, not launch approval. Every country remains off by default.
// UAE and Saudi Arabia intentionally excluded at Star's request (25 Oct 2026).
//
// ONE-WAY ROUTES. Members in these countries cannot reply or text STOP, so every
// message carries the Stop anytime link and the signup shows a one-way notice.
//   route 'alpha'   : branded alphanumeric sender (TWILIO_ALPHA_<ISO>), alpha pricing,
//                     launch flag SMS_ALPHA_<ISO>_ENABLED.
//   route 'numeric' : the US long code, rewritten by the destination network,
//                     numeric pricing, launch flag SMS_ONEWAY_<ISO>_ENABLED.
//   geoGate         : SMS_GEO_<ISO>_READY=true must also be set, after the Twilio
//                     Geo Permission for that country is saved, so settings can be
//                     applied in a safe order.
//   bodyIdentity    : the destination rewrites the sender, so the approved sender
//                     name (SMS_ONEWAY_IDENTITY) is placed before the message text.
// Evidence: outputs/member-country-expansion-review-2026-10-25.json and the
// twilio.com/en-us/guidelines/<iso>/sms pages, read 25 Oct 2026.
const alpha = (extra = {}) => Object.freeze({ route: 'alpha', registration: false, ...extra });
const newAlpha = (extra = {}) => alpha({ geoGate: true, ...extra });
const numeric = (extra = {}) => Object.freeze({ route: 'numeric', registration: false, geoGate: true, bodyIdentity: true, ...extra });

export const ALPHA_COUNTRIES = Object.freeze({
  GB: alpha(),
  IT: alpha(),
  GR: alpha(),
  AT: alpha({ registration: true }),
  PH: alpha({ registration: true, urlRegistration: true }),
  // 25 Oct 2026 member-country expansion, dynamic alpha without registration.
  AL: newAlpha(),
  ME: newAlpha(),
  MK: newAlpha(),
  SI: newAlpha(),
  MT: newAlpha(),
  CY: newAlpha(),
  HR: newAlpha({ bodyIdentity: true }),   // alpha may be rewritten on A1
  // Israel, added 28 Oct 2026. twilio.com/en-us/guidelines/il/sms: dynamic
  // alphanumeric senders are supported with NO pre-registration and the sender
  // ID is preserved. The US long code cannot reach Israel at all, because
  // Israeli operators actively block international long codes, which is the
  // 'route unavailable' Noa has been hitting since she signed up on 25 Oct.
  // Alpha is the only route into Israel, exactly as it is for Greece.
  IL: newAlpha(),
  HU: newAlpha({ bodyIdentity: true }),   // numeric and alpha senders rewritten
  PE: newAlpha({ bodyIdentity: true }),   // numeric and alpha senders overwritten
  // Alpha unavailable: US long code, rewritten sender, one-way link opt-out.
  BE: numeric(),
  CO: numeric(),
});

export const oneWayPolicy = iso => ALPHA_COUNTRIES[iso] || null;

function launchApproved(iso, route) {
  const policy = ALPHA_COUNTRIES[iso];
  if (!policy || policy.route !== route) return false;
  const flag = route === 'alpha' ? `SMS_ALPHA_${iso}_ENABLED` : `SMS_ONEWAY_${iso}_ENABLED`;
  if (process.env[flag] !== 'true') return false;
  if (policy.geoGate && process.env[`SMS_GEO_${iso}_READY`] !== 'true') return false;
  if (policy.registration && !process.env[`SMS_ALPHA_${iso}_REGISTRATION_REFERENCE`]) return false;
  if (policy.urlRegistration && !process.env[`SMS_ALPHA_${iso}_URL_APPROVAL_REFERENCE`]) return false;
  return true;
}
export const alphaCountryApproved = iso => launchApproved(iso, 'alpha');
export const numericOneWayApproved = iso => launchApproved(iso, 'numeric');

// Conservative until provider classification: treat Italian reminders as promotional.
// Stop at 21:00, leaving a margin before the documented 22:00 restriction.
export function alphaTimeAllowed(iso, now=new Date()) {
  if(iso!=='IT') return true;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Rome',weekday:'short',hour:'2-digit',hourCycle:'h23',
  }).formatToParts(now).map(p=>[p.type,p.value]));
  return parts.weekday!=='Sun' && Number(parts.hour)>=8 && Number(parts.hour)<21;
}

// Austria and the Philippines have no signup consent path (registration not done).
export const ALPHA_CONSENT_VERSIONS = Object.freeze({
  GB:'uk-one-way-2026-10-25', IT:'it-one-way-2026-10-25', GR:'gr-one-way-2026-10-25',
  AL:'al-one-way-2026-10-25', ME:'me-one-way-2026-10-25', MK:'mk-one-way-2026-10-25',
  SI:'si-one-way-2026-10-25', HR:'hr-one-way-2026-10-25', HU:'hu-one-way-2026-10-25',
  MT:'mt-one-way-2026-10-25', PE:'pe-one-way-2026-10-25', CY:'cy-one-way-2026-10-25',
  BE:'be-one-way-2026-10-25', CO:'co-one-way-2026-10-25',
  IL:'il-one-way-2026-10-25',
});
export const alphaConsentVersion = iso => ALPHA_CONSENT_VERSIONS[iso] || process.env.SMS_ALPHA_CONSENT_VERSION;
