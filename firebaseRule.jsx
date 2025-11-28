rules_version = '2';
service cloud.firestore {
  match / databases / { database } / documents {

    // Helper functions
    function getUserData() {
      return get(/databases/$(database) / documents / users / $(request.auth.uid)).data;
    }

    function hasRole(role) {
      return request.auth != null && getUserData().role == role;
    }

    function isAdmin() { return hasRole('Admin'); }
    function isEditor() { return hasRole('Editor'); }
    function isApprover() { return hasRole('Approver'); }
    function isViewer() { return hasRole('Viewer'); }

    // Users collection (to store roles)
    match / users / { userId } {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || isAdmin(); // Only admin or self
    }

    // Rollers Collection
    match / rollers / { rollerId } {
      // Read: Everyone logged in
      allow read: if request.auth != null;

      // Create: Admin or Editor
      allow create: if (isAdmin() || isEditor()) 
                    && request.resource.data.status == 'Pending';

      // Update: Admin anywhere, Editor only if 'Pending', Approver NO
      allow update: if isAdmin()
        || (isEditor() && resource.data.status == 'Pending'); // Editors cant edit approved rollers
      
      allow delete: if isAdmin();

      // Subcollection: Records
      match / records / { recordId } {
        allow read: if request.auth != null;

        // Create: Admin or Editor
        allow create: if (isAdmin() || isEditor()) 
                      && request.resource.data.status == 'Pending';

        // Update: 
        // 1. Admin: Full Access
        // 2. Editor: Can only edit their pending data
        // 3. Approver: Can only update 'status', 'remarks'
        allow update: if isAdmin()
          || (isEditor() && resource.data.status == 'Pending' && request.resource.data.status == 'Pending')
          || (isApprover() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'remarks', 'approvedAt', 'approvedBy']));
      }
    }

    // Allow access to Settings and Form Configs
    match / settings / { document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Ideally restrict to Admins
    }

    match / formConfigs / { document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}