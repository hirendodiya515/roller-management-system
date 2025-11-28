const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const emailjs = require('@emailjs/nodejs');

admin.initializeApp();
const db = admin.firestore();

// Scheduled function - runs daily at 9:00 AM IST (3:30 AM UTC)
// Using 2nd Gen Cloud Functions
exports.sendDailyAlerts = onSchedule({
    schedule: "30 3 * * *",
    timeZone: "Asia/Kolkata",
    region: "us-central1", // Keeping default region to match your project setup
}, async (event) => {
    logger.log('Starting daily alert check...');

    try {
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
        emailjs.init(emailJsConfig.publicKey);

        // Run alert check
        const result = await checkAndTriggerAlerts(alertConfig, emailJsConfig);

        logger.log(`Alert check complete: ${result.checked} rollers checked, ${result.alertsSent} alerts sent`);
        return null;
    } catch (error) {
        logger.error('Error in sendDailyAlerts:', error);
        return null;
    }
});

// Alert checking logic (adapted from alertService.js)
async function checkAndTriggerAlerts(config, emailJsConfig) {
    let alertsSent = 0;
    let checked = 0;

    try {
        const rollersSnapshot = await db.collection('rollers').get();
        const rollers = rollersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        checked = rollers.length;

        for (const roller of rollers) {
            try {
                const recordsSnapshot = await db.collection(`rollers/${roller.id}/records`).get();

                const approvedRecords = recordsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(record => record.status === 'Approved' && record.activity === roller.currentStatus)
                    .sort((a, b) => {
                        let dateA, dateB;

                        if (a.date && typeof a.date === 'string') {
                            const parts = a.date.split('/');
                            dateA = new Date(parts[2], parts[1] - 1, parts[0]);
                        } else if (a.date && a.date.toDate) {
                            dateA = a.date.toDate();
                        } else {
                            dateA = new Date(0);
                        }

                        if (b.date && typeof b.date === 'string') {
                            const parts = b.date.split('/');
                            dateB = new Date(parts[2], parts[1] - 1, parts[0]);
                        } else if (b.date && b.date.toDate) {
                            dateB = b.date.toDate();
                        } else {
                            dateB = new Date(0);
                        }

                        return dateB - dateA;
                    });

                if (approvedRecords.length === 0) continue;

                const latestRecord = approvedRecords[0];
                if (!latestRecord.date) continue;

                let recordDate;
                if (typeof latestRecord.date === 'string') {
                    const dateParts = latestRecord.date.split('/');
                    recordDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                } else if (latestRecord.date.toDate) {
                    recordDate = latestRecord.date.toDate();
                } else {
                    continue;
                }

                const now = new Date();
                const diffTime = Math.abs(now - recordDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (
                    config.productionEndDelay?.enabled &&
                    roller.currentStatus === 'Production End' &&
                    diffDays > config.productionEndDelay.days
                ) {
                    const shouldSend = await checkLastAlertDate(roller.id, roller.currentStatus);
                    if (shouldSend) {
                        await sendAlertEmail(roller, "Delayed in send roller to vendor", diffDays, emailJsConfig, recordDate);
                        await updateLastAlertDate(roller.id, roller.currentStatus);
                        alertsSent++;
                    }
                }

                if (
                    config.rollerSentDelay?.enabled &&
                    roller.currentStatus === 'Roller sent' &&
                    diffDays > config.rollerSentDelay.days
                ) {
                    const shouldSend = await checkLastAlertDate(roller.id, roller.currentStatus);
                    if (shouldSend) {
                        await sendAlertEmail(roller, "Delayed in receive roller from vendor", diffDays, emailJsConfig, recordDate);
                        await updateLastAlertDate(roller.id, roller.currentStatus);
                        alertsSent++;
                    }
                }
            } catch (error) {
                console.error(`Error processing roller ${roller.id}:`, error);
                continue;
            }
        }
    } catch (error) {
        console.error("Error in checkAndTriggerAlerts:", error);
        throw error;
    }

    return { checked, alertsSent };
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

async function sendAlertEmail(roller, alertType, days, emailJsConfig, recordDate) {
    const htmlContent = generateEmailHtml(roller, alertType, days, recordDate);

    const toEmails = emailJsConfig.toEmails ? emailJsConfig.toEmails.split(',').map(e => e.trim()).filter(e => e) : ['hiren.dodiya@borosil.com'];
    const ccEmails = emailJsConfig.ccEmails ? emailJsConfig.ccEmails.split(',').map(e => e.trim()).filter(e => e) : [];

    const allRecipients = [...toEmails, ...ccEmails].join('; ');

    const templateParams = {
        title: `${alertType} - Roller ${roller.rollerNumber || roller.id}`,
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
        console.log(`✅ Email sent for ${roller.id} to: ${allRecipients}`);
    } catch (error) {
        console.error("❌ Error sending email:", error);
    }
}

function generateEmailHtml(roller, alertType, days, recordDate) {
    const date = recordDate ? recordDate.toLocaleDateString() : 'N/A';
    const color = '#d32f2f';

    return `
    <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
      <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Delay alert for roller</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">${alertType}</p>
      </div>
      
      <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 25px;">
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">Roller Number</p>
          <h2 style="color: #333; font-size: 32px; margin: 0; font-weight: 700;">${roller.rollerNumber || 'N/A'}</h2>
          <div style="display: inline-block; background-color: #ffebee; color: ${color}; padding: 5px 15px; border-radius: 15px; font-size: 12px; font-weight: bold; margin-top: 10px;">
            Overdue by ${days} days
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Current Status</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #333;">${roller.currentStatus}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Production Line</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #333;">${roller.line || 'N/A'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Position</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #333;">${roller.position || 'N/A'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Record Date</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #333;">${date}</td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Roller Management System • Automated Alert</p>
      </div>
    </div>
  `;
}
