FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    TN_BIND_HOST=0.0.0.0 \
    PORT=4317 \
    TN_WORK_ROOT=/workspace \
    TN_AI_DOCS_ROOT=/app/data/brand-docs

WORKDIR /app
COPY --chown=node:node package.json *.mjs ./
COPY --chown=node:node public ./public
RUN mkdir -p /app/data /workspace && chown node:node /app/data /workspace

USER node
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node --input-type=module -e "const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/login',{signal:AbortSignal.timeout(4000)});process.exit(r.status===200?0:1)"
CMD ["node", "server.mjs"]
