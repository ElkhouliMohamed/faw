#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../public"
# Run under setsid. Limits accommodate 4 private SAV images or one 4 MB media upload.
exec php -d upload_max_filesize=4M -d post_max_size=12M -d max_file_uploads=8 -S 127.0.0.1:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
