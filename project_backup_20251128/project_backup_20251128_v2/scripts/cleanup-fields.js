// Database Cleanup Script for Removing Glass Ra, Glass Rz, and Roller Inner Dia Fields
// This script removes the glassRa, glassRz, and rollerInnerDiameter fields from all records in Firestore

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';

// Firebase configuration - Update with your actual config
const firebaseConfig = {
    apiKey: "AIzaSyBCOX7_-0k3KIW-iV2mWvaBP9ZSw8fobMo",
    authDomain: "roller-management-system.firebaseapp.com",
    projectId: "roller-management-system",
    storageBucket: "roller-management-system.appspot.com",
    messagingSenderId: "292627416665",
    appId: "1:292627416665:web:52c3c2a2c2a2c2a2c2a2c2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function removeFieldsFromRecords() {
    try {
        console.log('Starting cleanup process...');

        // Get all rollers
        const rollersSnapshot = await getDocs(collection(db, 'rollers'));
        console.log(`Found ${rollersSnapshot.size} rollers`);

        let totalRecordsProcessed = 0;
        let totalFieldsRemoved = 0;

        // For each roller, get its records subcollection
        for (const rollerDoc of rollersSnapshot.docs) {
            const rollerId = rollerDoc.id;
            console.log(`\nProcessing roller: ${rollerId}`);

            // Get all records for this roller
            const recordsSnapshot = await getDocs(collection(db, `rollers/${rollerId}/records`));
            console.log(`  Found ${recordsSnapshot.size} records`);

            // Update each record to remove the fields
            for (const recordDoc of recordsSnapshot.docs) {
                const recordId = recordDoc.id;
                const recordData = recordDoc.data();

                // Check which fields exist and need to be removed
                const fieldsToRemove = {};
                let fieldsRemovedCount = 0;

                if ('glassRa' in recordData) {
                    fieldsToRemove.glassRa = deleteField();
                    fieldsRemovedCount++;
                }
                if ('glassRz' in recordData) {
                    fieldsToRemove.glassRz = deleteField();
                    fieldsRemovedCount++;
                }
                if ('rollerInnerDiameter' in recordData) {
                    fieldsToRemove.rollerInnerDiameter = deleteField();
                    fieldsRemovedCount++;
                }

                // Only update if there are fields to remove
                if (Object.keys(fieldsToRemove).length > 0) {
                    await updateDoc(doc(db, `rollers/${rollerId}/records`, recordId), fieldsToRemove);
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
