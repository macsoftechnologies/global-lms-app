import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatConversation, ChatRole } from '../../types/chat';
import { NotificationBadge } from './NotificationBadge';

type FilterCategory = 'ALL' | 'STAFF' | 'DIRECT' | 'SUBJECTS' | 'BATCHES';

interface ConversationListProps {
  conversations: ChatConversation[];
  activeConversationId?: string;
  onSelectConversation: (conversation: ChatConversation) => void;
  onStartNewChat?: () => void;
  currentUserRole: ChatRole;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onStartNewChat,
  currentUserRole,
  onRefresh,
  refreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Category filter matching website g9 Pe
      if (activeCategory === 'SUBJECTS' && !c.isCourse) {
        return false;
      }
      if (activeCategory === 'BATCHES' && !c.isBatch) {
        return false;
      }
      if (activeCategory === 'DIRECT') {
        const isPartnerStaff =
          c.partner?.userType === 'ORG_USER' ||
          c.partner?.userType === 'SUPER_ADMIN' ||
          c.partner?.userType === 'FACULTY';
        if (c.isGroup || isPartnerStaff) return false;
      }
      if (activeCategory === 'STAFF') {
        const isPartnerStudent = c.partner?.userType === 'STUDENT';
        if (c.isGroup || isPartnerStudent) return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchMsg = (c.lastMessage || '').toLowerCase().includes(q);
      const matchPartner = (c.partner?.fullName || c.partner?.name || '').toLowerCase().includes(q);
      const matchParticipant = c.participants.some((p) => (p.name || '').toLowerCase().includes(q));
      return matchTitle || matchMsg || matchPartner || matchParticipant;
    });
  }, [conversations, activeCategory, searchQuery]);

  const renderRoleBadge = (item: ChatConversation) => {
    if (item.isGroup) {
      if (item.isCourse) {
        return (
          <View style={[styles.roleBadge, styles.roleBadgeSubject]}>
            <Text style={styles.roleBadgeText}>SUBJECT</Text>
          </View>
        );
      }
      if (item.isBatch) {
        return (
          <View style={[styles.roleBadge, styles.roleBadgeBatch]}>
            <Text style={styles.roleBadgeText}>BATCH</Text>
          </View>
        );
      }
      return (
        <View style={[styles.roleBadge, styles.roleBadgeGroup]}>
          <Text style={styles.roleBadgeText}>GROUP</Text>
        </View>
      );
    }

    const partnerType = item.partner?.userType || (currentUserRole === 'admin' ? 'STUDENT' : 'ORG_USER');
    if (partnerType === 'ORG_USER' || partnerType === 'SUPER_ADMIN') {
      return (
        <View style={[styles.roleBadge, styles.roleBadgeAdmin]}>
          <Text style={styles.roleBadgeText}>ADMIN</Text>
        </View>
      );
    }
    if (partnerType === 'FACULTY') {
      return (
        <View style={[styles.roleBadge, styles.roleBadgeFaculty]}>
          <Text style={styles.roleBadgeText}>FACULTY</Text>
        </View>
      );
    }
    return (
      <View style={[styles.roleBadge, styles.roleBadgeStudent]}>
        <Text style={styles.roleBadgeText}>STUDENT</Text>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: ChatConversation }) => {
    const isSelected = item.id === activeConversationId;
    const isGroup = item.isGroup || item.type === 'group';

    const displayTitle = item.partner?.fullName || item.partner?.name || item.title;
    const isOnline = item.partner?.isOnline ?? true;

    const partnerType = item.partner?.userType || (currentUserRole === 'admin' ? 'STUDENT' : 'ORG_USER');
    const isAdminDirect = !isGroup && (partnerType === 'ORG_USER' || partnerType === 'SUPER_ADMIN');

    const displayUnread =
      currentUserRole === 'admin'
        ? item.unreadCountAdmin ?? item.unreadCount ?? 0
        : item.unreadCountStudent ?? item.unreadCount ?? 0;

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          isSelected && styles.itemSelected,
          item.pinned && styles.itemPinned,
        ]}
        onPress={() => onSelectConversation(item)}
        activeOpacity={0.7}
      >
        {/* Avatar with Status Dot */}
        <View style={styles.avatarWrapper}>
          <View
            style={[
              styles.avatarBox,
              isGroup
                ? styles.avatarGroup
                : isAdminDirect
                ? styles.avatarAdmin
                : styles.avatarStudent,
            ]}
          >
            {isGroup ? (
              <Ionicons name="people" size={18} color="#FFFFFF" />
            ) : isAdminDirect ? (
              <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
            ) : (
              <Text style={styles.avatarLetter}>
                {(displayTitle || 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          {isOnline && <View style={styles.onlineBadge} />}
        </View>

        {/* Content Details */}
        <View style={styles.contentWrapper}>
          <View style={styles.topRow}>
            <View style={styles.titleRow}>
              {item.pinned && (
                <Ionicons name="pin" size={13} color="#F59E0B" style={styles.pinnedIcon} />
              )}
              <Text style={styles.titleText} numberOfLines={1}>
                {displayTitle}
              </Text>
              {renderRoleBadge(item)}
            </View>
            <Text style={styles.timeText}>{item.lastMessageAt}</Text>
          </View>

          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.messageSnippet,
                displayUnread > 0 && styles.messageSnippetUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {displayUnread > 0 && (
              <NotificationBadge count={displayUnread} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const categories: { id: FilterCategory; label: string; icon: string }[] = [
    { id: 'ALL', label: 'All', icon: 'chatbubbles-outline' },
    { id: 'STAFF', label: 'Admins', icon: 'shield-outline' },
    { id: 'DIRECT', label: 'Peers', icon: 'person-outline' },
    { id: 'SUBJECTS', label: 'Subjects', icon: 'book-outline' },
    { id: 'BATCHES', label: 'Batches', icon: 'people-outline' },
  ];

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations, admins, students..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {onStartNewChat && (
          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={onStartNewChat}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.newChatBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills matching Website Filter Tabs */}
      <View style={styles.categoriesContainer}>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4F46E5']}
              tintColor="#4F46E5"
            />
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a direct conversation with Academic Admin or fellow students.
            </Text>
            {onStartNewChat && (
              <TouchableOpacity style={styles.emptyBtn} onPress={onStartNewChat}>
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Start Direct Conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  newChatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  categoryPillActive: {
    backgroundColor: '#4F46E5',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    flexGrow: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemSelected: {
    backgroundColor: '#EEF2FF',
  },
  itemPinned: {
    backgroundColor: '#FDFCF7',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarAdmin: {
    backgroundColor: '#7C3AED',
  },
  avatarStudent: {
    backgroundColor: '#059669',
  },
  avatarGroup: {
    backgroundColor: '#3B82F6',
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  pinnedIcon: {
    marginRight: 2,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 7,
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
  roleBadgeSubject: {
    backgroundColor: '#D97706',
  },
  roleBadgeBatch: {
    backgroundColor: '#0284C7',
  },
  roleBadgeGroup: {
    backgroundColor: '#475569',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageSnippet: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    marginRight: 8,
  },
  messageSnippetUnread: {
    color: '#0F172A',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
