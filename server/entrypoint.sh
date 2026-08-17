#!/bin/sh
set -e

# Garante que o base.db (template de novas salas) está atualizado com as
# fixtures/schema atuais. Re-seeda automaticamente se estiver ausente, antigo
# ou desatualizado (fixtures alteradas). Salas existentes não são afetadas.
echo "[entrypoint] Verifying base.db..."
node db/ensureSeeded.js

npm run build
exec node dist/index.js
