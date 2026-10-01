#!/bin/sh
# TD-5 (§И6): создај апликациски role `gd_app` (≠ owner) при ПРВА иницијализација на базата.
# Owner (POSTGRES_USER) вози миграции; `gd_app` ја вози апликацијата (DATABASE_URL).
# ALTER DEFAULT PRIVILEGES → идните табели (создадени од owner при migrate) се достапни за gd_app;
# миграцијата `append_only_revoke` потоа ги REVOKE-ира UPDATE/DELETE на append-only табелите.
# За ПОСТОЕЧКА база (не прва иницијализација) ова не се извршува — создади го role-от рачно (види docs).
set -e

if [ -z "${APP_DB_PASSWORD:-}" ]; then
  echo "⚠ APP_DB_PASSWORD не е поставен — прескокнат gd_app bootstrap (апликацијата ќе користи owner)."
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gd_app') THEN
      CREATE ROLE gd_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
    END IF;
  END
  \$\$;
  GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO gd_app;
  GRANT USAGE ON SCHEMA public TO gd_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gd_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gd_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gd_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gd_app;
EOSQL

echo "✔ gd_app role bootstrap готов (append-only REVOKE се применува преку миграцијата)."
