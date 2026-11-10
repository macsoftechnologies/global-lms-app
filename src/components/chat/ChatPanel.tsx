import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ChatConversation,
  ChatMessage,
  ChatRole,
  ChatContactItem,
  ForumTopic,
  RegisteredStudent,
} from '../../types/chat';
import { ChatService } from '../../services/chatService';
import { AuthStorage, AuthSession } from '../../services/authStorage';
import { ConversationList } from './ConversationList';
import { MessageWindow } from './MessageWindow';
import { DiscussionList } from './DiscussionList';
import { DiscussionDetails } from './DiscussionDetails';
import { NotificationBadge } from './NotificationBadge';

interface ChatPanelProps {
  visible: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  visible,
  onClose,
  onUnreadChange,
}) => {
  // Navigation / Tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'forum'>('chat');
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);

  // User & Role State
  const [currentUserRole, setCurrentUserRole] = useState<ChatRole>('student');
  const [currentUser, setCurrentUser] = useState<AuthSession['user'] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('current-user');
  const [currentUserName, setCurrentUserName] = useState<string>('Student');

  // Data State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [forumTopics, setForumTopics] = useState<ForumTopic[]>([]);
  const [studentsRoster, setStudentsRoster] = useState<RegisteredStudent[]>([]);
  const [contactsList, setContactsList] = useState<{
    adminsAndFaculty: ChatContactItem[];
    classmates: ChatContactItem[];
  }>({ adminsAndFaculty: [], classmates: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Admin Modals
  const [showRosterModal, setShowRosterModal] = useState<boolean>(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState<boolean>(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);

  // Admin Form States
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');
  const [groupTitle, setGroupTitle] = useState<string>('');
  const [groupDescription, setGroupDescription] = useState<string>('');

  // Polling ref to prevent concurrent fetches
  const isPollingRef = useRef<boolean>(false);

  // Total unread messages across conversations for the active viewing role
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => {
      const countForRole =
        currentUserRole === 'admin'
          ? c.unreadCountAdmin !== undefined
            ? c.unreadCountAdmin
            : c.lastSenderRole === 'student'
            ? c.unreadCount
            : 0
          : c.unreadCountStudent !== undefined
          ? c.unreadCountStudent
          : c.lastSenderRole === 'admin'
          ? c.unreadCount
          : 0;
      return acc + (countForRole || 0);
    }, 0);
  }, [conversations, currentUserRole]);

  useEffect(() => {
    if (onUnreadChange) {
      onUnreadChange(totalUnreadCount);
    }
  }, [totalUnreadCount, onUnreadChange]);

  // Fetch all user, role, chat & forum data
  const fetchData = useCallback(async () => {
    try {
      const [role, user, convs, topics, roster, contacts] = await Promise.all([
        ChatService.getCurrentUserRole(),
        AuthStorage.getUser(),
        ChatService.getConversations(),
        ChatService.getForumTopics('All'),
        ChatService.getRegisteredStudents(),
        ChatService.getContacts(),
      ]);
      setCurrentUserRole(role);
      setCurrentUser(user);
      if (user) {
        setCurrentUserId(user.id || (user as any).userId || (user as any)._id || 'current-user');
        setCurrentUserName(user.fullName || (role === 'admin' ? 'Academic Admin' : 'Student'));
      } else {
        setCurrentUserId(role === 'admin' ? 'admin-main' : 'current-user');
        setCurrentUserName(role === 'admin' ? 'Academic Admin' : 'Student');
      }
      setConversations(convs);
      setForumTopics(topics);
      setStudentsRoster(roster);
      setContactsList(contacts);
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load when modal opens
  useEffect(() => {
    let active = true;
    if (visible) {
      Promise.resolve().then(() => {
        if (!active) return;
        fetchData();
      });
    }
    return () => {
      active = false;
    };
  }, [visible, fetchData]);

  // Fetch messages when conversation selected
  useEffect(() => {
    let active = true;
    if (selectedConversation) {
      ChatService.getMessages(selectedConversation.id).then((msgs) => {
        if (!active) return;
        setMessages(msgs);
        ChatService.markAsRead(selectedConversation.id, currentUserId, currentUserRole);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  unreadCount: 0,
                  unreadCountAdmin: currentUserRole === 'admin' ? 0 : c.unreadCountAdmin,
                  unreadCountStudent: currentUserRole === 'student' ? 0 : c.unreadCountStudent,
                }
              : c
          )
        );
      });
    } else {
      Promise.resolve().then(() => {
        if (!active) return;
        setMessages([]);
      });
    }
    return () => {
      active = false;
    };
  }, [selectedConversation, currentUserId, currentUserRole]);

  // Real-time synchronization polling (3.5 seconds matching Website implementation)
  useEffect(() => {
    let active = true;
    if (!visible) return;

    const intervalId = setInterval(async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        // Poll active thread messages if open
        if (selectedConversation) {
          const updatedMsgs = await ChatService.getMessages(selectedConversation.id);
          if (active) {
            setMessages((prev) => {
              if (prev.length !== updatedMsgs.length || JSON.stringify(prev) !== JSON.stringify(updatedMsgs)) {
                return updatedMsgs;
              }
              return prev;
            });
          }
        }

        // Poll inbox conversations
        const updatedConvs = await ChatService.getConversations();
        if (active) {
          setConversations(updatedConvs);
        }
      } catch {
        // silent
      } finally {
        isPollingRef.current = false;
      }
    }, 3500);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [visible, selectedConversation]);

  // Handlers
  const handleToggleRole = async () => {
    const nextRole: ChatRole = currentUserRole === 'admin' ? 'student' : 'admin';
    await ChatService.setRoleOverride(nextRole);
    setCurrentUserRole(nextRole);

    const user = await AuthStorage.getUser();
    setCurrentUser(user);
    if (nextRole === 'admin') {
      setCurrentUserId('admin-main');
      setCurrentUserName('Academic Admin');
    } else {
      setCurrentUserId(user?.id || (user as any)?.userId || (user as any)?._id || 'student-user-1');
      setCurrentUserName(user?.fullName || 'Student');
    }

    try {
      const updatedConvs = await ChatService.getConversations();
      setConversations(updatedConvs);
      if (selectedConversation) {
        const updatedMsgs = await ChatService.getMessages(selectedConversation.id);
        setMessages(updatedMsgs);
      }
    } catch {
      // fallback
    }

    Alert.alert(
      'Role Switched',
      `You are now viewing as ${nextRole.toUpperCase()}. ${
        nextRole === 'admin'
          ? 'Admin capabilities: view student conversations, moderate messages, start chats with any student, broadcast announcements, create group discussions, pin topics.'
          : 'Student view: direct chat with admin, group discussions, and forum Q&A.'
      }`
    );
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation) return;
    try {
      const newMsg = await ChatService.sendMessage(
        selectedConversation.id,
        content,
        currentUserId,
        currentUserName,
        currentUserRole
      );
      setMessages((prev) => [...prev, newMsg]);

      // Update preview in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                lastMessage: content,
                lastMessageAt: newMsg.createdAt,
                lastSenderId: currentUserId,
                lastSenderRole: currentUserRole,
                unreadCountAdmin: currentUserRole === 'student' ? (c.unreadCountAdmin || 0) + 1 : c.unreadCountAdmin,
                unreadCountStudent: currentUserRole === 'admin' ? (c.unreadCountStudent || 0) + 1 : c.unreadCountStudent,
              }
            : c
        )
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not send message');
    }
  };

  const handleModerateMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    try {
      await ChatService.moderateMessage(selectedConversation.id, messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, message: '[Message deleted by Admin]', content: '[Message deleted by Admin]' }
            : m
        )
      );
    } catch {
      Alert.alert('Error', 'Failed to moderate message');
    }
  };

  const handleCreateTopic = async (
    title: string,
    content: string,
    category: ForumTopic['category']
  ) => {
    try {
      const newTopic = await ChatService.createForumTopic(title, content, category);
      setForumTopics((prev) => [newTopic, ...prev]);
      Alert.alert('Success', 'Discussion topic created successfully!');
    } catch {
      Alert.alert('Error', 'Failed to post topic');
    }
  };

  const handleAddReply = async (content: string) => {
    if (!selectedTopic) return;
    try {
      const newReply = await ChatService.replyToForumTopic(selectedTopic.id, content);
      const updatedTopic = {
        ...selectedTopic,
        replyCount: (selectedTopic.replyCount || 0) + 1,
        replies: [...(selectedTopic.replies || []), newReply],
      };
      setSelectedTopic(updatedTopic);
      setForumTopics((prev) =>
        prev.map((t) => (t.id === selectedTopic.id ? updatedTopic : t))
      );
    } catch {
      Alert.alert('Error', 'Failed to submit reply');
    }
  };

  const handleStartChatWithContact = async (targetUser: {
    id: string;
    fullName?: string;
    name?: string;
    role?: ChatRole;
    userType?: string;
    isOnline?: boolean;
  }) => {
    const conv = await ChatService.startPrivateConversation({
      id: targetUser.id,
      name: targetUser.fullName || targetUser.name || 'Contact',
      fullName: targetUser.fullName || targetUser.name || 'Contact',
      role: targetUser.role,
      userType: targetUser.userType,
      isOnline: targetUser.isOnline,
    });

    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    setShowRosterModal(false);
    setSelectedConversation(conv);
  };

  const handleBroadcastAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      Alert.alert('Required', 'Please enter title and announcement message.');
      return;
    }
    await ChatService.createForumTopic(
      `[ANNOUNCEMENT] ${announcementTitle.trim()}`,
      announcementMessage.trim(),
      'Announcements'
    );
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setShowAnnouncementModal(false);
    await fetchData();
    Alert.alert('Broadcast Sent', 'Announcement published to discussion forum!');
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      Alert.alert('Required', 'Please provide a group title.');
      return;
    }
    const newGroup = await ChatService.createGroupDiscussion(
      groupTitle.trim(),
      groupDescription.trim()
    );
    setConversations((prev) => [newGroup, ...prev]);
    setGroupTitle('');
    setGroupDescription('');
    setShowCreateGroupModal(false);
    setSelectedConversation(newGroup);
  };

  // Contacts combined list for the Roster/New Chat modal
  const combinedContacts = useMemo(() => {
    const adminItems = contactsList.adminsAndFaculty.map((a) => ({
      id: a.id,
      name: a.fullName,
      fullName: a.fullName,
      email: a.email || '',
      enrolledProgram: a.userType === 'FACULTY' ? 'Faculty Member' : 'Academic Administration',
      avatarLetter: (a.fullName || 'A').charAt(0).toUpperCase(),
      role: (a.userType === 'FACULTY' ? 'faculty' : 'admin') as ChatRole,
      userType: a.userType,
      isOnline: a.isOnline ?? true,
    }));

    const studentItems = (contactsList.classmates.length > 0
      ? contactsList.classmates.map((c) => ({
          id: c.id,
          name: c.fullName,
          fullName: c.fullName,
          email: c.email || '',
          enrolledProgram: 'Master of Divinity (M.Div)',
          avatarLetter: (c.fullName || 'S').charAt(0).toUpperCase(),
          role: 'student' as ChatRole,
          userType: 'STUDENT',
          isOnline: c.isOnline ?? true,
        }))
      : studentsRoster.map((s) => ({
          id: s.id,
          name: s.name || s.fullName || 'Student',
          fullName: s.fullName || s.name || 'Student',
          email: s.email || '',
          enrolledProgram: s.enrolledProgram || 'Master of Divinity (M.Div)',
          avatarLetter: (s.name || s.fullName || 'S').charAt(0).toUpperCase(),
          role: 'student' as ChatRole,
          userType: 'STUDENT',
          isOnline: s.isOnline ?? true,
        })));

    return currentUserRole === 'admin'
      ? studentItems
      : [...adminItems, ...studentItems];
  }, [contactsList, studentsRoster, currentUserRole]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.panelContainer}>
          {/* Top Main Navigation Header */}
          <View style={styles.topHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.appIconCircle}>
                <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.appTitle}>Discussion & Chat</Text>
                <View style={styles.roleRow}>
                  <View
                    style={[
                      styles.roleIndicatorDot,
                      currentUserRole === 'admin'
                        ? styles.roleDotAdmin
                        : styles.roleDotStudent,
                    ]}
                  />
                  <Text style={styles.roleSubtext}>
                    {currentUserRole === 'admin' ? 'Admin Mode' : 'Student View'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              {/* Role Switcher button */}
              <TouchableOpacity
                style={styles.roleToggleBtn}
                onPress={handleToggleRole}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={currentUserRole === 'admin' ? 'person' : 'shield-half'}
                  size={14}
                  color="#4F46E5"
                />
                <Text style={styles.roleToggleText}>
                  Switch to {currentUserRole === 'admin' ? 'Student' : 'Admin'}
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Admin Toolbar (Broadcast, Student Roster, New Group) */}
          {currentUserRole === 'admin' && (
            <View style={styles.adminToolbar}>
              <TouchableOpacity
                style={styles.adminActionPill}
                onPress={() => setShowAnnouncementModal(true)}
              >
                <Ionicons name="megaphone" size={13} color="#D97706" />
                <Text style={styles.adminActionText}>Broadcast</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminActionPill}
                onPress={() => setShowRosterModal(true)}
              >
                <Ionicons name="people" size={13} color="#4F46E5" />
                <Text style={styles.adminActionText}>Students ({studentsRoster.length})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminActionPill}
                onPress={() => setShowCreateGroupModal(true)}
              >
                <Ionicons name="add-circle" size={13} color="#059669" />
                <Text style={styles.adminActionText}>New Group</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tabs: Private Chat vs Discussion Forum */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'chat' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('chat');
                setSelectedTopic(null);
              }}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={16}
                color={activeTab === 'chat' ? '#4F46E5' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'chat' && styles.tabItemTextActive,
                ]}
              >
                Private Chat
              </Text>
              {totalUnreadCount > 0 && (
                <NotificationBadge count={totalUnreadCount} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'forum' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('forum');
                setSelectedConversation(null);
              }}
            >
              <Ionicons
                name="globe-outline"
                size={16}
                color={activeTab === 'forum' ? '#4F46E5' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'forum' && styles.tabItemTextActive,
                ]}
              >
                Discussion Forum
              </Text>
              <View style={styles.topicCountBadge}>
                <Text style={styles.topicCountText}>{forumTopics.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            {loading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>Loading conversations...</Text>
              </View>
            ) : activeTab === 'chat' ? (
              selectedConversation ? (
                <MessageWindow
                  conversation={selectedConversation}
                  messages={messages}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  currentUser={currentUser || undefined}
                  onSendMessage={handleSendMessage}
                  onBack={() => setSelectedConversation(null)}
                  onModerateMessage={
                    currentUserRole === 'admin' ? handleModerateMessage : undefined
                  }
                />
              ) : (
                <ConversationList
                  conversations={conversations}
                  activeConversationId={undefined}
                  onSelectConversation={(conv) => setSelectedConversation(conv)}
                  onStartNewChat={() => setShowRosterModal(true)}
                  currentUserRole={currentUserRole}
                  onRefresh={fetchData}
                  refreshing={refreshing}
                />
              )
            ) : selectedTopic ? (
              <DiscussionDetails
                topic={selectedTopic}
                currentUserRole={currentUserRole}
                onBack={() => setSelectedTopic(null)}
                onAddReply={handleAddReply}
              />
            ) : (
              <DiscussionList
                topics={forumTopics}
                onSelectTopic={(t) => setSelectedTopic(t)}
                onCreateTopic={handleCreateTopic}
                currentUserRole={currentUserRole}
                onRefresh={fetchData}
                refreshing={refreshing}
              />
            )}
          </View>
        </View>

        {/* Modal: Registered Students / Contacts Roster */}
        <Modal
          visible={showRosterModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowRosterModal(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={styles.subModalContent}>
              <View style={styles.subModalHeader}>
                <Text style={styles.subModalTitle}>
                  {currentUserRole === 'admin' ? 'Registered Students Roster' : 'Start Direct Conversation'}
                </Text>
                <TouchableOpacity onPress={() => setShowRosterModal(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.rosterSearchBox}>
                <Ionicons name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.rosterSearchInput}
                  placeholder={
                    currentUserRole === 'admin'
                      ? 'Search students by name, email, program...'
                      : 'Search admin, faculty, peers...'
                  }
                  placeholderTextColor="#94A3B8"
                  value={rosterSearch}
                  onChangeText={setRosterSearch}
                />
              </View>

              <FlatList
                data={combinedContacts.filter(
                  (s) =>
                    (s.name || s.fullName || '').toLowerCase().includes(rosterSearch.toLowerCase()) ||
                    (s.email || '').toLowerCase().includes(rosterSearch.toLowerCase()) ||
                    (s.enrolledProgram || '').toLowerCase().includes(rosterSearch.toLowerCase())
                )}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isAdmin =
                    item.role === 'admin' ||
                    item.userType === 'ORG_USER' ||
                    item.userType === 'SUPER_ADMIN';
                  const isFaculty = item.role === 'faculty' || item.userType === 'FACULTY';

                  return (
                    <TouchableOpacity
                      style={styles.rosterItem}
                      onPress={() => handleStartChatWithContact(item)}
                    >
                      <View
                        style={[
                          styles.rosterAvatar,
                          isAdmin
                            ? styles.rosterAvatarAdmin
                            : isFaculty
                            ? styles.rosterAvatarFaculty
                            : styles.rosterAvatarStudent,
                        ]}
                      >
                        {isAdmin ? (
                          <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                        ) : isFaculty ? (
                          <Ionicons name="school" size={16} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.rosterAvatarLetter}>{item.avatarLetter}</Text>
                        )}
                        {item.isOnline && <View style={styles.rosterOnlineDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.rosterName}>{item.name}</Text>
                          <View
                            style={[
                              styles.rosterRoleBadge,
                              isAdmin
                                ? styles.rosterBadgeAdmin
                                : isFaculty
                                ? styles.rosterBadgeFaculty
                                : styles.rosterBadgeStudent,
                            ]}
                          >
                            <Text style={styles.rosterRoleBadgeText}>
                              {isAdmin ? 'ADMIN' : isFaculty ? 'FACULTY' : 'STUDENT'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.rosterEmail}>{item.email}</Text>
                        {item.enrolledProgram ? (
                          <Text style={styles.rosterProgram}>{item.enrolledProgram}</Text>
                        ) : null}
                      </View>
                      <Ionicons name="chatbubble-outline" size={18} color="#4F46E5" />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8' }}>No contacts found.</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>

        {/* Modal: Broadcast Announcement */}
        <Modal
          visible={showAnnouncementModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowAnnouncementModal(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={styles.subModalContent}>
              <View style={styles.subModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="megaphone" size={18} color="#D97706" />
                  <Text style={styles.subModalTitle}>Broadcast Announcement</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 16 }}>
                <Text style={styles.inputLabel}>Announcement Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Schedule Update for Finals"
                  placeholderTextColor="#94A3B8"
                  value={announcementTitle}
                  onChangeText={setAnnouncementTitle}
                />

                <Text style={styles.inputLabel}>Announcement Message *</Text>
                <TextInput
                  style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="This message will be broadcast to all students in discussion forum & group chat..."
                  placeholderTextColor="#94A3B8"
                  value={announcementMessage}
                  onChangeText={setAnnouncementMessage}
                  multiline
                />

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleBroadcastAnnouncement}
                >
                  <Text style={styles.primaryBtnText}>Send Announcement to All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Create Group Discussion */}
        <Modal
          visible={showCreateGroupModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowCreateGroupModal(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={styles.subModalContent}>
              <View style={styles.subModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people" size={18} color="#4F46E5" />
                  <Text style={styles.subModalTitle}>Create Group Discussion</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 16 }}>
                <Text style={styles.inputLabel}>Group Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. M.Div Cohort 2026 Discussion"
                  placeholderTextColor="#94A3B8"
                  value={groupTitle}
                  onChangeText={setGroupTitle}
                />

                <Text style={styles.inputLabel}>Description / Welcome Message</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Welcome members and outline discussion topics..."
                  placeholderTextColor="#94A3B8"
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup}>
                  <Text style={styles.primaryBtnText}>Create Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  panelContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: Platform.OS === 'web' ? '92%' : '88%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  roleIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleDotAdmin: {
    backgroundColor: '#4F46E5',
  },
  roleDotStudent: {
    backgroundColor: '#10B981',
  },
  roleSubtext: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  closeBtn: {
    padding: 4,
  },
  adminToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  adminActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  adminActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#4F46E5',
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  topicCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  topicCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 10,
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  subModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  rosterSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  rosterSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  rosterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  rosterAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rosterAvatarAdmin: {
    backgroundColor: '#7C3AED',
  },
  rosterAvatarFaculty: {
    backgroundColor: '#2563EB',
  },
  rosterAvatarStudent: {
    backgroundColor: '#059669',
  },
  rosterRoleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  rosterBadgeAdmin: {
    backgroundColor: '#7C3AED',
  },
  rosterBadgeFaculty: {
    backgroundColor: '#2563EB',
  },
  rosterBadgeStudent: {
    backgroundColor: '#059669',
  },
  rosterRoleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rosterAvatarLetter: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rosterOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  rosterEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  rosterProgram: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#0F172A',
  },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
