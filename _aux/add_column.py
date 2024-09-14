import sqlite3

def add_column_to_slots(db_path):
    # Conectar à base de dados
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Adicionar a coluna 'ativo' se ela não existir
        cursor.execute("ALTER TABLE slots ADD COLUMN ativo BOOLEAN DEFAULT 1")
        print("Coluna 'ativo' adicionada com sucesso.")
    except sqlite3.OperationalError as e:
        print(f"Erro ao adicionar a coluna 'ativo': {e}")

    # Commitar as alterações e fechar a conexão
    conn.commit()
    conn.close()

# Caminho para a base de dados SQLite
db_path = 'slots.db'

# Executar a função para adicionar a coluna
add_column_to_slots(db_path)
