require('dotenv').config({ path: './.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/authRoutes');
const binRoutes = require('./routes/binroutes');

// Import models
const User = require('./models/user');
const Bin = require('./models/bin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  } 
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://DBgroup4:we.group4@cluster0.ymvsjzo.mongodb.net/smartbin';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ Connected to MongoDB Atlas');
  await initializeDefaultData();
})
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Initialize default data
async function initializeDefaultData() {
  try {
    // Check if we have any bins, if not create some default ones
    const binCount = await Bin.countDocuments();
    if (binCount === 0) {
      console.log('📦 Creating default bins...');
      const defaultBins = [
        {
          binId: 1,
          location: 'Main Building - Lobby',
          fillLevel: 45,
          batteryLevel: 85,
          temperature: 22,
          sensorStatus: 'active',
          lastEmptied: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)),
          capacity: 100
        },
        {
          binId: 2,
          location: 'Cafeteria - East Wing',
          fillLevel: 72,
          batteryLevel: 92,
          temperature: 24,
          sensorStatus: 'active',
          lastEmptied: new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)),
          capacity: 100
        },
        {
          binId: 3,
          location: 'Office Block - Floor 2',
          fillLevel: 28,
          batteryLevel: 78,
          temperature: 21,
          sensorStatus: 'active',
          lastEmptied: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)),
          capacity: 100
        },
        {
          binId: 4,
          location: 'Parking Garage - Level B1',
          fillLevel: 89,
          batteryLevel: 67,
          temperature: 19,
          sensorStatus: 'warning',
          lastEmptied: new Date(Date.now() - (0.5 * 24 * 60 * 60 * 1000)),
          capacity: 100
        },
        {
          binId: 5,
          location: 'Conference Center',
          fillLevel: 61,
          batteryLevel: 90,
          temperature: 23,
          sensorStatus: 'active',
          lastEmptied: new Date(Date.now() - (2.5 * 24 * 60 * 60 * 1000)),
          capacity: 100
        },
        {
          binId: 6,
          location: 'Emergency Exit - Stairwell',
          fillLevel: 15,
          batteryLevel: 45,
          temperature: 18,
          sensorStatus: 'low_battery',
          lastEmptied: new Date(Date.now() - (4 * 24 * 60 * 60 * 1000)),
          capacity: 100
        }
      ];

      await Bin.insertMany(defaultBins);
      console.log('✅ Default bins created successfully');
    }

    // Check if we have any users, if not create a default admin
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('👤 Creating default admin user...');
      const defaultAdmin = new User({
        username: 'admin',
        email: 'admin@smartwaste.com',
        phoneNumber: '1234567890',
        password: 'admin123',
        role: 'administrator'
      });
      await defaultAdmin.save();
      console.log('✅ Default admin user created');
    }
  } catch (error) {
    console.error('❌ Error initializing default data:', error);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bin', binRoutes);

// Registration endpoint (keeping your existing one)
app.post('/api/register', async (req, res) => {
  const { username, email, phoneNumber, password, role } = req.body;

  console.log("📩 Incoming registration request:", req.body);

  if (!username || !email || !phoneNumber || !password || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }

    const newUser = new User({ username, email, phoneNumber, password, role });
    await newUser.save();
    console.log("✅ User registered:", newUser.username);
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// Bins endpoint
app.get('/api/bins', async (req, res) => {
  try {
    const bins = await Bin.find().sort({ binId: 1 });
    res.json(bins);
  } catch (error) {
    console.error('Error fetching bins:', error);
    res.status(500).json({ message: 'Error fetching bins', error: error.message });
  }
});

// Get specific bin
app.get('/api/bins/:binId', async (req, res) => {
  try {
    const bin = await Bin.findOne({ binId: parseInt(req.params.binId) });
    if (!bin) {
      return res.status(404).json({ message: 'Bin not found' });
    }
    res.json(bin);
  } catch (error) {
    console.error('Error fetching bin:', error);
    res.status(500).json({ message: 'Error fetching bin', error: error.message });
  }
});

// Create new bin
app.post('/api/bins', async (req, res) => {
  try {
    const { binId, location, capacity = 100 } = req.body;
    
    if (!binId || !location) {
      return res.status(400).json({ message: 'binId and location are required' });
    }

    // Check if bin with this ID already exists
    const existingBin = await Bin.findOne({ binId });
    if (existingBin) {
      return res.status(400).json({ message: 'Bin with this ID already exists' });
    }

    const newBin = new Bin({
      binId,
      location,
      capacity,
      fillLevel: 0,
      batteryLevel: 100,
      temperature: 20,
      sensorStatus: 'active',
      lastEmptied: new Date()
    });

    await newBin.save();
    
    // Emit new bin data to connected clients
    io.emit('binUpdate', {
      type: 'bin_added',
      bin: newBin
    });

    res.status(201).json({
      message: 'Bin created successfully',
      bin: newBin
    });
  } catch (error) {
    console.error('Error creating bin:', error);
    res.status(500).json({ message: 'Error creating bin', error: error.message });
  }
});

// Update bin data
app.put('/api/bins/:binId', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    const updateData = req.body;
    
    const updatedBin = await Bin.findOneAndUpdate(
      { binId },
      { 
        ...updateData,
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!updatedBin) {
      return res.status(404).json({ message: 'Bin not found' });
    }

    // Emit updated bin data to connected clients
    io.emit('binUpdate', {
      type: 'bin_updated',
      bin: updatedBin
    });

    res.json({
      message: 'Bin updated successfully',
      bin: updatedBin
    });
  } catch (error) {
    console.error('Error updating bin:', error);
    res.status(500).json({ message: 'Error updating bin', error: error.message });
  }
});

// Delete bin
app.delete('/api/bins/:binId', async (req, res) => {
  try {
    const binId = parseInt(req.params.binId);
    const deletedBin = await Bin.findOneAndDelete({ binId });

    if (!deletedBin) {
      return res.status(404).json({ message: 'Bin not found' });
    }

    // Emit bin deletion to connected clients
    io.emit('binUpdate', {
      type: 'bin_deleted',
      binId: binId
    });

    res.json({ message: 'Bin deleted successfully' });
  } catch (error) {
    console.error('Error deleting bin:', error);
    res.status(500).json({ message: 'Error deleting bin', error: error.message });
  }
});

// Analytics endpoints
app.get('/api/analytics', (req, res) => {
  res.json({
    message: 'Analytics endpoint',
    totalBins: 6,
    averageFillLevel: 52,
    collectionsToday: 3,
    systemEfficiency: 87
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// WebSocket events
io.on('connection', (socket) => {
  console.log('🟢 WebSocket client connected:', socket.id);

  // Send current bin data to newly connected client
  Bin.find().sort({ binId: 1 }).then(bins => {
    socket.emit('binUpdate', {
      type: 'initial_data',
      bins: bins
    });
  });

  socket.on('binUpdate', (data) => {
    console.log('📊 Bin update received:', data);
    io.emit('binUpdate', data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 WebSocket client disconnected:', socket.id);
  });
});

// Make io accessible globally
app.set('io', io);

// Simulate real-time data updates
setInterval(async () => {
  try {
    const bins = await Bin.find();
    
    // Randomly update one bin's fill level
    if (bins.length > 0) {
      const randomBin = bins[Math.floor(Math.random() * bins.length)];
      const fillChange = (Math.random() - 0.5) * 5; // ±2.5% change
      const newFillLevel = Math.max(0, Math.min(100, randomBin.fillLevel + fillChange));
      
      // Update in database
      await Bin.findOneAndUpdate(
        { binId: randomBin.binId },
        { 
          fillLevel: Math.round(newFillLevel),
          lastUpdated: new Date()
        }
      );

      // Emit update to clients
      io.emit('binUpdate', {
        type: 'fill_level_update',
        binId: randomBin.binId,
        fillLevel: Math.round(newFillLevel)
      });
    }
  } catch (error) {
    console.error('Error in real-time update:', error);
  }
}, 30000); // Update every 30 seconds

// Fallback 404 route
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

module.exports = app;