# Field Removal Cleanup Script

## Overview
This script removes the `glassRa`, `glassRz`, and `rollerInnerDiameter` fields from all records in your Firestore database.

## Prerequisites
- Node.js installed
- Firebase Admin SDK or Firebase JS SDK

## Setup Instructions

1. **Update Firebase Configuration**
   - Open `scripts/cleanup-fields.js`
   - Replace the placeholder Firebase config with your actual configuration from `src/config/firebase.js`

2. **Install Dependencies** (if not already installed)
   ```bash
   npm install firebase
   ```

## Running the Script

### Option 1: Using Node.js directly
```bash
node scripts/cleanup-fields.js
```

### Option 2: Add to package.json scripts
Add this to your `package.json`:
```json
{
  "scripts": {
    "cleanup-fields": "node scripts/cleanup-fields.js"
  }
}
```

Then run:
```bash
npm run cleanup-fields
```

## What the Script Does

1. Connects to your Firestore database
2. Iterates through all rollers in the `rollers` collection
3. For each roller, accesses its `records` subcollection
4. Removes the following fields from each record (if they exist):
   - `glassRa`
   - `glassRz`
   - `rollerInnerDiameter`
5. Provides progress updates and a final summary

## Important Notes

⚠️ **WARNING**: This operation is irreversible. Make sure to:
- **Backup your database** before running this script
- Test on a development/staging environment first
- Verify the Firebase configuration is correct

## Expected Output

```
Starting cleanup process...
Found 50 rollers

Processing roller: abc123
  Found 10 records
    Removed 3 field(s) from record xyz789
    Removed 3 field(s) from record xyz790
    ...

=== Cleanup Complete ===
Total records processed: 500
Total fields removed: 1500

Script completed successfully!
```

## Troubleshooting

- **Authentication Error**: Ensure your Firebase config is correct
- **Permission Denied**: Check Firestore security rules allow write access
- **Script Hangs**: Check your internet connection and Firebase project status
