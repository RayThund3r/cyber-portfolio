
## Optional setups (all off until you add the variables in Vercel → Settings → Environment Variables)

- **Telegram alerts (free):** message @BotFather, send /newbot, copy the token into `TELEGRAM_BOT_TOKEN`. Send your new bot any message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the `chat` `id` into `TELEGRAM_CHAT_ID`.
- **WhatsApp alerts to yourself (free):** follow callmebot.com's WhatsApp steps for your number, then set `CALLMEBOT_PHONE` (digits only, with country code) and `CALLMEBOT_KEY`.
- **Visitor statistics:** `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com`, or `NEXT_PUBLIC_UMAMI_ID=<website id>` (optionally `NEXT_PUBLIC_UMAMI_SRC` for a self-hosted Umami). Redeploy after adding.
- Both alert channels fire for every new request and message, next to the existing ntfy/webhook options. Admin → Health shows which are set.
- Not built yet: letting the chat AI look inside pictures (needs a vision model and changes to the AI route).
