document.addEventListener('DOMContentLoaded', function () {
    // Funções comuns a todas as páginas
    setupCreateHuntForm();
    setupHuntActions();
    setupEditHuntButtons();

    // Verifica se estamos na página de visualização de um Bonus Hunt individual
    if (document.querySelector('.bonus-hunt-view')) {
               // Chama updateStatistics imediatamente após o carregamento da página
               const huntData = JSON.parse(document.getElementById('hunt-data').textContent);
               updateStatistics(huntData);
               updateBonusTable(huntData);
               setupBonusActions();
               setupSaveBonusEdit();
               setupAddBonusForm();
               setupAddNewSlotButton();
               setupSlotSearch();
               initProviderSuggestions();
    }
});


///////////////// LIST.HTML //////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

function setupHuntActions() {
    const huntTable = document.querySelector('.table');
    if (huntTable) {
        huntTable.addEventListener('submit', function (e) {
            e.preventDefault();
            const form = e.target;
            const action = form.action;

            let confirmMessage = '';
            if (action.includes('/delete')) {
                confirmMessage = 'Are you sure you want to delete this Bonus Hunt?';
            } else if (action.includes('/reset')) {
                confirmMessage = 'Are you sure you want to reset all payouts for this Bonus Hunt?';
            }

            if (confirmMessage && !confirm(confirmMessage)) {
                return;
            }

            handleHuntAction(form);
        });
    }
}

function handleHuntAction(form) {
    fetch(form.action, {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                if (form.action.includes('/delete')) {
                    const row = form.closest('tr');
                    if (row) {
                        row.remove();
                    }
                    alert(data.message || 'Bonus Hunt deleted successfully');
                } else {
                    location.reload();
                }
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message);
        });
}

function setupCreateHuntForm() {
    const createForm = document.getElementById('createHuntForm');
    if (createForm) {
        createForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
                .then(response => {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        return response.json().then(data => ({ data, isJson: true }));
                    } else {
                        return response.text().then(text => ({ data: text, isJson: false }));
                    }
                })
                .then(({ data, isJson }) => {
                    if (isJson) {
                        if (data.success) {
                            location.reload();
                        } else {
                            alert(data.error || 'Error creating Bonus Hunt');
                        }
                    } else {
                        // Se a resposta não for JSON, pode ser um erro não tratado
                        console.error('Received non-JSON response:', data);
                        alert('An error occurred while creating the Bonus Hunt. Please check the console for details.');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred while creating the Bonus Hunt');
                });
        });
    }
}

function setupEditHuntButtons() {
    const editButtons = document.querySelectorAll('.edit-hunt-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', function () {
            const huntId = this.dataset.huntId;
            const huntName = this.dataset.huntName;
            const huntBalance = this.dataset.huntBalance;

            document.getElementById('edit-hunt-id').value = huntId;
            document.getElementById('edit-hunt-name').value = huntName;
            document.getElementById('edit-hunt-balance').value = huntBalance;

            $('#editHuntModal').modal('show');
        });
    });

    const editHuntForm = document.getElementById('editHuntForm');
    if (editHuntForm) {
        editHuntForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const huntId = formData.get('hunt_id');

            fetch(`/bonus-hunts/${huntId}/edit`, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        alert(data.error || 'Error updating Bonus Hunt');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred while updating the Bonus Hunt');
                });
        });
    }
}


///////////////// VIEW.HTML //////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

function setupBonusActions() {
    const bonusTable = document.getElementById('bonus-table');
    if (bonusTable) {
        bonusTable.addEventListener('click', function (e) {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.classList.contains('play-bonus-btn')) {
                handlePlayBonus(e);
            } else if (target.classList.contains('edit-bonus-btn')) {
                handleEditBonus(e);
            } else if (target.classList.contains('delete-bonus-btn')) {
                handleDeleteBonus(e);
            }
        });

        bonusTable.addEventListener('keydown', function (e) {
            if (e.target.classList.contains('payout-input')) {
                handlePayoutInput(e);
            }
        });
    }
}

function handlePayoutInput(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const bonusId = input.dataset.bonusId;
        const payout = input.value.trim();

        updatePayout(bonusId, payout);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.target.blur();

        const bonusId = e.target.dataset.bonusId;
        handleDeactivateBonus(bonusId);
    }
}

function handlePlayBonus(e) {
    const button = e.target.closest('.play-bonus-btn');
    const bonusId = button.dataset.bonusId;
    const row = button.closest('tr');

    if (row.classList.contains('active-bonus')) {
        deactivateBonus(bonusId);
    } else {
        activateBonus(bonusId);
    }
}

function activateBonus(bonusId) {
    fetch(`/bonus-hunts/activate_bonus/${bonusId}`, { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                updateBonusTable(data.hunt);
                focusPayoutInput(bonusId);
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        })
        .catch(error => {
            console.error('Error activating bonus:', error);
            alert('Failed to activate bonus: ' + error.message);
        });
}

function deactivateBonus(bonusId) {
    fetch(`/bonus-hunts/deactivate_bonus/${bonusId}`, { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                updateBonusTable(data.hunt);
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        })
        .catch(error => {
            console.error('Error deactivating bonus:', error);
            alert('Failed to deactivate bonus: ' + error.message);
        });
}

function focusPayoutInput(bonusId) {
    const input = document.querySelector(`tr[data-bonus-id="${bonusId}"] .payout-input`);
    if (input) {
        input.value = '';
        input.focus();
    }
}

function handlePayoutInput(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const bonusId = input.dataset.bonusId;
        const payout = input.value.trim();

        updatePayout(bonusId, payout);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.target.blur();

        const bonusId = e.target.dataset.bonusId;
        handleDeactivateBonus(bonusId);
    }
}

function handleDeactivateBonus(bonusId) {
    deactivateBonus(bonusId);
}

function updatePayout(bonusId, payout) {
    fetch(`/bonus-hunts/update_payout/${bonusId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ payout: payout })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            updateBonusTable(data.hunt);
            updateStatistics(data.hunt);
            if (data.next_bonus_id) {
                activateBonus(data.next_bonus_id);
            }
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error updating payout:', error);
        alert('Error updating payout: ' + error.message);
    });
}

function updateBonusTable(hunt) {
    const rows = document.querySelectorAll('#bonus-table tbody tr');
    rows.forEach(row => {
        const bonusId = row.dataset.bonusId;
        const bonus = hunt.bonuses.find(b => b.id.toString() === bonusId);
        if (bonus) {
            const isActive = bonus.id === hunt.bonus_atual_id;
            row.classList.toggle('active-bonus', isActive);
            const playButton = row.querySelector('.play-bonus-btn');
            playButton.classList.toggle('btn-outline-success', !isActive);
            playButton.classList.toggle('btn-success', isActive);

            row.querySelector('td:nth-child(3)').textContent = formatCurrency(bonus.aposta);

            const payoutCell = row.querySelector('.payout-cell');
            if (isActive) {
                payoutCell.innerHTML = `<input type="number" step="0.01" name="payout" value="${bonus.payout !== null ? bonus.payout : ''}" class="form-control payout-input" data-bonus-id="${bonus.id}">`;
                const payoutInput = payoutCell.querySelector('.payout-input');
                payoutInput.addEventListener('keydown', handlePayoutInput);
            } else {
                payoutCell.textContent = bonus.payout !== null ? formatCurrency(bonus.payout) : '';
            }
            payoutCell.setAttribute('data-remaining-balance', bonus.saldo_restante || '');

            row.querySelector('td:nth-child(5)').textContent = bonus.payout !== null ? formatMultiplier(bonus.multiplicador) : '';
            row.querySelector('td:nth-child(6)').textContent = bonus.nota || '';
            row.querySelector('td:nth-child(7)').textContent = bonus.padrinho || '';
        }
    });
    updateStatistics(hunt);
}


function activateNextBonus(hunt) {
    const nextBonus = hunt.bonuses.find(b => b.payout === null);
    if (nextBonus) {
        activateBonus(nextBonus.id);
    }
}

function setupAddBonusForm() {
    const addBonusForm = document.getElementById('add-bonus-form');

    if (addBonusForm) {
        addBonusForm.addEventListener('submit', handleAddBonus);

        // Adicionar evento de "Escape" para cada campo do formulário
        const inputs = addBonusForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    resetInputField(input);
                    input.blur(); // Abandona o campo de input
                }
            });
        });
    }

    function resetInputField(input) {
        input.value = ''; // Reseta o valor do campo
    }
}

function handleAddBonus(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json().then(data => ({ data, isJson: true }));
            } else {
                return response.text().then(text => ({ data: text, isJson: false }));
            }
        })
        .then(({ data, isJson }) => {
            if (isJson) {
                if (data.success) {
                    appendNewBonusRow(data.newBonus);
                    updateBonusTable(data.hunt);
                    form.reset();
                } else {
                    throw new Error(data.error || 'Unknown error occurred');
                }
            } else {
                // Se a resposta não for JSON, recarregamos a página
                document.open();
                document.write(data);
                document.close();
            }
        })
        .catch(error => {
            console.error('Error adding bonus:', error);
            alert('Error adding bonus: ' + error.message);
        });
}

function setupEditBonusButtons() {
}

function handleEditBonus(e) {
    const bonusId = e.target.closest('.edit-bonus-btn').dataset.bonusId;
    const row = document.querySelector(`tr[data-bonus-id="${bonusId}"]`);

    document.getElementById('edit-bonus-id').value = bonusId;

    // Função auxiliar para extrair o valor numérico de uma string formatada
    const extractNumber = (str) => {
        const match = str.replace(',', '.').match(/[\d.]+/);
        return match ? parseFloat(match[0]) : '';
    };

    // Obter e definir o valor da aposta
    const betValue = extractNumber(row.querySelector('td:nth-child(3)').textContent);
    document.getElementById('edit-bet').value = betValue;

    // Obter e definir o valor do payout
    const payoutCell = row.querySelector('.payout-cell');
    const payoutValue = payoutCell.querySelector('input') ? 
        payoutCell.querySelector('input').value :
        extractNumber(payoutCell.textContent);
    document.getElementById('edit-payout').value = payoutValue;

    // Obter e definir o saldo restante
    const remainingBalance = payoutCell.getAttribute('data-remaining-balance');
    document.getElementById('edit-remaining-balance').value = remainingBalance || '';

    // Obter e definir a nota
    document.getElementById('edit-note').value = row.querySelector('td:nth-child(6)').textContent.trim();

    // Obter e definir o padrinho
    document.getElementById('edit-padrinho').value = row.querySelector('td:nth-child(7)').textContent.trim();

    $('#editBonusModal').modal('show');
}

// Função que configura os botões de delete
function setupDeleteBonusButtons() {
}

function handleDeleteBonus(e) {
    e.preventDefault();
    const bonusId = e.target.closest('.delete-bonus-btn').dataset.bonusId;
    if (confirm('Are you sure you want to delete this bonus?')) {
        deleteBonus(bonusId);
    }
}

// Função para deletar um bônus
function deleteBonus(bonusId) {
    fetch(`/bonus-hunts/delete_bonus/${bonusId}`, {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            updateBonusTable(data.hunt);
            updateStatistics(data.hunt);
            removeBonusRow(bonusId);
            console.log('Bonus deleted and UI updated.');
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error deleting bonus:', error);
        alert('Error deleting bonus: ' + error.message);
    });
}


function setupSaveBonusEdit() {
    const saveButton = document.getElementById('save-bonus-edit');
    if (saveButton) {
        saveButton.addEventListener('click', function () {
            const form = document.getElementById('edit-bonus-form');
            const bonusId = form.querySelector('#edit-bonus-id').value;
            const formData = new FormData(form);

            fetch(`/bonus-hunts/update_bonus/${bonusId}`, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    updateBonusTable(data.hunt);
                    updateStatistics(data.hunt);
                    $('#editBonusModal').modal('hide');
                } else {
                    throw new Error(data.error || 'Unknown error occurred');
                }
            })
            .catch(error => {
                console.error('Error updating bonus:', error);
                alert('Error updating bonus: ' + error.message);
            });
        });
    }
}

function updateStatistics(hunt) {
    document.getElementById('status').textContent = hunt.is_active ? 'Active' : 'Inactive';
    document.getElementById('custo-inicial').textContent = formatCurrency(hunt.custo_inicial);
    document.getElementById('investimento').textContent = formatCurrency(hunt.estatisticas.investimento);
    document.getElementById('saldo-restante').textContent = formatCurrency(hunt.estatisticas.saldo_restante);
    document.getElementById('total-ganho').textContent = formatCurrency(hunt.estatisticas.total_ganho);
    document.getElementById('lucro-prejuizo').textContent = formatCurrency(hunt.estatisticas.lucro_prejuizo);
    document.getElementById('num-bonus').textContent = hunt.estatisticas.num_bonus;
    document.getElementById('num-bonus-abertos').textContent = hunt.estatisticas.num_bonus_abertos;
    document.getElementById('media-aposta-inicial').textContent = formatCurrency(hunt.estatisticas.media_aposta_inicial);
    document.getElementById('media-aposta').textContent = formatCurrency(hunt.estatisticas.media_aposta);
    document.getElementById('break-even-x-inicial').textContent = formatMultiplier(hunt.estatisticas.break_even_x_inicial);
    document.getElementById('break-even-euro-inicial').textContent = formatCurrency(hunt.estatisticas.break_even_euro_inicial);
    document.getElementById('break-even-x').textContent = formatMultiplier(hunt.estatisticas.break_even_x);
    document.getElementById('break-even-euro').textContent = formatCurrency(hunt.estatisticas.break_even_euro);
    document.getElementById('avg-x').textContent = formatMultiplier(hunt.estatisticas.avg_x);
    document.getElementById('avg-euro').textContent = formatCurrency(hunt.estatisticas.avg_euro);

    updateBestWorstSlots(hunt.estatisticas);
}

// Função de formatação de moeda atualizada
function formatCurrency(value) {
    return value != null ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : '';
}

// Função de formatação de multiplicador atualizada
function formatMultiplier(value) {
    return value != null ? value.toFixed(0) + 'x' : '';
}

// Função de formatação de número atualizada
function formatNumber(value, decimals = 1) {
    return value != null ? Number(value).toFixed(decimals) : '';
}

function updateBestWorstSlots(estatisticas) {
    document.getElementById('best-slot-x').textContent = estatisticas.best_bonus_x ? 
        `${estatisticas.best_bonus_x.slot.name} - ${formatMultiplier(estatisticas.best_bonus_x.multiplicador)}` : 'N/A';
    document.getElementById('best-slot-euro').textContent = estatisticas.best_bonus_euro ? 
        `${estatisticas.best_bonus_euro.slot.name} - ${formatCurrency(estatisticas.best_bonus_euro.payout)}` : 'N/A';
    document.getElementById('worst-slot-x').textContent = estatisticas.worst_bonus_x ? 
        `${estatisticas.worst_bonus_x.slot.name} - ${formatMultiplier(estatisticas.worst_bonus_x.multiplicador)}` : 'N/A';
    document.getElementById('worst-slot-euro').textContent = estatisticas.worst_bonus_euro ? 
        `${estatisticas.worst_bonus_euro.slot.name} - ${formatCurrency(estatisticas.worst_bonus_euro.payout)}` : 'N/A';
}

// Função appendNewBonusRow atualizada
function appendNewBonusRow(bonus) {
    const bonusTable = document.querySelector('#bonus-table tbody');
    if (bonusTable) {
        const newRow = document.createElement('tr');
        newRow.dataset.bonusId = bonus.id;
        
        // Define a classe da linha para a formatação
        const rowIndex = bonusTable.children.length + 1;
        newRow.className = rowIndex % 2 === 0 ? '' : 'active-bonus';

        newRow.innerHTML = `
            <td>${rowIndex}</td>
            <td>
                <div class="slot-info">
                    <img src="${bonus.slot.image}" alt="${bonus.slot.name}" class="slot-img" />
                    <div class="slot-text">
                        <span class="slot-name">${bonus.slot.name}</span>
                        <small class="slot-provider"><i>${bonus.slot.provider}</i></small>
                    </div>
                </div>
            </td>
            <td>${formatCurrency(bonus.aposta)}</td>
            <td class="payout-cell">${bonus.payout !== null ? formatCurrency(bonus.payout) : ''}</td>
            <td>${bonus.payout !== null ? formatMultiplier(bonus.multiplicador) : ''}</td>
            <td>${bonus.nota || ''}</td>
            <td>${bonus.padrinho || ''}</td>
            <td>
                <button class="btn btn-sm action-btn btn-outline-success play-bonus-btn" data-bonus-id="${bonus.id}">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn btn-sm action-btn btn-primary edit-bonus-btn" data-bonus-id="${bonus.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm action-btn btn-danger delete-bonus-btn" data-bonus-id="${bonus.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        // Adiciona a nova linha ao final da tabela
        bonusTable.appendChild(newRow);

        // Atualiza as classes de estilo para todas as linhas
        updateTableRowStyles();
    }
}

function updateTableRowStyles() {
    const rows = document.querySelectorAll('#bonus-table tbody tr');
    rows.forEach((row, index) => {
        // Alterna a classe 'active-bonus' para formatação de linha
        row.classList.toggle('active-bonus', index % 2 !== 0);
    });
}

function removeBonusRow(bonusId) {
    const row = document.querySelector(`tr[data-bonus-id="${bonusId}"]`);
    if (row) {
        row.remove();
    }
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
    suggestionItem.addEventListener('click', function(e) {
        e.preventDefault();
        const slotSearch = document.getElementById('slotSearch');
        const slotIdInput = document.getElementById('slotId');
        const suggestionsBox = document.getElementById('suggestions');

        if (slotSearch && slotIdInput) {
            slotSearch.value = slot.name;
            slotIdInput.value = slot.id;
        }

        if (suggestionsBox) {
            suggestionsBox.classList.remove('show');
        }
    });
    return suggestionItem;
}

function setupSlotSearch() {
    const slotSearch = document.getElementById('slotSearch');
    const suggestionsBox = document.getElementById('suggestions');
    const slotIdInput = document.getElementById('slotId');

    if (slotSearch) {
        slotSearch.addEventListener('input', function () {
            const filter = this.value.toLowerCase();
            suggestionsBox.innerHTML = '';

            if (filter.length >= 3) {
                fetch(`/slots/search?q=${encodeURIComponent(filter)}`)
                    .then(response => response.json())
                    .then(slots => {
                        const uniqueSlots = new Map();
                        slots.forEach(slot => {
                            const lowerCaseName = slot.name.toLowerCase();
                            if (!uniqueSlots.has(lowerCaseName)) {
                                uniqueSlots.set(lowerCaseName, slot);
                            }
                        });

                        uniqueSlots.forEach(slot => {
                            const suggestionItem = document.createElement('a');
                            suggestionItem.href = '#';
                            suggestionItem.className = 'list-group-item list-group-item-action';
                            suggestionItem.innerHTML = `
                                <div style="display: flex; align-items: center;">
                                    <img class="lazyload" data-src="${slot.image}" alt="${slot.name}" style="width: 50px; height: 50px; margin-right: 10px;" />
                                    <div>
                                        <span>${slot.name}</span><br>
                                        <small><i>${slot.provider}</i></small>
                                    </div>
                                </div>
                            `;
                            suggestionItem.addEventListener('click', function (e) {
                                e.preventDefault();
                                slotSearch.value = slot.name;
                                slotIdInput.value = slot.id;
                                suggestionsBox.innerHTML = '';
                                suggestionsBox.classList.remove('show'); // Hide the suggestions box
                            });

                            suggestionsBox.appendChild(suggestionItem);
                        });

                        if (suggestionsBox.innerHTML.trim() !== '') {
                            suggestionsBox.classList.add('show'); // Show the suggestions box
                        }

                        new LazyLoad({
                            elements_selector: ".lazyload"
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching slot suggestions:', error);
                        suggestionsBox.innerHTML = '<div class="list-group-item">Error fetching suggestions. Please try again.</div>';
                        suggestionsBox.classList.add('show'); // Show the error message
                    });
            } else {
                suggestionsBox.classList.remove('show'); // Hide the suggestions box
            }
        });

        // Add event listener for Escape key
        slotSearch.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                resetSlotSearch();
                slotSearch.blur(); // Remove focus from the input
            }
        });

        // Add event listener for clicking outside the search area
        document.addEventListener('click', function (e) {
            if (!slotSearch.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.classList.remove('show');
            }
        });

        // Add event listener for the new slot button
        const addNewSlotBtn = document.getElementById('addNewSlotBtn');
        if (addNewSlotBtn) {
            addNewSlotBtn.addEventListener('click', function() {
                $('#createSlotModal').modal('show');
            });
        }
    }

    function resetSlotSearch() {
        slotSearch.value = ''; // Reset the search input value
        slotIdInput.value = ''; // Reset the hidden input value
        suggestionsBox.innerHTML = ''; // Clear the suggestions
        suggestionsBox.classList.remove('show'); // Hide the suggestions box
    }
}

function setupAddNewSlotButton() {
    const addNewSlotBtn = document.getElementById('addNewSlotBtn');
    if (addNewSlotBtn) {
        addNewSlotBtn.addEventListener('click', function() {
            fetch('/slots/create_form')
                .then(response => response.text())
                .then(html => {
                    const modalBody = document.querySelector('#createSlotModal .modal-body');
                    modalBody.innerHTML = html;
                    $('#createSlotModal').modal('show');
                    setupSlotForm();
                })
                .catch(error => {
                    console.error('Error loading slot creation form:', error);
                    alert('Error loading slot creation form. Please try again.');
                });
        });
    }
}

function setupSlotForm() {
    const slotForm = document.getElementById('slotForm');
    if (slotForm) {
        slotForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const url = this.dataset.id ? `/slots/${this.dataset.id}` : '/slots/';

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
                    $('#createSlotModal').modal('hide');
                    updateSlotSearch(data.slot);
                    alert(this.dataset.id ? 'Slot updated successfully!' : 'Slot created successfully!');
                } else {
                    throw new Error(data.error || 'Unknown error occurred');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`Error ${this.dataset.id ? 'updating' : 'creating'} slot: ${error.message}`);
            });
        });
    }
}
function updateSlotSearch(newSlot, clearExisting = false, showSuggestions = true) {
    const slotSearch = document.getElementById('slotSearch');
    const slotIdInput = document.getElementById('slotId');
    const suggestionsBox = document.getElementById('suggestions');

    if (slotSearch && slotIdInput) {
        slotSearch.value = newSlot.name;
        slotIdInput.value = newSlot.id;
    }

    if (suggestionsBox) {
        if (clearExisting) {
            suggestionsBox.innerHTML = '';
        }

        const suggestionItem = createSuggestionItem(newSlot);
        
        if (clearExisting) {
            suggestionsBox.appendChild(suggestionItem);
        } else {
            suggestionsBox.insertBefore(suggestionItem, suggestionsBox.firstChild);
        }

        suggestionsBox.classList.toggle('show', showSuggestions);
    }
}
// Função para lidar com erros
function handleError(message) {
    console.error(message);
    alert(message);
}