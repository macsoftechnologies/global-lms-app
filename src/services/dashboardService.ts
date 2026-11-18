import { ApiClient } from './api';
import { AuthStorage, AuthSession } from './authStorage';
import { ENV } from '../config/env';
import { LmsAuthService, buildUploadFormData } from './lmsAuthService';
import {
  ApiResponse,
  StudentEnrollmentItem,
  StudentProgramEnrollment,
  LiveSessionItem,
  NotificationItem,
  StudentResultSummary,
  CertificateItem,
  PaymentRecord,
  DashboardStats,
  ProgramOption,
  PublishedCourse,
  CoursePaginationMeta,
  CoursesListResponse,
  CourseModule,
  CourseLesson,
  LessonProgressEntry,
  WatchTimeUpdateResponse,
  CourseProgressData,
  LessonAiStudyData,
  LessonAiQuestion,
  LessonAiBackstoryItem,
  LessonAiFlashcardItem,
  LessonAiLatestAttempt,
  LessonAiQuizSubmitAnswerPayload,
  LessonAiQuizSubmitResponse,
  CourseAccessVerification,
  GenerateInvoiceResponse,
  MyGradesResponse,
  ExamResultItem,
  ExamAttemptItem,
  AttemptReviewResponse,
  VideoQuizResultItem,
  CyclicSemesterStatusResponse,
  VideoLessonTranscript,
  RequestCertificateResponse,
  LiveSessionFilterParams,
  NotificationsPaginatedResponse,
  NotificationsPaginationMeta,
  CourseAssignmentItem,
  AssignmentSubmissionItem,
  CourseExamItem,
  ExamQuestionItem,
  ExamStartAttemptResponse,
  ExamAnswerDraftPayload,
  ExamSubmitPayload,
  VideoQuizItem,
  VideoQuizSubmitPayload,
  VideoQuizSubmitResponse,
  VideoQuizMyAnswerItem,
} from '../types';

function unwrapArrayPayload(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data;
      if (Array.isArray(nested.items)) return nested.items;
    }
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.sessions)) return obj.sessions;
    if (Array.isArray(obj.notifications)) return obj.notifications;
  }
  return [];
}

function extractAiErrorMessage(data: unknown, fallback?: string): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
    if (Array.isArray(obj.message) && obj.message.length > 0) {
      return obj.message.map(String).join(', ');
    }
  }
  return fallback || 'Failed to load lesson AI study data.';
}

function normalizeLatestAiAttempt(raw: unknown): LessonAiLatestAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const score = typeof obj.score === 'number' ? obj.score : Number(obj.score);
  const totalQuestions =
    typeof obj.totalQuestions === 'number'
      ? obj.totalQuestions
      : typeof obj.total_questions === 'number'
        ? obj.total_questions
        : Number(obj.totalQuestions ?? obj.total_questions);

  if (Number.isNaN(score) && Number.isNaN(totalQuestions)) {
    return null;
  }

  return {
    id: obj.id ? String(obj.id) : obj._id ? String(obj._id) : undefined,
    score: Number.isNaN(score) ? 0 : score,
    totalQuestions: Number.isNaN(totalQuestions) ? 0 : totalQuestions,
    percentage: typeof obj.percentage === 'number' ? obj.percentage : undefined,
    completedAt:
      typeof obj.completedAt === 'string'
        ? obj.completedAt
        : typeof obj.completed_at === 'string'
          ? obj.completed_at
          : typeof obj.createdAt === 'string'
            ? obj.createdAt
            : undefined,
    attemptNumber: typeof obj.attemptNumber === 'number' ? obj.attemptNumber : undefined,
    passed: typeof obj.passed === 'boolean' ? obj.passed : undefined,
  };
}

function normalizeLiveSession(rawInput: unknown): LiveSessionItem {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = String(raw.id || raw._id || '');

  const courseObj =
    raw.course && typeof raw.course === 'object'
      ? (raw.course as Record<string, unknown>)
      : raw.courseId && typeof raw.courseId === 'object'
        ? (raw.courseId as Record<string, unknown>)
        : undefined;

  const batchObj =
    raw.batch && typeof raw.batch === 'object'
      ? (raw.batch as Record<string, unknown>)
      : raw.batchId && typeof raw.batchId === 'object'
        ? (raw.batchId as Record<string, unknown>)
        : undefined;

  const facultyObj =
    (raw.faculty && typeof raw.faculty === 'object' ? (raw.faculty as Record<string, unknown>) : null) ||
    (raw.instructor && typeof raw.instructor === 'object' ? (raw.instructor as Record<string, unknown>) : null) ||
    (raw.facultyId && typeof raw.facultyId === 'object' ? (raw.facultyId as Record<string, unknown>) : null) ||
    (raw.host && typeof raw.host === 'object' ? (raw.host as Record<string, unknown>) : null) ||
    undefined;

  const courseId =
    typeof raw.courseId === 'string' && raw.courseId.trim()
      ? raw.courseId.trim()
      : courseObj && (courseObj.id || courseObj._id)
        ? String(courseObj.id || courseObj._id)
        : undefined;

  const batchId =
    typeof raw.batchId === 'string' && raw.batchId.trim()
      ? raw.batchId.trim()
      : batchObj && (batchObj.id || batchObj._id)
        ? String(batchObj.id || batchObj._id)
        : undefined;

  const facultyId =
    typeof raw.facultyId === 'string' && raw.facultyId.trim()
      ? raw.facultyId.trim()
      : facultyObj && (facultyObj.id || facultyObj._id)
        ? String(facultyObj.id || facultyObj._id)
        : undefined;

  const courseTitle =
    (typeof raw.courseTitle === 'string' && raw.courseTitle.trim()) ||
    (typeof courseObj?.title === 'string' && courseObj.title.trim()) ||
    (typeof courseObj?.name === 'string' && courseObj.name.trim()) ||
    undefined;

  const batchName =
    (typeof raw.batchName === 'string' && raw.batchName.trim()) ||
    (typeof batchObj?.name === 'string' && batchObj.name.trim()) ||
    undefined;

  const instructorName =
    (typeof raw.instructorName === 'string' && raw.instructorName.trim()) ||
    (typeof raw.facultyName === 'string' && raw.facultyName.trim()) ||
    (typeof raw.hostName === 'string' && raw.hostName.trim()) ||
    (typeof facultyObj?.fullName === 'string' && facultyObj.fullName.trim()) ||
    (typeof facultyObj?.name === 'string' && facultyObj.name.trim()) ||
    undefined;

  const rawUrlCandidate =
    raw.meetingUrl || raw.joinUrl || raw.meetingLink || raw.zoomJoinUrl || raw.zoomUrl;
  const trimmedUrl = typeof rawUrlCandidate === 'string' ? rawUrlCandidate.trim() : '';
  const resolvedMeetingUrl = trimmedUrl
    ? /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`
    : undefined;

  const rawStatus = typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim().toUpperCase() : undefined;

  return {
    ...(raw as unknown as LiveSessionItem),
    id,
    _id: typeof raw._id === 'string' ? raw._id : undefined,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '',
    courseId,
    courseTitle,
    course: courseObj as LiveSessionItem['course'],
    batchId,
    batchName,
    batch: batchObj as LiveSessionItem['batch'],
    facultyId,
    instructorName,
    faculty: facultyObj as LiveSessionItem['faculty'],
    instructor: (raw.instructor && typeof raw.instructor === 'object' ? raw.instructor : undefined) as LiveSessionItem['instructor'],
    sessionNumber: typeof raw.sessionNumber === 'number' ? raw.sessionNumber : undefined,
    scheduledDate: typeof raw.scheduledDate === 'string' ? raw.scheduledDate : undefined,
    scheduledTime: typeof raw.scheduledTime === 'string' ? raw.scheduledTime : undefined,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : undefined,
    endTime: typeof raw.endTime === 'string' ? raw.endTime : undefined,
    meetingUrl: resolvedMeetingUrl,
    agenda: typeof raw.agenda === 'string' ? raw.agenda : typeof raw.description === 'string' ? raw.description : undefined,
    hasAttended: typeof raw.hasAttended === 'boolean' ? raw.hasAttended : undefined,
    attendees: Array.isArray(raw.attendees) ? (raw.attendees as string[]) : undefined,
    canJoin: typeof raw.canJoin === 'boolean' ? raw.canJoin : undefined,
    status: rawStatus,
  };
}

function normalizeNotification(rawInput: unknown): NotificationItem {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const id = String(raw.id || raw._id || '');
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '';
  const message =
    (typeof raw.message === 'string' && raw.message.trim()) ||
    (typeof raw.body === 'string' && raw.body.trim()) ||
    (typeof raw.content === 'string' && raw.content.trim()) ||
    '';

  const isRead =
    typeof raw.isRead === 'boolean'
      ? raw.isRead
      : typeof raw.read === 'boolean'
        ? raw.read
        : Boolean(raw.readAt);

  return {
    ...(raw as unknown as NotificationItem),
    id,
    _id: typeof raw._id === 'string' ? raw._id : undefined,
    title,
    message,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    readAt: typeof raw.readAt === 'string' ? raw.readAt : undefined,
    isRead,
    type: typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : undefined,
    link: typeof raw.link === 'string' ? raw.link : typeof raw.actionUrl === 'string' ? raw.actionUrl : undefined,
    actionUrl: typeof raw.actionUrl === 'string' ? raw.actionUrl : undefined,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : undefined,
  };
}

/**
 * DashboardService
 * 
 * Provides centralized API calls for both Student and Faculty Dashboards,
 * strictly matching the Student LMS API Collection and Developer Handbook.
 */
export const DashboardService = {
  /**
   * 1. Get Current User Profile
   * Matches Postman: GET /users/me
   */
  async getCurrentUser(): Promise<ApiResponse<AuthSession['user']>> {
    const response = await ApiClient.get<{ data?: AuthSession['user'] } | AuthSession['user']>('users/me');

    if (response.success && response.data) {
      const userData =
        'data' in response.data && (response.data as { data: AuthSession['user'] }).data
          ? (response.data as { data: AuthSession['user'] }).data
          : (response.data as AuthSession['user']);

      // Update locally cached user profile in AuthStorage
      if (userData?.id) {
        const currentToken = await AuthStorage.getAccessToken();
        const currentRefreshToken = await AuthStorage.getRefreshToken();
        const currentRole = await AuthStorage.getUserRole();
        if (currentToken) {
          await AuthStorage.saveSession({
            accessToken: currentToken,
            refreshToken: currentRefreshToken || undefined,
            role: currentRole || 'student',
            user: userData,
          });
        }
      }

      return {
        status: response.status,
        success: true,
        data: userData,
      };
    }

    // Fallback to locally stored user profile if offline/cached
    const localUser = await AuthStorage.getUser();
    if (localUser) {
      return {
        status: 200,
        success: true,
        data: localUser,
      };
    }

    return response as ApiResponse<AuthSession['user']>;
  },

  /**
   * 2. Get Student Enrolled Courses
   * Matches Postman: GET /students/me/enrollments (or /students/:studentId/enrollments)
   */
  async getStudentEnrollments(
    studentId: string = 'me'
  ): Promise<ApiResponse<StudentEnrollmentItem[]>> {
    const id = studentId || 'me';
    let endpoint = `students/${encodeURIComponent(id)}/enrollments`;
    let response = await ApiClient.get<unknown>(endpoint);

    // If 'me' failed or vice-versa, attempt fallback with authenticated user ID
    if (!response.success && id === 'me') {
      const user = await AuthStorage.getUser();
      if (user?.id) {
        response = await ApiClient.get<unknown>(`students/${encodeURIComponent(user.id)}/enrollments`);
      }
    } else if (!response.success && id !== 'me') {
      response = await ApiClient.get<unknown>(`students/me/enrollments`);
    }

    if (response.success && response.data) {
      const raw = response.data;
      const rawList = unwrapArrayPayload(raw);
      const list: StudentEnrollmentItem[] = (rawList as any[]).map((e) => {
        if (!e || typeof e !== 'object') return e;
        const courseObj =
          e.course && typeof e.course === 'object'
            ? e.course
            : e.courseId && typeof e.courseId === 'object'
            ? e.courseId
            : undefined;

        const cleanCourseId =
          typeof e.courseId === 'string' && e.courseId.trim()
            ? e.courseId.trim()
            : courseObj && (courseObj.id || courseObj._id)
            ? String(courseObj.id || courseObj._id)
            : typeof e.id === 'string'
            ? e.id
            : '';

        const progress =
          typeof e.progressPercentage === 'number'
            ? e.progressPercentage
            : typeof e.progress === 'number'
            ? e.progress
            : Number(e.progressPercentage ?? e.progress) || 0;

        return {
          ...e,
          id: String(e.id || e._id || cleanCourseId),
          courseId: cleanCourseId,
          course: courseObj ? { ...courseObj, id: String(courseObj.id || courseObj._id || cleanCourseId) } : e.course,
          progressPercentage: Math.min(100, Math.max(0, progress)),
        };
      });

      return {
        status: response.status,
        success: true,
        data: list,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 3. Compute Dashboard Stats from Enrollments
   */
  computeDashboardStats(enrollments: StudentEnrollmentItem[]): DashboardStats {
    if (!enrollments || enrollments.length === 0) {
      return {
        enrolled: 0,
        inProgress: 0,
        completed: 0,
        avgProgress: 0,
      };
    }

    const enrolled = enrollments.length;
    let completed = 0;
    let inProgress = 0;
    let totalProgress = 0;

    for (const item of enrollments) {
      const p = typeof item.progressPercentage === 'number' ? item.progressPercentage : Number(item.progressPercentage) || 0;
      const status = (item.status || '').toUpperCase();
      totalProgress += p;
      if (p >= 100 || status === 'COMPLETED') {
        completed += 1;
      } else {
        inProgress += 1;
      }
    }

    const avgProgress = enrolled > 0 ? Math.round(totalProgress / enrolled) : 0;

    return {
      enrolled,
      inProgress,
      completed,
      avgProgress,
    };
  },

  /**
   * 4. Get Student Enrolled Programs
   * Matches Postman: GET /students/me/programs (or /students/:studentId/programs)
   */
  async getStudentPrograms(
    studentId: string = 'me'
  ): Promise<ApiResponse<StudentProgramEnrollment[]>> {
    const id = studentId || 'me';
    let endpoint = `students/${encodeURIComponent(id)}/programs`;
    let response = await ApiClient.get<
      StudentProgramEnrollment[] | { data: StudentProgramEnrollment[] }
    >(endpoint);

    // If 'me' failed or vice-versa, attempt fallback with authenticated user ID
    if (!response.success && id === 'me') {
      const user = await AuthStorage.getUser();
      if (user?.id) {
        response = await ApiClient.get<
          StudentProgramEnrollment[] | { data: StudentProgramEnrollment[] }
        >(`students/${encodeURIComponent(user.id)}/programs`);
      }
    } else if (!response.success && id !== 'me') {
      response = await ApiClient.get<
        StudentProgramEnrollment[] | { data: StudentProgramEnrollment[] }
      >(`students/me/programs`);
    }

    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: StudentProgramEnrollment[] }).data)
          ? (raw as { data: StudentProgramEnrollment[] }).data
          : [];

      return {
        status: response.status,
        success: true,
        data: list,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 5. Get Upcoming Live Interactive Virtual Classes
   * Matches Postman: GET /live-sessions/student/upcoming
   */
  async getUpcomingLiveSessions(): Promise<ApiResponse<LiveSessionItem[]>> {
    const response = await ApiClient.get<unknown>('live-sessions/student/upcoming');

    if (response.success && response.data !== undefined) {
      const list = unwrapArrayPayload(response.data).map(normalizeLiveSession);
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 5b. Get Live Sessions List (with optional courseId / batchId filters)
   * Matches Postman: GET /live-sessions?courseId=...&batchId=...
   */
  async getLiveSessions(filters?: LiveSessionFilterParams): Promise<ApiResponse<LiveSessionItem[]>> {
    const params: string[] = [];
    if (filters?.courseId && filters.courseId.trim()) {
      params.push(`courseId=${encodeURIComponent(filters.courseId.trim())}`);
    }
    if (filters?.batchId && filters.batchId.trim()) {
      params.push(`batchId=${encodeURIComponent(filters.batchId.trim())}`);
    }
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    const response = await ApiClient.get<unknown>(`live-sessions${query}`);

    if (response.success && response.data !== undefined) {
      const list = unwrapArrayPayload(response.data).map(normalizeLiveSession);
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 6. Get Unread Notifications Count (Structured Result)
   * Matches Postman: GET /notifications/unread-count
   */
  async getUnreadNotificationCountResult(): Promise<ApiResponse<number>> {
    const response = await ApiClient.get<unknown>('notifications/unread-count');

    if (response.success && response.data !== undefined) {
      const raw = response.data as Record<string, unknown>;
      const nested = raw?.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : null;
      const countCandidate =
        raw?.count ??
        raw?.unreadCount ??
        nested?.count ??
        nested?.unreadCount ??
        (typeof response.data === 'number' ? response.data : 0);

      const count = typeof countCandidate === 'number' ? countCandidate : Number(countCandidate) || 0;
      return {
        status: response.status,
        success: true,
        data: Math.max(0, count),
      };
    }

    return {
      status: response.status,
      success: false,
      data: 0,
      error: response.error,
    };
  },

  /**
   * 6b. Get Unread Notifications Count (numeric helper for existing callers)
   * Matches Postman: GET /notifications/unread-count
   */
  async getUnreadNotificationCount(): Promise<number> {
    try {
      const res = await this.getUnreadNotificationCountResult();
      return res.success && typeof res.data === 'number' ? res.data : 0;
    } catch {
      return 0;
    }
  },

  /**
   * 7. Get Notifications List (Paginated Feed + Meta)
   * Matches Postman: GET /notifications?page=1&limit=20
   */
  async getNotificationsPaginated(
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<NotificationsPaginatedResponse>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const response = await ApiClient.get<unknown>(`notifications?page=${safePage}&limit=${safeLimit}`);

    if (response.success && response.data !== undefined) {
      const items = unwrapArrayPayload(response.data).map(normalizeNotification);
      const rawObj =
        response.data && typeof response.data === 'object' && !Array.isArray(response.data)
          ? (response.data as Record<string, unknown>)
          : {};
      const dataObj =
        rawObj.data && typeof rawObj.data === 'object' && !Array.isArray(rawObj.data)
          ? (rawObj.data as Record<string, unknown>)
          : {};
      const metaRaw =
        (rawObj.meta as Record<string, unknown> | undefined) ||
        (rawObj.pagination as Record<string, unknown> | undefined) ||
        (dataObj.meta as Record<string, unknown> | undefined) ||
        (dataObj.pagination as Record<string, unknown> | undefined) ||
        null;

      const parsedPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? safePage) || safePage;
      const parsedLimit = Number(metaRaw?.limit ?? metaRaw?.perPage ?? safeLimit) || safeLimit;
      const parsedTotalItems = Number(
        metaRaw?.totalItems ?? metaRaw?.total ?? metaRaw?.totalCount ?? items.length
      );
      const parsedTotalPages =
        Number(metaRaw?.totalPages ?? metaRaw?.pages) ||
        (parsedTotalItems > 0 ? Math.max(1, Math.ceil(parsedTotalItems / parsedLimit)) : 1);
      const hasMore =
        typeof metaRaw?.hasMore === 'boolean'
          ? metaRaw.hasMore
          : metaRaw !== null
            ? parsedPage < parsedTotalPages
            : items.length >= safeLimit;

      const meta: NotificationsPaginationMeta = {
        page: parsedPage,
        limit: parsedLimit,
        totalItems: Number.isFinite(parsedTotalItems) ? parsedTotalItems : items.length,
        totalPages: Number.isFinite(parsedTotalPages) ? Math.max(1, parsedTotalPages) : 1,
        hasMore,
      };

      return {
        status: response.status,
        success: true,
        data: { items, meta },
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: {
        items: [],
        meta: { page: safePage, limit: safeLimit, totalItems: 0, totalPages: 1, hasMore: false },
      },
      error: response.error,
    };
  },

  /**
   * 7b. Get Notifications List (array helper for backwards compatibility)
   * Matches Postman: GET /notifications?page=1&limit=20
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<NotificationItem[]>> {
    const res = await this.getNotificationsPaginated(page, limit);
    return {
      status: res.status,
      success: res.success,
      data: res.data?.items || [],
      error: res.error,
    };
  },

  /**
   * 7c. Mark Single Notification As Read
   * Matches Postman: PATCH /notifications/:notificationId/read
   */
  async markNotificationAsRead(notificationId: string): Promise<ApiResponse<unknown>> {
    if (!notificationId || !notificationId.trim()) {
      return { status: 400, success: false, error: 'Missing notification ID.' };
    }
    return ApiClient.patch<unknown>(
      `notifications/${encodeURIComponent(notificationId.trim())}/read`,
      {}
    );
  },

  /**
   * 7d. Mark All Notifications As Read
   * Matches Postman: POST /notifications/mark-all-read
   */
  async markAllNotificationsAsRead(): Promise<ApiResponse<unknown>> {
    return ApiClient.post<unknown>('notifications/mark-all-read', {});
  },

  /**
   * 8. Get Cumulative Results
   * Matches Postman: GET /results/student
   */
  async getStudentResults(): Promise<ApiResponse<StudentResultSummary>> {
    const response = await ApiClient.get<
      StudentResultSummary | { data: StudentResultSummary }
    >('results/student');

    if (response.success && response.data) {
      const raw = response.data;
      const data =
        'data' in raw && (raw as { data: StudentResultSummary }).data
          ? (raw as { data: StudentResultSummary }).data
          : (raw as StudentResultSummary);

      return {
        status: response.status,
        success: true,
        data,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: {},
      error: response.error,
    };
  },

  /**
   * 8b. Get My Official Grades / Transcript
   * Matches Website o0() and Postman: GET /transcripts/my-grades
   */
  async getMyGrades(): Promise<ApiResponse<MyGradesResponse>> {
    const response = await ApiClient.get<MyGradesResponse | { data: MyGradesResponse }>('transcripts/my-grades');
    if (response.success && response.data) {
      const raw = response.data;
      const data: MyGradesResponse =
        'data' in raw && (raw as { data: MyGradesResponse }).data
          ? (raw as { data: MyGradesResponse }).data
          : (raw as MyGradesResponse);
      const gradesList = Array.isArray(data?.grades) ? data.grades : [];
      return {
        status: response.status,
        success: true,
        data: {
          ...data,
          grades: gradesList,
        },
      };
    }
    return {
      status: response.status,
      success: response.success,
      data: { grades: [] },
      error: response.error,
    };
  },

  /**
   * 8c. Get All Student Exam Attempts
   * Matches Website Vde() and Postman: GET /results/student/attempts
   */
  async getStudentAttempts(): Promise<ApiResponse<ExamAttemptItem[]>> {
    const response = await ApiClient.get<ExamAttemptItem[] | { data: ExamAttemptItem[] }>('results/student/attempts');
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: ExamAttemptItem[] }).data)
          ? (raw as { data: ExamAttemptItem[] }).data
          : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 8d. Get All Video Quiz Results
   * Matches Website Hde() and Postman: GET /results/student/video-quizzes
   */
  async getVideoQuizResults(): Promise<ApiResponse<VideoQuizResultItem[]>> {
    const response = await ApiClient.get<VideoQuizResultItem[] | { data: VideoQuizResultItem[] }>('results/student/video-quizzes');
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: VideoQuizResultItem[] }).data)
          ? (raw as { data: VideoQuizResultItem[] }).data
          : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 8e. Get Final Exam Results (Published student results)
   * Matches Website Bde() and Postman: GET /results/student
   */
  async getFinalExamResults(): Promise<ApiResponse<ExamResultItem[]>> {
    const response = await ApiClient.get<any>('results/student');
    if (response.success && response.data) {
      const raw = response.data;
      let list: ExamResultItem[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        const anyRaw = raw as Record<string, any>;
        if (Array.isArray(anyRaw.data)) list = anyRaw.data;
        else if (Array.isArray(anyRaw.results)) list = anyRaw.results;
        else if (Array.isArray(anyRaw.grades)) list = anyRaw.grades;
      }
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 8f. Get Final Exam Result for a Specific Exam
   * Matches Postman: GET /exams/:examId/my-result
   */
  async getExamResult(examId: string): Promise<ApiResponse<ExamResultItem>> {
    const response = await ApiClient.get<ExamResultItem | { data: ExamResultItem }>(
      `exams/${encodeURIComponent(examId)}/my-result`
    );
    if (response.success && response.data) {
      const raw = response.data;
      const data =
        'data' in raw && (raw as { data: ExamResultItem }).data
          ? (raw as { data: ExamResultItem }).data
          : (raw as ExamResultItem);
      return {
        status: response.status,
        success: true,
        data,
      };
    }
    return response as ApiResponse<ExamResultItem>;
  },

  /**
   * 8g. Review Specific Attempt & Answers
   * Matches Postman: GET /exams/:examId/attempts/:attemptId/review
   */
  async getExamAttemptReview(examId: string, attemptId: string): Promise<ApiResponse<AttemptReviewResponse>> {
    const response = await ApiClient.get<AttemptReviewResponse | { data: AttemptReviewResponse }>(
      `exams/${encodeURIComponent(examId)}/attempts/${encodeURIComponent(attemptId)}/review`
    );
    if (response.success && response.data) {
      const raw = response.data;
      const data =
        'data' in raw && (raw as { data: AttemptReviewResponse }).data
          ? (raw as { data: AttemptReviewResponse }).data
          : (raw as AttemptReviewResponse);
      return {
        status: response.status,
        success: true,
        data,
      };
    }
    return response as ApiResponse<AttemptReviewResponse>;
  },

  /**
   * 8h-1. List Course Assignments
   * Matches Postman: GET /courses/:courseId/assignments
   */
  async getCourseAssignments(courseId: string): Promise<ApiResponse<CourseAssignmentItem[]>> {
    const response = await ApiClient.get<any>(`courses/${encodeURIComponent(courseId)}/assignments`);
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.assignments)
            ? raw.assignments
            : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: false,
      data: [],
      error: response.error || 'Failed to fetch assignments',
    };
  },

  /**
   * 8h-2. Get Assignment Submissions
   * Matches Postman: GET /courses/:courseId/assignments/:assignmentId/submissions
   */
  async getAssignmentSubmissions(
    courseId: string,
    assignmentId: string
  ): Promise<ApiResponse<AssignmentSubmissionItem[]>> {
    const response = await ApiClient.get<any>(
      `courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`
    );
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.submissions)
            ? raw.submissions
            : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: false,
      data: [],
      error: response.error,
    };
  },

  /**
   * 8h-3. Submit Assignment File
   * Matches Postman: POST /courses/:courseId/assignments/:assignmentId/submit
   * Multipart/form-data with field name 'file'
   */
  async submitAssignmentFile(
    courseId: string,
    assignmentId: string,
    file: { uri: string; name: string; type?: string; size?: number }
  ): Promise<ApiResponse<any>> {
    try {
      const formData = await buildUploadFormData({
        uri: file.uri,
        name: file.name,
        mimeType: file.type,
        fieldName: 'file',
      });
      const endpoint = `courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submit`;
      const response = await ApiClient.upload<any>(endpoint, formData);
      return response;
    } catch (err: unknown) {
      return {
        status: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      };
    }
  },

  /**
   * 8h-4. List Exams for Course
   * Matches Postman: GET /courses/:courseId/exams
   */
  async getCourseExams(courseId: string): Promise<ApiResponse<CourseExamItem[]>> {
    const response = await ApiClient.get<any>(`courses/${encodeURIComponent(courseId)}/exams`);
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.exams)
            ? raw.exams
            : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: false,
      data: [],
      error: response.error || 'Failed to fetch course exams',
    };
  },

  /**
   * 8h-5. Get Exam Details & Guidelines
   * Matches Postman: GET /exams/:examId
   */
  async getExamDetails(examId: string): Promise<ApiResponse<CourseExamItem>> {
    const response = await ApiClient.get<any>(`exams/${encodeURIComponent(examId)}`);
    if (response.success && response.data) {
      const raw = response.data;
      const item = raw && typeof raw === 'object' && 'data' in raw && raw.data ? raw.data : raw;
      return {
        status: response.status,
        success: true,
        data: item,
      };
    }
    return {
      status: response.status,
      success: false,
      data: null as any,
      error: response.error || 'Failed to fetch exam details',
    };
  },

  /**
   * 8h-6. Start Exam Attempt
   * Matches Postman: POST /exams/:examId/start
   */
  async startExamAttempt(examId: string): Promise<ApiResponse<ExamStartAttemptResponse>> {
    const response = await ApiClient.post<any>(`exams/${encodeURIComponent(examId)}/start`, {});
    if (response.success && response.data) {
      const raw = response.data;
      const attempt = raw && typeof raw === 'object' && 'data' in raw && raw.data ? raw.data : raw;
      return {
        status: response.status,
        success: true,
        data: attempt,
      };
    }
    return {
      status: response.status,
      success: false,
      data: null as any,
      error: response.error || 'Failed to start exam attempt',
    };
  },

  /**
   * 8h-7. Get Exam Questions
   * Matches Postman: GET /exams/:examId/questions
   */
  async getExamQuestions(examId: string): Promise<ApiResponse<ExamQuestionItem[]>> {
    const response = await ApiClient.get<any>(`exams/${encodeURIComponent(examId)}/questions`);
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.questions)
            ? raw.questions
            : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: false,
      data: [],
      error: response.error || 'Failed to fetch exam questions',
    };
  },

  /**
   * 8h-8. Save Draft Answer (Autosave)
   * Matches Postman: PATCH /exams/:examId/answers
   */
  async saveExamDraftAnswer(
    examId: string,
    payload: ExamAnswerDraftPayload
  ): Promise<ApiResponse<any>> {
    const response = await ApiClient.patch<any>(
      `exams/${encodeURIComponent(examId)}/answers`,
      payload
    );
    return response;
  },

  /**
   * 8h-9. Submit Exam Attempt
   * Matches Postman: POST /exams/:examId/submit
   */
  async submitExamAttempt(
    examId: string,
    payload: ExamSubmitPayload
  ): Promise<ApiResponse<any>> {
    const response = await ApiClient.post<any>(
      `exams/${encodeURIComponent(examId)}/submit`,
      payload
    );
    return response;
  },

  /**
   * 8h-10. Get My Attempt History for Exam
   * Matches Postman: GET /exams/:examId/attempts
   */
  async getExamAttempts(examId: string): Promise<ApiResponse<ExamAttemptItem[]>> {
    const response = await ApiClient.get<any>(`exams/${encodeURIComponent(examId)}/attempts`);
    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.attempts)
            ? raw.attempts
            : [];
      return {
        status: response.status,
        success: true,
        data: list,
      };
    }
    return {
      status: response.status,
      success: false,
      data: [],
      error: response.error || 'Failed to fetch exam attempts',
    };
  },

  /**
   * 8i. Get Lesson Captions / Transcript (Vimeo)
   * Matches Postman: GET /vimeo/transcript?lessonId=:lessonId
   */
  async getLessonTranscript(lessonId: string): Promise<ApiResponse<VideoLessonTranscript>> {
    const response = await ApiClient.get<any>(`vimeo/transcript?lessonId=${encodeURIComponent(lessonId)}`);
    if (response.success && response.data) {
      const raw = response.data.data || response.data;
      const cues = Array.isArray(raw.cues) ? raw.cues : Array.isArray(raw) ? raw : [];
      return {
        status: response.status,
        success: true,
        data: {
          lessonId,
          vimeoId: raw.vimeoId || raw.videoId,
          language: raw.language || 'en',
          cues,
        },
      };
    }
    return response as ApiResponse<VideoLessonTranscript>;
  },

  /**
   * 8j. Get All Course Transcripts
   * Matches Postman: GET /vimeo/course-transcripts?courseId=:courseId
   */
  async getCourseTranscripts(courseId: string): Promise<ApiResponse<any>> {
    return ApiClient.get<any>(`vimeo/course-transcripts?courseId=${encodeURIComponent(courseId)}`);
  },

  /**
   * Resolves certificate or document path into a fully qualified downloadable / viewable URL.
   * Matches web bundle wo() resolver: https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js:271859
   */
  resolveCertificateUrl(path?: string): string | null {
    if (!path || typeof path !== 'string') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const backendBase = ENV.API_URL.replace(/\/api\/v1\/?$/, '');
    let clean = path.replace(/\\/g, '/');
    if (clean.startsWith('/')) clean = clean.substring(1);
    if (clean.startsWith('public/')) clean = clean.substring(7);
    if (clean.startsWith('uploads/') && backendBase.includes('launchpaad.tech')) {
      clean = 'public/' + clean;
    }
    return `${backendBase}/${encodeURI(clean)}`;
  },

  /**
   * Helper to normalize a raw certificate object from backend responses.
   */
  normalizeCertificate(item: any): CertificateItem {
    const id = String(item.id || item._id || '');
    const certNo =
      item.certificateNumber ||
      item.certificateNo ||
      item.serialNumber ||
      item.certificateId ||
      item.number ||
      id;

    const courseTitle =
      item.course?.title ||
      (typeof item.courseId === 'object' && item.courseId?.title) ||
      item.courseTitle ||
      '';

    const programName =
      item.program?.name ||
      (typeof item.programId === 'object' && item.programId?.name) ||
      item.programName ||
      '';

    const title =
      item.title ||
      item.name ||
      item.certificateTitle ||
      courseTitle ||
      programName ||
      'Certificate of Completion';

    const issueDate = item.issuedAt || item.issueDate || item.createdAt || item.date;

    const rawStatus = String(item.status || 'ISSUED').toUpperCase();
    let status: CertificateItem['status'] = 'ISSUED';
    if (rawStatus.includes('PEND') || rawStatus === 'REQUESTED') {
      status = 'PENDING';
    } else if (rawStatus.includes('PROCESS')) {
      status = 'PROCESSING';
    } else if (rawStatus.includes('REJECT')) {
      status = 'REJECTED';
    } else if (rawStatus.includes('APPROV') || rawStatus === 'ISSUED') {
      status = 'ISSUED';
    } else {
      status = rawStatus;
    }

    const rawUrl =
      item.certificateUrl ||
      item.fileUrl ||
      item.pdfUrl ||
      item.downloadUrl ||
      item.url ||
      item.path ||
      item.documentUrl;
    const certificateUrl = this.resolveCertificateUrl(rawUrl) || undefined;

    const studentName =
      item.student?.fullName ||
      (typeof item.studentId === 'object' && item.studentId?.fullName) ||
      item.studentName ||
      item.recipientName ||
      '';

    const verificationCode =
      item.verificationCode ||
      item.verifyCode ||
      item.code ||
      item.hash ||
      certNo;

    const verificationUrl =
      item.verificationUrl ||
      item.verifyUrl ||
      (verificationCode ? `https://launchpaad.tech/verify/${encodeURIComponent(verificationCode)}` : undefined);

    return {
      ...item,
      id,
      _id: item._id,
      certificateNumber: certNo,
      certificateNo: certNo,
      serialNumber: item.serialNumber || certNo,
      title,
      courseTitle: courseTitle || undefined,
      programName: programName || undefined,
      course: item.course,
      program: item.program,
      studentName: studentName || undefined,
      student: item.student,
      issueDate,
      issuedAt: item.issuedAt,
      createdAt: item.createdAt,
      status,
      certificateUrl,
      pdfUrl: certificateUrl,
      fileUrl: certificateUrl,
      downloadUrl: certificateUrl,
      verificationCode,
      verificationUrl,
      grade: item.grade,
      score: item.score,
      credits: item.credits,
    };
  },

  /**
   * 9a. Get My Issued Certificates
   * Matches Website g0() and Postman: GET /certificates/my-certificates
   */
  async getMyCertificates(): Promise<ApiResponse<CertificateItem[]>> {
    const response = await ApiClient.get<any>('certificates/my-certificates');

    if (response.success && response.data) {
      const raw = response.data;
      const list: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.certificates)
            ? raw.certificates
            : Array.isArray(raw.items)
              ? raw.items
              : [];

      const normalizedList = list.map((item) => this.normalizeCertificate(item));

      return {
        status: response.status,
        success: true,
        data: normalizedList,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 9b. Get Certificate by ID
   * Matches Postman: GET /certificates/:certificateId
   */
  async getCertificateById(certificateId: string): Promise<ApiResponse<CertificateItem | null>> {
    const response = await ApiClient.get<any>(`certificates/${encodeURIComponent(certificateId)}`);

    if (response.success && response.data) {
      const raw = response.data;
      const certData = raw.data || raw.certificate || raw;
      const normalized = this.normalizeCertificate(certData);

      return {
        status: response.status,
        success: true,
        data: normalized,
      };
    }

    return {
      status: response.status,
      success: false,
      data: null,
      error: response.error || 'Certificate not found',
    };
  },

  /**
   * 9c. Request Certificate for Course
   * Matches Website m0() and Postman: POST /certificates/request
   * Body: { courseId: string }
   */
  async requestCertificate(courseId: string): Promise<ApiResponse<RequestCertificateResponse>> {
    const response = await ApiClient.post<any>('certificates/request', {
      courseId,
    });

    if (response.success && response.data) {
      const raw = response.data;
      const dataObj = raw.data || raw;

      return {
        status: response.status,
        success: true,
        data: {
          id: dataObj.id || dataObj._id,
          _id: dataObj._id,
          courseId,
          status: dataObj.status || 'PENDING',
          message: raw.message || 'Certificate requested successfully!',
          certificate: dataObj.id ? this.normalizeCertificate(dataObj) : undefined,
        },
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to request certificate. Please verify course completion eligibility.',
    };
  },

  /**
   * 9d. Get Certificate Status for Course
   * Matches Website _0: GET /certificates/courses/:courseId
   */
  async getCertificateForCourse(courseId: string): Promise<ApiResponse<CertificateItem | null>> {
    const response = await ApiClient.get<any>(`certificates/courses/${encodeURIComponent(courseId)}`);

    if (response.success && response.data) {
      const raw = response.data;
      const certData = raw.data || raw.certificate || raw;
      if (certData && (certData.id || certData._id || certData.status)) {
        return {
          status: response.status,
          success: true,
          data: this.normalizeCertificate(certData),
        };
      }
    }

    return {
      status: response.status,
      success: response.success,
      data: null,
      error: response.error,
    };
  },

  /**
   * Resolves invoice path returned by POST /payments/:paymentId/generate-invoice
   * into a fully qualified downloadable / viewable URL.
   * Matches web bundle wo() resolver: https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js:271859
   */
  resolveInvoiceUrl(path?: string): string | null {
    if (!path || typeof path !== 'string') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const backendBase = ENV.API_URL.replace(/\/api\/v1\/?$/, '');
    let clean = path.replace(/\\/g, '/');
    if (clean.startsWith('/')) clean = clean.substring(1);
    if (clean.startsWith('public/')) clean = clean.substring(7);
    if (clean.startsWith('uploads/') && backendBase.includes('launchpaad.tech')) {
      clean = 'public/' + clean;
    }
    return `${backendBase}/${encodeURI(clean)}`;
  },

  /**
   * 10. Get Payment History & Tuition Status
   * Matches Postman: GET /payments/my-payments?page=1&limit=10
   */
  async getMyPayments(
    page: number = 1,
    limit: number = 10
  ): Promise<ApiResponse<PaymentRecord[]> & { meta?: CoursePaginationMeta }> {
    const response = await ApiClient.get<any>(`payments/my-payments?page=${page}&limit=${limit}`);

    if (response.success && response.data) {
      const raw = response.data;
      const list: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.items)
            ? raw.items
            : [];

      const rawMeta = raw.meta || raw.pagination || {};
      const totalCount = Number(rawMeta.totalItems ?? (rawMeta.total || (raw.total || list.length)));
      const totalPages = Number((rawMeta.totalPages ?? (rawMeta.pages || Math.ceil(totalCount / limit))) || 1);

      const meta: CoursePaginationMeta = {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: totalCount,
        totalPages: totalPages,
        page,
        limit,
        total: totalCount,
      };

      const normalizedList: PaymentRecord[] = list.map((item: any) => {
        const id = String(item.id || item._id || '');
        const courseTitle =
          item.course?.title ||
          (typeof item.courseId === 'object' && item.courseId?.title) ||
          item.courseTitle ||
          '';
        const programName =
          item.program?.name ||
          (typeof item.programId === 'object' && item.programId?.name) ||
          item.programName ||
          '';
        const description =
          courseTitle ||
          programName ||
          item.description ||
          item.title ||
          'Academic Tuition Fee';

        const rawAmount = typeof item.amount === 'number' ? item.amount : Number(item.amount ?? item.totalAmount ?? item.feeAmount ?? 0);
        const amount = isNaN(rawAmount) ? 0 : rawAmount;
        const currency = item.currency || 'INR';
        const rawDate = item.createdAt || item.paymentDate || item.paidAt || item.date;

        return {
          id,
          _id: String(item._id || id),
          amount,
          currency,
          status: String(item.status || 'PAID').toUpperCase(),
          invoiceNumber: item.invoiceNumber || item.invoice_number || (id ? `INV-${id.slice(0, 8).toUpperCase()}` : 'INVOICE'),
          description,
          paymentDate: rawDate,
          createdAt: item.createdAt || rawDate,
          paidAt: item.paidAt || (item.status === 'PAID' ? rawDate : undefined),
          paymentMethod: item.paymentMethod || item.method || 'Online',
          courseTitle: courseTitle || undefined,
          programName: programName || undefined,
          course: item.course,
          courseId: item.courseId,
          program: item.program,
          programId: item.programId,
          invoicePath: item.invoicePath,
          invoiceUrl: this.resolveInvoiceUrl(item.invoicePath || item.pdfUrl) || undefined,
        };
      });

      return {
        status: response.status,
        success: true,
        data: normalizedList,
        meta,
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to retrieve payment records',
      data: [],
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: 0,
        totalPages: 1,
      },
    };
  },

  /**
   * 10.1. Generate / Download Invoice
   * Matches Postman: POST /payments/:paymentId/generate-invoice
   */
  async generateInvoice(
    paymentId: string
  ): Promise<ApiResponse<GenerateInvoiceResponse>> {
    if (!paymentId || paymentId.trim().length === 0) {
      return {
        status: 400,
        success: false,
        error: 'Invalid payment ID: paymentId is required to generate an invoice.',
        data: {},
      };
    }

    const cleanId = encodeURIComponent(paymentId.trim());
    const response = await ApiClient.post<any>(`payments/${cleanId}/generate-invoice`, {});

    if (response.success && response.data) {
      const raw = response.data;
      const invoicePath =
        raw.invoicePath ||
        raw.data?.invoicePath ||
        (typeof raw.data === 'string' ? raw.data : undefined) ||
        (typeof raw === 'string' ? raw : undefined);
      const invoiceUrl = this.resolveInvoiceUrl(invoicePath);

      return {
        status: response.status,
        success: true,
        data: {
          ...raw,
          invoicePath,
          invoiceUrl: invoiceUrl || undefined,
        },
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to generate invoice. Please verify payment ID.',
      data: {},
    };
  },

  /**
   * 11. Browse Public Programs Catalog
   * Matches Postman: GET /programs/public?limit=100&slug=cotr
   */
  async getPublicPrograms(
    limit: number = 100,
    slug?: string,
    options?: { page?: number; forceRefresh?: boolean }
  ): Promise<ApiResponse<ProgramOption[]>> {
    return LmsAuthService.getAvailablePrograms(slug, {
      limit,
      page: options?.page,
      forceRefresh: options?.forceRefresh,
    });
  },

  /**
   * 11b. Browse Academic Programs Catalog (Authenticated with Public fallback)
   * Matches Postman: GET /programs
   */
  async getAcademicPrograms(): Promise<ApiResponse<ProgramOption[]>> {
    try {
      const response = await ApiClient.get<
        ProgramOption[] | { data: ProgramOption[] }
      >('programs');

      if (response.success && response.data) {
        const raw = response.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data: ProgramOption[] }).data)
            ? (raw as { data: ProgramOption[] }).data
            : [];

        if (list.length > 0) {
          return {
            status: response.status,
            success: true,
            data: list,
          };
        }
      }
    } catch {
      // Fallback to public endpoint
    }

    // Graceful fallback to verified public programs endpoint using active org slug
    return this.getPublicPrograms(100);
  },

  /**
   * 11c. Get Program Details by ID
   * Matches Postman: GET /programs/:programId
   */
  async getProgramById(programId: string): Promise<ApiResponse<ProgramOption | null>> {
    try {
      const response = await ApiClient.get<
        ProgramOption | { data: ProgramOption }
      >(`programs/${encodeURIComponent(programId)}`);

      if (response.success && response.data) {
        const raw = response.data;
        const program = ('data' in (raw as object) && (raw as { data: ProgramOption }).data)
          ? (raw as { data: ProgramOption }).data
          : (raw as ProgramOption);

        return {
          status: response.status,
          success: true,
          data: program,
        };
      }
    } catch {
      // Fallback
    }

    // Search in public programs catalog for active organization
    const allRes = await this.getPublicPrograms(100);
    if (allRes.success && allRes.data) {
      const match = allRes.data.find(
        (p) => p.id === programId || (p as any)._id === programId
      );
      if (match) {
        return {
          status: 200,
          success: true,
          data: match,
        };
      }
    }

    return {
      status: 404,
      success: false,
      data: null,
      error: 'Program not found',
    };
  },

  /**
   * 11d. Get Courses for Program
   * Matches Postman:
   * 1. GET /courses?programId=:programId&limit=100
   * 2. GET /enrollments/my-program-courses?programId=:programId
   */
  async getCoursesForProgram(programId: string): Promise<ApiResponse<any[]>> {
    // 1. Primary: GET /courses?programId=:programId&limit=100
    const coursesRes = await ApiClient.get<any>(`courses?programId=${encodeURIComponent(programId)}&limit=100`);
    let list: any[] = [];

    if (coursesRes.success && coursesRes.data) {
      const raw = coursesRes.data;
      if (Array.isArray(raw)) list = raw;
      else if (raw && typeof raw === 'object') {
        const anyRaw = raw as Record<string, any>;
        if (Array.isArray(anyRaw.data)) list = anyRaw.data;
        else if (Array.isArray(anyRaw.courses)) list = anyRaw.courses;
        else if (Array.isArray(anyRaw.items)) list = anyRaw.items;
        else if (anyRaw.data && typeof anyRaw.data === 'object') {
          if (Array.isArray(anyRaw.data.courses)) list = anyRaw.data.courses;
          else if (Array.isArray(anyRaw.data.items)) list = anyRaw.data.items;
        }
      }
    }

    // 2. Secondary: GET /enrollments/my-program-courses?programId=:programId
    if (list.length === 0) {
      const enrollCoursesRes = await ApiClient.get<any>(`enrollments/my-program-courses?programId=${encodeURIComponent(programId)}`);
      if (enrollCoursesRes.success && enrollCoursesRes.data) {
        const raw = enrollCoursesRes.data;
        if (Array.isArray(raw)) list = raw;
        else if (raw && typeof raw === 'object') {
          const anyRaw = raw as Record<string, any>;
          if (Array.isArray(anyRaw.data)) list = anyRaw.data;
          else if (Array.isArray(anyRaw.courses)) list = anyRaw.courses;
          else if (Array.isArray(anyRaw.items)) list = anyRaw.items;
        }
      }
    }

    return {
      status: 200,
      success: true,
      data: list,
    };
  },

  /**
   * 11e. Get Semesters for Program
   * Matches Postman & Live Platform: GET /semesters?programId=:programId
   */
  async getSemestersForProgram(programId: string): Promise<ApiResponse<any[]>> {
    const endpoint = `semesters?programId=${encodeURIComponent(programId)}`;
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const raw = response.data;
      let list: any[] = [];
      if (Array.isArray(raw)) list = raw;
      else if (raw && typeof raw === 'object') {
        const anyRaw = raw as Record<string, any>;
        if (Array.isArray(anyRaw.data)) list = anyRaw.data;
        else if (Array.isArray(anyRaw.semesters)) list = anyRaw.semesters;
        else if (Array.isArray(anyRaw.items)) list = anyRaw.items;
      }

      return {
        status: response.status,
        success: true,
        data: list,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 11f. Get Course Exams Count
   * Matches Postman: GET /courses/:courseId/exams
   */
  async getCourseExamsCount(courseId: string): Promise<number> {
    try {
      const res = await ApiClient.get<any>(`courses/${encodeURIComponent(courseId)}/exams`);
      if (res.success && res.data) {
        const raw = res.data;
        if (Array.isArray(raw)) return raw.length;
        if (raw.data && Array.isArray(raw.data)) return raw.data.length;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * 11f. Get Cyclic Semester Status
   * Matches Postman: GET /semesters/student/:studentId/cyclic-status?programId=:programId
   */
  async getCyclicSemesterStatus(
    studentId: string = 'me',
    programId?: string
  ): Promise<ApiResponse<CyclicSemesterStatusResponse>> {
    const id = studentId || 'me';
    let endpoint = `semesters/student/${encodeURIComponent(id)}/cyclic-status`;
    if (programId) {
      endpoint += `?programId=${encodeURIComponent(programId)}`;
    }

    let response = await ApiClient.get<CyclicSemesterStatusResponse | { data: CyclicSemesterStatusResponse }>(endpoint);
    if (!response.success && id === 'me') {
      const user = await AuthStorage.getUser();
      if (user?.id) {
        let fallbackUrl = `semesters/student/${encodeURIComponent(user.id)}/cyclic-status`;
        if (programId) {
          fallbackUrl += `?programId=${encodeURIComponent(programId)}`;
        }
        response = await ApiClient.get<CyclicSemesterStatusResponse | { data: CyclicSemesterStatusResponse }>(fallbackUrl);
      }
    }

    if (response.success && response.data) {
      const raw = response.data;
      const data =
        'data' in raw && (raw as { data: CyclicSemesterStatusResponse }).data
          ? (raw as { data: CyclicSemesterStatusResponse }).data
          : (raw as CyclicSemesterStatusResponse);
      return {
        status: response.status,
        success: true,
        data,
      };
    }

    return response as ApiResponse<CyclicSemesterStatusResponse>;
  },

  /**
   * 11e. Self-Enroll in Program
   * Matches Postman: POST /enrollments/student/programs/:programId/enroll
   */
  async enrollInProgram(
    programId: string,
    batchId?: string,
    selectedCourseIds: string[] = []
  ): Promise<ApiResponse<any>> {
    return ApiClient.post<any>(
      `enrollments/student/programs/${encodeURIComponent(programId)}/enroll`,
      {
        batchId: batchId || '',
        selectedCourseIds,
      }
    );
  },

  /**
   * Enroll / Purchase Course directly (Individual Course Enrollment)
   * Matches Web LMS & Postman: POST /enrollments/student/courses/:courseId/enroll
   */
  async enrollInCourse(courseId: string): Promise<ApiResponse<any>> {
    return ApiClient.post<any>(
      `enrollments/student/courses/${encodeURIComponent(courseId)}/enroll`,
      {}
    );
  },

  /**
   * 12. Browse Published Courses (with Pagination)
   * Matches Postman: GET /courses?page=:page&limit=:limit&status=PUBLISHED
   */
  async getPublishedCourses(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<ApiResponse<{ courses: PublishedCourse[]; meta: CoursePaginationMeta }>> {
    let endpoint = `courses?page=${page}&limit=${limit}&status=PUBLISHED`;
    if (search && search.trim()) {
      endpoint += `&search=${encodeURIComponent(search.trim())}`;
    }

    const response = await ApiClient.get<
      PublishedCourse[] | CoursesListResponse | { data: PublishedCourse[]; meta?: CoursePaginationMeta }
    >(endpoint);

    if (response.success && response.data) {
      const raw = response.data;
      let courseList: PublishedCourse[] = [];
      let paginationMeta: CoursePaginationMeta = {
        currentPage: page,
        itemsPerPage: limit,
        totalPages: 1,
        totalItems: 0,
      };

      if (Array.isArray(raw)) {
        courseList = raw;
        paginationMeta.totalItems = raw.length;
        paginationMeta.totalPages = Math.max(1, Math.ceil(raw.length / limit));
      } else if (raw && typeof raw === 'object') {
        const anyRaw = raw as Record<string, unknown>;
        if (Array.isArray(anyRaw.data)) {
          courseList = anyRaw.data as PublishedCourse[];
        } else if (Array.isArray(anyRaw.courses)) {
          courseList = anyRaw.courses as PublishedCourse[];
        } else if (anyRaw.data && typeof anyRaw.data === 'object') {
          const nestedData = anyRaw.data as Record<string, unknown>;
          if (Array.isArray(nestedData.courses)) {
            courseList = nestedData.courses as PublishedCourse[];
          } else if (Array.isArray(nestedData.data)) {
            courseList = nestedData.data as PublishedCourse[];
          }
        }

        const metaObj = (anyRaw.meta ||
          (anyRaw.data as Record<string, unknown>)?.meta) as CoursePaginationMeta | undefined;
        const total =
          metaObj?.totalItems ??
          metaObj?.total ??
          (anyRaw.total as number) ??
          (anyRaw.totalItems as number) ??
          (anyRaw.count as number) ??
          courseList.length;
        const totalP =
          metaObj?.totalPages ??
          (anyRaw.totalPages as number) ??
          Math.max(1, Math.ceil(total / limit));
        paginationMeta = {
          currentPage: metaObj?.currentPage ?? (anyRaw.page as number) ?? page,
          itemsPerPage: metaObj?.itemsPerPage ?? (anyRaw.limit as number) ?? limit,
          totalItems: total,
          totalPages: totalP,
        };
      }

      // Normalize IDs so both id and _id are accessible
      courseList = courseList.map((c) => ({
        ...c,
        id: c.id || c._id || '',
      }));

      return {
        status: response.status,
        success: true,
        data: {
          courses: courseList,
          meta: paginationMeta,
        },
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to fetch published courses.',
      data: {
        courses: [],
        meta: {
          currentPage: page,
          itemsPerPage: limit,
          totalPages: 1,
          totalItems: 0,
        },
      },
    };
  },

  /**
   * 13. Get Course Details by ID
   * Matches Postman: GET /courses/:courseId
   */
  async getCourseById(courseId: string): Promise<ApiResponse<PublishedCourse>> {
    const endpoint = `courses/${encodeURIComponent(courseId)}`;
    const response = await ApiClient.get<PublishedCourse | { data: PublishedCourse }>(endpoint);

    if (response.success && response.data) {
      const courseData =
        'data' in response.data && (response.data as { data: PublishedCourse }).data
          ? (response.data as { data: PublishedCourse }).data
          : (response.data as PublishedCourse);

      return {
        status: response.status,
        success: true,
        data: {
          ...courseData,
          id: courseData.id || courseData._id || courseId,
        },
      };
    }

    return response as ApiResponse<PublishedCourse>;
  },

  /**
   * 14. Get Course Modules (Curriculum Outline)
   * Matches Postman: GET /courses/:courseId/content/modules
   */
  async getCourseModules(courseId: string): Promise<ApiResponse<CourseModule[]>> {
    const endpoint = `courses/${encodeURIComponent(courseId)}/content/modules`;
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const raw = response.data;
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        const anyRaw = raw as Record<string, any>;
        if (Array.isArray(anyRaw.data)) list = anyRaw.data;
        else if (Array.isArray(anyRaw.modules)) list = anyRaw.modules;
        else if (Array.isArray(anyRaw.items)) list = anyRaw.items;
        else if (anyRaw.data && typeof anyRaw.data === 'object') {
          if (Array.isArray(anyRaw.data.modules)) list = anyRaw.data.modules;
          else if (Array.isArray(anyRaw.data.items)) list = anyRaw.data.items;
          else if (Array.isArray(anyRaw.data.data)) list = anyRaw.data.data;
        }
      }

      const cleanList: CourseModule[] = list.map((m: any, mIdx: number) => {
        const rawLessons = Array.isArray(m.lessons) ? m.lessons : Array.isArray(m.items) ? m.items : [];
        const cleanLessons = rawLessons.map((l: any, lIdx: number) => {
          const videoUrl =
            l.videoUrl ||
            l.video_url ||
            l.streamUrl ||
            l.stream_url ||
            (typeof l.video === 'string' ? l.video : l.video?.url || l.video?.streamUrl || '') ||
            (typeof l.vimeo === 'string' ? l.vimeo : l.vimeo?.url || l.vimeoUrl || '') ||
            l.contentUrl ||
            l.content_url ||
            (typeof l.content === 'object' && l.content ? l.content.videoUrl || l.content.url || '' : '') ||
            (typeof l.url === 'string' && (l.url.includes('vimeo') || l.url.includes('youtu') || l.url.includes('.mp4') || l.url.includes('.m3u8')) ? l.url : '') ||
            (Array.isArray(l.attachments) ? l.attachments.find((a: any) => a.mimeType?.includes('video') || (typeof a.url === 'string' && (a.url.includes('.mp4') || a.url.includes('vimeo'))))?.url : '') ||
            '';

          return {
            ...l,
            id: l.id || l._id || `les_${mIdx}_${lIdx}`,
            title: l.title || l.name || `Lesson ${lIdx + 1}`,
            videoUrl,
            duration: l.duration || (l.durationMinutes ? `${l.durationMinutes}:00` : ''),
          };
        });

        return {
          ...m,
          id: m.id || m._id || `mod_${mIdx}`,
          title: m.title || m.name || `Module ${mIdx + 1}`,
          lessons: cleanLessons.length > 0 ? cleanLessons : m.lessons,
        };
      });

      return {
        status: response.status,
        success: true,
        data: cleanList,
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 15. Get Module Lessons
   * Matches Postman: GET /courses/:courseId/content/modules/:moduleId/lessons
   */
  async getModuleLessons(
    courseId: string,
    moduleId: string
  ): Promise<ApiResponse<CourseLesson[]>> {
    const endpoint = `courses/${encodeURIComponent(courseId)}/content/modules/${encodeURIComponent(moduleId)}/lessons`;
    console.log(`[LearnVideoDebug] Calling Lesson API URL: ${endpoint}`);
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const raw = response.data;
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        const anyRaw = raw as Record<string, any>;
        if (Array.isArray(anyRaw.data)) list = anyRaw.data;
        else if (Array.isArray(anyRaw.lessons)) list = anyRaw.lessons;
        else if (Array.isArray(anyRaw.items)) list = anyRaw.items;
        else if (anyRaw.data && typeof anyRaw.data === 'object') {
          if (Array.isArray(anyRaw.data.lessons)) list = anyRaw.data.lessons;
          else if (Array.isArray(anyRaw.data.items)) list = anyRaw.data.items;
          else if (Array.isArray(anyRaw.data.data)) list = anyRaw.data.data;
        }
      }

      console.log(`[LearnVideoDebug] Complete Lesson API Response status: ${response.status}, count: ${list.length}`);

      const cleanList: CourseLesson[] = list.map((l: any, idx: number) => {
        const id = l.id || l._id || `les_${idx}`;
        const title = l.title || l.name || `Lesson ${idx + 1}`;
        const videoUrl =
          l.videoUrl ||
          l.video_url ||
          l.streamUrl ||
          l.stream_url ||
          (typeof l.video === 'string' ? l.video : l.video?.url || l.video?.streamUrl || '') ||
          (typeof l.vimeo === 'string' ? l.vimeo : l.vimeo?.url || l.vimeoUrl || '') ||
          l.contentUrl ||
          l.content_url ||
          (typeof l.content === 'object' && l.content ? l.content.videoUrl || l.content.url || '' : '') ||
          (typeof l.url === 'string' && (l.url.includes('vimeo') || l.url.includes('youtu') || l.url.includes('.mp4') || l.url.includes('.m3u8')) ? l.url : '') ||
          (Array.isArray(l.attachments) ? l.attachments.find((a: any) => a.mimeType?.includes('video') || (typeof a.url === 'string' && (a.url.includes('.mp4') || a.url.includes('vimeo'))))?.url : '') ||
          '';

        const duration = l.duration || (l.durationMinutes ? `${l.durationMinutes}:00` : '');

        return {
          ...l,
          id,
          title,
          videoUrl,
          duration,
        };
      });

      return {
        status: response.status,
        success: true,
        data: cleanList,
      };
    }

    console.log(`[LearnVideoDebug] Lesson API returned error or empty for module ${moduleId}:`, response.error);

    return {
      status: response.status,
      success: response.success,
      data: [],
      error: response.error,
    };
  },

  /**
   * 16. Get Lesson AI Study Data
   * Matches Postman: GET /courses/:courseId/content/lessons/:lessonId/ai-data
   */
  async getLessonAiData(
    courseId: string,
    lessonId: string
  ): Promise<ApiResponse<LessonAiStudyData>> {
    if (!courseId || !lessonId) {
      return {
        status: 400,
        success: false,
        error: 'Course ID and Lesson ID are required.',
      };
    }

    const endpoint = `courses/${encodeURIComponent(courseId)}/content/lessons/${encodeURIComponent(lessonId)}/ai-data`;
    const response = await ApiClient.get<any>(endpoint);

    if (!response.success) {
      return {
        status: response.status,
        success: false,
        error: extractAiErrorMessage(response.data, response.error),
      };
    }

    const raw = response.data;
    if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).success === false) {
      return {
        status: response.status,
        success: false,
        error: extractAiErrorMessage(raw, response.error),
      };
    }

    const root = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
    let envelope = root;
    if (root.data && typeof root.data === 'object') {
      envelope = root.data;
    }

    // Extract inner content from possible envelope shapes:
    // Shape 1: { found: true, hasAiData: true, data: { summary, quiz_pool, ... } }
    // Shape 2: { data: { found: true, hasAiData: true, data: { summary, ... } } }
    // Shape 3: { summary, quiz_pool, ... }
    const inner =
      envelope.data && typeof envelope.data === 'object'
        ? (envelope.data as Record<string, any>)
        : envelope;

    const summary = typeof inner.summary === 'string' ? inner.summary : '';

    const rawQuizPool = Array.isArray(inner.quiz_pool) ? inner.quiz_pool : [];
    const quiz_pool: LessonAiQuestion[] = rawQuizPool.map((q: any, idx: number) => {
      const correctIdx =
        typeof q?.correct_index === 'number'
          ? q.correct_index
          : typeof q?.correctOptionIndex === 'number'
            ? q.correctOptionIndex
            : undefined;
      const theologicalExplanation =
        typeof q?.theological_explanation === 'string'
          ? q.theological_explanation
          : typeof q?.explanation === 'string'
            ? q.explanation
            : '';
      return {
        id: String(q?.id || q?._id || `q_${idx}`),
        question: typeof q?.question === 'string' ? q.question : '',
        options: Array.isArray(q?.options) ? q.options.map(String) : [],
        correct_index: correctIdx,
        explanation:
          typeof q?.explanation === 'string' ? q.explanation : theologicalExplanation,
        theological_explanation: theologicalExplanation,
      };
    });

    const total_pool_count =
      typeof inner.total_pool_count === 'number'
        ? inner.total_pool_count
        : typeof inner.totalPoolCount === 'number'
          ? inner.totalPoolCount
          : undefined;

    const rawBackstory = Array.isArray(inner.backstory) ? inner.backstory : [];
    const backstory: LessonAiBackstoryItem[] = rawBackstory
      .map((item: any) => ({
        topic: typeof item?.topic === 'string' ? item.topic : typeof item?.title === 'string' ? item.title : '',
        explanation:
          typeof item?.explanation === 'string'
            ? item.explanation
            : typeof item?.description === 'string'
              ? item.description
              : '',
      }))
      .filter((item: LessonAiBackstoryItem) => Boolean(item.topic || item.explanation));

    const rawFlashcards = Array.isArray(inner.flashcards) ? inner.flashcards : [];
    const flashcards: LessonAiFlashcardItem[] = rawFlashcards
      .map((item: any, idx: number) => ({
        id: String(item?.id || item?._id || `fc_${idx}`),
        question:
          typeof item?.question === 'string'
            ? item.question
            : typeof item?.front === 'string'
              ? item.front
              : '',
        answer:
          typeof item?.answer === 'string'
            ? item.answer
            : typeof item?.back === 'string'
              ? item.back
              : '',
        topic: typeof item?.topic === 'string' ? item.topic : undefined,
      }))
      .filter((fc: LessonAiFlashcardItem) => Boolean(fc.question || fc.answer));

    const rawKeyTakeaways = Array.isArray(inner.key_takeaways)
      ? inner.key_takeaways
      : Array.isArray(inner.keyTakeaways)
        ? inner.keyTakeaways
        : [];
    const key_takeaways: string[] = rawKeyTakeaways.map((t: unknown) => String(t)).filter(Boolean);

    const hasAnyContent = Boolean(
      summary.trim().length > 0 ||
      quiz_pool.length > 0 ||
      backstory.length > 0 ||
      flashcards.length > 0 ||
      key_takeaways.length > 0
    );

    const found =
      typeof envelope.found === 'boolean'
        ? envelope.found
        : typeof root.found === 'boolean'
          ? root.found
          : hasAnyContent;

    const hasAiData =
      typeof envelope.hasAiData === 'boolean'
        ? envelope.hasAiData
        : typeof root.hasAiData === 'boolean'
          ? root.hasAiData
          : hasAnyContent;

    const latest_attempt = normalizeLatestAiAttempt(inner.latest_attempt);

    const normalized: LessonAiStudyData = {
      found,
      hasAiData,
      summary,
      quiz_pool,
      total_pool_count,
      backstory,
      flashcards,
      key_takeaways,
      latest_attempt,
      generated_at: typeof inner.generated_at === 'string' ? inner.generated_at : undefined,
    };

    return {
      status: response.status,
      success: true,
      data: normalized,
    };
  },

  /**
   * 16b. Get Video Quizzes for Lesson
   * Matches Postman: GET /courses/:courseId/content/modules/:moduleId/lessons/:lessonId/video-quizzes
   */
  async getVideoQuizzesForLesson(
    courseId: string,
    moduleId: string,
    lessonId: string
  ): Promise<ApiResponse<VideoQuizItem[]>> {
    if (!courseId || !lessonId) {
      return {
        status: 400,
        success: false,
        error: 'Course ID and Lesson ID are required to fetch video quizzes.',
        data: [],
      };
    }

    const endpoint = `courses/${encodeURIComponent(courseId)}/content/modules/${encodeURIComponent(moduleId || 'default')}/lessons/${encodeURIComponent(lessonId)}/video-quizzes`;
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const items = unwrapArrayPayload(response.data);
      const normalized: VideoQuizItem[] = items.map((raw: any, idx: number) => ({
        id: String(raw.id || raw._id || `quiz_${idx}`),
        _id: raw._id ? String(raw._id) : undefined,
        lessonId: String(raw.lessonId || raw.lesson?._id || raw.lesson?.id || lessonId),
        moduleId: String(raw.moduleId || raw.module?._id || raw.module?.id || moduleId),
        courseId: String(raw.courseId || courseId),
        questionText: String(raw.questionText || raw.question || ''),
        questionType: raw.questionType === 'DESCRIPTIVE' ? 'DESCRIPTIVE' : 'MCQ',
        timestampSeconds: Number(raw.timestampSeconds ?? raw.timestamp ?? 0) || 0,
        options: Array.isArray(raw.options)
          ? raw.options.map((opt: any) => ({
              text: typeof opt === 'string' ? opt : String(opt?.text || ''),
              isCorrect: typeof opt === 'object' ? Boolean(opt?.isCorrect) : false,
            }))
          : [],
        maxMarks: typeof raw.maxMarks === 'number' ? raw.maxMarks : 1,
        explanation: typeof raw.explanation === 'string' ? raw.explanation : undefined,
      }));

      return {
        status: response.status,
        success: true,
        data: normalized,
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to load video quizzes.',
      data: [],
    };
  },

  /**
   * 16c. Submit Video Quiz Answer
   * Matches Postman: POST /courses/:courseId/content/modules/:moduleId/lessons/:lessonId/video-quizzes/:quizId/answers
   */
  async submitVideoQuizAnswer(
    courseId: string,
    moduleId: string,
    lessonId: string,
    quizId: string,
    payload: VideoQuizSubmitPayload
  ): Promise<ApiResponse<VideoQuizSubmitResponse>> {
    if (!courseId || !lessonId || !quizId) {
      return {
        status: 400,
        success: false,
        error: 'Course ID, Lesson ID, and Quiz ID are required to submit answer.',
      };
    }

    const endpoint = `courses/${encodeURIComponent(courseId)}/content/modules/${encodeURIComponent(moduleId || 'default')}/lessons/${encodeURIComponent(lessonId)}/video-quizzes/${encodeURIComponent(quizId)}/answers`;
    const response = await ApiClient.post<any>(endpoint, payload);

    if (response.success) {
      const raw = response.data;
      const unwrapped =
        raw && typeof raw === 'object' && 'data' in raw && raw.data && typeof raw.data === 'object'
          ? raw.data
          : raw;
      return {
        status: response.status,
        success: true,
        data: unwrapped as VideoQuizSubmitResponse,
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to submit video quiz answer.',
    };
  },

  /**
   * 16d. Get My Video Quiz Answers
   * Matches Postman: GET /courses/:courseId/content/modules/:moduleId/lessons/:lessonId/video-quizzes/my-answers
   */
  async getVideoQuizMyAnswers(
    courseId: string,
    moduleId: string,
    lessonId: string
  ): Promise<ApiResponse<VideoQuizMyAnswerItem[]>> {
    if (!courseId || !lessonId) {
      return {
        status: 400,
        success: false,
        error: 'Course ID and Lesson ID are required to fetch answers.',
        data: [],
      };
    }

    const endpoint = `courses/${encodeURIComponent(courseId)}/content/modules/${encodeURIComponent(moduleId || 'default')}/lessons/${encodeURIComponent(lessonId)}/video-quizzes/my-answers`;
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const items = unwrapArrayPayload(response.data);
      const normalized: VideoQuizMyAnswerItem[] = items.map((raw: any, idx: number) => ({
        id: String(raw.id || raw._id || `ans_${idx}`),
        _id: raw._id ? String(raw._id) : undefined,
        quizId: raw.quizId,
        selectedOption: typeof raw.selectedOption === 'string' ? raw.selectedOption : undefined,
        textAnswer: typeof raw.textAnswer === 'string' ? raw.textAnswer : undefined,
        isCorrect: typeof raw.isCorrect === 'boolean' ? raw.isCorrect : undefined,
        isGraded: typeof raw.isGraded === 'boolean' ? raw.isGraded : undefined,
        marks: typeof raw.marks === 'number' ? raw.marks : undefined,
        submittedAt: typeof raw.submittedAt === 'string' ? raw.submittedAt : undefined,
      }));

      return {
        status: response.status,
        success: true,
        data: normalized,
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Failed to load video quiz answers.',
      data: [],
    };
  },

  /**
   * 17. Submit Lesson AI Practice Quiz
   * Matches Postman: POST /courses/:courseId/content/lessons/:lessonId/ai-quiz/submit
   */
  async submitLessonAiQuiz(
    courseId: string,
    lessonId: string,
    answers: LessonAiQuizSubmitAnswerPayload[]
  ): Promise<ApiResponse<LessonAiQuizSubmitResponse>> {
    if (!courseId || !lessonId) {
      return {
        status: 400,
        success: false,
        error: 'Course ID and Lesson ID are required to submit the quiz.',
      };
    }

    const endpoint = `courses/${encodeURIComponent(courseId)}/content/lessons/${encodeURIComponent(lessonId)}/ai-quiz/submit`;
    const payloadAnswers = answers.map((ans) => ({
      questionIndex: ans.questionIndex,
      selectedOption: ans.selectedOption,
    }));

    const response = await ApiClient.post<any>(endpoint, { answers: payloadAnswers });
    if (!response.success) {
      return {
        status: response.status,
        success: false,
        error: extractAiErrorMessage(response.data, response.error || 'Failed to submit quiz attempt.'),
      };
    }

    const raw = response.data;
    if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).success === false) {
      return {
        status: response.status,
        success: false,
        error: extractAiErrorMessage(raw, response.error || 'Failed to submit quiz attempt.'),
      };
    }

    const inner =
      raw && typeof raw === 'object' && 'data' in raw && raw.data && typeof raw.data === 'object'
        ? (raw.data as Record<string, any>)
        : raw && typeof raw === 'object'
          ? (raw as Record<string, any>)
          : {};

    const normalizedAttempt = normalizeLatestAiAttempt(
      inner.attempt ?? inner.latest_attempt ?? (typeof inner.score === 'number' ? inner : null)
    );

    return {
      status: response.status,
      success: true,
      data: {
        attempt: normalizedAttempt,
        latest_attempt: normalizedAttempt,
        score: typeof inner.score === 'number' ? inner.score : normalizedAttempt?.score,
        totalQuestions:
          typeof inner.totalQuestions === 'number'
            ? inner.totalQuestions
            : normalizedAttempt?.totalQuestions,
        percentage:
          typeof inner.percentage === 'number' ? inner.percentage : normalizedAttempt?.percentage,
        passed: typeof inner.passed === 'boolean' ? inner.passed : normalizedAttempt?.passed,
        message: typeof inner.message === 'string' ? inner.message : undefined,
      },
    };
  },

  /**
   * 18. Update Video Watch Time
   * Matches Postman: PATCH /progress/lessons/:lessonId/watch-time
   */
  async updateLessonWatchTime(
    courseId: string,
    moduleId: string,
    lessonId: string,
    watchedSeconds: number
  ): Promise<ApiResponse<WatchTimeUpdateResponse>> {
    if (!courseId || !lessonId) {
      return {
        status: 400,
        success: false,
        error: 'Course ID and Lesson ID are required to update watch time.',
      };
    }

    const sanitizedSeconds = Math.max(0, Math.floor(Number(watchedSeconds) || 0));
    const endpoint = `progress/lessons/${encodeURIComponent(lessonId)}/watch-time`;
    const response = await ApiClient.patch<any>(endpoint, {
      courseId,
      moduleId: moduleId || '',
      watchedSeconds: sanitizedSeconds,
    });

    const raw = response.data;
    const unwrapped =
      raw && typeof raw === 'object' && 'data' in raw && raw.data && typeof raw.data === 'object'
        ? raw.data
        : raw;

    if (response.success) {
      const payload = (unwrapped && typeof unwrapped === 'object' ? unwrapped : {}) as Record<string, any>;
      const normalized: WatchTimeUpdateResponse = {
        lessonId: payload.lessonId || lessonId,
        courseId: payload.courseId || courseId,
        moduleId: payload.moduleId || moduleId,
        watchedSeconds:
          typeof payload.watchedSeconds === 'number' ? payload.watchedSeconds : sanitizedSeconds,
        progressPercentage:
          typeof payload.progressPercentage === 'number'
            ? payload.progressPercentage
            : typeof payload.progress === 'number'
              ? payload.progress
              : undefined,
        completed:
          typeof payload.completed === 'boolean'
            ? payload.completed
            : typeof payload.isCompleted === 'boolean'
              ? payload.isCompleted
              : undefined,
        isCompleted:
          typeof payload.isCompleted === 'boolean'
            ? payload.isCompleted
            : typeof payload.completed === 'boolean'
              ? payload.completed
              : undefined,
        isWatched: typeof payload.isWatched === 'boolean' ? payload.isWatched : undefined,
        fullyWatched: typeof payload.fullyWatched === 'boolean' ? payload.fullyWatched : undefined,
        canWatch: typeof payload.canWatch === 'boolean' ? payload.canWatch : undefined,
        rewatchAllowed:
          typeof payload.rewatchAllowed === 'boolean' ? payload.rewatchAllowed : undefined,
        allowRewatch: typeof payload.allowRewatch === 'boolean' ? payload.allowRewatch : undefined,
        watchLimitReached:
          typeof payload.watchLimitReached === 'boolean' ? payload.watchLimitReached : undefined,
        maxWatchesReached:
          typeof payload.maxWatchesReached === 'boolean' ? payload.maxWatchesReached : undefined,
        viewingRestricted:
          typeof payload.viewingRestricted === 'boolean' ? payload.viewingRestricted : undefined,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
      return {
        status: response.status,
        success: true,
        data: normalized,
      };
    }

    return {
      status: response.status,
      success: false,
      data: unwrapped as WatchTimeUpdateResponse | undefined,
      error: response.error,
    };
  },

  /**
   * 19. Mark Lesson Complete
   * Matches Postman: POST /progress/lessons/:lessonId/complete
   */
  async markLessonComplete(
    courseId: string,
    moduleId: string,
    lessonId: string
  ): Promise<ApiResponse<any>> {
    const endpoint = `progress/lessons/${encodeURIComponent(lessonId)}/complete`;
    return ApiClient.post<any>(endpoint, {
      courseId,
      moduleId,
    });
  },

  /**
   * 20. Get Course Progress & Completion Percentage
   * Matches Postman: GET /progress/courses/:courseId
   */
  async getCourseProgress(
    courseId: string
  ): Promise<ApiResponse<CourseProgressData>> {
    const endpoint = `progress/courses/${encodeURIComponent(courseId)}`;
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const raw = response.data;
      const data =
        'data' in (raw as object) && (raw as { data: any }).data
          ? (raw as { data: any }).data
          : raw;

      const progressPercentage =
        typeof data?.progressPercentage === 'number'
          ? data.progressPercentage
          : typeof data?.progress === 'number'
            ? data.progress
            : typeof data?.percentage === 'number'
              ? data.percentage
              : 0;

      const hasExplicitCompletedIdsArray = Array.isArray(data?.completedLessonIds);
      const completedLessonIds: string[] = hasExplicitCompletedIdsArray
        ? data.completedLessonIds.map((id: any) => String(id)).filter(Boolean)
        : [];
      const completedSet = new Set<string>(completedLessonIds);
      const lessonProgressById: Record<string, LessonProgressEntry> = {};
      const watchedSecondsByLesson: Record<string, number> = {};

      completedLessonIds.forEach((id) => {
        lessonProgressById[id] = {
          lessonId: id,
          watchedSeconds: 0,
          completed: true,
        };
      });

      const progressEntries: any[] = [];
      if (Array.isArray(data?.completedLessons)) {
        progressEntries.push(...data.completedLessons);
      }
      if (Array.isArray(data?.lessonProgress)) {
        progressEntries.push(...data.lessonProgress);
      }

      for (const item of progressEntries) {
        if (typeof item === 'string') {
          if (item) {
            completedSet.add(item);
            lessonProgressById[item] = {
              ...(lessonProgressById[item] || { lessonId: item, watchedSeconds: 0 }),
              lessonId: item,
              completed: true,
            };
          }
          continue;
        }
        if (!item || typeof item !== 'object') continue;

        const rawId =
          typeof item.lessonId === 'object' && item.lessonId
            ? item.lessonId._id || item.lessonId.id
            : item.lessonId || item.id || item._id;
        const lessonId = rawId ? String(rawId) : '';
        if (!lessonId) continue;

        const watchedSec = Math.max(
          0,
          Number(item.watchedSeconds ?? item.watchTime ?? 0) || 0
        );
        if (watchedSec > (watchedSecondsByLesson[lessonId] || 0)) {
          watchedSecondsByLesson[lessonId] = watchedSec;
        }

        const explicitComplete =
          item.completed === true ||
          item.isCompleted === true ||
          String(item.status || '').toUpperCase() === 'COMPLETED' ||
          Boolean(item.completedAt);
        const explicitIncomplete =
          item.completed === false ||
          item.isCompleted === false ||
          String(item.status || '').toUpperCase() === 'IN_PROGRESS';

        const isCompleted =
          completedSet.has(lessonId) ||
          explicitComplete ||
          (!hasExplicitCompletedIdsArray &&
            !explicitIncomplete &&
            Boolean(item.id === lessonId || item._id === lessonId || !item.lessonId));

        if (isCompleted) {
          completedSet.add(lessonId);
        }

        const existing = lessonProgressById[lessonId];
        lessonProgressById[lessonId] = {
          lessonId,
          watchedSeconds: Math.max(existing?.watchedSeconds || 0, watchedSec),
          completed: Boolean(existing?.completed || isCompleted),
          completedAt: item.completedAt || existing?.completedAt,
          canWatch: typeof item.canWatch === 'boolean' ? item.canWatch : existing?.canWatch,
          rewatchAllowed:
            typeof item.rewatchAllowed === 'boolean'
              ? item.rewatchAllowed
              : typeof item.allowRewatch === 'boolean'
                ? item.allowRewatch
                : existing?.rewatchAllowed,
          watchLimitReached:
            typeof item.watchLimitReached === 'boolean'
              ? item.watchLimitReached
              : typeof item.maxWatchesReached === 'boolean'
                ? item.maxWatchesReached
                : existing?.watchLimitReached,
          isLocked: typeof item.isLocked === 'boolean' ? item.isLocked : existing?.isLocked,
        };
      }

      const currentLessonId = data?.currentLessonId || data?.lastLessonId || data?.lessonId;
      const lastLessonId = data?.lastLessonId || data?.currentLessonId;

      return {
        status: response.status,
        success: true,
        data: {
          progressPercentage,
          completedLessons: Array.from(completedSet),
          completedLessonIds,
          lessonProgressById,
          watchedSecondsByLesson,
          currentLessonId,
          lastLessonId,
        },
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: {
        progressPercentage: 0,
        completedLessons: [],
        completedLessonIds: [],
        lessonProgressById: {},
        watchedSecondsByLesson: {},
      },
      error: response.error,
    };
  },

  /**
   * 21. Verify Course Entitlement & Access (Purchased / Enrolled Check)
   * Strictly enforces purchase access:
   * 1) Checks student enrollments (GET /students/:studentId/enrollments)
   * 2) Checks paid tuition / payments (GET /payments/my-payments)
   * 3) Prevents bypass when unpurchased
   */
  async verifyCourseAccess(
    courseId: string,
    studentId: string = 'me'
  ): Promise<CourseAccessVerification> {
    try {
      const cleanCourseId = String(courseId || '').trim();
      if (!cleanCourseId) {
        return {
          courseId: '',
          isPurchased: false,
          isEnrolled: false,
          canAccess: false,
          progressPercentage: 0,
          status: 'LOCKED',
        };
      }

      // 1. Check direct course enrollments
      const enrollmentsRes = await this.getStudentEnrollments(studentId);
      const enrollments = enrollmentsRes.data || [];

      const matchedEnrollment = enrollments.find((e) => {
        const directCid = String(e.courseId || '').trim();
        const nestedCid = String(e.course?.id || (e.course as any)?._id || '').trim();
        return (
          (directCid && directCid.toLowerCase() === cleanCourseId.toLowerCase()) ||
          (nestedCid && nestedCid.toLowerCase() === cleanCourseId.toLowerCase())
        );
      });

      if (matchedEnrollment) {
        const rawStatus = (matchedEnrollment.status || '').toUpperCase().trim();
        const isAccessibleStatus = [
          'ENROLLED',
          'ACTIVE',
          'COMPLETED',
          'IN_PROGRESS',
          'APPROVED',
          'PAID',
        ].includes(rawStatus);

        return {
          courseId: cleanCourseId,
          isPurchased: isAccessibleStatus,
          isEnrolled: true,
          canAccess: isAccessibleStatus,
          progressPercentage: matchedEnrollment.progressPercentage || 0,
          enrollmentId: matchedEnrollment.id,
          status: matchedEnrollment.status || (isAccessibleStatus ? 'ENROLLED' : 'PENDING'),
        };
      }

      // 2. Check payments match if payment directly references this course
      const paymentsRes = await this.getMyPayments(1, 50);
      const payments = paymentsRes.data || [];
      const hasPaid = payments.some((p) => {
        if (p.status !== 'PAID') return false;
        const pCourseId = String(p.courseId || (p.course as any)?.id || (p.course as any)?._id || '').trim();
        return pCourseId && pCourseId.toLowerCase() === cleanCourseId.toLowerCase();
      });

      if (hasPaid) {
        return {
          courseId: cleanCourseId,
          isPurchased: true,
          isEnrolled: true,
          canAccess: true,
          progressPercentage: 0,
          status: 'PAID',
        };
      }

      return {
        courseId: cleanCourseId,
        isPurchased: false,
        isEnrolled: false,
        canAccess: false,
        progressPercentage: 0,
        status: 'LOCKED',
      };
    } catch {
      return {
        courseId,
        isPurchased: false,
        isEnrolled: false,
        canAccess: false,
        progressPercentage: 0,
        status: 'LOCKED',
      };
    }
  },

  /**
   * 22. Get Term-Specific Courses with Entitlement Status
   * Fetches published courses and program courses, partitions by academic term,
   * and annotates each course with enrollment / purchase state.
   */
  async getTermCourses(
    programId?: string,
    termNumber: number = 1
  ): Promise<ApiResponse<(PublishedCourse & { isEntitled: boolean; progressPercentage: number })[]>> {
    try {
      // 1. Fetch published courses & enrollments in parallel
      const [coursesRes, enrollmentsRes] = await Promise.all([
        programId
          ? this.getCoursesForProgram(programId)
          : this.getPublishedCourses(1, 50),
        this.getStudentEnrollments('me'),
      ]);

      const rawCourses: PublishedCourse[] = Array.isArray(coursesRes.data)
        ? coursesRes.data
        : (coursesRes.data as any)?.courses || [];

      const enrollments = enrollmentsRes.data || [];
      const enrolledMap = new Map<string, StudentEnrollmentItem>();
      for (const e of enrollments) {
        if (e.courseId) enrolledMap.set(e.courseId, e);
        if (e.course?.id) enrolledMap.set(e.course.id, e);
      }

      // 2. Filter courses for this specific term by term numbers, semester IDs, course codes, or sequential pack order
      let filteredForTerm = rawCourses.filter((course, idx) => {
        const rawTerm = (course as any).termNumber ?? (course as any).semesterNumber ?? (course as any).term ?? (course as any).semester;
        if (typeof rawTerm === 'number' && rawTerm === termNumber) {
          return true;
        }

        const semId = String(course.semesterId || (course as any).semester?.id || rawTerm || '').toLowerCase();
        const termStr = String(termNumber);

        if (semId) {
          if (
            semId === termStr ||
            semId.includes(`term-${termStr}`) ||
            semId.includes(`semester-${termStr}`) ||
            semId.includes(`term ${termStr}`) ||
            semId.includes(`sem ${termStr}`)
          ) {
            return true;
          }
          const numMatch = semId.match(/\d+/);
          if (numMatch && parseInt(numMatch[0], 10) === termNumber) {
            return true;
          }
        }

        // Code matching (e.g. MIS101 -> Term 1)
        const code = String(course.code || (course as any).course?.code || '');
        if (code) {
          const codeMatch = code.match(/\d+/);
          if (codeMatch && codeMatch[0].length >= 3) {
            const firstDigit = parseInt(codeMatch[0][0], 10);
            if (firstDigit === termNumber) {
              return true;
            }
          }
        }

        return false;
      });

      // If no explicit term tags matched on raw courses, distribute in curriculum order (5 subjects per term as shown in website reference)
      if (filteredForTerm.length === 0 && rawCourses.length > 0) {
        const subjectsPerTerm = 5;
        filteredForTerm = rawCourses.filter((_, idx) => {
          const calculatedTerm = Math.floor(idx / subjectsPerTerm) + 1;
          return calculatedTerm === termNumber;
        });

        // If termNumber is beyond or last term, fallback to first 5 courses if still empty
        if (filteredForTerm.length === 0 && termNumber === 1) {
          filteredForTerm = rawCourses.slice(0, subjectsPerTerm);
        }
      }

      // 3. Annotate courses with entitlement strictly from enrollment status
      const accessibleStatuses = ['ENROLLED', 'ACTIVE', 'COMPLETED', 'IN_PROGRESS', 'APPROVED', 'PAID'];
      const annotated = filteredForTerm.map((course) => {
        const courseId = (course as any).courseId || (course as any).course?.id || course.id || course._id || '';
        const enrollment = enrolledMap.get(courseId);
        const rawStatus = String(enrollment?.status || '').toUpperCase().trim();
        const isEntitled = accessibleStatuses.includes(rawStatus);
        const progressPercentage = enrollment?.progressPercentage || 0;

        return {
          ...course,
          id: courseId,
          isEntitled,
          progressPercentage,
        };
      });

      return {
        status: 200,
        success: true,
        data: annotated,
      };
    } catch (err: unknown) {
      return {
        status: 500,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve term courses.',
        data: [],
      };
    }
  },

  /**
   * 36. Get Available Regions for Pricing Resolution
   * GET /regions?slug={{orgSlug}}&localOnly=true
   */
  async getRegions(
    slug?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ApiResponse<any[]>> {
    return LmsAuthService.getAvailableRegions(slug, options);
  },
};

