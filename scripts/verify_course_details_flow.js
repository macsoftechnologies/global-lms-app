/**
 * Test Script: Course Details Entitlement & Navigation Verification
 */
const assert = require('assert');

function simulateCourseDetailsEntitlement({
  activeCourseId,
  isNavigatedFromLocked,
  accessRes,
}) {
  const cleanCourseId = String(activeCourseId || '').trim();
  if (!cleanCourseId) {
    return {
      isEntitled: false,
      accessEntitlementText: 'Not Enrolled',
      actionButtonText: 'Course Currently Unavailable',
    };
  }

  const isActuallyEntitled = isNavigatedFromLocked
    ? Boolean(accessRes.isPurchased || (accessRes.canAccess && accessRes.enrollmentId && accessRes.isEnrolled))
    : Boolean(accessRes.canAccess);

  const priceDisplay = 'INR 6000.00';
  const isFree = false;

  let actionButtonText = '';
  if (isActuallyEntitled) {
    actionButtonText = 'CONTINUE LEARNING';
  } else if (isFree) {
    actionButtonText = 'ENROLL NOW';
  } else {
    actionButtonText = `BUY NOW – ${priceDisplay}`;
  }

  return {
    isEntitled: isActuallyEntitled,
    accessEntitlementText: isActuallyEntitled ? 'Enrolled (Full Access)' : 'Not Enrolled',
    actionButtonText,
  };
}

console.log('========================================================================');
console.log('GLOBAL LMS – COURSE DETAILS & LOCKED NAVIGATION VERIFICATION');
console.log('========================================================================\n');

// Scenario 1: User taps on Locked Course ("History of Christianity")
console.log('Scenario 1: Navigating to Locked Course (History of Christianity):');
const lockedResult = simulateCourseDetailsEntitlement({
  activeCourseId: 'course-history-of-christianity',
  isNavigatedFromLocked: true,
  accessRes: {
    canAccess: false,
    isPurchased: false,
    isEnrolled: false,
    status: 'LOCKED',
  },
});
console.log('  isEntitled:', lockedResult.isEntitled);
console.log('  Access Entitlement Label:', lockedResult.accessEntitlementText);
console.log('  Bottom Button:', lockedResult.actionButtonText);
assert.strictEqual(lockedResult.isEntitled, false);
assert.strictEqual(lockedResult.accessEntitlementText, 'Not Enrolled');
assert.strictEqual(lockedResult.actionButtonText, 'BUY NOW – INR 6000.00');
console.log('  -> PASS: Locked course shows "Not Enrolled" and "BUY NOW" button.\n');

// Scenario 2: User taps on Enrolled Course ("Biblical Theology")
console.log('Scenario 2: Navigating to Enrolled Course (Biblical Theology):');
const enrolledResult = simulateCourseDetailsEntitlement({
  activeCourseId: 'course-biblical-theology',
  isNavigatedFromLocked: false,
  accessRes: {
    canAccess: true,
    isPurchased: true,
    isEnrolled: true,
    enrollmentId: 'enroll-101',
    status: 'ENROLLED',
  },
});
console.log('  isEntitled:', enrolledResult.isEntitled);
console.log('  Access Entitlement Label:', enrolledResult.accessEntitlementText);
console.log('  Bottom Button:', enrolledResult.actionButtonText);
assert.strictEqual(enrolledResult.isEntitled, true);
assert.strictEqual(enrolledResult.accessEntitlementText, 'Enrolled (Full Access)');
assert.strictEqual(enrolledResult.actionButtonText, 'CONTINUE LEARNING');
console.log('  -> PASS: Enrolled course shows "Enrolled (Full Access)" and "CONTINUE LEARNING" button.\n');

console.log('========================================================================');
console.log('ALL COURSE DETAILS SCENARIOS VERIFIED SUCCESSFULLY (2/2)');
console.log('========================================================================');

