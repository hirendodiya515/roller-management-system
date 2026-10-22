const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const emailjs = require('@emailjs/nodejs');

admin.initializeApp();
const db = admin.firestore();

// Scheduled function - runs daily at 9:30 AM IST
// Using 2nd Gen Cloud Functions
exports.sendDailyAlerts = onSchedule({
    schedule: "30 9 * * *",
    timeZone: "Asia/Kolkata",
    region: "us-central1", // Keeping default region to match your project setup
}, async (event) => {
    logger.log('Starting daily alert check...');

    try {
        const result = await runAlertCheck();
        if (result) {
            logger.log(`Alert check complete: ${result.checked} rollers checked. Batch emails sent.`);
        }
        return null;
    } catch (error) {
        logger.error('Error in sendDailyAlerts:', error);
        return null;
    }
});

// HTTP Trigger for manual testing
exports.testDailyAlerts = onRequest({
    region: "us-central1",
    cors: true // Allow calling from browser/frontend
}, async (req, res) => {
    logger.log('Starting manual alert check test...');
    try {
        const result = await runAlertCheck();
        res.status(200).json({
            success: true,
            message: "Alert check complete",
            data: result
        });
    } catch (error) {
        logger.error('Error in testDailyAlerts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Core Logic Wrapper
async function runAlertCheck() {
    // Fetch alert configuration
    const alertConfigDoc = await db.collection('settings').doc('alerts').get();
    const alertConfig = alertConfigDoc.exists ? alertConfigDoc.data() : null;

    if (!alertConfig) {
        logger.log('No alert configuration found');
        return null;
    }

    // Fetch EmailJS configuration
    const emailJsConfigDoc = await db.collection('settings').doc('emailjs').get();
    const emailJsConfig = emailJsConfigDoc.exists ? emailJsConfigDoc.data() : null;

    if (!emailJsConfig || !emailJsConfig.serviceId || !emailJsConfig.templateId || !emailJsConfig.publicKey) {
        logger.log('EmailJS configuration is missing');
        return null;
    }

    // Initialize EmailJS
    emailjs.init({ publicKey: emailJsConfig.publicKey, privateKey: emailJsConfig.privateKey });

    // Run alert check
    return await checkAndTriggerAlerts(alertConfig, emailJsConfig);
}

// Helper function to reliably parse dates from various formats (Timestamp, String, Date)
function parseRecordDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
        if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
                // DD/MM/YYYY
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
        }
        if (dateVal.includes('-')) {
            const parts = dateVal.split('T')[0].split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    // YYYY-MM-DD
                    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
                // DD-MM-YYYY
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
        }
        const parsed = new Date(dateVal);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (dateVal.toDate && typeof dateVal.toDate === 'function') {
        return dateVal.toDate();
    }
    if (dateVal.seconds) {
        return new Date(dateVal.seconds * 1000);
    }
    if (dateVal instanceof Date) {
        return dateVal;
    }
    return null;
}

// Helper function to format date consistently as DD/MM/YYYY
function formatDateDDMMYYYY(dateVal) {
    const d = parseRecordDate(dateVal);
    if (!d || isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Alert checking logic (adapted from alertService.js)
async function checkAndTriggerAlerts(config, emailJsConfig) {
    let checked = 0;
    
    // Arrays to hold rollers for delay batching
    const delayedSendRollers = [];
    const delayedReceiveRollers = [];
    
    // Inventory Counters for Ready to Use Alert
    // Grouping SG#3.1 and SG#3.2 into SG#3 as per requirements
    const readyToUseCounts = {
        'SG#1': { Top: 0, Bottom: 0 },
        'SG#2': { Top: 0, Bottom: 0 },
        'SG#3': { Top: 0, Bottom: 0 }
    };

    try {
        const rollersSnapshot = await db.collection('rollers').get();
        const rollers = rollersSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(r => !r.isDeleted);
        checked = rollers.length;

        for (const roller of rollers) {
            // Skip rollers where mail alerts are disabled (e.g. inactive pattern rollers)
            if (roller.mailAlertsEnabled === false) {
                continue;
            }

            try {
                const recordsSnapshot = await db.collection(`rollers/${roller.id}/records`).get();

                // Get all records sorted descending by date
                const allRecords = recordsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => {
                        const dateA = parseRecordDate(a.date) || new Date(0);
                        const dateB = parseRecordDate(b.date) || new Date(0);
                        return dateB - dateA;
                    });

                if (allRecords.length === 0) continue;

                // Approved records (excluding Roller PDI for status calculation)
                const approvedRecords = allRecords
                    .filter(record => record.status === 'Approved' && record.activity !== 'Roller PDI');

                const latestApprovedRecord = approvedRecords.length > 0 ? approvedRecords[0] : null;
                const latestRecord = allRecords[0];

                // Determine Current Status based on Latest Record
                let calculatedStatus = 'No Activity';
                const statusSourceRecord = latestApprovedRecord || latestRecord;
                if (statusSourceRecord) {
                    if (statusSourceRecord.activity === 'Roller Received') {
                        const allKeys = Object.keys(statusSourceRecord);
                        const readyToUseKey = allKeys.find(key => key.toLowerCase().startsWith('ready_to_use'));
                        const readyValue = readyToUseKey ? statusSourceRecord[readyToUseKey] : undefined;
                        calculatedStatus = readyValue === 'Yes' ? 'Ready to Use' : 'To be sent';
                    } else if (statusSourceRecord.activity === 'Production Start') {
                        calculatedStatus = 'Running';
                    } else if (statusSourceRecord.activity === 'Production End') {
                        calculatedStatus = 'To be sent';
                    } else if (statusSourceRecord.activity === 'Roller sent') {
                        calculatedStatus = 'Sent to Vendor';
                    } else if (statusSourceRecord.activity === 'Scrap') {
                        calculatedStatus = 'Scrap';
                    }
                }

                // Support both database currentStatus ('To be sent' / 'Sent to Vendor') and fallback calculatedStatus
                const currentOrCalcStatus = roller.currentStatus || calculatedStatus;

                // --- Feature: Ready to Use Counter ---
                if (currentOrCalcStatus === 'Ready to Use') {
                    let lineKey = roller.line;
                    if (lineKey === 'SG#3.1' || lineKey === 'SG#3.2') {
                        lineKey = 'SG#3';
                    }
                    
                    const positionKey = roller.position;
                    if (readyToUseCounts[lineKey] && (positionKey === 'Top' || positionKey === 'Bottom')) {
                        readyToUseCounts[lineKey][positionKey]++;
                    }
                }

                const now = new Date();

                // =========================================================================
                // Alert 1: Delay in sending roller to vendor (Status: 'To be sent' / 'Production End')
                // =========================================================================
                const isDelayInSend = (currentOrCalcStatus === 'To be sent' || currentOrCalcStatus === 'Production End');
                if (config.productionEndDelay?.enabled && isDelayInSend) {
                    // Check allRecords (both Approved and Pending) to find the relevant Production End record.
                    // This prevents falling back to an old Production Start date if Production End is pending approval.
                    const prodEndRecord = allRecords.find(r => 
                        r.activity === 'Production End' || 
                        (r.activity === 'Roller Received' && (r.ready_to_use === 'No' || r.readyToUse === 'No'))
                    ) ||
                    latestApprovedRecord ||
                    latestRecord;

                    const recordDate = parseRecordDate(prodEndRecord?.date);

                    if (recordDate) {
                        const diffTime = now.getTime() - recordDate.getTime();
                        // Only count elapsed days if date is in the past
                        const diffDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

                        if (diffDays > config.productionEndDelay.days) {
                            const shouldSend = await checkLastAlertDate(roller.id, 'To be sent');
                            if (shouldSend) {
                                const statusLabel = prodEndRecord.status === 'Pending'
                                    ? `${currentOrCalcStatus} (Pending Approval)`
                                    : currentOrCalcStatus;
                                delayedSendRollers.push({ ...roller, currentStatus: statusLabel, diffDays, recordDate });
                            }
                        }
                    }
                }

                // =========================================================================
                // Alert 2: Delay in receiving roller from vendor (Status: 'Sent to Vendor' / 'Roller sent')
                // =========================================================================
                const isDelayInReceive = (currentOrCalcStatus === 'Sent to Vendor' || currentOrCalcStatus === 'Roller sent');
                if (config.rollerSentDelay?.enabled && isDelayInReceive) {
                    // Check allRecords (both Approved and Pending) to find the relevant Roller sent record
                    const sentRecord = allRecords.find(r => r.activity === 'Roller sent') ||
                        latestApprovedRecord ||
                        latestRecord;

                    const recordDate = parseRecordDate(sentRecord?.date);

                    if (recordDate) {
                        const diffTime = now.getTime() - recordDate.getTime();
                        const diffDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

                        if (diffDays > config.rollerSentDelay.days) {
                            const shouldSend = await checkLastAlertDate(roller.id, 'Sent to Vendor');
                            if (shouldSend) {
                                // Extract Vendor Name from the sent record
                                const allKeys = Object.keys(sentRecord || {});
                                const vendorKey = allKeys.find(key => 
                                    key.toLowerCase().includes('vendor') || 
                                    key.toLowerCase().includes('supplier') ||
                                    key.toLowerCase().includes('party')
                                );
                                const vendorName = vendorKey && sentRecord[vendorKey] ? String(sentRecord[vendorKey]).trim() : '-';
                                
                                const statusLabel = sentRecord.status === 'Pending'
                                    ? `${currentOrCalcStatus} (Pending Approval)`
                                    : currentOrCalcStatus;
                                delayedReceiveRollers.push({ ...roller, currentStatus: statusLabel, diffDays, recordDate, vendorName });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing roller ${roller.id}:`, error);
                continue;
            }
        }

        // --- Execute Delay Batch Emails ---
        if (delayedSendRollers.length > 0) {
            await sendBulkAlertEmail(delayedSendRollers, "Delayed in send roller to vendor", emailJsConfig);
            for (const roller of delayedSendRollers) await updateLastAlertDate(roller.id, 'To be sent');
        }

        if (delayedReceiveRollers.length > 0) {
            await sendBulkAlertEmail(delayedReceiveRollers, "Delayed in receive roller from vendor", emailJsConfig);
            for (const roller of delayedReceiveRollers) await updateLastAlertDate(roller.id, 'Sent to Vendor');
        }

        // --- Execute Ready to Use Low Stock Alert ---
        if (config.readyToUseAlert?.enabled) {
            const minQty = config.readyToUseAlert.minimum || 0;
            let shouldTriggerReadyAlert = false;

            // Check if ANY line is below threshold
            Object.values(readyToUseCounts).forEach(lineCounts => {
                if (lineCounts.Top < minQty || lineCounts.Bottom < minQty) {
                    shouldTriggerReadyAlert = true;
                }
            });

            if (shouldTriggerReadyAlert) {
                // Check frequency? Requirement doesn't specify weekly/daily frequency limits for this alert type.
                // Assuming daily alert is fine since it's a "State" alert.
                await sendReadyToUseAlert(readyToUseCounts, minQty, emailJsConfig);
            }
        }

    } catch (error) {
        console.error("Error in checkAndTriggerAlerts:", error);
        throw error;
    }

    return { 
        checked, 
        sendDelayCount: delayedSendRollers.length, 
        receiveDelayCount: delayedReceiveRollers.length,
        readyToUseCounts
    };
}

async function checkLastAlertDate(rollerId, status) {
    try {
        const alertDoc = await db.collection('rollerAlerts').doc(`${rollerId}_${status}`).get();

        if (!alertDoc.exists) {
            return true;
        }

        const lastAlertData = alertDoc.data();
        const lastAlertDate = lastAlertData.lastSent.toDate();
        const now = new Date();
        const daysSinceLastAlert = Math.ceil((now - lastAlertDate) / (1000 * 60 * 60 * 24));

        return daysSinceLastAlert >= 7;
    } catch (error) {
        console.warn("Could not check last alert date:", error.message);
        return true;
    }
}

async function updateLastAlertDate(rollerId, status) {
    try {
        await db.collection('rollerAlerts').doc(`${rollerId}_${status}`).set({
            rollerId,
            status,
            lastSent: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.warn("Could not update last alert date:", error.message);
    }
}

async function sendBulkAlertEmail(rollers, alertType, emailJsConfig) {
    const htmlContent = generateBulkEmailHtml(rollers, alertType);

    const toEmails = emailJsConfig.toEmails ? emailJsConfig.toEmails.split(',').map(e => e.trim()).filter(e => e) : ['hiren.dodiya@borosil.com'];
    const ccEmails = emailJsConfig.ccEmails ? emailJsConfig.ccEmails.split(',').map(e => e.trim()).filter(e => e) : [];

    const allRecipients = [...toEmails, ...ccEmails].join(', ');

    const templateParams = {
        title: `${alertType} - ${rollers.length} Pending Rollers`, // Summary title
        message: htmlContent,
        name: 'Roller Alert System',
        email: 'hiren.dodiya@borosil.com',
        to_email: allRecipients
    };

    try {
        const sendOptions = { publicKey: emailJsConfig.publicKey };
        if (emailJsConfig.privateKey) {
            sendOptions.privateKey = emailJsConfig.privateKey;
        }

        await emailjs.send(
            emailJsConfig.serviceId,
            emailJsConfig.templateId,
            templateParams,
            sendOptions
        );
        console.log(`✅ Bulk email sent for ${alertType} to: ${allRecipients}`);
    } catch (error) {
        console.error("❌ Error sending email:", error);
    }
}

function generateBulkEmailHtml(rollers, alertType) {
    const color = '#d32f2f';
    const isReceiveDelay = alertType === "Delayed in receive roller from vendor";

    const rowRows = rollers.map(roller => {
        const date = formatDateDDMMYYYY(roller.recordDate);
        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; border: 1px solid #ddd;">${roller.rollerNumber || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: ${color}; font-weight: bold;">${roller.diffDays} Days</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${roller.currentStatus}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${roller.line || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${roller.position || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
            ${isReceiveDelay ? `<td style="padding: 10px; border: 1px solid #ddd;">${roller.vendorName || '-'}</td>` : ''}
        </tr>
        `;
    }).join('');

    return `
    <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
      <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Roller Delay Report</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">${alertType}</p>
      </div>
      
      <div style="background-color: white; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <p style="color: #666; margin-bottom: 20px;">
            The following <strong>${rollers.length}</strong> rollers are overdue for the activity: <strong>${alertType}</strong>.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Roller No.</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Overdue</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Line</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Position</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
              ${isReceiveDelay ? '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Vendor</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rowRows}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Roller Management System • Automated Batch Alert</p>
      </div>
    </div>
  `;
}

async function sendReadyToUseAlert(counts, minQty, emailJsConfig) {
    const htmlContent = generateReadyToUseHtml(counts, minQty);

    const toEmails = emailJsConfig.toEmails ? emailJsConfig.toEmails.split(',').map(e => e.trim()).filter(e => e) : ['hiren.dodiya@borosil.com'];
    const ccEmails = emailJsConfig.ccEmails ? emailJsConfig.ccEmails.split(',').map(e => e.trim()).filter(e => e) : [];

    const allRecipients = [...toEmails, ...ccEmails].join(', ');

    const templateParams = {
        title: `CRITICAL: Low Ready to Use Stock - Below ${minQty}`,
        message: htmlContent,
        name: 'Roller Alert System',
        email: 'hiren.dodiya@borosil.com',
        to_email: allRecipients
    };

    try {
        const sendOptions = { publicKey: emailJsConfig.publicKey };
        if (emailJsConfig.privateKey) {
            sendOptions.privateKey = emailJsConfig.privateKey;
        }

        await emailjs.send(
            emailJsConfig.serviceId,
            emailJsConfig.templateId,
            templateParams,
            sendOptions
        );
        console.log(`✅ Ready to Use alert sent to: ${allRecipients}`);
    } catch (error) {
        console.error("❌ Error sending Ready to Use alert:", error);
    }
}

function generateReadyToUseHtml(counts, minQty) {
    const color = '#d32f2f'; // Red for Alert
    const greenColor = '#388E3C'; // Green for OK

    // Helper to generate a cell with conditional formatting
    const renderCell = (qty) => {
        const isLow = qty < minQty;
        const cellColor = isLow ? color : greenColor;
        const bgColor = isLow ? '#ffebee' : '#e8f5e9';
        const fontWeight = isLow ? 'bold' : 'normal';
        return `
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: ${cellColor}; background-color: ${bgColor}; font-weight: ${fontWeight};">
            ${qty}
        </td>`;
    };

    const tableRows = Object.keys(counts).map(line => {
        return `
        <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">${line}</td>
            ${renderCell(counts[line].Top)}
            ${renderCell(counts[line].Bottom)}
        </tr>
        `;
    }).join('');

    return `
    <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
      <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Low Stock Alert</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">Ready to Use Rollers</p>
      </div>
      
      <div style="background-color: white; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <p style="color: #666; margin-bottom: 20px; text-align: center;">
            The inventory for "Ready to Use" rollers has fallen below the minimum threshold of <strong>${minQty}</strong> for one or more lines.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Line</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Top</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Bottom</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Roller Management System • Automated Inventory Alert</p>
      </div>
    </div>
  `;
}
