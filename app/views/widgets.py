from flask import Blueprint, render_template, jsonify
from flask_socketio import emit
from app import socketio
from app.models.bonus_hunt import BonusHunt
import logging

widgets = Blueprint('widgets', __name__)
logger = logging.getLogger(__name__)

@widgets.route('/overlay')
def overlay():
    return render_template('widgets/overlay.html')

@widgets.route('/overlay/data', methods=['GET'])
def get_overlay_data():
    current_hunt = BonusHunt.query.filter_by(is_active=True).first()
    if current_hunt:
        return jsonify(current_hunt.to_dict())
    else:
        return jsonify({"error": "No active hunt found"}), 404

@socketio.on('connect', namespace='/widgets')
def handle_connect():
    logger.info('Client connected to widgets namespace')
    emit_overlay_update()

@socketio.on('disconnect', namespace='/widgets')
def handle_disconnect():
    logger.info('Client disconnected from widgets namespace')

def emit_overlay_update():
    logger.info("Entering emit_overlay_update function")
    try:
        current_hunt = BonusHunt.query.filter_by(is_active=True).first()
        if current_hunt:
            hunt_data = current_hunt.to_dict()
            logger.info(f"Emitting hunt data: {hunt_data}")
            socketio.emit('bonus_hunt_update', {'data': hunt_data}, namespace='/widgets')
        else:
            logger.warning("No active hunt found for update emission")
    except Exception as e:
        logger.error(f"Error in emit_overlay_update: {str(e)}")

def trigger_overlay_update():
    emit_overlay_update()