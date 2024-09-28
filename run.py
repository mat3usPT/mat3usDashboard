from app import create_app, db
from sqlalchemy import inspect

app = create_app()  # Inicializa a aplicação e registra tudo 
app.run(debug=True)