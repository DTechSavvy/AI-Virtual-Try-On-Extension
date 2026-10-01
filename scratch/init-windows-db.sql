DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vton_user') THEN 
    CREATE USER vton_user WITH PASSWORD 'vton_password' CREATEDB SUPERUSER; 
  END IF; 
END $$;

SELECT 'CREATE DATABASE vton_db OWNER vton_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vton_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE vton_db TO vton_user;
