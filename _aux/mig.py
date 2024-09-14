import sqlite3

def migrate_database(db_path):
    # Conectar à base de dados
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Criar uma nova tabela com a estrutura desejada
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS slots_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        provedor TEXT NOT NULL,
        rtp REAL,
        volatilidade INTEGER,
        potencial DECIMAL(10, 2),
        melhor_x DECIMAL(10, 2),
        melhor_euro DECIMAL(10, 2),
        imagem TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 2. Copiar os dados da tabela antiga para a nova tabela
    cursor.execute('''
    INSERT INTO slots_new (id, nome, provedor, rtp, volatilidade, potencial, melhor_x, melhor_euro, imagem, data_criacao)
    SELECT id, nome, provedor, rtp, volatilidade, potencial, melhor_x, melhor_euro, imagem, data_criacao FROM slots
    ''')

    # 3. Excluir a tabela antiga
    cursor.execute('DROP TABLE slots')

    # 4. Renomear a nova tabela para o nome original
    cursor.execute('ALTER TABLE slots_new RENAME TO slots')

    # Commitar as alterações e fechar a conexão
    conn.commit()
    conn.close()

    print("Migração da base de dados concluída com sucesso.")

# Caminho para a base de dados SQLite
db_path = 'slots.db'

# Executar a migração
migrate_database(db_path)
