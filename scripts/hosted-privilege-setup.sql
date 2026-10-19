-- Scratch only. Shapes a non-superuser migration role that is not a member
-- of supabase_admin, then installs extensions the way a hosted project
-- already has them. Never run this against a hosted database.
-- psql -v dbname=... -f this file

CREATE ROLE ether_hosted NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE supabase_admin NOLOGIN NOSUPERUSER NOINHERIT;

GRANT CREATE ON DATABASE :"dbname" TO ether_hosted;
ALTER SCHEMA public OWNER TO ether_hosted;
ALTER TABLE auth.users OWNER TO ether_hosted;
ALTER TABLE storage.buckets OWNER TO ether_hosted;
ALTER TABLE storage.objects OWNER TO ether_hosted;
ALTER FUNCTION storage.foldername(text) OWNER TO ether_hosted;
GRANT USAGE ON SCHEMA auth, storage TO ether_hosted;
GRANT USAGE, CREATE ON SCHEMA extensions TO ether_hosted;

ALTER PUBLICATION supabase_realtime OWNER TO supabase_admin;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION pg_net SCHEMA public;

GRANT USAGE ON SCHEMA vault, pgmq TO ether_hosted;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq TO ether_hosted;

-- The migration role starts with the hosted-style function grants.
-- The lock migration has to clear them for this role without being able
-- to touch supabase_admin.
ALTER DEFAULT PRIVILEGES FOR ROLE ether_hosted IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ether_hosted
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC, anon, authenticated;
