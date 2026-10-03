// Set Current Year
document.getElementById('current-year').textContent = new Date().getFullYear();

// Mobile Menu Toggle
const btn = document.getElementById('mobile-menu-btn');
const menu = document.getElementById('mobile-menu');

btn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
});

// Live Camera Time Update
const camTimeEl = document.getElementById('cam-time');
setInterval(() => {
    const now = new Date();
    camTimeEl.textContent = now.toISOString().replace('T', ' ').substring(0, 19);
}, 1000);

// Data Simulation Variables
const platesLetters = ['B', 'D', 'E', 'F', 'T', 'A', 'H', 'N'];
const vehicleTypes = ['Truk Box 2 Sumbu', 'Truk Tronton', 'Truk Gandeng', 'Trailer', 'Dump Truck'];
let initialDataCount = 10;
let dataTable = [];

// Helper to get random item
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to format date
const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Generate Random ODOL Data
function generateRandomData() {
    const isViolation = Math.random() > 0.65; // 35% chance of violation
    const type = getRandom(vehicleTypes);
    
    // Base metrics based on type
    let baseWeight, baseLength, baseWidth, baseHeight, limitWeight;
    
    if (type.includes('2 Sumbu')) { baseWeight = 12; limitWeight = 16; baseLength = 7; baseWidth = 2.3; baseHeight = 3.5; }
    else if (type.includes('Tronton')) { baseWeight = 20; limitWeight = 24; baseLength = 9; baseWidth = 2.5; baseHeight = 3.8; }
    else { baseWeight = 30; limitWeight = 40; baseLength = 12; baseWidth = 2.5; baseHeight = 4.0; }

    // Generate values
    let weight = (baseWeight + Math.random() * (isViolation ? 15 : 3)).toFixed(1);
    let length = (baseLength + (isViolation ? Math.random() * 2 : 0)).toFixed(1);
    let width = (baseWidth + (isViolation ? Math.random() * 0.5 : 0)).toFixed(1);
    let height = (baseHeight + (isViolation ? Math.random() * 1.0 : 0)).toFixed(1);
    
    // Determine detailed status
    let overLoad = parseFloat(weight) > limitWeight;
    let overDim = parseFloat(length) > baseLength + 0.5 || parseFloat(width) > 2.5 || parseFloat(height) > 4.2;
    
    let statusBadge, statusText;
    if (overLoad && overDim) {
        statusBadge = 'bg-red-100 text-red-800 border-red-200';
        statusText = 'ODOL (Dimensi & Muatan)';
    } else if (overLoad) {
        statusBadge = 'bg-orange-100 text-orange-800 border-orange-200';
        statusText = 'Over Load (Muatan)';
    } else if (overDim) {
        statusBadge = 'bg-yellow-100 text-yellow-800 border-yellow-200';
        statusText = 'Over Dimension (Dimensi)';
    } else {
        statusBadge = 'bg-green-100 text-green-800 border-green-200';
        statusText = 'Aman Sesuai Aturan';
    }

    const plate = `${getRandom(platesLetters)} ${Math.floor(1000 + Math.random() * 9000)} ${getRandom(platesLetters)}${getRandom(platesLetters)}`;

    return {
        time: formatTime(new Date()),
        plate: plate,
        type: type,
        weight: weight,
        dim: `${length}m x ${width}m x ${height}m`,
        statusText: statusText,
        statusBadge: statusBadge,
        isViolation: overLoad || overDim
    };
}

// Render Table Row
function renderRow(data, animate = false) {
    const tr = document.createElement('tr');
    tr.className = `hover:bg-blue-50 transition-colors ${animate ? 'animate-[pulse_1s_ease-in-out]' : ''}`;
    tr.innerHTML = `
        <td class="px-6 py-4 font-mono text-gray-500">${data.time}</td>
        <td class="px-6 py-4">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded border border-gray-300 bg-white text-gray-800 font-bold font-mono shadow-sm">
                ${data.plate}
            </span>
        </td>
        <td class="px-6 py-4 text-gray-600">${data.type}</td>
        <td class="px-6 py-4">
            <span class="font-medium ${data.statusText.includes('Load') || data.statusText.includes('ODOL') ? 'text-red-600 font-bold' : 'text-gray-700'}">${data.weight}</span>
        </td>
        <td class="px-6 py-4">
            <span class="font-medium ${data.statusText.includes('Dimension') || data.statusText.includes('ODOL') ? 'text-red-600 font-bold' : 'text-gray-700'}">${data.dim}</span>
        </td>
        <td class="px-6 py-4">
            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${data.statusBadge}">
                ${data.statusText}
            </span>
        </td>
    `;
    return tr;
}

// Initialize Table
const tableBody = document.getElementById('data-table-body');
for (let i = 0; i < initialDataCount; i++) {
    // slightly decrement time for initial data
    const date = new Date(Date.now() - (i * 45000));
    const data = generateRandomData();
    data.time = formatTime(date);
    dataTable.push(data);
    tableBody.appendChild(renderRow(data));
}

// Update Dashboard Panel based on newest data
function updateDashboardPanel(data) {
    const panel = document.getElementById('latest-detection-panel');
    
    const icon = data.isViolation ? '<i class="fa-solid fa-triangle-exclamation text-danger text-2xl"></i>' : '<i class="fa-solid fa-check-circle text-safe text-2xl"></i>';
    const borderCol = data.isViolation ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50';

    panel.innerHTML = `
        <div class="p-4 rounded-xl border ${borderCol} flex items-start gap-4 transition-all duration-500">
            <div class="mt-1">${icon}</div>
            <div>
                <div class="text-xs text-gray-500 font-mono mb-1">${data.time} | CAM-01</div>
                <h4 class="font-bold text-gray-800 text-lg mb-1">${data.plate}</h4>
                <p class="text-sm text-gray-600 mb-2">${data.type}</p>
                
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <div class="bg-white p-2 rounded border border-gray-100 shadow-sm">
                        <span class="block text-[10px] text-gray-400 uppercase">Berat</span>
                        <span class="font-bold ${data.statusText.includes('Load') || data.statusText.includes('ODOL') ? 'text-danger' : 'text-gray-700'}">${data.weight} Ton</span>
                    </div>
                    <div class="bg-white p-2 rounded border border-gray-100 shadow-sm">
                        <span class="block text-[10px] text-gray-400 uppercase">Dimensi</span>
                        <span class="font-bold text-xs ${data.statusText.includes('Dimension') || data.statusText.includes('ODOL') ? 'text-danger' : 'text-gray-700'}">${data.dim.split(' x ')[0]}m</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Simulate AI box animation on video feed
function animateAIVideoBox(isViolation) {
    const box = document.getElementById('ai-box');
    
    // Randomize position slightly
    const top = 20 + Math.random() * 20;
    const left = 20 + Math.random() * 40;
    const width = 25 + Math.random() * 15;
    const height = 30 + Math.random() * 20;

    box.style.top = `${top}%`;
    box.style.left = `${left}%`;
    box.style.width = `${width}%`;
    box.style.height = `${height}%`;

    if(isViolation) {
        box.className = "absolute border-2 border-red-500 bg-red-500/20 z-20 transition-all duration-300 opacity-100 flex flex-col justify-end";
        box.innerHTML = `<div class="bg-red-500 text-white text-xs font-mono px-1 font-bold whitespace-nowrap self-start">VIOLATION DETECTED</div>`;
    } else {
        box.className = "absolute border-2 border-green-500 bg-green-500/10 z-20 transition-all duration-300 opacity-100 flex flex-col justify-end";
        box.innerHTML = `<div class="bg-green-500 text-black text-xs font-mono px-1 font-bold whitespace-nowrap self-start">VEHICLE SAFE</div>`;
    }

    setTimeout(() => {
        box.style.opacity = '0';
    }, 3000); // Box disappears after 3s
}

// Add new data function
function forceNewData() {
    const newData = generateRandomData();
    
    // UI Updates
    updateDashboardPanel(newData);
    animateAIVideoBox(newData.isViolation);

    // Table Updates
    const newRow = renderRow(newData, true);
    tableBody.insertBefore(newRow, tableBody.firstChild);
    
    // Remove last row to keep table max 10 rows
    if (tableBody.children.length > 10) {
        tableBody.removeChild(tableBody.lastChild);
    }

    // Update Hero Stats randomly to simulate system-wide activity
    const scannedEl = document.getElementById('hero-scanned');
    const violationEl = document.getElementById('hero-violations');
    
    let currentScanned = parseInt(scannedEl.innerText.replace(/,/g, ''));
    let currentViolations = parseInt(violationEl.innerText.replace(/,/g, ''));
    
    scannedEl.innerText = (currentScanned + 1).toLocaleString();
    if(newData.isViolation) {
        violationEl.innerText = (currentViolations + 1).toLocaleString();
    }
}

// Initialize dashboard state
updateDashboardPanel(dataTable[0]);

// Auto generate data every 8 - 15 seconds
(function loop() {
    var rand = Math.round(Math.random() * 7000) + 8000;
    setTimeout(function() {
        forceNewData();
        loop();  
    }, rand);
}());