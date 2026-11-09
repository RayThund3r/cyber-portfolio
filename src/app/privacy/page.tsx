import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/utils/chatEngine/siteConfig';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'What information this site collects and how it is used.',
  alternates: { canonical: '/privacy' },
};

// TEMPLATE — review and edit so it matches what you actually do. This is a plain-language
// starting point, not legal advice. Uganda's Data Protection and Privacy Act, 2019 likely applies
// to you; consider checking requirements (e.g. registration with the Personal Data Protection
// Office) with a qualified local professional.
export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-6 text-sm leading-relaxed text-zinc-300">
        <Link href="/" className="font-mono text-xs text-cyan-400 hover:opacity-80">← Home</Link>
        <h1 className="text-3xl font-extrabold text-zinc-100">Privacy notice</h1>
        <p className="text-zinc-400">Based in {SITE.location}. Last updated: replace with date.</p>

        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">What we collect</h2>
          <p>
            When you use the contact form we collect the name, email address and/or phone number, and the message
            you type. If you choose to attach browser/device info, we also receive basic details such as platform,
            screen size and, where your browser reports it, approximate GPU and memory. If you came from the chat
            assistant, the chat conversation may be attached to your request.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">How we use it</h2>
          <p>Only to reply to your request, quote and carry out the work you ask for. We do not sell your data or use it for advertising.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">Who handles it</h2>
          <p>
            Your message is delivered to the site owner by email using the Resend email service. Our server logs may
            keep a copy of a request for a short time so that a message is not lost if email delivery fails.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">Chat assistant &amp; your browser</h2>
          <p>
            The chat assistant runs in your browser. Its history, preferences and any downloaded AI model are stored
            on your device (local storage / cache), not on our servers, and you can clear them by typing
            &ldquo;clear chat&rdquo; in the chat or clearing your browser data. For general questions it may look up
            public articles on Wikipedia; your question text is sent to Wikipedia for that lookup.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">Requests, bookings &amp; payments</h2>
          <p>
            Each request is saved with a reference number so you can track it on the Track page, which needs the reference
            plus the phone number or email you used. If you book a visit we store the date and time. For deposits you pay by
            mobile money yourself and send us the transaction ID; we never see your PIN or wallet access.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">Website template builder</h2>
          <p>
            When you customize a template, your site content (text, settings and the pictures you upload) is saved on our server under a private
            project code so you can come back to it. Only someone with your private edit link can open or edit it. If you place an order we also keep your
            name and email/phone so you can track it and download your website. You can ask us to delete a project at any time.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">Anonymous usage statistics &amp; errors</h2>
          <p>
            We count page views and a few actions (for example WhatsApp clicks) without cookies, without storing your IP
            address and without identifying you. Chat questions the assistant could not answer may be counted so we can
            improve it (email addresses and long numbers are removed). Technical errors are logged to fix bugs. If your
            browser sends &ldquo;Do Not Track&rdquo; or Global Privacy Control, usage counting and chat-question counting are skipped.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-zinc-100 mb-1">Your choices</h2>
          <p>
            You can ask us to see, correct or delete the details you sent us
            {SITE.email ? <> by emailing {SITE.email}</> : <> by contacting us through the <Link href="/contact" className="underline text-cyan-400">contact page</Link></>}
            .
          </p>
        </section>
      </div>
    </div>
  );
}
