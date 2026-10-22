import { db } from '../config/firebase';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

// Function to fetch alert configuration
export const fetchAlertConfig = async () => {
    try {
        const docRef = doc(db, 'settings', 'alerts');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error fetching alert config:", error);
        return null;
    }
};

// Helper function to parse dates reliably
const parseRecordDate = (dateVal) => {
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
};

// Helper function to format date consistently as DD/MM/YYYY
const formatDateDDMMYYYY = (dateVal) => {
    const d = parseRecordDate(dateVal);
    if (!d || isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// Main function to check rollers and trigger alerts
export const checkAndTriggerAlerts = async (config, emailJsConfig) => {
    if (!config) return { checked: 0, alertsSent: 0 };
    if (!emailJsConfig || !emailJsConfig.serviceId || !emailJsConfig.templateId || !emailJsConfig.publicKey) {
        throw new Error("EmailJS configuration is missing");
    }

    let alertsSent = 0;
    let checked = 0;

    // Arrays to hold delayed rollers for batching into one single email
    const delayedSendRollers = [];
    const delayedReceiveRollers = [];

    // Inventory counters for Ready to Use Low Stock Alert
    const readyToUseCounts = {
        'SG#1': { Top: 0, Bottom: 0 },
        'SG#2': { Top: 0, Bottom: 0 },
        'SG#3': { Top: 0, Bottom: 0 }
    };

    try {
        const rollersSnapshot = await getDocs(collection(db, 'rollers'));
        const rollers = rollersSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(r => !r.isDeleted);
        checked = rollers.length;

        // Initialize EmailJS
        emailjs.init(emailJsConfig.publicKey);

        for (const roller of rollers) {
            // Skip rollers where mail alerts are disabled (e.g. inactive pattern rollers)
            if (roller.mailAlertsEnabled === false) {
                continue;
            }

            try {
                const recordsSnapshot = await getDocs(
                    collection(db, `rollers/${roller.id}/records`)
                );

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

                // Calculate current status fallback if roller.currentStatus is missing or out of sync
                let status = roller.currentStatus;
                if (!status || status === 'No Activity') {
                    const statusSource = latestApprovedRecord || latestRecord;
                    if (statusSource) {
                        if (statusSource.activity === 'Roller Received') {
                            const allKeys = Object.keys(statusSource);
                            const readyToUseKey = allKeys.find(key => key.toLowerCase().includes('ready_to_use'));
                            const readyValue = readyToUseKey ? statusSource[readyToUseKey] : undefined;
                            status = readyValue === 'Yes' ? 'Ready to Use' : 'To be sent';
                        } else if (statusSource.activity === 'Production Start') {
                            status = 'Running';
                        } else if (statusSource.activity === 'Production End') {
                            status = 'To be sent';
                        } else if (statusSource.activity === 'Roller sent') {
                            status = 'Sent to Vendor';
                        } else if (statusSource.activity === 'Scrap') {
                            status = 'Scrap';
                        }
                    }
                }

                // Count Ready to Use stock
                if (status === 'Ready to Use') {
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

                // Alert 1: Delay in sending roller to vendor (Status: 'To be sent' / 'Production End')
                const isDelayInSendStatus = status === 'To be sent' || status === 'Production End';
                if (config.productionEndDelay?.enabled && isDelayInSendStatus) {
                    // Check allRecords (both Approved and Pending) to find the relevant Production End record.
                    // This prevents falling back to an old Production Start date if Production End is pending approval.
                    const prodEndRecord = allRecords.find(r => r.activity === 'Production End') ||
                        allRecords.find(r => r.activity === 'Roller Received' && (r.ready_to_use === 'No' || r.readyToUse === 'No')) ||
                        latestApprovedRecord ||
                        latestRecord;

                    const recordDate = parseRecordDate(prodEndRecord?.date);

                    if (recordDate) {
                        const diffTime = now.getTime() - recordDate.getTime();
                        const diffDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

                        if (diffDays > config.productionEndDelay.days) {
                            const shouldSend = await checkLastAlertDate(roller.id, 'To be sent');
                            if (shouldSend) {
                                const statusLabel = prodEndRecord.status === 'Pending'
                                    ? `${status} (Pending Approval)`
                                    : status;
                                delayedSendRollers.push({ ...roller, currentStatus: statusLabel, diffDays, recordDate });
                            }
                        }
                    }
                }

                // Alert 2: Delay in receiving roller from vendor (Status: 'Sent to Vendor' / 'Roller sent')
                const isDelayInReceiveStatus = status === 'Sent to Vendor' || status === 'Roller sent';
                if (config.rollerSentDelay?.enabled && isDelayInReceiveStatus) {
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
                                    ? `${status} (Pending Approval)`
                                    : status;
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

        // --- Execute Batch Email for Delay in Sending ---
        if (delayedSendRollers.length > 0) {
            const success = await sendBulkAlertEmail(delayedSendRollers, "Delayed in send roller to vendor", emailJsConfig);
            if (success) {
                for (const roller of delayedSendRollers) {
                    await updateLastAlertDate(roller.id, 'To be sent');
                }
                alertsSent++;
            }
        }

        // --- Execute Batch Email for Delay in Receiving from Vendor ---
        if (delayedReceiveRollers.length > 0) {
            const success = await sendBulkAlertEmail(delayedReceiveRollers, "Delayed in receive roller from vendor", emailJsConfig);
            if (success) {
                for (const roller of delayedReceiveRollers) {
                    await updateLastAlertDate(roller.id, 'Sent to Vendor');
                }
                alertsSent++;
            }
        }

        // --- Execute Ready to Use Low Stock Alert ---
        if (config.readyToUseAlert?.enabled) {
            const minQty = config.readyToUseAlert.minimum || 0;
            let lowStockDetected = false;
            Object.values(readyToUseCounts).forEach(lineCounts => {
                if (lineCounts.Top < minQty || lineCounts.Bottom < minQty) {
                    lowStockDetected = true;
                }
            });

            if (lowStockDetected) {
                const success = await sendReadyToUseAlert(readyToUseCounts, minQty, emailJsConfig);
                if (success) {
                    alertsSent++;
                }
            }
        }
    } catch (error) {
        console.error("Error in checkAndTriggerAlerts:", error);
        throw error;
    }

    return { 
        checked, 
        alertsSent,
        sendDelayCount: delayedSendRollers.length,
        receiveDelayCount: delayedReceiveRollers.length 
    };
};

const checkLastAlertDate = async (rollerId, status) => {
    try {
        const alertDocRef = doc(db, 'rollerAlerts', `${rollerId}_${status}`);
        const alertDoc = await getDoc(alertDocRef);

        if (!alertDoc.exists()) {
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
};

const updateLastAlertDate = async (rollerId, status) => {
    try {
        const alertDocRef = doc(db, 'rollerAlerts', `${rollerId}_${status}`);
        await setDoc(alertDocRef, {
            rollerId,
            status,
            lastSent: serverTimestamp()
        });
    } catch (error) {
        console.warn("Could not update last alert date:", error.message);
    }
};

// Send ONE single bulk email with a summary table of all delayed rollers
const sendBulkAlertEmail = async (rollers, alertType, emailJsConfig) => {
    const htmlContent = generateBulkEmailHtml(rollers, alertType);

    const toEmails = emailJsConfig.toEmails ? emailJsConfig.toEmails.split(',').map(e => e.trim()).filter(e => e) : ['hiren.dodiya@borosil.com'];
    const ccEmails = emailJsConfig.ccEmails ? emailJsConfig.ccEmails.split(',').map(e => e.trim()).filter(e => e) : [];

    // Combine with comma separator for EmailJS
    const allRecipients = [...toEmails, ...ccEmails].join(', ');

    const templateParams = {
        title: `${alertType} - ${rollers.length} Pending Rollers`,
        message: htmlContent,
        name: 'Roller Alert System',
        email: 'hiren.dodiya@borosil.com',
        to_email: allRecipients
    };

    try {
        await emailjs.send(
            emailJsConfig.serviceId,
            emailJsConfig.templateId,
            templateParams
        );
        console.log(`✅ Bulk email sent for ${alertType} (${rollers.length} rollers) to: ${allRecipients}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending bulk email for ${alertType}:`, error);
        return false;
    }
};

const generateBulkEmailHtml = (rollers, alertType) => {
    const color = '#d32f2f';
    const isReceiveDelay = alertType === "Delayed in receive roller from vendor";
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const rowRows = rollers.map(roller => {
        const date = formatDateDDMMYYYY(roller.recordDate);
        const link = origin ? `<a href="${origin}/roller/${roller.id}" style="color: #1976d2; text-decoration: none; font-weight: bold;">${roller.rollerNumber || roller.id}</a>` : (roller.rollerNumber || 'N/A');
        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; border: 1px solid #ddd;">${link}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: ${color}; font-weight: bold;">${roller.diffDays} Days</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${roller.currentStatus || 'To be sent'}</td>
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
};

const sendReadyToUseAlert = async (counts, minQty, emailJsConfig) => {
    const color = '#d32f2f';
    const greenColor = '#388E3C';

    const renderCell = (qty) => {
        const isLow = qty < minQty;
        const cellColor = isLow ? color : greenColor;
        const bgColor = isLow ? '#ffebee' : '#e8f5e9';
        const fontWeight = isLow ? 'bold' : 'normal';
        return `<td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: ${cellColor}; background-color: ${bgColor}; font-weight: ${fontWeight};">${qty}</td>`;
    };

    const tableRows = Object.keys(counts).map(line => {
        return `<tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">${line}</td>
            ${renderCell(counts[line].Top)}
            ${renderCell(counts[line].Bottom)}
        </tr>`;
    }).join('');

    const htmlContent = `
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
    </div>`;

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
        await emailjs.send(
            emailJsConfig.serviceId,
            emailJsConfig.templateId,
            templateParams
        );
        console.log(`✅ Ready to Use alert sent to: ${allRecipients}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending Ready to Use alert:", error);
        return false;
    }
};
