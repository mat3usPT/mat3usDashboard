document.addEventListener('DOMContentLoaded', function () {
    // Funções comuns a todas as páginas
    setupSlotSearch();
    setupBonusActions();
    setupSaveBonusEdit();
    setupCreateHuntForm();
    setupHuntActions();

    // Verifica se estamos na página de visualização de um Bonus Hunt individual
    if (document.querySelector('.bonus-hunt-view')) {
        setupAddBonusForm();
        setupEditBonusButtons();
        setupDeleteBonusButtons();
    }
});


///////////////// LIST.HTML //////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////


function setupHuntActions() {
    const huntTable = document.querySelector('.table');
    if (huntTable) {
        huntTable.addEventListener('submit', function(e) {
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
                // Remove a linha da tabela
                const row = form.closest('tr');
                if (row) {
                    row.remove();
                }
                alert(data.message || 'Bonus Hunt deleted successfully');
            } else {
                // Para outras ações, recarregue a página
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

        bonusTable.addEventListener('keypress', function (e) {
            if (e.target.classList.contains('payout-input') && e.key === 'Enter') {
                handlePayoutSubmit(e);
            }
        });
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

// Função para lidar com a submissão de payout
function handlePayoutSubmit(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const bonusId = input.dataset.bonusId;
        const payout = input.value.trim();

        updatePayout(bonusId, payout);
    }
}

// Função para atualizar o payout
function updatePayout(bonusId, payout) {
    fetch(`/bonus-hunts/update_payout/${bonusId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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

// Função para atualizar a tabela de bônus
function updateBonusTable(hunt) {
    const rows = document.querySelectorAll('#bonus-table tbody tr');
    rows.forEach(row => {
        const bonusId = row.dataset.bonusId;
        const bonus = hunt.bonuses.find(b => b.id.toString() === bonusId);
        if (bonus) {
            row.classList.toggle('active-bonus', bonus.id === hunt.bonus_atual_id);
            const playButton = row.querySelector('.play-bonus-btn');
            playButton.classList.toggle('btn-success', bonus.id === hunt.bonus_atual_id);
            playButton.classList.toggle('btn-secondary', bonus.id !== hunt.bonus_atual_id);

            // Atualizar aposta
            row.querySelector('td:nth-child(3)').textContent = `€${bonus.aposta.toFixed(2)}`;

            // Atualizar payout
            const payoutCell = row.querySelector('.payout-cell');
            if (bonus.id === hunt.bonus_atual_id) {
                payoutCell.innerHTML = `<input type="number" step="0.01" name="payout" value="${bonus.payout !== null ? bonus.payout : ''}" class="form-control payout-input" data-bonus-id="${bonus.id}">`;
                const payoutInput = payoutCell.querySelector('.payout-input');
                payoutInput.addEventListener('keypress', handlePayoutSubmit);
                payoutInput.focus();
            } else {
                payoutCell.textContent = bonus.payout !== null ? `€${bonus.payout.toFixed(2)}` : 'N/A';
            }
            payoutCell.setAttribute('data-remaining-balance', bonus.saldo_restante || '');

            // Atualizar multiplicador
            row.querySelector('td:nth-child(5)').textContent = bonus.payout !== null ? `${bonus.multiplicador.toFixed(2)}x` : 'N/A';

            // Atualizar nota
            row.querySelector('td:nth-child(6)').textContent = bonus.nota || '';

            // Atualizar padrinho
            row.querySelector('td:nth-child(7)').textContent = bonus.padrinho || 'N/A';
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
                    updateBonusTable(data.hunt);
                    appendNewBonusRow(data.newBonus);
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
    document.getElementById('edit-bet').value = row.querySelector('td:nth-child(3)').textContent.replace('€', '').trim();
    document.getElementById('edit-payout').value = row.querySelector('td:nth-child(4)').textContent.replace('N/A', '').replace('€', '').trim();
    document.getElementById('edit-remaining-balance').value = row.querySelector('td:nth-child(4)').getAttribute('data-remaining-balance') || '';
    document.getElementById('edit-note').value = row.querySelector('td:nth-child(6)').textContent;
    document.getElementById('edit-padrinho').value = row.querySelector('td:nth-child(7)').textContent.replace('N/A', '');

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
                removeBonusRow(bonusId);  // Remove the deleted bonus row from the UI

                // Ensure no further interactions with the deleted bonus
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
    document.getElementById('break-even-x-inicial').textContent = formatBreakEven(hunt.estatisticas.break_even_x_inicial);
    document.getElementById('break-even-euro-inicial').textContent = formatCurrency(hunt.estatisticas.break_even_euro_inicial);
    document.getElementById('break-even-x').textContent = formatBreakEven(hunt.estatisticas.break_even_x);
    document.getElementById('break-even-euro').textContent = formatCurrency(hunt.estatisticas.break_even_euro);
    document.getElementById('avg-x').textContent = formatBreakEven(hunt.estatisticas.avg_x);
    document.getElementById('avg-euro').textContent = formatCurrency(hunt.estatisticas.avg_euro);

    updateBestWorstSlots(hunt.estatisticas);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatBreakEven(value) {
    if (value === "Infinity" || value === Infinity) {
        return '∞';
    }
    return value.toString() + 'x';
}


function updateBestWorstSlots(estatisticas) {
    document.getElementById('best-slot-x').textContent = estatisticas.best_bonus_x ?
        `${estatisticas.best_bonus_x.slot.name} - ${estatisticas.best_bonus_x.multiplicador.toFixed(2)}x` : 'N/A';
    document.getElementById('best-slot-euro').textContent = estatisticas.best_bonus_euro ?
        `${estatisticas.best_bonus_euro.slot.name} - ${formatCurrency(estatisticas.best_bonus_euro.payout)}` : 'N/A';
    document.getElementById('worst-slot-x').textContent = estatisticas.worst_bonus_x ?
        `${estatisticas.worst_bonus_x.slot.name} - ${estatisticas.worst_bonus_x.multiplicador.toFixed(2)}x` : 'N/A';
    document.getElementById('worst-slot-euro').textContent = estatisticas.worst_bonus_euro ?
        `${estatisticas.worst_bonus_euro.slot.name} - ${formatCurrency(estatisticas.worst_bonus_euro.payout)}` : 'N/A';
}

function appendNewBonusRow(bonus) {
    const bonusTable = document.querySelector('#bonus-table tbody');
    if (bonusTable) {
        const newRow = document.createElement('tr');
        newRow.dataset.bonusId = bonus.id;
        newRow.innerHTML = `
            <td>${bonusTable.children.length + 1}</td>
            <td>
                <div style="display: flex; align-items: center;">
                    <img src="${bonus.slot.image}" alt="${bonus.slot.name}" style="width: 50px; height: 50px; margin-right: 10px;" />
                    <div>
                        ${bonus.slot.name}<br>
                        <small><i>${bonus.slot.provider}</i></small>
                    </div>
                </div>
            </td>
            <td>€${bonus.aposta.toFixed(2)}</td>
            <td class="payout-cell">${bonus.payout !== null ? '€' + bonus.payout.toFixed(2) : 'N/A'}</td>
            <td>${bonus.multiplicador !== null ? bonus.multiplicador.toFixed(2) + 'x' : 'N/A'}</td>
            <td>${bonus.nota || ''}</td>
            <td>${bonus.padrinho || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-primary play-bonus-btn" data-bonus-id="${bonus.id}">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn btn-sm btn-secondary edit-bonus-btn" data-bonus-id="${bonus.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-bonus-btn" data-bonus-id="${bonus.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        bonusTable.appendChild(newRow);
        setupEditBonusButtons();
        setupDeleteBonusButtons();
    }
}

function removeBonusRow(bonusId) {
    const row = document.querySelector(`tr[data-bonus-id="${bonusId}"]`);
    if (row) {
        row.remove();
    }
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
                            });

                            suggestionsBox.appendChild(suggestionItem);
                        });

                        new LazyLoad({
                            elements_selector: ".lazyload"
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching slot suggestions:', error);
                        suggestionsBox.innerHTML = '<div class="list-group-item">Error fetching suggestions. Please try again.</div>';
                    });
            }
        });
    }

    document.addEventListener('click', function (e) {
        if (suggestionsBox && !suggestionsBox.contains(e.target) && e.target !== slotSearch) {
            suggestionsBox.innerHTML = '';
        }
    });
}

// Função para lidar com erros
function handleError(message) {
    console.error(message);
    alert(message);
}