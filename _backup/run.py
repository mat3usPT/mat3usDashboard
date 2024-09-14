from app import create_app, db
from sqlalchemy import inspect

app = create_app()  # Initialize the app and register everything

@app.shell_context_processor
def make_shell_context():
    from app.models.slot import Slot  # Import Slot here to avoid circular imports
    return {'db': db, 'Slot': Slot}

def table_exists(table_name):
    inspector = inspect(db.engine)
    return table_name in inspector.get_table_names()

if __name__ == '__main__':
    with app.app_context():
        from app.models.slot import Slot  # Import Slot here to avoid circular imports
        try:
            if not table_exists(Slot.__tablename__):
                print(f"A tabela '{Slot.__tablename__}' não existe no banco de dados.")
            else:
                slots = Slot.query.limit(5).all()
                print("Primeiros 5 slots:")
                for slot in slots:
                    print(f"ID: {slot.id}, Nome: {slot.name}, Provedor: {slot.provider}")
        except Exception as e:
            print("Erro ao acessar os slots:", str(e))
    
    app.run(debug=True)