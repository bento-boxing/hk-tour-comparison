# Development container for hk-tour-comparison. Not used by the website or the nightly job.
FROM mcr.microsoft.com/devcontainers/base:bookworm

# Root-only setup happens here at build time, because the running container
# has no sudo (see runArgs in devcontainer.json).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       # GitHub command-line tool (reads run results, pushes with the token)
       gh python3 \
       # Simplified Chinese place names: packages/core/scripts/gen-zh-hans-names.py calls this library
       libopencc1.1 libopencc-data \
       # screenshots of the web app, and Chinese fonts so they render
       firefox-esr fonts-noto-cjk \
       # apps/web/app/apple-icon.png is produced with `convert`
       imagemagick \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /home/vscode/.claude \
    && chown vscode:vscode /home/vscode/.claude
