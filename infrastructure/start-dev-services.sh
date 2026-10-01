#!/bin/bash
set -e

echo "[1/4] Starting PostgreSQL 16..."
service postgresql start

# Create user and database if they don't exist
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='vton_user'\" | grep -q 1 || psql -c \"CREATE USER vton_user WITH PASSWORD 'vton_password' CREATEDB SUPERUSER;\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='vton_db'\" | grep -q 1 || psql -c \"CREATE DATABASE vton_db OWNER vton_user;\""

# Ensure pg_hba.conf allows md5 / password auth
if ! grep -q "host all all 0.0.0.0/0 md5" /etc/postgresql/16/main/pg_hba.conf; then
  echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/16/main/pg_hba.conf
  echo "host all all ::0/0 md5" >> /etc/postgresql/16/main/pg_hba.conf
  echo "listen_addresses = '*'" >> /etc/postgresql/16/main/postgresql.conf
  service postgresql restart
fi

echo "[2/4] Starting Redis Server..."
service redis-server start
redis-cli ping

echo "[3/4] Starting MinIO Server..."
mkdir -p /var/minio/data
pkill -f "minio server" || true
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
nohup minio server /var/minio/data --address :9000 --console-address :9001 > /var/log/minio.log 2>&1 &
sleep 2

echo "[4/4] Initializing MinIO Bucket..."
mc alias set local http://127.0.0.1:9000 minioadmin minioadmin
mc mb local/vton-private --ignore-existing
mc anonymous set none local/vton-private

echo "=== Local Infrastructure Ready ==="
echo "PostgreSQL: localhost:5432 (db: vton_db, user: vton_user)"
echo "Redis:      localhost:6379"
echo "MinIO:      localhost:9000 (bucket: vton-private, console: :9001)"
