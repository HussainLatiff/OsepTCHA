const redis = require('redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let isOfflineMode = false;
const fallbackStore = new Map();

// Standard Mock Client identical to redis API
const mockClient = {
    setEx: async (key, duration, value) => {
        fallbackStore.set(key, value);
        setTimeout(() => fallbackStore.delete(key), duration * 1000);
        return 'OK';
    },
    get: async (key) => fallbackStore.get(key) || null,
    del: async (key) => fallbackStore.delete(key)
};

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 2) {
                console.log('Redis natively unreachable. Seamlessly falling back to native Memory Map Cache.');
                isOfflineMode = true;
                return new Error('Offline fallback engaged.');
            }
            return Math.min(retries * 50, 500);
        }
    }
});

redisClient.on('error', (err) => {
    if (!isOfflineMode) console.log('Redis Connection Mode Shift:', err.message);
});

async function getClient() {
    if (isOfflineMode) return mockClient;
    
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
        } catch(e) {
            isOfflineMode = true;
            return mockClient;
        }
    }
    return redisClient;
}

module.exports = { getClient };
