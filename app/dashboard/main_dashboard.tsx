import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthStorage } from '../../src/services/authStorage';
import { DashboardService } from '../../src/services/dashboardService';
import { useTheme } from '../../src/context/ThemeContext';

const COLORS = {
  bg: '#F5F6FB',
  card: '#FFFFFF',
  border: '#E5E7F0',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#4F46E5',
  primarySoft: '#EEF0FF',
  green: '#059669',
  greenSoft: '#DCF5EC',
  blue: '#0284C7',
  blueSoft: '#E0F2FE',
  purple: '#6366F1',
  danger: '#E11D48',
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/* ----------------------------- Header ----------------------------- */

interface CircleButtonProps {
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  badge?: number | string;
  onPress?: () => void;
  isDarkMode?: boolean;
}

const CircleButton: React.FC<CircleButtonProps> = ({
  icon,
  color,
  badge,
  onPress,
  isDarkMode,
}) => (
  <TouchableOpacity
    style={[styles.circleBtn, isDarkMode && { backgroundColor: '#1E293B' }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Feather name={icon} size={18} color={color || (isDarkMode ? '#F8FAFC' : COLORS.text)} />
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

interface HeaderProps {
  userName?: string;
  role?: string;
  onMenuPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userName, onMenuPress }) => {
  const { isDarkMode } = useTheme();
  return (
    <View
      style={[
        styles.header,
        isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' },
      ]}
    >
      <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
        <Feather name="menu" size={22} color={isDarkMode ? '#F8FAFC' : COLORS.text} />
      </TouchableOpacity>

      <View style={styles.headerRight}>
        <CircleButton
          icon="video"
          isDarkMode={isDarkMode}
          onPress={() => router.push('/(student-tabs)/dashboard')}
        />
        <CircleButton
          icon="message-square"
          isDarkMode={isDarkMode}
          onPress={() => router.push('/(student-tabs)/dashboard')}
        />
        <CircleButton icon="bell" badge={2} isDarkMode={isDarkMode} />

        <TouchableOpacity
          style={styles.profile}
          activeOpacity={0.8}
          onPress={() => router.push('/(student-tabs)/profile')}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName?.[0]?.toUpperCase() || 'U'}</Text>
            <View
              style={[styles.onlineDot, isDarkMode && { borderColor: '#111827' }]}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* --------------------------- Stat card ---------------------------- */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
  soft: string;
  width: number;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  accent,
  soft,
  width,
}) => {
  const { isDarkMode } = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        { width, borderLeftColor: accent },
        isDarkMode && { backgroundColor: '#161F30', shadowOpacity: 0.25 },
      ]}
    >
      <View style={styles.statTop}>
        <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>{label}</Text>
        <View style={[styles.statIcon, { backgroundColor: soft }]}>
          <Feather name={icon} size={16} color={accent} />
        </View>
      </View>
      <Text style={[styles.statValue, isDarkMode && { color: '#F8FAFC' }]}>{value}</Text>
    </View>
  );
};

/* --------------------------- Dashboard ---------------------------- */

export interface ProgramData {
  id: string;
  title: string;
}

export interface UserData {
  name: string;
  role: string;
}

export interface StatsData {
  enrolled: number;
  inProgress: number;
  completed: number;
  avgProgress: number;
}

export interface DashboardScreenProps {
  navigation?: {
    navigate?: (route: string) => void;
    openDrawer?: () => void;
  };
  user?: UserData;
  stats?: StatsData;
  programs?: ProgramData[];
}

export default function DashboardScreen({
  navigation,
  user = { name: 'Student', role: 'STUDENT' },
  stats = { enrolled: 0, inProgress: 0, completed: 0, avgProgress: 0 },
  programs = [],
}: DashboardScreenProps) {
  const { width } = useWindowDimensions();
  const { isDarkMode } = useTheme();
  const [currentUser, setCurrentUser] = useState<UserData>(user);
  const [currentStats, setCurrentStats] = useState<StatsData>(stats);
  const [currentPrograms, setCurrentPrograms] = useState<ProgramData[]>(programs);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AuthStorage.getUser();
        if (stored?.fullName) {
          setCurrentUser({
            name: stored.fullName,
            role: stored.role || 'STUDENT',
          });
        }
        const studentId = stored?.id || 'me';
        const [enrRes, progRes] = await Promise.all([
          DashboardService.getStudentEnrollments(studentId),
          DashboardService.getStudentPrograms(studentId),
        ]);
        if (enrRes.data && enrRes.data.length > 0) {
          const compStats = DashboardService.computeDashboardStats(enrRes.data);
          setCurrentStats(compStats);
        }
        if (progRes.data && progRes.data.length > 0) {
          setCurrentPrograms(
            progRes.data.map((p) => ({
              id: p.id,
              title: p.program?.name || 'Academic Degree Program',
            }))
          );
        }
      } catch (e) {
        console.warn('Failed to load user profile in DashboardScreen:', e);
      }
    })();
  }, []);

  const PAD = 20;
  const GAP = 12;
  const cardWidth = (width - PAD * 2 - GAP) / 2;

  const goToProgram = () => {
    if (navigation?.navigate) {
      navigation.navigate('MyProgram');
    } else {
      router.push('/(student-tabs)/courses');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, isDarkMode && { backgroundColor: '#111827' }]} edges={['top']}>
      <Header
        userName={currentUser.name}
        role={currentUser.role}
        onMenuPress={() => {
          if (navigation?.openDrawer) {
            navigation.openDrawer();
          } else {
            router.push('/(student-tabs)/dashboard');
          }
        }}
      />

      <ScrollView
        style={[styles.scroll, isDarkMode && { backgroundColor: '#0B0F19' }]}
        contentContainerStyle={{ padding: PAD, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View
          style={[
            styles.welcomePill,
            isDarkMode && { backgroundColor: '#1E1B4B', borderColor: '#312E81' },
          ]}
        >
          <Text style={[styles.welcomePillText, isDarkMode && { color: '#818CF8' }]}>WELCOME BACK</Text>
        </View>

        <View style={styles.welcomeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, isDarkMode && { color: '#F8FAFC' }]}>Hi {currentUser.name} 👋</Text>
            <Text style={[styles.subtitle, isDarkMode && { color: '#94A3B8' }]}>Pick up where you left off.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={goToProgram} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>My Program</Text>
        </TouchableOpacity>

        {/* Stats */}
        <View style={[styles.statsGrid, { gap: GAP }]}>
          <StatCard
            label="ENROLLED COURSES"
            value={currentStats.enrolled}
            icon="book"
            accent={COLORS.purple}
            soft={COLORS.primarySoft}
            width={cardWidth}
          />
          <StatCard
            label="IN PROGRESS"
            value={currentStats.inProgress}
            icon="play-circle"
            accent={COLORS.purple}
            soft={COLORS.primarySoft}
            width={cardWidth}
          />
          <StatCard
            label="COMPLETED"
            value={currentStats.completed}
            icon="award"
            accent={COLORS.green}
            soft={COLORS.greenSoft}
            width={cardWidth}
          />
          <StatCard
            label="AVG. PROGRESS"
            value={`${currentStats.avgProgress}%`}
            icon="trending-up"
            accent={COLORS.blue}
            soft={COLORS.blueSoft}
            width={cardWidth}
          />
        </View>

        {/* My Programs */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBar} />
          <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>My Programs</Text>
        </View>

        {currentPrograms.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              isDarkMode && { backgroundColor: '#161F30', borderColor: '#334155' },
            ]}
          >
            <View style={[styles.emptyIcon, isDarkMode && { backgroundColor: '#1E1B4B' }]}>
              <Feather name="book-open" size={30} color={COLORS.primary} />
            </View>
            <Text style={[styles.emptyTitle, isDarkMode && { color: '#F8FAFC' }]}>No programs</Text>
            <Text style={[styles.emptySub, isDarkMode && { color: '#94A3B8' }]}>
              You are not enrolled in any programs.
            </Text>
          </View>
        ) : (
          currentPrograms.map((p) => (
            <View
              key={p.id}
              style={[
                styles.programCard,
                isDarkMode && { backgroundColor: '#161F30', borderWidth: 1, borderColor: '#1F2937' },
              ]}
            >
              <Text style={[styles.programTitle, isDarkMode && { color: '#F8FAFC' }]}>{p.title}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating chat button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(student-tabs)/dashboard')}
      >
        <Feather name="message-square" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* ------------------------ Drawer (sidebar) ------------------------ */

interface NavItem {
  name: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: 'grid', route: 'Dashboard' },
  { name: 'My Program', icon: 'book-open', route: 'MyProgram' },
  { name: 'My Courses', icon: 'book', route: 'MyCourses' },
  { name: 'Results', icon: 'file-text', route: 'Results' },
  { name: 'Certificates', icon: 'award', route: 'Certificates' },
  { name: 'Payments', icon: 'dollar-sign', route: 'Payments' },
  { name: 'Notifications', icon: 'bell', route: 'Notifications' },
  { name: 'Profile', icon: 'user', route: 'Profile' },
];

export interface SidebarContentProps {
  navigation?: {
    navigate?: (route: string) => void;
  };
  state?: {
    index: number;
    routeNames?: string[];
  };
}

export const SidebarContent: React.FC<SidebarContentProps> = ({ navigation, state }) => {
  const activeRoute = state?.routeNames?.[state.index];
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={drawer.container}>
      <View style={drawer.brand}>
        <View style={drawer.logo} />
        <View>
          <Text style={drawer.brandName}>Cotr Global Online</Text>
          <View style={drawer.rolePill}>
            <Text style={drawer.roleText}>STUDENT</Text>
          </View>
        </View>
      </View>

      <View style={drawer.divider} />

      {NAV_ITEMS.map((item) => {
        const active = activeRoute === item.route;
        return (
          <TouchableOpacity
            key={item.route}
            style={[drawer.item, active && drawer.itemActive]}
            onPress={() => navigation?.navigate?.(item.route)}
            activeOpacity={0.8}
          >
            {active && <View style={drawer.activeBar} />}
            <Feather name={item.icon} size={20} color={active ? '#38BDF8' : '#CBD5E1'} />
            <Text style={[drawer.itemText, active && { color: '#38BDF8', fontWeight: '700' }]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={[drawer.item, { justifyContent: 'space-between', marginTop: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Feather name={isDarkMode ? 'sun' : 'moon'} size={20} color="#CBD5E1" />
          <Text style={drawer.itemText}>Dark Mode</Text>
        </View>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          trackColor={{ false: '#334155', true: '#4F46E5' }}
          thumbColor={isDarkMode ? '#F8FAFC' : '#CBD5E1'}
        />
      </View>
    </SafeAreaView>
  );
};

/* ----------------------------- Styles ----------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.card },
  scroll: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  menuBtn: { padding: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  profile: { marginLeft: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Welcome
  welcomePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#DCDFFB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  welcomePillText: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primary,
    fontWeight: '700',
  },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.8 },
  subtitle: { marginTop: 4, fontSize: 15, color: COLORS.muted },
  primaryBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24 },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderLeftWidth: 4,
    padding: 16,
    minHeight: 112,
    justifyContent: 'space-between',
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statLabel: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.muted,
    fontWeight: '600',
    paddingRight: 6,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 30, fontWeight: '800', color: COLORS.text, marginTop: 10 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 14 },
  sectionBar: { width: 4, height: 24, borderRadius: 2, backgroundColor: '#7C3AED', marginRight: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptySub: { marginTop: 6, fontSize: 14, color: COLORS.muted, textAlign: 'center' },

  programCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  programTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});

const drawer = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1224', paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#B45309',
  },
  brandName: { color: '#fff', fontWeight: '800', fontSize: 16 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#1E2A5A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  roleText: { color: '#6366F1', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#1E293B', marginBottom: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 4,
    overflow: 'hidden',
  },
  itemActive: { backgroundColor: '#0F1C3A', borderWidth: 1, borderColor: '#1E293B' },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  itemText: { color: '#CBD5E1', fontSize: 16 },
});
