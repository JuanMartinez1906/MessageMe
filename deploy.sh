#!/bin/bash
set -e

echo "==> Instalando dependencias..."
npm run install:all

echo "==> Corriendo migraciones de base de datos..."
cd backend && npx prisma migrate deploy && cd ..

echo "==> Compilando backend y frontend..."
npm run build

echo "==> Copiando frontend build al backend/public..."
rm -rf backend/public
cp -r frontend/dist backend/public

echo "==> Iniciando con PM2..."
cd backend && pm2 start ecosystem.config.js --env production

echo "==> Deploy completado. App corriendo en puerto 3000."
