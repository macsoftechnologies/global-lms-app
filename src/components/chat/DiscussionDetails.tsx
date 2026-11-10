import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ForumTopic, ForumReply, ChatRole } from '../../types/chat';
import { MessageInput } from './MessageInput';

interface DiscussionDetailsProps {
  topic: ForumTopic;
  currentUserRole: ChatRole;
  onBack: () => void;
  onAddReply: (content: string) => void;
  onTogglePin?: (topicId: string) => void;
  onDeleteTopic?: (topicId: string) => void;
}

export const DiscussionDetails: React.FC<DiscussionDetailsProps> = ({
  topic,
  currentUserRole,
  onBack,
  onAddReply,
  onTogglePin,
  onDeleteTopic,
}) => {
  const isAdmin = currentUserRole === 'admin';
  const isTopicAuthorAdmin = topic.authorRole === 'admin';

  const handleDelete = () => {
    if (!onDeleteTopic) return;
    Alert.alert(
      'Delete Discussion',
      'Are you sure you want to delete this discussion topic and all its replies? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteTopic(topic.id),
        },
      ]
    );
  };

  const renderReplyItem = ({ item }: { item: ForumReply }) => {
    const isReplyAdmin = item.authorRole === 'admin';

    return (
      <View style={styles.replyCard}>
        <View style={styles.replyHeader}>
          <View
            style={[
              styles.avatarSmall,
              isReplyAdmin ? styles.avatarAdmin : styles.avatarStudent,
            ]}
          >
            {isReplyAdmin ? (
              <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
            ) : (
              <Text style={styles.avatarLetterSmall}>
                {(item.authorName || 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.replyAuthorName}>{item.authorName}</Text>
              <View
                style={[
                  styles.roleTag,
                  isReplyAdmin ? styles.roleTagAdmin : styles.roleTagStudent,
                ]}
              >
                <Text
                  style={[
                    styles.roleTagText,
                    isReplyAdmin ? styles.roleTagTextAdmin : styles.roleTagTextStudent,
                  ]}
                >
                  {isReplyAdmin ? 'ADMIN' : 'STUDENT'}
                </Text>
              </View>
            </View>
            <Text style={styles.replyTimeText}>{item.createdAt}</Text>
          </View>
        </View>

        <Text style={styles.replyContent}>{item.content}</Text>
      </View>
    );
  };

  const renderTopicHeader = () => (
    <View style={styles.topicHeaderContainer}>
      {/* Category & Status */}
      <View style={styles.metaRow}>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipText}>{topic.category}</Text>
        </View>
        {topic.isPinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={12} color="#D97706" />
            <Text style={styles.pinnedBadgeText}>Pinned</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.topicTitle}>{topic.title}</Text>

      {/* Author Details */}
      <View style={styles.authorRow}>
        <View
          style={[
            styles.avatarBox,
            isTopicAuthorAdmin ? styles.avatarAdmin : styles.avatarStudent,
          ]}
        >
          {isTopicAuthorAdmin ? (
            <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
          ) : (
            <Text style={styles.avatarLetter}>
              {(topic.authorName || 'U').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.authorName}>{topic.authorName}</Text>
            <View
              style={[
                styles.roleTag,
                isTopicAuthorAdmin ? styles.roleTagAdmin : styles.roleTagStudent,
              ]}
            >
              <Text
                style={[
                  styles.roleTagText,
                  isTopicAuthorAdmin ? styles.roleTagTextAdmin : styles.roleTagTextStudent,
                ]}
              >
                {isTopicAuthorAdmin ? 'ADMIN' : 'STUDENT'}
              </Text>
            </View>
          </View>
          <Text style={styles.dateText}>{topic.createdAt}</Text>
        </View>
      </View>

      {/* Full Content */}
      <Text style={styles.topicContent}>{topic.content}</Text>

      {/* Divider with replies count */}
      <View style={styles.repliesDivider}>
        <Text style={styles.repliesCountText}>
          Replies ({topic.replies?.length || 0})
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle} numberOfLines={1}>
          Discussion Thread
        </Text>

        {/* Admin Actions */}
        {isAdmin && (
          <View style={styles.adminActionRow}>
            {onTogglePin && (
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => onTogglePin(topic.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={topic.isPinned ? 'pin' : 'pin-outline'}
                  size={18}
                  color={topic.isPinned ? '#D97706' : '#64748B'}
                />
              </TouchableOpacity>
            )}
            {onDeleteTopic && (
              <TouchableOpacity
                style={[styles.actionIconBtn, styles.deleteBtn]}
                onPress={handleDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Content & Threaded Replies */}
      <FlatList
        data={topic.replies || []}
        keyExtractor={(item) => item.id}
        renderItem={renderReplyItem}
        ListHeaderComponent={renderTopicHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyReplies}>
            <Ionicons name="chatbubble-outline" size={32} color="#CBD5E1" />
            <Text style={styles.emptyRepliesText}>No replies yet</Text>
            <Text style={styles.emptyRepliesSubtext}>
              Be the first to share your perspective or answer.
            </Text>
          </View>
        }
      />

      {/* Reply Input */}
      <MessageInput
        onSendMessage={onAddReply}
        placeholder="Write a helpful reply..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  backButton: {
    padding: 4,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  listContent: {
    paddingBottom: 16,
  },
  topicHeaderContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryChipText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '700',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pinnedBadgeText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: {
    backgroundColor: '#4F46E5',
  },
  avatarStudent: {
    backgroundColor: '#0EA5E9',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authorName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  roleTagAdmin: {
    backgroundColor: '#EEF2FF',
  },
  roleTagStudent: {
    backgroundColor: '#E0F2FE',
  },
  roleTagText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  roleTagTextAdmin: {
    color: '#4F46E5',
  },
  roleTagTextStudent: {
    color: '#0284C7',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  topicContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 16,
  },
  repliesDivider: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  repliesCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  replyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetterSmall: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  replyAuthorName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  replyTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  replyContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  emptyReplies: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyRepliesText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyRepliesSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export default DiscussionDetails;

