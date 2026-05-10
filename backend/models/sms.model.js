const axios = require('axios');

/**
 * Format phone numbers to 255XXXXXXXXX (BrandBox international format)
 */
const formatNumber = (num) => {
  let f = String(num).replace(/\s+/g, '').replace(/^\+/, '');
  if (f.startsWith('255'))      return f;               // already correct
  if (f.startsWith('0'))        return '255' + f.slice(1);
  if (f.length === 9)           return '255' + f;       // bare 9-digit
  return '255' + f;
};

const isValidNumber = (num) => /^255\d{9}$/.test(num);

/**
 * Send SMS via BrandBox Bulk API (single recipient per call)
 * POST https://smsbulkapi.brandbox.co.tz/api/sms/v1/text/single
 *
 * @param {string}   message      - SMS text body
 * @param {string[]} phoneNumbers - Array of phone numbers (any local/intl format)
 * @param {object}   settings     - { api_key, api_secret_key, sender_name }
 * @param {number}   maxRetries   - Max retry attempts on transient failures (default 3)
 */
const sendSmsBrandBox = async (message, phoneNumbers, settings, maxRetries = 3) => {
  if (!message?.trim())          throw new Error('SMS message cannot be empty');
  if (!phoneNumbers)             throw new Error('Phone number(s) required');
  if (!settings?.api_key)        throw new Error('BrandBox API key is required');
  if (!settings?.api_secret_key) throw new Error('BrandBox API secret key is required');
  if (!settings?.sender_name)    throw new Error('BrandBox sender name is required');

  const numbersArray = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];

  const formattedNumbers = numbersArray
    .map(formatNumber)
    .filter(isValidNumber);

  if (!formattedNumbers.length) throw new Error('No valid phone numbers after formatting');

  const results = [];
  const failed  = [];

  for (const phone of formattedNumbers) {
    let lastError = null;
    let sent      = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          'https://smsbulkapi.brandbox.co.tz/api/sms/v1/text/single',
          {
            from: settings.sender_name,
            to:   phone,
            text: message.trim(),
          },
          {
            headers: {
              'api-key':      settings.api_key,
              'api-secret':   settings.api_secret_key,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );

        const msgResult = response.data?.messages?.[0];
        results.push({
          phone,
          messageId:   msgResult?.messageId            || null,
          statusName:  msgResult?.status?.name         || 'UNKNOWN',
          statusGroup: msgResult?.status?.groupName    || 'UNKNOWN',
          description: msgResult?.status?.description  || null,
        });

        sent = true;
        break;

      } catch (error) {
        lastError = error;
        const statusCode   = error?.response?.status;
        const errorMessage = error?.response?.data?.message
          || error?.response?.data?.error
          || error.message;

        // Non-retriable — fail immediately
        if ([401, 403].includes(statusCode))
          throw new Error('BrandBox authentication failed: Invalid API key/secret');
        if (statusCode === 400)
          throw new Error(`BrandBox bad request: ${errorMessage}`);
        if (statusCode === 429)
          throw new Error('BrandBox rate limit exceeded. Please try again later.');

        // Retriable
        const shouldRetry =
          [502, 503, 504].includes(statusCode) ||
          ['ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(error.code);

        if (shouldRetry && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    if (!sent) {
      failed.push({ phone, error: `Failed after ${maxRetries} attempts: ${lastError?.message}` });
    }
  }

  return {
    success:      failed.length === 0,
    total:        formattedNumbers.length,
    sent:         results.length,
    failed_count: failed.length,
    results,
    failed,
  };
};

module.exports = { sendSmsBrandBox };
