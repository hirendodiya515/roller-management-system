import { db } from '../config/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

// Main function to check rollers and trigger alerts
export const checkAndTriggerAlerts = async (config, emailJsConfig) => {
    if (!config) return { checked: 0, alertsSent: 0 };
    if (!emailJsConfig || !emailJsConfig.serviceId || !emailJsConfig.templateId || !emailJsConfig.publicKey) {
        throw new Error("EmailJS configuration is missing");
    }

    let alertsSent = 0;
    let checked = 0;

    try {
        const rollersSnapshot = await getDocs(collection(db, 'rollers'));
        const rollers = rollersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        checked = rollers.length;

        // Initialize EmailJS
        emailjs.init(emailJsConfig.publicKey);

        for (const roller of rollers) {
            // Fetch the latest approved record for this roller to get the actual date
            try {
                const recordsSnapshot = await getDocs(
                    collection(db, `rollers/${roller.id}/records`)
                );

                const approvedRecords = recordsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(record => record.status === 'Approved' && record.activity === roller.currentStatus)
                    .sort((a, b) => {
                        // Handle both string dates and Firestore Timestamps
                        let dateA, dateB;

                        if (a.date && typeof a.date === 'string') {
                            // Parse DD/MM/YYYY format
                            const parts = a.date.split('/');
                            dateA = new Date(parts[2], parts[1] - 1, parts[0]);
                        } else if (a.date && a.date.toDate) {
                            // Firestore Timestamp
                            dateA = a.date.toDate();
                        } else {
                            dateA = new Date(0);
                        }

                        if (b.date && typeof b.date === 'string') {
                            // Parse DD/MM/YYYY format
                            const parts = b.date.split('/');
                            dateB = new Date(parts[2], parts[1] - 1, parts[0]);
                        } else if (b.date && b.date.toDate) {
                            // Firestore Timestamp
                            dateB = b.date.toDate();
                        } else {
                            dateB = new Date(0);
                        }

                        return dateB - dateA;
                    });

                if (approvedRecords.length === 0) continue;

                const latestRecord = approvedRecords[0];
                if (!latestRecord.date) continue;

                // Parse the date field - handle both string and Timestamp formats
                let recordDate;
                if (typeof latestRecord.date === 'string') {
                    // Parse DD/MM/YYYY format
                    const dateParts = latestRecord.date.split('/');
                    recordDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                } else if (latestRecord.date.toDate) {
                    // Firestore Timestamp
                    recordDate = latestRecord.date.toDate();
                } else {
                    // Skip if date format is unknown
                    continue;
                }

                const now = new Date();
                const diffTime = Math.abs(now - recordDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Alert 1: Production End -> Roller Sent
                if (
                    config.productionEndDelay?.enabled &&
                    roller.currentStatus === 'Production End' &&
                    diffDays > config.productionEndDelay.days
                ) {
                    await sendAlertEmail(roller, "Delayed in send roller to vendor", diffDays, emailJsConfig, recordDate);
                    alertsSent++;
                }

                // Alert 2: Roller Sent -> Roller Received
                if (
                    config.rollerSentDelay?.enabled &&
                    roller.currentStatus === 'Roller sent' &&
                    diffDays > config.rollerSentDelay.days
                ) {
                    await sendAlertEmail(roller, "Delayed in receive roller from vendor", diffDays, emailJsConfig, recordDate);
                    alertsSent++;
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
};

// Helper to send email via EmailJS
const sendAlertEmail = async (roller, alertType, days, emailJsConfig, recordDate) => {
    const htmlContent = generateEmailHtml(roller, alertType, days, recordDate);

    // Matching keys to the user's EmailJS template:
    // {{title}} -> Subject/Title
    // {{message}} -> HTML Content
    // {{name}} -> Sender Name
    // {{email}} -> Reply-To Email
    const templateParams = {
        title: `${alertType} - Roller ${roller.rollerNumber || roller.id}`,
        message: htmlContent,
        name: 'Roller Alert System',
        email: 'hiren.dodiya@borosil.com',
        to_email: 'hiren.dodiya@borosil.com'
    };

    try {
        await emailjs.send(
            emailJsConfig.serviceId,
            emailJsConfig.templateId,
            templateParams
        );
        console.log(`Email sent for ${roller.id}`);
    } catch (error) {
        console.error("Error sending email:", error);
        // Don't throw here to allow other alerts to proceed
    }
};

// Helper to generate colorful Material Design HTML
const generateEmailHtml = (roller, alertType, days, recordDate) => {
    const date = recordDate ? recordDate.toLocaleDateString() : 'N/A';
    const color = '#d32f2f'; // Red for alert

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

        <div style="text-align: center;">
          <a href="${window.location.origin}/roller/${roller.id}" style="background-color: ${color}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(211, 47, 47, 0.3);">
            VIEW ROLLER DETAILS
          </a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Roller Management System • Automated Alert</p>
      </div>
    </div>
  `;
};
