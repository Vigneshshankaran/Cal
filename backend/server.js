require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sendPDFReport } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Email Endpoint
app.post('/send-email', async (req, res) => {
    const { to_email, pdfBase64, summaryData } = req.body;

    if (!to_email || !pdfBase64) {
        return res.status(400).json({ success: false, message: 'Missing email or PDF data' });
    }

    try {
        const info = await sendPDFReport(to_email, pdfBase64, summaryData);
        console.log('Email sent successfully to:', to_email, '| Info:', info.response);
        res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send email. Check if your App Password is correct.' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
