-- Creates one database per service that uses PostgreSQL.
-- Runs automatically on first container start (see docker-compose.yml).
-- If you need to re-run, do `docker compose down -v` first.

CREATE DATABASE messageme_auth;
CREATE DATABASE messageme_user;
CREATE DATABASE messageme_group;
CREATE DATABASE messageme_channel;
CREATE DATABASE messageme_direct;
CREATE DATABASE messageme_file;
CREATE DATABASE messageme_audit;

-- Grants (user 'messageme' is superuser in this local setup; no extra grants needed)
