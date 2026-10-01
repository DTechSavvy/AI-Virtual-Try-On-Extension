#!/bin/bash
set -e

su - postgres -c "psql -c \"ALTER USER vton_user WITH PASSWORD 'vton_password' SUPERUSER CREATEDB;\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE vton_db TO vton_user;\""

# Prepend trust for local connections in pg_hba.conf
sed -i '1s/^/host all all 127.0.0.1\/32 trust\nhost all all ::1\/128 trust\nhost all all all trust\n/' /etc/postgresql/16/main/pg_hba.conf

service postgresql restart
echo "PostgreSQL auth configured successfully."
