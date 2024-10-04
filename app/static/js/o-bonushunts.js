const CARD_WIDTH = 232; // 230px card width + 5px margin
const VISIBLE_CARDS = 7;
const CONTAINER_LEFT_PADDING = 10; // Extra space on the left
const ACTIVE_CARD_EXTRA_SPACE = 10; // Extra space on each side of the active card

let currentHuntData;
let activeIndex = 0;
let socket;
let positionCardsTimeout;

document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    initializeSocket();
    fetchCurrentHunt();
}

function initializeSocket() {
    try {
        socket = io('/widgets');
        socket.on('connect', () => console.log('Connected to WebSocket'));
        socket.on('bonus_activated', (data) => {
            console.log('Bonus activated:', data);
            if (currentHuntData && currentHuntData.id === data.huntId) {
                const newActiveIndex = data.bonuses.findIndex(bonus => bonus.id === data.activeBonusId);
                if (newActiveIndex !== -1 && newActiveIndex !== activeIndex) {
                    activeIndex = newActiveIndex;
                    positionCardsForOpening(data.bonuses.length);
                }
            }
        });
        socket.on('bonus_hunt_update', (data) => {
            console.log('Received bonus hunt update:', data);
            if (data && data.data) {
                updateOverlay(data.data, true);  // Force card update
            }
        });
        socket.on('disconnect', () => console.log('Disconnected from WebSocket'));
    } catch (error) {
        console.error('Failed to initialize socket:', error);
    }
}

function fetchCurrentHunt() {
    fetch('/widgets/overlay/data')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch overlay data');
            return response.json();
        })
        .then(data => {
            if (data.error) console.error(data.error);
            else updateOverlay(data);
        })
        .catch(error => console.error('Error fetching overlay data:', error));
}

function debouncedPositionCards(totalBonuses) {
    clearTimeout(positionCardsTimeout);
    positionCardsTimeout = setTimeout(() => {
        positionCardsForOpening(totalBonuses);
    }, 50);
}

function updateOverlay(huntData, updateCards = true) {
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
    updateBestWorstWinContainer(huntData);

    if (updateCards) {
        updateBonusCards(huntData);
    }

    if (huntData.phase === 'opening') {
        const newActiveIndex = huntData.bonuses.findIndex(bonus => bonus.id === huntData.bonus_atual_id);
        if (newActiveIndex !== -1 && newActiveIndex !== activeIndex) {
            activeIndex = newActiveIndex;
            console.log(`Updated activeIndex to: ${activeIndex}`);
            positionCardsForOpening(huntData.bonuses.length);
        }
    }
}

function updateHuntInfo(huntData) {
    const huntNameEl = document.getElementById('hunt-name');
    huntNameEl.textContent = huntData.nome.toUpperCase() || 'N/A';
    
    let huntStateEl = document.querySelector('.hunt-state');
    if (!huntStateEl) {
        huntStateEl = document.createElement('div');
        huntStateEl.className = 'hunt-state';
        huntNameEl.parentElement.appendChild(huntStateEl);
    }
    
    let stateIcon, stateColor;
    switch(huntData.phase) {
        case 'hunting':
            stateIcon = 'fa-search';
            stateColor = 'gold';
            break;
        case 'opening':
            stateIcon = 'fa-box-open';
            stateColor = 'lightgray';
            break;
        case 'ended':
            stateIcon = 'fa-flag-checkered';
            stateColor = 'green';
            break;
    }
    
    huntStateEl.innerHTML = `
        <i class="fas ${stateIcon}"></i>
        <span>${huntData.phase.toUpperCase()}</span>
    `;
    huntStateEl.style.backgroundColor = stateColor;
}

function updateStatistics(stats, phase) {
    const statLabels = {
        hunting: ['START', 'INVESTMENT', 'B/E X', 'AVG BET', 'BONUSES'],
        opening: ['TARGET', 'TOTAL', 'INITIAL BE X', 'OPEN BE X', 'AVG X'],
        ended: ['TARGET', 'TOTAL WON', 'PROFIT', 'ROI', 'BONUSES']
    };

    const statIcons = {
        hunting: ['fa-play', 'fa-coins', 'fa-balance-scale', 'fa-calculator', 'fa-gift'],
        opening: ['fa-bullseye', 'fa-money-bill-wave', 'fa-balance-scale', 'fa-balance-scale-right', 'fa-chart-line'],
        ended: ['fa-bullseye', 'fa-trophy', 'fa-chart-line', 'fa-percentage', 'fas fa-gift']
    };

    const statValues = {
        hunting: [
            formatCurrency(stats.custo_inicial),
            formatCurrency(stats.investimento),
            formatMultiplier(stats.break_even_x_inicial),
            formatCurrencyBet(stats.media_aposta_inicial),
            `${(stats.num_bonus).toFixed(0)}`,
        ],
        opening: [
            formatCurrency(stats.investimento),
            formatCurrency(stats.total_ganho),
            formatMultiplier(stats.break_even_x_inicial),
            stats.break_even_x < 0 ? '<span class="profit"><i class="fas fa-check-circle"></i> Profit</span>' : formatMultiplier(stats.break_even_x),
            formatMultiplier(stats.avg_x),
        ],
        ended: [
            formatCurrency(stats.investimento),
            formatCurrency(stats.total_ganho),
            formatCurrency(stats.lucro_prejuizo),
            `${((stats.lucro_prejuizo / stats.custo_inicial) * 100).toFixed(2)}%`,
            `${(stats.num_bonus).toFixed(0)}`,
        ]
    };

    const labels = statLabels[phase] || statLabels.hunting;
    const values = statValues[phase] || statValues.hunting;

    for (let i = 1; i <= 5; i++) {
        const statItem = document.getElementById(`stat-item-${i}`);
        if (statItem) {
            const label = labels[i - 1];
            const value = values[i - 1];
            const icon = statIcons[phase][i - 1];
            if (label && value) {
                statItem.innerHTML = `
                    <i class="fas ${icon}"></i>
                    <span class="stat-label">${label}</span>
                    <span class="stat-value">${value}</span>
                `;
                statItem.style.display = 'flex';
            } else {
                statItem.style.display = 'none';
            }
        }
    }

    const bonusesCount = document.getElementById('bonuses-count');
    if (bonusesCount) {
        bonusesCount.textContent = phase === 'hunting' ? `${stats.num_bonus}` : `${stats.num_bonus_abertos} / ${stats.num_bonus}`;
    }
}

function updateProgressBar(stats) {
    const progressContainer = document.querySelector('.progress-container');
    const progressFill = document.getElementById('progress-fill');
    const bonusesCount = document.getElementById('bonuses-count');
    const bonusesLabel = document.querySelector('.bonuses-label');

    if (currentHuntData.phase === 'opening') {
        progressContainer.style.display = 'flex';
        const progressPercentage = (stats.num_bonus_abertos / stats.num_bonus) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        bonusesCount.textContent = `${stats.num_bonus_abertos} / ${stats.num_bonus}`;
        
        // Adicionar ícone ao rótulo de bônus
        bonusesLabel.innerHTML = '<i class="fas fa-gift"></i> BONUSES';
    } else {
        progressContainer.style.display = 'none';
        bonusesCount.textContent = `${stats.num_bonus}`;
        
        // Adicionar ícone ao rótulo de bônus
        bonusesLabel.innerHTML = '<i class="fas fa-gift"></i> BONUSES';
    }
}

function updateBonusCards(huntData) {
    console.log('Updating bonus cards:', huntData.bonuses);
    const container = document.querySelector('.bonus-cards-wrapper');
    
    if (!container) {
        console.error('Bonus cards container not found');
        return;
    }

    // Update existing cards and add new ones
    huntData.bonuses.forEach((bonus, index) => {
        try {
            let card = container.querySelector(`[data-bonus-id="${bonus.id}"]`);
            if (!card) {
                card = createBonusCard(bonus);
                if (card) {
                    container.appendChild(card);
                }
            } else {
                updateBonusCardContent(card, bonus);
            }
        } catch (error) {
            console.error(`Error updating bonus card ${bonus.id}:`, error);
        }
    });

    // Remove cards that are no longer present
    Array.from(container.children).forEach(card => {
        const bonusId = parseInt(card.dataset.bonusId);
        if (!huntData.bonuses.some(bonus => bonus.id === bonusId)) {
            card.remove();
        }
    });

    if (huntData.phase === 'opening') {
        positionCardsForOpening(huntData.bonuses.length);
    }
}

function updateBonusCardContent(card, bonus) {
    if (!card) {
        console.error('Card element is null');
        return;
    }

    // Update card content without recreating the entire card
    const slotNameElement = card.querySelector('.slot-name');
    if (slotNameElement) {
        slotNameElement.textContent = bonus.slot.name.length > 25 
            ? bonus.slot.name.substring(0, 26) + '...' 
            : bonus.slot.name;
    }

    const slotIdElement = card.querySelector('.slot-id');
    if (slotIdElement) {
        slotIdElement.textContent = `#${bonus.order || ''}`;
    }

    const slotImageElement = card.querySelector('.slot-image');
    if (slotImageElement) {
        slotImageElement.src = bonus.slot.image;
    }
    
    const slotInfo = card.querySelector('.slot-info');
    if (slotInfo) {
        if (bonus.payout !== null) {
            slotInfo.innerHTML = `
                <div class="slot-multiplier">${formatMultiplier(bonus.multiplicador)}</div>
                <div class="slot-win">${formatCurrency(bonus.payout)}</div>
                <div class="slot-bet small">${formatCurrencyBet(bonus.aposta)}</div>
            `;
            slotInfo.classList.add('payout-shown');
        } else {
            slotInfo.innerHTML = `
                <div class="slot-bet">${formatCurrencyBet(bonus.aposta)}</div>
            `;
            slotInfo.classList.remove('payout-shown');
        }
    }

    const slotPadrinhoElement = card.querySelector('.slot-padrinho span');
    if (slotPadrinhoElement) {
        slotPadrinhoElement.textContent = bonus.padrinho || 'N/A';
    }

    const noteSpan = card.querySelector('.slot-note');
    if (noteSpan) {
        if (bonus.nota) {
            const noteIcon = getNoteIcon(bonus.nota);
            noteSpan.innerHTML = `
                ${noteIcon ? `<i class="${noteIcon}"></i>` : ''}
                ${bonus.nota}
            `;
        } else {
            noteSpan.innerHTML = '';
        }
    }

    // Update the overall card class
    card.classList.toggle('opened', bonus.payout !== null);
}

function createBonusCard(bonus, isWinCard = false, winType = '') {
    console.log('Creating bonus card:', bonus);
    const card = document.createElement('div');
    card.className = `slot-card ${bonus.payout !== null ? 'opened' : ''} ${winType}`;
    card.dataset.bonusId = bonus.id;

    const noteIcon = getNoteIcon(bonus.nota);

    // Truncate the slot name if it's longer than 25 characters
    const truncatedName = bonus.slot.name.length > 25 
        ? bonus.slot.name.substring(0, 26) + '...' 
        : bonus.slot.name;

    card.innerHTML = `
        <div class="slot-background" style="background-image: url(${bonus.slot.image})"></div>
        <div class="slot-header ${winType}">
            <span class="slot-name">${truncatedName}</span>
            <span class="slot-id">#${bonus.order || ''}</span>
        </div>
        <div class="slot-image-container">
            <img src="${bonus.slot.image}" alt="${bonus.slot.name}" class="slot-image">
            ${isWinCard ? `<div class="win-icon">${winType === 'best' ? '🏆' : '💩'}</div>` : ''}
        </div>
        <div class="slot-info">
            ${bonus.payout !== null ? `
                <div class="slot-multiplier">${formatMultiplier(bonus.multiplicador)}</div>
                <div class="slot-win">${formatCurrency(bonus.payout)}</div>
                <div class="slot-bet">${formatCurrencyBet(bonus.aposta)}</div>
            ` : `
                <div class="slot-bet">${formatCurrencyBet(bonus.aposta)}</div>
            `}
        </div>
        <div class="slot-padrinho">
            <i class="fas fa-user"></i>
            <span>${bonus.padrinho || 'N/A'}</span>
            ${bonus.nota ? `
                <span class="slot-note">
                    ${noteIcon ? `<i class="${noteIcon}"></i>` : ''}
                    ${bonus.nota}
                </span>
            ` : ''}
        </div>
    `;
    return card;
}

function positionCardsForOpening(totalBonuses) {
    console.log(`positionCardsForOpening called. Total bonuses: ${totalBonuses}, Active index: ${activeIndex}`);

    const container = document.querySelector('.bonus-cards-wrapper');
    const cards = Array.from(container.children);

    let startIndex = Math.max(0, Math.min(activeIndex - Math.floor(VISIBLE_CARDS / 2), totalBonuses - VISIBLE_CARDS));
    console.log(`Calculated start index: ${startIndex}`);

    const totalWidth = (totalBonuses * CARD_WIDTH) + CONTAINER_LEFT_PADDING + (2 * ACTIVE_CARD_EXTRA_SPACE);
    container.style.width = `${totalWidth}px`;
    container.style.paddingLeft = `${CONTAINER_LEFT_PADDING}px`;

    cards.forEach((card, index) => {
        let xPosition = (index * CARD_WIDTH) + CONTAINER_LEFT_PADDING;
        if (index > activeIndex) xPosition += ACTIVE_CARD_EXTRA_SPACE;
        if (index >= activeIndex) xPosition += ACTIVE_CARD_EXTRA_SPACE;

        card.style.left = `${xPosition}px`;
        card.style.zIndex = VISIBLE_CARDS - Math.abs(index - activeIndex);

        const isVisible = index >= startIndex && index < startIndex + VISIBLE_CARDS;
        const newClass = isVisible ? 'visible' : (index < startIndex ? 'exiting' : 'entering');
        
        if (!card.classList.contains(newClass)) {
            card.classList.remove('visible', 'entering', 'exiting');
            card.classList.add(newClass);
        }

        if (index === activeIndex) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }

        console.log(`Card ${index}: Position ${card.style.left}, Class: ${card.className}, zIndex: ${card.style.zIndex}`);
    });

    const containerOffset = (startIndex * CARD_WIDTH) + (activeIndex >= startIndex ? ACTIVE_CARD_EXTRA_SPACE : 0);
    container.style.transform = `translateX(-${containerOffset}px)`;

    console.log(`Container offset: -${containerOffset}px`);
    console.log(`Container width: ${container.style.width}, Padding left: ${container.style.paddingLeft}`);
}

function positionCardsForHunting(bonuses) {
    const container = document.querySelector('.bonus-cards-wrapper');
    const cards = Array.from(container.children);

    // Reset positions
    container.style.transform = 'translateX(0)';
    cards.forEach(card => card.classList.remove('active', 'new-bonus'));

    // Highlight the most recent card
    if (cards.length > 0) {
        cards[0].classList.add('active', 'new-bonus');
    }

    // If there are more than VISIBLE_CARDS, scroll to show the most recent ones
    if (bonuses.length > VISIBLE_CARDS) {
        const scrollAmount = (bonuses.length - VISIBLE_CARDS) * CARD_WIDTH;
        container.style.transform = `translateX(-${scrollAmount}px)`;
    }
}

function calculateContainerWidth() {
    return VISIBLE_CARDS * CARD_WIDTH + (VISIBLE_CARDS - 1) * CARD_GAP;
}

function moveToNextBonus() {
    console.log('moveToNextBonus called');
    if (currentHuntData.phase !== 'opening') return;

    const totalBonuses = currentHuntData.bonuses.length;
    if (activeIndex < totalBonuses - 1) {
        activeIndex++;
        console.log(`Moving to next bonus. New active index: ${activeIndex}`);
        debouncedPositionCards(totalBonuses);
    } else {
        console.log('Already at the last bonus');
    }
}

function moveToPreviousBonus() {
    console.log('moveToPreviousBonus called');
    if (currentHuntData.phase !== 'opening') return;

    if (activeIndex > 0) {
        activeIndex--;
        console.log(`Moving to previous bonus. New active index: ${activeIndex}`);
        debouncedPositionCards(currentHuntData.bonuses.length);
    } else {
        console.log('Already at the first bonus');
    }
}

document.addEventListener('keydown', (e) => {
    if (currentHuntData && currentHuntData.phase === 'opening') {
        if (e.key === 'ArrowRight') {
            console.log('Right arrow pressed');
            moveToNextBonus();
        } else if (e.key === 'ArrowLeft') {
            console.log('Left arrow pressed');
            moveToPreviousBonus();
        }
    }
});

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatCurrencyBet(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatMultiplier(value) {
    return `${value.toFixed(0)} x`;
}

let winCardInterval;

function startWinCardToggle() {
    const winContainer = document.getElementById('win-container');
    if (!winContainer) return;

    const bestCard = winContainer.querySelector('.win-card.best');
    const worstCard = winContainer.querySelector('.win-card.worst');
    if (!bestCard || !worstCard) return;

    let showingBest = true;

    function toggleCards() {
        if (showingBest) {
            bestCard.style.transform = 'scale(0)';
            worstCard.style.transform = 'scale(1)';
        } else {
            bestCard.style.transform = 'scale(1)';
            worstCard.style.transform = 'scale(0)';
        }
        showingBest = !showingBest;
    }

    toggleCards(); // Iniciar com o melhor cartão visível
    winCardInterval = setInterval(toggleCards, 10000);
}

function stopWinCardToggle() {
    clearInterval(winCardInterval);
}

function updateBestWorstWinContainer(huntData) {
    const winContainer = document.getElementById('win-container');

    if (huntData.phase === 'opening') {
        winContainer.style.display = 'flex';
        if (huntData.estatisticas.num_bonus_abertos < 2) {
            winContainer.innerHTML = "<div class='win-card'>O BONUS OPENING ESTÁ A COMEÇAR</div>";
        } else {
            const bestBonus = huntData.bonuses.reduce((best, current) =>
                (current.payout > (best ? best.payout : 0)) ? current : best, null);
            const worstBonus = huntData.bonuses.reduce((worst, current) =>
                (current.payout && current.payout < (worst ? worst.payout : Infinity)) ? current : worst, null);

            winContainer.innerHTML = `
                <div class="win-card best">
                    ${createBonusCard(bestBonus, true, 'best').outerHTML}
                </div>
                <div class="win-card worst">
                    ${createBonusCard(worstBonus, true, 'worst').outerHTML}
                </div>
            `;
        }
        startWinCardToggle();
    } else {
        winContainer.style.display = 'none';
        stopWinCardToggle();
    }
}

function getNoteIcon(note) {
    const noteIconMap = {
        'super': 'fas fa-star text-danger',
        'mega': 'fas fa-fire text-warning',
        'ultra': 'fas fa-bolt text-primary',
        // Adicione mais mapeamentos conforme necessário
    };

    const lowerNote = note.toLowerCase();
    for (const [keyword, icon] of Object.entries(noteIconMap)) {
        if (lowerNote.includes(keyword)) {
            return icon;
        }
    }
    return null;
}