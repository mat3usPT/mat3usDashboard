// GLOBALS

const VISIBLE_SLOTS_COUNT = 8;
let currentHuntData;
let visibleSlots = [];
let bestWinSlot = null;
let bestWinUpdateTimeout = null;
let socket;


// INIT

document.addEventListener('DOMContentLoaded', initialize);


function initialize() {
    initializeSocket();
    if (document.getElementById('slot-carousel')) {
        initializeCarousel();
    }
    fetchCurrentHunt();
}


function initializeSocket() {
    try {
        socket = io('/widgets');

        socket.on('connect', () => {
            console.log('Connected to WebSocket');
        });

        socket.on('bonus_hunt_update', (data) => {
            console.log('Received update event', data);
            if (data && data.data) {
                updateOverlay(data.data);
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket');
        });
    } catch (error) {
        console.error('Failed to initialize socket:', error);
    }
}

function fetchCurrentHunt() {
    fetch('/widgets/overlay/data')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch overlay data');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error(data.error);
            } else {
                updateOverlay(data);
            }
        })
        .catch(error => console.error('Error fetching overlay data:', error));
}


// MAIN UPDATE

function updateOverlay(huntData) {
    console.log('Updating overlay with hunt data:', huntData);
    currentHuntData = huntData;

    if (!huntData || !huntData.estatisticas || !huntData.bonuses) {
        console.error('Invalid hunt data');
        return;
    }

    const overlay = document.querySelector('.bonus-hunt-overlay');
    overlay.className = `bonus-hunt-overlay ${huntData.phase}-mode`;

    updateHuntInfo(huntData);
    updateStatistics(huntData.estatisticas, huntData.phase);
    updateProgressBar(huntData.estatisticas);

    const bestWinContainer = document.getElementById('best-win-container');
    if (bestWinContainer) {
        bestWinContainer.style.display = huntData.phase === 'opening' ? 'block' : 'none';
    }

    switch (huntData.phase) {
        case 'hunting':
            updateHuntingPhase(huntData);
            break;
        case 'opening':
            updateOpeningPhase(huntData);
            break;
        case 'ended':
            updateEndedPhase(huntData);
            break;
    }
}


// COMMON UPDATE

function updateHuntInfo(huntData) {
    document.getElementById('hunt-name').textContent = huntData.nome.toUpperCase() || 'N/A';
}

function updateStatistics(stats, phase) {
    const statLabels = {
        hunting: [
            'START',
            'TARGET',
            'B/E X',
            'BONUSES',
        ],
        opening: [
            'TARGET',
            'TOTAL',
            'INITIAL BE X',
            'OPEN BE X',
            'AVG X',
            'BONUSES'
        ],
        ended: [
            'INITIAL BALANCE',
            'TOTAL WON',
            'PROFIT',
            'ROI',
            'BONUSES'
        ]
    };

    const statValues = {
        hunting: [
            formatCurrency(stats.custo_inicial),
            formatCurrency(stats.investimento),
            formatMultiplier(stats.break_even_x_inicial),
            `${stats.num_bonus}`,
        ],
        opening: [
            formatCurrency(stats.investimento),
            formatCurrency(stats.total_ganho),
            formatMultiplier(stats.break_even_x_inicial),
            formatMultiplier(stats.break_even_x),
            formatMultiplier(stats.avg_x),
            `${stats.num_bonus_abertos} / ${stats.num_bonus}`
        ],
        ended: [
            formatCurrency(stats.custo_inicial),
            formatCurrency(stats.total_ganho),
            formatCurrency(stats.lucro_prejuizo),
            `${((stats.lucro_prejuizo / stats.custo_inicial) * 100).toFixed(2)}%`,
            `${stats.num_bonus_abertos} / ${stats.num_bonus}`
        ]
    };

    const labels = statLabels[phase] || statLabels.hunting;
    const values = statValues[phase] || statValues.hunting;

    // Limpar todas as estatísticas primeiro
    for (let i = 1; i <= 5; i++) {
        const labelElement = document.getElementById(`stat-label-${i}`);
        const valueElement = document.getElementById(`stat-value-${i}`);
        
        if (labelElement && valueElement) {
            labelElement.textContent = '';
            valueElement.textContent = '';
        }
    }

    // Preencher com as novas estatísticas
    labels.forEach((label, index) => {
        const labelElement = document.getElementById(`stat-label-${index + 1}`);
        const valueElement = document.getElementById(`stat-value-${index + 1}`);
        
        if (labelElement && valueElement) {
            labelElement.textContent = label;
            valueElement.textContent = values[index] || '';
        } else {
            console.warn(`Element for stat ${index + 1} not found`);
        }
    });
}

function updateProgressBar(stats) {
    const progressPercentage = (stats.num_bonus_abertos / stats.num_bonus) * 100;
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.width = `${progressPercentage}%`;
}


// HUNTING PHASE

function updateHuntingPhase(huntData) {
    const bonusCardsContainer = document.getElementById('bonus-cards-container');
    bonusCardsContainer.innerHTML = ''; // Limpar o conteúdo existente

    // Ordenar os bônus por ordem decrescente (mais recentes primeiro)
    const sortedBonuses = huntData.bonuses.sort((a, b) => b.order - a.order);

    // Exibir os últimos 8 bônus adicionados
    const visibleBonuses = sortedBonuses.slice(0, VISIBLE_SLOTS_COUNT);

    visibleBonuses.forEach((bonus, index) => {
        const bonusCard = createHuntingBonusCard(bonus, index === 0);
        bonusCardsContainer.appendChild(bonusCard);
    });

    // Se um novo bônus foi adicionado, animar o scroll
    if (visibleBonuses.length > 0 && visibleBonuses[0].id !== visibleSlots[0]?.id) {
        scrollToNewBonus(bonusCardsContainer.firstChild);
    }

    visibleSlots = visibleBonuses;
}

function createHuntingBonusCard(bonus, isNewest) {
    const card = document.createElement('div');
    card.className = `slot-card ${isNewest ? 'newest-bonus' : ''}`;
    card.innerHTML = `
        <div class="slot-header">
            <span class="slot-name">${bonus.slot.name}</span>
            <span class="slot-id">#${bonus.order || ''}</span>
        </div>
        <div class="slot-image-container">
            <img src="${bonus.slot.image}" alt="${bonus.slot.name}" class="slot-image">
        </div>
        <div class="slot-background" style="background-image: url(${bonus.slot.image})"></div>
        <div class="slot-content">
            <div class="slot-bet">${formatCurrency(bonus.aposta)}</div>
        </div>
        ${bonus.nota ? `<div class="slot-note">${bonus.nota}</div>` : ''}
        ${bonus.padrinho ? `<div class="slot-padrinho">${bonus.padrinho}</div>` : ''}
    `;
    return card;
}

function scrollToNewBonus(newBonusCard) {
    newBonusCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}


// OPENING PHASE

function updateOpeningPhase(huntData) {
    updateBestWin(huntData.bonuses);
    updateSlots(huntData.bonuses, huntData.bonus_atual_id);
}

function updateBestWin(bonuses) {
    const newBestWin = bonuses.reduce((best, current) =>
        (current.payout > (best ? best.payout : 0)) ? current : best, null);

    if (newBestWin && newBestWin !== bestWinSlot) {
        const bestWinContainer = document.getElementById('best-win-container');
        bestWinContainer.classList.add('flashing');
        setTimeout(() => {
            bestWinSlot = newBestWin;
            bestWinContainer.innerHTML = createSlotCardHTML(bestWinSlot, true, false);
            bestWinContainer.classList.remove('flashing');
        }, 500);
        setTimeout(() => {
            bestWinContainer.classList.add('flashing');
            setTimeout(() => bestWinContainer.classList.remove('flashing'), 500);
        }, 1000);
    }
}

function updateSlots(bonuses, activeBonusId) {
    const bestWinContainer = document.getElementById('best-win-container');
    const bonusCardsContainer = document.getElementById('bonus-cards-container');

    const activeIndex = bonuses.findIndex(bonus => bonus.id === activeBonusId);
    const openedBonuses = bonuses.filter(b => b.payout !== null).length;

    // Atualizar best win card
    if (openedBonuses >= 2 && bestWinSlot) {
        if (bestWinContainer.style.display === 'none') {
            // Primeira vez que o best win aparece
            fadeOutFirstCard();
            setTimeout(() => {
                bestWinContainer.innerHTML = createSlotCardHTML(bestWinSlot, true, false);
                bestWinContainer.style.display = 'block';
                bestWinContainer.classList.add('fade-in');
            }, 500);
        } else {
            bestWinContainer.innerHTML = createSlotCardHTML(bestWinSlot, true, false);
        }
    } else {
        bestWinContainer.style.display = 'none';
    }

    // Atualizar bonus cards
    let newVisibleBonusSlots = [];
    if (openedBonuses < 2) {
        newVisibleBonusSlots = bonuses.slice(0, 8); // Mostrar 8 cards inicialmente
    } else {
        // Sempre mostrar 7 cards regulares após a introdução do best win
        newVisibleBonusSlots = bonuses.slice(1, 8); // Remove apenas o primeiro bônus aberto
    }

    animateSlots(newVisibleBonusSlots, bonusCardsContainer, activeBonusId, openedBonuses, activeIndex);
    visibleSlots = newVisibleBonusSlots;
}

function animateSlots(newSlots, container, activeBonusId, openedBonuses, activeIndex) {
    const currentSlots = Array.from(container.children);

    newSlots.forEach((slot, index) => {
        let slotElement = currentSlots[index];
        if (!slotElement) {
            slotElement = document.createElement('div');
            container.appendChild(slotElement);
        }

        slotElement.className = 'slot-card';
        const isActive = slot.id === activeBonusId;
        slotElement.classList.toggle('active', isActive);

        slotElement.dataset.id = slot.id;
        slotElement.innerHTML = createSlotCardHTML(slot, false, isActive);

        if (openedBonuses === 2 && index === newSlots.length - 1) {
            slotElement.classList.add('sliding-in');
        }
    });

    if (openedBonuses === 2) {
        // Remover apenas o primeiro slot quando o best win é introduzido
        const firstSlot = currentSlots[0];
        if (firstSlot) {
            firstSlot.classList.add('sliding-up');
            setTimeout(() => firstSlot.remove(), 500);
        }
    } else if (openedBonuses > 2 && activeIndex >= 3) {
        // Ajustar a posição do carrossel
        container.style.transform = `translateX(-${(activeIndex - 3) * 195}px)`;
    } else {
        container.style.transform = 'translateX(0)';
    }

    // Manter sempre 7 slots regulares
    while (container.children.length > 7) {
        container.removeChild(container.lastChild);
    }
}

function createSlotCardHTML(bonus, isBestWin = false, isActive = false) {
    const payoutInfo = bonus.payout !== null ? `
        <div class="slot-multiplier">${formatMultiplier(bonus.multiplicador)}</div>
        <div class="slot-win">${formatCurrency(bonus.payout)}</div>
    ` : `<div class="slot-bet">${formatCurrency(bonus.aposta)}</div>`;

    return `
        <div class="slot-card ${isBestWin ? 'best-win' : ''} ${isActive ? 'active' : ''}">
            <div class="slot-header">
                <span class="slot-name">${bonus.slot.name}</span>
                <span class="slot-id">#${bonus.order || ''}</span>
            </div>
            <div class="slot-image-container">
                <img src="${bonus.slot.image}" alt="${bonus.slot.name}" class="slot-image">
            </div>
            <div class="slot-background" style="background-image: url(${bonus.slot.image})"></div>
            <div class="slot-content">
                ${payoutInfo}
            </div>
            ${bonus.nota ? `<div class="slot-note">${bonus.nota}</div>` : ''}
            ${bonus.padrinho ? `<div class="slot-padrinho">${bonus.padrinho}</div>` : ''}
        </div>
    `;
}

function initializeCarousel() {
    const carousel = document.getElementById('slot-carousel');
    if (!carousel) {
        console.warn('Carousel element not found. Skipping carousel initialization.');
        return;
    }

    carousel.innerHTML = '';
    for (let i = 0; i < VISIBLE_SLOTS_COUNT; i++) {
        const slotElement = document.createElement('div');
        slotElement.className = 'slot-card';
        slotElement.innerHTML = '<div class="slot-content">Waiting for data...</div>';
        carousel.appendChild(slotElement);
    }
}


function fadeOutFirstCard() {
    const firstCard = document.querySelector('.bonus-cards-container .slot-card:first-child');
    if (firstCard) {
        firstCard.classList.add('fade-out');
        setTimeout(() => firstCard.remove(), 500);
    }
}


// ENDING PHASE

function updateEndedPhase(huntData) {
    // Implemente a lógica específica para a fase de ended
    // Por exemplo, mostrar um resumo final do hunt
}


// AUX

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatMultiplier(value) {
    return `${value.toFixed(0)}X`;
}