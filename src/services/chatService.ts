import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  ChatConversation,
  ChatMessage,
  ChatRole,
  ChatContactItem,
  DiscussionContactsResponse,
  ForumReply,
  ForumTopic,
  RegisteredStudent,
} from '../types/chat';
import { AuthStorage } from './authStorage';
import { ApiClient } from './api';
import { ENV } from '../config/env';

// Storage Keys
const CONVERSATIONS_KEY = 'lms_chat_conversations_v4';
const MESSAGES_KEY = 'lms_chat_messages_map_v4';
const FORUM_TOPICS_KEY = 'lms_forum_topics_v4';
const REGISTERED_STUDENTS_KEY = 'lms_registered_students_v4';
const ACTIVE_ROLE_OVERRIDE_KEY = 'lms_chat_role_override_v4';
const LAST_READ_PREFIX = 'chat_last_read_';

// In-Memory Storage Fallback
const memoryStore: Record<string, string> = {};

async function storageSetItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStore[key] = value;
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    memoryStore[key] = value;
  }
}

async function storageGetItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStore[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryStore[key] || null;
  }
}

// Default Seed Data for offline fallback / instant initial render
const INITIAL_CONVERSATIONS: ChatConversation[] = [
  {
    id: 'conv-admin-direct',
    title: 'Academic Admin',
    type: 'direct',
    threadType: 'DIRECT_MESSAGE',
    lastMessage: 'Welcome! Academic administration is here to assist with your coursework.',
    lastMessageAt: '10:30 AM',
    unreadCount: 0,
    unreadCountStudent: 0,
    unreadCountAdmin: 0,
    lastSenderRole: 'admin',
    lastSenderId: 'admin-main',
    status: 'active',
    isGroup: false,
    pinned: true,
    createdAt: new Date().toISOString(),
    partner: {
      id: 'admin-main',
      fullName: 'Academic Admin',
      userType: 'ORG_USER',
      role: 'admin',
      email: 'admissions@cotr.edu',
    },
    participants: [
      { id: 'admin-main', name: 'Academic Admin', role: 'admin', userType: 'ORG_USER', isOnline: true },
      { id: 'current-user', name: 'Student', role: 'student', userType: 'STUDENT', isOnline: true },
    ],
  },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  'conv-admin-direct': [
    {
      id: 'msg-adm-1',
      threadId: 'conv-admin-direct',
      senderId: 'admin-main',
      authorId: 'admin-main',
      senderName: 'Academic Admin',
      senderRole: 'admin',
      message: 'Welcome to Global LMS! Feel free to reach out here for academic guidance, course queries, or enrollment assistance.',
      content: 'Welcome to Global LMS! Feel free to reach out here for academic guidance, course queries, or enrollment assistance.',
      createdAt: '10:30 AM',
      isRead: true,
      isDeleted: false,
    },
    {
      id: 'msg-stu-1',
      threadId: 'conv-admin-direct',
      senderId: 'current-user',
      authorId: 'current-user',
      senderName: 'Student',
      senderRole: 'student',
      message: 'Thank you! Could you please clarify the due date for Module 1 readings and assignments?',
      content: 'Thank you! Could you please clarify the due date for Module 1 readings and assignments?',
      createdAt: '10:32 AM',
      isRead: true,
      isDeleted: false,
    },
  ],
};

const INITIAL_FORUM_TOPICS: ForumTopic[] = [
  {
    id: 'topic-announcement-1',
    title: 'Academic Integrity & Course Submission Guidelines',
    content:
      'Welcome to the Global LMS academic term. All submitted assignments, capstone papers, and forum contributions are subjected to automated academic integrity validation.',
    category: 'Announcements',
    authorId: 'admin-main',
    authorName: 'Academic Administration',
    authorRole: 'admin',
    createdAt: 'Today, 08:00 AM',
    replyCount: 3,
    likesCount: 14,
    isPinned: true,
    replies: [
      {
        id: 'reply-1',
        topicId: 'topic-announcement-1',
        authorId: 'student-varsha',
        authorName: 'Varsha K',
        authorRole: 'student',
        content: 'Thank you for the update. Where can we check citation standards for Biblical Greek assignments?',
        createdAt: 'Today, 08:45 AM',
      },
      {
        id: 'reply-2',
        topicId: 'topic-announcement-1',
        authorId: 'admin-main',
        authorName: 'Academic Administration',
        authorRole: 'admin',
        content: 'Citation guidelines (Turabian 9th edition) are available under Course Resources in the Student Portal.',
        createdAt: 'Today, 09:15 AM',
      },
    ],
  },
  {
    id: 'topic-biblical-1',
    title: 'Hermeneutics Module 1: Historical-Grammatical Method Discussion',
    content:
      'Let us discuss the key takeaways from Dr. Thomas’s lecture on the grammatical context of 1st-century pastoral epistles.',
    category: 'Curriculum',
    authorId: 'student-varsha',
    authorName: 'Varsha K',
    authorRole: 'student',
    createdAt: 'Yesterday, 03:15 PM',
    replyCount: 2,
    likesCount: 9,
    isPinned: false,
    replies: [
      {
        id: 'reply-3',
        topicId: 'topic-biblical-1',
        authorId: 'admin-main',
        authorName: 'Faculty Moderator',
        authorRole: 'faculty',
        content: 'Excellent observation. Note how cultural idioms shape our modern interpretive lens.',
        createdAt: 'Yesterday, 04:20 PM',
      },
    ],
  },
];

export const ChatService = {
  /**
   * Initializes persistent storage with initial data if needed
   */
  async init(): Promise<void> {
    const existingConvs = await storageGetItem(CONVERSATIONS_KEY);
    if (!existingConvs) {
      await storageSetItem(CONVERSATIONS_KEY, JSON.stringify(INITIAL_CONVERSATIONS));
    }

    const existingMsgs = await storageGetItem(MESSAGES_KEY);
    if (!existingMsgs) {
      await storageSetItem(MESSAGES_KEY, JSON.stringify(INITIAL_MESSAGES));
    }

    const existingTopics = await storageGetItem(FORUM_TOPICS_KEY);
    if (!existingTopics) {
      await storageSetItem(FORUM_TOPICS_KEY, JSON.stringify(INITIAL_FORUM_TOPICS));
    }
  },

  /**
   * Resolves the current user's role
   */
  async getCurrentUserRole(): Promise<ChatRole> {
    const override = await storageGetItem(ACTIVE_ROLE_OVERRIDE_KEY);
    if (override === 'admin' || override === 'student' || override === 'faculty') {
      return override as ChatRole;
    }
    const role = await AuthStorage.getUserRole();
    if (role === 'faculty') return 'faculty';
    const user = await AuthStorage.getUser();
    const rawRole = String(user?.role || user?.userType || '').toUpperCase();
    if (rawRole.includes('ADMIN') || rawRole.includes('ORG_USER') || rawRole.includes('SUPER_ADMIN')) {
      return 'admin';
    }
    return 'student';
  },

  /**
   * Sets role override (allowing Admin / Student switching for testing)
   */
  async setRoleOverride(role: ChatRole): Promise<void> {
    await storageSetItem(ACTIVE_ROLE_OVERRIDE_KEY, role);
  },

  /**
   * Clears role override
   */
  async clearRoleOverride(): Promise<void> {
    await storageSetItem(ACTIVE_ROLE_OVERRIDE_KEY, '');
  },

  /**
   * Reads the last read timestamps map for a user (matching website chat_last_read_${userId})
   */
  async getLastReadMap(userId: string): Promise<Record<string, string>> {
    try {
      const raw = await storageGetItem(`${LAST_READ_PREFIX}${userId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Updates the last read timestamp for a thread (matching website Te / se)
   */
  async setThreadLastRead(userId: string, threadId: string): Promise<void> {
    try {
      const map = await this.getLastReadMap(userId);
      map[threadId] = new Date().toISOString();
      await storageSetItem(`${LAST_READ_PREFIX}${userId}`, JSON.stringify(map));
    } catch {
      // Ignored
    }
  },

  /**
   * Fetches contacts list from GET /discussion/contacts (Website Oe() & ge() contract)
   */
  async getContacts(): Promise<DiscussionContactsResponse> {
    try {
      console.log(`[ChatService] Fetching contacts from ${ENV.API_URL}/discussion/contacts...`);
      const res = await ApiClient.get<any>('/discussion/contacts');
      if (res.success && res.data) {
        const raw = res.data.data || res.data;
        const adminsAndFaculty: ChatContactItem[] = Array.isArray(raw.adminsAndFaculty)
          ? raw.adminsAndFaculty.map((c: any) => ({
              id: c.id || c._id || c.userId,
              fullName: c.fullName || c.name || 'Academic Admin',
              userType: c.userType || c.role || 'ORG_USER',
              email: c.email || '',
              avatarUrl: c.avatarUrl,
              isOnline: Boolean(c.isOnline ?? true),
            }))
          : [];

        const classmates: ChatContactItem[] = Array.isArray(raw.classmates)
          ? raw.classmates.map((c: any) => ({
              id: c.id || c._id || c.userId,
              fullName: c.fullName || c.name || 'Student',
              userType: c.userType || c.role || 'STUDENT',
              email: c.email || '',
              avatarUrl: c.avatarUrl,
              isOnline: Boolean(c.isOnline ?? true),
            }))
          : [];

        return { adminsAndFaculty, classmates };
      }
    } catch (err) {
      console.warn('[ChatService] getContacts API error:', err);
    }

    return {
      adminsAndFaculty: [
        {
          id: 'admin-main',
          fullName: 'Academic Admin',
          userType: 'ORG_USER',
          email: 'admissions@cotr.edu',
          isOnline: true,
        },
      ],
      classmates: [],
    };
  },

  /**
   * Resolves the active Admin recipient dynamically (never hardcoded)
   */
  async getAdminRecipient(): Promise<{ id: string; name: string; email: string; userType: string }> {
    try {
      const contacts = await this.getContacts();
      const adminFound = contacts.adminsAndFaculty.find(
        (c) =>
          c.userType === 'ORG_USER' ||
          c.userType === 'SUPER_ADMIN' ||
          String(c.role || '').toUpperCase().includes('ADMIN')
      ) || contacts.adminsAndFaculty[0];

      if (adminFound) {
        return {
          id: adminFound.id,
          name: adminFound.fullName,
          email: adminFound.email || 'admissions@cotr.edu',
          userType: adminFound.userType || 'ORG_USER',
        };
      }
    } catch {
      // fallback
    }

    return {
      id: 'admin-main',
      name: 'Academic Admin',
      email: 'admissions@cotr.edu',
      userType: 'ORG_USER',
    };
  },

  /**
   * 1. Get All Conversations (Private Chat & Groups)
   * Connects to GET /discussion/inbox on backend
   * Handles both Website response { directChats, batchGroups, courseGroups } and Postman { conversations }
   */
  async getConversations(): Promise<ChatConversation[]> {
    await this.init();
    const localRaw = await storageGetItem(CONVERSATIONS_KEY);
    let list: ChatConversation[] = localRaw ? JSON.parse(localRaw) : INITIAL_CONVERSATIONS;

    const user = await AuthStorage.getUser();
    const currentUserId = user?.id || 'global_user';
    const lastReadMap = await this.getLastReadMap(currentUserId);

    try {
      console.log(`[ChatService] Fetching inbox from ${ENV.API_URL}/discussion/inbox...`);
      const inboxRes = await ApiClient.get<any>('/discussion/inbox');
      console.log(`[ChatService] Inbox response status: ${inboxRes.status}, success: ${inboxRes.success}`);

      if (inboxRes.success && inboxRes.data) {
        const payload = inboxRes.data.data || inboxRes.data || {};

        let backendThreads: any[] = [];

        // Check Website format: { directChats: [], batchGroups: [], courseGroups: [] }
        if (
          Array.isArray(payload.directChats) ||
          Array.isArray(payload.batchGroups) ||
          Array.isArray(payload.courseGroups)
        ) {
          const directChats = (payload.directChats || []).map((e: any) => ({
            ...e,
            isGroup: false,
            type: 'direct',
            threadType: e.threadType || 'DIRECT_MESSAGE',
          }));
          const batchGroups = (payload.batchGroups || []).map((e: any) => ({
            ...e,
            isGroup: true,
            isBatch: true,
            type: 'group',
            threadType: e.threadType || 'BATCH_GROUP',
          }));
          const courseGroups = (payload.courseGroups || []).map((e: any) => ({
            ...e,
            isGroup: true,
            isCourse: true,
            type: 'group',
            threadType: e.threadType || 'COURSE_GROUP',
          }));
          backendThreads = [...courseGroups, ...batchGroups, ...directChats];
        } else if (Array.isArray(payload.conversations)) {
          // Postman format: { conversations: [] }
          backendThreads = payload.conversations;
        } else if (Array.isArray(payload)) {
          backendThreads = payload;
        }

        if (backendThreads.length > 0) {
          const mappedThreads: ChatConversation[] = backendThreads.map((item: any) => {
            const threadId = item.id || item._id || item.threadId;

            // Partner resolution
            const partner = item.partner || item.recipient || null;
            const partnerName = partner?.fullName || partner?.name || item.otherParticipantName;
            const title = item.title || partnerName || 'Discussion';

            // Last message timestamp and read status
            const lastMsg =
              typeof item.lastMessage === 'string'
                ? item.lastMessage
                : item.lastMessage?.content || item.lastMessage?.message || 'Conversation active';

            const lastMsgAtRaw = item.lastMessageAt || item.updatedAt || item.createdAt;
            const lastMsgTime = lastMsgAtRaw ? new Date(lastMsgAtRaw).getTime() : 0;
            const lastReadTime = lastReadMap[threadId] ? new Date(lastReadMap[threadId]).getTime() : 0;

            const isUnread = lastMsgTime > 0 && (!lastReadTime || lastMsgTime > lastReadTime);
            const unreadCount = item.unreadCount !== undefined ? item.unreadCount : isUnread ? 1 : 0;

            const formattedTime = lastMsgAtRaw
              ? new Date(lastMsgAtRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Recent';

            // Participants
            const participants = Array.isArray(item.participants) && item.participants.length > 0
              ? item.participants.map((p: any) => ({
                  id: p.id || p._id || p.userId,
                  name: p.fullName || p.name || 'User',
                  role: p.role || p.userType || 'student',
                  userType: p.userType || p.role,
                  isOnline: Boolean(p.isOnline ?? true),
                }))
              : partner
              ? [
                  {
                    id: partner.id || 'partner-id',
                    name: partner.fullName || partner.name || 'Contact',
                    role: partner.userType || partner.role || 'admin',
                    userType: partner.userType,
                    isOnline: true,
                  },
                  {
                    id: currentUserId,
                    name: user?.fullName || 'You',
                    role: 'student',
                    userType: 'STUDENT',
                    isOnline: true,
                  },
                ]
              : [
                  { id: 'admin-main', name: 'Academic Admin', role: 'admin', userType: 'ORG_USER', isOnline: true },
                  { id: currentUserId, name: user?.fullName || 'Student', role: 'student', userType: 'STUDENT', isOnline: true },
                ];

            return {
              id: threadId,
              title,
              type: item.type || (item.isGroup ? 'group' : 'direct'),
              threadType: item.threadType,
              lastMessage: lastMsg,
              lastMessageAt: formattedTime,
              lastSenderId: item.lastSenderId,
              lastSenderRole: item.lastSenderRole,
              unreadCount,
              unreadCountAdmin: item.unreadCountAdmin ?? unreadCount,
              unreadCountStudent: item.unreadCountStudent ?? unreadCount,
              status: item.status || 'active',
              isGroup: Boolean(item.isGroup),
              isBatch: Boolean(item.isBatch),
              isCourse: Boolean(item.isCourse),
              courseId: item.courseId,
              batchId: item.batchId,
              pinned: Boolean(item.pinned),
              partner: partner
                ? {
                    id: partner.id,
                    fullName: partner.fullName || partner.name,
                    name: partner.name || partner.fullName,
                    userType: partner.userType,
                    role: partner.role || partner.userType,
                    email: partner.email,
                  }
                : undefined,
              participants,
              createdAt: item.createdAt || new Date().toISOString(),
            };
          });

          // Merge backend threads into list
          for (const bt of mappedThreads) {
            const idx = list.findIndex((c) => c.id === bt.id);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...bt };
            } else {
              list.push(bt);
            }
          }

          // Sort by last message recency
          list.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });

          await storageSetItem(CONVERSATIONS_KEY, JSON.stringify(list));
        }
      }
    } catch (err) {
      console.warn('[ChatService] Inbox API call failed, using persistent storage:', err);
    }

    return list;
  },

  /**
   * 2. Start or Open Direct 1:1 Conversation
   * Matches Website: POST /discussion/direct-thread { recipientId, initialMessage } (L_ in g9)
   * And Postman: POST /discussion/direct-thread { targetUserId, initialMessage }
   * Reuses existing threadId to prevent duplicate conversations!
   */
  async startPrivateConversation(recipient: {
    id: string;
    name: string;
    fullName?: string;
    role?: ChatRole | string;
    userType?: string;
    isOnline?: boolean;
    initialMessage?: string;
  }): Promise<ChatConversation> {
    await this.init();
    const convRaw = await storageGetItem(CONVERSATIONS_KEY);
    const convs: ChatConversation[] = convRaw ? JSON.parse(convRaw) : INITIAL_CONVERSATIONS;

    const currentRole = await this.getCurrentUserRole();
    const currentUser = await AuthStorage.getUser();
    const currentUserId = currentUser?.id || (currentRole === 'admin' ? 'admin-main' : 'student-user-1');
    const currentUserName = currentUser?.fullName || (currentRole === 'admin' ? 'Academic Admin' : 'Student');
    const recipientDisplayName = recipient.fullName || recipient.name;

    // 1. Check if direct conversation already exists with this recipient in local memory
    const existing = convs.find(
      (c) =>
        c.type === 'direct' &&
        (c.partner?.id === recipient.id ||
          c.participants.some(
            (p) =>
              p.id === recipient.id ||
              (recipient.role === 'admin' && (p.role === 'admin' || p.userType === 'ORG_USER'))
          ))
    );
    if (existing) {
      console.log(`[ChatService] Reusing existing direct thread "${existing.id}" for recipient "${recipientDisplayName}"`);
      return existing;
    }

    // 2. Call Backend API: POST /discussion/direct-thread
    let remoteThreadId: string | null = null;
    let backendThreadData: any = null;

    try {
      console.log(`[ChatService] Calling POST /discussion/direct-thread for recipientId: ${recipient.id}`);
      const payload = {
        recipientId: recipient.id,
        targetUserId: recipient.id,
        initialMessage: recipient.initialMessage || 'Conversation opened',
      };
      const directRes = await ApiClient.post<any>('/discussion/direct-thread', payload);
      console.log(`[ChatService] Direct thread response: status ${directRes.status}, success ${directRes.success}`);

      if (directRes.success && directRes.data) {
        backendThreadData = directRes.data.thread || directRes.data.data || directRes.data;
        remoteThreadId = backendThreadData.id || backendThreadData._id || backendThreadData.threadId;
      }
    } catch (err) {
      console.warn('[ChatService] Backend direct-thread call failed, generating local persistent thread:', err);
    }

    const threadId = remoteThreadId || `conv-direct-${recipient.id}`;

    // Verify if thread already in list with this ID
    const existingById = convs.find((c) => c.id === threadId);
    if (existingById) {
      return existingById;
    }

    const newConv: ChatConversation = {
      id: threadId,
      title: recipientDisplayName,
      type: 'direct',
      threadType: 'DIRECT_MESSAGE',
      lastMessage: recipient.initialMessage || 'Conversation started',
      lastMessageAt: 'Just now',
      unreadCount: 0,
      unreadCountStudent: 0,
      unreadCountAdmin: 0,
      status: 'active',
      isGroup: false,
      pinned: false,
      createdAt: new Date().toISOString(),
      partner: {
        id: recipient.id,
        fullName: recipientDisplayName,
        name: recipientDisplayName,
        userType: recipient.userType || (currentRole === 'admin' ? 'STUDENT' : 'ORG_USER'),
        role: recipient.role || (currentRole === 'admin' ? 'student' : 'admin'),
      },
      participants: [
        { id: currentUserId, name: currentUserName, role: currentRole, isOnline: true },
        {
          id: recipient.id,
          name: recipientDisplayName,
          role: recipient.role || (currentRole === 'admin' ? 'student' : 'admin'),
          userType: recipient.userType || (currentRole === 'admin' ? 'STUDENT' : 'ORG_USER'),
          isOnline: recipient.isOnline ?? true,
        },
      ],
    };

    convs.unshift(newConv);
    await storageSetItem(CONVERSATIONS_KEY, JSON.stringify(convs));
    return newConv;
  },

  /**
   * Helper: Resolves the canonical sender user ID from various backend shapes
   * strictly matching the Global LMS website logic (Jte / g9 components):
   * (e.senderId?._id || e.senderId?.id || e.senderId || e.authorId || e.author?.id || e.author?._id)
   */
  resolveMessageSenderId(m: any): string {
    if (!m) return '';
    if (typeof m.authorId === 'string' && m.authorId.trim()) return m.authorId.trim();
    if (m.authorId && typeof m.authorId === 'object') {
      const aid = m.authorId.id || m.authorId._id;
      if (aid) return String(aid).trim();
    }
    if (typeof m.senderId === 'string' && m.senderId.trim()) return m.senderId.trim();
    if (m.senderId && typeof m.senderId === 'object') {
      const sid = m.senderId.id || m.senderId._id;
      if (sid) return String(sid).trim();
    }
    if (m.author && typeof m.author === 'object') {
      const aid = m.author.id || m.author._id;
      if (aid) return String(aid).trim();
    }
    if (m.sender && typeof m.sender === 'object') {
      const sid = m.sender.id || m.sender._id;
      if (sid) return String(sid).trim();
    }
    if (typeof m.userId === 'string' && m.userId.trim()) return m.userId.trim();
    return '';
  },

  /**
   * Helper: Resolves the sender role from backend userType / role definitions
   */
  resolveMessageSenderRole(m: any): 'admin' | 'faculty' | 'student' {
    if (!m) return 'student';
    const rawRole = String(
      m.author?.userType ||
      m.senderId?.userType ||
      m.sender?.userType ||
      m.author?.role ||
      m.senderId?.role ||
      m.sender?.role ||
      m.senderRole ||
      m.authorRole ||
      m.userType ||
      m.role ||
      ''
    ).toUpperCase();

    if (
      rawRole.includes('ORG_USER') ||
      rawRole.includes('SUPER_ADMIN') ||
      rawRole.includes('ADMIN')
    ) {
      return 'admin';
    }
    if (rawRole.includes('FACULTY') || rawRole.includes('TEACHER')) {
      return 'faculty';
    }
    return 'student';
  },

  /**
   * Helper: Resolves the sender display name from backend response
   */
  resolveMessageSenderName(m: any): string {
    if (!m) return 'User';
    const resolvedRole = this.resolveMessageSenderRole(m);
    return (
      m.author?.fullName ||
      m.author?.name ||
      m.senderId?.fullName ||
      m.senderId?.name ||
      m.sender?.fullName ||
      m.sender?.name ||
      m.senderName ||
      m.authorName ||
      (resolvedRole === 'admin' ? 'Academic Admin' : resolvedRole === 'faculty' ? 'Faculty' : 'Student')
    );
  },

  /**
   * 3. Get Messages for a Conversation Thread
   * Matches Website R_() and Postman: GET /discussion/threads/:threadId/messages
   */
  async getMessages(threadId: string): Promise<ChatMessage[]> {
    await this.init();
    const localRaw = await storageGetItem(MESSAGES_KEY);
    const msgMap: Record<string, ChatMessage[]> = localRaw ? JSON.parse(localRaw) : INITIAL_MESSAGES;
    let messages = msgMap[threadId] || [];

    // 1. Fetch from live backend API: GET /discussion/threads/:threadId/messages
    try {
      const endpoint = `/discussion/threads/${encodeURIComponent(threadId)}/messages?limit=50`;
      console.log(`[ChatService] Fetching messages from ${ENV.API_URL}${endpoint}...`);
      const res = await ApiClient.get<any>(endpoint);

      if (res.success && res.data) {
        const payload = res.data.data || res.data || {};
        const rawMsgs = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.messages)
          ? payload.messages
          : [];

        if (Array.isArray(rawMsgs)) {
          const backendMsgs: ChatMessage[] = rawMsgs.map((m: any) => {
            const rawContent = m.content || m.message || '';
            const isDel = Boolean(m.isDeleted);
            const resolvedSenderId = this.resolveMessageSenderId(m);
            const resolvedSenderRole = this.resolveMessageSenderRole(m);
            const resolvedSenderName = this.resolveMessageSenderName(m);

            return {
              id: m.id || m._id || m.messageId || `msg-${Date.now()}-${Math.random()}`,
              threadId,
              senderId: resolvedSenderId || 'unknown',
              authorId: resolvedSenderId || (typeof m.authorId === 'string' ? m.authorId : undefined),
              senderName: resolvedSenderName,
              senderRole: resolvedSenderRole,
              message: isDel ? '[Message deleted by Admin]' : rawContent,
              content: rawContent,
              createdAt: m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recent',
              isRead: Boolean(m.isRead || (Array.isArray(m.readBy) && m.readBy.length > 0)),
              isDeleted: isDel,
              author: typeof m.author === 'object' ? m.author : undefined,
              sender: typeof m.sender === 'object' ? m.sender : typeof m.senderId === 'object' ? m.senderId : undefined,
            };
          });

          // Sort chronologically
          backendMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          if (backendMsgs.length > 0) {
            messages = backendMsgs;
            msgMap[threadId] = messages;
            await storageSetItem(MESSAGES_KEY, JSON.stringify(msgMap));
          }
        }
      }
    } catch (err) {
      console.warn('[ChatService] Backend messages fetch failed, using local messages:', err);
    }

    return messages;
  },

  /**
   * 4. Send Message in a Thread (Real-Time + Backend Sync)
   * Matches Website: POST /discussion/threads/:threadId/messages with { content } (z_ in g9 & ve in Jte)
   * And Postman: POST /discussion/threads/:threadId/messages with { message }
   */
  async sendMessage(
    threadId: string,
    content: string,
    senderId: string,
    senderName: string,
    senderRole: ChatRole
  ): Promise<ChatMessage> {
    await this.init();
    const cleanContent = content.trim();
    if (!cleanContent) {
      throw new Error('Message cannot be empty');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    console.log(`[ChatService] Sending message in thread "${threadId}" from ${senderName} (${senderRole}): "${cleanContent}"`);

    // 1. Post to live Backend API: POST /discussion/threads/:threadId/messages
    let backendMsgId: string | null = null;
    let backendCreatedAt: string | null = null;

    try {
      const payload = {
        content: cleanContent,
        message: cleanContent,
        senderId,
        senderName,
        senderRole,
      };
      const response = await ApiClient.post<any>(
        `/discussion/threads/${encodeURIComponent(threadId)}/messages`,
        payload
      );
      console.log(`[ChatService] Backend send message status: ${response.status}, success: ${response.success}`);

      if (response.success && response.data) {
        const data = response.data.data || response.data.message || response.data;
        backendMsgId = data.id || data._id || data.messageId;
        if (data.createdAt) {
          backendCreatedAt = new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch (err) {
      console.warn('[ChatService] Backend message sending failed, updating persistent local store:', err);
    }

    const newMsg: ChatMessage = {
      id: backendMsgId || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      threadId,
      senderId,
      authorId: senderId,
      senderName,
      senderRole,
      message: cleanContent,
      content: cleanContent,
      createdAt: backendCreatedAt || timeStr,
      isRead: false,
    };

    // 2. Save message to persistent storage
    const localRaw = await storageGetItem(MESSAGES_KEY);
    const msgMap: Record<string, ChatMessage[]> = localRaw ? JSON.parse(localRaw) : INITIAL_MESSAGES;
    const threadMsgs = msgMap[threadId] || [];
    threadMsgs.push(newMsg);
    msgMap[threadId] = threadMsgs;
    await storageSetItem(MESSAGES_KEY, JSON.stringify(msgMap));

    // 3. Update conversation preview and unread count
    const convRaw = await storageGetItem(CONVERSATIONS_KEY);
    const convs: ChatConversation[] = convRaw ? JSON.parse(convRaw) : INITIAL_CONVERSATIONS;
    const targetConv = convs.find((c) => c.id === threadId);
    if (targetConv) {
      targetConv.lastMessage = cleanContent;
      targetConv.lastMessageAt = backendCreatedAt || timeStr;
      targetConv.lastSenderId = senderId;
      targetConv.lastSenderRole = senderRole;

      // Update role unread counter
      if (senderRole === 'student') {
        targetConv.unreadCountAdmin = (targetConv.unreadCountAdmin || 0) + 1;
        targetConv.unreadCountStudent = 0;
      } else {
        targetConv.unreadCountStudent = (targetConv.unreadCountStudent || 0) + 1;
        targetConv.unreadCountAdmin = 0;
      }
      targetConv.unreadCount = (targetConv.unreadCount || 0) + 1;

      await storageSetItem(CONVERSATIONS_KEY, JSON.stringify(convs));
    }

    // 4. Mark thread as read by current sender
    await this.setThreadLastRead(senderId, threadId);

    return newMsg;
  },

  /**
   * 5. Mark Conversation Messages as Read
   * Matches Website Te / se (updates chat_last_read_${userId})
   * And Postman: POST /discussion/threads/:threadId/read
   */
  async markAsRead(threadId: string, userId: string, role?: ChatRole): Promise<void> {
    const activeRole = role || (await this.getCurrentUserRole());
    console.log(`[ChatService] Marking thread "${threadId}" as read for user ${userId} (${activeRole})`);

    // 1. Update website last_read timestamp
    await this.setThreadLastRead(userId, threadId);

    // 2. Call Backend API: POST /discussion/threads/:threadId/read
    try {
      await ApiClient.post<any>(`/discussion/threads/${encodeURIComponent(threadId)}/read`, {
        userId,
        role: activeRole,
      });
    } catch {
      // Handled silently
    }

    // 3. Clear unread count in persistent conversation store
    const convRaw = await storageGetItem(CONVERSATIONS_KEY);
    if (convRaw) {
      const convs: ChatConversation[] = JSON.parse(convRaw);
      const target = convs.find((c) => c.id === threadId);
      if (target) {
        if (activeRole === 'admin') {
          target.unreadCountAdmin = 0;
        } else {
          target.unreadCountStudent = 0;
        }
        target.unreadCount = 0;
        await storageSetItem(CONVERSATIONS_KEY, JSON.stringify(convs));
      }
    }

    // 4. Mark messages from other participant as read (read receipts ✓✓)
    const localRaw = await storageGetItem(MESSAGES_KEY);
    if (localRaw) {
      const msgMap: Record<string, ChatMessage[]> = JSON.parse(localRaw);
      const threadMsgs = msgMap[threadId];
      if (threadMsgs) {
        for (const m of threadMsgs) {
          if (m.senderRole !== activeRole) {
            m.isRead = true;
          }
        }
        await storageSetItem(MESSAGES_KEY, JSON.stringify(msgMap));
      }
    }
  },

  /**
   * 6. Moderate or Delete a Message
   * Matches Website tte() and Postman: DELETE /discussion/threads/:threadId/messages/:messageId
   */
  async moderateMessage(threadId: string, messageId: string): Promise<void> {
    try {
      await ApiClient.delete<any>(
        `/discussion/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`
      );
    } catch {
      // Handled silently
    }

    const localRaw = await storageGetItem(MESSAGES_KEY);
    if (!localRaw) return;
    const msgMap: Record<string, ChatMessage[]> = JSON.parse(localRaw);
    const threadMsgs = msgMap[threadId];
    if (threadMsgs) {
      const target = threadMsgs.find((m) => m.id === messageId);
      if (target) {
        target.isDeleted = true;
        target.message = '[Message deleted by Admin]';
        target.content = '[Message deleted by Admin]';
        await storageSetItem(MESSAGES_KEY, JSON.stringify(msgMap));
      }
    }
  },

  /**
   * 7. Get Registered Students / Contacts Roster
   * Calls GET /discussion/contacts (Website I_) or /users/chat-roster (Postman)
   */
  async getRegisteredStudents(): Promise<RegisteredStudent[]> {
    await this.init();
    let roster: RegisteredStudent[] = [];

    // Try contacts endpoint first
    try {
      const contacts = await this.getContacts();
      if (contacts.classmates.length > 0) {
        roster = contacts.classmates.map((c) => ({
          id: c.id,
          name: c.fullName,
          fullName: c.fullName,
          email: c.email || '',
          avatarLetter: (c.fullName || 'S').charAt(0).toUpperCase(),
          isOnline: Boolean(c.isOnline ?? true),
          enrolledProgram: 'Master of Divinity (M.Div)',
          userType: c.userType,
          role: (c.role as ChatRole) || 'student',
        }));
      }
    } catch {
      // Fallback
    }

    if (roster.length === 0) {
      try {
        const rosterRes = await ApiClient.get<any>('/users/chat-roster?role=student&page=1&limit=20');
        if (rosterRes.success && rosterRes.data) {
          const list = Array.isArray(rosterRes.data)
            ? rosterRes.data
            : rosterRes.data.students || rosterRes.data.users || [];
          if (list.length > 0) {
            roster = list.map((u: any) => ({
              id: u.id || u._id,
              name: u.name || u.fullName || 'Student',
              fullName: u.fullName || u.name || 'Student',
              email: u.email || '',
              mobile: u.mobile || '',
              enrolledProgram: u.enrolledProgram || 'Master of Divinity (M.Div)',
              avatarLetter: (u.name || u.fullName || 'S').charAt(0).toUpperCase(),
              isOnline: Boolean(u.isOnline ?? true),
              userType: u.userType || 'STUDENT',
              role: (u.role as ChatRole) || 'student',
            }));
            await storageSetItem(REGISTERED_STUDENTS_KEY, JSON.stringify(roster));
          }
        }
      } catch {
        const raw = await storageGetItem(REGISTERED_STUDENTS_KEY);
        if (raw) roster = JSON.parse(raw);
      }
    }

    return roster;
  },

  /**
   * 8. Admin: Create Group Discussion
   * Matches Website Jee() (POST /discussion/batch-thread) or $ee() (POST /discussion/course-thread)
   */
  async createGroupDiscussion(title: string, description: string): Promise<ChatConversation> {
    await this.init();
    const convRaw = await storageGetItem(CONVERSATIONS_KEY);
    const convs: ChatConversation[] = convRaw ? JSON.parse(convRaw) : INITIAL_CONVERSATIONS;

    let remoteGroupId: string | null = null;
    try {
      const res = await ApiClient.post<any>('/discussion/batch-thread', {
        title,
        batchId: null,
      });
      if (res.success && res.data) {
        const g = res.data.thread || res.data.data || res.data;
        remoteGroupId = g.id || g._id;
      }
    } catch {
      // local fallback
    }

    const newGroup: ChatConversation = {
      id: remoteGroupId || `group-${Date.now()}`,
      title,
      type: 'group',
      threadType: 'BATCH_GROUP',
      lastMessage: description || 'Group discussion created',
      lastMessageAt: 'Just now',
      unreadCount: 0,
      unreadCountStudent: 0,
      unreadCountAdmin: 0,
      status: 'active',
      isGroup: true,
      pinned: false,
      createdAt: new Date().toISOString(),
      participants: [
        { id: 'admin-main', name: 'Academic Admin', role: 'admin', userType: 'ORG_USER', isOnline: true },
        { id: 'all-students', name: 'All Enrolled Students', role: 'student', userType: 'STUDENT', isOnline: true },
      ],
    };

    convs.unshift(newGroup);
    await storageSetItem(CONVERSATIONS_KEY, JSON.stringify(convs));
    return newGroup;
  },

  /**
   * 9. Discussion Forum Topics
   */
  async getForumTopics(category: string = 'All', search: string = ''): Promise<ForumTopic[]> {
    await this.init();
    const raw = await storageGetItem(FORUM_TOPICS_KEY);
    let topics: ForumTopic[] = raw ? JSON.parse(raw) : INITIAL_FORUM_TOPICS;

    try {
      const endpoint = `/discussion/topics?category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}`;
      const res = await ApiClient.get<any>(endpoint);
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.topics || res.data.data || [];
        if (list.length > 0) {
          topics = list;
          await storageSetItem(FORUM_TOPICS_KEY, JSON.stringify(topics));
        }
      }
    } catch {
      // Fallback
    }

    return topics.filter((t) => {
      const matchCat = category === 'All' || t.category === category;
      const matchSearch =
        !search.trim() ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  },

  /**
   * 10. Create New Discussion Forum Topic
   */
  async createForumTopic(
    title: string,
    content: string,
    category: ForumTopic['category'],
    authorIdParam?: string,
    authorNameParam?: string,
    authorRoleParam?: ChatRole,
    isPinnedParam?: boolean
  ): Promise<ForumTopic> {
    await this.init();
    const currentRole = authorRoleParam || (await this.getCurrentUserRole());
    const user = await AuthStorage.getUser();
    const authorId = authorIdParam || user?.id || (currentRole === 'admin' ? 'admin-main' : 'student-user-1');
    const authorName = authorNameParam || user?.fullName || (currentRole === 'admin' ? 'Academic Admin' : 'Student');

    let remoteTopicId: string | null = null;
    try {
      const res = await ApiClient.post<any>('/discussion/topics', {
        title,
        content,
        category,
      });
      if (res.success && res.data) {
        const t = res.data.topic || res.data.data || res.data;
        remoteTopicId = t.id || t._id;
      }
    } catch {
      // Fallback
    }

    const newTopic: ForumTopic = {
      id: remoteTopicId || `topic-${Date.now()}`,
      title,
      content,
      category,
      authorId,
      authorName,
      authorRole: currentRole,
      createdAt: 'Just now',
      replyCount: 0,
      likesCount: 0,
      isPinned: Boolean(isPinnedParam),
      replies: [],
    };

    const raw = await storageGetItem(FORUM_TOPICS_KEY);
    const topics: ForumTopic[] = raw ? JSON.parse(raw) : INITIAL_FORUM_TOPICS;
    topics.unshift(newTopic);
    await storageSetItem(FORUM_TOPICS_KEY, JSON.stringify(topics));

    return newTopic;
  },

  /**
   * 11. Reply to Discussion Forum Topic
   */
  async replyToForumTopic(
    topicId: string,
    content: string,
    authorIdParam?: string,
    authorNameParam?: string,
    authorRoleParam?: ChatRole
  ): Promise<ForumReply> {
    await this.init();
    const currentRole = authorRoleParam || (await this.getCurrentUserRole());
    const user = await AuthStorage.getUser();
    const authorId = authorIdParam || user?.id || (currentRole === 'admin' ? 'admin-main' : 'student-user-1');
    const authorName = authorNameParam || user?.fullName || (currentRole === 'admin' ? 'Academic Admin' : 'Student');

    let remoteReplyId: string | null = null;
    try {
      const res = await ApiClient.post<any>(`/discussion/topics/${encodeURIComponent(topicId)}/replies`, {
        content,
      });
      if (res.success && res.data) {
        const r = res.data.reply || res.data.data || res.data;
        remoteReplyId = r.id || r._id;
      }
    } catch {
      // Fallback
    }

    const newReply: ForumReply = {
      id: remoteReplyId || `reply-${Date.now()}`,
      topicId,
      authorId,
      authorName,
      authorRole: currentRole,
      content,
      createdAt: 'Just now',
    };

    const raw = await storageGetItem(FORUM_TOPICS_KEY);
    const topics: ForumTopic[] = raw ? JSON.parse(raw) : INITIAL_FORUM_TOPICS;
    const target = topics.find((t) => t.id === topicId);
    if (target) {
      target.replies.push(newReply);
      target.replyCount = target.replies.length;
      await storageSetItem(FORUM_TOPICS_KEY, JSON.stringify(topics));
    }

    return newReply;
  },

  /**
   * 12. Toggle Pin Status of Topic
   */
  async togglePinTopic(topicId: string): Promise<boolean> {
    const raw = await storageGetItem(FORUM_TOPICS_KEY);
    const topics: ForumTopic[] = raw ? JSON.parse(raw) : INITIAL_FORUM_TOPICS;
    const target = topics.find((t) => t.id === topicId);
    let newPinState = false;
    if (target) {
      target.isPinned = !target.isPinned;
      newPinState = target.isPinned;
      await storageSetItem(FORUM_TOPICS_KEY, JSON.stringify(topics));
    }
    return newPinState;
  },

  /**
   * 13. Delete Topic
   */
  async deleteForumTopic(topicId: string): Promise<void> {
    const raw = await storageGetItem(FORUM_TOPICS_KEY);
    if (!raw) return;
    let topics: ForumTopic[] = JSON.parse(raw);
    topics = topics.filter((t) => t.id !== topicId);
    await storageSetItem(FORUM_TOPICS_KEY, JSON.stringify(topics));
  },

  /**
   * 14. Admin Broadcast Announcement
   */
  async sendAnnouncement(title: string, message: string): Promise<void> {
    await this.createForumTopic(
      `[ANNOUNCEMENT] ${title}`,
      message,
      'Announcements',
      undefined,
      'Admin Office',
      'admin',
      true
    );
  },
};
