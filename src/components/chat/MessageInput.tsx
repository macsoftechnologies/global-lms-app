import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onTyping?: (isTyping: boolean) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  placeholder = 'Type a message...',
  disabled = false,
  onTyping,
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setText('');
    if (onTyping) onTyping(false);
  };

  const handleChangeText = (val: string) => {
    setText(val);
    if (onTyping) {
      onTyping(val.length > 0);
    }
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === 'web' && e.nativeEvent?.key === 'Enter') {
      const nativeEvent = e.nativeEvent as unknown as { shiftKey?: boolean };
      if (!nativeEvent.shiftKey) {
        handleSend();
      }
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={text}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          multiline
          maxLength={1000}
          editable={!disabled}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.sendButton,
          hasText && !disabled ? styles.sendButtonActive : styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!hasText || disabled}
        activeOpacity={0.8}
      >
        <Ionicons
          name="send"
          size={17}
          color={hasText && !disabled ? '#FFFFFF' : '#94A3B8'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 13.5,
    color: '#0F172A',
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
});

export default MessageInput;
