let isSubmitting = false;
let isEditing = false;

document.addEventListener("DOMContentLoaded", function () {
    const searchNameInput = document.getElementById('search_name');
    const searchProviderInput = document.getElementById('search_provider');

    // Listener for name search
    if (searchNameInput) {
        searchNameInput.addEventListener('input', function () {
            fetchSuggestions(searchNameInput.value, 'name');
        });
    }

    // Listener for provider search
    if (searchProviderInput) {
        searchProviderInput.addEventListener('input', function () {
            fetchSuggestions(searchProviderInput.value, 'provider');
        });
    }

    // Event listener for create slot button
    const createButton = document.querySelector('[data-target="#createSlotModal"]');
    if (createButton) {
        createButton.addEventListener('click', loadCreateForm);
    }

    // Listener for the creation form
    const createModal = document.querySelector('#createSlotModal');
    if (createModal) {
        createModal.addEventListener('submit', function (e) {
            if (e.target.tagName === 'FORM') {
                e.preventDefault();
                if (!isSubmitting) {
                    createSlot(new FormData(e.target));
                }
            }
        });
    }

    // Listener for edit buttons
    document.querySelectorAll('.edit-slot-btn').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.dataset.id;
            loadEditForm(id);
        });
    });

    // Listener for the edit form (will be added dynamically)
    const editModal = document.querySelector('#editSlotModal');
    if (editModal) {
        editModal.addEventListener('submit', function (e) {
            if (e.target.tagName === 'FORM') {
                e.preventDefault();
                const id = e.target.dataset.id;
                editSlot(id, new FormData(e.target));
            }
        });
    }


    // Listener for delete buttons
    document.querySelectorAll('.delete-slot-btn').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.dataset.id;
            deleteSlot(id);
        });
    });
});

// Function to fetch suggestions via AJAX
function fetchSuggestions(query, type) {
    if (!query) return;

    fetch(`/slots/suggestions?type=${type}&query=${query}`)
        .then(response => response.json())
        .then(data => {
            let suggestions = data.suggestions;
            let datalistId = `datalist_${type}`;
            let datalist = document.getElementById(datalistId);

            // Remove old datalist if exists
            if (datalist) {
                datalist.remove();
            }

            // Create new datalist
            datalist = document.createElement('datalist');
            datalist.id = datalistId;

            // Add options to datalist
            suggestions.forEach(suggestion => {
                let option = document.createElement('option');
                option.value = suggestion;
                datalist.appendChild(option);
            });

            // Add new datalist to body
            document.body.appendChild(datalist);

            // Link datalist to correct field
            if (type === 'name') {
                document.getElementById('search_name').setAttribute('list', datalistId);
            } else if (type === 'provider') {
                document.getElementById('search_provider').setAttribute('list', datalistId);
            }
        });
}

// Function to reset search
function resetSearch() {
    document.getElementById('search_name').value = '';
    document.getElementById('search_provider').value = '';
    window.location.href = "/slots";
}

// Function to create slot
function createSlot(formData) {
    if (isSubmitting) return;
    isSubmitting = true;

    fetch('/slots/', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Failed to create slot');
        })
        .then(data => {
            if (data.success) {
                window.location.reload();
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error creating slot: ' + error.message);
        })
        .finally(() => {
            isSubmitting = false;
            $('#createSlotModal').modal('hide');
        });
}

// Function to edit slot
function editSlot(id, formData) {
    fetch(`/slots/${id}`, {
        method: 'POST',
        body: formData,
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update slot');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            $('#editSlotModal').modal('hide');
            window.location.reload();  // Recarrega a página após o sucesso
        } else {
            alert('Error updating slot: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error updating slot: ' + error.message);
    });
}


// Function to load create slot form
function loadCreateForm() {
    fetch('/slots/create_form')
        .then(response => response.text())
        .then(html => {
            document.querySelector('#createSlotModal .modal-body').innerHTML = html;
            $('#createSlotModal').modal('show');
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error loading create form: ' + error.message);
        });
}

// Function to load edit form
function loadEditForm(id) {
    fetch(`/slots/${id}`, {
        method: 'GET',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to load edit form');
        }
        return response.text();
    })
    .then(html => {
        document.querySelector('#editSlotModal .modal-body').innerHTML = html;
        $('#editSlotModal').modal('show');  // Certifique-se que o modal está sendo exibido corretamente
    })
    .catch(error => {
        console.error('Error loading edit form:', error);
        alert('Error loading edit form: ' + error.message);
    });
}


// Function to delete slot
function deleteSlot(id) {
    if (confirm('Are you sure you want to delete this slot?')) {
        fetch(`/slots/${id}/delete`, {
            method: 'POST',
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.reload();
                } else {
                    throw new Error('Failed to delete slot');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error deleting slot: ' + error.message);
            });
    }
}

// Function to perform search
function search() {
    const searchName = document.getElementById('search_name').value;
    const searchProvider = document.getElementById('search_provider').value;
    window.location.href = `/slots?search_name=${encodeURIComponent(searchName)}&search_provider=${encodeURIComponent(searchProvider)}`;
}


// Function to handle form submission for create and edit
function handleFormSubmit(event, isCreate = true) {
    event.preventDefault();
    const formData = new FormData(event.target);
    if (isCreate) {
        createSlot(formData);
    } else {
        const id = event.target.dataset.id;
        editSlot(id, formData);
    }
}

// Event delegation for dynamically loaded forms
document.body.addEventListener('submit', function (event) {
    if (event.target.matches('#slotForm')) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const slotId = event.target.dataset.id;

        if (slotId) {
            editSlot(slotId, formData);
        } else {
            createSlot(formData);
        }
    }
});

// Function to initialize datepickers, if needed
function initializeDatepickers() {
    const datepickers = document.querySelectorAll('.datepicker');
    if (datepickers.length > 0) {
        datepickers.forEach(datepicker => {
            new Pikaday({
                field: datepicker,
                format: 'YYYY-MM-DD'
            });
        });
    }
}

// Call initializeDatepickers after DOM content is loaded and after loading forms
document.addEventListener('DOMContentLoaded', initializeDatepickers);