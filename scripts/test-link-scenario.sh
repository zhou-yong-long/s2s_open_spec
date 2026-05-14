#!/bin/bash
# SDD Link Management - Real World Scenario Test
# Scenario: E-commerce Order System Refactoring

set -e

echo "=== SDD Link Management Test ==="
echo "Scenario: E-commerce Order System Refactoring"
echo ""

# Setup test directory
TEST_DIR="/tmp/sdd-link-test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "1. Initializing SDD project..."
sdd init --mode domain
echo ""

echo "2. Creating specs..."

# Epic
sdd new "Order System Refactoring" --domain order
echo ""

# Features
sdd new "User Authentication" --domain auth
sdd new "Order Creation" --domain order
sdd new "Payment Processing" --domain payment
sdd new "Inventory Management" --domain inventory
sdd new "Notification Service" --domain notification

echo ""
echo "3. Linking specs..."

# Parent-child relationships
echo "   Linking Order Creation as child of Order System Refactoring..."
sdd link "$TEST_DIR/specs/active/order/2026-05-14-order-system-refactoring.md" \
         "$TEST_DIR/specs/active/order/2026-05-14-order-creation.md" \
         --type parent --note "Order creation is part of the refactoring epic"

echo "   Linking Payment Processing as child of Order System Refactoring..."
sdd link "$TEST_DIR/specs/active/order/2026-05-14-order-system-refactoring.md" \
         "$TEST_DIR/specs/active/payment/2026-05-14-payment-processing.md" \
         --type parent --note "Payment is part of the refactoring epic"

echo ""

# Blocking relationships
echo "   Linking User Authentication blocks Order Creation..."
sdd link "$TEST_DIR/specs/active/auth/2026-05-14-user-authentication.md" \
         "$TEST_DIR/specs/active/order/2026-05-14-order-creation.md" \
         --type blocks --note "Auth must be completed before order creation"

echo "   Linking Inventory Management relates to Order Creation..."
sdd link "$TEST_DIR/specs/active/inventory/2026-05-14-inventory-management.md" \
         "$TEST_DIR/specs/active/order/2026-05-14-order-creation.md" \
         --type relates --note "Inventory affects order creation flow"

echo "   Linking Notification Service relates to Payment Processing..."
sdd link "$TEST_DIR/specs/active/notification/2026-05-14-notification-service.md" \
         "$TEST_DIR/specs/active/payment/2026-05-14-payment-processing.md" \
         --type relates --note "Notify users after payment"

echo ""
echo "4. Viewing all links..."
sdd links

echo ""
echo "5. Viewing links for Order Creation..."
sdd links "$TEST_DIR/specs/active/order/2026-05-14-order-creation.md"

echo ""
echo "6. Viewing links for Payment Processing (incoming only)..."
sdd links "$TEST_DIR/specs/active/payment/2026-05-14-payment-processing.md" --direction in

echo ""
echo "7. Visualizing graph..."
sdd graph

echo ""
echo "8. Checking consistency..."
sdd sync-links --check

echo ""
echo "9. Syncing links to Hive Mind..."
sdd sync-links --include-implicit

echo ""
echo "10. Viewing links.yaml content..."
echo "---"
cat .sdd/links.yaml
echo "---"

echo ""
echo "11. Testing cycle detection (should fail)..."
sdd link "$TEST_DIR/specs/active/order/2026-05-14-order-creation.md" \
         "$TEST_DIR/specs/active/order/2026-05-14-order-system-refactoring.md" \
         --type parent --note "This should create a cycle" || echo "   ✓ Cycle detected and rejected"

echo ""
echo "12. Testing unlink..."
sdd unlink "$TEST_DIR/specs/active/notification/2026-05-14-notification-service.md" \
           "$TEST_DIR/specs/active/payment/2026-05-14-payment-processing.md"
echo "   Link removed"

echo ""
echo "13. Final link state..."
sdd links

echo ""
echo "=== Test Complete ==="
echo "Test directory: $TEST_DIR"
echo ""
echo "To verify in Hive Mind:"
echo "1. Check .hivemind/specs.json for spec index"
echo "2. Check .sdd/links.yaml for link relationships"
echo "3. Use 'sdd sync-links --submit' to upload to Hive Mind"
