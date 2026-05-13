export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export interface CourseInstructor {
  name: string;
  title: string;
  bio: string;
}

export interface CourseSyllabusItem {
  id: string;
  title: string;
  durationLabel?: string;
  locked?: boolean;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  tags: string[];
  level: CourseLevel;
  rating: number;
  learnersCount: number;
  durationLabel: string;
  isFree: boolean;
  heroGradient: [string, string, string];
  instructor: CourseInstructor;
  syllabus: CourseSyllabusItem[];
  reviewsPreview?: { name: string; rating: number; text: string }[];
}

export const courses: Course[] = [
  {
    id: "soil-health-natural-farming",
    title: "Soil Health & Natural Farming Techniques",
    category: "Soil health",
    tags: ["Hindi", "Beginner", "Marathi"],
    level: "Beginner",
    rating: 4.9,
    learnersCount: 18200,
    durationLabel: "3h 45m",
    isFree: true,
    heroGradient: ["#f7d7c9", "#cfe7d9", "#f6d8b7"],
    instructor: {
      name: "Vijay Deshmukh",
      title: "NGO Agricultural Consultant",
      bio:
        "A seasoned agriculture expert with over a decade of hands-on experience working with Maharashtra's farmers. Known for practical, results-driven teaching methods."
    },
    syllabus: [
      { id: "1", title: "Soil Microbiology — The Invisible Workforce", durationLabel: "12:45", locked: false },
      { id: "2", title: "Composting & Organic Matter Management", durationLabel: "18:10", locked: true },
      { id: "3", title: "Green Manure Crops & Cover Cropping", durationLabel: "14:05", locked: true },
      { id: "4", title: "Natural Farming Principles — Zero Budget", durationLabel: "16:30", locked: true }
    ],
    reviewsPreview: [
      { name: "Ganesh Pawar", rating: 5, text: "Extremely practical. I set up drip irrigation on my 2-acre farm following this course." },
      { name: "Meera Joshi", rating: 4, text: "Very useful in Marathi. Some modules could have more detail on soil types." },
      { name: "Sunil Wagh", rating: 5, text: "Best course for water management. Clear explanations and field examples." }
    ]
  },
  {
    id: "crop-management-basics",
    title: "Crop Management Basics",
    category: "Crop management",
    tags: ["Hindi", "Beginner"],
    level: "Beginner",
    rating: 4.7,
    learnersCount: 9800,
    durationLabel: "2h 10m",
    isFree: true,
    heroGradient: ["#f6d6c7", "#d9f3dd", "#d6e6ff"],
    instructor: {
      name: "Anita Kulkarni",
      title: "Extension Officer",
      bio: "Focused on simple, step-by-step practices for improving yields with low input cost."
    },
    syllabus: [
      { id: "1", title: "Planning Your Season", durationLabel: "10:15", locked: false },
      { id: "2", title: "Sowing & Spacing", durationLabel: "12:40", locked: true },
      { id: "3", title: "Nutrient Management", durationLabel: "14:30", locked: true }
    ]
  }
];

