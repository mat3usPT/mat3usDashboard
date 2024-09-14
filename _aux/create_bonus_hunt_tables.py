from app import create_app, db
from app.models.bonus_hunt import BonusHunt, Bonus

app = create_app()

with app.app_context():
    # Cria as tabelas
    db.create_all()
    
    print("Tabelas 'bonus_hunts' e 'bonuses' criadas com sucesso!")