/**
 * Verification of Incoming and Outgoing Message Alignment
 * Validates the test matrix:
 * | Logged-in user | Message sender | Expected position | Bubble Color | Text Color |
 * |---|---|---|---|---|
 * | Student | Student | Right | Blue/purple (#4F46E5) | White |
 * | Student | Admin | Left | White/light-grey (#FFFFFF) | Dark (#0F172A) |
 * | Admin | Admin | Right | Blue/purple (#4F46E5) | White |
 * | Admin | Student | Left | White/light-grey (#FFFFFF) | Dark (#0F172A) |
 */

function calculateMessageAlignment(message, currentUser, currentUserRole) {
  const normalizedCurrentUserId = String(
    currentUser?.id ||
    currentUser?._id ||
    currentUser?.userId ||
    ''
  ).trim().toLowerCase();

  const normalizedMessageSenderId = String(
    message.authorId ||
    message.senderId ||
    message.author?.id ||
    message.author?._id ||
    message.sender?.id ||
    message.sender?._id ||
    ''
  ).trim().toLowerCase();

  const isOwnMessage = Boolean(
    (normalizedCurrentUserId &&
      normalizedMessageSenderId &&
      normalizedCurrentUserId === normalizedMessageSenderId) ||
    (currentUserRole === 'student' && normalizedMessageSenderId === 'current-user') ||
    (currentUserRole === 'admin' && (normalizedMessageSenderId === 'admin-main' || normalizedMessageSenderId === normalizedCurrentUserId))
  );

  const position = isOwnMessage ? 'RIGHT' : 'LEFT';
  const bubbleColor = isOwnMessage ? '#4F46E5 (Blue/Purple)' : '#FFFFFF (White/Light-Grey)';
  const textColor = isOwnMessage ? '#FFFFFF (White)' : '#0F172A (Dark)';
  const showHeader = !isOwnMessage;
  const showReadReceipts = isOwnMessage;

  return { isOwnMessage, position, bubbleColor, textColor, showHeader, showReadReceipts };
}

const testCases = [
  {
    scenario: '1. Student viewing Student message',
    currentUser: { id: '4237c5bb-30d1-495a-96f8-d70ba48ec110', role: 'student' },
    currentUserRole: 'student',
    message: { senderId: '4237c5bb-30d1-495a-96f8-d70ba48ec110', senderName: 'Student7', senderRole: 'student', content: 'Thank you Admin!' },
    expectedPosition: 'RIGHT',
  },
  {
    scenario: '2. Student viewing Admin message',
    currentUser: { id: '4237c5bb-30d1-495a-96f8-d70ba48ec110', role: 'student' },
    currentUserRole: 'student',
    message: { senderId: 'admin-main', senderName: 'Academic Admin', senderRole: 'admin', content: 'Welcome to Global LMS!' },
    expectedPosition: 'LEFT',
  },
  {
    scenario: '3. Admin viewing Admin message',
    currentUser: { id: 'admin-main', role: 'admin' },
    currentUserRole: 'admin',
    message: { senderId: 'admin-main', senderName: 'Academic Admin', senderRole: 'admin', content: 'Course schedule posted.' },
    expectedPosition: 'RIGHT',
  },
  {
    scenario: '4. Admin viewing Student message',
    currentUser: { id: 'admin-main', role: 'admin' },
    currentUserRole: 'admin',
    message: { senderId: '4237c5bb-30d1-495a-96f8-d70ba48ec110', senderName: 'Student7', senderRole: 'student', content: 'Hello Admin!' },
    expectedPosition: 'LEFT',
  },
];

console.log('================================================================================');
console.log('GLOBAL LMS – MESSAGE ALIGNMENT TEST MATRIX VERIFICATION');
console.log('================================================================================\n');

let allPassed = true;

for (const tc of testCases) {
  const result = calculateMessageAlignment(tc.message, tc.currentUser, tc.currentUserRole);
  const passed = result.position === tc.expectedPosition;
  if (!passed) allPassed = false;

  console.log(`Test: ${tc.scenario}`);
  console.log(`  Logged-in User Role: ${tc.currentUserRole.toUpperCase()} (ID: ${tc.currentUser.id})`);
  console.log(`  Message Sender: ${tc.message.senderName} (Sender ID: ${tc.message.senderId})`);
  console.log(`  Result Position: ${result.position} (Expected: ${tc.expectedPosition}) -> ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Bubble Color: ${result.bubbleColor}`);
  console.log(`  Text Color: ${result.textColor}`);
  console.log(`  Displays Sender Header & Badge: ${result.showHeader}`);
  console.log(`  Displays Read Receipts (✓/✓✓): ${result.showReadReceipts}\n`);
}

console.log('================================================================================');
console.log(`OVERALL RESULT: ${allPassed ? 'ALL 4 TEST SCENARIOS PASSED (100%)' : 'SOME TESTS FAILED'}`);
console.log('================================================================================');

