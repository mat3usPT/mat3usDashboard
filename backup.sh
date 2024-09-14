#!/bin/bash

# Obter a data atual
DATE=$(date +"%Y-%m-%d")

# Adicionar todas as mudanças
git add .

# Commit das mudanças
git commit -m "Backup automático $DATE"

# Criar uma tag com a data
git tag -a "backup-$DATE" -m "Backup automático $DATE"

echo "Backup completo: tag backup-$DATE criada"