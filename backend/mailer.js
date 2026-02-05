const nodemailer = require('nodemailer');

/**
 * Sends a high-quality PDF report via Gmail SMTP using Nodemailer.
 */
async function sendPDFReport(to_email, pdfBase64, summaryData) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        throw new Error('GMAIL_USER or GMAIL_PASS is not defined in the .env file.');
    }

    // Create transporter using Gmail service
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    const mailOptions = {
        from: { name: "SAFE Calculator", address: process.env.GMAIL_USER },
        to: [to_email],
        subject: 'Your SAFE Calculator Report',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #5F17EA;">SAFE Calculator Report</h2>
                <p>Hello,</p>
                <p>Here is your calculation summary:</p>
                <div style="background: #f8f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eef;">
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin-bottom: 8px;"><strong>Founder Ownership:</strong> ${summaryData.founderOwnership}</li>
                        <li style="margin-bottom: 8px;"><strong>Dilution:</strong> ${summaryData.founderDilution}</li>
                        <li style="margin-bottom: 8px;"><strong>Post-Money Valuation:</strong> ${summaryData.postMoney}</li>
                    </ul>
                </div>
                <p>Please find the detailed PDF report attached.</p>
                <br/>
                <p style="color: #666; font-size: 13px;">Best regards,<br/>SAFE Calculator Team</p>
            </div>
        `,
        attachments: [
            {
                filename: `SAFE_Report_${new Date().toISOString().split('T')[0]}.pdf`,
                content: pdfBase64,
                encoding: 'base64',
                contentType: 'application/pdf'
            }
        ]
    };

    return await transporter.sendMail(mailOptions);
}

module.exports = { sendPDFReport };

