document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.slots-list')) {
        setupSearch();
        setupSlotForms();
        setupDeleteButtons();
    }
    
    // Inicializar setupProviderSuggestions para ambas as páginas
    initProviderSuggestions();
    
    // Se estiver na página de bonus hunts, configurar o botão de adicionar novo slot
    if (document.querySelector('.bonus-hunt-view')) {
        setupAddNewSlotButton();
    }

    initializeDatepickers();
});

function setupSlotForms() {
    // Configurar o botão de criação
    const createButton = document.querySelector('[data-target="#slotModal"]');
    if (createButton) {
        createButton.addEventListener('click', () => loadSlotForm());
    }

    // Configurar os botões de edição
    document.querySelectorAll('.edit-slot-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.dataset.id;
            if (id) {
                loadSlotForm(id);
            } else {
                console.error('Edit button clicked but no slot ID found');
                alert('Error: Could not determine which slot to edit. Please try again.');
            }
        });
    });

    // Event delegation para todos os formulários de slot
    document.body.addEventListener('submit', function(event) {
        if (event.target.matches('#slotForm, #createSlotForm, #editSlotForm')) {
            event.preventDefault();
            handleSlotFormSubmit(event.target);
        }
    });
}

function loadSlotForm(id = null) {
    const url = id ? `/slots/${id}` : '/slots/create_form';
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            const modal = document.getElementById('slotModal');
            if (!modal) {
                throw new Error('Slot modal not found in the DOM');
            }
            const modalBody = modal.querySelector('.modal-body');
            if (!modalBody) {
                throw new Error('Modal body not found in the slot modal');
            }
            modalBody.innerHTML = html;
            
            // Atualizar o título do modal
            const modalTitle = modal.querySelector('.modal-title');
            if (modalTitle) {
                modalTitle.textContent = id ? 'Edit Slot' : 'Create New Slot';
            }

            // Inicializar as sugestões de providers
            setupProviderSuggestions();

            // Mostrar o modal
            $('#slotModal').modal('show');
        })
        .catch(error => {
            console.error('Error loading slot form:', error);
            alert(`Error loading slot form: ${error.message}. Please try again or contact support if the problem persists.`);
        });
}

function handleSlotFormSubmit(form) {
    const formData = new FormData(form);
    const url = form.dataset.id ? `/slots/${form.dataset.id}` : '/slots/';
    const isCreate = !form.dataset.id;

    fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            $('#slotModal').modal('hide');
            alert(isCreate ? 'Slot created successfully!' : 'Slot updated successfully!');
            if (window.location.pathname.includes('bonus-hunts') && isCreate) {
                updateSlotSearch(data.slot);
            } else {
                window.location.reload();
            }
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(`Error ${isCreate ? 'creating' : 'updating'} slot: ${error.message}`);
    });
}

function setupDeleteButtons() {
    document.querySelectorAll('.delete-slot-btn').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.dataset.id;
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
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('slotSearch');
    const searchButton = document.getElementById('searchButton');
    const clearButton = document.getElementById('clearSearch');
    const suggestionsBox = document.getElementById('suggestions');

    if (searchInput) {
        searchInput.addEventListener('input', debounce((event) => {
            const query = event.target.value.trim();
            console.log('Search query:', query); // Debug log
            if (query.length >= 3) {
                fetchSuggestions(query);
            } else {
                suggestionsBox.innerHTML = '';
                suggestionsBox.style.display = 'none';
            }
        }, 300));
    }

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            if (searchInput) {
                performSearch(searchInput.value);
            }
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                suggestionsBox.innerHTML = '';
                suggestionsBox.style.display = 'none';
                performSearch('');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (searchInput && suggestionsBox && !searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.style.display = 'none';
        }
    });
}

function fetchSuggestions(query) {
    console.log('Fetching suggestions for:', query); // Debug log
    fetch(`/slots/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(slots => {
            console.log('Received suggestions:', slots); // Debug log
            const suggestionsBox = document.getElementById('suggestions');
            if (suggestionsBox) {
                suggestionsBox.innerHTML = '';
                if (slots.length > 0) {
                    slots.forEach(slot => {
                        const suggestionItem = createSuggestionItem(slot);
                        suggestionsBox.appendChild(suggestionItem);
                    });
                    suggestionsBox.style.display = 'block';
                } else {
                    suggestionsBox.style.display = 'none';
                }
            }
        })
        .catch(error => console.error('Error fetching suggestions:', error));
}

function createSuggestionItem(slot) {
    const suggestionItem = document.createElement('a');
    suggestionItem.href = '#';
    suggestionItem.className = 'list-group-item list-group-item-action';
    suggestionItem.innerHTML = `
        <div class="d-flex align-items-center">
            <img src="${slot.image || '/static/images/slots/generic.jpg'}" alt="${slot.name}" class="mr-3" style="width: 50px; height: 50px; object-fit: cover;">
            <div>
                <div class="font-weight-bold">${slot.name}</div>
                <small>${slot.provider}</small>
            </div>
        </div>
    `;
    suggestionItem.addEventListener('click', function (e) {
        e.preventDefault();
        const searchInput = document.getElementById('slotSearch');
        const suggestionsBox = document.getElementById('suggestions');
        if (searchInput) {
            searchInput.value = slot.name;
            performSearch(slot.name);
        }
        if (suggestionsBox) {
            suggestionsBox.style.display = 'none';
        }
    });
    return suggestionItem;
}

function performSearch(query) {
    window.location.href = `/slots?search_name=${encodeURIComponent(query)}&search_provider=${encodeURIComponent(query)}`;
}

function updateSlotSearch(newSlot) {
    const slotSearch = document.getElementById('slotSearch');
    const slotIdInput = document.getElementById('slotId');
    const suggestionsBox = document.getElementById('suggestions');

    if (slotSearch && slotIdInput) {
        slotSearch.value = newSlot.name;
        slotIdInput.value = newSlot.id;
    }

    if (suggestionsBox) {
        // Clear existing suggestions
        suggestionsBox.innerHTML = '';

        // Create a new suggestion item for the new slot
        const suggestionItem = createSuggestionItem(newSlot);
        suggestionsBox.appendChild(suggestionItem);

        // Show the suggestions box
        suggestionsBox.classList.add('show');
    }
}

function setupProviderSuggestions() {
    const providerInput = document.getElementById('provider');
    const providerSuggestions = document.getElementById('providerSuggestions');

    if (providerInput && providerSuggestions) {
        providerInput.addEventListener('input', debounce((event) => {
            const query = event.target.value.trim();
            if (query.length >= 2) {
                fetchProviderSuggestions(query);
            } else {
                providerSuggestions.innerHTML = '';
                providerSuggestions.style.display = 'none';
            }
        }, 300));

        // Allow selecting a suggestion
        providerSuggestions.addEventListener('click', function(e) {
            if (e.target && e.target.nodeName === 'LI') {
                providerInput.value = e.target.textContent;
                providerSuggestions.style.display = 'none';
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!providerInput.contains(e.target) && !providerSuggestions.contains(e.target)) {
                providerSuggestions.style.display = 'none';
            }
        });
    }
}

function initProviderSuggestions() {
    setupProviderSuggestions();
    window.fetchProviderSuggestions = function(query) {
    fetch(`/slots/providers?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(providers => {
            const providerSuggestions = document.getElementById('providerSuggestions');
            if (providerSuggestions) {
                providerSuggestions.innerHTML = '';
                if (providers.length > 0) {
                    providers.forEach(provider => {
                        const li = document.createElement('li');
                        li.textContent = provider;
                        li.classList.add('list-group-item');
                        providerSuggestions.appendChild(li);
                    });
                    providerSuggestions.style.display = 'block';
                } else {
                    providerSuggestions.style.display = 'none';
                }
            }
        })
        .catch(error => console.error('Error fetching provider suggestions:', error));
};
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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