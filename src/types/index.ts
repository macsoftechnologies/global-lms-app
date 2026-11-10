/**
 * Shared TypeScript Definitions for LMS Application
 * Strictly aligned with 'Student LMS API Collection' Postman definition.
 */

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  success: boolean;
}

/**
 * API Request Options
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Organization Info from GET /public/organizations/{{orgSlug}}
 */
export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  themeColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  } | null;
}

/**
 * Region Option from GET /regions?slug={{orgSlug}}&localOnly=true
 */
export interface RegionOption {
  id: string;
  name: string;
  code?: string;
  slug?: string;
}

/**
 * Program Batch Date Range from Backend API
 */
export interface ProgramBatchDateRange {
  startMonth?: string;
  endMonth?: string;
  endDate?: string;
}

/**
 * Program Region Configuration
 */
export interface ProgramRegionConfig {
  id?: string;
  organizationId?: string;
  programId?: string;
  regionName?: string;
  hasFixedBatches?: boolean;
  customDurationYears?: number;
  batchDateRanges?: ProgramBatchDateRange[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Program Option from GET /programs/public?limit=100&slug={{orgSlug}} or GET /programs
 */
export interface ProgramOption {
  id: string;
  organizationId?: string;
  name: string;
  code?: string;
  slug?: string;
  description?: string | null;
  totalSemesters?: number;
  totalSubjects?: number;
  maxDurationYears?: number;
  degreeTitle?: string;
  pricing?: any;
  regionalPrices?: any;
  regionConfigs?: ProgramRegionConfig[];
  coursePlanId?: string;
  certificateTemplateId?: string | null;
  certificateIssueMode?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  coverImage?: string;
  bannerUrl?: string;
  image?: string;
}

/**
 * Student Registration Document Item
 */
export interface DocumentItem {
  url: string;
  name: string;
  size?: number;
}

/**
 * Upload API Response Data (POST /upload/public?folder=profiles)
 */
export interface UploadResponseData {
  url: string;
  name?: string;
  size?: number;
  originalName?: string;
}

/**
 * Documents object expected inside customProfile
 */
export interface StudentDocuments {
  photo?: DocumentItem;
  aadhaarFront?: DocumentItem;
  aadhaarBack?: DocumentItem;
  tenthCert?: DocumentItem;
  interCert?: DocumentItem;
  degreeCert?: DocumentItem;
  degreeTranscript?: DocumentItem;
  referenceLetter?: DocumentItem;
  otherCertificates?: DocumentItem[];
  [key: string]: unknown;
}

/**
 * Custom Profile for Student Registration
 * Matches Postman Collection: 'Complete Student Registration (All Seminary & Document Fields)'
 */
export interface StudentCustomProfile {
  ataStatus: string;
  countryOfCitizenship: string;
  countryLivingIn: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus?: string;
  motherTongue?: string;
  otherLanguages?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  currentProfession?: string;
  highestEducation: string;
  theologicalQualifications?: string;
  interestedCourse: string;
  bornAgainDate?: string;
  baptismYear?: string;
  denomination?: string;
  localChurch?: string;
  churchDetails?: string;
  pastorName?: string;
  pastorContact?: string;
  referenceProvider?: string;
  parentName?: string;
  parentPhone?: string;
  parentAddress?: string;
  christianExperience?: string;
  theologicalDesire?: string;
  hobbies?: string;
  howDidYouHear?: string;
  specialHonors?: string;
  documents?: StudentDocuments;
  declarationAccepted: boolean;
}

/**
 * Student Registration Payload (POST /auth/register)
 * Matches Postman Collection root payload
 */
export interface StudentRegistrationPayload {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  organizationCode: string;
  regionId: string;
  ataStatus: string;
  customProfile: StudentCustomProfile;
}

/**
 * Login Request Payload (POST /auth/login)
 */
export interface LoginPayload {
  email: string;
  password: string;
  organizationCode?: string;
}

/**
 * Login Response Payload
 */
export interface LoginResponseData {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role?: string;
    userType?: string;
    status?: string;
    organizationId?: string;
    regionId?: string;
    mobile?: string;
    avatarUrl?: string;
  };
}

/**
 * Published Course & Catalog Interfaces
 * Matches Postman Collection: '2. Programs, Courses & Enrollment'
 */
export interface CoursePricing {
  isPaid?: boolean;
  amount?: number;
  currency?: string;
}

export interface CourseRegionalPrice {
  regionId: string | { _id?: string; name?: string };
  price: number;
  currency?: string;
  regionName?: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration?: string;
  videoUrl?: string;
  hasCheckpoint?: boolean;
  order?: number;
}

export interface CourseModule {
  id: string;
  title: string;
  order?: number;
  lessons?: CourseLesson[];
}

export interface PublishedCourse {
  id: string;
  _id?: string;
  title: string;
  slug?: string;
  code?: string;
  description?: string;
  credits?: number;
  creditHours?: number;
  status?: string;
  pricing?: CoursePricing | number | null;
  price?: number;
  regionalPrices?: CourseRegionalPrice[];
  instructorIds?: string[];
  programId?: string;
  semesterId?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  validityDays?: number;
  enrolledCount?: number;
  certificateIssueMode?: string;
  videoCount?: number;
  totalVideos?: number;
  lessonCount?: number;
  totalLessons?: number;
  category?: string;
  instructor?: string;
  faculty?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  modules?: CourseModule[];
  [key: string]: unknown;
}

export interface CoursePaginationMeta {
  totalItems?: number;
  totalPages?: number;
  currentPage?: number;
  itemsPerPage?: number;
  total?: number;
  page?: number;
  limit?: number;
}

export interface CoursesListResponse {
  data: PublishedCourse[];
  meta?: CoursePaginationMeta;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

/**
 * Faculty Registration Form Data
 */
export interface FacultyRegistrationPayload {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  dateOfBirth: string;
  gender: string;
  profilePhoto?: string;
  highestEducation: string;
  specialization: string;
  yearsOfExperience: string;
  previousInstitution: string;
  bio: string;
  resume?: DocumentItem;
  certificates?: DocumentItem[];
}

/**
 * Dashboard & Academic Interfaces
 */
export interface StudentEnrollmentItem {
  id: string;
  courseId: string;
  courseTitle?: string;
  programId?: string;
  batch?: {
    id?: string;
    name?: string;
    code?: string;
  };
  progressPercentage: number;
  status?: string;
  credits?: number;
  course?: {
    id: string;
    title: string;
    code?: string;
    thumbnailUrl?: string;
    creditHours?: number;
    credits?: number;
    description?: string;
  };
  [key: string]: unknown;
}

export interface StudentProgramEnrollment {
  id: string;
  programId?: string;
  status?: string;
  enrollmentStatus?: string;
  program?: {
    id: string;
    name: string;
    code?: string;
    duration?: string;
    degreeLevel?: string;
  };
  batch?: {
    id: string;
    name: string;
  };
}

export interface LiveSessionItem {
  id: string;
  title: string;
  courseTitle?: string;
  sessionNumber?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  meetingUrl?: string;
  agenda?: string;
  hasAttended?: boolean;
  status?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt?: string;
  isRead?: boolean;
  type?: string;
}

export interface StudentResultSummary {
  gpa?: number;
  cumulativeGpa?: number;
  creditsCompleted?: number;
  totalCredits?: number;
  grades?: {
    courseTitle: string;
    grade: string;
    credits: number;
    semester?: string;
  }[];
}

export interface CertificateItem {
  id: string;
  _id?: string;
  certificateNumber?: string;
  certificateNo?: string;
  serialNumber?: string;
  title?: string;
  courseTitle?: string;
  programName?: string;
  courseId?: string | { _id?: string; id?: string; title?: string; code?: string };
  programId?: string | { _id?: string; id?: string; name?: string };
  course?: {
    id?: string;
    _id?: string;
    title?: string;
    code?: string;
    thumbnailUrl?: string;
  };
  program?: {
    id?: string;
    _id?: string;
    name?: string;
  };
  studentId?: string | { _id?: string; id?: string; fullName?: string; email?: string };
  studentName?: string;
  student?: {
    id?: string;
    _id?: string;
    fullName?: string;
    email?: string;
  };
  issueDate?: string;
  issuedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  status: 'ISSUED' | 'PENDING' | 'PROCESSING' | 'REJECTED' | 'APPROVED' | 'REQUESTED' | string;
  certificateUrl?: string;
  pdfUrl?: string;
  fileUrl?: string;
  downloadUrl?: string;
  verificationCode?: string;
  verificationUrl?: string;
  verifyUrl?: string;
  grade?: string;
  score?: number;
  credits?: number;
  [key: string]: unknown;
}

export interface RequestCertificatePayload {
  courseId: string;
}

export interface RequestCertificateResponse {
  id?: string;
  _id?: string;
  courseId?: string;
  status?: string;
  message?: string;
  certificate?: CertificateItem;
  [key: string]: unknown;
}

export interface PaymentRecord {
  id: string;
  _id?: string;
  amount: number;
  currency?: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'COMPLETED' | 'FAILED' | string;
  invoiceNumber?: string;
  description?: string;
  dueDate?: string;
  paymentDate?: string;
  createdAt?: string;
  paidAt?: string;
  paymentMethod?: string;
  method?: string;
  courseTitle?: string;
  programName?: string;
  course?: { id?: string; _id?: string; title?: string };
  courseId?: { id?: string; _id?: string; title?: string } | string;
  program?: { id?: string; _id?: string; name?: string };
  programId?: { id?: string; _id?: string; name?: string } | string;
  invoicePath?: string;
  pdfUrl?: string;
  invoiceUrl?: string;
  [key: string]: unknown;
}

export interface GenerateInvoiceResponse {
  invoicePath?: string;
  invoiceUrl?: string;
  [key: string]: unknown;
}

export interface DashboardStats {
  enrolled: number;
  inProgress: number;
  completed: number;
  avgProgress: number;
}

/**
 * AI Learning Module Types
 * Matches Postman: GET /courses/:courseId/content/lessons/:lessonId/ai-data
 */
export interface LessonAiQuestion {
  id?: string;
  question: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
}

export interface LessonAiConcept {
  title: string;
  description: string;
  historicalContext?: string;
  category?: string;
}

export interface LessonAiStudyData {
  summary?: string;
  executiveBriefing?: string;
  keyPoints?: string[];
  quiz?: LessonAiQuestion[];
  flashcards?: { front: string; back: string }[];
  concepts?: LessonAiConcept[];
  takeaways?: string[];
}

/**
 * Results & Transcripts Types
 * Aligned with Global LMS Website (/student/results) and Postman Collection Section 8
 */
export interface TranscriptGradeItem {
  id?: string;
  _id?: string;
  courseId?: string;
  courseTitle?: string;
  course?: {
    id?: string;
    _id?: string;
    title?: string;
    code?: string;
    credits?: number | string;
  };
  code?: string;
  credits?: number | string;
  assignmentScore?: number | string;
  attendanceScore?: number | string;
  finalExamScore?: number | string;
  totalScore?: number | string;
  grade?: string;
  gradePoints?: number;
  semester?: string | number;
  semesterId?: string;
  status?: string;
  academicYear?: string;
  remarks?: string;
}

export interface MyGradesResponse {
  student?: {
    id?: string;
    fullName?: string;
    email?: string;
    studentId?: string;
  };
  program?: {
    id?: string;
    name?: string;
    degreeTitle?: string;
    totalCredits?: number;
    totalSemesters?: number;
  };
  grades: TranscriptGradeItem[];
  totalCredits?: number;
  totalCreditsEarned?: number;
  averageScore?: number;
  cumulativeGpa?: number | string;
  gpa?: number | string;
  academicStatus?: string;
}

export interface ExamResultItem {
  id: string;
  _id?: string;
  examId?:
    | {
        id?: string;
        _id?: string;
        title?: string;
        courseId?: { id?: string; _id?: string; title?: string };
      }
    | string;
  exam?: {
    id?: string;
    _id?: string;
    title?: string;
  };
  courseId?:
    | {
        id?: string;
        _id?: string;
        title?: string;
      }
    | string;
  course?: {
    id?: string;
    _id?: string;
    title?: string;
  };
  marksObtained?: number;
  totalMarks?: number;
  percentage?: number;
  grade?: string;
  isPassed?: boolean;
  status?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamAttemptItem {
  id: string;
  _id?: string;
  examId?:
    | {
        id?: string;
        _id?: string;
        title?: string;
        courseId?: { id?: string; _id?: string; title?: string };
      }
    | string;
  attemptNumber?: number;
  marksObtained?: number;
  totalMarks?: number;
  percentage?: number;
  status?: 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATED' | 'PENDING' | string;
  isEvaluated?: boolean;
  answers?: unknown;
  startedAt?: string;
  submittedAt?: string;
  createdAt?: string;
}

export interface AttemptReviewQuestion {
  questionId: string;
  questionText: string;
  options?: string[];
  selectedOption?: string | number;
  textAnswer?: string;
  correctOption?: string | number;
  explanation?: string;
  marksAwarded?: number;
  maxMarks?: number;
  isCorrect?: boolean;
}

export interface AttemptReviewResponse {
  attemptId: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: string;
  questions: AttemptReviewQuestion[];
}

export interface VideoQuizResultItem {
  id: string;
  _id?: string;
  lessonId?:
    | {
        id?: string;
        _id?: string;
        title?: string;
        courseId?: { id?: string; _id?: string; title?: string };
      }
    | string;
  quizId?:
    | {
        id?: string;
        _id?: string;
        questionText?: string;
        maxMarks?: number;
        options?: string[];
      }
    | string;
  marks?: number;
  isGraded?: boolean;
  isCorrect?: boolean;
  selectedOption?: number;
  answerText?: string;
  createdAt?: string;
}

export interface CyclicSemesterItem {
  semesterId: string;
  semesterNumber: number;
  name: string;
  status: 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'LOCKED' | string;
  subjectsCount?: number;
  completedSubjects?: number;
}

export interface CyclicSemesterStatusResponse {
  programId: string;
  currentSemesterId?: string;
  currentSemesterNumber?: number;
  semesters: CyclicSemesterItem[];
}

export interface VideoTranscriptCue {
  start: number;
  end?: number;
  text: string;
}

export interface VideoLessonTranscript {
  lessonId: string;
  vimeoId?: string;
  language?: string;
  cues: VideoTranscriptCue[];
}

/**
 * Course Entitlement & Access Verification
 */
export interface CourseAccessVerification {
  courseId: string;
  isPurchased: boolean;
  isEnrolled: boolean;
  canAccess: boolean;
  progressPercentage: number;
  enrollmentId?: string;
  status?: string;
}
