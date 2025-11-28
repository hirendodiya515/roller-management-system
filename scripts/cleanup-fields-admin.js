// Alternative Cleanup Script Using Firebase Admin SDK
// This requires a service account key file for authentication

const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
// Download your service account key from:
// Firebase Console > Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeFieldsFromRecords() {
    try {
        console.log('Starting cleanup process...');

        // Get all rollers
        const rollersSnapshot = await db.collection('rollers').get();
        console.log(`Found ${rollersSnapshot.size} rollers`);

        let totalRecordsProcessed = 0;
        let totalFieldsRemoved = 0;

        // For each roller, get its records subcollection
        for (const rollerDoc of rollersSnapshot.docs) {
            const rollerId = rollerDoc.id;
            console.log(`\nProcessing roller: ${rollerId}`);

            // Get all records for this roller
            const recordsSnapshot = await db.collection(`rollers/${rollerId}/records`).get();
            console.log(`  Found ${recordsSnapshot.size} records`);

            // Update each record to remove the fields
            for (const recordDoc of recordsSnapshot.docs) {
                const recordId = recordDoc.id;
                const recordData = recordDoc.data();

                // Check which fields exist and need to be removed
                const fieldsToRemove = {};
                let fieldsRemovedCount = 0;

                if ('glassRa' in recordData) {
                    fieldsToRemove.glassRa = admin.firestore.FieldValue.delete();
                    fieldsRemovedCount++;
                }
                if ('glassRz' in recordData) {
                    fieldsToRemove.glassRz = admin.firestore.FieldValue.delete();
                    fieldsRemovedCount++;
                }
                if ('rollerInnerDiameter' in recordData) {
                    fieldsToRemove.rollerInnerDiameter = admin.firestore.FieldValue.delete();
                    fieldsRemovedCount++;
                }

                // Only update if there are fields to remove
                if (Object.keys(fieldsToRemove).length > 0) {
                    await db.collection(`rollers/${rollerId}/records`).doc(recordId).update(fieldsToRemove);
                    console.log(`    Removed ${fieldsRemovedCount} field(s) from record ${recordId}`);
                    totalFieldsRemoved += fieldsRemovedCount;
                }

                totalRecordsProcessed++;
            }
        }

        console.log('\n=== Cleanup Complete ===');
        console.log(`Total records processed: ${totalRecordsProcessed}`);
        console.log(`Total fields removed: ${totalFieldsRemoved}`);

    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}

// Run the cleanup
removeFieldsFromRecords()
    .then(() => {
        console.log('\nScript completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nScript failed:', error);
        process.exit(1);
    });
