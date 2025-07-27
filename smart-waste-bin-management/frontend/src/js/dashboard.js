// This file contains JavaScript logic for the dashboard page, including fetching and displaying bin data based on the user's role.

async function fetchBinData() {
    const res = await fetch("http://localhost:5000/api/bin-data/latest", {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    if (!res.ok) {
        throw new Error('Failed to fetch bin data');
    }
    const data = await res.json();
    let statusText = `Bin ${data.binId}: ${data.fillLevel}% full`;
    let icon = "🗑️", iconClass = "status-green";
    if (data.fillLevel >= 80) { icon = "⚠️"; iconClass = "status-red"; }
    else if (data.fillLevel >= 50) { icon = "🔔"; iconClass = "status-yellow"; }
    document.getElementById("binStatus").textContent = statusText;
    document.getElementById("statusIcon").textContent = icon;
    document.getElementById("statusIcon").className = "status-icon " + iconClass;
}

async function drawChart() {
    const res = await fetch("http://localhost:5000/api/bin-data/history", {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    if (!res.ok) {
        throw new Error('Failed to fetch bin history data');
    }
    const data = await res.json();
    const ctx = document.getElementById('fillChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
            datasets: [{
                label: 'Fill Level (%)',
                data: data.map(d => d.fillLevel),
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39,174,96,0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchBinData().catch(err => console.error(err));
    drawChart().catch(err => console.error(err));
});