import type {
  ApplicationPriority,
  ApplicationStatus,
  Language,
} from "@/lib/dashboard-i18n";

export type DemoApplication = {
  id: string;
  applicant: Record<Language, string>;
  village: Record<Language, string>;
  date: string;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  officer: Record<Language, string>;
  dueDate: string;
};

export type DocumentKey =
  "identity" | "ration" | "income" | "residence" | "supporting";

export type ApplicationDocument = {
  id: string;
  key: DocumentKey;
  uploaded: boolean;
  verification: "pending" | "verified" | "rejected";
};

export type WorkflowStage = "documents" | "field" | "review" | "decision";

export type HistoryKey =
  | "submitted"
  | "documentsVerified"
  | "fieldSent"
  | "fieldReport"
  | "finalReview"
  | "approved"
  | "rejected"
  | "returned"
  | "missingRequested"
  | "documentVerified"
  | "replacementRequested"
  | "replacementReceived"
  | "officerComment";

export type ApplicationHistoryEntry = {
  id: string;
  key: HistoryKey;
  date: string;
  comment?: string;
};

export type ApplicationCase = {
  status: ApplicationStatus;
  stage: WorkflowStage;
  documents: ApplicationDocument[];
  fieldReportSubmitted: boolean;
  parentName: Record<Language, string>;
  age: number;
  gender: Record<Language, string>;
  mobile: string;
  address: Record<Language, string>;
  hobli: Record<Language, string>;
  taluk: Record<Language, string>;
  district: Record<Language, string>;
  purpose: Record<Language, string>;
  annualIncome: number;
  familyDetails: Record<Language, string>;
  history: ApplicationHistoryEntry[];
};

const syntheticApplicantDetails = [
  {
    parent: { kn: "ಶಿವಕುಮಾರ್ ಗೌಡ", en: "Shivakumar Gowda" },
    age: 34,
    gender: { kn: "ಮಹಿಳೆ", en: "Woman" },
    hobli: { kn: "ಕಸಬಾ", en: "Kasaba" },
    taluk: { kn: "ಸಾಗರ", en: "Sagara" },
    district: { kn: "ಶಿವಮೊಗ್ಗ", en: "Shivamogga" },
    purpose: { kn: "ಶೈಕ್ಷಣಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನ", en: "Education scholarship" },
    income: 180000,
    family: {
      kn: "ನಾಲ್ವರು ಸದಸ್ಯರು: ಇಬ್ಬರು ವಯಸ್ಕರು ಮತ್ತು ಇಬ್ಬರು ಮಕ್ಕಳು",
      en: "Four members: two adults and two children",
    },
  },
  {
    parent: { kn: "ಲಕ್ಷ್ಮಮ್ಮ", en: "Lakshmamma" },
    age: 29,
    gender: { kn: "ಪುರುಷ", en: "Man" },
    hobli: { kn: "ಯಲಹಂಕ", en: "Yelahanka" },
    taluk: { kn: "ಬೆಂಗಳೂರು ಉತ್ತರ", en: "Bengaluru North" },
    district: { kn: "ಬೆಂಗಳೂರು ನಗರ", en: "Bengaluru Urban" },
    purpose: { kn: "ಶೈಕ್ಷಣಿಕ ಪ್ರವೇಶ", en: "Education admission" },
    income: 240000,
    family: {
      kn: "ಮೂವರು ಸದಸ್ಯರು: ಇಬ್ಬರು ವಯಸ್ಕರು ಮತ್ತು ಒಬ್ಬ ಮಗು",
      en: "Three members: two adults and one child",
    },
  },
  {
    parent: { kn: "ರಮೇಶ್ ಪಾಟೀಲ್", en: "Ramesh Patil" },
    age: 31,
    gender: { kn: "ಮಹಿಳೆ", en: "Woman" },
    hobli: { kn: "ಕಡಬ", en: "Kadaba" },
    taluk: { kn: "ಪುತ್ತೂರು", en: "Puttur" },
    district: { kn: "ದಕ್ಷಿಣ ಕನ್ನಡ", en: "Dakshina Kannada" },
    purpose: { kn: "ವಿದ್ಯಾರ್ಥಿವೇತನ ಅರ್ಹತೆ", en: "Scholarship eligibility" },
    income: 210000,
    family: {
      kn: "ಐವರು ಸದಸ್ಯರು: ಮೂವರು ವಯಸ್ಕರು ಮತ್ತು ಇಬ್ಬರು ಮಕ್ಕಳು",
      en: "Five members: three adults and two children",
    },
  },
  {
    parent: { kn: "ನಾಗರಾಜ ನಾಯಕ್", en: "Nagaraj Nayak" },
    age: 42,
    gender: { kn: "ಪುರುಷ", en: "Man" },
    hobli: { kn: "ಮಲ್ಲಾಪುರ", en: "Mallapura" },
    taluk: { kn: "ಹೊನ್ನಾವರ", en: "Honavar" },
    district: { kn: "ಉತ್ತರ ಕನ್ನಡ", en: "Uttara Kannada" },
    purpose: { kn: "ಶೈಕ್ಷಣಿಕ ಶುಲ್ಕ ರಿಯಾಯಿತಿ", en: "Education fee concession" },
    income: 195000,
    family: {
      kn: "ನಾಲ್ವರು ಸದಸ್ಯರು: ಇಬ್ಬರು ವಯಸ್ಕರು ಮತ್ತು ಇಬ್ಬರು ಮಕ್ಕಳು",
      en: "Four members: two adults and two children",
    },
  },
  {
    parent: { kn: "ಮಹಾದೇವ ಮೂರ್ತಿ", en: "Mahadeva Murthy" },
    age: 36,
    gender: { kn: "ಮಹಿಳೆ", en: "Woman" },
    hobli: { kn: "ಬೇಲೂರು", en: "Belur" },
    taluk: { kn: "ಬೇಲೂರು", en: "Belur" },
    district: { kn: "ಹಾಸನ", en: "Hassan" },
    purpose: {
      kn: "ಸರ್ಕಾರಿ ಯೋಜನೆ ಅರ್ಹತೆ",
      en: "Government scheme eligibility",
    },
    income: 165000,
    family: {
      kn: "ಮೂವರು ಸದಸ್ಯರು: ಒಬ್ಬ ವಯಸ್ಕ ಮತ್ತು ಇಬ್ಬರು ಮಕ್ಕಳು",
      en: "Three members: one adult and two children",
    },
  },
  {
    parent: { kn: "ಗೋಪಾಲ್ ರಾವ್", en: "Gopal Rao" },
    age: 39,
    gender: { kn: "ಪುರುಷ", en: "Man" },
    hobli: { kn: "ಕಸಬಾ", en: "Kasaba" },
    taluk: { kn: "ಮಂಡ್ಯ", en: "Mandya" },
    district: { kn: "ಮಂಡ್ಯ", en: "Mandya" },
    purpose: { kn: "ವಿದ್ಯಾರ್ಥಿವೇತನ ಅರ್ಜಿ", en: "Scholarship application" },
    income: 225000,
    family: {
      kn: "ನಾಲ್ವರು ಸದಸ್ಯರು: ಮೂವರು ವಯಸ್ಕರು ಮತ್ತು ಒಬ್ಬ ಮಗು",
      en: "Four members: three adults and one child",
    },
  },
  {
    parent: { kn: "ಶಿವಪ್ಪ ಶೆಟ್ಟಿ", en: "Shivappa Shetty" },
    age: 33,
    gender: { kn: "ಮಹಿಳೆ", en: "Woman" },
    hobli: { kn: "ಹೊನ್ನಾವರ", en: "Honavar" },
    taluk: { kn: "ಹೊನ್ನಾವರ", en: "Honavar" },
    district: { kn: "ಉತ್ತರ ಕನ್ನಡ", en: "Uttara Kannada" },
    purpose: { kn: "ಶೈಕ್ಷಣಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನ", en: "Education scholarship" },
    income: 175000,
    family: {
      kn: "ಮೂವರು ಸದಸ್ಯರು: ಇಬ್ಬರು ವಯಸ್ಕರು ಮತ್ತು ಒಬ್ಬ ಮಗು",
      en: "Three members: two adults and one child",
    },
  },
  {
    parent: { kn: "ವೆಂಕಟೇಶ್ ಪ್ರಸಾದ್", en: "Venkatesh Prasad" },
    age: 45,
    gender: { kn: "ಪುರುಷ", en: "Man" },
    hobli: { kn: "ಕುಂಬಳೆ", en: "Kumble" },
    taluk: { kn: "ಮಂಗಳೂರು", en: "Mangaluru" },
    district: { kn: "ದಕ್ಷಿಣ ಕನ್ನಡ", en: "Dakshina Kannada" },
    purpose: {
      kn: "ಸರ್ಕಾರಿ ಯೋಜನೆ ಅರ್ಹತೆ",
      en: "Government scheme eligibility",
    },
    income: 260000,
    family: {
      kn: "ಐವರು ಸದಸ್ಯರು: ಮೂವರು ವಯಸ್ಕರು ಮತ್ತು ಇಬ್ಬರು ಮಕ್ಕಳು",
      en: "Five members: three adults and two children",
    },
  },
];

export function createInitialApplicationCase(
  application: DemoApplication,
): ApplicationCase {
  const index = applications.findIndex((item) => item.id === application.id);
  const details =
    syntheticApplicantDetails[
      Math.max(index, 0) % syntheticApplicantDetails.length
    ];
  const stage: WorkflowStage =
    application.status === "field"
      ? "field"
      : application.status === "review"
        ? "review"
        : application.status === "approved" || application.status === "rejected"
          ? "decision"
          : "documents";
  const documentsVerified = stage !== "documents";
  const submittedAt = `${application.date}T09:00:00.000Z`;
  const history: ApplicationHistoryEntry[] = [
    { id: `${application.id}-submitted`, key: "submitted", date: submittedAt },
  ];

  if (stage === "field" || stage === "review" || stage === "decision") {
    history.push({
      id: `${application.id}-documents`,
      key: "documentsVerified",
      date: `${application.date}T11:00:00.000Z`,
    });
    history.push({
      id: `${application.id}-field-sent`,
      key: "fieldSent",
      date: `${application.date}T12:00:00.000Z`,
    });
  }
  if (stage === "review" || stage === "decision") {
    history.push({
      id: `${application.id}-field-report`,
      key: "fieldReport",
      date: `${application.date}T14:00:00.000Z`,
    });
    history.push({
      id: `${application.id}-review`,
      key: "finalReview",
      date: `${application.date}T15:00:00.000Z`,
    });
  }
  if (application.status === "approved" || application.status === "rejected") {
    history.push({
      id: `${application.id}-decision`,
      key: application.status,
      date: `${application.date}T16:00:00.000Z`,
    });
  } else if (application.status === "returned") {
    history.push({
      id: `${application.id}-returned`,
      key: "returned",
      date: `${application.date}T13:00:00.000Z`,
      comment: "Please provide the missing supporting information.",
    });
  }

  return {
    status: application.status,
    stage,
    documents: [
      {
        id: `${application.id}-identity`,
        key: "identity",
        uploaded: true,
        verification: documentsVerified || index === 1 ? "verified" : "pending",
      },
      {
        id: `${application.id}-ration`,
        key: "ration",
        uploaded: true,
        verification: documentsVerified || index === 2 ? "verified" : "pending",
      },
      {
        id: `${application.id}-income`,
        key: "income",
        uploaded: true,
        verification: "verified",
      },
      {
        id: `${application.id}-residence`,
        key: "residence",
        uploaded: true,
        verification: documentsVerified || index === 5 ? "verified" : "pending",
      },
      {
        id: `${application.id}-supporting`,
        key: "supporting",
        uploaded: documentsVerified || index % 2 !== 0,
        verification: documentsVerified
          ? "verified"
          : index % 2 !== 0
            ? "pending"
            : "rejected",
      },
    ],
    fieldReportSubmitted: stage === "review" || stage === "decision",
    parentName: details.parent,
    age: details.age,
    gender: details.gender,
    mobile: `+91 00000 ${String(index + 1).padStart(5, "0")}`,
    address: {
      kn: `${application.village.kn}, ಮಾದರಿ ರಸ್ತೆ, ಮನೆ ಸಂಖ್ಯೆ ${index + 12}`,
      en: `Demo Road, House ${index + 12}, ${application.village.en}`,
    },
    hobli: details.hobli,
    taluk: details.taluk,
    district: details.district,
    purpose: details.purpose,
    annualIncome: details.income,
    familyDetails: details.family,
    history,
  };
}

export const applications: DemoApplication[] = [
  {
    id: "INC-2026-1208",
    applicant: { kn: "ನಂದಿನಿ ಗೌಡ", en: "Nandini Gowda" },
    village: { kn: "ಹುಲಿಕಲ್", en: "Hulikallu" },
    date: "2026-11-06",
    status: "documents",
    priority: "high",
    officer: { kn: "ಮಾನಸ್ವಿ ಗೌಡ", en: "Manasvi Gowda" },
    dueDate: "2026-11-09",
  },
  {
    id: "INC-2026-1203",
    applicant: { kn: "ಚೇತನ್ ಕುಮಾರ್", en: "Chetan Kumar" },
    village: { kn: "ಹೆಬ್ಬಾಳ", en: "Hebbal" },
    date: "2026-11-05",
    status: "field",
    priority: "high",
    officer: { kn: "ರವಿಕುಮಾರ್ ಶೆಟ್ಟಿ", en: "Ravikumar Shetty" },
    dueDate: "2026-11-08",
  },
  {
    id: "INC-2026-1197",
    applicant: { kn: "ಶ್ರೇಯಾ ಪಾಟೀಲ್", en: "Shreya Patil" },
    village: { kn: "ಕಡಬ", en: "Kadaba" },
    date: "2026-11-04",
    status: "review",
    priority: "normal",
    officer: { kn: "ಮಾನಸ್ವಿ ಗೌಡ", en: "Manasvi Gowda" },
    dueDate: "2026-11-12",
  },
  {
    id: "INC-2026-1186",
    applicant: { kn: "ದರ್ಶನ್ ನಾಯಕ್", en: "Darshan Nayak" },
    village: { kn: "ಮಲ್ಲಾಪುರ", en: "Mallapura" },
    date: "2026-11-03",
    status: "returned",
    priority: "normal",
    officer: { kn: "ಆಶಾ ಹೆಗಡೆ", en: "Asha Hegde" },
    dueDate: "2026-11-14",
  },
  {
    id: "INC-2026-1179",
    applicant: { kn: "ಕಾವ್ಯಾ ಮೂರ್ತಿ", en: "Kavya Murthy" },
    village: { kn: "ಬೆಳಗೋಡು", en: "Belagodu" },
    date: "2026-11-02",
    status: "documents",
    priority: "high",
    officer: { kn: "ಮಾನಸ್ವಿ ಗೌಡ", en: "Manasvi Gowda" },
    dueDate: "2026-11-07",
  },
  {
    id: "INC-2026-1162",
    applicant: { kn: "ಅರ್ಜುನ್ ರಾವ್", en: "Arjun Rao" },
    village: { kn: "ಸೋಮನಹಳ್ಳಿ", en: "Somanahalli" },
    date: "2026-11-01",
    status: "field",
    priority: "normal",
    officer: { kn: "ರವಿಕುಮಾರ್ ಶೆಟ್ಟಿ", en: "Ravikumar Shetty" },
    dueDate: "2026-11-12",
  },
  {
    id: "INC-2026-1151",
    applicant: { kn: "ಮೇಘನಾ ಶೆಟ್ಟಿ", en: "Meghana Shetty" },
    village: { kn: "ಹೊನ್ನಾವರ", en: "Honavara" },
    date: "2026-10-31",
    status: "approved",
    priority: "low",
    officer: { kn: "ಆಶಾ ಹೆಗಡೆ", en: "Asha Hegde" },
    dueDate: "2026-11-06",
  },
  {
    id: "INC-2026-1144",
    applicant: { kn: "ವಿನಯ್ ಪ್ರಸಾದ್", en: "Vinay Prasad" },
    village: { kn: "ಕುಂಬಳೆ", en: "Kumble" },
    date: "2026-10-29",
    status: "review",
    priority: "normal",
    officer: { kn: "ಮಾನಸ್ವಿ ಗೌಡ", en: "Manasvi Gowda" },
    dueDate: "2026-11-15",
  },
];

export type ActivityKey =
  "submitted" | "verified" | "fieldReport" | "returned" | "approved";

export const recentActivity: {
  id: string;
  key: ActivityKey;
  applicationId: string;
  applicant: Record<Language, string>;
  time: Record<Language, string>;
  kind: "blue" | "teal" | "amber" | "rose" | "green";
}[] = [
  {
    id: "activity-1",
    key: "submitted",
    applicationId: "INC-2026-1208",
    applicant: { kn: "ನಂದಿನಿ ಗೌಡ", en: "Nandini Gowda" },
    time: { kn: "12 ನಿಮಿಷಗಳ ಹಿಂದೆ", en: "12 min ago" },
    kind: "blue",
  },
  {
    id: "activity-2",
    key: "verified",
    applicationId: "INC-2026-1201",
    applicant: { kn: "ಹರ್ಷಿತಾ ನಾಯಕ್", en: "Harshitha Nayak" },
    time: { kn: "38 ನಿಮಿಷಗಳ ಹಿಂದೆ", en: "38 min ago" },
    kind: "teal",
  },
  {
    id: "activity-3",
    key: "fieldReport",
    applicationId: "INC-2026-1192",
    applicant: { kn: "ಮಂಜುನಾಥ್ ಗೌಡ", en: "Manjunath Gowda" },
    time: { kn: "2 ಗಂಟೆಗಳ ಹಿಂದೆ", en: "2 hr ago" },
    kind: "amber",
  },
  {
    id: "activity-4",
    key: "returned",
    applicationId: "INC-2026-1186",
    applicant: { kn: "ದರ್ಶನ್ ನಾಯಕ್", en: "Darshan Nayak" },
    time: { kn: "ನಿನ್ನೆ", en: "Yesterday" },
    kind: "rose",
  },
  {
    id: "activity-5",
    key: "approved",
    applicationId: "INC-2026-1151",
    applicant: { kn: "ಮೇಘನಾ ಶೆಟ್ಟಿ", en: "Meghana Shetty" },
    time: { kn: "ನಿನ್ನೆ", en: "Yesterday" },
    kind: "green",
  },
];
