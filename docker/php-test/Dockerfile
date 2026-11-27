# Linux test image for faw-api (the real test gate; ~34 tests fail on plain Windows).
# Build:  docker build -t faw-api-test:local docker/php-test
FROM php:8.4-cli
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends libpq-dev libicu-dev libzip-dev python3 python3-reportlab poppler-utils >/dev/null \
 && docker-php-ext-install -j4 pdo_pgsql intl zip >/dev/null && rm -rf /var/lib/apt/lists/*
WORKDIR /app
