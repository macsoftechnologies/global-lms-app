import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatConversation, ChatMessage, ChatRole } from '../../types/chat';
import { MessageInput } from './MessageInput';

interface MessageWindowProps {
  conversation: ChatConversation;
  messages: ChatMessage[];
  currentUserId: string;
  currentUserRole: ChatRole;
  currentUser?: { id?: string; fullName?: string; role?: string } | null;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  onModerateMessage?: (messageId: string) => void;
  isTyping?: boolean;
}

export const MessageWindow: React.FC<MessageWindowProps> = ({
  conversation,
  messages,
  currentUserId,
  currentUserRole,
  currentUser,
  onSendMessage,
  onBack,
  onModerateMessage,
  isTyping = false,
}) => {
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll to latest message on change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const isGroup = conversation.isGroup || conversation.type === 'group';

  // Partner display name and role resolution
  const partnerName =
    conversation.partner?.fullName ||
    conversation.partner?.name ||
    conversation.title ||
    'Academic Admin';

  const partnerUserType =
    conversation.partner?.userType ||
    (currentUserRole === 'admin' ? 'STUDENT' : 'ORG_USER');

  const isAdminPartner =
    partnerUserType === 'ORG_USER' ||
    partnerUserType === 'SUPER_ADMIN' ||
    String(partnerUserType).toUpperCase().includes('ADMIN');

  const isFacultyPartner = partnerUserType === 'FACULTY';

  const partnerRoleLabel = isGroup
    ? 'GROUP'
    : isAdminPartner
    ? 'ADMIN'
    : isFacultyPartner
    ? 'FACULTY'
    : 'STUDENT';

  const handleModerate = (messageId: string) => {
    if (!onModerateMessage) return;
    Alert.alert(
      'Moderate Message',
      'Are you sure you want to delete and moderate this message? This action will be visible across the portal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Message',
          style: 'destructive',
          onPress: () => onModerateMessage(messageId),
        },
      ]
    );
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    // 1. Identify Message Ownership:
    // Use the authenticated user's actual ID to identify message ownership.
    // Implement: isOwnMessage = normalizedMessageSenderId === normalizedCurrentUserId
    const normalizedCurrentUserId = String(
      currentUser?.id ||
      (currentUser as any)?._id ||
      (currentUser as any)?.userId ||
      currentUserId ||
      ''
    ).trim().toLowerCase();

    const normalizedMessageSenderId = String(
      item.authorId ||
      item.senderId ||
      (item as any)?.author?.id ||
      (item as any)?.author?._id ||
      (item as any)?.sender?.id ||
      (item as any)?.sender?._id ||
      ''
    ).trim().toLowerCase();

    // Check direct ID match or seed/optimistic role fallback:
    const isOwnMessage = Boolean(
      (normalizedCurrentUserId &&
        normalizedMessageSenderId &&
        normalizedCurrentUserId === normalizedMessageSenderId) ||
      (currentUserRole === 'student' && normalizedMessageSenderId === 'current-user') ||
      (currentUserRole === 'admin' && (normalizedMessageSenderId === 'admin-main' || normalizedMessageSenderId === normalizedCurrentUserId))
    );

    if (__DEV__) {
      console.log(
        `[Chat Diagnostics] Auth User ID: "${normalizedCurrentUserId}" | Role: "${currentUserRole}" | Thread: "${conversation.id}"`
      );
      console.log(
        `  [Msg ${item.id}] SenderID: "${normalizedMessageSenderId}" | isOwn: ${isOwnMessage} -> ${isOwnMessage ? 'RIGHT' : 'LEFT'}`
      );
    }

    const isDeleted = Boolean(item.isDeleted);
    const rawRole = String(
      item.senderRole ||
      (item as any)?.author?.userType ||
      (item as any)?.sender?.userType ||
      (item as any)?.author?.role ||
      (item as any)?.sender?.role ||
      ''
    ).toUpperCase();

    // Determine sender role for incoming messages:
    // In direct 1:1 chat (!isGroup):
    // - If current user is student, incoming partner is Admin
    // - If current user is admin, incoming partner is Student
    const isAdminSender = !isGroup
      ? currentUserRole === 'student'
      : (rawRole.includes('ADMIN') || rawRole.includes('ORG_USER') || rawRole.includes('SUPER_ADMIN'));

    const isFacultySender = !isGroup
      ? partnerUserType === 'FACULTY'
      : rawRole.includes('FACULTY');

    const senderDisplayName = !isOwnMessage
      ? (!isGroup
          ? partnerName
          : item.senderName || (isAdminSender ? 'Academic Admin' : isFacultySender ? 'Faculty' : 'Student'))
      : (currentUser?.fullName || (currentUserRole === 'admin' ? 'Academic Admin' : 'Student'));

    const roleBadgeLabel = isAdminSender
      ? 'ADMIN'
      : isFacultySender
      ? 'FACULTY'
      : 'STUDENT';

    return (
      <View
        style={[
          styles.messageRow,
          isOwnMessage ? styles.messageRowMe : styles.messageRowOther,
        ]}
      >
        {/* Left Avatar for Received Messages only */}
        {!isOwnMessage && (
          <View
            style={[
              styles.avatarBoxSmall,
              isAdminSender
                ? styles.avatarAdmin
                : isFacultySender
                ? styles.avatarFaculty
                : styles.avatarStudent,
            ]}
          >
            {isAdminSender ? (
              <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
            ) : isFacultySender ? (
              <Ionicons name="school" size={13} color="#FFFFFF" />
            ) : (
              <Text style={styles.avatarLetterSmall}>
                {senderDisplayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        )}

        {/* Message Bubble Container */}
        <View
          style={[
            styles.bubbleContainer,
            isOwnMessage ? styles.bubbleMe : styles.bubbleOther,
            isDeleted && styles.bubbleDeleted,
          ]}
        >
          {/* Header on Received Messages: Sender Name & Role Badge */}
          {!isOwnMessage && (
            <View style={styles.senderHeader}>
              <Text style={styles.senderName}>{senderDisplayName}</Text>
              <View
                style={[
                  styles.rolePillSmall,
                  isAdminSender
                    ? styles.rolePillAdmin
                    : isFacultySender
                    ? styles.rolePillFaculty
                    : styles.rolePillStudent,
                ]}
              >
                <Text style={styles.rolePillSmallText}>{roleBadgeLabel}</Text>
              </View>
            </View>
          )}

          {/* Message Text (Supports Multiline) */}
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.messageTextMe : styles.messageTextOther,
              isDeleted && styles.messageTextDeleted,
            ]}
          >
            {item.content || item.message}
          </Text>

          {/* Message Meta: Timestamp & Read Receipts */}
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.timeText,
                isOwnMessage ? styles.timeTextMe : styles.timeTextOther,
              ]}
            >
              {item.createdAt}
            </Text>
            {isOwnMessage && !isDeleted && (
              <Ionicons
                name={item.isRead ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.isRead ? '#67E8F9' : '#C7D2FE'}
                style={styles.checkIcon}
              />
            )}
          </View>
        </View>

        {/* Admin Moderation Button */}
        {currentUserRole === 'admin' && !isDeleted && onModerateMessage && (
          <TouchableOpacity
            style={styles.moderateBtn}
            onPress={() => handleModerate(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header - Matching Website Admin Chat Screenshot */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {partnerName}
            </Text>
            <View
              style={[
                styles.roleBadgeHeader,
                isGroup
                  ? styles.roleBadgeGroup
                  : isAdminPartner
                  ? styles.roleBadgeAdmin
                  : isFacultyPartner
                  ? styles.roleBadgeFaculty
                  : styles.roleBadgeStudent,
              ]}
            >
              <Text style={styles.roleBadgeHeaderText}>{partnerRoleLabel}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusDotLive} />
            <Text style={styles.headerSubtitle}>Online • Real-Time Direct Chat</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.headerActionBtn}>
          <Ionicons name="shield-outline" size={18} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Ionicons name="chatbubbles-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyText}>No messages yet.</Text>
            <Text style={styles.emptySubtext}>
              Send a message below to start this live conversation.
            </Text>
          </View>
        }
      />

      {/* Typing Indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>Admin is typing...</Text>
        </View>
      )}

      {/* Message Input Bar */}
      <MessageInput onSendMessage={onSendMessage} placeholder="Type your message..." />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  roleBadgeHeader: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleBadgeAdmin: {
    backgroundColor: '#7C3AED',
  },
  roleBadgeFaculty: {
    backgroundColor: '#2563EB',
  },
  roleBadgeStudent: {
    backgroundColor: '#059669',
  },
  roleBadgeGroup: {
    backgroundColor: '#475569',
  },
  roleBadgeHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  statusDotLive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  headerActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  messageList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    width: '100%',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
    paddingLeft: 44,
  },
  messageRowOther: {
    justifyContent: 'flex-start',
    paddingRight: 44,
  },
  avatarBoxSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  avatarAdmin: {
    backgroundColor: '#7C3AED',
  },
  avatarFaculty: {
    backgroundColor: '#2563EB',
  },
  avatarStudent: {
    backgroundColor: '#059669',
  },
  avatarLetterSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bubbleContainer: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: '#4F46E5', // Blue / Purple bubble for sent messages
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF', // White / light-grey bubble for received messages
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleDeleted: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  rolePillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  rolePillAdmin: {
    backgroundColor: '#7C3AED',
  },
  rolePillFaculty: {
    backgroundColor: '#2563EB',
  },
  rolePillStudent: {
    backgroundColor: '#059669',
  },
  rolePillSmallText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#FFFFFF', // White text for sent messages
  },
  messageTextOther: {
    color: '#0F172A', // Dark text for received messages
  },
  messageTextDeleted: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  timeTextMe: {
    color: '#E0E7FF',
  },
  timeTextOther: {
    color: '#94A3B8',
  },
  checkIcon: {
    marginLeft: 2,
  },
  moderateBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignSelf: 'center',
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  typingIndicator: {
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  typingText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#64748B',
  },
});
