const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

async function generatePDF(htmlContent) {
    let browser;
    try {
        const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
        
        let options = {};
        
        if (isVercel) {
            console.log('Running in serverless environment (Vercel/Lambda)');
            options = {
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
                ignoreHTTPSErrors: true,
            };
        } else {
            console.log('Running in local environment');
            options = {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                headless: true,
                executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            };
        }

        browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        
        await page.setViewport({ width: 1280, height: 720 });
        
        // Use faster wait condition and set timeout
        await page.setContent(htmlContent, { 
            waitUntil: 'domcontentloaded', 
            timeout: 20000 
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        });

        return pdfBuffer;
    } catch (error) {
        console.error('CRITICAL PDF ERROR:', error.message);
        throw error;
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (err) {
                console.error('Error closing browser:', err);
            }
        }
    }
}

module.exports = { generatePDF };

