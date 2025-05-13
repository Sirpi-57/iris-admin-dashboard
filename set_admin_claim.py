# set_admin_claim.py
import firebase_admin
from firebase_admin import credentials, auth
import os # Used to construct path reliably

# --- EDIT THIS LINE: Replace with the ACTUAL PATH or just the filename if it's in the same folder ---
SERVICE_ACCOUNT_KEY_FILE = './iris-service-account.json' # Assumes the key file is in the same folder

# --- EDIT THIS LINE: Replace with the UID of the user you want to make an admin ---
UID_TO_MAKE_ADMIN = 'QwuJ1v27mXUDoTMVMBPO295l6Lm1'


try:
    # Construct the absolute path to the key file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    key_file_path = os.path.join(script_dir, SERVICE_ACCOUNT_KEY_FILE)

    if not os.path.exists(key_file_path):
        print(f"ERROR: Service account key file not found at: {key_file_path}")
        exit(1)

    # Initialize the Firebase Admin SDK
    cred = credentials.Certificate(key_file_path)
    firebase_admin.initialize_app(cred)
    print("Firebase Admin SDK Initialized using Python.")

except Exception as e:
    print(f"ERROR: Failed to initialize Firebase Admin SDK: {e}")
    exit(1)


# Set the custom claim { isAdmin: true } for the specified user
print(f"Attempting to set isAdmin=true claim for user UID: {UID_TO_MAKE_ADMIN}")

try:
    # Set the custom claim. This merges claims, not replaces all.
    auth.set_custom_user_claims(UID_TO_MAKE_ADMIN, {'isAdmin': True})

    print(f"\nSUCCESS: Successfully set isAdmin=true claim for user: {UID_TO_MAKE_ADMIN}")
    print("IMPORTANT: The user must sign out and sign back in for the claim to take effect.")

    # Optional: Verify by fetching the user record (uncomment to use)
    # user = auth.get_user(UID_TO_MAKE_ADMIN)
    # print(f"Verification - Current claims for user {user.email}: {user.custom_claims}")

except auth.UserNotFoundError:
    print(f"\nERROR: User with UID '{UID_TO_MAKE_ADMIN}' not found in Firebase Authentication.")
except Exception as e:
    print(f"\nERROR: Failed to set custom claim: {e}")