from app import create_app, db
from app.models.slot import Slot

app = create_app()

def update_image_paths():
    with app.app_context():
        slots = Slot.query.all()
        for slot in slots:
            if slot.imagem and slot.imagem.startswith('imagens\\'):
                # Removendo 'imagens\' do início e adicionando 'images/slots/' no lugar
                new_path = 'images/slots/' + slot.imagem.split('\\')[-1]
                slot.imagem = new_path
                print(f"Atualizando {slot.nome}: {slot.imagem}")
        
        db.session.commit()
        print("Atualização concluída!")

if __name__ == "__main__":
    update_image_paths()