# Setup guide: free AI hosting, limits, payments (do these in order)

Nothing here costs money. Takes about 30 minutes.

## 1. Free AI for the chat (no card, nothing to host)
Hugging Face now charges for Docker Spaces, so we skip hosting a model ourselves. Use a free, OpenAI-compatible AI service instead (the site already speaks that format, no code change). Groq is the suggested one:
1. Sign up at console.groq.com (no card needed at the time of writing) → **API Keys → Create API key**. Copy it.
2. In the model list on their site, pick a fast general chat model (an "8b instant" Llama is a good start) and copy its exact name.
3. Use these values in step 2 below: `LLM_ENDPOINT` = `https://api.groq.com/openai/v1`, `LLM_API_KEY` = your key, `LLM_MODEL` = the model name from step 2.
Alternative with the same setup: OpenRouter (`https://openrouter.ai/api/v1`, pick a model ending in `:free`).
Free tiers are SHARED by all your visitors and the limits change often (check the provider's page), so keep `AI_FREE_DAILY` low (5 to 10). When the free quota runs out the chat quietly falls back to its built-in engine, so nothing breaks. Chat messages are sent to that provider, so mention it on your privacy page.
(`inference/` is still there if you ever get a free VM to host your own model, but you do not need it.)

## 2. Tell your site about it (Vercel → project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `LLM_ENDPOINT` | `https://api.groq.com/openai/v1` |
| `LLM_API_KEY` | the key from step 1 |
| `LLM_MODEL` | the model name you copied in step 1 |
| `LLM_LABEL` | `SMART` |
| `LLM_MAX_TOKENS` | `300` |
| `AI_FREE_DAILY` | `8` (free answers per visitor per day; the provider's free quota is shared by everyone) |
| `AI_ACCESS_SECRET` | any long random string |
Then **Deployments → Redeploy**.

## 3. Admin and storage (needed so limits, passes and orders are not forgotten)
| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | 10+ characters, only you know it |
| `ADMIN_SESSION_SECRET` | long random string |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | free database: Vercel → Storage → Upstash Redis (free plan) → connect to the project; it fills these in |
Without Redis, daily counters, passes and requests reset whenever Vercel restarts the site — and customers' builder projects can disappear from the server too (the editor then restores them from the customer's own browser, but only on the device they used). Connect Redis early.

## 4. Mobile money details (shown to people buying a pass)
`MOMO_MTN_NUMBER`, `MOMO_AIRTEL_NUMBER`, `MOMO_ACCOUNT_NAME`. Or type your own wording in /admin/ai-access → Payment instructions.

## 5. Email for messages and orders (optional but recommended)
`RESEND_API_KEY` (free at resend.com), `CONTACT_TO` (where you want messages), `CONTACT_FROM` (a sender Resend allows).

## 6. Check it works
1. Visit `yoursite/api/llm`. You should see `"available":true`. (`false` = still building, asleep, or the key/address is wrong.)
2. Sign in at `/admin`. Open the chat: it shows **AI ON · SMART · unlimited**. You (signed in) are never limited.
3. Open the site in a private window: it shows **15 left today**. Use them up and see it switch to smart rules with **GET MORE ANSWERS**.
4. In `/admin/ai-access` press **Generate**, copy a code, and redeem it in the private window.
5. Say "build me a website for my salon called Test in Kampala" and open the editor link it gives you.

## 7. Keeping it awake
Not needed with a hosted AI service (Groq / OpenRouter): nothing sleeps. Skip this step.

## Handing out access
- Gift or sell a code: /admin/ai-access → Generate → send the code on WhatsApp.
- Customer pays and sends a transaction id in the chat: it appears under **Payments waiting for you**. Check the id in your MoMo messages, press **Approve**; their device unlocks automatically.
