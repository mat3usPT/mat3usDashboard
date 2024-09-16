from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import requests
from app import db
from app.models.slot import Slot
from sqlalchemy import func
import traceback

slots = Blueprint('slots', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def download_image_from_url(url, filename):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open(filename, 'wb') as file:
                file.write(response.content)
            return True
        else:
            print(f"Error downloading image: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"Error downloading image: {e}")
        return False

def handle_image(slot, form):
    if form.get('use_default_image'):
        slot.image = 'images/slots/generic.jpg'
    elif 'image' in request.files and request.files['image']:
        file = request.files['image']
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(current_app.root_path, 'static', 'images', 'slots', filename)
            file.save(file_path)
            slot.image = f'images/slots/{filename}'
    elif 'image_link' in form and form['image_link']:
        image_link = form['image_link']
        ext = image_link.rsplit('.', 1)[1].lower()
        if ext in ALLOWED_EXTENSIONS:
            filename = secure_filename(image_link.rsplit('/', 1)[1])
            file_path = os.path.join(current_app.root_path, 'static', 'images', 'slots', filename)
            if download_image_from_url(image_link, file_path):
                slot.image = f'images/slots/{filename}'
            else:
                flash('Unable to download image from the provided link.', 'danger')
        else:
            flash('Unsupported image format.', 'danger')
    elif not slot.image:  # If no image is provided and slot doesn't already have an image
        slot.image = 'images/slots/generic.jpg'

@slots.route('/suggestions')
def suggestions():
    query = request.args.get('query', '')
    search_type = request.args.get('type', '')

    if search_type == 'name':
        suggestions = Slot.query.filter(func.lower(Slot.name).like(f"%{query.lower()}%")) \
                                .with_entities(Slot.name) \
                                .distinct() \
                                .order_by(Slot.name) \
                                .limit(10) \
                                .all()
        suggestions = [s[0] for s in suggestions]
    elif search_type == 'provider':
        suggestions = Slot.query.filter(func.lower(Slot.provider).like(f"%{query.lower()}%")) \
                                .with_entities(Slot.provider) \
                                .distinct() \
                                .order_by(Slot.provider) \
                                .limit(10) \
                                .all()
        suggestions = [s[0] for s in suggestions]
    else:
        suggestions = []

    return jsonify({'suggestions': suggestions})

@slots.route('/')
def list_slots():
    page = request.args.get('page', 1, type=int)
    per_page = 50
    sort = request.args.get('sort', 'name')
    order = request.args.get('order', 'asc')
    search_name = request.args.get('search_name', '')
    search_provider = request.args.get('search_provider', '')
    
    query = Slot.query
    
    if search_name or search_provider:
        query = query.filter(
            (Slot.name.ilike(f'%{search_name}%')) |
            (Slot.provider.ilike(f'%{search_provider}%'))
        )
    
    if order == 'asc':
        query = query.order_by(getattr(Slot, sort).asc())
    else:
        query = query.order_by(getattr(Slot, sort).desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return render_template('slots/list.html', pagination=pagination, sort=sort, order=order, search_name=search_name, search_provider=search_provider)

@slots.route('/create_form')
def create_slot_form():
    return render_template('slots/create_edit_slot.html', slot=None)

@slots.route('/', methods=['POST'])
def create_slot():
    try:
        slot = Slot(
            name=request.form['name'],
            provider=request.form['provider'],
            rtp=float(request.form['rtp']) / 100 if request.form['rtp'] else None,
            volatility=int(request.form['volatility']) if request.form['volatility'] else None,
            potential=float(request.form['potential']) if request.form['potential'] else None,
            best_x=float(request.form['best_x']) if request.form.get('best_x') else None,
            best_euro=int(float(request.form['best_euro'])) if request.form.get('best_euro') else None
        )
        handle_image(slot, request.form)
        db.session.add(slot)
        db.session.commit()
        return jsonify({
            'success': True, 
            'message': 'Slot created successfully!',
            'slot': {
                'id': slot.id,
                'name': slot.name,
                'provider': slot.provider,
                'image': url_for('static', filename=slot.image, _external=True) if slot.image else None
            }
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error creating slot: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@slots.route('/<int:id>', methods=['GET', 'POST'])
def edit_slot(id):
    slot = Slot.query.get_or_404(id)
    if request.method == 'POST':
        try:
            slot.name = request.form['name']
            slot.provider = request.form['provider']
            slot.rtp = float(request.form['rtp']) / 100 if request.form['rtp'] else None
            slot.volatility = int(request.form['volatility']) if request.form['volatility'] else None
            slot.potential = float(request.form['potential']) if request.form['potential'] else None
            slot.best_x = float(request.form['best_x']) if request.form.get('best_x') else None
            slot.best_euro = int(float(request.form['best_euro'])) if request.form.get('best_euro') else None

            handle_image(slot, request.form)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Slot updated successfully!'})
        except Exception as e:
            db.session.rollback()
            print(f"Error updating slot: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        return render_template('slots/create_edit_slot.html', slot=slot)
    
@slots.route('/<int:id>/delete', methods=['POST'])
def delete_slot(id):
    try:
        slot = Slot.query.get_or_404(id)
        db.session.delete(slot)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Slot deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting slot: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    

@slots.route('/search')
def search_slots():
    query = request.args.get('q', '')
    print(f"Received search query: {query}")  # Debug log
    slots = Slot.query.filter(func.lower(Slot.name).like(f"%{query.lower()}%")).all()
    
    # Remove duplicates and limit to 10 results
    unique_slots = {}
    for slot in slots:
        if slot.name.lower() not in unique_slots:
            unique_slots[slot.name.lower()] = slot
            if len(unique_slots) == 10:
                break
    
    result = [{
        'id': slot.id,
        'name': slot.name,
        'provider': slot.provider,
        'image': url_for('static', filename=slot.image.lstrip('/'), _external=True) if slot.image else None
    } for slot in unique_slots.values()]
    
    print(f"Returning {len(result)} results")  # Debug log
    return jsonify(result)

@slots.route('/providers')
def get_providers():
    query = request.args.get('q', '').lower()
    providers = Slot.query.with_entities(Slot.provider).distinct().all()
    providers = [p[0] for p in providers if p[0] and query in p[0].lower()]
    return jsonify(providers)