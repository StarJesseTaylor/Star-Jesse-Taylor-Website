import {randomBytes,createHash} from 'node:crypto';
import {alphaRpc} from './_alpha.js';
const hash=code=>createHash('sha256').update(code).digest('hex');
export async function createWaSignupCode(timezone,phone,name) {
 new Intl.DateTimeFormat('en',{timeZone:timezone}).format();
 const code=randomBytes(8).toString('base64url');
 const ok=await alphaRpc('wa_create_pending',{p_hash:hash(code),p_phone:phone,p_name:name,p_timezone:timezone,p_nonce:randomBytes(16).toString('hex')});
 if(ok!==true) throw new Error('Signup requires operator review');
 return code;
}
export async function confirmWaSignupCode(code,phone,sid) {
 if(!/^[A-Za-z0-9_-]{11}$/.test(code)) return {ok:false,reason:'invalid_or_expired_code'};
 return alphaRpc('wa_confirm_pending',{p_hash:hash(code),p_phone:phone,p_sid:sid});
}
