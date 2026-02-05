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
        from: { name: "EquityList SAFE Calculator", address: process.env.GMAIL_USER },
        to: [to_email],
        subject: `Equity Report: Foundership ${summaryData.founderOwnership}`,
        html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #1e293b; line-height: 1.6;">
                <p>Hi ${summaryData.firstName},</p>
                <p>Thank you for using EquityList’s SAFE Calculator.</p>
                <p>Here’s a quick summary of the outcome you modeled:</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        <li style="margin-bottom: 10px;"><strong>Founder ownership post-round:</strong> ${summaryData.founderOwnership}</li>
                        <li style="margin-bottom: 10px;"><strong>Total founder dilution:</strong> ${summaryData.founderDilution}</li>
                        <li style="margin-bottom: 10px;"><strong>Post-money valuation:</strong> ${summaryData.postMoney}</li>
                        <li style="margin-bottom: 0;"><strong>Total raised (SAFEs + priced round):</strong> ${summaryData.totalRaised}</li>
                    </ul>
                </div>
                <p>We’ve attached the full calculation, including the post-round cap table, SAFE conversion, option pool impact, and investor ownership.</p>
                <br>
                <p>Best,<br><strong>Farheen, EquityList</strong><br><a href="https://equitylist.co" style="color: #5F17EA; text-decoration: none; font-weight: 600;">(Book a demo)</a></p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                    Note: This is a modeled outcome based on the assumptions you entered. Final results may vary based on documentation and execution.
                </p>
            </div>
        `,
        attachments: [
            {
                filename: `SAFE_Equity_Report_${new Date().toISOString().split('T')[0]}.pdf`,
                content: pdfBase64,
                encoding: 'base64',
                contentType: 'application/pdf'
            }
        ]
    };

    console.log(`Attempting to send email to ${to_email}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent! MessageId: ${info.messageId}`);
    return info;
}

module.exports = { sendPDFReport };

