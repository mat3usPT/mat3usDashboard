from app import create_app, db
from app.models.slot import Slot
import re
import math

app = create_app()

def clean_value(value, remove_char=''):
    if value is None:
        return None
    if isinstance(value, str):
        # Remove o símbolo especificado, como 'x'
        value = value.strip(remove_char)
        if value == '-':
            return None
        
        # Remove todos os caracteres não numéricos, exceto ponto
        value = re.sub(r'[^\d.]', '', value)

        # Se houver mais de um ponto, remova o primeiro ponto
        if value.count('.') > 1:
            value = re.sub(r'\.(?=.*\.)', '', value)

        # Identifica a posição do ponto
        point_index = value.find('.')

        if point_index != -1:
            # Se o ponto estiver a uma ou duas casas do final, é uma casa decimal
            if len(value) - point_index <= 3:
                # Arredonda para o valor inteiro mais próximo
                value = str(math.ceil(float(value)))
            else:
                # Remove o ponto de milhar
                value = value.replace('.', '')

        try:
            # Converte para número inteiro
            return int(value)
        except ValueError:
            print(f"Não foi possível converter '{value}' para int. Definindo como None.")
            return None
    return value

def clean_database():
    with app.app_context():
        slots = Slot.query.all()
        for slot in slots:
            if slot.rtp is not None:
                cleaned_rtp = clean_value(str(slot.rtp), '%')
                slot.rtp = cleaned_rtp / 100 if cleaned_rtp is not None else None

            if slot.volatilidade is not None:
                if isinstance(slot.volatilidade, str):
                    slot.volatilidade = slot.volatilidade.split('/')[0]
                    try:
                        slot.volatilidade = int(float(slot.volatilidade))
                    except ValueError:
                        print(f"Não foi possível converter volatilidade '{slot.volatilidade}' para int. Definindo como None.")
                        slot.volatilidade = None

            if slot.potencial is not None:
                cleaned_potencial = clean_value(str(slot.potencial), 'x')
                slot.potencial = cleaned_potencial if cleaned_potencial is not None else None

            if slot.melhor_x is not None:
                slot.melhor_x = clean_value(str(slot.melhor_x), 'x')

            if slot.melhor_euro is not None:
                slot.melhor_euro = clean_value(str(slot.melhor_euro), '€')

        db.session.commit()
        print("Database cleaned successfully!")

if __name__ == "__main__":
    clean_database()
