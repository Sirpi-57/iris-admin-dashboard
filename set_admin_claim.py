# set_admin_claim.py
import firebase_admin
from firebase_admin import credentials, auth
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def main():
    try:
        # Method 1: Create service account JSON from environment variables
        service_account_info = {
            "type": os.getenv("FIREBASE_ADMIN_TYPE"),
            "project_id": os.getenv("FIREBASE_ADMIN_PROJECT_ID"),
            "private_key_id": os.getenv("FIREBASE_ADMIN_PRIVATE_KEY_ID"),
            "private_key": os.getenv("FIREBASE_ADMIN_PRIVATE_KEY").replace("\\n", "\n"),
            "client_email": os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL"),
            "client_id": os.getenv("FIREBASE_ADMIN_CLIENT_ID"),
            "auth_uri": os.getenv("FIREBASE_ADMIN_AUTH_URI"),
            "token_uri": os.getenv("FIREBASE_ADMIN_TOKEN_URI"),
            "auth_provider_x509_cert_url": os.getenv("FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL"),
            "client_x509_cert_url": os.getenv("FIREBASE_ADMIN_CLIENT_X509_CERT_URL"),
            "universe_domain": os.getenv("FIREBASE_ADMIN_UNIVERSE_DOMAIN")
        }

        # Get admin user UID from environment variables
        admin_uid = os.getenv("ADMIN_USER_UID")
        
        if not admin_uid:
            print("ERROR: ADMIN_USER_UID not found in environment variables.")
            print("Please set ADMIN_USER_UID in your .env file.")
            return
        
        # Method 2: Alternative approach - look for service account path in environment
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        
        # Choose credential method based on available environment variables
        if all(service_account_info.values()):
            # Use Method 1: in-memory service account
            print("Using service account credentials from environment variables.")
            cred = credentials.Certificate(service_account_info)
        elif service_account_path and os.path.exists(service_account_path):
            # Use Method 2: file-based service account
            print(f"Using service account from file: {service_account_path}")
            cred = credentials.Certificate(service_account_path)
        else:
            print("ERROR: No valid Firebase credentials found.")
            print("Please either:")
            print("1. Set all FIREBASE_ADMIN_* environment variables in your .env file")
            print("2. Set FIREBASE_SERVICE_ACCOUNT_PATH to point to your service account JSON file")
            return
        
        # Initialize the Firebase Admin SDK
        firebase_admin.initialize_app(cred)
        print("Firebase Admin SDK Initialized successfully.")

        # Set the custom claim { isAdmin: true } for the specified user
        print(f"Attempting to set isAdmin=true claim for user UID: {admin_uid}")

        # Set the custom claim. This merges claims, not replaces all.
        auth.set_custom_user_claims(admin_uid, {'isAdmin': True})

        print(f"\nSUCCESS: Successfully set isAdmin=true claim for user: {admin_uid}")
        print("IMPORTANT: The user must sign out and sign back in for the claim to take effect.")

        # Optional: Verify by fetching the user record
        user = auth.get_user(admin_uid)
        print(f"Verification - Current claims for user {user.email}: {user.custom_claims}")

    except auth.UserNotFoundError:
        print(f"\nERROR: User with UID '{admin_uid}' not found in Firebase Authentication.")
    except ValueError as ve:
        print(f"\nERROR: Invalid parameter - {ve}")
    except Exception as e:
        print(f"\nERROR: {e}")

if __name__ == "__main__":
    main()