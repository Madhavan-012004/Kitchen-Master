#!/data/data/com.termux/files/usr/bin/bash

echo "========================================"
echo " Starting ProBloom Termux Server"
echo "========================================"

# Step 1: Start PostgreSQL
echo "[1/2] Starting PostgreSQL in background..."
# This assumes postgresql is already initdb'd in termux
pg_ctl -D $PREFIX/var/lib/postgresql start > /dev/null 2>&1

sleep 5

# Step 2: Start Java Spring Boot Application
echo "[2/2] Starting Java Backend..."
# Assuming you copied the backend jar file to your Android's internal storage Downloads folder
java -jar ~/storage/downloads/probloom-backend.jar --server.port=48182 --spring.datasource.url=jdbc:postgresql://localhost:5432/postgres

echo "Server is now running on your Android tablet!"
