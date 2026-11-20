# Free CPU inference server for the site's chat assistant (llama.cpp + Qwen2.5 Instruct GGUF).
# Works on a Hugging Face Space (SDK: Docker, free CPU), an Oracle Always-Free VM, or any Docker host.
#
#   MODEL=1.5b (default, "BALANCED", ~1.1 GB)   MODEL=0.5b (LITE, ~0.4 GB, fastest)   MODEL=7b ("SMART", ~4.7 GB, best answers, slower)
#   Any other GGUF: --build-arg MODEL_URL=https://.../file.gguf
FROM ghcr.io/ggml-org/llama.cpp:server
ARG MODEL=1.5b
ARG MODEL_URL=
ENV MODEL=${MODEL}
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /models
RUN if [ -n "$MODEL_URL" ]; then \
      curl -fL -o model.gguf "$MODEL_URL"; \
    elif [ "$MODEL" = "7b" ]; then \
      curl -fL -o model.gguf https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf; \
    elif [ "$MODEL" = "0.5b" ]; then \
      curl -fL -o model.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf; \
    else \
      curl -fL -o model.gguf https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf; \
    fi
# HF Spaces expects port 7860. -np 2 = two chats at once; -c 4096 = enough room for the site prompt + history.
EXPOSE 7860
ENTRYPOINT []
# LLM_API_KEY (a Space "Secret" / container env): when set, only requests carrying it are served, so nobody can skip the site's daily limits.
CMD ["/bin/sh", "-c", "exec /app/llama-server -m /models/model.gguf --host 0.0.0.0 --port 7860 -c 4096 -np 2 --alias qwen2.5-instruct ${LLM_API_KEY:+--api-key \"$LLM_API_KEY\"}"]
