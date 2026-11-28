// src/lib/printEstimate.ts — a clean one-page estimate / receipt the customer (or the owner) can print or save as PDF.
// Opens a small page of its own with the business details, the reference, the amounts and how to pay.

export interface EstimateInput {
  id: string; kind: string; createdAt: string; quoteUGX?: number; depositUGX?: number; depositPaid?: boolean;
  slot?: { date: string; time: string }; name?: string; details?: string; status?: string;
}
export interface EstimateBusiness { name: string; phone?: string; email?: string; address?: string; hours?: string }

const h = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const money = (n?: number) => (n ? `UGX ${n.toLocaleString('en-UG')}` : '—');

/** Returns false when the browser blocked the pop-up. */
export function printEstimate(t: EstimateInput, b: EstimateBusiness, pay?: { mtn?: string; airtel?: string; accountName?: string }): boolean {
  const w = window.open('', '_blank', 'width=760,height=960');
  if (!w) return false;
  w.opener = null;
  const balance = t.quoteUGX ? Math.max(0, t.quoteUGX - (t.depositPaid ? t.depositUGX || 0 : 0)) : 0;
  const when = new Date(t.createdAt).toLocaleDateString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'long' });
  const row = (k: string, v: string, strong = false) => `<tr><td>${h(k)}</td><td${strong ? ' class="s"' : ''}>${v}</td></tr>`;
  const payLines = [pay?.mtn && `MTN Mobile Money: <b>${h(pay.mtn)}</b>`, pay?.airtel && `Airtel Money: <b>${h(pay.airtel)}</b>`, pay?.accountName && `Account name: ${h(pay.accountName)}`].filter(Boolean);
  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estimate ${h(t.id)}</title>
<style>*{box-sizing:border-box}body{font:14px/1.5 system-ui,Segoe UI,Arial,sans-serif;margin:0;padding:40px;color:#111;max-width:720px}
header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #0e7490;padding-bottom:16px}h1{font-size:24px;margin:0}.sub{color:#555;font-size:12px}
.r{text-align:right}.tag{display:inline-block;background:#0e7490;color:#fff;padding:2px 10px;border-radius:99px;font-size:12px;letter-spacing:.06em}
table{width:100%;border-collapse:collapse;margin-top:22px}td{padding:10px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top}td:first-child{width:38%;color:#555}td.s{font-weight:700}
.tot td{font-size:18px;font-weight:800;border-bottom:0;background:#f0fdfa}.box{margin-top:22px;border:1px solid #d1d5db;border-radius:10px;padding:14px 16px}.box h2{font-size:13px;margin:0 0 6px;letter-spacing:.04em}
.fine{margin-top:26px;color:#666;font-size:11px}button{margin-top:20px;padding:10px 18px;border:0;border-radius:8px;background:#0e7490;color:#fff;font-size:14px;cursor:pointer}@media print{button{display:none}body{padding:0}}</style></head><body>
<header><div><h1>${h(b.name || 'Estimate')}</h1><div class="sub">${[b.address, b.phone, b.email].filter(Boolean).map(h).join(' · ')}</div>${b.hours ? `<div class="sub">${h(b.hours)}</div>` : ''}</div>
<div class="r"><span class="tag">ESTIMATE</span><div class="sub" style="margin-top:6px">Reference <b>${h(t.id)}</b><br>${h(when)}</div></div></header>
<table>${t.name ? row('Customer', h(t.name)) : ''}${row('Request', h(t.kind === 'repair' ? 'Repair' : t.kind === 'design' ? 'Design' : 'Website'))}
${t.details ? row('Details', `<span style="white-space:pre-wrap">${h(t.details.slice(0, 600))}</span>`) : ''}${t.slot ? row('Visit', h(`${t.slot.date} at ${t.slot.time}`)) : ''}
${row('Quote', money(t.quoteUGX), true)}${row('Deposit', `${money(t.depositUGX)}${t.depositUGX ? (t.depositPaid ? ' (paid)' : ' (due before work starts)') : ''}`)}
<tr class="tot"><td>Balance to pay</td><td>${money(balance)}</td></tr></table>
${payLines.length ? `<div class="box"><h2>HOW TO PAY</h2>${payLines.join('<br>')}<br><span class="sub">Use <b>${h(t.id)}</b> as the payment reference.</span></div>` : ''}
<p class="fine">This estimate is based on what we know today. We confirm any change with you before extra work is done. Thank you for choosing ${h(b.name || 'us')}.</p>
<button onclick="print()">Print or save as PDF</button><script>addEventListener('load',()=>setTimeout(()=>print(),300))</script></body></html>`);
  w.document.close();
  return true;
}
