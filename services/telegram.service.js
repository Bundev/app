const https = require('https');

const TELEGRAM_API_HOST = 'api.telegram.org';

function formatSaleReceipt(receipt) {
    const lines = [];

    receipt.items.forEach((item, index) => {
        if (index > 0) lines.push('');
        lines.push(item.name);
        lines.push(`Количество: ${item.quantity} ${item.unit}`.trim());
        lines.push(`Цена: ${item.price} ₴`);
    });

    return lines.join('\n');
}

function sendMessage(text, options = {}) {
    const token = options.token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        return Promise.resolve({ sent: false, reason: 'not_configured' });
    }

    const body = JSON.stringify({
        chat_id: chatId,
        text
    });

    return new Promise((resolve, reject) => {
        const request = https.request({
            hostname: TELEGRAM_API_HOST,
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 5000
        }, response => {
            let responseBody = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                responseBody += chunk;
            });
            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    return resolve({ sent: true });
                }

                let description = '';
                try {
                    description = JSON.parse(responseBody).description || '';
                } catch (_) {
                    description = responseBody;
                }
                const details = description ? `: ${description}` : '';
                return reject(new Error(`Telegram вернул HTTP ${response.statusCode}${details}`));
            });
        });

        request.on('timeout', () => request.destroy(new Error('Тайм-аут Telegram')));
        request.on('error', reject);
        request.end(body);
    });
}

function sendSaleReceipt(receipt) {
    return sendMessage(formatSaleReceipt(receipt));
}

module.exports = {
    formatSaleReceipt,
    sendMessage,
    sendSaleReceipt
};
