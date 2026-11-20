# Setup guide: free AI hosting, limits, payments (do these in order)

Nothing here costs money. Takes about 45 minutes, most of it waiting for the model to build.

## 1. Host the 5 GB model on Hugging Face (free)
1. Make a free account at huggingface.co. Click your picture → **New Space**.
2. Name it (e.g. `site-ai`), **SDK: Docker → Blank**, hardware **CPU basic · free**, visibility **Public**. Create.
3. Open the Space → **Files → Add file → Upload**. Upload `inference/Dockerfile` from the project. Before uploading, change the line `ARG MODEL=1.5b` to `ARG MODEL=7b`.
4. Space → **Settings → Variables and secrets → New secret**: name `LLM_API_KEY`, value = a long random string (make one with `openssl rand -hex 24`, or mash the keyboard for 40 characters). Keep a copy. This stops anyone using your model without going through your site's limits.
5. Wait for the build (10–20 min; it downloads about 4.7 GB). When the status says **Running**, your address is `https://YOURNAME-site-ai.hf.space` (shown under "Embed this Space" → direct URL).
6. If the build fails with a 404 on the model, open Dockerfile and, in Settings → Variables, add `MODEL_URL` pointing to a direct `.gguf` link from the model's Hugging Face "Files" page (Qwen2.5-7B-Instruct Q4_K_M).
Note: free Spaces sleep when nobody uses them and take about a minute to wake. While it is asleep the chat quietly uses its built-in rules.

## 2. Tell your site about it (Vercel → project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `LLM_ENDPOINT` | your `https://….hf.space` address |
| `LLM_API_KEY` | the same secret from step 1.4 |
| `LLM_MODEL` | `qwen2.5-instruct` |
| `LLM_LABEL` | `SMART` |
| `LLM_MAX_TOKENS` | `300` |
| `AI_FREE_DAILY` | `15` (free answers per visitor per day; lower it if the model feels slow) |
| `AI_ACCESS_SECRET` | any long random string |
Then **Deployments → Redeploy**.

## 3. Admin and storage (needed so limits, passes and orders are not forgotten)
| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | 10+ characters, only you know it |
| `ADMIN_SESSION_SECRET` | long random string |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | free database: Vercel → Storage → Upstash Redis (free plan) → connect to the project; it fills these in |
Without Redis, daily counters, passes and requests reset whenever Vercel restarts the site.

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

## 7. Keep the model awake (free)
At cron-job.org make a free job that opens `https://yoursite/api/llm` every 30 minutes. That keeps the Space warm during the day.

## Handing out access
- Gift or sell a code: /admin/ai-access → Generate → send the code on WhatsApp.
- Customer pays and sends a transaction id in the chat: it appears under **Payments waiting for you**. Check the id in your MoMo messages, press **Approve**; their device unlocks automatically.
