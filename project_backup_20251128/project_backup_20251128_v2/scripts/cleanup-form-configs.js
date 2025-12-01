// Cleanup Script for Form Configurations
// This script removes glassRa, glassRz, and rollerInnerDiameter from formConfigs collection

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

// Firebase configuration
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

async function removeFieldsFromFormConfigs() {
    try {
        console.log('Starting form configs cleanup...');

        // Get all form configurations
        const formConfigsSnapshot = await getDocs(collection(db, 'formConfigs'));
        console.log(`Found ${formConfigsSnapshot.size} form configurations`);

        const fieldsToRemove = ['glassRa', 'glassRz', 'rollerInnerDiameter'];
        let totalConfigsProcessed = 0;
        let totalFieldsRemoved = 0;

        // Process each form configuration
        for (const configDoc of formConfigsSnapshot.docs) {
            const activityType = configDoc.id;
            const configData = configDoc.data();

            console.log(`\nProcessing activity: ${activityType}`);

            if (configData.fields && Array.isArray(configData.fields)) {
                const originalLength = configData.fields.length;

                // Filter out the fields we want to remove
                const updatedFields = configData.fields.filter(field =>
                    !fieldsToRemove.includes(field.id)
                );

                const removedCount = originalLength - updatedFields.length;

                if (removedCount > 0) {
                    // Update the document with filtered fields
                    await updateDoc(doc(db, 'formConfigs', activityType), {
                        fields: updatedFields
                    });

                    console.log(`  Removed ${removedCount} field(s) from ${activityType}`);
                    totalFieldsRemoved += removedCount;
                } else {
                    console.log(`  No fields to remove from ${activityType}`);
                }
            } else {
                console.log(`  No fields array found in ${activityType}`);
            }

            totalConfigsProcessed++;
        }

        console.log('\n=== Form Configs Cleanup Complete ===');
        console.log(`Total configurations processed: ${totalConfigsProcessed}`);
        console.log(`Total fields removed: ${totalFieldsRemoved}`);

    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}

// Run the cleanup
removeFieldsFromFormConfigs()
    .then(() => {
        console.log('\nScript completed successfully!');
        console.log('Please refresh your browser to see the changes.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nScript failed:', error);
        process.exit(1);
    });
