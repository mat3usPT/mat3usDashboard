#!/bin/bash

# Obter a data e hora atual
DATETIME=$(date +"%Y-%m-%d_%H-%M-%S")

# Adicionar todas as mudanças
git add .

# Commit das mudanças
git commit -m "Backup automático $DATETIME"

# Criar uma tag com a data e hora
git tag -a "backup-$DATETIME" -m "Backup automático $DATETIME"

echo "Backup completo: tag backup-$DATETIME criada"

# Opcional: Fazer push para o repositório remoto
# git push origin main
# git push --tags