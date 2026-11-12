#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f backend/wrangler.toml ]; then
  echo "ERRO: backend/wrangler.toml não encontrado. Executa este script na pasta rumocerto-mz-final."
  exit 1
fi
# Actualiza SOMENTE a expressão Cron. Preserva a namespace JOBS e todos os segredos.
python3 - <<'PYCODE'
from pathlib import Path
path=Path('backend/wrangler.toml')
text=path.read_text()
old='crons = ["* * * * *"]'
new='crons = ["*/2 * * * *"]'
if old in text:
    path.write_text(text.replace(old,new))
    print('Cron actualizado para */2 * * * * sem alterar o ID da namespace.')
elif new in text:
    print('Cron já estava configurado a cada dois minutos.')
else:
    print('Cron não localizado; verifica backend/wrangler.toml manualmente.')
PYCODE
printf '\nA validar o backend ...\n'
node --check backend/src/worker.js
node --check backend/src/planner.js
printf '\nTestes automatizados ...\n'
npm test
printf '\nCompilação do frontend ...\n'
npm run build
printf '\nActualização aplicada. Reinicia o Vite e o Worker.\n'
