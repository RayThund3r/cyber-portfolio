// node scripts/make-totp-secret.mjs  → prints a new 2FA secret for ADMIN_TOTP_SECRET
// In Google Authenticator / Authy / Microsoft Authenticator: "+" → "Enter a setup key" → paste the key (type: time-based).
import { randomBytes } from 'node:crypto';
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const secret = Array.from(randomBytes(20), (b) => A[b % 32]).join('');
console.log('\nADMIN_TOTP_SECRET=' + secret);
console.log('\nSetup key for your authenticator app:', secret.match(/.{4}/g).join(' '));
console.log('Or scan-link (some apps): otpauth://totp/System%20Portfolio%20Admin?secret=' + secret + '&issuer=System%20Portfolio\n');
