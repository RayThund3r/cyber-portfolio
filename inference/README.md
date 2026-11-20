# Hosting the chat model on a server (no download for visitors)

The chat assistant has three tiers: **CLOUD** (this folder), **on-device** (WebLLM in the browser) and the
built-in rules engine, which always works. When the cloud model is reachable the chat uses it automatically
for every visitor; if it is down or slow the chat falls back to the rules engine, so nothing breaks.

**Which model to host:** Qwen2.5-1.5B (default, "BALANCED") is the best answer quality a free CPU can serve at a
comfortable speed. Use 0.5B ("LITE") if the server is slow. The 3B model is too slow on free CPUs, keep it as the on-device option.

## Option A: Hugging Face Space (free, no card)
1. huggingface.co → New Space → SDK **Docker** → hardware **CPU basic (free)**. Make it **Public** (or private + token, see below).
2. Upload `Dockerfile` from this folder. For the 0.5B model add the build arg line `ARG MODEL=0.5b`.
3. Wait for the build. Open `https://<you>-<space>.hf.space/health`, it should say ok.
4. Free Spaces sleep after inactivity; the first message after a sleep may take ~30 s. The site waits 14 s,
   then answers from its rules engine, and the Space wakes up in the background for the next visitor.

## Option B: Oracle Cloud Always-Free ARM VM (always on)
`docker build -t site-llm . && docker run -d --restart=always -p 7860:7860 site-llm`, then put it behind HTTPS (Caddy / Cloudflare Tunnel).

## Option C: Ollama on your own machine
`ollama pull qwen2.5:1.5b-instruct`, then `LLM_ENDPOINT=http://<host>:11434`, `LLM_MODEL=qwen2.5:1.5b-instruct`.

## Connect it to the site (Vercel → Settings → Environment Variables)
| Name | Value |
|---|---|
| `LLM_ENDPOINT` | `https://<you>-<space>.hf.space` (the `/v1/chat/completions` part is added for you) |
| `LLM_MODEL` | `qwen2.5-instruct` (llama.cpp ignores it; Ollama needs its tag) |
| `LLM_API_KEY` | optional bearer token (Private Spaces: an HF read token) |
| `LLM_LABEL` | optional, e.g. `BALANCED` |
| `LLM_MAX_TOKENS` / `LLM_RATE_PER_MIN` | optional, defaults 400 / 12 per visitor |

Redeploy. The chat panel then shows **AI ON · CLOUD**. These are server-side variables, visitors never see the address or key.

**Privacy:** with the cloud tier a visitor's chat messages go to your inference server (like the contact form goes to you). The privacy page text should say so. Visitors can switch it off with TURN OFF and the on-device or rules modes keep their text in the browser.

## The ~5 GB model (MODEL=7b, "SMART")

`docker build --build-arg MODEL=7b -t site-ai .` downloads Qwen2.5-7B-Instruct Q4_K_M (~4.7 GB). It needs about 6–7 GB of RAM, so:

- **Hugging Face Space (free CPU, 16 GB RAM):** fits. Expect roughly 2–4 words per second, and the Space sleeps when idle (the first message after a nap can take a minute). Set Space variable `LLM_ENDPOINT` on Vercel to its `https://….hf.space` URL, `LLM_LABEL=SMART`, `LLM_MAX_TOKENS=300`.
- **Oracle Always-Free ARM VM (up to 24 GB RAM):** fits and does not sleep; run the same Docker image.
- It is slower than the 1.5B model, which is why the daily limit exists. Start with `AI_FREE_DAILY=10`–`15`.
- The download file name comes from the bartowski mirror and was not checked from this build environment; if the build fails with a 404, pass `--build-arg MODEL_URL=<direct .gguf link>` from the model's Hugging Face "Files" tab.

## Daily limits and passes

Handled by the site, not the server: see `/admin/ai-access`. When a visitor's free answers run out, the chat silently switches to its built-in rules; they can enter an access code or pay by mobile money and send the transaction id for you to approve. Limits persist across restarts only with Upstash Redis connected.
