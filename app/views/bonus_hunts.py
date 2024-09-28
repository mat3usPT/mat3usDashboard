import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from app import db, socketio  # Importar socketio
from app.models.bonus_hunt import BonusHunt, Bonus
from app.models.slot import Slot
from sqlalchemy.exc import SQLAlchemyError
from flask_socketio import emit

bonus_hunts = Blueprint('bonus_hunts', __name__)
logger = logging.getLogger(__name__)


def get_active_hunt():
    return BonusHunt.query.filter_by(is_active=True).first()

def emit_bonus_hunt_update():
    current_hunt = get_active_hunt()
    if current_hunt:
        data = current_hunt.to_dict()
        print('Emitindo dados do hunt:', data)  # Depuração
        socketio.emit('bonus_hunt_update', {'data': data}, namespace='/widgets')

# Função para retornar os dados da hunt ativa
@bonus_hunts.route('/current', methods=['GET'])
def get_current_hunt():
    current_hunt = get_active_hunt()  # Função para obter a hunt ativa
    if current_hunt:
        return jsonify(current_hunt.to_dict())  # Certifique-se de que current_hunt tenha um método to_dict
    else:
        return jsonify({"error": "No active hunt found"}), 404
    

@bonus_hunts.route('/create', methods=['POST'])
def create_hunt():
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        try:
            nome = request.form['nome']
            custo_inicial = float(request.form['custo_inicial'])
            new_hunt = BonusHunt(nome=nome, custo_inicial=custo_inicial)
            db.session.add(new_hunt)
            db.session.commit()
            emit_bonus_hunt_update()  # Emitir evento de atualização

            return jsonify({'success': True, 'message': 'Bonus Hunt created successfully'})
        except ValueError as e:
            return jsonify({'success': False, 'error': f'Invalid value: {str(e)}'}), 400
        except SQLAlchemyError as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 500
        except Exception as e:
            return jsonify({'success': False, 'error': f'Unexpected error: {str(e)}'}), 500
    else:
        try:
            nome = request.form['nome']
            custo_inicial = float(request.form['custo_inicial'])
            new_hunt = BonusHunt(nome=nome, custo_inicial=custo_inicial)
            db.session.add(new_hunt)
            db.session.commit()
            flash('Bonus Hunt created successfully!', 'success')
        except ValueError as e:
            flash(f'Invalid value: {str(e)}', 'error')
        except SQLAlchemyError as e:
            db.session.rollback()
            flash(f'Database error: {str(e)}', 'error')
        except Exception as e:
            flash(f'Unexpected error: {str(e)}', 'error')
        return redirect(url_for('bonus_hunts.list_hunts'))

@bonus_hunts.route('/<int:id>/delete', methods=['POST'])
def delete_hunt(id):
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        try:
            hunt = BonusHunt.query.get_or_404(id)
            if hunt.is_active:
                return jsonify({'success': False, 'error': 'Cannot delete an active Bonus Hunt'}), 400
            
            # Delete all associated bonuses first
            for bonus in hunt.bonuses:
                db.session.delete(bonus)
            
            # Now delete the hunt
            db.session.delete(hunt)
            db.session.commit()
            emit_bonus_hunt_update()  # Emitir evento de atualização
            return jsonify({'success': True, 'message': 'Bonus Hunt deleted successfully'})
        except SQLAlchemyError as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        try:
            hunt = BonusHunt.query.get_or_404(id)
            if hunt.is_active:
                flash('Cannot delete an active Bonus Hunt', 'error')
            else:
                # Delete all associated bonuses first
                for bonus in hunt.bonuses:
                    db.session.delete(bonus)
                
                # Now delete the hunt
                db.session.delete(hunt)
                db.session.commit()
                flash('Bonus Hunt deleted successfully', 'success')
        except SQLAlchemyError as e:
            db.session.rollback()
            flash(f'Error deleting Bonus Hunt: {str(e)}', 'error')
        return redirect(url_for('bonus_hunts.list_hunts'))
    
@bonus_hunts.route('/')
def list_hunts():
    hunts = BonusHunt.query.order_by(BonusHunt.data_criacao.desc()).all()
    for hunt in hunts:
        hunt.estatisticas = hunt.calcular_estatisticas()
    return render_template('bonus_hunts/list.html', hunts=hunts)

@bonus_hunts.route('/<int:id>')
def view_hunt(id):
    hunt_obj = BonusHunt.query.get_or_404(id)
    hunt_dict = hunt_obj.to_dict()
    return render_template('bonus_hunts/view.html', hunt=hunt_dict, hunt_obj=hunt_obj)

@bonus_hunts.route('/<int:id>/activate', methods=['POST'])
def activate_hunt(id):
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        try:
            hunt = BonusHunt.query.get_or_404(id)
            hunt.set_active()
            db.session.commit()
            emit_bonus_hunt_update()  # Emitir evento de atualização
            return jsonify({'success': True})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        try:
            hunt = BonusHunt.query.get_or_404(id)
            hunt.set_active()
            db.session.commit()
            flash('Bonus Hunt activated successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error activating Bonus Hunt: {str(e)}', 'error')
        return redirect(url_for('bonus_hunts.view_hunt', id=id))

@bonus_hunts.route('/<int:id>/reset', methods=['POST'])
def reset_hunt(id):
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        try:
            hunt = BonusHunt.query.get_or_404(id)
            for bonus in hunt.bonuses:
                bonus.payout = None
            db.session.commit()
            emit_bonus_hunt_update()  # Emitir evento de atualização
            return jsonify({'success': True})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        try:
            hunt = BonusHunt.query.get_or_404(id)
            for bonus in hunt.bonuses:
                bonus.payout = None
            db.session.commit()
            flash('Bonus Hunt reset successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error resetting Bonus Hunt: {str(e)}', 'error')
        return redirect(url_for('bonus_hunts.view_hunt', id=id))
    
@bonus_hunts.route('/<int:id>/edit', methods=['POST'])
def edit_hunt(id):
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        try:
            hunt = BonusHunt.query.get_or_404(id)
            hunt.nome = request.form['nome']
            hunt.custo_inicial = float(request.form['custo_inicial'])
            db.session.commit()
            emit_bonus_hunt_update()  # Emitir evento de atualização
            return jsonify({'success': True, 'message': 'Bonus Hunt updated successfully'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        # Handle non-AJAX request
        try:
            hunt = BonusHunt.query.get_or_404(id)
            hunt.nome = request.form['nome']
            hunt.custo_inicial = float(request.form['custo_inicial'])
            db.session.commit()
            emit_bonus_hunt_update()  # Emitir evento de atualização
            flash('Bonus Hunt updated successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating Bonus Hunt: {str(e)}', 'error')
        return redirect(url_for('bonus_hunts.list_hunts'))


@bonus_hunts.route('/update_payout/<int:bonus_id>', methods=['POST'])
def update_payout(bonus_id):
    try:
        bonus = Bonus.query.get_or_404(bonus_id)
        hunt = bonus.hunt
        data = request.json
        payout = data.get('payout')
        
        if payout == '' or payout is None:
            bonus.payout = None
        else:
            bonus.payout = float(payout)
        
        db.session.commit()
        
        ordered_bonuses = hunt.get_ordered_bonuses()
        current_index = ordered_bonuses.index(bonus)
        next_bonus = ordered_bonuses[current_index + 1] if current_index + 1 < len(ordered_bonuses) else None
        
        if next_bonus:
            hunt.bonus_atual_id = next_bonus.id
            db.session.commit()
        
        emit_bonus_hunt_update()
        
        hunt.estatisticas = hunt.calcular_estatisticas()
        return jsonify({
            'success': True, 
            'hunt': hunt.to_dict(),
            'next_bonus_id': next_bonus.id if next_bonus else None
        })
    except ValueError as e:
        return jsonify({'success': False, 'error': f'Invalid value: {str(e)}'}), 400
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 500

@bonus_hunts.route('/<int:id>/add_bonus', methods=['POST'])
def add_bonus(id):
    hunt = BonusHunt.query.get_or_404(id)
    try:
        slot = Slot.query.get(request.form['slot_id'])
        if not slot:
            return jsonify({'success': False, 'error': 'Slot not found'}), 400
        
        bonus = Bonus(
            hunt=hunt,
            slot=slot,
            aposta=float(request.form['aposta']),
            saldo_restante=float(request.form['saldo_restante']) if request.form['saldo_restante'] else None,
            nota=request.form.get('nota'),
            padrinho=request.form.get('padrinho')
        )
        db.session.add(bonus)
        db.session.flush()  # This will assign an ID to the bonus without committing

        # Update bonus_order
        if hunt.bonus_order:
            hunt.bonus_order += f',{bonus.id}'
        else:
            hunt.bonus_order = str(bonus.id)

        # If this is the first bonus, set it as the current bonus
        if len(hunt.bonuses) == 1:
            hunt.bonus_atual_id = bonus.id

        db.session.commit()
        emit_bonus_hunt_update()  # Emit update event
        hunt.estatisticas = hunt.calcular_estatisticas()
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': True,
                'newBonus': bonus.to_dict(),
                'hunt': hunt.to_dict()
            })
        else:
            return redirect(url_for('bonus_hunts.view_hunt', id=hunt.id))
    except ValueError as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Invalid value: {str(e)}'}), 400
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 500

@bonus_hunts.route('/delete_bonus/<int:bonus_id>', methods=['POST'])
def delete_bonus(bonus_id):
    try:
        bonus = Bonus.query.get_or_404(bonus_id)
        hunt = bonus.hunt
        db.session.delete(bonus)
        db.session.commit()
        emit_bonus_hunt_update()  # Emitir evento de atualização
        hunt.estatisticas = hunt.calcular_estatisticas()
        return jsonify({'success': True, 'hunt': hunt.to_dict()})
    except Exception as e:
        db.session.rollback()
        
@bonus_hunts.route('/update_bonus/<int:bonus_id>', methods=['POST'])
def update_bonus(bonus_id):
    try:
        bonus = Bonus.query.get_or_404(bonus_id)
        hunt = bonus.hunt
        
        bonus.aposta = float(request.form['aposta'])
        bonus.saldo_restante = float(request.form['saldo_restante']) if request.form['saldo_restante'] else None
        bonus.payout = float(request.form['payout']) if request.form['payout'] else None
        bonus.nota = request.form['nota']
        bonus.padrinho = request.form['padrinho']
        
        # Removemos a atribuição direta do multiplicador
        # O multiplicador será calculado automaticamente pela propriedade híbrida
        
        db.session.commit()
        emit_bonus_hunt_update()  # Emitir evento de atualização
        hunt.estatisticas = hunt.calcular_estatisticas()
        return jsonify({'success': True, 'hunt': hunt.to_dict()})
    except ValueError as e:
        return jsonify({'success': False, 'error': f'Invalid value: {str(e)}'}), 400
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 500

@bonus_hunts.route('/activate_bonus/<int:bonus_id>', methods=['POST'])
def activate_bonus(bonus_id):
    try:
        bonus = Bonus.query.get_or_404(bonus_id)
        hunt = bonus.hunt
        
        hunt.bonus_atual_id = bonus.id
        db.session.commit()
        emit_bonus_hunt_update()

        hunt.estatisticas = hunt.calcular_estatisticas()
        return jsonify({'success': True, 'hunt': hunt.to_dict()})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 500

@bonus_hunts.route('/deactivate_bonus/<int:bonus_id>', methods=['POST'])
def deactivate_bonus(bonus_id):
    try:
        bonus = Bonus.query.get_or_404(bonus_id)
        hunt = bonus.hunt
        if hunt.bonus_atual_id == bonus.id:
            hunt.bonus_atual_id = None
            db.session.commit()
            emit_bonus_hunt_update()

        hunt.estatisticas = hunt.calcular_estatisticas()
        return jsonify({'success': True, 'hunt': hunt.to_dict()})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 500
    
@bonus_hunts.route('/<int:id>/reset-active-bonus', methods=['POST'])
def reset_active_bonus(id):
    hunt = BonusHunt.query.get_or_404(id)
    hunt.bonus_atual_id = None
    db.session.commit()
    return jsonify({'success': True})
    
@bonus_hunts.route('/<int:id>/update-phase', methods=['POST'])
def update_hunt_phase(id):
    try:
        hunt = BonusHunt.query.get_or_404(id)
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data received'}), 400
        
        new_phase = data.get('phase')
        if new_phase not in ['hunting', 'opening', 'ended']:
            return jsonify({'success': False, 'error': 'Invalid phase'}), 400
        
        hunt.phase = new_phase
        if new_phase == 'opening' and not hunt.bonus_atual_id:
            first_bonus = Bonus.query.filter_by(hunt_id=hunt.id).order_by(Bonus.order).first()
            if first_bonus:
                hunt.bonus_atual_id = first_bonus.id
        elif new_phase == 'ended':
            hunt.is_active = False
        
        db.session.commit()
        return jsonify({
            'success': True,
            'hunt': hunt.to_dict()  # Certifique-se de que este método existe e retorna todos os dados necessários
        })
    
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error in update_hunt_phase: {str(e)}")
        return jsonify({'success': False, 'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in update_hunt_phase: {str(e)}")
        return jsonify({'success': False, 'error': 'An unexpected error occurred'}), 500

@bonus_hunts.route('/<int:hunt_id>/update_bonus_order', methods=['POST'])
def update_bonus_order(hunt_id):
    hunt = BonusHunt.query.get_or_404(hunt_id)
    new_order = request.json.get('order')
    if new_order:
        hunt.bonus_order = ','.join(map(str, new_order))
        db.session.commit()
        
        # Emitir atualização para o overlay
        emit_bonus_hunt_update()
        
        response = jsonify({'success': True})
        response.headers.add('Content-Type', 'application/json')
        return response
    return jsonify({'success': False, 'error': 'No order provided'}), 400

def emit_bonus_hunt_update():
    current_hunt = BonusHunt.query.filter_by(is_active=True).first()
    if current_hunt:
        socketio.emit('bonus_hunt_update', {'data': current_hunt.to_dict()}, namespace='/widgets')


