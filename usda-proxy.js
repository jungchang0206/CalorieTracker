// usda-proxy.js
require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');
const app = express();

const USDA_API_KEY = process.env.USDA_API_KEY;
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

app.use(cors());

app.get('/api/foods/search', async (req, res) => {
    const { query, pageSize = 20 } = req.query;
    const url = `${BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=Branded,Foundation,SR%20Legacy`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('USDA API error:', response.status, errorText);
            return res.status(500).json({ error: 'USDA API error', status: response.status, details: errorText });
        }
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Fetch failed:', err);
        res.status(500).json({ error: 'Failed to fetch from USDA API' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));