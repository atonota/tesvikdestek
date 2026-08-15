#!/bin/sh
# Runs once, on first initialisation of the PostgreSQL data directory.
#
# Creates the application role with the two properties that make row level
# security meaningful: NOSUPERUSER and NOBYPASSRLS. If this role ever gains
# either, tenant isolation quietly stops being enforced by the database.
#
# It grants CONNECT and USAGE and stops there. Table access is granted by each
# migration, per table, for the verbs that table actually needs. A blanket
# ALTER DEFAULT PRIVILEGES here would silently hand the web role full DML on
# every table any future migration creates - including the versioned catalogue
# a decision cites as its evidence.
#
# Fails closed. A role name that is not a bare SQL identifier, or an empty
# password, aborts initialisation rather than creating some other role or
# granting to the wrong one.
set -eu

: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${DESTEKTESVIK_APP_DB_PASSWORD:?DESTEKTESVIK_APP_DB_PASSWORD must be set}"

APP_ROLE="${DESTEKTESVIK_APP_DB_ROLE:-destektesvik_app}"

# The role name is interpolated into DDL, so it must be a plain identifier and
# nothing else. Anything with a space, quote or semicolon stops the container.
case "$APP_ROLE" in
  *[!A-Za-z0-9_]* | [!A-Za-z_]* | "")
    echo "FATAL: DESTEKTESVIK_APP_DB_ROLE must match [A-Za-z_][A-Za-z0-9_]*, got: $APP_ROLE" >&2
    exit 1
    ;;
esac

# The password never appears in the SQL *text* this script writes. It is passed
# as a psql variable and quoted by PostgreSQL's own format(%L), so a password
# containing a quote cannot terminate the statement or inject anything.
#
# Note the deliberate absence of dollar-quoting around that statement: psql does
# NOT substitute :'variables' inside a $$ ... $$ body, so a DO block here would
# silently create a role whose password is the literal text ":'app_password'".
# `\gexec` runs the formatted DDL instead, and returns no rows - so runs nothing -
# when the role already exists.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 \
     --set "app_role=$APP_ROLE" \
     --set "app_password=$DESTEKTESVIK_APP_DB_PASSWORD" <<SQL
SELECT format(
           'CREATE ROLE %I LOGIN PASSWORD %L '
           'NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
           :'app_role', :'app_password'
       )
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_ROLE};
GRANT USAGE ON SCHEMA public TO ${APP_ROLE};

-- Prove the role really has the two properties the security story depends on.
DO \$\$
DECLARE
    role_row record;
BEGIN
    SELECT rolsuper, rolbypassrls INTO role_row
    FROM pg_roles WHERE rolname = '${APP_ROLE}';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'application role ${APP_ROLE} was not created';
    END IF;
    IF role_row.rolsuper OR role_row.rolbypassrls THEN
        RAISE EXCEPTION
            'application role ${APP_ROLE} is superuser or holds BYPASSRLS; '
            'row level security would not be enforced';
    END IF;
END
\$\$;
SQL
