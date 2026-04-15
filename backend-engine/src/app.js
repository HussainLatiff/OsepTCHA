require('dotenv').config();
const express = require('express');
const cors = require('cors');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3001;

const path = require('path');

// Middlewares
app.use(cors());
app.use(express.json());

// Serve assets folder statically
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// Routes
const generateRoutes = require('./routes/generate');
const verifyRoutes = require('./routes/verify');

app.use('/api/config', configRoutes);
app.use('/api/generate-challenge', generateRoutes);
app.use('/api/verify', verifyRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Backend Engine running on port ${PORT}`);
    });
}

module.exports = app;
