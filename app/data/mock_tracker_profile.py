"""Canonical profile dashboard copy (achievements, default skills)."""
from __future__ import annotations

MOCK_PROFILE_ACHIEVEMENTS: list[dict] = [
    {
        "title": "Python Certification",
        "date": "Completed on Oct 15, 2023",
        "tag": "ISO 9001",
        "status": "completed",
    },
    {
        "title": "Web Development Project",
        "date": "Completed on Sep 22, 2023",
        "tag": "IEEE Standard",
        "status": "completed",
    },
    {
        "title": "Database Design",
        "date": "Completed on Aug 10, 2023",
        "tag": "ISO 27001",
        "status": "completed",
    },
    {
        "title": "Advanced Database Systems",
        "date": "In progress (80% complete)",
        "tag": "University Workshop",
        "status": "progress",
    },
]

DEFAULT_PROFILE_SKILLS: list[dict] = [
    {"name": "Programming", "pct": 85},
    {"name": "Data Analysis", "pct": 70},
    {"name": "Database Design", "pct": 55},
    {"name": "Web Development", "pct": 80},
    {"name": "Algorithms", "pct": 65},
]

LINK_TYPE_LABELS = {
    "linkedin": "LinkedIn",
    "portfolio": "Portfolio",
    "github": "GitHub",
    "website": "Website",
}

MOCK_CURRENT_COURSES: list[dict] = [
    {
        "name": "Advanced Algorithms",
        "instructor": "Prof. Johnson",
        "schedule": "Mon/Wed 10:00 AM",
        "grade": "A",
    },
    {
        "name": "Database Systems",
        "instructor": "Dr. Miller",
        "schedule": "Tue/Thu 1:30 PM",
        "grade": "A-",
    },
    {
        "name": "Machine Learning",
        "instructor": "Prof. Zhang",
        "schedule": "Wed/Fri 3:00 PM",
        "grade": "B+",
    },
]

MOCK_GPA_TREND: list[dict] = [
    {"term": "Fall 2021", "gpa": 3.5},
    {"term": "Spring 2022", "gpa": 3.7},
    {"term": "Fall 2022", "gpa": 3.8},
    {"term": "Spring 2023", "gpa": 3.9},
    {"term": "Fall 2023", "gpa": 3.8},
]

MOCK_ATTENDANCE_HISTORY: list[dict] = [
    {
        "title": "Monthly Progress Review",
        "date": "Nov 10, 2023",
        "time": "10:30 AM",
        "status": "Present",
    },
    {
        "title": "Technical Skills Assessment",
        "date": "Nov 5, 2023",
        "time": "11:00 AM",
        "status": "Present",
    },
    {
        "title": "Group Mentoring Session",
        "date": "Oct 28, 2023",
        "time": "2:00 PM",
        "status": "Absent",
    },
]

MOCK_ACADEMIC_HONORS: list[dict] = [
    {"title": "Dean's List", "term": "Spring 2023 Semester"},
    {"title": "Outstanding Project Award", "term": "Database Design Competition"},
]

DEFAULT_COMPETENCY_SKILLS: list[dict] = [
    {"name": "Technical Proficiency", "score": 4.7},
    {"name": "Problem Solving", "score": 4.9},
    {"name": "Communication", "score": 4.2},
    {"name": "Leadership", "score": 4.5},
]

COMPETENCY_BADGES: list[dict] = [
    {"label": "Expert", "tone": "blue"},
    {"label": "Verified", "tone": "green"},
    {"label": "Mentor", "tone": "purple"},
]

DEFAULT_CAREER_GOAL = (
    "Become a senior software engineer specializing in machine learning "
    "applications within 5 years of graduation."
)

DEFAULT_CAREER_EXPERIENCE: list[dict] = [
    {
        "title": "Research Assistant",
        "org": "University Research Lab • 2023",
        "bullets": [
            "Conducted research on machine learning applications",
            "Co-authored research paper on medical imaging",
        ],
    },
    {
        "title": "Web Developer Intern",
        "org": "TechStart Inc. • 2022",
        "bullets": [
            "Developed and maintained web applications",
            "Implemented responsive designs with React",
        ],
    },
]

DEFAULT_PERFORMANCE_INDICATORS: list[dict] = [
    {"label": "Top 10% in Department", "tone": "green"},
    {"label": "85% Activity Completion", "tone": "blue"},
    {"label": "92% Meeting Attendance", "tone": "purple"},
    {"label": "3 Certifications", "tone": "orange"},
]

DEFAULT_ACHIEVEMENTS_SEMESTER: list[dict] = [
    {"title": "Research Paper Submission", "status": "Completed"},
    {"title": "Python Certification", "status": "Completed"},
    {"title": "Web Development Project", "status": "In Progress"},
]

DEFAULT_RECENT_ACTIVITY: list[dict] = [
    {"title": "Progress Meeting Attended", "when": "Today, 10:30 AM"},
    {"title": "Project Milestone Completed", "when": "Yesterday, 2:15 PM"},
]

DEFAULT_GROWTH_ANALYSIS: list[dict] = [
    {"label": "Technical Growth", "pct": 42},
    {"label": "Soft Skills", "pct": 23},
]

DEFAULT_LEARNING_RESOURCES: list[dict] = [
    {
        "title": "Machine Learning Fundamentals",
        "description": "Online course with certification",
        "badge": "Recommended",
        "rating": "4.8/5",
    },
    {
        "title": "Advanced Database Systems",
        "description": "University workshop series",
        "badge": "In Progress",
        "rating": "4.5/5",
    },
    {
        "title": "Full-Stack Development",
        "description": "Hands-on project-based learning",
        "badge": "Upcoming",
        "rating": "4.9/5",
    },
]

MOCK_DOCUMENT_LIBRARY: list[dict] = [
    {
        "title": "Research Paper - Medical Imaging",
        "type": "Research Paper",
        "date": "Uploaded Nov 12, 2023",
        "status": "Verified",
    },
    {
        "title": "Python Certification",
        "type": "Certificate",
        "date": "Uploaded Oct 15, 2023",
        "status": "Verified",
    },
    {
        "title": "Web Development Project",
        "type": "Project Document",
        "date": "Uploaded Sep 22, 2023",
        "status": "Verified",
    },
    {
        "title": "Internship Certificate",
        "type": "Certificate",
        "date": "Uploaded Aug 30, 2023",
        "status": "Verified",
    },
    {
        "title": "Academic Transcript",
        "type": "Academic Document",
        "date": "Uploaded Aug 12, 2023",
        "status": "Verified",
    },
]
