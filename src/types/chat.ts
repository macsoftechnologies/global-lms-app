/**
 * Discussion & Real-Time Chat Types
 * Aligned with Global LMS Website (/admin/chat & /student/chat) and Postman Collection
 */

export type ChatRole =
  | 'student'
  | 'admin'
  | 'faculty'
  | 'supportadmin'
  | 'teacher'
  | 'ORG_USER'
  | 'SUPER_ADMIN'
  | 'FACULTY'
  | 'STUDENT';

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  authorId?: string;
  senderName: string;
  senderRole: string;
  message: string;
  content?: string;
  createdAt: string;
  isRead: boolean;
  isDeleted?: boolean;
  readBy?: {
    userId: string;
    readAt: string;
  }[];
  author?: {
    id?: string;
    _id?: string;
    fullName?: string;
    name?: string;
    userType?: string;
    role?: string;
  };
  sender?: {
    id?: string;
    _id?: string;
    fullName?: string;
    name?: string;
    userType?: string;
    role?: string;
  };
}

export interface ChatParticipant {
  id: string;
  name: string;
  fullName?: string;
  role: string;
  userType?: string;
  email?: string;
  avatarLetter?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string;
  type: 'direct' | 'support' | 'group' | 'course';
  threadType?: 'DIRECT_MESSAGE' | 'BATCH_GROUP' | 'COURSE_GROUP' | string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId?: string;
  lastSenderRole?: string;
  unreadCount: number;
  unreadCountAdmin?: number;
  unreadCountStudent?: number;
  participants: ChatParticipant[];
  partner?: {
    id: string;
    fullName?: string;
    name?: string;
    userType?: string;
    role?: string;
    email?: string;
    avatarUrl?: string;
    isOnline?: boolean;
  };
  otherParticipantName?: string;
  status: 'active' | 'pending' | 'in_progress' | 'resolved' | 'closed';
  isGroup?: boolean;
  isBatch?: boolean;
  isCourse?: boolean;
  courseId?: string;
  batchId?: string;
  pinned?: boolean;
  createdAt?: string;
}

export interface ForumReply {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  isModerated?: boolean;
}

export interface ForumTopic {
  id: string;
  title: string;
  content: string;
  category: 'General' | 'Assignments' | 'Exams' | 'Announcements' | 'Curriculum' | 'Q&A';
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  replyCount: number;
  likesCount?: number;
  isPinned: boolean;
  replies: ForumReply[];
}

export interface RegisteredStudent {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  mobile?: string;
  enrolledProgram?: string;
  avatarLetter: string;
  isOnline: boolean;
  joinedAt?: string;
  userType?: string;
  role?: ChatRole | string;
}

export interface ChatContactItem {
  id: string;
  fullName: string;
  name?: string;
  userType: string;
  role?: string;
  email?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface DiscussionContactsResponse {
  adminsAndFaculty: ChatContactItem[];
  classmates: ChatContactItem[];
}
