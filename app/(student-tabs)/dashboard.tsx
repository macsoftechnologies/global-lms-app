import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Modal,
  Alert,
  RefreshControl,
  Linking,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import { LmsAuthService } from '../../src/services/lmsAuthService';
import { DashboardService } from '../../src/services/dashboardService';
import { ChatService } from '../../src/services/chatService';
import { ChatPanel, NotificationBadge } from '../../src/components/chat';
import {
  DashboardStats,
  StudentEnrollmentItem,
  StudentProgramEnrollment,
  LiveSessionItem,
  NotificationItem,
  StudentResultSummary,
  CertificateItem,
  PaymentRecord,
  ProgramOption,
} from '../../src/types';

type ActiveTab =
  | 'dashboard'
  | 'my_program'
  | 'my_courses'
  | 'results'
  | 'certificates'
  | 'payments'
  | 'notifications';

interface ProgramItem {
  id: string;
  name: string;
  duration: string;
  accreditation: string;
  degreeType: string;
}

const AVAILABLE_PROGRAMS: ProgramItem[] = [
  {
    id: 'prog-bth',
    name: 'Bachelor of Theology (B.Th)',
    duration: '3 Years • 6 Semesters',
    accreditation: 'ATA Accredited',
    degreeType: 'Undergraduate Degree',
  },
  {
    id: 'prog-mdiv',
    name: 'Master of Divinity (M.Div)',
    duration: '3 Years • 6 Semesters',
    accreditation: 'ATA Accredited',
    degreeType: 'Postgraduate Degree',
  },
  {
    id: 'prog-dipth',
    name: 'Diploma in Theology (Dip.Th)',
    duration: '2 Years • 4 Semesters',
    accreditation: 'Direct Track',
    degreeType: 'Diploma Program',
  },
  {
    id: 'prog-ccm',
    name: 'Certificate in Christian Ministry (CCM)',
    duration: '1 Year • Online Track',
    accreditation: 'Ministry Foundation',
    degreeType: 'Certificate Program',
  },
];

export default function StudentDashboardScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 900;

  const [user, setUser] = useState<AuthSession['user'] | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProgramsModal, setShowProgramsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(1);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { isDarkMode, toggleTheme } = useTheme();

  // Dynamic Dashboard API State
  const [stats, setStats] = useState<DashboardStats>({
    enrolled: 0,
    inProgress: 0,
    completed: 0,
    avgProgress: 0,
  });
  const [enrollments, setEnrollments] = useState<StudentEnrollmentItem[]>([]);
  const [enrolledPrograms, setEnrolledPrograms] = useState<StudentProgramEnrollment[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<ProgramOption[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [resultsData, setResultsData] = useState<StudentResultSummary | null>(null);
  const [certificatesList, setCertificatesList] = useState<CertificateItem[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const userRes = await DashboardService.getCurrentUser();
      if (userRes.data) {
        setUser(userRes.data);
      }
      const studentId = userRes.data?.id || (await AuthStorage.getUser())?.id || 'me';

      const [
        enrollmentsRes,
        programsRes,
        liveSessionsRes,
        notifCount,
        publicProgramsRes,
      ] = await Promise.all([
        DashboardService.getStudentEnrollments(studentId),
        DashboardService.getStudentPrograms(studentId),
        DashboardService.getUpcomingLiveSessions(),
        DashboardService.getUnreadNotificationCount(),
        DashboardService.getPublicPrograms(100),
      ]);

      if (enrollmentsRes.data) {
        setEnrollments(enrollmentsRes.data);
        const computedStats = DashboardService.computeDashboardStats(enrollmentsRes.data);
        setStats(computedStats);
      }

      if (programsRes.data) {
        setEnrolledPrograms(programsRes.data);
      }

      if (liveSessionsRes.data) {
        setLiveSessions(liveSessionsRes.data);
      }

      setUnreadNotifications(notifCount);

      try {
        const chatConvs = await ChatService.getConversations();
        const unreadTotal = chatConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadChatCount(unreadTotal);
      } catch {
        // keep fallback
      }

      if (publicProgramsRes.data && publicProgramsRes.data.length > 0) {
        setAvailablePrograms(publicProgramsRes.data);
      }
    } catch (err) {
      console.warn('[StudentDashboard] Error refreshing dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    DashboardService.getCurrentUser().then((userRes) => {
      if (!active) return;
      if (userRes.data) {
        setUser(userRes.data);
      }
      const studentId = userRes.data?.id || 'me';

      DashboardService.getStudentEnrollments(studentId).then((enrollmentsRes) => {
        if (!active || !enrollmentsRes.data) return;
        setEnrollments(enrollmentsRes.data);
        setStats(DashboardService.computeDashboardStats(enrollmentsRes.data));
      });

      DashboardService.getStudentPrograms(studentId).then((programsRes) => {
        if (!active || !programsRes.data) return;
        setEnrolledPrograms(programsRes.data);
      });
    });

    DashboardService.getUpcomingLiveSessions().then((liveSessionsRes) => {
      if (!active || !liveSessionsRes.data) return;
      setLiveSessions(liveSessionsRes.data);
    });

    DashboardService.getUnreadNotificationCount().then((notifCount) => {
      if (!active) return;
      setUnreadNotifications(notifCount);

      ChatService.getConversations().then((chatConvs) => {
        if (!active) return;
        const unreadTotal = chatConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadChatCount(unreadTotal);
      }).catch(() => {});
    });

    DashboardService.getPublicPrograms(100).then((publicProgramsRes) => {
      if (!active || !publicProgramsRes.data || publicProgramsRes.data.length === 0) return;
      setAvailablePrograms(publicProgramsRes.data);
    });

    return () => {
      active = false;
    };
  }, []);

  // Load sub-view data on tab switch
  useEffect(() => {
    if (activeTab === 'results' && !resultsData) {
      DashboardService.getStudentResults().then((res) => {
        if (res.data) setResultsData(res.data);
      });
    } else if (activeTab === 'certificates' && certificatesList.length === 0) {
      DashboardService.getMyCertificates().then((res) => {
        if (res.data) setCertificatesList(res.data);
      });
    } else if (activeTab === 'payments') {
      Promise.resolve().then(() => {
        setIsPaymentsLoading(true);
        DashboardService.getMyPayments(1, 10)
          .then((res) => {
            if (res.data) setPaymentsList(res.data);
          })
          .finally(() => {
            setIsPaymentsLoading(false);
          });
      });
    }
  }, [activeTab, resultsData, certificatesList.length, paymentsList.length]);

  // Invoice Download Handler for Dashboard
  const handleDashboardDownloadInvoice = async (pay: PaymentRecord) => {
    const pid = pay.id || (pay as any)._id;
    if (!pid) {
      Alert.alert('Invalid Payment ID', 'Cannot generate invoice: missing payment ID.');
      return;
    }
    setGeneratingInvoiceId(pid);
    try {
      const res = await DashboardService.generateInvoice(pid);
      if (res.success && res.data) {
        const url = res.data.invoiceUrl;
        if (url) {
          const canOpen = await Linking.canOpenURL(url).catch(() => true);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            Alert.alert('Invoice URL', url);
          }
        } else {
          Alert.alert(
            'Invoice Generated',
            res.data.invoicePath ? `Path: ${res.data.invoicePath}` : 'Invoice generated successfully.'
          );
        }
      } else {
        Alert.alert('Invoice Failed', res.error || 'Server could not generate invoice.');
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate invoice.');
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  // Load notifications when modal opens
  useEffect(() => {
    if (showNotificationsModal && notificationsList.length === 0) {
      DashboardService.getNotifications().then((res) => {
        if (res.data) setNotificationsList(res.data);
      });
    }
  }, [showNotificationsModal, notificationsList.length]);

  // Format student display name (fallback to 'jushal' as in screenshot)
  const studentFullName = user?.fullName || 'jushal';
  const firstName = studentFullName.split(' ')[0] || 'jushal';
  const avatarLetter = (firstName.charAt(0) || 'J').toUpperCase();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from Cotr Global Online?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setShowProfileModal(false);
            await LmsAuthService.logout();
            router.replace('/student/login');
          },
        },
      ]
    );
  };

  const handleEnrollProgram = (program: ProgramItem) => {
    Alert.alert(
      'Enroll in Program',
      `Would you like to submit your enrollment request for ${program.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Enrollment',
          onPress: () => {
            setShowProgramsModal(false);
            Alert.alert(
              'Enrollment Request Submitted',
              `Your application for ${program.name} is being processed by the registrar office.`
            );
          },
        },
      ]
    );
  };

  // Sidebar Component
  const renderSidebarContent = () => (
    <View style={styles.sidebarInner}>
      {/* Brand Header */}
      <View style={styles.brandContainer}>
        <View style={styles.emblemWrapper}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.sidebarLogoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.brandTitleWrapper}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            Cotr Global Online
          </Text>
          <View style={styles.studentBadge}>
            <Text style={styles.studentBadgeText}>STUDENT</Text>
          </View>
        </View>
      </View>

      {/* Nav Menu */}
      <View style={styles.navGroup}>
        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'dashboard' && styles.navItemActive,
          ]}
          onPress={() => {
            setActiveTab('dashboard');
            setIsSidebarOpen(false);
          }}
          activeOpacity={0.7}
        >
          {activeTab === 'dashboard' && <View style={styles.activeIndicator} />}
          <Ionicons
            name="apps-outline"
            size={18}
            color={activeTab === 'dashboard' ? '#38BDF8' : '#94A3B8'}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'dashboard' && styles.navTextActive,
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'my_program' && styles.navItemActive,
          ]}
          onPress={() => {
            setActiveTab('my_program');
            setIsSidebarOpen(false);
            router.push('/student/programs');
          }}
          activeOpacity={0.7}
        >
          {activeTab === 'my_program' && <View style={styles.activeIndicator} />}
          <Ionicons
            name="school-outline"
            size={18}
            color={activeTab === 'my_program' ? '#38BDF8' : '#94A3B8'}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'my_program' && styles.navTextActive,
            ]}
          >
            My Program
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'my_courses' && styles.navItemActive,
          ]}
          onPress={() => {
            setActiveTab('my_courses');
            setIsSidebarOpen(false);
          }}
          activeOpacity={0.7}
        >
          {activeTab === 'my_courses' && <View style={styles.activeIndicator} />}
          <Ionicons
            name="book-outline"
            size={18}
            color={activeTab === 'my_courses' ? '#38BDF8' : '#94A3B8'}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'my_courses' && styles.navTextActive,
            ]}
          >
            My Courses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'results' && styles.navItemActive,
          ]}
          onPress={() => {
            setIsSidebarOpen(false);
            router.push('/student/results');
          }}
          activeOpacity={0.7}
        >
          {activeTab === 'results' && <View style={styles.activeIndicator} />}
          <Ionicons
            name="document-text-outline"
            size={18}
            color={activeTab === 'results' ? '#38BDF8' : '#94A3B8'}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'results' && styles.navTextActive,
            ]}
          >
            Results & Transcripts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'certificates' && styles.navItemActive,
          ]}
          onPress={() => {
            setIsSidebarOpen(false);
            router.push('/student/certificates');
          }}
          activeOpacity={0.7}
        >
          {activeTab === 'certificates' && <View style={styles.activeIndicator} />}
          <Ionicons
            name="ribbon-outline"
            size={18}
            color={activeTab === 'certificates' ? '#38BDF8' : '#94A3B8'}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'certificates' && styles.navTextActive,
            ]}
          >
            Certificates
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'payments' && styles.navItemActive,
          ]}
          onPress={() => {
            setActiveTab('payments');
            setIsSidebarOpen(false);
          }}
          activeOpacity={0.7}
        >
          {activeTab === 'payments' && <View style={styles.activeIndicator} />}
          <Ionicons
            name="card-outline"
            size={18}
            color={activeTab === 'payments' ? '#38BDF8' : '#94A3B8'}
            style={styles.navIcon}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'payments' && styles.navTextActive,
            ]}
          >
            Payments
          </Text>
        </TouchableOpacity>

        {/* 7. Notifications */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setIsSidebarOpen(false);
            setShowNotificationsModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="notifications-outline"
            size={18}
            color="#94A3B8"
            style={styles.navIcon}
          />
          <Text style={styles.navText}>Notifications</Text>
          {unreadNotifications > 0 && (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 8. Dark Mode Toggle Switch */}
        <View style={styles.themeToggleNavItem}>
          <View style={styles.themeToggleLeft}>
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={isDarkMode ? '#F59E0B' : '#94A3B8'}
              style={styles.navIcon}
            />
            <Text style={styles.navText}>Dark Mode</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: '#334155', true: '#4F46E5' }}
            thumbColor={isDarkMode ? '#FFFFFF' : '#CBD5E1'}
            ios_backgroundColor="#334155"
          />
        </View>

        {/* 9. Profile */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setIsSidebarOpen(false);
            setShowProfileModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="person-outline"
            size={18}
            color="#94A3B8"
            style={styles.navIcon}
          />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Footer Version */}
      <View style={styles.sidebarFooter}>
        <Text style={styles.footerVersion}>LMS v1.0</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top', 'bottom']}>
      <View style={styles.mainContainer}>
        {/* Permanent Sidebar for Large Screens */}
        {isLargeScreen && (
          <View style={styles.desktopSidebar}>{renderSidebarContent()}</View>
        )}

        {/* Mobile Slide-over Drawer Modal */}
        {!isLargeScreen && (
          <Modal
            visible={isSidebarOpen}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setIsSidebarOpen(false)}
          >
            <View style={styles.drawerOverlay}>
              <TouchableOpacity
                style={styles.drawerBackdrop}
                activeOpacity={1}
                onPress={() => setIsSidebarOpen(false)}
              />
              <View style={styles.drawerContent}>{renderSidebarContent()}</View>
            </View>
          </Modal>
        )}

        {/* Right / Main Content Area */}
        <View style={[styles.contentArea, isDarkMode && { backgroundColor: '#0B0F19' }]}>
          {/* Top Bar Header */}
          <View
            style={[
              styles.topBar,
              isDarkMode && {
                backgroundColor: '#111827',
                borderBottomColor: '#1F2937',
              },
            ]}
          >
            {/* Left: Menu Toggle Icon */}
            <TouchableOpacity
              style={[
                styles.gridMenuButton,
                isDarkMode && { backgroundColor: '#1E293B' },
              ]}
              onPress={() => setIsSidebarOpen(!isSidebarOpen)}
              activeOpacity={0.7}
            >
              <Ionicons name="apps-outline" size={22} color={isDarkMode ? '#F8FAFC' : '#475569'} />
            </TouchableOpacity>

            {!isLargeScreen && (
              <View style={styles.mobileBrandInline}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.mobileLogoImage}
                  resizeMode="contain"
                />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.mobileBrandName, isDarkMode && { color: '#F8FAFC' }]}>
                    Cotr Global Online
                  </Text>
                </View>
                <View style={styles.mobileBadgeSmall}>
                  <Text style={styles.mobileBadgeText}>STUDENT</Text>
                </View>
              </View>
            )}

            {/* Right: Action Buttons & Profile (Video Call | Chat | Notifications | Profile) */}
            <View style={styles.topBarActions}>
              {/* 1. Video Call Icon (Screenshot Matched) */}
              <TouchableOpacity
                style={[
                  styles.headerVideoButton,
                  isDarkMode && { backgroundColor: '#1E293B' },
                ]}
                onPress={() =>
                  Alert.alert(
                    'Live Classroom',
                    'No active live stream sessions right now. Check back during scheduled class hours.'
                  )
                }
                activeOpacity={0.8}
              >
                <Ionicons name="videocam-outline" size={19} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
              </TouchableOpacity>

              {/* 2. Chat Message Icon (Screenshot Matched) */}
              <TouchableOpacity
                style={styles.headerChatButton}
                onPress={() => setShowChatModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color="#FFFFFF"
                />
                {unreadChatCount > 0 && (
                  <View style={styles.headerChatBadge}>
                    <NotificationBadge count={unreadChatCount} />
                  </View>
                )}
              </TouchableOpacity>

              {/* 3. Notification Bell with Badge */}
              <TouchableOpacity
                style={[
                  styles.actionIconButton,
                  isDarkMode && { backgroundColor: '#1E293B' },
                ]}
                onPress={() => setShowNotificationsModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="notifications-outline"
                  size={19}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
                {unreadNotifications > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* 4. Profile Avatar Pill */}
              <TouchableOpacity
                style={[
                  styles.profileButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => setShowProfileModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                  <View style={styles.onlineDot} />
                </View>
                {width >= 600 && (
                  <View style={styles.profileTextContainer}>
                    <Text style={[styles.profileName, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>
                      {firstName}
                    </Text>
                    <Text style={[styles.profileRole, isDarkMode && { color: '#94A3B8' }]}>STUDENT</Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refreshDashboardData}
                colors={['#6366F1']}
                tintColor="#6366F1"
              />
            }
          >
            {activeTab === 'dashboard' && (
              <>
                {/* Welcome Card Banner */}
                <View style={styles.welcomeBanner}>
                  <View style={styles.welcomeLeft}>
                    <View style={[styles.welcomePill, isDarkMode && { backgroundColor: '#1E1B4B' }]}>
                      <Text style={[styles.welcomePillText, isDarkMode && { color: '#A5B4FC' }]}>WELCOME BACK</Text>
                    </View>
                    <View style={styles.greetingRow}>
                      <Text style={[styles.greetingTitle, isDarkMode && { color: '#F8FAFC' }]}>
                        Hi {firstName}{' '}
                      </Text>
                      <Text style={styles.wavingHand}>👋</Text>
                    </View>
                    <Text style={[styles.greetingSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                      Pick up where you left off.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.myProgramButton}
                    onPress={() => router.push('/student/programs')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.myProgramButtonText}>My Program</Text>
                  </TouchableOpacity>
                </View>

                {/* Upcoming Live Interactive Session Banner (Screen 5 API 5.3) */}
                {liveSessions.length > 0 && (
                  <View style={[styles.liveBannerCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={[styles.liveBannerIcon, isDarkMode && { backgroundColor: '#2E1065' }]}>
                      <Ionicons name="videocam" size={24} color="#A78BFA" />
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={styles.liveBannerTag}>Upcoming Live Virtual Session</Text>
                      <Text style={[styles.liveBannerTitle, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>
                        {liveSessions[0].title} {liveSessions[0].courseTitle ? `• ${liveSessions[0].courseTitle}` : ''}
                      </Text>
                      <Text style={[styles.liveBannerTime, isDarkMode && { color: '#94A3B8' }]}>
                        {liveSessions[0].scheduledDate ? new Date(liveSessions[0].scheduledDate).toLocaleDateString() : 'Scheduled'} {liveSessions[0].scheduledTime || ''}
                      </Text>
                    </View>
                    {liveSessions[0].meetingUrl ? (
                      <TouchableOpacity
                        style={styles.liveJoinBtn}
                        onPress={() => {
                          if (liveSessions[0].meetingUrl) {
                            Linking.openURL(liveSessions[0].meetingUrl).catch((e) => console.warn(e));
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.liveJoinBtnText}>Join</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {/* 4 Stat Cards Row (Dynamically computed from API enrollments) */}
                <View style={styles.statsGrid}>
                  {/* Card 1: Enrolled Courses */}
                  <View style={[styles.statCard, styles.statCardBlue, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={styles.statCardHeader}>
                      <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>ENROLLED COURSES</Text>
                      <View style={[styles.statIconBox, styles.statIconBlue, isDarkMode && { backgroundColor: '#1E293B' }]}>
                        <Ionicons
                          name="library-outline"
                          size={18}
                          color="#3B82F6"
                        />
                      </View>
                    </View>
                    <Text style={[styles.statValue, isDarkMode && { color: '#F8FAFC' }]}>{stats.enrolled}</Text>
                  </View>

                  {/* Card 2: In Progress */}
                  <View style={[styles.statCard, styles.statCardPurple, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={styles.statCardHeader}>
                      <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>IN PROGRESS</Text>
                      <View style={[styles.statIconBox, styles.statIconPurple, isDarkMode && { backgroundColor: '#1E293B' }]}>
                        <Ionicons
                          name="play-circle-outline"
                          size={18}
                          color="#8B5CF6"
                        />
                      </View>
                    </View>
                    <Text style={[styles.statValue, isDarkMode && { color: '#F8FAFC' }]}>{stats.inProgress}</Text>
                  </View>

                  {/* Card 3: Completed */}
                  <View style={[styles.statCard, styles.statCardGreen, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={styles.statCardHeader}>
                      <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>COMPLETED</Text>
                      <View style={[styles.statIconBox, styles.statIconGreen, isDarkMode && { backgroundColor: '#1E293B' }]}>
                        <Ionicons
                          name="ribbon-outline"
                          size={18}
                          color="#10B981"
                        />
                      </View>
                    </View>
                    <Text style={[styles.statValue, isDarkMode && { color: '#F8FAFC' }]}>{stats.completed}</Text>
                  </View>

                  {/* Card 4: Avg Progress */}
                  <View style={[styles.statCard, styles.statCardCyan, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={styles.statCardHeader}>
                      <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>AVG. PROGRESS</Text>
                      <View style={[styles.statIconBox, styles.statIconCyan, isDarkMode && { backgroundColor: '#1E293B' }]}>
                        <Ionicons
                          name="trending-up-outline"
                          size={18}
                          color="#0284C7"
                        />
                      </View>
                    </View>
                    <Text style={[styles.statValue, isDarkMode && { color: '#F8FAFC' }]}>{stats.avgProgress}%</Text>
                  </View>
                </View>

                {/* Section 1: My Programs (Screen 5 API 5.2) */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIndicator} />
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>My Programs</Text>
                </View>

                {enrolledPrograms.length === 0 ? (
                  <View style={[styles.emptyStateCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                      <Ionicons name="school-outline" size={34} color="#A78BFA" />
                    </View>
                    <Text style={[styles.emptyTitle, isDarkMode && { color: '#F8FAFC' }]}>No programs</Text>
                    <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                      You are not enrolled in any programs.
                    </Text>
                    <TouchableOpacity
                      style={styles.browseButton}
                      onPress={() => router.push('/student/programs')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.browseButtonText}>Browse Programs</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  enrolledPrograms.map((ep, idx) => (
                    <TouchableOpacity
                      key={ep.id || `prog_${idx}`}
                      style={[styles.enrolledProgramCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}
                      onPress={() =>
                        router.push({
                          pathname: '/student/programs',
                          params: { programId: ep.programId || ep.program?.id },
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.progIconCircle, isDarkMode && { backgroundColor: '#1E1B4B' }]}>
                          <Ionicons name="school" size={22} color="#818CF8" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.enrolledProgramTitle, isDarkMode && { color: '#F8FAFC' }]}>
                            {ep.program?.name || 'Enrolled Degree Program'}
                          </Text>
                          <Text style={[styles.enrolledProgramSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                            {ep.batch?.name ? `${ep.batch.name} • ` : ''}{ep.program?.duration || 'Multi-Semester Academic Stream'}
                          </Text>
                        </View>
                        <View style={styles.enrolledStatusBadge}>
                          <Text style={styles.enrolledStatusText}>ACTIVE</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}

                {/* Section 2: Standalone Courses (Screen 5 API 5.1) */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIndicator} />
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Standalone Courses</Text>
                </View>

                {enrollments.length === 0 ? (
                  <View style={[styles.emptyStateCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                      <Ionicons name="library-outline" size={34} color="#A78BFA" />
                    </View>
                    <Text style={[styles.emptyTitle, isDarkMode && { color: '#F8FAFC' }]}>Nothing in progress</Text>
                    <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                      Enroll in a standalone course to start your learning
                      journey.
                    </Text>
                    <TouchableOpacity
                      style={styles.browseButton}
                      onPress={() => router.push('/(student-tabs)/courses')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.browseButtonText}>Explore Courses</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  enrollments.map((enr, idx) => {
                    const cId = enr.courseId || enr.course?.id || enr.id;
                    return (
                      <TouchableOpacity
                        key={enr.id || `enr_${idx}`}
                        style={[styles.enrolledCourseCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}
                        onPress={() => {
                          if (cId) {
                            router.push({
                              pathname: '/student/learn',
                              params: {
                                id: cId,
                                courseId: cId,
                                title: enr.course?.title || 'Academic Course',
                              },
                            });
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <View style={[styles.courseIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                            <Ionicons name="book" size={20} color="#A78BFA" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.enrolledCourseTitle, isDarkMode && { color: '#F8FAFC' }]}>
                              {enr.course?.title || 'Academic Course'}
                            </Text>
                            <Text style={[styles.enrolledCourseSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                              {enr.course?.creditHours ? `${enr.course.creditHours} Credits • ` : ''}Course Subject
                            </Text>
                          </View>
                          <Text style={styles.enrolledCoursePercent}>
                            {enr.progressPercentage || 0}%
                          </Text>
                        </View>
                        {/* Progress Bar */}
                        <View style={[styles.courseProgressBarBg, isDarkMode && { backgroundColor: '#1E293B' }]}>
                          <View
                            style={[
                              styles.courseProgressBarFill,
                              { width: `${Math.min(100, Math.max(0, enr.progressPercentage || 0))}%` },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            )}

            {/* Sub-view: My Program */}
            {activeTab === 'my_program' && (
              <View style={styles.subViewContainer}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIndicator} />
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Enrolled Program Details</Text>
                </View>
                <View style={[styles.subViewCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                  <View style={styles.programBanner}>
                    <Ionicons name="school" size={44} color="#6366F1" />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text style={[styles.subViewProgramName, isDarkMode && { color: '#F8FAFC' }]}>
                        {enrolledPrograms.length > 0 && enrolledPrograms[0].program?.name
                          ? enrolledPrograms[0].program.name
                          : 'Bachelor of Theology (B.Th)'}
                      </Text>
                      <Text style={[styles.subViewMeta, isDarkMode && { color: '#94A3B8' }]}>
                        {enrolledPrograms.length > 0 && enrolledPrograms[0].batch?.name
                          ? `Batch: ${enrolledPrograms[0].batch.name} • ${enrolledPrograms[0].program?.degreeLevel || 'Degree Program'}`
                          : 'ATA Accredited • 3-Year Residential & Hybrid Track'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.divider, isDarkMode && { backgroundColor: '#1F2937' }]} />
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isDarkMode && { color: '#94A3B8' }]}>Academic Status</Text>
                    <Text style={[styles.infoValue, { color: '#10B981', fontWeight: '700' }]}>
                      {user?.status ? `Admission ${user.status}` : 'Admission Confirmed'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isDarkMode && { color: '#94A3B8' }]}>Current Term</Text>
                    <Text style={[styles.infoValue, isDarkMode && { color: '#F8FAFC' }]}>Semester 1 (Fall 2026)</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isDarkMode && { color: '#94A3B8' }]}>Affiliation</Text>
                    <Text style={[styles.infoValue, isDarkMode && { color: '#F8FAFC' }]}>Asia Theological Association (ATA)</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.browseButton, { marginTop: 20 }]}
                    onPress={() => router.push('/student/programs')}
                  >
                    <Text style={styles.browseButtonText}>Explore Term-Wise Curriculums</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sub-view: My Courses */}
            {activeTab === 'my_courses' && (
              <View style={styles.subViewContainer}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIndicator} />
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>My Courses & Syllabus</Text>
                </View>
                {enrollments.length > 0 ? (
                  <View style={{ gap: 14 }}>
                    {enrollments.map((enr, idx) => {
                      const cId = enr.courseId || enr.course?.id || enr.id;
                      return (
                        <TouchableOpacity
                          key={enr.id || `my_c_${idx}`}
                          style={[styles.enrolledCourseCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}
                          onPress={() => {
                            if (cId) {
                              router.push({
                                pathname: '/student/learn',
                                params: {
                                  id: cId,
                                  courseId: cId,
                                  title: enr.course?.title || 'Academic Course',
                                },
                              });
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                            <View style={[styles.courseIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                              <Ionicons name="book" size={20} color="#A78BFA" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={[styles.enrolledCourseTitle, isDarkMode && { color: '#F8FAFC' }]}>
                                {enr.course?.title || 'Academic Course'}
                              </Text>
                              <Text style={[styles.enrolledCourseSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                                {enr.course?.code || 'CRS'} {enr.course?.creditHours ? `• ${enr.course.creditHours} Credits` : ''}
                              </Text>
                            </View>
                            <Text style={styles.enrolledCoursePercent}>
                              {enr.progressPercentage || 0}%
                            </Text>
                          </View>
                          {/* Progress Bar */}
                          <View style={[styles.courseProgressBarBg, isDarkMode && { backgroundColor: '#1E293B' }]}>
                            <View
                              style={[
                                styles.courseProgressBarFill,
                                { width: `${Math.min(100, Math.max(0, enr.progressPercentage || 0))}%` },
                              ]}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={[styles.emptyStateCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                      <Ionicons name="book-outline" size={34} color="#A78BFA" />
                    </View>
                    <Text style={[styles.emptyTitle, isDarkMode && { color: '#F8FAFC' }]}>Course modules launching soon</Text>
                    <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                      Your semester lecture schedule and course material are being synchronized by the registrar.
                    </Text>
                    <TouchableOpacity
                      style={styles.browseButton}
                      onPress={() => setActiveTab('dashboard')}
                    >
                      <Text style={styles.browseButtonText}>Back to Dashboard</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Sub-view: Results */}
            {activeTab === 'results' && (
              <View style={styles.subViewContainer}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIndicator} />
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Examination Results & GPA</Text>
                </View>
                {resultsData && (resultsData.gpa !== undefined || (resultsData.grades && resultsData.grades.length > 0)) ? (
                  <View style={[styles.subViewCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>CUMULATIVE GPA</Text>
                      <Text style={[styles.statValue, { color: '#6366F1' }]}>{resultsData.cumulativeGpa ?? resultsData.gpa ?? 3.85}</Text>
                    </View>
                    <View style={[styles.divider, isDarkMode && { backgroundColor: '#1F2937' }]} />
                    {resultsData.grades && resultsData.grades.length > 0 ? (
                      resultsData.grades.map((gr, idx) => (
                        <View key={idx} style={styles.infoRow}>
                          <Text style={[styles.infoLabel, isDarkMode && { color: '#94A3B8' }]}>{gr.courseTitle}</Text>
                          <Text style={[styles.infoValue, { color: '#10B981', fontWeight: '700' }]}>{gr.grade}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 13 }}>Semester examination scores verified.</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.browseButton, { marginTop: 14 }]}
                      onPress={() => router.push('/student/results')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.browseButtonText}>View Complete Results & Transcripts</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.emptyStateCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                      <Ionicons name="document-text-outline" size={34} color="#A78BFA" />
                    </View>
                    <Text style={[styles.emptyTitle, isDarkMode && { color: '#F8FAFC' }]}>No examination records yet</Text>
                    <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                      Marksheets and semester grade reports will appear here after mid-term exams.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Sub-view: Certificates */}
            {activeTab === 'certificates' && (
              <View style={styles.subViewContainer}>
                <View style={[styles.sectionHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.sectionIndicator} />
                    <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Certificates & Transcripts</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/student/certificates')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '600', marginRight: 4 }}>
                      Manage & Request
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color="#38BDF8" />
                  </TouchableOpacity>
                </View>
                {certificatesList.length > 0 ? (
                  <View style={{ gap: 14 }}>
                    {certificatesList.map((cert) => (
                      <View key={cert.id} style={[styles.subViewCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <Ionicons name="ribbon" size={24} color="#10B981" />
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={[styles.subViewProgramName, isDarkMode && { color: '#F8FAFC' }]}>{cert.programName || cert.courseTitle || 'Completion Credential'}</Text>
                            <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 12 }}>Cert No: {cert.certificateNumber || cert.id}</Text>
                          </View>
                        </View>
                        {cert.issueDate && (
                          <Text style={{ color: isDarkMode ? '#64748B' : '#94A3B8', fontSize: 12, marginTop: 4 }}>
                            Issued on: {new Date(cert.issueDate).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.emptyStateCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: '#2E1065' }]}>
                      <Ionicons name="ribbon-outline" size={34} color="#A78BFA" />
                    </View>
                    <Text style={[styles.emptyTitle, isDarkMode && { color: '#F8FAFC' }]}>No certificates issued</Text>
                    <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
                      Degree certificates and completion credentials will be automatically awarded upon course graduation.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Sub-view: Payments */}
            {activeTab === 'payments' && (
              <View style={styles.subViewContainer}>
                <View style={[styles.sectionHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.sectionIndicator} />
                    <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Tuition & Fee Receipts</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/student/payments')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '600', marginRight: 4 }}>
                      View Full History
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color="#38BDF8" />
                  </TouchableOpacity>
                </View>

                {isPaymentsLoading ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>
                      Loading payment records from backend...
                    </Text>
                  </View>
                ) : paymentsList.length > 0 ? (
                  <View style={{ gap: 14 }}>
                    {paymentsList.map((pay) => {
                      const amountVal = Number(
                        pay.amount ?? (pay as any).totalAmount ?? (pay as any).feeAmount ?? 0
                      );
                      const formattedAmount = isNaN(amountVal) ? '0.00' : amountVal.toFixed(2);
                      const isGenerating = generatingInvoiceId === (pay.id || (pay as any)._id);
                      const courseOrTitle =
                        pay.courseTitle ||
                        (pay.course as any)?.title ||
                        pay.programName ||
                        (pay.program as any)?.name ||
                        pay.description ||
                        'Academic Tuition Fee';

                      return (
                        <View key={pay.id || (pay as any)._id} style={[styles.subViewCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="receipt-outline" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                              <Text style={[styles.statLabel, isDarkMode && { color: '#94A3B8' }]}>
                                {pay.invoiceNumber || (pay as any).invoice_number || 'TUITION INVOICE'}
                              </Text>
                            </View>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 4,
                                backgroundColor:
                                  pay.status === 'PAID' || pay.status === 'COMPLETED'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                              }}
                            >
                              <Text
                                style={{
                                  color:
                                    pay.status === 'PAID' || pay.status === 'COMPLETED'
                                      ? '#10B981'
                                      : '#F59E0B',
                                  fontWeight: '700',
                                  fontSize: 11,
                                }}
                              >
                                {pay.status || 'PAID'}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.statValue, { fontSize: 22, marginVertical: 6 }, isDarkMode && { color: '#F8FAFC' }]}>
                            {pay.currency || 'INR'} {formattedAmount}
                          </Text>

                          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                            {courseOrTitle}
                          </Text>

                          {pay.paymentDate || pay.createdAt ? (
                            <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 12, marginBottom: 12 }}>
                              Date: {new Date(pay.paymentDate || pay.createdAt || '').toLocaleDateString()}
                              {pay.paymentMethod ? ` • Method: ${pay.paymentMethod}` : ''}
                            </Text>
                          ) : null}

                          {/* Invoice Download Action */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDarkMode ? '#0F172A' : '#F0F9FF',
                              borderWidth: 1,
                              borderColor: '#38BDF8',
                              borderRadius: 8,
                              paddingVertical: 8,
                              marginTop: 6,
                              opacity: isGenerating ? 0.6 : 1,
                            }}
                            onPress={() => handleDashboardDownloadInvoice(pay)}
                            disabled={isGenerating}
                            activeOpacity={0.8}
                          >
                            {isGenerating ? (
                              <>
                                <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '600' }}>
                                  Generating Invoice...
                                </Text>
                              </>
                            ) : (
                              <>
                                <Ionicons name="download-outline" size={14} color="#38BDF8" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '600' }}>
                                  Download Invoice
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={[styles.subViewCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                      <Ionicons name="receipt-outline" size={40} color="#64748B" style={{ marginBottom: 10 }} />
                      <Text style={[styles.statValue, { fontSize: 18, marginBottom: 6 }, isDarkMode && { color: '#F8FAFC' }]}>
                        No Payment Records Found
                      </Text>
                      <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                        When you enroll in courses or make tuition payments, your backend payment receipts will appear here.
                      </Text>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#4F46E5',
                          paddingHorizontal: 16,
                          paddingVertical: 9,
                          borderRadius: 8,
                          marginTop: 16,
                        }}
                        onPress={() => router.push('/(student-tabs)/courses')}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="book-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                          Browse Available Courses
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Footer Copyright */}
            <View style={styles.dashboardFooter}>
              <Text style={styles.dashboardFooterText}>
                © 2026 Cotr Global Online. All rights reserved.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* MODAL: Browse Programs */}
      <Modal
        visible={showProgramsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProgramsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="school" size={20} color="#6366F1" />
                </View>
                <Text style={styles.modalTitle}>Available Programs</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowProgramsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
              {(availablePrograms.length > 0
                ? availablePrograms.map((p) => ({
                  id: p.id,
                  name: p.name,
                  duration: 'Academic Term • Online',
                  accreditation: 'Accredited',
                  degreeType: p.description || 'Degree Program',
                }))
                : AVAILABLE_PROGRAMS
              ).map((prog) => (
                <View key={prog.id} style={styles.programCardItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.progItemName}>{prog.name}</Text>
                    <Text style={styles.progItemDuration}>
                      {prog.duration} • {prog.degreeType}
                    </Text>
                    <View style={styles.accreditationTag}>
                      <Text style={styles.accreditationText}>
                        {prog.accreditation}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.enrollItemButton}
                    onPress={() => handleEnrollProgram(prog)}
                  >
                    <Text style={styles.enrollItemButtonText}>Enroll</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowProgramsModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Notifications */}
      <Modal
        visible={showNotificationsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937', borderWidth: 1 }]}>
            <View style={[styles.modalHeader, isDarkMode && { borderBottomColor: '#1F2937' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name="notifications"
                  size={20}
                  color="#6366F1"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.modalTitle, isDarkMode && { color: '#F8FAFC' }]}>Notifications</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setUnreadNotifications(0);
                  setShowNotificationsModal(false);
                }}
              >
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {notificationsList.length > 0 ? (
              notificationsList.map((notif) => (
                <View key={notif.id} style={[styles.notificationItem, isDarkMode && { borderBottomColor: '#1F2937' }]}>
                  <View style={[styles.notifIconCircle, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                    <Ionicons name="notifications-outline" size={20} color="#818CF8" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.notifTitle, isDarkMode && { color: '#F8FAFC' }]}>{notif.title}</Text>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#94A3B8' }]}>{notif.message}</Text>
                    <Text style={[styles.notifTime, isDarkMode && { color: '#64748B' }]}>
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : 'Recent'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <>
                <View style={[styles.notificationItem, isDarkMode && { borderBottomColor: '#1F2937' }]}>
                  <View style={[styles.notifIconCircle, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.notifTitle, isDarkMode && { color: '#F8FAFC' }]}>Welcome to Cotr Global Online</Text>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#94A3B8' }]}>
                      Your student account has been created. Explore your dashboard and browse programs.
                    </Text>
                    <Text style={[styles.notifTime, isDarkMode && { color: '#64748B' }]}>Just now</Text>
                  </View>
                </View>

                <View style={[styles.notificationItem, isDarkMode && { borderBottomColor: '#1F2937' }]}>
                  <View style={[styles.notifIconCircle, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                    <Ionicons name="calendar-outline" size={20} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.notifTitle, isDarkMode && { color: '#F8FAFC' }]}>Academic Calendar Published</Text>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#94A3B8' }]}>
                      The term calendar for 2026-2027 is now available in the student portal.
                    </Text>
                    <Text style={[styles.notifTime, isDarkMode && { color: '#64748B' }]}>1 hour ago</Text>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.closeModalButton, isDarkMode && { backgroundColor: '#1E293B' }]}
              onPress={() => {
                setUnreadNotifications(0);
                setShowNotificationsModal(false);
              }}
            >
              <Text style={[styles.closeModalButtonText, isDarkMode && { color: '#CBD5E1' }]}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Profile Menu */}
      <Modal
        visible={showProfileModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937', borderWidth: 1 }]}>
            <View style={[styles.modalHeader, isDarkMode && { borderBottomColor: '#1F2937' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.avatarCircleLarge}>
                  <Text style={styles.avatarLetterLarge}>{avatarLetter}</Text>
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.profileModalName, isDarkMode && { color: '#F8FAFC' }]}>{studentFullName}</Text>
                  <Text style={[styles.profileModalEmail, isDarkMode && { color: '#94A3B8' }]}>
                    {user?.email || 'student@cotr.edu'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.profileMetaBox, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, isDarkMode && { color: '#94A3B8' }]}>Role:</Text>
                <Text style={[styles.metaValue, isDarkMode && { color: '#F8FAFC' }]}>Enrolled Student</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, isDarkMode && { color: '#94A3B8' }]}>Portal:</Text>
                <Text style={[styles.metaValue, isDarkMode && { color: '#F8FAFC' }]}>Cotr Global Online LMS</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.profileActionRow, isDarkMode && { borderBottomColor: '#1F2937' }]}
              onPress={() => {
                setShowProfileModal(false);
                router.push('/(student-tabs)/profile');
              }}
            >
              <Ionicons name="person-outline" size={18} color={isDarkMode ? '#94A3B8' : '#1E293B'} />
              <Text style={[styles.profileActionText, isDarkMode && { color: '#F8FAFC' }]}>View Full Profile</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileActionRow, { borderBottomWidth: 0 }]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={[styles.profileActionText, { color: '#EF4444' }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Discussion & Real-Time Chat Modal Panel */}
      <ChatPanel
        visible={showChatModal}
        onClose={() => setShowChatModal(false)}
        onUnreadChange={(count) => setUnreadChatCount(count)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 250,
    backgroundColor: '#0A0F1D',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawerContent: {
    width: 270,
    backgroundColor: '#0A0F1D',
    height: '100%',
  },
  sidebarInner: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  emblemWrapper: {
    marginRight: 10,
  },
  sidebarLogoImage: {
    width: 38,
    height: 38,
  },
  brandTitleWrapper: {
    flex: 1,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  studentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  studentBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  navGroup: {
    paddingHorizontal: 12,
    marginTop: 18,
    gap: 4,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#13203C',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  navIcon: {
    marginRight: 12,
  },
  navText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  themeToggleNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginVertical: 2,
  },
  themeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    marginLeft: 'auto',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  menuBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  sidebarFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  footerVersion: {
    color: '#475569',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  topBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  gridMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileBrandInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  mobileLogoImage: {
    width: 32,
    height: 32,
  },
  mobileBrandName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  mobileBrandSub: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
  },
  mobileBadgeSmall: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 6,
  },
  mobileBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerVideoButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerChatButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  headerChatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 24,
    marginLeft: 4,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileTextContainer: {
    marginLeft: 8,
    marginRight: 4,
  },
  profileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  profileRole: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 90,
  },
  welcomeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  welcomeLeft: {
    flex: 1,
    minWidth: 200,
  },
  welcomePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  welcomePillText: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  wavingHand: {
    fontSize: 26,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  myProgramButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  myProgramButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardBlue: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
    borderTopWidth: 3,
    borderTopColor: '#4F46E5',
  },
  statCardPurple: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    borderTopWidth: 3,
    borderTopColor: '#8B5CF6',
  },
  statCardGreen: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    borderTopWidth: 3,
    borderTopColor: '#10B981',
  },
  statCardCyan: {
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
    borderTopWidth: 3,
    borderTopColor: '#0284C7',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBlue: {
    backgroundColor: '#EFF6FF',
  },
  statIconPurple: {
    backgroundColor: '#F5F3FF',
  },
  statIconGreen: {
    backgroundColor: '#ECFDF5',
  },
  statIconCyan: {
    backgroundColor: '#ECFEFF',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionIndicator: {
    width: 4,
    height: 20,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 44,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F3EEFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
  },
  browseButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  dashboardFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginTop: 10,
  },
  dashboardFooterText: {
    fontSize: 12,
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  subViewContainer: {
    marginBottom: 20,
  },
  subViewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  programBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subViewProgramName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subViewMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  programCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  progItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  progItemDuration: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  accreditationTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  accreditationText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '700',
  },
  enrollItemButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  enrollItemButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeModalButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  notifBody: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 4,
  },
  avatarCircleLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetterLarge: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  profileModalName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileModalEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  profileMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileActionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  chatMessageBubble: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  chatMessageText: {
    fontSize: 13,
    color: '#1E1B4B',
    lineHeight: 18,
  },
  quickPromptButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPromptText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },

  // Dynamic Live Session Banner
  liveBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  liveBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBannerTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  liveBannerTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  liveJoinBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  liveJoinBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Dynamic Enrolled Program Card
  enrolledProgramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  progIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrolledProgramTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  enrolledProgramSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  enrolledStatusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  enrolledStatusText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '700',
  },

  // Dynamic Enrolled Course Card
  enrolledCourseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  courseIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrolledCourseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  enrolledCourseSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  enrolledCoursePercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  courseProgressBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  courseProgressBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
});
