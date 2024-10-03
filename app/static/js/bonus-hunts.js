document.addEventListener('DOMContentLoaded', function () {
    // Funções comuns a todas as páginas
    setupCreateHuntForm();
    setupHuntActions();
    setupEditHuntButtons();
    setupHuntPhaseSelect();

    if (typeof Sortable === 'undefined') {
        console.error('Sortable library is not loaded. Some features may not work correctly.');
    }

    const huntDataElement = document.getElementById('hunt-data');
    let huntData = null; // Definir huntData fora do bloco de if para estar acessível em todo o escopo

    if (huntDataElement && huntDataElement.dataset.hunt) {
        try {
            huntData = JSON.parse(huntDataElement.dataset.hunt); // Atribuir valor a huntData
            updateStatistics(huntData);
            updateBonusTable(huntData);
        } catch (error) {
            console.error("Erro ao analisar JSON:", error);
        }
    } else {
        console.error("O elemento hunt-data não contém JSON válido.");
    }

    const bonusTable = document.getElementById('bonus-table');
    if (bonusTable) {
        bonusTable.addEventListener('keydown', function (e) {
            if (e.target.classList.contains('payout-input')) {
                handlePayoutInput(e);
            }
        });
    }

    // Verifica se estamos na página de visualização de um Bonus Hunt individual
    if (document.querySelector('.bonus-hunt-view') && huntData) { // Garantir que huntData existe
        updateStatistics(huntData);
        updateBonusTable(huntData);
        setupBonusActions();
        setupSaveBonusEdit();
        setupAddBonusForm();
        setupAddNewSlotButton();
        setupSlotSearch();
        initProviderSuggestions();
        setupSortableTable();
        setupDraggableRows();
        setupPayoutInputs();
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

function setupPayoutInputs() {
    document.addEventListener('focus', function (event) {
        const target = event.target;
        if (target.classList.contains('payout-input')) {
            target.style.display = 'inline-block';
        }
    }, true);
}

function setupSortableTable() {
    const table = document.getElementById('bonus-table');
    const headers = table.querySelectorAll('th.sortable');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sort;
            const isAscending = header.classList.contains('asc');

            sortTable(sortBy, !isAscending);

            headers.forEach(h => h.classList.remove('asc', 'desc'));
            header.classList.add(isAscending ? 'desc' : 'asc');
        });
    });
}

function sortTable(sortBy, ascending) {
    const tbody = document.getElementById('bonus-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        let aValue = a.querySelector(`td[data-${sortBy}]`).dataset[sortBy];
        let bValue = b.querySelector(`td[data-${sortBy}]`).dataset[sortBy];

        if (sortBy === 'bet' || sortBy === 'payout') {
            aValue = parseFloat(aValue) || 0;
            bValue = parseFloat(bValue) || 0;
        } else if (sortBy === 'multiplier') {
            aValue = parseFloat(aValue.replace('x', '')) || 0;
            bValue = parseFloat(bValue.replace('x', '')) || 0;
        }

        if (aValue < bValue) return ascending ? -1 : 1;
        if (aValue > bValue) return ascending ? 1 : -1;
        return 0;
    });
    rows.forEach(row => tbody.appendChild(row));

    // Atualizar a ordem no backend e no hunt-data local
    const newOrder = rows.map(row => row.dataset.bonusId);
    const huntId = document.getElementById('hunt-phase').dataset.huntId;

    fetch(`/bonus-hunts/${huntId}/update_bonus_order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ order: newOrder }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Bonus order updated successfully');
                // Atualizar os dados do hunt localmente
                const huntDataElement = document.getElementById('hunt-data');
                let huntData = JSON.parse(huntDataElement.textContent);
                huntData.bonus_order = newOrder.join(',');
                huntData.bonuses.sort((a, b) => newOrder.indexOf(a.id.toString()) - newOrder.indexOf(b.id.toString()));
                huntDataElement.textContent = JSON.stringify(huntData);
            } else {
                console.error('Failed to update bonus order:', data.error);
            }
        })
        .catch(error => console.error('Error updating bonus order:', error));
}

function setupDraggableRows() {
    if (typeof Sortable === 'undefined') {
        console.error('Sortable library is not loaded');
        return;
    }

    const tbody = document.getElementById('bonus-tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    new Sortable(tbody, {
        animation: 150,
        handle: '.drag-handle',  // Use a handle for dragging
        onEnd: function (evt) {
            // Get the new order of bonus IDs
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const newOrder = rows.map(row => row.dataset.bonusId);

            // Call updateBonusOrder with the new order
            updateBonusOrder(newOrder);
        }
    });
}

function updateBonusOrder(bonusOrder) {
    // Get hunt_id from the #hunt-phase element
    const huntId = document.querySelector('#hunt-phase').dataset.huntId;

    if (!huntId) {
        console.error('Hunt ID is undefined');
        return;
    }

    fetch(`/bonus-hunts/${huntId}/update_bonus_order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: bonusOrder }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Bonus order updated successfully');
            } else {
                throw new Error(data.error || 'Failed to update bonus order');
            }
        })
        .catch(error => {
            console.error('Error updating bonus order:', error);
            alert('Failed to update bonus order: ' + error.message);
        });
}

function setupHuntPhaseSelect() {
    const phaseSelect = document.getElementById('hunt-phase');
    if (!phaseSelect) return;

    phaseSelect.addEventListener('change', function () {
        const huntId = this.dataset.huntId;
        const newPhase = this.value;

        fetch(`/bonus-hunts/${huntId}/update-phase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ phase: newPhase })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Hunt phase updated successfully');
                updateUIForPhase(data.hunt);
                updateAddBonusForm(data.hunt);
                updateBonusTable(data.hunt);
                updateStatistics(data.hunt);
            } else {
                console.error('Failed to update hunt phase:', data.error);
                alert(`Failed to update hunt phase: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error updating hunt phase:', error);
            alert('An error occurred while updating the hunt phase. Please try again.');
        });
    });
}

function updateUIForPhase(hunt) {
    console.log('Updating UI for phase:', hunt.phase);
    const bonusTable = document.getElementById('bonus-table');
    if (!bonusTable) {
        console.error('Bonus table not found');
        return;
    }

    const playButtons = bonusTable.querySelectorAll('.play-bonus-btn');
    const payoutCells = bonusTable.querySelectorAll('.payout-cell');
    const bonusRows = bonusTable.querySelectorAll('tr[data-bonus-id]');

    switch (hunt.phase) {
        case 'hunting':
            playButtons.forEach(btn => {
                btn.style.display = 'none';
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-success');
            });
            payoutCells.forEach(cell => {
                const input = cell.querySelector('.payout-input');
                if (input) {
                    input.style.display = 'none';
                    input.disabled = true;
                }
                const payoutText = cell.querySelector('.payout-text');
                if (payoutText) {
                    payoutText.style.display = 'inline';
                }
            });
            // Deactivate all bonuses
            bonusRows.forEach(row => {
                row.classList.remove('active-bonus');
            });
            // Reset the active bonus
            hunt.bonus_atual_id = null;
            fetch(`/bonus-hunts/${hunt.id}/reset-active-bonus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }).then(response => response.json())
              .then(data => {
                  if (data.success) {
                      console.log('Active bonus reset successfully');
                  }
              });
            setupDraggableRows();
            break;

        case 'opening':
            playButtons.forEach(btn => btn.style.display = 'inline-block');
            payoutCells.forEach(cell => {
                const input = cell.querySelector('.payout-input');
                if (input) {
                    input.style.display = 'inline-block';
                    input.disabled = false;
                }
                const payoutText = cell.querySelector('.payout-text');
                if (payoutText) {
                    payoutText.style.display = 'none';
                }
            });
            // Activate the first unpaid bonus
            const firstUnpaidBonus = Array.from(bonusRows).find(row => {
                const payoutCell = row.querySelector('.payout-cell');
                return payoutCell && !payoutCell.textContent.trim();
            });
            if (firstUnpaidBonus) {
                const firstUnpaidBonusId = firstUnpaidBonus.dataset.bonusId;
                activateBonus(firstUnpaidBonusId);
            } else {
                // If all bonuses are paid, activate the first one
                const firstBonusRow = bonusRows[0];
                if (firstBonusRow) {
                    const firstBonusId = firstBonusRow.dataset.bonusId;
                    activateBonus(firstBonusId);
                }
            }
            if (typeof Sortable !== 'undefined') {
                const tbody = document.getElementById('bonus-tbody');
                const sortableInstance = Sortable.get(tbody);
                if (sortableInstance) {
                    sortableInstance.destroy();
                }
            }
            break;

        case 'ended':
            playButtons.forEach(btn => btn.style.display = 'none');
            payoutCells.forEach(cell => {
                const input = cell.querySelector('.payout-input');
                if (input) {
                    input.style.display = 'none';
                    input.disabled = true;
                }
                const payoutText = cell.querySelector('.payout-text');
                if (payoutText) {
                    payoutText.style.display = 'inline';
                }
            });
            // Deactivate all bonuses
            bonusRows.forEach(row => {
                row.classList.remove('active-bonus');
            });
            if (typeof Sortable !== 'undefined') {
                const tbody = document.getElementById('bonus-tbody');
                const sortableInstance = Sortable.get(tbody);
                if (sortableInstance) {
                    sortableInstance.destroy();
                }
            }
            break;

        default:
            console.error('Unknown hunt phase:', hunt.phase);
    }

    // Update the hunt-data
    const huntDataElement = document.getElementById('hunt-data');
    if (huntDataElement) {
        huntDataElement.dataset.hunt = JSON.stringify(hunt);
    }
}

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
    }
}

function handlePayoutInput(e) {
    console.log('Tecla pressionada:', e.key);  // Log para depuração
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const bonusId = input.dataset.bonusId;
        const payout = input.value.trim();

        console.log(`Submetendo payout para o bônus ${bonusId}: ${payout}`);

        updatePayout(bonusId, payout)
            .then(() => {
                console.log(`Payout atualizado com sucesso para o bônus ${bonusId}`);
            })
            .catch(error => {
                console.error('Erro ao atualizar payout:', error);
                alert('Erro ao atualizar payout: ' + error.message);
            });
    } else if (e.key === 'Escape') {
        e.preventDefault();
        const input = e.target;
        input.blur();

        const bonusId = input.dataset.bonusId;
        handleDeactivateBonus(bonusId);
    }
}

function activateNextBonus() {
    const huntData = JSON.parse(document.getElementById('hunt-data').textContent);
    const orderedBonuses = huntData.bonuses.sort((a, b) => a.order - b.order);
    const currentIndex = orderedBonuses.findIndex(b => b.id === huntData.bonus_atual_id);
    if (currentIndex < orderedBonuses.length - 1) {
        const nextBonus = orderedBonuses[currentIndex + 1];
        activateBonus(nextBonus.id);
    }
}

function activateBonus(bonusId) {
    console.log(`Activating bonus: ${bonusId}`);
    fetch(`/bonus-hunts/activate_bonus/${bonusId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`Bonus ${bonusId} activated successfully`);
            const huntDataElement = document.getElementById('hunt-data');
            if (huntDataElement) {
                huntDataElement.dataset.hunt = JSON.stringify(data.hunt);
            }

            updateBonusTable(data.hunt);
            focusPayoutInput(bonusId);
        } else {
            throw new Error(data.error || 'Failed to activate the bonus');
        }
    })
    .catch(error => {
        console.error('Error activating the bonus:', error);
        alert('Failed to activate the bonus: ' + error.message);
    });
}

function deactivateBonus(bonusId) {
    fetch(`/bonus-hunts/deactivate_bonus/${bonusId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Bonus with ID ${bonusId} deactivated`);

                // Remover a classe 'active-bonus' da linha correspondente
                const row = document.querySelector(`tr[data-bonus-id="${bonusId}"]`);
                if (row) {
                    row.classList.remove('active-bonus');
                }

                // Esconder o campo de payout para o bônus desativado
                const payoutInput = row.querySelector('.payout-input');
                if (payoutInput) {
                    payoutInput.value = ''; // Limpar o valor
                    payoutInput.style.display = 'none'; // Esconder o campo
                    payoutInput.focus();
                }

                // Atualizar a tabela para refletir as mudanças
                updateBonusTable(data.hunt);
            } else {
                console.error('Failed to deactivate bonus:', data.error);
            }
        })
        .catch(error => console.error('Erro ao desativar o bónus:', error));
}

function handlePlayBonus(e) {
    const button = e.target.closest('.play-bonus-btn');
    const bonusId = button.dataset.bonusId;
    const row = button.closest('tr');
    const isCurrentlyActive = row.classList.contains('active-bonus');

    const url = isCurrentlyActive ?
        `/bonus-hunts/deactivate_bonus/${bonusId}` :
        `/bonus-hunts/activate_bonus/${bonusId}`;

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Resposta do servidor:', data);

                const huntDataElement = document.getElementById('hunt-data');
                if (huntDataElement) {
                    huntDataElement.dataset.hunt = JSON.stringify(data.hunt);
                }

                updateBonusTable(data.hunt);
                focusPayoutInput(bonusId);
                updateStatistics(data.hunt);

                console.log(`Bônus ${bonusId} ${isCurrentlyActive ? 'desativado' : 'ativado'}`);
            } else {
                throw new Error(data.error || 'Falha ao atualizar o status do bônus');
            }
        })
        .catch(error => {
            console.error('Erro ao atualizar o status do bônus:', error);
            alert('Erro ao atualizar o status do bônus: ' + error.message);
        });
}

function updateSingleBonus(hunt, bonusId) {
    const row = document.querySelector(`tr[data-bonus-id="${bonusId}"]`);
    if (!row) {
        console.error(`Linha para o bônus ${bonusId} não encontrada`);
        return;
    }

    const bonus = hunt.bonuses.find(b => b.id === parseInt(bonusId));
    if (!bonus) {
        console.error(`Bônus ${bonusId} não encontrado nos dados do hunt`);
        return;
    }

    const isActive = bonus.id === hunt.bonus_atual_id;
    console.log(`Atualizando bônus ${bonusId}, ativo: ${isActive}`);

    // Atualizar a linha do bônus
    updateBonusRow(row, bonus, hunt, isActive);

    // Atualizar o estado ativo de todas as linhas
    document.querySelectorAll('#bonus-tbody tr').forEach(r => {
        const rowBonusId = r.dataset.bonusId;
        const isActiveRow = rowBonusId === String(hunt.bonus_atual_id);
        r.classList.toggle('active-bonus', isActiveRow);
        const playBtn = r.querySelector('.play-bonus-btn');
        if (playBtn) {
            playBtn.classList.toggle('btn-outline-success', !isActiveRow);
            playBtn.classList.toggle('btn-success', isActiveRow);
        }

        // Atualizar o campo de payout apenas para o bônus atual
        if (rowBonusId === bonusId) {
            const payoutCell = r.querySelector('.payout-cell');
            if (payoutCell) {
                if (isActiveRow && hunt.phase === 'opening') {
                    let payoutInput = payoutCell.querySelector('.payout-input');
                    if (!payoutInput) {
                        payoutCell.innerHTML = `
                            <input type="number" step="0.01" name="payout" 
                                   value="${bonus.payout || ''}" 
                                   class="form-control payout-input" 
                                   data-bonus-id="${bonus.id}">
                        `;
                        payoutInput = payoutCell.querySelector('.payout-input');
                        payoutInput.addEventListener('keydown', handlePayoutInput);
                    } else {
                        payoutInput.value = bonus.payout || '';
                        payoutInput.style.display = 'block';
                    }
                } else {
                    payoutCell.innerHTML = bonus.payout ? formatCurrency(bonus.payout) : '';
                }
            }
        }
    });
}

function focusPayoutInput(bonusId) {
    setTimeout(() => {
        const payoutInput = document.querySelector(`.payout-input[data-bonus-id="${bonusId}"]`);
        if (payoutInput) {
            payoutInput.focus();
            payoutInput.select();  // Isso selecionará todo o texto no input
        }
    }, 100);  // Pequeno delay para garantir que o DOM foi atualizado
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
    console.log(`Desativando bônus: ${bonusId}`);
    fetch(`/bonus-hunts/deactivate_bonus/${bonusId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Bônus desativado:', bonusId);

                const huntDataElement = document.getElementById('hunt-data');
                if (huntDataElement) {
                    huntDataElement.dataset.hunt = JSON.stringify(data.hunt);
                }

                updateBonusTable(data.hunt);
                updateStatistics(data.hunt);
            } else {
                throw new Error(data.error || 'Falha ao desativar o bônus');
            }
        })
        .catch(error => {
            console.error('Erro ao desativar o bônus:', error);
            alert('Erro ao desativar o bônus: ' + error.message);
        });
}

function updatePayout(bonusId, payout) {
    console.log(`Iniciando atualização de payout para o bônus ${bonusId}`);
    return fetch(`/bonus-hunts/update_payout/${bonusId}`, {
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
                console.log(`Payout atualizado com sucesso para o bônus ${bonusId}`);
                const huntDataElement = document.getElementById('hunt-data');
                if (huntDataElement) {
                    huntDataElement.dataset.hunt = JSON.stringify(data.hunt);
                }

                updateBonusTable(data.hunt);
                updateStatistics(data.hunt);

                if (data.next_bonus_id) {
                    console.log(`Ativando próximo bônus: ${data.next_bonus_id}`);
                    activateBonus(data.next_bonus_id);
                }
                return data;
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        });
}

function updateBonusTable(hunt) {
    console.log('Atualizando tabela de bônus:', hunt);
    const tbody = document.getElementById('bonus-tbody');
    if (!tbody) {
        console.error('Tabela de bônus não encontrada');
        return;
    }

    hunt.bonuses.forEach(bonus => {
        let row = tbody.querySelector(`tr[data-bonus-id="${bonus.id}"]`);
        if (!row) {
            console.log(`Criando nova linha para o bônus ${bonus.id}`);
            row = document.createElement('tr');
            row.dataset.bonusId = bonus.id;
            tbody.appendChild(row);
        }
        const isActive = bonus.id === hunt.bonus_atual_id;
        updateBonusRow(row, bonus, hunt, isActive);
    });

    // Remover linhas de bônus que não existem mais
    Array.from(tbody.children).forEach(row => {
        const bonusId = row.dataset.bonusId;
        if (!hunt.bonuses.some(b => b.id === parseInt(bonusId))) {
            console.log(`Removendo linha do bônus ${bonusId}`);
            row.remove();
        }
    });
    updateAddBonusForm(hunt);
}

function updateBonusRow(row, bonus, hunt, isActive) {
    row.dataset.bonusId = bonus.id;
    row.innerHTML = `
        <td class="slot-col">
            <div class="slot-info">
                <span class="drag-handle" style="cursor: move;">&#9776;</span>
                <img src="${bonus.slot.image}" alt="${bonus.slot.name}">
                <div class="slot-text">
                    <span class="slot-name">${bonus.slot.name}</span>
                    <small>${bonus.slot.provider}</small>
                </div>
            </div>
        </td>
        <td class="bet-col" data-bet="${bonus.aposta}">${formatCurrency(bonus.aposta)}</td>
        <td class="payout-cell" data-payout="${bonus.payout || ''}">
            <input type="number" step="0.01" name="payout" value="${bonus.payout || ''}"
                class="form-control payout-input" data-bonus-id="${bonus.id}" 
                style="display: ${hunt.phase === 'opening' && isActive ? 'inline-block' : 'none'};">
            <span class="payout-text">${bonus.payout ? formatCurrency(bonus.payout) : ''}</span>
        </td>
        <td class="multiplier-col" data-multiplier="${bonus.multiplicador || ''}">
            ${bonus.multiplicador ? formatMultiplier(bonus.multiplicador) : ''}
        </td>
        <td class="notes-col">${bonus.nota || ''}</td>
        <td class="padrinho-col">${bonus.padrinho || ''}</td>
        <td class="actions-col">
            <button class="btn btn-sm action-btn ${isActive ? 'btn-success' : 'btn-outline-success'} play-bonus-btn"
                data-bonus-id="${bonus.id}">
                <i class="fas fa-play"></i>
            </button>
            <button class="btn btn-sm action-btn btn-primary edit-bonus-btn"
                data-bonus-id="${bonus.id}">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm action-btn btn-danger delete-bonus-btn"
                data-bonus-id="${bonus.id}">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    // Configurar visibilidade do input e texto de payout
    const payoutCell = row.querySelector('.payout-cell');
    const payoutInput = payoutCell.querySelector('.payout-input');
    const payoutText = payoutCell.querySelector('.payout-text');

    if (hunt.phase === 'opening' && isActive) {
        payoutInput.style.display = 'inline-block';
        payoutText.style.display = 'none';
        payoutInput.disabled = false;
        payoutInput.addEventListener('keydown', handlePayoutInput);
    } else {
        payoutInput.style.display = 'none';
        payoutText.style.display = 'inline';
        payoutInput.disabled = true;
    }

    const playButton = row.querySelector('.play-bonus-btn');
    if (playButton) {
        playButton.classList.toggle('btn-outline-success', !isActive);
        playButton.classList.toggle('btn-success', isActive);
    }

    row.classList.toggle('active-bonus', isActive);
}

function getCurrentPhase() {
    const phaseSelect = document.getElementById('hunt-phase');
    return phaseSelect ? phaseSelect.value : 'hunting';
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

function resetActiveBonus(huntId) {
    fetch(`/bonus-hunts/${huntId}/reset-active-bonus`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Active bonus reset successfully');
        } else {
            console.error('Failed to reset active bonus:', data.error);
        }
    })
    .catch(error => {
        console.error('Error resetting active bonus:', error);
    });
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
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Novo bônus adicionado:', data.newBonus);

                // Atualizar o elemento hunt-data
                const huntDataElement = document.getElementById('hunt-data');
                if (huntDataElement) {
                    huntDataElement.dataset.hunt = JSON.stringify(data.hunt);
                } else {
                    console.error("Elemento hunt-data não encontrado.");
                }

                // Atualizar a tabela de bônus
                updateBonusTable(data.hunt);

                // Atualizar estatísticas
                updateStatistics(data.hunt);

                form.reset();
            } else {
                throw new Error(data.error || 'Erro desconhecido ocorreu');
            }
        })
        .catch(error => {
            console.error('Erro ao adicionar bônus:', error);
            alert('Erro ao adicionar bônus: ' + error.message);
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
    const betValue = extractNumber(row.querySelector('[data-bet]').textContent);
    document.getElementById('edit-bet').value = betValue;

    // Obter e definir o valor do payout
    const payoutCell = row.querySelector('.payout-cell');
    const payoutValue = payoutCell.querySelector('input') ?
        payoutCell.querySelector('input').value :
        extractNumber(payoutCell.textContent);
    document.getElementById('edit-payout').value = payoutValue;

    // Obter e definir o saldo restante (se aplicável)
    const remainingBalance = payoutCell.getAttribute('data-remaining-balance');
    const editRemainingBalance = document.getElementById('edit-remaining-balance');
    if (editRemainingBalance) {
        editRemainingBalance.value = remainingBalance || '';
    }

    // Obter e definir a nota
    document.getElementById('edit-note').value = row.querySelector('td:nth-child(5)').textContent.trim();

    // Obter e definir o padrinho
    document.getElementById('edit-padrinho').value = row.querySelector('td:nth-child(6)').textContent.trim();

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
    const elementsToUpdate = {
        'status': hunt.is_active ? 'Active' : 'Inactive',
        'custo-inicial': formatCurrency(hunt.custo_inicial),
        'investimento': formatCurrency(hunt.estatisticas.investimento),
        'saldo-restante': formatCurrency(hunt.estatisticas.saldo_restante),
        'total-ganho': formatCurrency(hunt.estatisticas.total_ganho),
        'lucro-prejuizo': formatCurrency(hunt.estatisticas.lucro_prejuizo),
        'num-bonus': hunt.estatisticas.num_bonus,
        'num-bonus-abertos': hunt.estatisticas.num_bonus_abertos,
        'media-aposta-inicial': formatCurrency(hunt.estatisticas.media_aposta_inicial),
        'media-aposta': formatCurrency(hunt.estatisticas.media_aposta),
        'break-even-x-inicial': formatMultiplier(hunt.estatisticas.break_even_x_inicial),
        'break-even-euro-inicial': formatCurrency(hunt.estatisticas.break_even_euro_inicial),
        'break-even-x': formatMultiplier(hunt.estatisticas.break_even_x),
        'break-even-euro': formatCurrency(hunt.estatisticas.break_even_euro),
        'avg-x': formatMultiplier(hunt.estatisticas.avg_x),
        'avg-euro': formatCurrency(hunt.estatisticas.avg_euro)
    };

    // Iterar sobre os elementos a serem atualizados e verificar se eles existem
    for (const [id, value] of Object.entries(elementsToUpdate)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Elemento com ID "${id}" não foi encontrado no DOM.`);
        }
    }

    updateBestWorstSlots(hunt.estatisticas);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatMultiplier(value) {
    return `${value.toFixed(2)}x`;
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

function appendNewBonusRow(newBonus, hunt) {
    const tbody = document.getElementById('bonus-tbody');
    if (!tbody) {
        console.error('Tabela de bônus não encontrada');
        return;
    }

    const row = document.createElement('tr');
    row.dataset.bonusId = newBonus.id;
    updateBonusRow(row, newBonus, hunt, false);  // false porque o novo bônus não deve estar ativo

    // Inserir a nova linha no topo da tabela
    tbody.insertBefore(row, tbody.firstChild);

    console.log(`Nova linha de bônus adicionada: ${newBonus.id}`);

    // Destaque temporário para a nova linha
    row.style.backgroundColor = '#ffff99';
    setTimeout(() => {
        row.style.backgroundColor = '';
    }, 2000);
}

function getCurrentHuntData() {
    const huntDataElement = document.getElementById('hunt-data');
    if (huntDataElement && huntDataElement.dataset.hunt) {
        try {
            return JSON.parse(huntDataElement.dataset.hunt);
        } catch (error) {
            console.error('Erro ao analisar os dados do hunt JSON:', error);
        }
    }
    console.warn('hunt-data não está disponível ou está vazio.');
    return null;
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
    suggestionItem.addEventListener('click', function (e) {
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
            addNewSlotBtn.addEventListener('click', function () {
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

function updateAddBonusForm(hunt) {
    if (!hunt || typeof hunt !== 'object' || !hunt.phase) {
        console.error('Invalid hunt object passed to updateAddBonusForm');
        return;
    }

    const addBonusForm = document.getElementById('add-bonus-form');
    if (addBonusForm) {
        addBonusForm.style.display = hunt.phase === 'hunting' ? 'block' : 'none';
    } else {
        console.error('Add bonus form not found');
    }
}

function setupAddNewSlotButton() {
    const addNewSlotBtn = document.getElementById('addNewSlotBtn');
    if (addNewSlotBtn) {
        addNewSlotBtn.addEventListener('click', function () {
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
        slotForm.addEventListener('submit', function (e) {
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