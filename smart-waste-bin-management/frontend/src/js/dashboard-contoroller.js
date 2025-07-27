// dashboard-controller.js - Main controller for the smart waste dashboard

class DashboardController {
  constructor() {
    this.apiBaseUrl = 'http://localhost:5000/api';
    this.wsConnection = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.refreshInterval = 60000; // 1 minute
    this.refreshTimer = null;
    this.aiAnalytics = new AIAnalytics();
    
    // User session data (replaces localStorage for Claude environment)
    this.userSession = {
      token: null,
      username: 'Demo User',
      role: 'Administrator',
      lastLogin: new Date().toISOString(),
      settings: {
        alertThreshold: 85,
        fontSize: '16px',
        refreshInterval: 60000,
        darkMode: false
      }
    };
    
    this.binData = [];
    this.notifications = [];
    this.charts = {};
    
    this.init();
  }
  
  async init() {
    console.log('🚀 Initializing Smart Waste Dashboard...');
    
    try {
      this.setupEventListeners();
      this.updateUserInterface();
      await this.loadInitialData();
      this.startRealTimeUpdates();
      this.initializeWebSocket();
      
      console.log('✅ Dashboard initialized successfully');
    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      this.showNotification('Dashboard initialization failed. Using demo mode.', 'warning');
      this.loadDemoData();
    }
  }
  
  setupEventListeners() {
    // Settings controls
    document.getElementById('fontSize')?.addEventListener('change', (e) => {
      this.updateFontSize(e.target.value);
    });
    
    document.getElementById('alertThreshold')?.addEventListener('change', (e) => {
      this.updateAlertThreshold(parseInt(e.target.value));
    });
    
    document.getElementById('refreshInterval')?.addEventListener('change', (e) => {
      this.updateRefreshInterval(parseInt(e.target.value));
    });
    
    // Filter controls
    document.getElementById('dateFilter')?.addEventListener('change', (e) => {
      this.filterByDate(e.target.value);
    });
    
    // Window events
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    window.addEventListener('online', () => {
      this.handleConnectionChange(true);
    });
    
    window.addEventListener('offline', () => {
      this.handleConnectionChange(false);
    });
  }
  
  updateUserInterface() {
    // Update user info
    document.getElementById('userName').textContent = this.userSession.username;
    document.getElementById('userRole').textContent = this.userSession.role;
    document.getElementById('lastLogin').textContent = new Date(this.userSession.lastLogin).toLocaleString();
    
    // Apply saved settings
    document.documentElement.style.setProperty('--font-size', this.userSession.settings.fontSize);
    
    if (document.getElementById('fontSize')) {
      document.getElementById('fontSize').value = this.userSession.settings.fontSize;
    }
    
    if (document.getElementById('alertThreshold')) {
      document.getElementById('alertThreshold').value = this.userSession.settings.alertThreshold;
      document.getElementById('thresholdValue').textContent = this.userSession.settings.alertThreshold + '%';
    }
    
    // Start time updates
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }
  
  updateDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    
    document.getElementById('dateNow').textContent = dateStr;
    document.getElementById('timeNow').textContent = timeStr;
    document.getElementById('timeNowNav').textContent = timeStr;
  }
  
  async loadInitialData() {
    try {
      // Try to load real data from backend
      const response = await this.makeApiCall('/bins');
      
      if (response.ok) {
        const data = await response.json();
        this.binData = this.processBinData(data);
        this.isConnected = true;
        this.updateConnectionStatus(true);
      } else {
        throw new Error('Backend not available');
      }
    } catch (error) {
      console.log('Backend not available, loading demo data...');
      this.loadDemoData();
      this.isConnected = false;
      this.updateConnectionStatus(false);
    }
    
    // Initialize AI analytics
    await this.aiAnalytics.initialize(this.binData);
    
    // Render initial data
    this.renderDashboard();
  }
  
  loadDemoData() {
    console.log('📊 Loading demo data...');
    
    const now = new Date();
    this.binData = [
      {
        binId: 1,
        fillLevel: 45 + Math.floor(Math.random() * 30),
        location: 'Main Building - Lobby',
        lastEmptied: new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)),
        batteryLevel: 85 + Math.floor(Math.random() * 15),
        temperature: 22 + Math.floor(Math.random() * 8),
        sensorStatus: 'active',
        timestamp: now
      },
      {
        binId: 2,
        fillLevel: 70 + Math.floor(Math.random() * 25),
        location: 'Cafeteria - East Wing',
        lastEmptied: new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000)),
        batteryLevel: 92,
        temperature: 24,
        sensorStatus: 'active',
        timestamp: now
      },
      {
        binId: 3,
        fillLevel: 25 + Math.floor(Math.random() * 20),
        location: 'Office Block - Floor 2',
        lastEmptied: new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)),
        batteryLevel: 78,
        temperature: 21,
        sensorStatus: 'active',
        timestamp: now
      },
      {
        binId: 4,
        fillLevel: 88 + Math.floor(Math.random() * 10),
        location: 'Parking Garage - Level B1',
        lastEmptied: new Date(now.getTime() - (0.5 * 24 * 60 * 60 * 1000)),
        batteryLevel: 67,
        temperature: 19,
        sensorStatus: 'warning',
        timestamp: now
      },
      {
        binId: 5,
        fillLevel: 55 + Math.floor(Math.random() * 25),
        location: 'Conference Center',
        lastEmptied: new Date(now.getTime() - (2.5 * 24 * 60 * 60 * 1000)),
        batteryLevel: 90,
        temperature: 23,
        sensorStatus: 'active',
        timestamp: now
      },
      {
        binId: 6,
        fillLevel: 10 + Math.floor(Math.random() * 15),
        location: 'Emergency Exit - Stairwell',
        lastEmptied: new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000)),
        batteryLevel: 45,
        temperature: 18,
        sensorStatus: 'low_battery',
        timestamp: now
      }
    ];
  }
  
  processBinData(rawData) {
    return rawData.map(bin => ({
      ...bin,
      timestamp: new Date(bin.timestamp || Date.now()),
      lastEmptied: new Date(bin.lastEmptied || Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000)),
      batteryLevel: bin.batteryLevel || 80 + Math.floor(Math.random() * 20),
      temperature: bin.temperature || 20 + Math.floor(Math.random() * 10),
      sensorStatus: bin.sensorStatus || 'active'
    }));
  }
  
  async makeApiCall(endpoint, options = {}) {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.userSession.token && { 'Authorization': `Bearer ${this.userSession.token}` })
      },
      ...options
    };
    
    return fetch(url, config);
  }
  
  renderDashboard() {
    this.renderBinCards();
    this.updateQuickStats();
    this.renderTrendChart();
    this.generateAIInsights();
    this.updateNotifications();
  }
  
  renderBinCards() {
    const grid = document.getElementById('binsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    this.binData.forEach(bin => {
      const card = this.createBinCard(bin);
      grid.appendChild(card);
    });
  }
  
  createBinCard(bin) {
    const statusClass = this.getBinStatusClass(bin.fillLevel);
    const statusIcon = this.getBinStatusIcon(bin.fillLevel);
    const progressColor = this.getProgressColor(bin.fillLevel);
    
    const card = document.createElement('div');
    card.className = 'card bin-card';
    card.setAttribute('data-bin-id', bin.binId);
    
    // Add click handler for detailed view
    card.addEventListener('click', () => this.showBinDetails(bin));
    
    card.innerHTML = `
      <div class="bin-header">
        <h3>Bin ${bin.binId}</h3>
        <span class="sensor-status ${bin.sensorStatus}">${this.getSensorStatusIcon(bin.sensorStatus)}</span>
      </div>
      
      <div class="bin-status ${statusClass}">${statusIcon}</div>
      
      <div class="fill-level ${statusClass}">${bin.fillLevel}%</div>
      
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${bin.fillLevel}%; background: ${progressColor};"></div>
      </div>
      
      <div class="bin-details">
        <div class="detail-item">
          <span class="icon">📍</span>
          <span class="text">${bin.location}</span>
        </div>
        <div class="detail-item">
          <span class="icon">🔋</span>
          <span class="text">Battery: ${bin.batteryLevel}%</span>
        </div>
        <div class="detail-item">
          <span class="icon">🌡️</span>
          <span class="text">Temp: ${bin.temperature}°C</span>
        </div>
        <div class="detail-item">
          <span class="icon">🕒</span>
          <span class="text">Last emptied: ${this.formatTimeAgo(bin.lastEmptied)}</span>
        </div>
      </div>
      
      <div class="bin-actions">
        <button class="action-btn" onclick="dashboardController.scheduleMaintenance(${bin.binId})">
          🔧 Maintenance
        </button>
        <button class="action-btn" onclick="dashboardController.scheduleCollection(${bin.binId})">
          🗑️ Collect
        </button>
      </div>
    `;
    
    return card;
  }
  
  getBinStatusClass(fillLevel) {
    if (fillLevel >= this.userSession.settings.alertThreshold) return 'status-danger';
    if (fillLevel >= 60) return 'status-warning';
    return 'status-ok';
  }
  
  getBinStatusIcon(fillLevel) {
    if (fillLevel >= this.userSession.settings.alertThreshold) return '🚨';
    if (fillLevel >= 60) return '⚠️';
    return '✅';
  }
  
  getProgressColor(fillLevel) {
    if (fillLevel >= this.userSession.settings.alertThreshold) return '#e74c3c';
    if (fillLevel >= 60) return '#f39c12';
    return '#27ae60';
  }
  
  getSensorStatusIcon(status) {
    const icons = {
      'active': '🟢',
      'warning': '🟡',
      'error': '🔴',
      'low_battery': '🔋',
      'offline': '⚫'
    };
    return icons[status] || '❓';
  }
  
  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Recently';
  }
  
  updateQuickStats() {
    const totalBins = this.binData.length;
    const fullBins = this.binData.filter(bin => bin.fillLevel >= this.userSession.settings.alertThreshold).length;
    const avgFill = Math.round(this.binData.reduce((sum, bin) => sum + bin.fillLevel, 0) / totalBins);
    const collectionDue = this.binData.filter(bin => bin.fillLevel >= 70).length;
    
    // Update sidebar stats
    this.updateElement('totalBins', totalBins);
    this.updateElement('fullBins', fullBins);
    this.updateElement('avgFill', avgFill + '%');
    this.updateElement('collectionDue', collectionDue);
    
    // Update main dashboard stats
    this.updateElement('avgFillToday', avgFill + '%');
    this.updateElement('collectionsToday', Math.floor(Math.random() * 5) + 2);
    this.updateElement('efficiency', Math.round(85 + Math.random() * 10) + '%');
  }
  
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  
  renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (this.charts.trendChart) {
      this.charts.trendChart.destroy();
    }
    
    const chartData = {
      labels: this.binData.map(bin => `Bin ${bin.binId}`),
      datasets: [{
        label: 'Current Fill Level (%)',
        data: this.binData.map(bin => bin.fillLevel),
        backgroundColor: this.binData.map(bin => this.getProgressColor(bin.fillLevel)),
        borderColor: this.binData.map(bin => this.getProgressColor(bin.fillLevel)),
        borderWidth: 2,
        borderRadius: 4
      }]
    };
    
    this.charts.trendChart = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100,
            title: {
              display: true,
              text: 'Fill Level (%)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Real-time Bin Fill Levels'
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                const bin = this.binData[context.dataIndex];
                return [
                  `Location: ${bin.location}`,
                  `Battery: ${bin.batteryLevel}%`,
                  `Temperature: ${bin.temperature}°C`
                ];
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const binIndex = elements[0].index;
            this.showBinDetails(this.binData[binIndex]);
          }
        }
      }
    });
  }
  
  async generateAIInsights() {
    if (!this.aiAnalytics.initialized) return;
    
    try {
      // Generate predictions
      const predictions = this.aiAnalytics.generatePredictions(this.binData);
      this.renderPredictionChart(predictions);
      
      // Get AI insights
      const insights = this.aiAnalytics.getInsights(this.binData);
      this.displayAIInsights(insights);
      
      // Get collection predictions
      const collectionPredictions = this.aiAnalytics.getNextCollectionPredictions(this.binData);
      this.displayCollectionPredictions(collectionPredictions);
      
    } catch (error) {
      console.error('Error generating AI insights:', error);
      this.showMockAIInsights();
    }
  }
  
  renderPredictionChart(predictions) {
    const ctx = document.getElementById('predictionChart');
    if (!ctx || predictions.length === 0) return;
    
    // Destroy existing chart
    if (this.charts.predictionChart) {
      this.charts.predictionChart.destroy();
    }
    
    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    
    const datasets = predictions.map(binPrediction => ({
      label: `Bin ${binPrediction.binId}`,
      data: binPrediction.predictions.map(p => p.fillLevel),
      borderColor: this.getProgressColor(binPrediction.predictions[0].fillLevel),
      backgroundColor: this.getProgressColor(binPrediction.predictions[0].fillLevel) + '20',
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6
    }));
    
    this.charts.predictionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100,
            title: {
              display: true,
              text: 'Predicted Fill Level (%)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'AI-Powered 7-Day Fill Prediction'
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                const binIndex = context.datasetIndex;
                const dayIndex = context.dataIndex;
                const prediction = predictions[binIndex].predictions[dayIndex];
                return [
                  `Confidence: ${Math.round(prediction.confidence * 100)}%`,
                  prediction.collectionNeeded ? 'Collection needed' : 'No collection needed'
                ];
              }
            }
          }
        }
      }
    });
  }
  
  displayAIInsights(insights) {
    const containers = {
      nextCollectionPrediction: document.getElementById('nextCollectionPrediction'),
      fillRateAnalysis: document.getElementById('fillRateAnalysis'),
      optimizationSuggestions: document.getElementById('optimizationSuggestions')
    };
    
    if (insights.length === 0) {
      this.showMockAIInsights();
      return;
    }
    
    insights.forEach((insight, index) => {
      const containerKeys = Object.keys(containers);
      const containerId = containerKeys[index % containerKeys.length];
      const container = containers[containerId];
      
      if (container) {
        container.innerHTML = `
          <strong>${insight.title}</strong><br>
          ${insight.message}
          ${insight.recommendation ? `<br><em>Recommendation: ${insight.recommendation}</em>` : ''}
        `;
      }
    });
  }
  
  showMockAIInsights() {
    const mockInsights = [
      "Based on historical patterns, Bin 2 will reach 95% capacity in approximately 18 hours.",
      "Fill rates have increased 12% this week compared to last week. Peak usage: 2-4 PM weekdays.",
      "Optimal collection route identified: Bins 4→2→6→1→3→5. Estimated time savings: 25 minutes per round."
    ];
    
    const containers = [
      'nextCollectionPrediction',
      'fillRateAnalysis', 
      'optimizationSuggestions'
    ];
    
    containers.forEach((containerId, index) => {
      const element = document.getElementById(containerId);
      if (element && mockInsights[index]) {
        element.textContent = mockInsights[index];
      }
    });
  }
  
  displayCollectionPredictions(predictions) {
    const highPriorityBins = predictions.filter(p => p.priority === 'high');
    
    if (highPriorityBins.length > 0) {
      const message = highPriorityBins
        .map(bin => `Bin ${bin.binId} (${bin.hoursRemaining}h remaining)`)
        .join(', ');
      
      this.showNotification(`Urgent collections needed: ${message}`, 'warning');
    }
  }
  
  updateNotifications() {
    const notificationContainer = document.getElementById('notifications');
    if (!notificationContainer) return;
    
    const urgentBins = this.binData.filter(bin => bin.fillLevel >= this.userSession.settings.alertThreshold);
    const warningBins = this.binData.filter(bin => bin.fillLevel >= 70 && bin.fillLevel < this.userSession.settings.alertThreshold);
    const lowBatteryBins = this.binData.filter(bin => bin.batteryLevel < 30);
    
    let notificationHtml = '';
    
    if (urgentBins.length > 0) {
      notificationHtml += urgentBins.map(bin => 
        `<div class="notification urgent">🚨 Bin ${bin.binId} is ${bin.fillLevel}% full - Immediate collection needed!</div>`
      ).join('');
    }
    
    if (warningBins.length > 0) {
      notificationHtml += warningBins.map(bin => 
        `<div class="notification warning">⚠️ Bin ${bin.binId} at ${bin.fillLevel}% - Monitor closely</div>`
      ).join('');
    }
    
    if (lowBatteryBins.length > 0) {
      notificationHtml += lowBatteryBins.map(bin => 
        `<div class="notification battery">🔋 Bin ${bin.binId} has low battery: ${bin.batteryLevel}%</div>`
      ).join('');
    }
    
    if (!notificationHtml) {
      notificationHtml = '<div class="notification success">✅ All systems operating normally</div>';
    }
    
    notificationContainer.innerHTML = notificationHtml;
  }
  
  // Settings handlers
  updateFontSize(size) {
    this.userSession.settings.fontSize = size;
    document.documentElement.style.setProperty('--font-size', size);
    this.saveSettings();
  }
  
  updateAlertThreshold(threshold) {
    this.userSession.settings.alertThreshold = threshold;
    document.getElementById('thresholdValue').textContent = threshold + '%';
    this.renderDashboard(); // Re-render with new threshold
    this.saveSettings();
  }
  
  updateRefreshInterval(interval) {
    this.userSession.settings.refreshInterval = interval;
    this.refreshInterval = interval;
    this.startRealTimeUpdates();
    this.saveSettings();
  }
  
  saveSettings() {
    // In a real app, this would save to backend
    console.log('Settings saved:', this.userSession.settings);
  }
  
  // Real-time updates
  startRealTimeUpdates() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(async () => {
      await this.refreshData();
    }, this.refreshInterval);
  }
  
  async refreshData() {
    try {
      if (this.isConnected) {
        const response = await this.makeApiCall('/bins');
        if (response.ok) {
          const data = await response.json();
          this.binData = this.processBinData(data);
        } else {
          throw new Error('API call failed');
        }
      } else {
        // Simulate data changes in demo mode
        this.simulateDataChanges();
      }
      
      this.renderDashboard();
      
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.simulateDataChanges();
      this.renderDashboard();
    }
  }
  
  simulateDataChanges() {
    this.binData.forEach(bin => {
      // Simulate fill level changes
      const change = (Math.random() - 0.5) * 3; // ±1.5% change
      bin.fillLevel = Math.max(0, Math.min(100, Math.round(bin.fillLevel + change)));
      
      // Simulate battery drain
      if (Math.random() < 0.1) { // 10% chance of battery change
        bin.batteryLevel = Math.max(20, bin.batteryLevel - 1);
      }
      
      // Update timestamp
      bin.timestamp = new Date();
    });
  }
  
  // WebSocket for real-time updates
  initializeWebSocket() {
    if (!this.isConnected) return;
    
    try {
      this.wsConnection = new WebSocket(`ws://localhost:5000/ws`);
      
      this.wsConnection.onopen = () => {
        console.log('📡 WebSocket connected');
        this.updateConnectionStatus(true);
      };
      
      this.wsConnection.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };
      
      this.wsConnection.onclose = () => {
        console.log('📡 WebSocket disconnected');
        this.updateConnectionStatus(false);
        
        // Attempt to reconnect
        if (this.retryCount < this.maxRetries) {
          setTimeout(() => {
            this.retryCount++;
            this.initializeWebSocket();
          }, 5000);
        }
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
    }
  }
  
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'bin_update':
        this.updateBinData(data.payload);
        break;
      case 'alert':
        this.showNotification(data.message, data.severity);
        break;
      case 'system_status':
        this.updateSystemStatus(data.payload);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }
  
  updateBinData(updatedBin) {
    const index = this.binData.findIndex(bin => bin.binId === updatedBin.binId);
    if (index !== -1) {
      this.binData[index] = { ...this.binData[index], ...updatedBin };
      this.renderDashboard();
    }
  }
  
  updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.innerHTML = connected ? '🟢 Connected' : '🔴 Disconnected';
    }
    this.isConnected = connected;
  }
  
  handleConnectionChange(online) {
    if (online && !this.isConnected) {
      this.loadInitialData();
      this.initializeWebSocket();
    }
  }
  
  // User actions
  showBinDetails(bin) {
    const modal = this.createBinDetailsModal(bin);
    document.body.appendChild(modal);
  }
  
  createBinDetailsModal(bin) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Bin ${bin.binId} Details</h2>
          <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <label>Fill Level:</label>
              <span class="${this.getBinStatusClass(bin.fillLevel)}">${bin.fillLevel}%</span>
            </div>
            <div class="detail-item">
              <label>Location:</label>
              <span>${bin.location}</span>
            </div>
            <div class="detail-item">
              <label>Battery Level:</label>
              <span>${bin.batteryLevel}%</span>
            </div>
            <div class="detail-item">
              <label>Temperature:</label>
              <span>${bin.temperature}°C</span>
            </div>
            <div class="detail-item">
              <label>Last Emptied:</label>
              <span>${bin.lastEmptied.toLocaleString()}</span>
            </div>
            <div class="detail-item">
              <label>Sensor Status:</label>
              <span>${bin.sensorStatus}</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="dashboardController.scheduleCollection(${bin.binId})">Schedule Collection</button>
          <button class="btn btn-secondary" onclick="dashboardController.scheduleMaintenance(${bin.binId})">Schedule Maintenance</button>
        </div>
      </div>
    `;
    
    // Close modal when clicking overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    return modal;
  }
  
  scheduleCollection(binId) {
    this.showNotification(`Collection scheduled for Bin ${binId}`, 'success');
    // Close any open modals
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
  }
  
  scheduleMaintenance(binId) {
    this.showNotification(`Maintenance scheduled for Bin ${binId}`, 'success');
    // Close any open modals
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
  }
  
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide notification after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
  
  filterByDate(dateString) {
    if (!dateString) return;
    
    const selectedDate = new Date(dateString);
    console.log('Filtering data for date:', selectedDate.toLocaleDateString());
    
    // In a real app, this would fetch historical data for the selected date
    // For demo, we'll just show a notification
    this.showNotification(`Showing data for ${selectedDate.toLocaleDateString()}`, 'info');
  }
  
  changePassword() {
    const newPasswordInput = document.getElementById('newPassword');
    const newPassword = newPasswordInput.value;
    
    if (newPassword.length < 6) {
      this.showNotification('Password must be at least 6 characters long', 'error');
      return;
    }
    
    // Simulate password change
    this.showNotification('Password updated successfully!', 'success');
    newPasswordInput.value = '';
  }
  
  logout() {
    if (confirm('Are you sure you want to logout?')) {
      this.cleanup();
      
      // Clear session data
      this.userSession = null;
      
      // In a real app, redirect to login page
      this.showNotification('Logged out successfully!', 'success');
      
      // For demo, just reload the page
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }
  
  cleanup() {
    // Clear timers
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    // Close WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    
    // Destroy charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
  }
}

// Initialize dashboard when DOM is ready
let dashboardController;

document.addEventListener('DOMContentLoaded', () => {
  dashboardController = new DashboardController();
});

// Global functions for button onclick handlers
window.changePassword = () => dashboardController?.changePassword();
window.logout = () => dashboardController?.logout();