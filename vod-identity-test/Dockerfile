FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg tesseract-ocr chromium ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --break-system-packages --no-cache-dir streamlink==8.6.3 "yt-dlp[default,curl-cffi]==2026.10.26"
WORKDIR /app
COPY vod-identity-test/package*.json ./
RUN npm ci --omit=dev
COPY vod-identity-test/ ./
COPY docs/sql/vod_lg_identity.sql ./identity.sql
COPY docs/sql/vod_approval_workflow.sql ./approval.sql
RUN useradd --create-home worker && mkdir -p /data && chown worker:worker /data
ENV DATA_DIR=/data PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python3", "launch.py"]
