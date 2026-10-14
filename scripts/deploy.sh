#!/usr/bin/env bash
# Build + đẩy bản web lên VPS. Chạy `npm run deploy`.
#
# Không build trên VPS — RAM ở đó ít. Ở đây build bằng .env.production.local
# (Supabase PROD), kiểm tra bundle nhúng đúng project, rồi tar dist/ lên.
set -euo pipefail

HOST="namth@43.228.215.234"
KEY="$HOME/.ssh/vps"
REMOTE="~/fair-pay-web"
PROD_REF="cyrbqnvdojozidmtjpsl"
DEV_REF="tygzckynmgjfnlabatgp"
SSH=(env MSYS_NO_PATHCONV=1 ssh -i "$KEY" -o BatchMode=yes "$HOST")

cd "$(dirname "$0")/.."

[ -f .env.production.local ] || { echo "Thiếu .env.production.local"; exit 1; }

echo "→ Test + build production ..."
npx vitest run --reporter=dot
npm run build

# Bài học "release env baking" của app: build nhầm env dev → bản prod trỏ backend dev.
if ! grep -rqs "$PROD_REF" dist/assets; then echo "✗ Bundle KHÔNG chứa project prod ($PROD_REF) — dừng."; exit 1; fi
if grep -rqs "$DEV_REF" dist/assets; then echo "✗ Bundle chứa project DEV ($DEV_REF) — dừng."; exit 1; fi
echo "✓ Bundle trỏ Supabase prod ($PROD_REF)"

echo "→ Đẩy dist/ ..."
# Giải nén TẠI CHỖ vào dist/ — KHÔNG xoá/đổi tên thư mục: container bind mount theo
# inode thư mục, thay thư mục mới là nginx trỏ vào thư mục đã xoá → 404 toàn site.
# Asset có hash nên file cũ để lại vô hại (tab đang mở bản cũ vẫn tải được chunk);
# dọn asset cũ hơn 7 ngày. File snapshot test (__snap-*) không bao giờ được đẩy lên.
tar czf - --exclude='__snap-*' -C dist . | "${SSH[@]}" "mkdir -p $REMOTE/dist && tar xzf - -C $REMOTE/dist && find $REMOTE/dist/assets -type f -mtime +7 -delete"

# nginx.conf bind mount theo FILE → chỉ khi cấu hình đổi (hoặc container chưa chạy)
# mới cần recreate để container thấy inode mới. Chỉ đổi dist/ thì không cần.
LOCAL_SUM=$(cat deploy/nginx.conf deploy/docker-compose.yml | sha1sum | cut -d' ' -f1)
REMOTE_SUM=$("${SSH[@]}" "cat $REMOTE/nginx.conf $REMOTE/docker-compose.yml 2>/dev/null | sha1sum | cut -d' ' -f1")
RUNNING=$("${SSH[@]}" "docker ps -q --filter name=^fair-pay-web$")
if [ "$LOCAL_SUM" != "$REMOTE_SUM" ] || [ -z "$RUNNING" ]; then
  echo "→ Đẩy cấu hình + recreate container ..."
  tar czf - -C deploy . | "${SSH[@]}" "mkdir -p $REMOTE && tar xzf - -C $REMOTE"
  "${SSH[@]}" "cd $REMOTE && docker compose up -d --force-recreate web"
else
  echo "→ Cấu hình không đổi — giữ container."
fi

echo "→ Kiểm tra ..."
"${SSH[@]}" "sleep 4; docker ps --filter name=fair-pay-web --format '{{.Names}} {{.Status}}'; docker exec fair-pay-web nginx -t 2>&1 | tail -1"

# Smoke test: route sâu của SPA phải trả index.html (bắt lỗi mount/dist hỏng).
if "${SSH[@]}" "docker exec fair-pay-web wget -qO- http://127.0.0.1/groups/smoke-test | grep -q 'id=\"root\"'"; then
  echo "✓ Smoke test OK — https://fair-pay.thronelab.online"
else
  echo "✗ Smoke test FAIL: route SPA không trả index.html — kiểm tra container/dist ngay!"
  exit 1
fi
