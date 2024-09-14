from app import db
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func, case
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from decimal import Decimal
from flask import url_for
import math

class BonusHunt(db.Model):
    __tablename__ = 'bonus_hunts'

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    custo_inicial = Column(Float, nullable=False)
    data_criacao = Column(DateTime, default=func.current_timestamp())
    is_active = Column(db.Boolean, default=False)
    bonus_atual_id = Column(db.Integer, db.ForeignKey('bonuses.id'), nullable=True)

    bonuses = relationship('Bonus', back_populates='hunt', cascade='all, delete-orphan', foreign_keys='Bonus.hunt_id')
    bonus_atual = relationship('Bonus', foreign_keys=[bonus_atual_id], post_update=True)

    def __init__(self, nome, custo_inicial):
        self.nome = nome
        self.custo_inicial = custo_inicial

    def set_active(self):
        # Desativar todos os outros hunts
        db.session.query(BonusHunt).update({'is_active': False})
        # Ativar o hunt atual
        self.is_active = True
        db.session.commit()

    def calcular_estatisticas(self):
        total_ganho = sum(b.payout for b in self.bonuses if b.payout is not None)
        total_apostas = sum(b.aposta for b in self.bonuses)
        num_bonus = len(self.bonuses)
        num_bonus_abertos = sum(1 for b in self.bonuses if b.payout is not None)
        
        saldo_restante = self.custo_inicial - total_apostas
        for bonus in self.bonuses:
            if bonus.saldo_restante is not None:
                saldo_restante = bonus.saldo_restante
        
        investimento = self.custo_inicial - saldo_restante
        media_aposta_inicial = total_apostas / num_bonus if num_bonus > 0 else 0
        break_even_x_inicial = int(self.custo_inicial / total_apostas) if total_apostas > 0 else float('inf')
        break_even_euro_inicial = int(self.custo_inicial / num_bonus) if num_bonus > 0 else self.custo_inicial

        bonuses_nao_abertos = [b for b in self.bonuses if b.payout is None]
        total_apostas_nao_abertas = sum(b.aposta for b in bonuses_nao_abertos)
        num_bonus_nao_abertos = len(bonuses_nao_abertos)

        media_aposta = total_apostas_nao_abertas / num_bonus_nao_abertos if num_bonus_nao_abertos > 0 else 0
        valor_restante = investimento - total_ganho
        break_even_x = int(valor_restante / total_apostas_nao_abertas) if total_apostas_nao_abertas > 0 else math.inf
        break_even_euro = int(valor_restante / num_bonus_nao_abertos) if num_bonus_nao_abertos > 0 else 0

        bonuses_abertos = [b for b in self.bonuses if b.payout is not None]
        avg_x = int(sum(b.multiplicador for b in bonuses_abertos) / len(bonuses_abertos)) if bonuses_abertos else 0
        avg_euro = int(sum(b.payout for b in bonuses_abertos) / len(bonuses_abertos)) if bonuses_abertos else 0

        best_x = max(bonuses_abertos, key=lambda b: b.multiplicador) if bonuses_abertos else None
        best_euro = max(bonuses_abertos, key=lambda b: b.payout) if bonuses_abertos else None
        worst_x = min(bonuses_abertos, key=lambda b: b.multiplicador) if bonuses_abertos else None
        worst_euro = min(bonuses_abertos, key=lambda b: b.payout) if bonuses_abertos else None

        return {
            'custo_inicial': self.custo_inicial,
            'saldo_restante': saldo_restante,
            'investimento': investimento,
            'total_ganho': total_ganho,
            'lucro_prejuizo': total_ganho - investimento,
            'num_bonus': num_bonus,
            'num_bonus_abertos': num_bonus_abertos,
            'num_bonus_nao_abertos': num_bonus - num_bonus_abertos,
            'media_aposta_inicial': media_aposta_inicial,
            'media_aposta': media_aposta,
            'break_even_x_inicial': break_even_x_inicial,
            'break_even_euro_inicial': break_even_euro_inicial,
            'break_even_x': break_even_x,
            'break_even_euro': break_even_euro,
            'avg_x': avg_x,
            'avg_euro': avg_euro,
            'best_bonus_x': best_x.to_dict() if best_x else None,
            'best_bonus_euro': best_euro.to_dict() if best_euro else None,
            'worst_bonus_x': worst_x.to_dict() if worst_x else None,
            'worst_bonus_euro': worst_euro.to_dict() if worst_euro else None,
        }

    def to_dict(self):
        estatisticas = self.calcular_estatisticas()
        
        def handle_infinite(value):
            if isinstance(value, float):
                if math.isinf(value) or value > 1e300:
                    return "Infinity"
                return value
            return value

        estatisticas = {k: handle_infinite(v) for k, v in estatisticas.items()}

        return {
            'id': self.id,
            'nome': self.nome,
            'custo_inicial': self.custo_inicial,
            'data_criacao': self.data_criacao.isoformat(),
            'is_active': self.is_active,
            'bonus_atual_id': self.bonus_atual_id,
            'bonuses': [b.to_dict() for b in self.bonuses],
            'estatisticas': estatisticas
        }

class Bonus(db.Model):
    __tablename__ = 'bonuses'

    id = Column(Integer, primary_key=True)
    slot_id = Column(Integer, ForeignKey('slots.id'), nullable=False)
    hunt_id = Column(Integer, ForeignKey('bonus_hunts.id'), nullable=False)
    aposta = Column(Float, nullable=False)
    payout = Column(Float, nullable=True)
    saldo_restante = Column(Float, nullable=True)
    nota = Column(String)
    padrinho = Column(String)

    hunt = relationship('BonusHunt', back_populates='bonuses', foreign_keys=[hunt_id])
    slot = relationship('Slot')

    @hybrid_property
    def multiplicador(self):
        if self.payout is not None and self.aposta:
            return self.payout / self.aposta
        return 0

    @multiplicador.expression
    def multiplicador(cls):
        return case(
            [(cls.payout != None, cls.payout / cls.aposta)],
            else_=0
        )

    def to_dict(self):
        return {
            'id': self.id,
            'aposta': float(self.aposta) if self.aposta is not None else None,
            'payout': float(self.payout) if self.payout is not None else None,
            'saldo_restante': float(self.saldo_restante) if self.saldo_restante is not None else None,
            'nota': self.nota,
            'padrinho': self.padrinho,
            'multiplicador': float(self.multiplicador) if self.multiplicador is not None else None,
            'slot': {
                'id': self.slot.id,
                'name': self.slot.name,
                'provider': self.slot.provider,
                'image': url_for('static', filename=self.slot.image, _external=True) if self.slot.image else None
            } if self.slot else None
        }