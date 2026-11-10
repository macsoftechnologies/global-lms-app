import { ApiClient } from './api';
import { AuthStorage, AuthSession } from './authStorage';
import { ENV } from '../config/env';
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
  LessonAiStudyData,
  LessonAiQuestion,
  LessonAiConcept,
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
} from '../types';

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
    let response = await ApiClient.get<
      StudentEnrollmentItem[] | { data: StudentEnrollmentItem[] }
    >(endpoint);

    // If 'me' failed or vice-versa, attempt fallback with authenticated user ID
    if (!response.success && id === 'me') {
      const user = await AuthStorage.getUser();
      if (user?.id) {
        response = await ApiClient.get<
          StudentEnrollmentItem[] | { data: StudentEnrollmentItem[] }
        >(`students/${encodeURIComponent(user.id)}/enrollments`);
      }
    } else if (!response.success && id !== 'me') {
      response = await ApiClient.get<
        StudentEnrollmentItem[] | { data: StudentEnrollmentItem[] }
      >(`students/me/enrollments`);
    }

    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: StudentEnrollmentItem[] }).data)
        ? (raw as { data: StudentEnrollmentItem[] }).data
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
      const p = item.progressPercentage || 0;
      totalProgress += p;
      if (p >= 100) {
        completed += 1;
      } else if (p > 0) {
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
    const response = await ApiClient.get<
      LiveSessionItem[] | { data: LiveSessionItem[] }
    >('live-sessions/student/upcoming');

    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: LiveSessionItem[] }).data)
        ? (raw as { data: LiveSessionItem[] }).data
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
   * 6. Get Unread Notifications Count
   * Matches Postman: GET /notifications/unread-count
   */
  async getUnreadNotificationCount(): Promise<number> {
    try {
      const response = await ApiClient.get<{ count?: number } | { data?: { count?: number } }>(
        'notifications/unread-count'
      );

      if (response.success && response.data) {
        const raw = response.data;
        if ('count' in raw && typeof (raw as { count: number }).count === 'number') {
          return (raw as { count: number }).count;
        }
        if (
          'data' in raw &&
          (raw as { data?: { count?: number } }).data?.count !== undefined
        ) {
          return (raw as { data: { count: number } }).data.count || 0;
        }
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * 7. Get Notifications List
   * Matches Postman: GET /notifications?page=1&limit=20
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<NotificationItem[]>> {
    const response = await ApiClient.get<
      NotificationItem[] | { data: NotificationItem[] }
    >(`notifications?page=${page}&limit=${limit}`);

    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: NotificationItem[] }).data)
        ? (raw as { data: NotificationItem[] }).data
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
    slug: string = 'org1'
  ): Promise<ApiResponse<ProgramOption[]>> {
    const response = await ApiClient.get<
      ProgramOption[] | { data: ProgramOption[] }
    >(`programs/public?limit=${limit}&slug=${encodeURIComponent(slug)}`);

    if (response.success && response.data) {
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: ProgramOption[] }).data)
        ? (raw as { data: ProgramOption[] }).data
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

    // Graceful fallback to verified public programs endpoint (Item 14.2)
    return this.getPublicPrograms(100, 'org1');
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

    // Search in public programs catalog
    const allRes = await this.getPublicPrograms(100, 'org1');
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
   * 16. Get Lesson AI Study Data (Flashcards & Quiz & Briefing)
   * Matches Postman: GET /courses/:courseId/content/lessons/:lessonId/ai-data
   */
  async getLessonAiData(
    courseId: string,
    lessonId: string
  ): Promise<ApiResponse<LessonAiStudyData>> {
    const endpoint = `courses/${encodeURIComponent(courseId)}/content/lessons/${encodeURIComponent(lessonId)}/ai-data`;
    const response = await ApiClient.get<any>(endpoint);

    if (response.success && response.data) {
      const raw = response.data;
      const rawAny = (raw && typeof raw === 'object' && 'data' in raw && raw.data)
        ? raw.data
        : raw;

      const summary = rawAny.summary || rawAny.executiveBriefing || rawAny.briefing || '';
      const executiveBriefing = rawAny.executiveBriefing || rawAny.briefing || rawAny.summary || '';
      const keyPoints = Array.isArray(rawAny.keyPoints)
        ? rawAny.keyPoints
        : Array.isArray(rawAny.key_points)
        ? rawAny.key_points
        : Array.isArray(rawAny.points)
        ? rawAny.points
        : [];

      const rawQuiz = Array.isArray(rawAny.quiz) ? rawAny.quiz : Array.isArray(rawAny.questions) ? rawAny.questions : [];
      const quiz: LessonAiQuestion[] = rawQuiz.map((q: any, idx: number) => ({
        id: String(q.id || q._id || `q_${idx}`),
        question: q.question || q.title || '',
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctOptionIndex: typeof q.correctOptionIndex === 'number'
          ? q.correctOptionIndex
          : typeof q.correct_index === 'number'
          ? q.correct_index
          : typeof q.correctAnswerIndex === 'number'
          ? q.correctAnswerIndex
          : 0,
        explanation: q.explanation || q.theological_explanation || q.reason || '',
      }));

      const rawConcepts = Array.isArray(rawAny.concepts) ? rawAny.concepts : [];
      const concepts: LessonAiConcept[] = rawConcepts.map((c: any) => ({
        title: c.title || c.topic || c.name || '',
        description: c.description || c.explanation || c.content || '',
        historicalContext: c.historicalContext || c.historical_context || c.context,
        category: c.category || c.badge,
      }));

      const takeaways = Array.isArray(rawAny.takeaways)
        ? rawAny.takeaways
        : Array.isArray(rawAny.revision)
        ? rawAny.revision
        : Array.isArray(rawAny.checklist)
        ? rawAny.checklist
        : [];

      const normalized: LessonAiStudyData = {
        summary,
        executiveBriefing,
        keyPoints,
        quiz,
        concepts,
        takeaways,
        flashcards: Array.isArray(rawAny.flashcards) ? rawAny.flashcards : [],
      };

      return {
        status: response.status,
        success: true,
        data: normalized,
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
   * 17. Submit Lesson AI Practice Quiz
   * Matches Postman: POST /courses/:courseId/content/lessons/:lessonId/ai-quiz/submit
   */
  async submitLessonAiQuiz(
    courseId: string,
    lessonId: string,
    answers: { questionIndex: number; selectedOption: number }[]
  ): Promise<ApiResponse<any>> {
    const endpoint = `courses/${encodeURIComponent(courseId)}/content/lessons/${encodeURIComponent(lessonId)}/ai-quiz/submit`;
    return ApiClient.post<any>(endpoint, { answers });
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
  ): Promise<ApiResponse<any>> {
    const endpoint = `progress/lessons/${encodeURIComponent(lessonId)}/watch-time`;
    return ApiClient.patch<any>(endpoint, {
      courseId,
      moduleId,
      watchedSeconds,
    });
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
  ): Promise<ApiResponse<{ progressPercentage: number; completedLessons?: string[]; currentLessonId?: string; lastLessonId?: string }>> {
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

      let completedLessons: string[] = [];
      if (Array.isArray(data?.completedLessons)) {
        completedLessons = data.completedLessons
          .map((item: any) => (typeof item === 'string' ? item : item?.lessonId || item?.id || item?._id || ''))
          .filter(Boolean);
      } else if (Array.isArray(data?.completedLessonIds)) {
        completedLessons = data.completedLessonIds.map(String);
      }

      const currentLessonId = data?.currentLessonId || data?.lastLessonId || data?.lessonId;
      const lastLessonId = data?.lastLessonId || data?.currentLessonId;

      return {
        status: response.status,
        success: true,
        data: {
          progressPercentage,
          completedLessons,
          currentLessonId,
          lastLessonId,
        },
      };
    }

    return {
      status: response.status,
      success: response.success,
      data: { progressPercentage: 0, completedLessons: [] },
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
  async getRegions(): Promise<ApiResponse<any[]>> {
    const slug = ENV.DEFAULT_ORG_SLUG || 'cotr';
    return ApiClient.get<any[]>(`regions?slug=${slug}&localOnly=true`);
  },
};

