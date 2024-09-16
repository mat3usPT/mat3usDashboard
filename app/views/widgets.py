from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from app import db
from app.models.bonus_hunt import BonusHunt, Bonus
from app.models.slot import Slot
from sqlalchemy.exc import SQLAlchemyError

@app.route('/widgets')
def widgets():
    return render_template('widgets.html')

@app.route('/widgets/preview/<widget_name>')
def widget_preview(widget_name):
    # Renderiza um template específico para pré-visualização do widget
    return render_template(f'widgets/{widget_name}_preview.html')

@app.route('/widgets/embed/<widget_name>')
def widget_embed(widget_name):
    # Renderiza um template específico para o widget a ser embutido no OBS
    return render_template(f'widgets/{widget_name}_embed.html')

