// Approved build scope, not launch approval. Every country remains off by default.
// UAE and Saudi Arabia intentionally excluded at Star's request (25 Oct 2026).
export const ALPHA_COUNTRIES = Object.freeze({
  GB: {registration:false},
  IT: {registration:false},
  GR: {registration:false},
  AT: {registration:true},
  PH: {registration:true, urlRegistration:true},
});
export function alphaCountryApproved(iso) {
  const policy=ALPHA_COUNTRIES[iso];
  if(!policy || process.env[`SMS_ALPHA_${iso}_ENABLED`] !== 'true') return false;
  if(policy.registration && !process.env[`SMS_ALPHA_${iso}_REGISTRATION_REFERENCE`]) return false;
  if(policy.urlRegistration && !process.env[`SMS_ALPHA_${iso}_URL_APPROVAL_REFERENCE`]) return false;
  return true;
}
// Conservative until provider classification: treat Italian reminders as promotional.
// Stop at 21:00, leaving a margin before the documented 22:00 restriction.
export function alphaTimeAllowed(iso, now=new Date()) {
  if(iso!=='IT') return true;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Rome',weekday:'short',hour:'2-digit',hourCycle:'h23',
  }).formatToParts(now).map(p=>[p.type,p.value]));
  return parts.weekday!=='Sun' && Number(parts.hour)>=8 && Number(parts.hour)<21;
}
