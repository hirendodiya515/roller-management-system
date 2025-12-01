// SIMPLIFIED BROWSER CONSOLE SCRIPT
// Copy and paste this ENTIRE script into your browser console while logged into the app

(async function cleanupFormConfigs() {
    console.log('🧹 Starting Form Configs Cleanup...');

    try {
        // Access Firestore from the firebase module that's already loaded in your app
        const { getFirestore, collection, getDocs, doc, updateDoc } = window.firebaseModules || {};

        // Try to get the db instance from your app
        let db;

        // Method 1: Try to get from window
        if (window.db) {
            db = window.db;
            console.log('✅ Found db from window');
        }
        // Method 2: Import from your firebase config
        else {
            console.log('⚠️ Attempting to access Firestore...');
            // We need to use the firebase instance that's already initialized
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getFirestore: getFS, collection: coll, getDocs: getDcs, doc: dc, updateDoc: upDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const firebaseConfig = {
                apiKey: "AIzaSyBCOX7_-0k3KIW-iV2mWvaBP9ZSw8fobMo",
                authDomain: "roller-management-system.firebaseapp.com",
                projectId: "roller-management-system",
                storageBucket: "roller-management-system.appspot.com",
                messagingSenderId: "292627416665",
                appId: "1:292627416665:web:52c3c2a2c2a2c2a2c2a2c2"
            };

            const app = initializeApp(firebaseConfig);
            db = getFS(app);
            console.log('✅ Initialized Firestore');
        }

        // Import Firestore functions from CDN
        const { collection: coll, getDocs: getDcs, doc: dc, updateDoc: upDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // Get all form configurations
        const formConfigsSnapshot = await getDcs(coll(db, 'formConfigs'));

        console.log(`📋 Found ${formConfigsSnapshot.size} form configurations`);

        const fieldsToRemove = ['glassRa', 'glassRz', 'rollerInnerDiameter'];
        let totalConfigsProcessed = 0;
        let totalFieldsRemoved = 0;

        // Process each form configuration
        for (const configDoc of formConfigsSnapshot.docs) {
            const activityType = configDoc.id;
            const configData = configDoc.data();

            console.log(`\n📝 Processing: ${activityType}`);

            if (configData.fields && Array.isArray(configData.fields)) {
                const originalLength = configData.fields.length;

                // Filter out the fields we want to remove
                const updatedFields = configData.fields.filter(field =>
                    !fieldsToRemove.includes(field.id)
                );

                const removedCount = originalLength - updatedFields.length;

                if (removedCount > 0) {
                    // Update the document with filtered fields
                    await upDoc(dc(db, 'formConfigs', activityType), {
                        fields: updatedFields
                    });

                    console.log(`  ✅ Removed ${removedCount} field(s)`);
                    totalFieldsRemoved += removedCount;
                } else {
                    console.log(`  ℹ️ No fields to remove`);
                }
            } else {
                console.log(`  ⚠️ No fields array found`);
            }

            totalConfigsProcessed++;
        }

        console.log('\n✨ === Cleanup Complete ===');
        console.log(`📊 Configurations processed: ${totalConfigsProcessed}`);
        console.log(`🗑️ Fields removed: ${totalFieldsRemoved}`);
        console.log('\n🔄 Please REFRESH the page to see changes!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        console.error('Error details:', error.message);
        console.log('\n💡 Alternative: Go to Firebase Console and manually delete the fields from formConfigs collection');
    }
})();
