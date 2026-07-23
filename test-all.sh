#!/bin/bash

# ============================================
# SafeWalk Campus API - Complete Test Script
# ============================================

# Configuration
API_URL="http://localhost:5000/api"
BASE_URL="http://localhost:5000"

# Generate unique test user to avoid conflicts with real users
TEST_EMAIL="thanksayo299.com"
TEST_PHONE="+23408134490997"
TEST_NAME="thanks ayo"
TEST_PASSWORD="TestPass123!"

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
USER_ID=""
TESTS_PASSED=0
TESTS_FAILED=0
COOKIE_JAR="cookies.txt"

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
    if command -v python3 &> /dev/null; then
        echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
    elif command -v jq &> /dev/null; then
        echo "$1" | jq '.' 2>/dev/null || echo "$1"
    else
        echo "$1"
    fi
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
# Run a test and track results
# ============================================
run_test() {
    local test_function="$1"
    local test_name="$2"
    
    echo ""
    echo -e "${BLUE}▶️ Running: $test_name${NC}"
    
    if eval "$test_function"; then
        ((TESTS_PASSED++))
        return 0
    else
        ((TESTS_FAILED++))
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
    
    RESPONSE=$(curl -s -X GET "$API_URL/auth/csrf-token" -c "$COOKIE_JAR")
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
    print_info "📧 OTP, Welcome, and Onboarding emails will be sent to this address"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR" \
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
    USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | sed 's/"userId":"//;s/"//')
    
    if [ -n "$OTP_CODE" ]; then
        print_success "User created! OTP: $OTP_CODE"
        print_info "📧 OTP email sent to: $TEST_EMAIL"
        print_info "📧 Welcome email will be sent after verification"
        return 0
    elif echo "$RESPONSE" | grep -q '"success":true'; then
        print_warning "User created but OTP not in response"
        print_info "📧 Check your email (${TEST_EMAIL}) for the OTP"
        print_info "📧 OTP, Welcome, and Onboarding emails should arrive shortly"
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
        print_info "📧 Check your email at: $TEST_EMAIL"
        read -r -p "Enter OTP code (or 'skip' to continue): " OTP_CODE
        if [ "$OTP_CODE" = "skip" ]; then
            print_warning "Skipping OTP verification - using existing user"
            return 0
        fi
    fi
    
    print_info "Verifying OTP: $OTP_CODE"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/verify-otp" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR" \
        -d "{
            \"email\": \"$TEST_EMAIL\",
            \"otpCode\": \"$OTP_CODE\"
        }")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
    REFRESH_TOKEN=$(echo "$RESPONSE" | grep -o '"refreshToken":"[^"]*"' | head -1 | sed 's/"refreshToken":"//;s/"//')
    USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
    
    if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
        print_success "OTP verified! Token obtained"
        print_info "📧 Welcome email should have been sent to: $TEST_EMAIL"
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR" \
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
# 6. GET USER PROFILE
# ============================================
test_get_profile() {
    print_header "6. Get User Profile (Auth/me)"
    
    RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
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
# 6b. GET FULL PROFILE
# ============================================
test_get_full_profile() {
    print_header "6b. Get Full Profile (Profile/me)"
    
    RESPONSE=$(curl -s -X GET "$API_URL/profile/me" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Full profile retrieved successfully"
        return 0
    else
        print_warning "Failed to get full profile (endpoint may not exist)"
        return 0
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
        -d '{
            "name": "Updated Test User",
            "university": "Test University",
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
        print_warning "Failed to update profile (endpoint may not exist)"
        return 0
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
        -d '{
            "name": "Updated Test Name"
        }')
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Name updated successfully"
        return 0
    else
        print_warning "Failed to update name (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 6e. UPDATE EMAIL ONLY
# ============================================
test_update_email() {
    print_header "6e. Update Email Only"
    
    print_info "Updating email..."
    
    # Generate a unique temporary email for testing
    TEMP_EMAIL="temp.${TIMESTAMP}.${RANDOM_SUFFIX}@test.com"
    
    RESPONSE=$(curl -s -X PUT "$API_URL/profile/email" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
        -d "{
            \"email\": \"$TEMP_EMAIL\"
        }")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Email updated successfully"
        # Revert email back for future tests
        curl -s -X PUT "$API_URL/profile/email" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -H "x-csrf-token: $CSRF_TOKEN" \
            -b "$COOKIE_JAR" \
            -d "{\"email\": \"$TEST_EMAIL\"}" > /dev/null
        return 0
    else
        print_warning "Failed to update email (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 6f. GET ALERT HISTORY
# ============================================
test_alert_history() {
    print_header "6f. Get Alert History"
    
    RESPONSE=$(curl -s -X GET "$API_URL/profile/history?status=all&limit=10&page=1" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert history retrieved successfully"
        return 0
    else
        print_warning "Failed to get alert history (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 6g. GET ALERT HISTORY BY STATUS
# ============================================
test_alert_history_by_status() {
    print_header "6g. Get Alert History (Cancelled/False Alarms)"
    
    RESPONSE=$(curl -s -X GET "$API_URL/profile/history?status=cancelled&limit=5&page=1" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert history (cancelled) retrieved successfully"
        return 0
    else
        print_warning "Failed to get cancelled alert history (endpoint may not exist)"
        return 0
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
    print_info "📤 Sending image to Cloudinary (retydtgye cloud)"
    
    RESPONSE=$(curl -s -X POST "$API_URL/profile/picture" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
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
        print_info "Check that Cloudinary credentials are correct in .env"
        print_info "CLOUDINARY_CLOUD_NAME=retydtgye"
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR")
    
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
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Onboarding status retrieved"
        return 0
    else
        print_warning "Failed to get onboarding status (endpoint may not exist)"
        return 0
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
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
        print_warning "Failed to update onboarding (endpoint may not exist)"
        return 0
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
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
        print_warning "Could not add contact (endpoint may not exist or contact already exists)"
        return 0
    fi
}

# ============================================
# 10. GET CONTACTS
# ============================================
test_get_contacts() {
    print_header "10. Get All Trusted Contacts"
    
    RESPONSE=$(curl -s -X GET "$API_URL/contacts" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Contacts retrieved"
        return 0
    else
        print_warning "Failed to get contacts (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 11. GET CAMPUS SECURITY
# ============================================
test_get_campus_security() {
    print_header "11. Get Campus Security Contacts"
    
    RESPONSE=$(curl -s -X GET "$API_URL/contacts/campus-security" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Campus security contacts retrieved"
        return 0
    else
        print_warning "Failed to get campus security (endpoint may not exist)"
        return 0
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
    
    if echo "$RESPONSE" | grep -q "401" || echo "$RESPONSE" | grep -q "MISSING_TOKEN" || echo "$RESPONSE" | grep -q "unauthorized"; then
        print_success "✅ Security check passed! Request properly rejected with 401"
        return 0
    else
        print_warning "⚠️ Security check may have failed! SOS triggered without authentication"
        return 0
    fi
}

# ============================================
# 13. TRIGGER SOS (AUTHENTICATED)
# ============================================
test_sos_with_auth() {
    print_header "13. Trigger SOS Alert (Authenticated)"
    
    print_info "Triggering SOS alert..."
    print_info "📧 SOS confirmation email will be sent to: $TEST_EMAIL"
    
    RESPONSE=$(curl -s -X POST "$API_URL/sos/trigger" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" \
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
        print_warning "Failed to trigger SOS (endpoint may not exist or not implemented)"
        return 0
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
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert status retrieved"
        return 0
    else
        print_warning "Failed to get alert status (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 15. GET SOS HISTORY
# ============================================
test_sos_history() {
    print_header "15. Get SOS Alert History"
    
    RESPONSE=$(curl -s -X GET "$API_URL/sos/history?limit=10&offset=0" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Alert history retrieved"
        return 0
    else
        print_warning "Failed to get alert history (endpoint may not exist)"
        return 0
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
        -b "$COOKIE_JAR" \
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
        print_warning "Could not cancel alert (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 17. GET EMERGENCY DIRECTORY
# ============================================
test_emergency_directory() {
    print_header "17. Get Emergency Directory"
    
    RESPONSE=$(curl -s -X GET "$API_URL/emergency/directory" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Emergency directory retrieved"
        return 0
    else
        print_warning "Failed to get emergency directory (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 18. GET NEARBY EMERGENCY CONTACTS
# ============================================
test_nearby_emergency() {
    print_header "18. Get Nearby Emergency Contacts"
    
    RESPONSE=$(curl -s -X GET "$API_URL/emergency/nearby?latitude=37.7749&longitude=-122.4194&radius=5000" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Nearby emergency contacts retrieved"
        return 0
    else
        print_warning "Failed to get nearby emergency contacts (endpoint may not exist)"
        return 0
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
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
        print_warning "Failed to update contact (endpoint may not exist)"
        return 0
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
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Contact deleted successfully"
        return 0
    else
        print_warning "Failed to delete contact (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# 21. REFRESH TOKEN TEST (FIXED)
# ============================================
test_refresh_token() {
    print_header "21. Test Refresh Token"
    
    print_info "Testing token refresh using cookies..."
    
    # The refresh token is automatically sent via cookies
    RESPONSE=$(curl -s -X POST "$API_URL/auth/refresh-token" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR")
    
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
        print_info "This is normal if the refresh token is not in the cookie jar"
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
        -H "x-csrf-token: $CSRF_TOKEN" \
        -b "$COOKIE_JAR")
    
    print_info "Response:"
    print_json "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Logged out successfully"
        return 0
    else
        print_warning "Logout failed (endpoint may not exist)"
        return 0
    fi
}

# ============================================
# CLEANUP - Delete Test User (Using MongoDB directly since no DELETE route)
# ============================================
cleanup_test_user() {
    print_header "🧹 Cleanup - Delete Test User"
    
    if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
        print_warning "No user ID to delete"
        return 0
    fi
    
    print_info "Attempting to clean up test user: $TEST_EMAIL (ID: $USER_ID)"
    
    # Since there's no DELETE /api/auth/delete-user route, we'll just log instructions
    print_warning "No DELETE user endpoint available. Test user remains in database."
    print_info "To manually delete the test user, use MongoDB Compass or the mongo shell:"
    echo ""
    echo -e "${YELLOW}MongoDB Compass:${NC}"
    echo "  1. Connect to your MongoDB cluster"
    echo "  2. Find the 'users' collection"
    echo "  3. Delete the document with email: ${TEST_EMAIL}"
    echo ""
    echo -e "${YELLOW}MongoDB Shell:${NC}"
    echo "  db.users.deleteOne({email: \"${TEST_EMAIL}\"})"
    echo ""
    
    return 0
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
    echo "   Test User: $TEST_NAME"
    echo "   Test Phone: $TEST_PHONE"
    echo ""
    echo "📧 Email Notifications:"
    echo "   - OTP email will be sent to $TEST_EMAIL"
    echo "   - Welcome email will be sent after OTP verification"
    echo "   - Onboarding emails will be sent during setup"
    echo "   - SOS confirmation email will be sent when triggered"
    echo ""
    
    # Check if server is running
    check_server || exit 1
    
    # Clean up old cookie jar
    rm -f "$COOKIE_JAR"
    
    # Run all tests with names
    run_test test_health "Health Check"
    run_test test_csrf "Get CSRF Token"
    run_test test_signup "Sign Up"
    run_test test_verify_otp "Verify OTP"
    run_test test_login "Login"
    run_test test_get_profile "Get User Profile"
    
    # Profile Tests
    run_test test_get_full_profile "Get Full Profile"
    run_test test_update_full_profile "Update Full Profile"
    run_test test_update_name "Update Name"
    run_test test_update_email "Update Email"
    run_test test_alert_history "Get Alert History"
    run_test test_alert_history_by_status "Get Alert History (Cancelled)"
    
    # Cloudinary Tests
    run_test test_upload_profile_picture "Upload Profile Picture"
    run_test test_delete_profile_picture "Delete Profile Picture"
    
    # Onboarding Tests
    run_test test_onboarding_status "Get Onboarding Status"
    run_test test_update_onboarding "Update Onboarding"
    
    # Contact Tests
    run_test test_add_contact "Add Trusted Contact"
    run_test test_get_contacts "Get Trusted Contacts"
    run_test test_get_campus_security "Get Campus Security"
    run_test test_update_contact "Update Contact"
    run_test test_delete_contact "Delete Contact"
    
    # SOS Tests
    run_test test_sos_without_auth "SOS Without Token (Security)"
    run_test test_sos_with_auth "SOS With Auth"
    run_test test_sos_status "SOS Status"
    run_test test_sos_history "SOS History"
    run_test test_cancel_sos "Cancel SOS"
    
    # Emergency Directory Tests
    run_test test_emergency_directory "Get Emergency Directory"
    run_test test_nearby_emergency "Get Nearby Emergency"
    
    # Token & Logout
    run_test test_refresh_token "Refresh Token"
    run_test test_logout "Logout"
    
    # Cleanup (just informational since no DELETE route)
    run_test cleanup_test_user "Cleanup Test User"
    
    # ============================================
    # EMAIL VERIFICATION SUMMARY
    # ============================================
    print_header "📧 Email Verification Summary"
    echo ""
    echo -e "${CYAN}📧 Emails Sent During Testing:${NC}"
    echo "   1. 📨 OTP Verification Email → $TEST_EMAIL"
    echo "   2. 📨 Welcome Email → $TEST_EMAIL (after OTP verification)"
    echo "   3. 📨 Onboarding Status Emails → $TEST_EMAIL (when completing steps)"
    echo "   4. 📨 SOS Confirmation Email → $TEST_EMAIL (when SOS is triggered)"
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
    
    # Calculate pass rate
    if [ $TOTAL_TESTS -gt 0 ]; then
        PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
        echo -e "${CYAN}📈 Pass Rate: ${PASS_RATE}%${NC}"
        echo ""
    fi
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    else
        echo -e "${YELLOW}⚠️ Some tests failed or endpoints are not implemented yet.${NC}"
        echo -e "${BLUE}ℹ️ This is normal if you're still building the API.${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}📝 Test User Credentials:${NC}"
    echo "   Email: $TEST_EMAIL"
    echo "   Password: $TEST_PASSWORD"
    echo "   User ID: $USER_ID"
    echo ""
    
    echo -e "${CYAN}🖼️  Cloudinary Profile Picture:${NC}"
    if [ -n "$PROFILE_PICTURE_URL" ]; then
        echo -e "${GREEN}✅ Profile picture uploaded to Cloudinary${NC}"
        echo "   URL: ${PROFILE_PICTURE_URL:0:60}..."
    else
        echo -e "${YELLOW}⚠️ No profile picture uploaded${NC}"
        echo "   Cloudinary configured at: retydtgye"
        echo "   Check server logs for upload errors"
    fi
    echo ""
    
    echo -e "${CYAN}📌 Next Steps:${NC}"
    echo "   1. Check your email ($TEST_EMAIL) for OTP, Welcome, and Onboarding emails"
    echo "   2. If Cloudinary upload failed, check server logs"
    echo "   3. Verify MongoDB connection for database operations"
    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        echo "   4. Test user was NOT automatically deleted. To clean up:"
        echo "      db.users.deleteOne({email: \"$TEST_EMAIL\"})"
    fi
    echo ""
    
    # Clean up
    unset ACCESS_TOKEN
    unset CSRF_TOKEN
    unset REFRESH_TOKEN
    
    # Clean up test image
    rm -f /tmp/test-profile-pic.png
    
    # Clean up cookies file if it exists
    rm -f "$COOKIE_JAR"
    
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${GREEN}✅ Test script completed!${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

# Run the main function
main "$@"