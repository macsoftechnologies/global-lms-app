import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ChatConversation,
  ChatMessage,
  ChatRole,
  ForumReply,
  ForumTopic,
  RegisteredStudent,
} from '../types/chat';
import { ChatService } from '../services/chatService';
import { AuthStorage } from '../services/authStorage';

interface DiscussionChatModuleProps {
  onClose?: () => void;
  isExpandedModal?: boolean;
  onOpenModal?: () => void;
  currentUserName?: string;
}

export default function DiscussionChatModule({
  onClose,
  isExpandedModal = false,
  onOpenModal,
  currentUserName: initialUserName,
}: DiscussionChatModuleProps) {
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'forum' | 'chat'>('chat');
  const [activeRole, setActiveRole] = useState<ChatRole>('student');
  const [currentUserId, setCurrentUserId] = useState<string>('current-user');
  const [currentUserName, setCurrentUserName] = useState<string>(initialUserName || 'Student');

  // Private Chat States
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [showStudentsModal, setShowStudentsModal] = useState<boolean>(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState<boolean>(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState<boolean>(false);

  // Announcement Inputs
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  // Group Discussion Inputs
  const [groupTitle, setGroupTitle] = useState<string>('');
  const [groupDescription, setGroupDescription] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);

  // Forum States
  const [forumTopics, setForumTopics] = useState<ForumTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const [forumCategory, setForumCategory] = useState<string>('All');
  const [forumSearch, setForumSearch] = useState<string>('');
  const [replyInput, setReplyInput] = useState<string>('');
  const [isPostingReply, setIsPostingReply] = useState<boolean>(false);
  const [showNewTopicModal, setShowNewTopicModal] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');
  const [newTopicContent, setNewTopicContent] = useState<string>('');
  const [newTopicCategory, setNewTopicCategory] = useState<ForumTopic['category']>('General');
  const [isCreatingTopic, setIsCreatingTopic] = useState<boolean>(false);

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const messageListRef = useRef<FlatList<ChatMessage>>(null);

  // Load user profile and effective role
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const user = await AuthStorage.getUser();
      const role = await ChatService.getCurrentUserRole();
      if (isMounted) {
        if (user) {
          setCurrentUserId(user.id || 'current-user');
          setCurrentUserName(user.fullName || (user.email ? user.email.split('@')[0] : initialUserName || 'Student'));
        }
        setActiveRole(role);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [initialUserName]);

  // Fetch conversations and forum topics
  const loadModuleData = useCallback(async () => {
    try {
      const [convs, topics, students] = await Promise.all([
        ChatService.getConversations(),
        ChatService.getForumTopics(forumCategory, forumSearch),
        ChatService.getRegisteredStudents(),
      ]);
      setConversations(convs);
      setForumTopics(topics);
      setRegisteredStudents(students);
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  }, [forumCategory, forumSearch]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      ChatService.getConversations(),
      ChatService.getForumTopics(forumCategory, forumSearch),
      ChatService.getRegisteredStudents(),
    ])
      .then(([convs, topics, students]) => {
        if (isMounted) {
          setConversations(convs);
          setForumTopics(topics);
          setRegisteredStudents(students);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [forumCategory, forumSearch]);

  // Real-Time Polling for active conversation thread
  useEffect(() => {
    if (!activeConversation) return;

    let isMounted = true;
    const fetchActiveMessages = async () => {
      const msgs = await ChatService.getMessages(activeConversation.id);
      if (isMounted) {
        setMessages(msgs);
      }
    };

    fetchActiveMessages();
    ChatService.markAsRead(activeConversation.id, currentUserId);

    // Auto-poll messages every 3 seconds for real-time delivery
    const intervalId = setInterval(fetchActiveMessages, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeConversation, currentUserId]);

  // Handle Role Toggle (Admin <-> Student)
  const handleToggleRole = async () => {
    const newRole: ChatRole = activeRole === 'admin' ? 'student' : 'admin';
    setActiveRole(newRole);
    await ChatService.setRoleOverride(newRole);
    Alert.alert(
      'Role Switched',
      `You are now viewing as ${newRole.toUpperCase()}. ${
        newRole === 'admin'
          ? 'Admin features enabled: view all students, pin discussions, moderate messages, and send announcements.'
          : 'Student features enabled: direct chat with Admin, join discussions, and ask questions.'
      }`
    );
    loadModuleData();
  };

  // Open a Conversation
  const handleOpenConversation = async (conv: ChatConversation) => {
    setActiveConversation(conv);
    const msgs = await ChatService.getMessages(conv.id);
    setMessages(msgs);
    await ChatService.markAsRead(conv.id, currentUserId);
    // Update local unread counter in list
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Send a Chat Message
  const handleSendMessage = async () => {
    if (!activeConversation || !messageInput.trim() || isSendingMessage) return;

    const content = messageInput.trim();
    setMessageInput('');
    setIsSendingMessage(true);

    try {
      const senderRole: ChatRole = activeRole;
      const senderName = activeRole === 'admin' ? 'Admin' : currentUserName;

      const sent = await ChatService.sendMessage(
        activeConversation.id,
        content,
        currentUserId,
        senderName,
        senderRole
      );

      setMessages((prev) => [...prev, sent]);

      // Update conversations list with latest message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, lastMessage: content, lastMessageAt: sent.createdAt }
            : c
        )
      );

      setTimeout(() => {
        messageListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: unknown) {
      Alert.alert('Message Failed', err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Admin Moderate / Delete Message
  const handleModerateMessage = (messageId: string) => {
    Alert.alert(
      'Moderate Message',
      'Are you sure you want to delete/moderate this message for all participants?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Message',
          style: 'destructive',
          onPress: async () => {
            if (!activeConversation) return;
            await ChatService.moderateMessage(activeConversation.id, messageId);
            const updated = await ChatService.getMessages(activeConversation.id);
            setMessages(updated);
          },
        },
      ]
    );
  };

  // Start Private Chat with Student (Admin feature)
  const handleStartChatWithStudent = async (student: RegisteredStudent) => {
    setShowStudentsModal(false);
    const conv = await ChatService.startPrivateConversation(student);
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conv.id);
      return exists ? prev : [conv, ...prev];
    });
    handleOpenConversation(conv);
  };

  // Admin Broadcast Announcement
  const handleBroadcastAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim() || isBroadcasting) {
      Alert.alert('Required Fields', 'Please enter both an announcement title and message content.');
      return;
    }

    setIsBroadcasting(true);
    try {
      await ChatService.sendAnnouncement(announcementTitle.trim(), announcementMessage.trim());
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      Alert.alert('Announcement Broadcasted', 'The announcement has been posted to the Discussion Forum and sent to the student group.');
      loadModuleData();
    } catch (err: unknown) {
      Alert.alert('Broadcast Error', err instanceof Error ? err.message : 'Failed to broadcast announcement.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Admin Create Group Discussion
  const handleCreateGroupDiscussion = async () => {
    if (!groupTitle.trim() || isCreatingGroup) {
      Alert.alert('Required Field', 'Please provide a title for the new group discussion.');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const group = await ChatService.createGroupDiscussion(
        groupTitle.trim(),
        groupDescription.trim()
      );
      setShowNewGroupModal(false);
      setGroupTitle('');
      setGroupDescription('');
      setConversations((prev) => [group, ...prev]);
      handleOpenConversation(group);
    } catch (err: unknown) {
      Alert.alert('Group Error', err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Create New Forum Topic
  const handleCreateForumTopic = async () => {
    if (!newTopicTitle.trim() || !newTopicContent.trim() || isCreatingTopic) {
      Alert.alert('Required Fields', 'Please enter both a topic title and question/content.');
      return;
    }

    setIsCreatingTopic(true);
    try {
      const topic = await ChatService.createForumTopic(
        newTopicTitle.trim(),
        newTopicContent.trim(),
        newTopicCategory,
        currentUserId,
        activeRole === 'admin' ? 'Admin Office' : currentUserName,
        activeRole
      );
      setShowNewTopicModal(false);
      setNewTopicTitle('');
      setNewTopicContent('');
      setForumTopics((prev) => [topic, ...prev]);
      setSelectedTopic(topic);
    } catch (err: unknown) {
      Alert.alert('Topic Error', err instanceof Error ? err.message : 'Failed to publish topic.');
    } finally {
      setIsCreatingTopic(false);
    }
  };

  // Post Reply to Forum Topic
  const handlePostForumReply = async () => {
    if (!selectedTopic || !replyInput.trim() || isPostingReply) return;

    setIsPostingReply(true);
    try {
      const authorName = activeRole === 'admin' ? 'Admin Office' : currentUserName;
      const reply = await ChatService.replyToForumTopic(
        selectedTopic.id,
        replyInput.trim(),
        currentUserId,
        authorName,
        activeRole
      );

      setReplyInput('');
      const updatedTopic: ForumTopic = {
        ...selectedTopic,
        replies: [...(selectedTopic.replies || []), reply],
        replyCount: (selectedTopic.replyCount || 0) + 1,
      };
      setSelectedTopic(updatedTopic);
      setForumTopics((prev) =>
        prev.map((t) => (t.id === selectedTopic.id ? updatedTopic : t))
      );
    } catch (err: unknown) {
      Alert.alert('Reply Failed', err instanceof Error ? err.message : 'Could not submit reply.');
    } finally {
      setIsPostingReply(false);
    }
  };

  // Admin Pin / Unpin Forum Topic
  const handleTogglePinTopic = async (topicId: string) => {
    const isNowPinned = await ChatService.togglePinTopic(topicId);
    if (selectedTopic && selectedTopic.id === topicId) {
      setSelectedTopic({ ...selectedTopic, isPinned: isNowPinned });
    }
    setForumTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, isPinned: isNowPinned } : t))
    );
  };

  // Admin Delete Forum Topic
  const handleDeleteForumTopic = (topicId: string) => {
    Alert.alert(
      'Delete Discussion Topic',
      'Are you sure you want to delete this discussion topic and all its replies?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await ChatService.deleteForumTopic(topicId);
            setSelectedTopic(null);
            setForumTopics((prev) => prev.filter((t) => t.id !== topicId));
          },
        },
      ]
    );
  };

  // Total unread messages across private chat
  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <View style={[styles.moduleCard, isExpandedModal && styles.moduleCardExpanded]}>
      {/* SECTION HEADER ROW */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="chatbubbles" size={22} color="#6366F1" />
          </View>
          <View style={{ marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Discussion &amp; Chat</Text>
              <View style={styles.connectedBadge}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              Communicate with administrators and students in one place.
            </Text>
          </View>
        </View>

        {/* ROLE TOGGLE PILL & MODAL CLOSE */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.roleTogglePill,
              activeRole === 'admin' ? styles.roleTogglePillAdmin : styles.roleTogglePillStudent,
            ]}
            onPress={handleToggleRole}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeRole === 'admin' ? 'shield-checkmark' : 'school'}
              size={14}
              color={activeRole === 'admin' ? '#7C3AED' : '#0284C7'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.roleToggleText,
                { color: activeRole === 'admin' ? '#7C3AED' : '#0284C7' },
              ]}
            >
              {activeRole === 'admin' ? 'Admin Mode' : 'Student View'}
            </Text>
            <Ionicons
              name="swap-horizontal"
              size={12}
              color={activeRole === 'admin' ? '#7C3AED' : '#0284C7'}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>

          {onOpenModal && !isExpandedModal && (
            <TouchableOpacity onPress={onOpenModal} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="expand-outline" size={18} color="#6366F1" />
            </TouchableOpacity>
          )}

          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TWO MAIN TABS SWITCHER */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'forum' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('forum');
            setSelectedTopic(null);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === 'forum' ? '#6366F1' : '#64748B'}
            style={{ marginRight: 8 }}
          />
          <View>
            <Text style={[styles.tabTitle, activeTab === 'forum' && styles.tabTitleActive]}>
              Discussion Forum
            </Text>
            <Text style={styles.tabSubtext} numberOfLines={1}>
              Post questions, share ideas &amp; group discussions
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chat')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={activeTab === 'chat' ? '#6366F1' : '#64748B'}
              style={{ marginRight: 8 }}
            />
            {totalUnreadCount > 0 && (
              <View style={styles.tabUnreadBadge}>
                <Text style={styles.tabUnreadBadgeText}>{totalUnreadCount}</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={[styles.tabTitle, activeTab === 'chat' && styles.tabTitleActive]}>
              Private Chat
            </Text>
            <Text style={styles.tabSubtext} numberOfLines={1}>
              Direct messaging between students &amp; administrators
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* TAB CONTENT */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.loadingText}>Syncing Discussion &amp; Chat...</Text>
        </View>
      ) : activeTab === 'chat' ? (
        /* ==================== PRIVATE CHAT TAB ==================== */
        <View style={styles.tabBody}>
          {/* Admin Toolbar Actions (When in Admin Mode) */}
          {activeRole === 'admin' && (
            <View style={styles.adminActionToolbar}>
              <TouchableOpacity
                style={styles.adminToolBtn}
                onPress={() => setShowAnnouncementModal(true)}
              >
                <Ionicons name="megaphone" size={14} color="#7C3AED" style={{ marginRight: 6 }} />
                <Text style={styles.adminToolBtnText}>Broadcast Announcement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminToolBtn}
                onPress={() => setShowStudentsModal(true)}
              >
                <Ionicons name="people" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={styles.adminToolBtnText}>View All Students ({registeredStudents.length})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminToolBtn}
                onPress={() => setShowNewGroupModal(true)}
              >
                <Ionicons name="add-circle" size={14} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.adminToolBtnText}>Create Group Discussion</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeConversation ? (
            /* ACTIVE CHAT WINDOW */
            <View style={styles.chatWindow}>
              {/* Chat Header */}
              <View style={styles.chatWindowHeader}>
                <TouchableOpacity
                  style={styles.chatBackBtn}
                  onPress={() => setActiveConversation(null)}
                >
                  <Ionicons name="arrow-back" size={18} color="#475569" />
                </TouchableOpacity>

                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarLetter}>
                    {activeConversation.title.charAt(0).toUpperCase()}
                  </Text>
                  <View style={styles.onlineDot} />
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                      {activeConversation.title}
                    </Text>
                    {activeConversation.type === 'direct' && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="shield-checkmark" size={11} color="#6366F1" />
                        <Text style={styles.verifiedBadgeText}>Official</Text>
                      </View>
                    )}
                    {activeConversation.isGroup && (
                      <View style={[styles.verifiedBadge, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="people" size={11} color="#7C3AED" />
                        <Text style={[styles.verifiedBadgeText, { color: '#7C3AED' }]}>Group</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chatHeaderSubtitle}>
                    {activeConversation.isGroup ? 'Group Discussion • Real-time' : 'Direct Conversation • Connected'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.chatCloseBtn}
                  onPress={() => setActiveConversation(null)}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Messages Stream */}
              <FlatList
                ref={messageListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isOutgoing =
                    item.senderId === currentUserId ||
                    (activeRole === 'admin' && item.senderRole === 'admin') ||
                    (activeRole === 'student' && item.senderRole === 'student' && item.senderName === currentUserName);

                  return (
                    <View
                      style={[
                        styles.messageRow,
                        isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming,
                      ]}
                    >
                      {!isOutgoing && (
                        <View style={styles.msgAvatarCircle}>
                          <Text style={styles.msgAvatarLetter}>
                            {(item.senderName || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View
                        style={[
                          styles.messageBubble,
                          isOutgoing ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming,
                          item.isDeleted && styles.messageBubbleDeleted,
                        ]}
                      >
                        {!isOutgoing && (
                          <View style={styles.msgSenderRow}>
                            <Text style={styles.msgSenderName}>{item.senderName}</Text>
                            <View
                              style={[
                                styles.msgRoleChip,
                                item.senderRole === 'admin' ? styles.msgRoleAdmin : styles.msgRoleStudent,
                              ]}
                            >
                              <Text style={styles.msgRoleText}>
                                {item.senderRole.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        )}

                        <Text
                          style={[
                            styles.messageText,
                            isOutgoing ? styles.messageTextOutgoing : styles.messageTextIncoming,
                            item.isDeleted && styles.messageTextDeleted,
                          ]}
                        >
                          {item.message}
                        </Text>

                        <View style={styles.msgMetaRow}>
                          <Text
                            style={[
                              styles.msgTimestamp,
                              isOutgoing ? styles.msgTimestampOutgoing : styles.msgTimestampIncoming,
                            ]}
                          >
                            {item.createdAt}
                          </Text>
                          {isOutgoing && (
                            <Ionicons
                              name="checkmark-done"
                              size={13}
                              color="#C7D2FE"
                              style={{ marginLeft: 4 }}
                            />
                          )}

                          {/* Admin Moderation Button */}
                          {activeRole === 'admin' && !item.isDeleted && (
                            <TouchableOpacity
                              onPress={() => handleModerateMessage(item.id)}
                              style={{ marginLeft: 8 }}
                            >
                              <Ionicons name="trash-outline" size={12} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />

              {/* Message Composer */}
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              >
                <View style={styles.composerContainer}>
                  <TextInput
                    style={styles.composerInput}
                    placeholder={`Message as ${activeRole === 'admin' ? 'Admin' : currentUserName}...`}
                    placeholderTextColor="#94A3B8"
                    value={messageInput}
                    onChangeText={setMessageInput}
                    multiline
                    maxLength={1000}
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !messageInput.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSendMessage}
                    disabled={!messageInput.trim() || isSendingMessage}
                    activeOpacity={0.8}
                  >
                    {isSendingMessage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          ) : (
            /* CONVERSATION LIST (Recent conversations matching prompt) */
            <View style={styles.conversationsList}>
              <View style={styles.recentConvsHeaderRow}>
                <Text style={styles.recentConvsTitle}>Recent conversations</Text>
                <Text style={styles.recentConvsCount}>
                  {conversations.length} Active {conversations.length === 1 ? 'Thread' : 'Threads'}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {conversations.map((conv) => {
                  const isAdminType = conv.title.toLowerCase().includes('admin');
                  const isGroupType = conv.isGroup || conv.type === 'group';

                  return (
                    <TouchableOpacity
                      key={conv.id}
                      style={[styles.convCard, conv.unreadCount > 0 && styles.convCardUnread]}
                      onPress={() => handleOpenConversation(conv)}
                      activeOpacity={0.7}
                    >
                      {/* Avatar */}
                      <View
                        style={[
                          styles.convAvatar,
                          isAdminType
                            ? styles.convAvatarAdmin
                            : isGroupType
                            ? styles.convAvatarGroup
                            : styles.convAvatarStudent,
                        ]}
                      >
                        <Ionicons
                          name={isAdminType ? 'shield' : isGroupType ? 'people' : 'person'}
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>

                      {/* Info & Last Message */}
                      <View style={styles.convDetails}>
                        <View style={styles.convTitleRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={styles.convTitleText} numberOfLines={1}>
                              {conv.title}
                            </Text>
                            {isAdminType && (
                              <View style={styles.miniTagAdmin}>
                                <Text style={styles.miniTagAdminText}>Support</Text>
                              </View>
                            )}
                            {isGroupType && (
                              <View style={styles.miniTagGroup}>
                                <Text style={styles.miniTagGroupText}>Group</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.convTimeText}>{conv.lastMessageAt}</Text>
                        </View>

                        <View style={styles.convLastMessageRow}>
                          <Text
                            style={[
                              styles.convLastMessageText,
                              conv.unreadCount > 0 && styles.convLastMessageUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {conv.lastMessage}
                          </Text>

                          {conv.unreadCount > 0 && (
                            <View style={styles.unreadBubble}>
                              <Text style={styles.unreadBubbleText}>{conv.unreadCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        /* ==================== DISCUSSION FORUM TAB ==================== */
        <View style={styles.tabBody}>
          {selectedTopic ? (
            /* FORUM TOPIC DETAIL VIEW */
            <View style={styles.topicDetailContainer}>
              <View style={styles.topicDetailHeader}>
                <TouchableOpacity
                  style={styles.topicBackBtn}
                  onPress={() => setSelectedTopic(null)}
                >
                  <Ionicons name="arrow-back" size={16} color="#475569" style={{ marginRight: 4 }} />
                  <Text style={styles.topicBackBtnText}>All Discussions</Text>
                </TouchableOpacity>

                {/* Admin Pin / Moderate Actions */}
                {activeRole === 'admin' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={[
                        styles.adminActionChip,
                        selectedTopic.isPinned && { backgroundColor: '#EDE9FE' },
                      ]}
                      onPress={() => handleTogglePinTopic(selectedTopic.id)}
                    >
                      <Ionicons
                        name="pin"
                        size={12}
                        color={selectedTopic.isPinned ? '#7C3AED' : '#64748B'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.adminActionChipText,
                          selectedTopic.isPinned && { color: '#7C3AED' },
                        ]}
                      >
                        {selectedTopic.isPinned ? 'Pinned' : 'Pin Topic'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.adminActionChip, { backgroundColor: '#FEE2E2', marginLeft: 6 }]}
                      onPress={() => handleDeleteForumTopic(selectedTopic.id)}
                    >
                      <Ionicons name="trash" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                      <Text style={[styles.adminActionChipText, { color: '#DC2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Main Topic Question Body */}
              <View style={styles.topicQuestionCard}>
                <View style={styles.topicMetaRow}>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{selectedTopic.category}</Text>
                  </View>
                  {selectedTopic.isPinned && (
                    <View style={styles.pinnedPill}>
                      <Ionicons name="pin" size={11} color="#7C3AED" style={{ marginRight: 3 }} />
                      <Text style={styles.pinnedPillText}>Pinned</Text>
                    </View>
                  )}
                  <Text style={styles.topicTimeAgo}>{selectedTopic.createdAt}</Text>
                </View>

                <Text style={styles.topicQuestionTitle}>{selectedTopic.title}</Text>
                <Text style={styles.topicQuestionBody}>{selectedTopic.content}</Text>

                <View style={styles.topicAuthorRow}>
                  <View style={styles.authorAvatarCircle}>
                    <Text style={styles.authorAvatarLetter}>
                      {selectedTopic.authorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.authorNameText}>{selectedTopic.authorName}</Text>
                  <View
                    style={[
                      styles.msgRoleChip,
                      selectedTopic.authorRole === 'admin' ? styles.msgRoleAdmin : styles.msgRoleStudent,
                    ]}
                  >
                    <Text style={styles.msgRoleText}>
                      {selectedTopic.authorRole.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Replies Header */}
              <View style={styles.repliesHeaderRow}>
                <Text style={styles.repliesHeading}>
                  Replies ({selectedTopic.replies?.length || 0})
                </Text>
              </View>

              {/* Replies List */}
              <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                {selectedTopic.replies && selectedTopic.replies.length > 0 ? (
                  selectedTopic.replies.map((reply: ForumReply) => (
                    <View key={reply.id} style={styles.replyCard}>
                      <View style={styles.replyTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={styles.replyAvatar}>
                            <Text style={styles.replyAvatarLetter}>
                              {reply.authorName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.replyAuthorName}>{reply.authorName}</Text>
                          <View
                            style={[
                              styles.msgRoleChip,
                              reply.authorRole === 'admin' ? styles.msgRoleAdmin : styles.msgRoleStudent,
                            ]}
                          >
                            <Text style={styles.msgRoleText}>
                              {reply.authorRole.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.replyTimeText}>{reply.createdAt}</Text>
                      </View>
                      <Text style={styles.replyContentText}>{reply.content}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.noRepliesBox}>
                    <Text style={styles.noRepliesText}>
                      No replies yet. Be the first to share an answer or insight!
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Reply Composer */}
              <View style={styles.replyComposerContainer}>
                <TextInput
                  style={styles.replyComposerInput}
                  placeholder="Write a comment or reply to this topic..."
                  placeholderTextColor="#94A3B8"
                  value={replyInput}
                  onChangeText={setReplyInput}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.replySubmitBtn, !replyInput.trim() && styles.replySubmitBtnDisabled]}
                  onPress={handlePostForumReply}
                  disabled={!replyInput.trim() || isPostingReply}
                >
                  {isPostingReply ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.replySubmitBtnText}>Post Reply</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* FORUM TOPIC LIST */
            <View>
              {/* Search & Actions Bar */}
              <View style={styles.forumFilterBar}>
                <View style={styles.forumSearchBox}>
                  <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.forumSearchInput}
                    placeholder="Search discussions & questions..."
                    placeholderTextColor="#94A3B8"
                    value={forumSearch}
                    onChangeText={setForumSearch}
                  />
                  {forumSearch ? (
                    <TouchableOpacity onPress={() => setForumSearch('')}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.newTopicBtn}
                  onPress={() => setShowNewTopicModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.newTopicBtnText}>New Discussion</Text>
                </TouchableOpacity>
              </View>

              {/* Categories Filter Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScrollView}
              >
                {['All', 'General', 'Assignments', 'Exams', 'Announcements', 'Curriculum'].map(
                  (cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catFilterChip,
                        forumCategory.toLowerCase() === cat.toLowerCase() && styles.catFilterChipActive,
                      ]}
                      onPress={() => setForumCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catFilterChipText,
                          forumCategory.toLowerCase() === cat.toLowerCase() && styles.catFilterChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>

              {/* Topic List */}
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {forumTopics.length > 0 ? (
                  forumTopics.map((topic) => (
                    <TouchableOpacity
                      key={topic.id}
                      style={[styles.topicCard, topic.isPinned && styles.topicCardPinned]}
                      onPress={() => setSelectedTopic(topic)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.topicTopMeta}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {topic.isPinned && (
                            <View style={styles.pinnedBadgeInline}>
                              <Ionicons name="pin" size={12} color="#7C3AED" style={{ marginRight: 3 }} />
                              <Text style={styles.pinnedBadgeText}>Pinned</Text>
                            </View>
                          )}
                          <View style={styles.categoryBadgeInline}>
                            <Text style={styles.categoryBadgeText}>{topic.category}</Text>
                          </View>
                        </View>
                        <Text style={styles.topicDateText}>{topic.createdAt}</Text>
                      </View>

                      <Text style={styles.topicCardTitle} numberOfLines={2}>
                        {topic.title}
                      </Text>

                      <Text style={styles.topicCardSnippet} numberOfLines={2}>
                        {topic.content}
                      </Text>

                      <View style={styles.topicCardBottomRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={styles.miniAvatar}>
                            <Text style={styles.miniAvatarText}>
                              {topic.authorName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.topicAuthorName}>{topic.authorName}</Text>
                          <View
                            style={[
                              styles.msgRoleChip,
                              topic.authorRole === 'admin' ? styles.msgRoleAdmin : styles.msgRoleStudent,
                            ]}
                          >
                            <Text style={styles.msgRoleText}>
                              {topic.authorRole.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.repliesCountChip}>
                          <Ionicons name="chatbubble-ellipses" size={13} color="#6366F1" style={{ marginRight: 4 }} />
                          <Text style={styles.repliesCountText}>
                            {topic.replyCount} {topic.replyCount === 1 ? 'reply' : 'replies'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyForumBox}>
                    <Ionicons name="chatbubbles-outline" size={32} color="#94A3B8" />
                    <Text style={styles.emptyForumTitle}>No discussions found</Text>
                    <Text style={styles.emptyForumSubtitle}>
                      Start a new topic to discuss assignments, lectures, or ask questions!
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* ==================== MODAL: REGISTERED STUDENTS (Admin Feature) ==================== */}
      <Modal
        visible={showStudentsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStudentsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="people" size={20} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.modalHeading}>Registered Students</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStudentsModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubheading}>
              Select a student to start a direct 1:1 conversation or review progress.
            </Text>

            <ScrollView style={{ maxHeight: 340 }}>
              {registeredStudents.map((std) => (
                <View key={std.id} style={styles.studentRosterRow}>
                  <View style={styles.studentAvatarCircle}>
                    <Text style={styles.studentAvatarText}>{std.avatarLetter}</Text>
                    {std.isOnline && <View style={styles.studentOnlineDot} />}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.studentRosterName}>{std.name}</Text>
                    <Text style={styles.studentRosterEmail}>{std.email}</Text>
                    <Text style={styles.studentRosterProgram} numberOfLines={1}>
                      {std.enrolledProgram || 'Enrolled Student'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.startDirectChatBtn}
                    onPress={() => handleStartChatWithStudent(std)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.startDirectChatBtnText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: BROADCAST ANNOUNCEMENT (Admin Feature) ==================== */}
      <Modal
        visible={showAnnouncementModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAnnouncementModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="megaphone" size={20} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={styles.modalHeading}>Broadcast Announcement</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubheading}>
              Send an important broadcast announcement to all enrolled students.
            </Text>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Announcement Title (e.g. Exam Schedule Update)"
              placeholderTextColor="#94A3B8"
              value={announcementTitle}
              onChangeText={setAnnouncementTitle}
            />

            <TextInput
              style={[styles.modalTextInput, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Announcement details..."
              placeholderTextColor="#94A3B8"
              value={announcementMessage}
              onChangeText={setAnnouncementMessage}
              multiline
            />

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, isBroadcasting && styles.modalPrimaryBtnDisabled]}
              onPress={handleBroadcastAnnouncement}
              disabled={isBroadcasting}
            >
              {isBroadcasting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>Broadcast to All Students</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: CREATE GROUP (Admin Feature) ==================== */}
      <Modal
        visible={showNewGroupModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewGroupModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={20} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.modalHeading}>New Group Discussion</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNewGroupModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Group Title (e.g. Term 2 Capstone Team)"
              placeholderTextColor="#94A3B8"
              value={groupTitle}
              onChangeText={setGroupTitle}
            />

            <TextInput
              style={[styles.modalTextInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Initial welcome message or topic..."
              placeholderTextColor="#94A3B8"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
            />

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, isCreatingGroup && styles.modalPrimaryBtnDisabled]}
              onPress={handleCreateGroupDiscussion}
              disabled={isCreatingGroup}
            >
              {isCreatingGroup ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>Create Group Room</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: CREATE DISCUSSION TOPIC ==================== */}
      <Modal
        visible={showNewTopicModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewTopicModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chatbubbles" size={20} color="#6366F1" style={{ marginRight: 8 }} />
                <Text style={styles.modalHeading}>New Discussion Topic</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNewTopicModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubheading}>
              Post a question or discussion topic for fellow students and faculty.
            </Text>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Topic Title"
              placeholderTextColor="#94A3B8"
              value={newTopicTitle}
              onChangeText={setNewTopicTitle}
            />

            {/* Category Selector */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {(['General', 'Assignments', 'Exams', 'Curriculum', 'Q&A'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.catPillSelect,
                    newTopicCategory === c && styles.catPillSelectActive,
                  ]}
                  onPress={() => setNewTopicCategory(c)}
                >
                  <Text
                    style={[
                      styles.catPillSelectText,
                      newTopicCategory === c && styles.catPillSelectTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.modalTextInput, { height: 110, textAlignVertical: 'top' }]}
              placeholder="What would you like to discuss or ask?"
              placeholderTextColor="#94A3B8"
              value={newTopicContent}
              onChangeText={setNewTopicContent}
              multiline
            />

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, isCreatingTopic && styles.modalPrimaryBtnDisabled]}
              onPress={handleCreateForumTopic}
              disabled={isCreatingTopic}
            >
              {isCreatingTopic ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>Publish Discussion Topic</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  moduleCardExpanded: {
    margin: 0,
    borderRadius: 0,
    borderWidth: 0,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 240,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  greenPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  connectedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  roleTogglePillStudent: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  roleTogglePillAdmin: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  roleToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTitleActive: {
    color: '#6366F1',
  },
  tabSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  tabUnreadBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginRight: 6,
  },
  tabUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  tabBody: {
    minHeight: 280,
  },
  adminActionToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  adminToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminToolBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  recentConvsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentConvsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentConvsCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  conversationsList: {
    gap: 8,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  convCardUnread: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  convAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convAvatarAdmin: {
    backgroundColor: '#7C3AED',
  },
  convAvatarGroup: {
    backgroundColor: '#6366F1',
  },
  convAvatarStudent: {
    backgroundColor: '#0284C7',
  },
  convDetails: {
    flex: 1,
    marginLeft: 12,
  },
  convTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  convTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  miniTagAdmin: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  miniTagAdminText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C3AED',
  },
  miniTagGroup: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  miniTagGroupText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F46E5',
  },
  convTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  convLastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convLastMessageText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  convLastMessageUnread: {
    color: '#1E293B',
    fontWeight: '700',
  },
  unreadBubble: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  chatWindow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    height: 440,
  },
  chatWindowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  chatBackBtn: {
    padding: 6,
    marginRight: 6,
  },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chatAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  chatHeaderSubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6366F1',
    marginLeft: 2,
  },
  chatCloseBtn: {
    padding: 4,
  },
  messagesList: {
    padding: 14,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageRowIncoming: {
    alignSelf: 'flex-start',
  },
  messageRowOutgoing: {
    alignSelf: 'flex-end',
  },
  msgAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  msgAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  messageBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  messageBubbleIncoming: {
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 4,
  },
  messageBubbleOutgoing: {
    backgroundColor: '#6366F1',
    borderTopRightRadius: 4,
  },
  messageBubbleDeleted: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  msgSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  msgSenderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginRight: 6,
  },
  msgRoleChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  msgRoleAdmin: {
    backgroundColor: '#EDE9FE',
  },
  msgRoleStudent: {
    backgroundColor: '#E0F2FE',
  },
  msgRoleText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#4338CA',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageTextIncoming: {
    color: '#0F172A',
  },
  messageTextOutgoing: {
    color: '#FFFFFF',
  },
  messageTextDeleted: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  msgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  msgTimestamp: {
    fontSize: 9,
  },
  msgTimestampIncoming: {
    color: '#94A3B8',
  },
  msgTimestampOutgoing: {
    color: '#E0E7FF',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    maxHeight: 90,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  forumFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  forumSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  forumSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  newTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newTopicBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  categoriesScrollView: {
    marginBottom: 14,
  },
  catFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  catFilterChipActive: {
    backgroundColor: '#6366F1',
  },
  catFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  catFilterChipTextActive: {
    color: '#FFFFFF',
  },
  topicCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  topicCardPinned: {
    backgroundColor: '#FAFAF9',
    borderColor: '#E2E8F0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#7C3AED',
  },
  topicTopMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pinnedBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  pinnedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C3AED',
  },
  categoryBadgeInline: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  topicDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  topicCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  topicCardSnippet: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 10,
  },
  topicCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  miniAvatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  topicAuthorName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginRight: 6,
  },
  repliesCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  repliesCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  emptyForumBox: {
    alignItems: 'center',
    padding: 30,
  },
  emptyForumTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
  },
  emptyForumSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  topicDetailContainer: {
    backgroundColor: '#FFFFFF',
  },
  topicDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topicBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  topicBackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  adminActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adminActionChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  topicQuestionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  topicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  pinnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  pinnedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  topicTimeAgo: {
    fontSize: 10,
    color: '#94A3B8',
  },
  topicQuestionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  topicQuestionBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 12,
  },
  topicAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  authorAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  authorAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  authorNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  repliesHeaderRow: {
    marginBottom: 8,
  },
  repliesHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  replyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  replyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  replyAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  replyAuthorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginRight: 6,
  },
  replyTimeText: {
    fontSize: 9,
    color: '#94A3B8',
  },
  replyContentText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  noRepliesBox: {
    padding: 20,
    alignItems: 'center',
  },
  noRepliesText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  replyComposerContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  replyComposerInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 70,
    marginBottom: 8,
  },
  replySubmitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  replySubmitBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  replySubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubheading: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  studentRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  studentAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  studentAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  studentOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  studentRosterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentRosterEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  studentRosterProgram: {
    fontSize: 10,
    color: '#6366F1',
    fontWeight: '600',
  },
  startDirectChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  startDirectChatBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modalPrimaryBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalPrimaryBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  catPillSelect: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  catPillSelectActive: {
    backgroundColor: '#6366F1',
  },
  catPillSelectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  catPillSelectTextActive: {
    color: '#FFFFFF',
  },
});
