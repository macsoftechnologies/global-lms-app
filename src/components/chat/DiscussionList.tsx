import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ForumTopic, ChatRole } from '../../types/chat';

interface DiscussionListProps {
  topics: ForumTopic[];
  onSelectTopic: (topic: ForumTopic) => void;
  onCreateTopic: (
    title: string,
    content: string,
    category: ForumTopic['category']
  ) => void;
  currentUserRole: ChatRole;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const CATEGORIES: ('All' | ForumTopic['category'])[] = [
  'All',
  'Announcements',
  'General',
  'Assignments',
  'Exams',
  'Curriculum',
  'Q&A',
];

export const DiscussionList: React.FC<DiscussionListProps> = ({
  topics,
  onSelectTopic,
  onCreateTopic,
  currentUserRole,
  onRefresh,
  refreshing = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Topic Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<ForumTopic['category']>('General');

  const filteredTopics = topics.filter((t) => {
    if (selectedCategory !== 'All' && t.category !== selectedCategory) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q) ||
      t.authorName.toLowerCase().includes(q)
    );
  });

  const handlePostTopic = () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a discussion title.');
      return;
    }
    if (!newContent.trim()) {
      Alert.alert('Required', 'Please provide discussion details or question.');
      return;
    }

    onCreateTopic(newTitle.trim(), newContent.trim(), newCategory);
    setNewTitle('');
    setNewContent('');
    setNewCategory('General');
    setShowCreateModal(false);
  };

  const renderTopicItem = ({ item }: { item: ForumTopic }) => {
    const isAdmin = item.authorRole === 'admin';

    return (
      <TouchableOpacity
        style={[styles.card, item.isPinned && styles.cardPinned]}
        onPress={() => onSelectTopic(item)}
        activeOpacity={0.7}
      >
        {item.isPinned && (
          <View style={styles.pinnedHeader}>
            <Ionicons name="pin" size={13} color="#D97706" />
            <Text style={styles.pinnedHeaderText}>Pinned Discussion</Text>
          </View>
        )}

        <View style={styles.authorRow}>
          <View style={[styles.avatarBox, isAdmin ? styles.avatarAdmin : styles.avatarStudent]}>
            {isAdmin ? (
              <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
            ) : (
              <Text style={styles.avatarLetter}>
                {(item.authorName || 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.authorName}>{item.authorName}</Text>
              <View style={[styles.roleTag, isAdmin ? styles.roleTagAdmin : styles.roleTagStudent]}>
                <Text style={[styles.roleTagText, isAdmin ? styles.roleTagTextAdmin : styles.roleTagTextStudent]}>
                  {isAdmin ? 'ADMIN' : 'STUDENT'}
                </Text>
              </View>
            </View>
            <Text style={styles.dateText}>{item.createdAt}</Text>
          </View>

          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{item.category}</Text>
          </View>
        </View>

        <Text style={styles.topicTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.topicContent} numberOfLines={2}>
          {item.content}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color="#64748B" />
            <Text style={styles.statText}>
              {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </View>

          {item.likesCount !== undefined && (
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={15} color="#EF4444" />
              <Text style={styles.statText}>{item.likesCount}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />
          <Text style={styles.viewThreadText}>View Discussion →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Search & Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search discussions, topics, questions..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.newTopicBtn}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newTopicBtnText}>New Topic</Text>
        </TouchableOpacity>
      </View>

      {/* Categories Horizontal Scroll */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryTab,
                selectedCategory === cat && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === cat && styles.categoryTabTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Discussion List */}
      <FlatList
        data={filteredTopics}
        keyExtractor={(item) => item.id}
        renderItem={renderTopicItem}
        contentContainerStyle={styles.listContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Discussions Found</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to start a discussion or question in this category.
            </Text>
          </View>
        }
      />

      {/* Modal: Create New Discussion */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="chatbubbles" size={18} color="#4F46E5" />
                </View>
                <Text style={styles.modalTitle}>Start New Discussion</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="What is your topic or question?"
                placeholderTextColor="#94A3B8"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categorySelectRow}>
                {(['General', 'Assignments', 'Exams', 'Announcements', 'Curriculum', 'Q&A'] as ForumTopic['category'][]).map(
                  (cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catPill,
                        newCategory === cat && styles.catPillActive,
                      ]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          newCategory === cat && styles.catPillTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <Text style={styles.inputLabel}>Description / Details *</Text>
              <TextInput
                style={[styles.modalTextInput, styles.modalTextArea]}
                placeholder="Share full details, code, context or questions..."
                placeholderTextColor="#94A3B8"
                value={newContent}
                onChangeText={setNewContent}
                multiline
                numberOfLines={5}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handlePostTopic}
              >
                <Text style={styles.modalSubmitText}>Post Discussion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  newTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    gap: 4,
  },
  newTopicBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoriesScroll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  categoryTabActive: {
    backgroundColor: '#EEF2FF',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPinned: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFDF5',
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  pinnedHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontSize: 13,
    fontWeight: '700',
  },
  authorName: {
    fontSize: 13,
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
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  categoryChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryChipText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 21,
    marginBottom: 6,
  },
  topicContent: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    gap: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  viewThreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categorySelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  catPillActive: {
    backgroundColor: '#4F46E5',
  },
  catPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default DiscussionList;

