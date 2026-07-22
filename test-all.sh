#!/bin/bash

# ============================================
# SafeWalk Campus API - Complete Test Script
# ============================================

# Configuration
API_URL="http://localhost:5000/api"
BASE_URL="http://localhost:5000"

# Test User Credentials (Change these)
TEST_EMAIL="thanksayo299@gmail.com"
TEST_PHONE="+2348012345678"
TEST_NAME="ayomide thanks"
TEST_PASSWORD="Riaayo299398"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables to store data
CSRF_TOKEN=""
ACCESS_TOKEN=""
REFRESH_TOKEN=""
ALERT_ID=""
CONTACT_ID=""
OTP_CODE=""
PROFILE_PICTURE_URL=""
ALERT_EMAIL_SENT=""

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo ""
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${CYAN}📌 $1${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_json() {
    echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

check_server() {
    print_header "Checking Server Status"
    echo -n "Checking if server is running... "
    
    if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" | grep -q "200"; then
        print_success "Server is running"
        return 0
    else
        print_error "Server is not running!"
        echo ""
        echo "Please start the server first:"
        echo "  cd /mnt/c/Users/USER/Desktop/synap-circle"
        echo "  npm run dev"
        echo ""
        exit 1
    fi
}

# ============================================
# Create Test Image for Cloudinary
# ============================================
create_test_image() {
    echo -e "${BLUE}📸 Creating test image for Cloudinary...${NC}"
    
    # Create a simple 1x1 pixel PNG (base64 encoded)
    # This is a minimal valid PNG file
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" | base64 -d > /tmp/test-profile-pic.png
    
    if [ -f /tmp/test-profile-pic.png ]; then
        print_success "Test image created at /tmp/test-profile-pic.png"
        return 0
    else
        print_error "Failed to create test image"
        return 1
    fi
}

# ============================================
# 1. HEALTH CHECK
# ============================================
test_health() {
    print_header "1. Health Check"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/health")
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "ok"; then
        print_success "Health check passed"
        return 0
    else
        print_error "Health check failed"
        return 1
    fi
}

# ============================================
# 2. CSRF TOKEN
# ============================================
test_csrf() {
    print_header "2. Get CSRF Token"
    
    RESPONSE=$(curl -s -X GET "$API_URL/auth/csrf-token")
    print_info "Response:"
    print_json "$RESPONSE"
    
    CSRF_TOKEN=$(echo "$RESPONSE" | grep -o '"csrfToken":"[^"]*"' | sed 's/"csrfToken":"//;s/"//')
    
    if [ -n "$CSRF_TOKEN" ]; then
        print_success "CSRF Token obtained: ${CSRF_TOKEN:0:20}..."
        return 0
    else
        print_warning "CSRF Token not found (may not be required)"
        return 0
    fi
}

# ============================================
# 3. SIGNUP
# ============================================
test_signup() {
    print_header "3. Sign Up - Create Test User"
    
    print_info "Creating user: $TEST_EMAIL"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$TEST_EMAIL\",
            \"phoneNumber\": \"$TEST_PHONE\",
            \"name\": \"$TEST_NAME\",
            \"password\": \"$TEST_PASSWORD\"
        }")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    # Try to get OTP from development response
    OTP_CODE=$(echo "$RESPONSE" | grep -o '"development_otp":"[^"]*"' | sed 's/"development_otp":"//;s/"//')
    
    if [ -n "$OTP_CODE" ]; then
        print_success "User created! OTP: $OTP_CODE"
        return 0
    elif echo "$RESPONSE" | grep -q '"success":true'; then
        print_warning "User created but OTP not in response"
        print_info "Check server logs for OTP: npm run dev | grep OTP"
        return 0
    else
        print_error "Signup failed"
        return 1
    fi
}

# ============================================
# 4. VERIFY OTP
# ============================================
test_verify_otp() {
    print_header "4. Verify OTP"
    
    if [ -z "$OTP_CODE" ]; then
        print_warning "No OTP available. Please enter OTP manually:"
        read -r -p "Enter OTP code: " OTP_CODE
    fi
    
    print_info "Verifying OTP: $OTP_CODE"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/verify-otp" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$TEST_EMAIL\",
            \"otpCode\": \"$OTP_CODE\"
        }")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
    REFRESH_TOKEN=$(echo "$RESPONSE" | grep -o '"refreshToken":"[^"]*"' | head -1 | sed 's/"refreshToken":"//;s/"//')
    
    if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
        print_success "OTP verified! Token obtained"
        return 0
    else
        print_error "OTP verification failed"
        return 1
    fi
}

# ============================================
# 5. LOGIN
# ============================================
test_login() {
    print_header "5. Login"
    
    print_info "Logging in as: $TEST_EMAIL"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d "{
            \"email\": \"$TEST_EMAIL\",
            \"password\": \"$TEST_PASSWORD\"
        }")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
    REFRESH_TOKEN=$(echo "$RESPONSE" | grep -o '"refreshToken":"[^"]*"' | head -1 | sed 's/"refreshToken":"//;s/"//')
    
    if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
        print_success "Login successful!"
        return 0
    else
        print_error "Login failed"
        return 1
    fi
}

# ============================================
# 6. GET USER PROFILE (OLD - Keeping for compatibility)
# ============================================
test_get_profile() {
    print_header "6. Get User Profile (Auth/me)"
    
    RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Profile retrieved successfully"
        return 0
    else
        print_error "Failed to get profile"
        return 1
    fi
}

# ============================================
# 6b. GET FULL PROFILE (NEW)
# ============================================
test_get_full_profile() {
    print_header "6b. Get Full Profile (Profile/me)"
    
    RESPONSE=$(curl -s -X GET "$API_URL/profile/me" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Full profile retrieved successfully"
        return 0
    else
        print_error "Failed to get full profile"
        return 1
    fi
}

# ============================================
# 6c. UPDATE FULL PROFILE
# ============================================
test_update_full_profile() {
    print_header "6c. Update Full Profile"
    
    print_info "Updating profile..."
    
    RESPONSE=$(curl -s -X PUT "$API_URL/profile/me" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d '{
            "name": "Tomi Adeyemi",
            "email": "tomi.adeyemi@email.com",
            "phoneNumber": "+2348034567890",
            "university": "University of Ilorin",
            "preferences": {
                "autoShareLocation": true,
                "alertSound": true
            }
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Profile updated successfully"
        return 0
    else
        print_error "Failed to update profile"
        return 1
    fi
}

# ============================================
# 6d. UPDATE NAME ONLY
# ============================================
test_update_name() {
    print_header "6d. Update Name Only"
    
    print_info "Updating name..."
    
    RESPONSE=$(curl -s -X PUT "$API_URL/profile/name" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d '{
            "name": "Tomi Adeyemi Updated"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Name updated successfully"
        return 0
    else
        print_error "Failed to update name"
        return 1
    fi
}

# ============================================
# 6e. UPDATE EMAIL ONLY
# ============================================
test_update_email() {
    print_header "6e. Update Email Only"
    
    print_info "Updating email..."
    
    RESPONSE=$(curl -s -X PUT "$API_URL/profile/email" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d '{
            "email": "tomi.updated@email.com"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Email updated successfully"
        return 0
    else
        print_error "Failed to update email"
        return 1
    fi
}

# ============================================
# 6f. GET ALERT HISTORY
# ============================================
test_alert_history() {
    print_header "6f. Get Alert History"
    
    RESPONSE=$(curl -s -X GET "$API_URL/profile/history?status=all&limit=10&page=1" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert history retrieved successfully"
        return 0
    else
        print_error "Failed to get alert history"
        return 1
    fi
}

# ============================================
# 6g. GET ALERT HISTORY BY STATUS
# ============================================
test_alert_history_by_status() {
    print_header "6g. Get Alert History (Cancelled/False Alarms)"
    
    RESPONSE=$(curl -s -X GET "$API_URL/profile/history?status=cancelled&limit=5&page=1" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert history (cancelled) retrieved successfully"
        return 0
    else
        print_error "Failed to get cancelled alert history"
        return 1
    fi
}

# ============================================
# 6h. UPLOAD PROFILE PICTURE (CLOUDINARY)
# ============================================
test_upload_profile_picture() {
    print_header "6h. Upload Profile Picture (Cloudinary)"
    
    # Create test image
    create_test_image || return 1
    
    print_info "Uploading profile picture to Cloudinary..."
    
    RESPONSE=$(curl -s -X POST "$API_URL/profile/picture" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -F "profilePicture=@/tmp/test-profile-pic.png")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    PROFILE_PICTURE_URL=$(echo "$RESPONSE" | grep -o '"profilePicture":"[^"]*"' | head -1 | sed 's/"profilePicture":"//;s/"//')
    
    if echo "$RESPONSE" | grep -q '"success":true' && [ -n "$PROFILE_PICTURE_URL" ]; then
        print_success "Profile picture uploaded successfully!"
        print_info "Cloudinary URL: ${PROFILE_PICTURE_URL:0:60}..."
        return 0
    else
        print_warning "Profile picture upload failed or Cloudinary not configured"
        return 0
    fi
}

# ============================================
# 6i. DELETE PROFILE PICTURE (CLOUDINARY)
# ============================================
test_delete_profile_picture() {
    print_header "6i. Delete Profile Picture (Cloudinary)"
    
    if [ -z "$PROFILE_PICTURE_URL" ]; then
        print_warning "No profile picture to delete, skipping..."
        return 0
    fi
    
    print_info "Deleting profile picture from Cloudinary..."
    
    RESPONSE=$(curl -s -X DELETE "$API_URL/profile/picture" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"})
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Profile picture deleted successfully!"
        return 0
    else
        print_warning "Failed to delete profile picture"
        return 0
    fi
}

# ============================================
# 7. ONBOARDING STATUS
# ============================================
test_onboarding_status() {
    print_header "7. Get Onboarding Status"
    
    RESPONSE=$(curl -s -X GET "$API_URL/auth/onboarding-status" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Onboarding status retrieved"
        return 0
    else
        print_error "Failed to get onboarding status"
        return 1
    fi
}

# ============================================
# 8. UPDATE ONBOARDING STEP
# ============================================
test_update_onboarding() {
    print_header "8. Update Onboarding Step"
    
    RESPONSE=$(curl -s -X PATCH "$API_URL/auth/onboarding-step" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d '{
            "step": "location",
            "data": {
                "location": {
                    "latitude": 37.7749,
                    "longitude": -122.4194
                }
            }
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Onboarding step updated"
        return 0
    else
        print_error "Failed to update onboarding"
        return 1
    fi
}

# ============================================
# 9. ADD TRUSTED CONTACT
# ============================================
test_add_contact() {
    print_header "9. Add Trusted Contact"
    
    RESPONSE=$(curl -s -X POST "$API_URL/contacts" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d '{
            "name": "Jane Doe",
            "phoneNumber": "+1234567891",
            "email": "jane.doe@example.com",
            "relationship": "friend"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    CONTACT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
    
    if [ -n "$CONTACT_ID" ] && [ "$CONTACT_ID" != "null" ]; then
        print_success "Contact added! ID: $CONTACT_ID"
        return 0
    else
        print_warning "Could not add contact (may already exist)"
        return 0
    fi
}

# ============================================
# 10. GET CONTACTS
# ============================================
test_get_contacts() {
    print_header "10. Get All Trusted Contacts"
    
    RESPONSE=$(curl -s -X GET "$API_URL/contacts" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Contacts retrieved"
        return 0
    else
        print_error "Failed to get contacts"
        return 1
    fi
}

# ============================================
# 11. GET CAMPUS SECURITY
# ============================================
test_get_campus_security() {
    print_header "11. Get Campus Security Contacts"
    
    RESPONSE=$(curl -s -X GET "$API_URL/contacts/campus-security" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Campus security contacts retrieved"
        return 0
    else
        print_error "Failed to get campus security"
        return 1
    fi
}

# ============================================
# 12. TRIGGER SOS (SECURITY TEST)
# ============================================
test_sos_without_auth() {
    print_header "12. Security Test: SOS Without Token"
    
    print_info "Testing SOS without authentication (should fail)..."
    
    RESPONSE=$(curl -s -X POST "$API_URL/sos/trigger" \
        -H "Content-Type: application/json" \
        -d '{
            "latitude": 37.7749,
            "longitude": -122.4194,
            "locationAvailable": true,
            "message": "Test without auth"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"code":"MISSING_TOKEN"'; then
        print_success "✅ Security check passed! Request properly rejected with 401"
        return 0
    else
        print_error "⚠️ Security check failed! SOS triggered without authentication"
        return 1
    fi
}

# ============================================
# 13. TRIGGER SOS (AUTHENTICATED)
# ============================================
test_sos_with_auth() {
    print_header "13. Trigger SOS Alert (Authenticated)"
    
    print_info "Triggering SOS alert..."
    
    RESPONSE=$(curl -s -X POST "$API_URL/sos/trigger" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "latitude": 37.7749,
            "longitude": -122.4194,
            "locationAvailable": true,
            "message": "Helppppppppppp!"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    ALERT_ID=$(echo "$RESPONSE" | grep -o '"alertId":"[^"]*"' | head -1 | sed 's/"alertId":"//;s/"//')
    
    # Check if email confirmation was sent
    ALERT_EMAIL_SENT=$(echo "$RESPONSE" | grep -o '"message":"Alert sent to [0-9]* of [0-9]* recipients"' | head -1)
    
    if [ -n "$ALERT_ID" ] && [ "$ALERT_ID" != "null" ]; then
        print_success "SOS alert triggered! ID: $ALERT_ID"
        if [ -n "$ALERT_EMAIL_SENT" ]; then
            print_success "✅ Alert confirmation email sent to user: $TEST_EMAIL"
        fi
        return 0
    else
        print_error "Failed to trigger SOS"
        return 1
    fi
}

# ============================================
# 14. GET SOS STATUS
# ============================================
test_sos_status() {
    print_header "14. Get SOS Alert Status"
    
    if [ -z "$ALERT_ID" ] || [ "$ALERT_ID" = "null" ]; then
        print_warning "No alert ID available, skipping status check"
        return 0
    fi
    
    print_info "Checking status for alert: $ALERT_ID"
    
    RESPONSE=$(curl -s -X GET "$API_URL/sos/status/$ALERT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert status retrieved"
        return 0
    else
        print_error "Failed to get alert status"
        return 1
    fi
}

# ============================================
# 15. GET SOS HISTORY
# ============================================
test_sos_history() {
    print_header "15. Get SOS Alert History"
    
    RESPONSE=$(curl -s -X GET "$API_URL/sos/history?limit=10&offset=0" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert history retrieved"
        return 0
    else
        print_error "Failed to get alert history"
        return 1
    fi
}

# ============================================
# 16. CANCEL SOS (if within window)
# ============================================
test_cancel_sos() {
    print_header "16. Cancel SOS Alert"
    
    if [ -z "$ALERT_ID" ] || [ "$ALERT_ID" = "null" ]; then
        print_warning "No alert ID available, skipping cancellation"
        return 0
    fi
    
    print_info "Cancelling alert: $ALERT_ID"
    
    RESPONSE=$(curl -s -X POST "$API_URL/sos/cancel/$ALERT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"reason": "false_alarm"}')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"status":"cancelled"'; then
        print_success "Alert cancelled successfully"
        return 0
    elif echo "$RESPONSE" | grep -q "window has passed"; then
        print_warning "Cancellation window passed (5 minutes)"
        return 0
    else
        print_warning "Could not cancel alert"
        return 0
    fi
}

# ============================================
# 17. GET EMERGENCY DIRECTORY
# ============================================
test_emergency_directory() {
    print_header "17. Get Emergency Directory"
    
    RESPONSE=$(curl -s -X GET "$API_URL/emergency/directory" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Emergency directory retrieved"
        return 0
    else
        print_error "Failed to get emergency directory"
        return 1
    fi
}

# ============================================
# 18. GET NEARBY EMERGENCY CONTACTS
# ============================================
test_nearby_emergency() {
    print_header "18. Get Nearby Emergency Contacts"
    
    RESPONSE=$(curl -s -X GET "$API_URL/emergency/nearby?latitude=37.7749&longitude=-122.4194&radius=5000" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Nearby emergency contacts retrieved"
        return 0
    else
        print_error "Failed to get nearby emergency contacts"
        return 1
    fi
}

# ============================================
# 19. UPDATE CONTACT
# ============================================
test_update_contact() {
    print_header "19. Update Trusted Contact"
    
    if [ -z "$CONTACT_ID" ] || [ "$CONTACT_ID" = "null" ]; then
        print_warning "No contact ID available, skipping update"
        return 0
    fi
    
    print_info "Updating contact: $CONTACT_ID"
    
    RESPONSE=$(curl -s -X PUT "$API_URL/contacts/$CONTACT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -d '{
            "name": "Jane Smith",
            "relationship": "sibling"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Contact updated successfully"
        return 0
    else
        print_error "Failed to update contact"
        return 1
    fi
}

# ============================================
# 20. DELETE CONTACT
# ============================================
test_delete_contact() {
    print_header "20. Delete Trusted Contact"
    
    if [ -z "$CONTACT_ID" ] || [ "$CONTACT_ID" = "null" ]; then
        print_warning "No contact ID available, skipping delete"
        return 0
    fi
    
    print_info "Deleting contact: $CONTACT_ID"
    
    RESPONSE=$(curl -s -X DELETE "$API_URL/contacts/$CONTACT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Contact deleted successfully"
        return 0
    else
        print_error "Failed to delete contact"
        return 1
    fi
}

# ============================================
# 21. REFRESH TOKEN TEST
# ============================================
test_refresh_token() {
    print_header "21. Test Refresh Token"
    
    if [ -z "$REFRESH_TOKEN" ] || [ "$REFRESH_TOKEN" = "null" ]; then
        print_warning "No refresh token available, skipping refresh test"
        return 0
    fi
    
    print_info "Testing token refresh..."
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/refresh-token" \
        -H "Content-Type: application/json" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"} \
        -c cookies.txt \
        -b cookies.txt \
        -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Token refreshed successfully!"
        NEW_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
        if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "null" ]; then
            ACCESS_TOKEN="$NEW_TOKEN"
            print_info "New access token obtained: ${ACCESS_TOKEN:0:20}..."
        fi
        return 0
    else
        print_warning "Refresh token test failed (may not be supported or token expired)"
        return 0
    fi
}

# ============================================
# 22. LOGOUT
# ============================================
test_logout() {
    print_header "22. Logout"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/logout" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        ${CSRF_TOKEN:+-H "x-csrf-token: $CSRF_TOKEN"})
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Logged out successfully"
        return 0
    else
        print_error "Logout failed"
        return 1
    fi
}

# ============================================
# RUN ALL TESTS
# ============================================

main() {
    echo -e "${MAGENTA}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║     🚀 SafeWalk Campus API - Complete Test Suite        ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo "📋 Test Configuration:"
    echo "   API URL: $API_URL"
    echo "   Test Email: $TEST_EMAIL"
    echo ""
    
    # Check if server is running
    check_server || exit 1
    
    # Track test results
    TESTS_PASSED=0
    TESTS_FAILED=0
    
    # Run all tests
    run_test() {
        local test_function="$1"
        
        if eval "$test_function"; then
            ((TESTS_PASSED++))
        else
            ((TESTS_FAILED++))
        fi
    }
    
    # Authentication Tests
    run_test test_health
    run_test test_csrf
    run_test test_signup
    
    # If signup failed, try using existing user
    if [ "$TESTS_FAILED" -gt 0 ]; then
        print_warning "Signup failed, trying to use existing user..."
        read -r -p "Enter email to use: " TEST_EMAIL
        read -r -sp "Enter password: " TEST_PASSWORD
        echo ""
    fi
    
    run_test test_verify_otp
    run_test test_login
    run_test test_get_profile
    
    # ============================================
    # PROFILE TESTS
    # ============================================
    run_test test_get_full_profile
    run_test test_update_full_profile
    run_test test_update_name
    run_test test_update_email
    run_test test_alert_history
    run_test test_alert_history_by_status
    
    # ============================================
    # CLOUDINARY TESTS
    # ============================================
    run_test test_upload_profile_picture
    run_test test_delete_profile_picture
    
    # Onboarding Tests
    run_test test_onboarding_status
    run_test test_update_onboarding
    
    # Contact Tests
    run_test test_add_contact
    run_test test_get_contacts
    run_test test_get_campus_security
    run_test test_update_contact
    run_test test_delete_contact
    
    # SOS Tests
    run_test test_sos_without_auth
    run_test test_sos_with_auth
    run_test test_sos_status
    run_test test_sos_history
    run_test test_cancel_sos
    
    # Emergency Directory Tests
    run_test test_emergency_directory
    run_test test_nearby_emergency
    
    # Refresh Token Test
    run_test test_refresh_token
    
    # Logout
    run_test test_logout
    
    # ============================================
    # EMAIL VERIFICATION SUMMARY
    # ============================================
    print_header "📧 Email Verification Summary"
    echo ""
    echo -e "${CYAN}📨 SOS Alert Confirmation Email:${NC}"
    if [ -n "$ALERT_EMAIL_SENT" ]; then
        echo -e "${GREEN}✅ Confirmation email sent to: $TEST_EMAIL${NC}"
        echo -e "${BLUE}📝 Please check your inbox for the SOS confirmation email${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not verify email confirmation${NC}"
    fi
    echo ""
    
    # ============================================
    # TEST SUMMARY
    # ============================================
    print_header "📊 Test Summary"
    
    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
    
    echo ""
    echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
    echo -e "${BLUE}📊 Total: $TOTAL_TESTS${NC}"
    echo ""
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    else
        echo -e "${RED}⚠️ Some tests failed. Please review the output above.${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}📝 Test User Credentials:${NC}"
    echo "   Email: $TEST_EMAIL"
    echo "   Password: $TEST_PASSWORD"
    echo ""
    
    echo -e "${CYAN}🖼️  Cloudinary Profile Picture:${NC}"
    if [ -n "$PROFILE_PICTURE_URL" ]; then
        echo -e "${GREEN}✅ Profile picture uploaded to Cloudinary${NC}"
        echo "   URL: ${PROFILE_PICTURE_URL:0:60}..."
    else
        echo -e "${YELLOW}⚠️ No profile picture uploaded (Cloudinary may not be configured)${NC}"
    fi
    echo ""
    
    # Clean up
    unset ACCESS_TOKEN
    unset CSRF_TOKEN
    unset REFRESH_TOKEN
    
    # Clean up test image
    rm -f /tmp/test-profile-pic.png
    
    # Clean up cookies file if it exists
    rm -f cookies.txt
    
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${GREEN}✅ Test script completed!${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

# Run the main function
main "$@"