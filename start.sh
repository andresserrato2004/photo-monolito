#!/bin/bash
# Instalar dependencias del backend
npm install

# Instalar dependencias del frontend y construir
cd client
npm install
npm run build
cd ..

# Ejecutar migraciones de prisma (opcional, depende del entorno)
npx prisma generate

npm run db:push 

# npx prisma migrate deploy # Descomentar si se usa en producción

# Iniciar el servidor
npm run start

