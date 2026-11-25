# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt
"""
Idempotent demo / test data seeder for the Education app.

Run with:
    bench --site <site> execute education.demo_data.execute

Every section is wrapped so that a failure in one section is reported (and
rolled back to a savepoint) without hiding the others. Re-running the script
does not duplicate records: every record is looked up by a natural key first.
"""

import re
import traceback
from datetime import timedelta

import frappe
from frappe.utils import add_days, getdate

COMPANY = "Samarth"
SCHOOL_NAME = "Global Guardians School"
ABBR = "S"
AY = "2026-27"
AY_START = "2026-04-01"
AY_END = "2027-03-31"
T1_NAME = "Term 1"
T2_NAME = "Term 2"
TODAY = getdate("2026-11-23")  # Monday
PASSWORD = "password"

PROGRAMS = ["Standard 5", "Standard 6", "Standard 7", "Standard 8", "Standard 9"]
ROOMS = [
    ("Room 101", "101", "40"),
    ("Room 102", "102", "40"),
    ("Room 103", "103", "40"),
    ("Room 104", "104", "40"),
    ("Room 105", "105", "40"),
]

# (first, last, email, gender, subjects taught) - see SUBJECT_TEACHERS
INSTRUCTORS = [
    ("Rajesh", "Patel", "rajesh.patel@example.com", "Male", ("Mathematics",)),
    ("Sunita", "Rao", "sunita.rao@example.com", "Female", ("Science", "EVS")),
    ("Vikram", "Singh", "vikram.singh@example.com", "Male", ("English", "Computer Science", "Information Technology")),
    ("Neha", "Kapoor", "neha.kapoor@example.com", "Female", ("Hindi", "Sanskrit")),
    ("Arjun", "Nair", "arjun.nair@example.com", "Male", ("Social Science", "Art & Craft")),
]

# (first, last, email, gender, dob, program, blood group, city)
STUDENTS = [
    ("Rahul", "Sharma", "rahul.sharma@example.com", "Male", "2016-05-14", "Standard 5", "B+", "Ahmedabad"),
    ("Priya", "Patel", "priya.patel@example.com", "Female", "2016-08-22", "Standard 5", "O+", "Ahmedabad"),
    ("Aarav", "Mehta", "aarav.mehta@example.com", "Male", "2015-03-09", "Standard 6", "A+", "Vadodara"),
    ("Ananya", "Shah", "ananya.shah@example.com", "Female", "2014-11-30", "Standard 7", "AB+", "Surat"),
    ("Kavya", "Joshi", "kavya.joshi@example.com", "Female", "2013-07-18", "Standard 8", "O-", "Rajkot"),
]

# (first, last, email, gender, ward email, relation, occupation)
GUARDIANS = [
    ("Amit", "Sharma", "amit.sharma@example.com", "Male", "rahul.sharma@example.com", "Father", "Software Engineer"),
    ("Kiran", "Patel", "kiran.patel@example.com", "Female", "priya.patel@example.com", "Mother", "Doctor"),
    ("Sanjay", "Mehta", "sanjay.mehta@example.com", "Male", "aarav.mehta@example.com", "Father", "Businessman"),
    ("Pooja", "Shah", "pooja.shah@example.com", "Female", "ananya.shah@example.com", "Mother", "Chartered Accountant"),
    ("Manoj", "Joshi", "manoj.joshi@example.com", "Male", "kavya.joshi@example.com", "Father", "Bank Manager"),
]

PERIODS = [
    ("09:00:00", "09:45:00"),
    ("09:50:00", "10:35:00"),
    ("10:50:00", "11:35:00"),
    ("11:40:00", "12:25:00"),
]

RESULTS = []  # (section, status, message)
CTX = frappe._dict()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def log(msg):
    print(msg, flush=True)


def section(title):
    def decorator(fn):
        def wrapper():
            sp = "seed_" + re.sub(r"\W+", "_", title.lower())[:40]
            frappe.db.savepoint(sp)
            try:
                fn()
                frappe.db.commit()
                RESULTS.append((title, "OK", ""))
                log(f"[OK]   {title}")
            except Exception as e:
                frappe.db.rollback(save_point=sp)
                frappe.db.commit()
                RESULTS.append((title, "FAILED", f"{type(e).__name__}: {e}"))
                log(f"[FAIL] {title}: {type(e).__name__}: {e}")
                log(traceback.format_exc())
            finally:
                frappe.local.message_log = []

        wrapper.__name__ = fn.__name__
        return wrapper

    return decorator


def get_or_insert(doctype, filters, values=None, submit=False):
    """Return existing doc name matching filters or insert a new doc."""
    name = frappe.db.get_value(doctype, filters, "name")
    if name:
        if submit:
            doc = frappe.get_doc(doctype, name)
            if doc.docstatus == 0:
                doc.submit()
        return name
    data = {"doctype": doctype}
    if isinstance(filters, dict):
        data.update(filters)
    data.update(values or {})
    doc = frappe.get_doc(data)
    doc.insert(ignore_permissions=True)
    if submit:
        doc.submit()
    return doc.name


def ensure_user(email, first_name, last_name, roles, gender=None, user_type="System User"):
    if frappe.db.exists("User", email):
        user = frappe.get_doc("User", email)
        existing = {r.role for r in user.roles}
        missing = [r for r in roles if r not in existing]
        if missing:
            user.flags.ignore_password_policy = True
            user.add_roles(*missing)
        if not user.enabled:
            user.db_set("enabled", 1)
    else:
        user = frappe.get_doc(
            {
                "doctype": "User",
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "gender": gender,
                "enabled": 1,
                "send_welcome_email": 0,
                "user_type": user_type,
                "new_password": PASSWORD,
            }
        )
        user.flags.ignore_password_policy = True
        for r in roles:
            user.append("roles", {"role": r})
        user.insert(ignore_permissions=True)
    # Always (re)set the password so logins are deterministic. This bypasses
    # the password-strength policy without disabling it site-wide.
    from frappe.utils.password import update_password

    update_password(email, PASSWORD)
    return email


def weekdays_between(start, end):
    d = getdate(start)
    end = getdate(end)
    while d <= end:
        if d.weekday() < 5:
            yield d
        d = d + timedelta(days=1)


def student_id(email):
    return frappe.db.get_value("Student", {"student_email_id": email}, "name")


def class_no(program):
    return program.split()[-1]


def course_title(subject, program):
    """Per-class course name, e.g. ("Mathematics", "Standard 5") -> "Mathematics - Std 5"."""
    return f"{subject} - Std {class_no(program)}"


def subject_of(course):
    return course.rsplit(" - Std ", 1)[0]


def iter_courses():
    """Yield (program, course spec, course name) for the whole curriculum."""
    for program in PROGRAMS:
        for spec in CURRICULUM[program]:
            yield program, spec, course_title(spec["subject"], program)


def program_courses(program):
    return [course_title(spec["subject"], program) for spec in CURRICULUM[program]]


def course_spec(course):
    for _program, spec, name in iter_courses():
        if name == course:
            return spec


def quiz_title(topic_name, program):
    return f"{topic_name} Quiz - Std {class_no(program)}"


def instructor_for_course(course):
    return SUBJECT_TEACHERS.get(subject_of(course))


def batch_group(program):
    return f"{program} - Section A"


# ---------------------------------------------------------------------------
# sections
# ---------------------------------------------------------------------------


@section("Setup flags, holiday list, academic year and terms")
def seed_setup():
    # Education app setup flag
    frappe.db.set_value(
        "Installed Application", {"app_name": "education"}, "is_setup_complete", 1
    )

    # Holiday list for the academic year (needed by Student Attendance / Leave)
    hl_name = "Samarth School Holidays 2026-27"
    if not frappe.db.exists("Holiday List", hl_name):
        hl = frappe.new_doc("Holiday List")
        hl.holiday_list_name = hl_name
        hl.from_date = AY_START
        hl.to_date = AY_END
        public = {
            "2026-08-15": "Independence Day",
            "2026-10-02": "Gandhi Jayanti",
            "2026-10-20": "Dussehra",
            "2026-11-09": "Diwali Vacation (Bhai Dooj)",
            "2026-12-25": "Christmas",
            "2027-01-14": "Makar Sankranti",
            "2027-01-26": "Republic Day",
            "2027-03-22": "Holi",
        }
        d = getdate(AY_START)
        while d <= getdate(AY_END):
            ds = d.strftime("%Y-%m-%d")
            if d.weekday() == 6:
                hl.append("holidays", {"holiday_date": d, "description": "Sunday", "weekly_off": 1})
            elif d.weekday() == 5:
                hl.append("holidays", {"holiday_date": d, "description": "Saturday", "weekly_off": 1})
            elif ds in public:
                hl.append("holidays", {"holiday_date": d, "description": public[ds]})
            d = d + timedelta(days=1)
        hl.insert(ignore_permissions=True)
    if frappe.db.get_value("Company", COMPANY, "default_holiday_list") != hl_name:
        frappe.db.set_value("Company", COMPANY, "default_holiday_list", hl_name)
        frappe.clear_cache(doctype="Company")
    CTX.holiday_list = hl_name

    # Academic Year / Terms
    get_or_insert(
        "Academic Year",
        {"academic_year_name": AY},
        {"year_start_date": AY_START, "year_end_date": AY_END},
    )
    CTX.t1 = get_or_insert(
        "Academic Term",
        {"academic_year": AY, "term_name": T1_NAME},
        {"term_start_date": "2026-04-01", "term_end_date": "2026-09-30"},
    )
    CTX.t2 = get_or_insert(
        "Academic Term",
        {"academic_year": AY, "term_name": T2_NAME},
        {"term_start_date": "2026-10-01", "term_end_date": "2027-03-31"},
    )

    settings = frappe.get_single("Education Settings")
    settings.current_academic_year = AY
    settings.current_academic_term = CTX.t2
    settings.school_college_name_abbreviation = SCHOOL_NAME
    if not settings.instructor_created_by:
        settings.instructor_created_by = "Full Name"
    settings.save(ignore_permissions=True)


@section("Masters: rooms, batches, categories, houses, department, breaks")
def seed_masters():
    CTX.rooms = []
    for room_name, number, cap in ROOMS:
        CTX.rooms.append(
            get_or_insert(
                "Room",
                {"room_name": room_name},
                {"room_number": number, "seating_capacity": cap},
            )
        )
    for b in ["Section A", "Section B", "Section C"]:
        get_or_insert("Student Batch Name", {"batch_name": b})
    for c in ["General", "Scholarship", "Staff Ward"]:
        get_or_insert("Student Category", {"category": c})
    for h in ["Red House", "Blue House", "Green House", "Yellow House"]:
        get_or_insert("School House", {"house_name": h})
    for lang in ["English", "Hindi", "Gujarati"]:
        get_or_insert("Student Language", {"language_name": lang})
    for name, s, e in [
        ("Morning Break", "10:35:00", "10:50:00"),
        ("Lunch Break", "12:25:00", "13:00:00"),
    ]:
        get_or_insert("Break", {"break_name": name}, {"start_time": s, "end_time": e})

    CTX.department = frappe.db.get_value(
        "Department", {"department_name": "Academics", "company": COMPANY}, "name"
    )
    if not CTX.department:
        CTX.department = (
            frappe.get_doc(
                {
                    "doctype": "Department",
                    "department_name": "Academics",
                    "company": COMPANY,
                    "parent_department": "All Departments",
                }
            )
            .insert(ignore_permissions=True)
            .name
        )
    get_or_insert("Designation", {"designation_name": "Teacher"})


@section("Grading scale, assessment criteria and groups")
def seed_assessment_masters():
    if not frappe.db.exists("Grading Scale", "CBSE Grading"):
        gs = frappe.get_doc(
            {
                "doctype": "Grading Scale",
                "grading_scale_name": "CBSE Grading",
                "description": "Standard grading scale for Standards 5-9",
                "intervals": [
                    {"grade_code": "A1", "threshold": 90, "grade_description": "Outstanding"},
                    {"grade_code": "A2", "threshold": 80, "grade_description": "Excellent"},
                    {"grade_code": "B1", "threshold": 70, "grade_description": "Very Good"},
                    {"grade_code": "B2", "threshold": 60, "grade_description": "Good"},
                    {"grade_code": "C1", "threshold": 50, "grade_description": "Above Average"},
                    {"grade_code": "C2", "threshold": 40, "grade_description": "Average"},
                    {"grade_code": "D", "threshold": 33, "grade_description": "Pass"},
                    {"grade_code": "E", "threshold": 0, "grade_description": "Needs Improvement"},
                ],
            }
        )
        gs.insert(ignore_permissions=True)
        gs.submit()
    else:
        gs = frappe.get_doc("Grading Scale", "CBSE Grading")
        if gs.docstatus == 0:
            gs.submit()

    get_or_insert("Assessment Criteria Group", {"assessment_criteria_group": "Scholastic"})
    get_or_insert("Assessment Criteria Group", {"assessment_criteria_group": "Co-Scholastic"})
    for crit, grp in [
        ("Theory", "Scholastic"),
        ("Oral", "Scholastic"),
        ("Practical", "Scholastic"),
        ("Project Work", "Co-Scholastic"),
        ("Class Participation", "Co-Scholastic"),
    ]:
        get_or_insert(
            "Assessment Criteria",
            {"assessment_criteria": crit},
            {"assessment_criteria_group": grp},
        )

    if not frappe.db.exists("Assessment Group", "All Assessment Groups"):
        frappe.get_doc(
            {
                "doctype": "Assessment Group",
                "assessment_group_name": "All Assessment Groups",
                "is_group": 1,
            }
        ).insert(ignore_mandatory=True, ignore_permissions=True)
    for g in ["Unit Test 1", "Unit Test 2", "Half Yearly Exam", "Annual Exam", "Class Test"]:
        get_or_insert(
            "Assessment Group",
            {"assessment_group_name": g},
            {"parent_assessment_group": "All Assessment Groups", "is_group": 0},
        )


# Assessment criteria presets (weightages must total 100)
THEORY_ORAL = [("Theory", 80), ("Oral", 20)]
THEORY_PRACTICAL = [("Theory", 70), ("Practical", 30)]
COMPUTER_CRITERIA = [("Theory", 50), ("Practical", 50)]
ART_CRITERIA = [("Practical", 60), ("Project Work", 40)]

# Who teaches which subject (Instructor IDs)
SUBJECT_TEACHERS = {
    "Mathematics": "Rajesh Patel",
    "Science": "Sunita Rao",
    "EVS": "Sunita Rao",
    "English": "Vikram Singh",
    "Computer Science": "Vikram Singh",
    "Information Technology": "Vikram Singh",
    "Hindi": "Neha Kapoor",
    "Sanskrit": "Neha Kapoor",
    "Social Science": "Arjun Nair",
    "Art & Craft": "Arjun Nair",
}

SUBJECT_COLORS = {
    "Mathematics": "blue",
    "Science": "green",
    "EVS": "green",
    "English": "orange",
    "Hindi": "violet",
    "Sanskrit": "purple",
    "Social Science": "teal",
    "Art & Craft": "pink",
    "Computer Science": "cyan",
    "Information Technology": "cyan",
}

# The courses that existed before the per-class curriculum (shared by all programs).
LEGACY_COURSES = ["Mathematics", "Science", "English", "Hindi", "Social Studies"]

# Per-class curriculum. Every class has its own five courses, named
# "<Subject> - Std N". Each course has two topics; every topic carries an
# Article, a Video and a two-question Quiz. In quiz options the correct answer
# is prefixed with "*".
# topic = (topic name, description, (article title, html), (video title, url), [(question, options)])
CURRICULUM = {
    "Standard 5": [
        {
            "subject": "English",
            "description": "Marigold reader: stories, poems, vocabulary and basic grammar.",
            "periods": 3,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Nouns, Pronouns and Adjectives",
                    "Naming words, the words that replace them and describing words.",
                    ("Naming and Describing Words", "<p>A <b>noun</b> names a person, place, animal or thing (Rina, Delhi, cat, pen). A <b>pronoun</b> takes the place of a noun (he, she, it, they).</p><p>An <b>adjective</b> describes a noun: a <i>tall</i> tree, <i>three</i> mangoes, a <i>red</i> kite.</p>"),
                    ("Nouns, Pronouns and Adjectives for Class 5", "https://www.youtube.com/watch?v=CwQjSsa8VQE"),
                    [
                        ("Which word is an adjective in 'The little girl sang a song'?", ["*little", "girl", "sang", "song"]),
                        ("Choose the pronoun that can replace 'Rohan and I'.", ["*We", "They", "He", "Them"]),
                    ],
                ),
                (
                    "Poem: Ice-cream Man",
                    "Reading Rachel Field's poem about the ice-cream man on a hot summer day.",
                    ("Ice-cream Man: Poem Notes", "<p>In <i>Ice-cream Man</i>, Rachel Field describes a hot summer street in the city. The ice-cream man's little cart goes trundling down the street and brings cool treats and joy to the children.</p><p>Notice the rhyming words such as <b>heat</b> and <b>street</b>.</p>"),
                    ("Ice-cream Man Poem Explained", "https://www.youtube.com/watch?v=KnmVX-NK9GY"),
                    [
                        ("Who wrote the poem 'Ice-cream Man'?", ["*Rachel Field", "Ruskin Bond", "Rabindranath Tagore", "R.K. Narayan"]),
                        ("In which season does the ice-cream man come trundling down the street?", ["*Summer", "Winter", "Monsoon", "Autumn"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Hindi",
            "description": "Rimjhim: kahaniyan, kavitayen aur aadharbhoot vyakaran.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Raakh ki Rassi (Kahani)",
                    "Tibbat ki lok-katha jismein sooj-boojh se ek kathin samasya ka hal nikala jata hai.",
                    ("Raakh ki Rassi: Saransh", "<p><i>Raakh ki Rassi</i> Tibbat ki ek lok-katha hai. Mantri Lonpo Gar apne bete ki buddhi ki pariksha lete hain aur use raakh ki rassi laane ko kehte hain.</p><p>Kahani sikhati hai ki kathin se kathin samasya ka hal bhi <b>sooj-boojh</b> se nikal aata hai.</p>"),
                    ("Raakh ki Rassi - Kahani Saransh", "https://www.youtube.com/watch?v=NT1MU7zKBnc"),
                    [
                        ("'Raakh ki Rassi' kis desh ki lok-katha hai?", ["*Tibbat", "Nepal", "Bhutan", "Sri Lanka"]),
                        ("Is kahani se kya seekh milti hai?", ["*Buddhi se har samasya ka hal sambhav hai", "Jaldbazi achhi hoti hai", "Dhan sabse bada hai", "Khel sabse zaroori hai"]),
                    ],
                ),
                (
                    "Sangya aur Uske Bhed",
                    "Vyaktivachak, jativachak aur bhavvachak sangya ki pehchan.",
                    ("Sangya Kya Hai?", "<p>Kisi vyakti, vastu, sthan ya bhav ke naam ko <b>sangya</b> kehte hain.</p><ul><li>Vyaktivachak: Ganga, Delhi, Ram</li><li>Jativachak: nadi, shehar, ladka</li><li>Bhavvachak: khushi, mithas, bachpan</li></ul>"),
                    ("Sangya ke Bhed - Class 5 Vyakaran", "https://www.youtube.com/watch?v=9RDh2bpzJUQ"),
                    [
                        ("'Himalaya' kaun si sangya hai?", ["*Vyaktivachak", "Jativachak", "Bhavvachak", "Samuhvachak"]),
                        ("'Bachpan' kis prakar ki sangya hai?", ["Jativachak", "*Bhavvachak", "Vyaktivachak", "Dravyavachak"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Mathematics",
            "description": "Large numbers, the four operations, fractions, shapes and measurement.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Large Numbers",
                    "Reading, writing and comparing numbers up to crores using the Indian place-value system.",
                    ("Place Value up to Crores", "<p>In the Indian system we group digits as ones, thousands, lakhs and crores: <b>1,23,45,678</b> is read as one crore twenty-three lakh forty-five thousand six hundred seventy-eight.</p><p>To compare two numbers, first count the digits; if they have the same number of digits, compare from the leftmost digit.</p>"),
                    ("Large Numbers and Place Value", "https://www.youtube.com/watch?v=ziVMro-BbnU"),
                    [
                        ("How many zeros are there in one lakh?", ["*5", "6", "7", "4"]),
                        ("What is the place value of 7 in 4,73,215?", ["*70,000", "7,000", "7,00,000", "700"]),
                    ],
                ),
                (
                    "Fractions",
                    "Parts of a whole, equivalent fractions and adding like fractions.",
                    ("Understanding Fractions", "<p>A fraction such as <b>3/4</b> means 3 out of 4 equal parts. The top number is the <i>numerator</i> and the bottom number is the <i>denominator</i>.</p><p>Multiply or divide the numerator and denominator by the same number to get <b>equivalent fractions</b>: 1/2 = 2/4 = 3/6.</p>"),
                    ("Fractions for Class 5", "https://www.youtube.com/watch?v=hnIxLf8KLUY"),
                    [
                        ("Which fraction is equal to 3/5?", ["*6/10", "5/3", "3/10", "6/5"]),
                        ("What is 1/4 + 2/4?", ["*3/4", "3/8", "1/2", "2/8"]),
                    ],
                ),
            ],
        },
        {
            "subject": "EVS",
            "description": "Looking Around: plants, animals, water, food and our environment.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Plants and Animals",
                    "The super senses of animals and how seeds grow and spread.",
                    ("Super Senses of Animals", "<p>Animals have amazing senses. An eagle can spot a small animal from high in the sky, ants follow a smell trail to food and dogs recognise people by their smell.</p><p>Plants grow from <b>seeds</b> that need water, air and warmth to germinate. Seeds are spread by wind, water and animals.</p>"),
                    ("Super Senses - Class 5 EVS", "https://www.youtube.com/watch?v=riSq0r5lCoU"),
                    [
                        ("How do ants find their way to food?", ["*By following a smell trail", "By seeing colours", "By hearing sounds", "By touching leaves"]),
                        ("Which of these does a seed need to germinate?", ["*Water", "Salt", "Sugar", "Oil"]),
                    ],
                ),
                (
                    "Water",
                    "Sources of water, traditional ways of storing it and why every drop counts.",
                    ("Every Drop Counts", "<p>Long ago people built step-wells (<i>baolis</i>) and tanks to collect rain water. Today we get water from rivers, wells, lakes and taps.</p><p><b>Rainwater harvesting</b> collects rain from rooftops so that it can be stored or used to recharge the ground water.</p>"),
                    ("Every Drop Counts - Class 5 EVS", "https://www.youtube.com/watch?v=Q0uWF0nMqNo"),
                    [
                        ("What is a 'baoli'?", ["*A step-well", "A type of boat", "A water pump", "A cooking pot"]),
                        ("Collecting rain water from rooftops is called?", ["*Rainwater harvesting", "Irrigation", "Evaporation", "Filtration"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Art & Craft",
            "description": "Drawing, colour, painting and paper craft activities.",
            "periods": 3,
            "criteria": ART_CRITERIA,
            "topics": [
                (
                    "Colours and the Colour Wheel",
                    "Primary and secondary colours, and warm and cool colours.",
                    ("Mixing Colours", "<p>The <b>primary colours</b> are red, yellow and blue. Mixing two primaries gives a secondary colour: red + yellow = orange, yellow + blue = green, blue + red = violet.</p><p>Reds and oranges feel <i>warm</i>; blues and greens feel <i>cool</i>.</p>"),
                    ("The Colour Wheel for Kids", "https://www.youtube.com/watch?v=V7gyW-KXYFQ"),
                    [
                        ("Which two colours make green?", ["*Yellow and blue", "Red and blue", "Red and yellow", "Black and white"]),
                        ("Which of these is a primary colour?", ["Green", "Orange", "*Blue", "Violet"]),
                    ],
                ),
                (
                    "Paper Craft and Origami",
                    "Folding and cutting paper to make simple models.",
                    ("Origami Basics", "<p><b>Origami</b> is the Japanese art of paper folding. Start with a square sheet and make sharp creases with your thumbnail.</p><p>Simple models to try are a boat, a cup and a jumping frog. A valley fold folds towards you; a mountain fold folds away from you.</p>"),
                    ("Easy Origami Boat", "https://www.youtube.com/watch?v=3N7EUi3-PG8"),
                    [
                        ("Origami, the art of paper folding, comes from which country?", ["*Japan", "India", "Egypt", "Italy"]),
                        ("What shape of paper is most often used to start an origami model?", ["*Square", "Circle", "Triangle", "Star"]),
                    ],
                ),
            ],
        },
    ],
    "Standard 6": [
        {
            "subject": "English",
            "description": "Honeysuckle and A Pact with the Sun: prose, poetry and grammar.",
            "periods": 3,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Who Did Patrick's Homework?",
                    "A story about a boy, a tiny elf and the value of doing your own work.",
                    ("Patrick and the Elf", "<p>Patrick hated homework. One day he caught a tiny elf who offered to do his homework in exchange for his freedom. But the elf knew very little, so Patrick had to explain everything to him - and ended up learning it all himself.</p>"),
                    ("Who Did Patrick's Homework? Summary", "https://www.youtube.com/watch?v=P4SzdHgDu3Q"),
                    [
                        ("Who offered to do Patrick's homework?", ["*A tiny elf", "His teacher", "His sister", "A cat"]),
                        ("Who actually did the homework in the end?", ["*Patrick himself", "The elf", "Patrick's mother", "Patrick's friend"]),
                    ],
                ),
                (
                    "Simple Present and Simple Past",
                    "Using the simple present for habits and facts and the simple past for finished actions.",
                    ("Present or Past?", "<p>The <b>simple present</b> tells about habits and facts: <i>The sun rises in the east.</i> The <b>simple past</b> tells about actions completed in the past: <i>We visited Jaipur last year.</i></p><p>Regular verbs add -ed (walk - walked); irregular verbs change form (go - went, eat - ate).</p>"),
                    ("Simple Present and Simple Past Tense", "https://www.youtube.com/watch?v=ks6CHo0q19s"),
                    [
                        ("Choose the simple past of 'eat'.", ["*ate", "eaten", "eats", "eating"]),
                        ("Which sentence is in the simple present tense?", ["*She walks to school every day.", "She walked to school.", "She will walk to school.", "She is walking to school."]),
                    ],
                ),
            ],
        },
        {
            "subject": "Hindi",
            "description": "Vasant: kahaniyan, kavitayen aur vyakaran.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Vah Chidiya Jo (Kavita)",
                    "Kedarnath Agarwal ki kavita jismein neele pankhon wali nanhi chidiya apne baare mein batati hai.",
                    ("Vah Chidiya Jo: Bhavarth", "<p><i>Vah Chidiya Jo</i> kavita <b>Kedarnath Agarwal</b> ne likhi hai. Neele pankhon wali chhoti si chidiya ko anaaj ke daane, nadi ka jal aur van ke geet bahut pyaare hain.</p>"),
                    ("Vah Chidiya Jo - Class 6 Hindi", "https://www.youtube.com/watch?v=Ki5FMOGVkmc"),
                    [
                        ("'Vah Chidiya Jo' kavita ke kavi kaun hain?", ["*Kedarnath Agarwal", "Sumitranandan Pant", "Harivansh Rai Bachchan", "Mahadevi Verma"]),
                        ("Kavita mein chidiya ke pankh kis rang ke hain?", ["*Neele", "Laal", "Peele", "Hare"]),
                    ],
                ),
                (
                    "Sarvanam aur Visheshan",
                    "Sangya ke sthan par aane wale shabd aur sangya ki visheshta batane wale shabd.",
                    ("Sarvanam aur Visheshan", "<p>Sangya ke sthan par prayog hone wale shabd <b>sarvanam</b> kehlate hain: main, tum, vah, ye.</p><p>Sangya ya sarvanam ki visheshta batane wale shabd <b>visheshan</b> hain: <i>meetha</i> aam, <i>kaala</i> ghoda, <i>do</i> kitabein.</p>"),
                    ("Sarvanam aur Visheshan - Hindi Vyakaran", "https://www.youtube.com/watch?v=CMssLq5G6QA"),
                    [
                        ("'Vah school jaata hai' mein sarvanam kaun sa hai?", ["*Vah", "School", "Jaata", "Hai"]),
                        ("'Laal gulab' mein visheshan kaun sa shabd hai?", ["*Laal", "Gulab", "Dono", "Koi nahin"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Mathematics",
            "description": "Whole numbers, integers, basic geometry, fractions, decimals and data handling.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Integers",
                    "Positive and negative numbers, the number line, and adding and subtracting integers.",
                    ("Integers on the Number Line", "<p>Integers are the numbers ..., -3, -2, -1, 0, 1, 2, 3, ... Numbers to the right of 0 on the number line are positive and those to the left are negative.</p><p>Adding a negative integer moves you to the left: 5 + (-8) = -3. Subtracting an integer is the same as adding its additive inverse: 4 - (-2) = 6.</p>"),
                    ("Integers Class 6", "https://www.youtube.com/watch?v=up5RvhBtFy8"),
                    [
                        ("What is (-7) + 4?", ["*-3", "3", "-11", "11"]),
                        ("Which integer is the smallest?", ["*-9", "-2", "0", "5"]),
                    ],
                ),
                (
                    "Basic Geometry",
                    "Points, lines, line segments, rays, angles and polygons.",
                    ("Points, Lines and Angles", "<p>A <b>point</b> marks an exact location. A <b>line segment</b> has two end points, a <b>ray</b> has one end point and a <b>line</b> extends endlessly in both directions.</p><p>An <b>angle</b> is formed by two rays with a common end point called the vertex.</p>"),
                    ("Basic Geometrical Ideas Class 6", "https://www.youtube.com/watch?v=L9wBhBmvNx0"),
                    [
                        ("How many end points does a ray have?", ["*One", "Two", "None", "Three"]),
                        ("A polygon with three sides is called a?", ["*Triangle", "Quadrilateral", "Pentagon", "Hexagon"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Science",
            "description": "Food, materials, the living world, motion, light and electricity.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Food and Nutrition",
                    "Components of food, a balanced diet and deficiency diseases.",
                    ("Components of Food", "<p>Our food contains <b>carbohydrates</b> and <b>fats</b> (energy), <b>proteins</b> (body-building), <b>vitamins</b> and <b>minerals</b> (protection), along with dietary fibre and water.</p><p>A <b>balanced diet</b> has all of these in the right amounts. Lack of vitamin C causes scurvy; lack of iodine causes goitre.</p>"),
                    ("Components of Food Class 6", "https://www.youtube.com/watch?v=yEb5pDrt_yY"),
                    [
                        ("Which nutrient is called the 'body-building' food?", ["*Proteins", "Carbohydrates", "Fats", "Vitamins"]),
                        ("Deficiency of vitamin C causes?", ["*Scurvy", "Rickets", "Goitre", "Night blindness"]),
                    ],
                ),
                (
                    "Light and Shadows",
                    "Transparent, translucent and opaque objects, how shadows form and the pinhole camera.",
                    ("How Shadows Are Formed", "<p>Light travels in straight lines. When an <b>opaque</b> object blocks light, a dark shadow forms on the other side.</p><p>Transparent objects (clear glass) let light pass; translucent objects (butter paper) let some light pass. A <b>pinhole camera</b> forms an inverted image.</p>"),
                    ("Light, Shadows and Reflections Class 6", "https://www.youtube.com/watch?v=hPM4Oogy3x4"),
                    [
                        ("A shadow is formed when light is blocked by a/an?", ["*Opaque object", "Transparent object", "Mirror", "Luminous object"]),
                        ("The image formed by a pinhole camera is?", ["*Inverted", "Upright and larger", "Coloured", "Not formed at all"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Social Science",
            "description": "Our Pasts I, The Earth Our Habitat and Social and Political Life I.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Early Humans and the Stone Age",
                    "Hunter-gatherers, stone tools, rock shelters and the beginning of farming.",
                    ("From Hunting-Gathering to Growing Food", "<p>Early humans were <b>hunter-gatherers</b> who moved from place to place in search of food. They made tools from stone, wood and bone.</p><p>Sites like <b>Bhimbetka</b> in Madhya Pradesh have rock shelters with paintings. Around 12,000 years ago people began to grow crops and tame animals.</p>"),
                    ("Hunter-Gatherers to Farmers Class 6", "https://www.youtube.com/watch?v=wQuLvmqKFDE"),
                    [
                        ("The Bhimbetka rock shelters are in which state?", ["*Madhya Pradesh", "Rajasthan", "Gujarat", "Bihar"]),
                        ("Early humans who moved around searching for food were called?", ["*Hunter-gatherers", "Farmers", "Traders", "Artisans"]),
                    ],
                ),
                (
                    "The Earth in the Solar System",
                    "The Sun, the eight planets, the Moon and the Earth's place in the solar system.",
                    ("Our Solar System", "<p>The solar system has the Sun and <b>eight planets</b>: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.</p><p>The Earth is the third planet from the Sun and the only planet known to support life. The Moon is the Earth's natural satellite.</p>"),
                    ("The Earth in the Solar System Class 6", "https://www.youtube.com/watch?v=Al9v3jxSW1I"),
                    [
                        ("Which is the third planet from the Sun?", ["*Earth", "Mars", "Venus", "Jupiter"]),
                        ("The Earth's natural satellite is the?", ["*Moon", "Sun", "Mars", "Pole Star"]),
                    ],
                ),
            ],
        },
    ],
    "Standard 7": [
        {
            "subject": "English",
            "description": "Honeycomb and An Alien Hand: prose, poetry, voice and narration.",
            "periods": 3,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Three Questions",
                    "Leo Tolstoy's story of a king who seeks the answers to three important questions.",
                    ("Three Questions: Summary", "<p>A king wanted to know the right time to begin something, the right people to listen to, and the most important thing to do. A wise hermit showed him that the most important time is <b>now</b>, the most important person is the one <b>you are with</b>, and the most important thing is to <b>do good</b> to that person.</p>"),
                    ("Three Questions by Leo Tolstoy", "https://www.youtube.com/watch?v=wqsTeK1XYK8"),
                    [
                        ("Who wrote 'Three Questions'?", ["*Leo Tolstoy", "Charles Dickens", "Mark Twain", "O. Henry"]),
                        ("According to the hermit, the most important time is?", ["*Now", "Tomorrow", "Morning", "Night"]),
                    ],
                ),
                (
                    "Active and Passive Voice",
                    "Changing sentences between the active and the passive voice.",
                    ("Active vs Passive Voice", "<p>In the <b>active voice</b> the subject does the action: <i>Riya wrote a letter.</i> In the <b>passive voice</b> the subject receives the action: <i>A letter was written by Riya.</i></p><p>Use the passive voice when the doer is unknown or less important.</p>"),
                    ("Active and Passive Voice", "https://www.youtube.com/watch?v=1rHi6HGYjQc"),
                    [
                        ("Choose the passive form of 'The cat chased the mouse.'", ["*The mouse was chased by the cat.", "The cat was chased by the mouse.", "The mouse chased the cat.", "The mouse is chasing the cat."]),
                        ("'The cake was baked by Meena' is in which voice?", ["*Passive", "Active", "Reported", "Imperative"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Hindi",
            "description": "Vasant: gadya, padya aur vyakaran.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Hum Panchhi Unmukt Gagan Ke (Kavita)",
                    "Shivmangal Singh 'Suman' ki kavita jo swatantrata ka mahatva batati hai.",
                    ("Hum Panchhi Unmukt Gagan Ke: Bhavarth", "<p>Is kavita mein pinjare mein band panchhi kehte hain ki sone ki salakhon aur maide se bhi achha unhe khula aakash aur nadi ka behta jal lagta hai.</p><p>Kavita ka sandesh hai ki <b>swatantrata</b> sabse badi sampatti hai.</p>"),
                    ("Hum Panchhi Unmukt Gagan Ke - Class 7", "https://www.youtube.com/watch?v=uvDlMa5Lu6w"),
                    [
                        ("'Hum Panchhi Unmukt Gagan Ke' kavita ke kavi kaun hain?", ["*Shivmangal Singh 'Suman'", "Kedarnath Agarwal", "Maithilisharan Gupt", "Suryakant Tripathi 'Nirala'"]),
                        ("Kavita ka mukhya sandesh kya hai?", ["*Swatantrata ka mahatva", "Dhan ka mahatva", "Khel ka mahatva", "Bhojan ka mahatva"]),
                    ],
                ),
                (
                    "Kriya aur Kaal",
                    "Kriya ki pehchan aur bhoot, vartamaan tatha bhavishyat kaal.",
                    ("Kriya aur Kaal", "<p>Kaam ke hone ya karne ka bodh karane wale shabd <b>kriya</b> hain: padhna, khelna, likhna.</p><p>Kriya ke samay ko <b>kaal</b> kehte hain: <i>bhootkaal</i> (maine padha), <i>vartamaan kaal</i> (main padhta hoon), <i>bhavishyat kaal</i> (main padhunga).</p>"),
                    ("Kriya aur Kaal - Hindi Vyakaran", "https://www.youtube.com/watch?v=BHMn4pjhVj8"),
                    [
                        ("'Ritu kal Mumbai jayegi' mein kaun sa kaal hai?", ["*Bhavishyat kaal", "Bhootkaal", "Vartamaan kaal", "Koi nahin"]),
                        ("'Bachche maidan mein khel rahe hain' mein kriya kya hai?", ["*Khel rahe hain", "Bachche", "Maidan", "Mein"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Mathematics",
            "description": "Integers, fractions and decimals, rational numbers, simple equations, triangles and data handling.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Rational Numbers",
                    "Numbers of the form p/q, their standard form and representation on the number line.",
                    ("What Is a Rational Number?", "<p>A <b>rational number</b> can be written as p/q where p and q are integers and q is not zero, e.g. 3/5, -7/4 and 2.</p><p>A rational number is in <b>standard form</b> when q is positive and p and q have no common factor other than 1: -12/18 = -2/3.</p>"),
                    ("Rational Numbers Class 7", "https://www.youtube.com/watch?v=iLSzMsXcvlQ"),
                    [
                        ("Which of these is NOT a rational number?", ["*5/0", "-3/4", "0", "7"]),
                        ("The standard form of 18/-24 is?", ["*-3/4", "3/4", "-6/8", "9/-12"]),
                    ],
                ),
                (
                    "Simple Equations",
                    "Forming and solving simple linear equations in one variable.",
                    ("Solving Simple Equations", "<p>An <b>equation</b> is a condition on a variable such that two expressions are equal, e.g. 2x + 3 = 11.</p><p>Do the same operation on both sides to keep the balance: 2x + 3 - 3 = 11 - 3, so 2x = 8 and x = 4.</p>"),
                    ("Simple Equations Class 7", "https://www.youtube.com/watch?v=CqYXKNIDczg"),
                    [
                        ("Solve: 3x = 21", ["*7", "18", "24", "63"]),
                        ("Solve: x + 9 = 4", ["*-5", "5", "13", "-13"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Science",
            "description": "Nutrition, heat, acids and bases, physical and chemical changes, respiration and electric current.",
            "periods": 4,
            "criteria": THEORY_PRACTICAL,
            "topics": [
                (
                    "Nutrition in Plants",
                    "Photosynthesis, autotrophs and heterotrophs, and other modes of nutrition in plants.",
                    ("How Green Plants Make Their Food", "<p>Green plants are <b>autotrophs</b>: they make their food by <b>photosynthesis</b> using carbon dioxide, water and sunlight, with the help of chlorophyll. Oxygen is released in the process.</p><p>Plants such as <i>Cuscuta</i> (amarbel) are parasites, while the pitcher plant traps and digests insects.</p>"),
                    ("Nutrition in Plants Class 7", "https://www.youtube.com/watch?v=0cmQbPNBZhM"),
                    [
                        ("Organisms that make their own food are called?", ["*Autotrophs", "Heterotrophs", "Parasites", "Saprotrophs"]),
                        ("Which gas is released during photosynthesis?", ["*Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"]),
                    ],
                ),
                (
                    "Heat and Temperature",
                    "Measuring temperature and the transfer of heat by conduction, convection and radiation.",
                    ("Transfer of Heat", "<p>Temperature is measured with a <b>thermometer</b>; normal human body temperature is about 37 &deg;C.</p><p>Heat travels by <b>conduction</b> in solids, by <b>convection</b> in liquids and gases, and by <b>radiation</b> without any medium - that is how the Sun's heat reaches us.</p>"),
                    ("Heat Class 7 Science", "https://www.youtube.com/watch?v=jZpZx0iuBqk"),
                    [
                        ("Normal human body temperature is about?", ["*37 °C", "25 °C", "50 °C", "100 °C"]),
                        ("Heat from the Sun reaches the Earth by?", ["*Radiation", "Conduction", "Convection", "Evaporation"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Sanskrit",
            "description": "Ruchira: shlok, kathayen, shabd roop aur dhatu roop.",
            "periods": 3,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Subhashitani",
                    "Neeti shlokon ka shuddh uchcharan aur unka arth.",
                    ("Subhashitani: Shlok aur Arth", "<p><i>Subhashitani</i> path mein jeevan ke liye upyogi neeti-shlok hain. Ek prasiddh shlok hai: <b>prithivyam treeni ratnani jalam annam subhashitam</b> - prithvi par teen ratna hain: jal, anna aur sundar vachan.</p>"),
                    ("Subhashitani - Class 7 Sanskrit", "https://www.youtube.com/watch?v=zpB7tBHmsxk"),
                    [
                        ("Shlok ke anusaar prithvi par kitne ratna hain?", ["*Teen", "Do", "Chaar", "Paanch"]),
                        ("'Subhashitam' ka arth kya hai?", ["*Sundar vachan", "Bhojan", "Jal", "Dhan"]),
                    ],
                ),
                (
                    "Shabd Roop: Akaranta Shabd",
                    "Balak jaise akaranta pullinga shabdon ke roop teeno vachanon mein.",
                    ("Balak Shabd Roop", "<p><b>Balak</b> (akaranta pullinga) - prathama vibhakti: <i>balakah, balakau, balakah</i>; dvitiya vibhakti: <i>balakam, balakau, balakan</i>.</p><p>Sanskrit mein teen vachan hote hain: ekvachan, dvivachan aur bahuvachan.</p>"),
                    ("Balak Shabd Roop - Sanskrit", "https://www.youtube.com/watch?v=CyPATREwR44"),
                    [
                        ("Sanskrit mein kitne vachan hote hain?", ["*Teen", "Do", "Ek", "Chaar"]),
                        ("'Balak' shabd ka prathama vibhakti dvivachan roop kya hai?", ["*Balakau", "Balakah", "Balakam", "Balakan"]),
                    ],
                ),
            ],
        },
    ],
    "Standard 8": [
        {
            "subject": "English",
            "description": "Honeydew and It So Happened: prose, poetry, reported speech and writing skills.",
            "periods": 3,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "The Best Christmas Present in the World",
                    "Michael Morpurgo's story of a letter written during the Christmas truce of 1914.",
                    ("A Letter from 1914", "<p>The narrator finds a letter in an old desk. Written by Jim Macpherson to his wife Connie, it describes the <b>Christmas truce of 1914</b>, when British and German soldiers stopped fighting, shared food and played football in no man's land.</p>"),
                    ("The Best Christmas Present in the World - Summary", "https://www.youtube.com/watch?v=JiLis0KBQf0"),
                    [
                        ("Who wrote the letter found in the old desk?", ["*Jim Macpherson", "Hans Wolf", "Connie", "The narrator"]),
                        ("In which year did the Christmas truce in the story take place?", ["*1914", "1945", "1918", "1939"]),
                    ],
                ),
                (
                    "Reported Speech",
                    "Converting direct speech into indirect (reported) speech.",
                    ("Direct and Reported Speech", "<p>Direct speech quotes the exact words: <i>Ravi said, \"I am tired.\"</i> Reported speech gives the meaning without quotation marks: <i>Ravi said that he was tired.</i></p><p>When the reporting verb is in the past tense, the tense usually moves one step back (am - was, will - would).</p>"),
                    ("Direct and Indirect Speech", "https://www.youtube.com/watch?v=VxHCs9W7tW4"),
                    [
                        ("Change to reported speech: She said, \"I like mangoes.\"", ["*She said that she liked mangoes.", "She said that I like mangoes.", "She says she liked mangoes.", "She said that she will like mangoes."]),
                        ("In reported speech, 'will' usually changes to?", ["*would", "shall", "can", "may"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Mathematics",
            "description": "Rational numbers, linear equations, quadrilaterals, mensuration, exponents and data handling.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Linear Equations",
                    "Solving linear equations in one variable, including variables on both sides.",
                    ("Linear Equations in One Variable", "<p>A <b>linear equation</b> has the highest power of the variable equal to 1, e.g. 2x - 3 = x + 5.</p><p>Move the variable terms to one side and the constants to the other: 2x - x = 5 + 3, so x = 8. Always check by substituting the answer back.</p>"),
                    ("Linear Equations in One Variable Class 8", "https://www.youtube.com/watch?v=lgYR2FOs_Kg"),
                    [
                        ("Solve: 5x - 4 = 3x + 6", ["*5", "1", "10", "-5"]),
                        ("Which of these is a linear equation?", ["*2y + 7 = 15", "y² = 9", "xy = 4", "x³ + 1 = 0"]),
                    ],
                ),
                (
                    "Mensuration",
                    "Area of a trapezium and polygons; surface area and volume of a cube, cuboid and cylinder.",
                    ("Area and Volume", "<p>Area of a <b>trapezium</b> = 1/2 x (sum of the parallel sides) x height.</p><p>Volume of a <b>cuboid</b> = l x b x h; volume of a <b>cube</b> = a³; volume of a <b>cylinder</b> = &pi;r²h.</p>"),
                    ("Mensuration Class 8", "https://www.youtube.com/watch?v=goU7A8M1xQc"),
                    [
                        ("The volume of a cube of side 4 cm is?", ["*64 cm³", "16 cm³", "48 cm³", "12 cm³"]),
                        ("The area of a trapezium with parallel sides 6 cm and 10 cm and height 4 cm is?", ["*32 cm²", "64 cm²", "40 cm²", "24 cm²"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Science",
            "description": "Microorganisms, materials, cells, force and pressure, friction, sound and chemical effects of current.",
            "periods": 4,
            "criteria": THEORY_PRACTICAL,
            "topics": [
                (
                    "Microorganisms: Friend and Foe",
                    "Bacteria, fungi, protozoa, algae and viruses - useful and harmful microbes.",
                    ("The World of Microbes", "<p>Microorganisms are too small to be seen without a microscope. <b>Lactobacillus</b> turns milk into curd, yeast makes dough rise, and <i>Rhizobium</i> fixes nitrogen in the root nodules of pulses.</p><p>Some microbes cause diseases such as malaria (protozoa), cholera (bacteria) and the common cold (virus).</p>"),
                    ("Microorganisms Friend and Foe Class 8", "https://www.youtube.com/watch?v=zIqZUC2bcSU"),
                    [
                        ("Which bacterium helps convert milk into curd?", ["*Lactobacillus", "Rhizobium", "Yeast", "Plasmodium"]),
                        ("Malaria is caused by a?", ["*Protozoan", "Virus", "Fungus", "Alga"]),
                    ],
                ),
                (
                    "Force and Pressure",
                    "Push and pull, contact and non-contact forces, and pressure in liquids and gases.",
                    ("Understanding Pressure", "<p>A <b>force</b> is a push or a pull. Muscular force and friction are contact forces; magnetic, electrostatic and gravitational forces are non-contact forces.</p><p><b>Pressure</b> = force / area. That is why a sharp knife (small area) cuts better than a blunt one.</p>"),
                    ("Force and Pressure Class 8", "https://www.youtube.com/watch?v=PqegJUGFtVM"),
                    [
                        ("Pressure is defined as?", ["*Force per unit area", "Force x area", "Mass per unit volume", "Area per unit force"]),
                        ("Which of these is a non-contact force?", ["*Magnetic force", "Friction", "Muscular force", "Tension in a rope"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Social Science",
            "description": "Our Pasts III, Resources and Development and Social and Political Life III.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "The Indian Constitution",
                    "Why a country needs a constitution and the key features of the Indian Constitution.",
                    ("Key Features of the Constitution", "<p>The Constitution of India came into effect on <b>26 January 1950</b>. Dr B.R. Ambedkar was the chairman of its Drafting Committee.</p><p>Its key features include federalism, a parliamentary form of government, separation of powers, Fundamental Rights and secularism.</p>"),
                    ("The Indian Constitution Class 8", "https://www.youtube.com/watch?v=kh5_GlJ_hqA"),
                    [
                        ("The Indian Constitution came into effect on?", ["*26 January 1950", "15 August 1947", "26 November 1949", "2 October 1950"]),
                        ("Who was the chairman of the Drafting Committee of the Constitution?", ["*Dr B.R. Ambedkar", "Jawaharlal Nehru", "Mahatma Gandhi", "Sardar Patel"]),
                    ],
                ),
                (
                    "Resources and Their Conservation",
                    "Natural, human-made and human resources, and sustainable development.",
                    ("Using Resources Wisely", "<p>Anything that can be used to satisfy a human need is a <b>resource</b>. Renewable resources such as solar and wind energy are replenished quickly; non-renewable resources like coal and petroleum are limited.</p><p><b>Sustainable development</b> means using resources carefully so that future generations also have enough.</p>"),
                    ("Resources Class 8 Geography", "https://www.youtube.com/watch?v=9gwi0kWspoE"),
                    [
                        ("Which of these is a non-renewable resource?", ["*Coal", "Solar energy", "Wind energy", "Water"]),
                        ("Using resources so that future generations also benefit is called?", ["*Sustainable development", "Urbanisation", "Industrialisation", "Globalisation"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Computer Science",
            "description": "Computational thinking, algorithms and flowcharts, and web page design with HTML.",
            "periods": 3,
            "criteria": COMPUTER_CRITERIA,
            "topics": [
                (
                    "Algorithms and Flowcharts",
                    "Writing step-by-step solutions and drawing them with flowchart symbols.",
                    ("From Algorithm to Flowchart", "<p>An <b>algorithm</b> is a finite set of clear steps to solve a problem. A <b>flowchart</b> shows those steps as a diagram.</p><p>Common symbols: oval = start/stop, parallelogram = input/output, rectangle = process, diamond = decision.</p>"),
                    ("Algorithms and Flowcharts for Beginners", "https://www.youtube.com/watch?v=QCBV_KrB4wk"),
                    [
                        ("Which flowchart symbol is used for a decision?", ["*Diamond", "Oval", "Rectangle", "Parallelogram"]),
                        ("A step-by-step method to solve a problem is called a/an?", ["*Algorithm", "Compiler", "Browser", "Hardware"]),
                    ],
                ),
                (
                    "Introduction to HTML",
                    "Structure of a web page: tags, headings, paragraphs, links and images.",
                    ("Your First Web Page", "<p><b>HTML</b> (HyperText Markup Language) describes the structure of a web page using tags. Every page has <code>&lt;html&gt;</code>, <code>&lt;head&gt;</code> and <code>&lt;body&gt;</code> sections.</p><p>Use <code>&lt;h1&gt;</code> for headings, <code>&lt;p&gt;</code> for paragraphs, <code>&lt;a&gt;</code> for links and <code>&lt;img&gt;</code> for images.</p>"),
                    ("HTML Basics for Beginners", "https://www.youtube.com/watch?v=HcOc7P5BMi4"),
                    [
                        ("What does HTML stand for?", ["*HyperText Markup Language", "High Text Machine Language", "Hyperlink and Text Markup Language", "Home Tool Markup Language"]),
                        ("Which HTML tag is used to create a hyperlink?", ["*The anchor (a) tag", "The paragraph (p) tag", "The image (img) tag", "The heading (h1) tag"]),
                    ],
                ),
            ],
        },
    ],
    "Standard 9": [
        {
            "subject": "English",
            "description": "Beehive and Moments: prose, poetry, grammar and writing.",
            "periods": 3,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "The Fun They Had",
                    "Isaac Asimov's story about school in the year 2157.",
                    ("School in 2157", "<p>In Isaac Asimov's story, Margie and Tommy live in the year <b>2157</b> and learn from mechanical teachers at home. When Tommy finds a real printed book about old schools, Margie imagines how much fun children must have had learning together.</p>"),
                    ("The Fun They Had - Explanation", "https://www.youtube.com/watch?v=hlphs8Lx_0c"),
                    [
                        ("Who wrote 'The Fun They Had'?", ["*Isaac Asimov", "Ruskin Bond", "Rudyard Kipling", "Roald Dahl"]),
                        ("In which year is the story 'The Fun They Had' set?", ["*2157", "2057", "2257", "1957"]),
                    ],
                ),
                (
                    "Modals",
                    "Using can, could, may, might, must, should, will and would.",
                    ("Using Modal Verbs", "<p><b>Modals</b> are helping verbs that express ability, permission, possibility or obligation.</p><p><i>I can swim</i> (ability), <i>May I come in?</i> (permission), <i>It might rain</i> (possibility), <i>You must wear a helmet</i> (obligation).</p>"),
                    ("Modals English Grammar", "https://www.youtube.com/watch?v=padtwaoqogA"),
                    [
                        ("Which modal expresses obligation?", ["*must", "might", "could", "may"]),
                        ("Fill in the blank: ___ I borrow your pen, please?", ["*May", "Must", "Should", "Would have"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Mathematics",
            "description": "Number systems, polynomials, coordinate geometry, linear equations in two variables, triangles and statistics.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "Polynomials",
                    "Degree of a polynomial, zeroes, the remainder theorem and factorisation.",
                    ("Polynomials and Their Zeroes", "<p>A <b>polynomial</b> in x is an expression like 3x² - 5x + 2. Its <b>degree</b> is the highest power of x.</p><p>A <b>zero</b> of p(x) is a value of x for which p(x) = 0. By the <b>Remainder Theorem</b>, when p(x) is divided by (x - a), the remainder is p(a).</p>"),
                    ("Polynomials Class 9", "https://www.youtube.com/watch?v=4VHrvMutJQw"),
                    [
                        ("What is the degree of 4x³ - 2x + 7?", ["*3", "1", "4", "7"]),
                        ("A zero of p(x) = x - 5 is?", ["*5", "-5", "0", "1/5"]),
                    ],
                ),
                (
                    "Coordinate Geometry",
                    "The Cartesian plane, axes, quadrants and plotting points.",
                    ("The Cartesian Plane", "<p>The <b>Cartesian plane</b> is formed by two perpendicular number lines, the x-axis and the y-axis, meeting at the <b>origin</b> (0, 0).</p><p>A point is written as (x, y). The axes divide the plane into four quadrants; in Quadrant II, x is negative and y is positive.</p>"),
                    ("Coordinate Geometry Class 9", "https://www.youtube.com/watch?v=3MIZUl6bWxY"),
                    [
                        ("The point (-3, 4) lies in which quadrant?", ["*Quadrant II", "Quadrant I", "Quadrant III", "Quadrant IV"]),
                        ("The coordinates of the origin are?", ["*(0, 0)", "(1, 1)", "(0, 1)", "(1, 0)"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Science",
            "description": "Matter, the cell, tissues, motion, force and laws of motion, gravitation, work and energy, and sound.",
            "periods": 4,
            "criteria": THEORY_PRACTICAL,
            "topics": [
                (
                    "Matter in Our Surroundings",
                    "The particle nature of matter, states of matter and their interconversion.",
                    ("States of Matter and Change of State", "<p>Matter is made of tiny particles with spaces between them; the particles are continuously moving and attract each other.</p><p>Matter changes state with temperature: ice melts at 0 &deg;C and water boils at 100 &deg;C at normal atmospheric pressure. <b>Evaporation</b> causes cooling.</p>"),
                    ("Matter in Our Surroundings Class 9", "https://www.youtube.com/watch?v=bmzDsWMSCTk"),
                    [
                        ("The boiling point of water at normal atmospheric pressure is?", ["*100 °C", "0 °C", "50 °C", "273 °C"]),
                        ("The change of a solid directly into a gas is called?", ["*Sublimation", "Evaporation", "Condensation", "Fusion"]),
                    ],
                ),
                (
                    "The Fundamental Unit of Life",
                    "Cell structure, cell organelles and the differences between plant and animal cells.",
                    ("The Cell", "<p>The <b>cell</b> is the basic structural and functional unit of life. Robert Hooke first observed cells in a slice of cork in 1665.</p><p>The nucleus controls the activities of the cell, mitochondria are the 'powerhouses' of the cell, and plant cells have a cell wall and chloroplasts that animal cells lack.</p>"),
                    ("The Fundamental Unit of Life Class 9", "https://www.youtube.com/watch?v=StKYyqO8Uvo"),
                    [
                        ("Which organelle is known as the powerhouse of the cell?", ["*Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus"]),
                        ("Who first observed cells, in 1665?", ["*Robert Hooke", "Robert Brown", "Antonie van Leeuwenhoek", "Charles Darwin"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Social Science",
            "description": "India and the Contemporary World I, Contemporary India I, Democratic Politics I and Economics.",
            "periods": 4,
            "criteria": THEORY_ORAL,
            "topics": [
                (
                    "The French Revolution",
                    "Causes, events and legacy of the French Revolution of 1789.",
                    ("Liberty, Equality, Fraternity", "<p>The French Revolution began on <b>14 July 1789</b> with the storming of the Bastille. French society was divided into three estates, and the Third Estate paid most of the taxes.</p><p>The revolution spread the ideas of <b>liberty, equality and fraternity</b> and produced the Declaration of the Rights of Man and Citizen.</p>"),
                    ("The French Revolution Class 9", "https://www.youtube.com/watch?v=PJaUqX9KQW0"),
                    [
                        ("The storming of the Bastille took place on?", ["*14 July 1789", "4 July 1776", "26 January 1950", "14 July 1889"]),
                        ("Which estate in France paid most of the taxes?", ["*Third Estate", "First Estate (clergy)", "Second Estate (nobility)", "None of them"]),
                    ],
                ),
                (
                    "Physical Features of India",
                    "The Himalayas, the Northern Plains, the Peninsular Plateau, the desert, the coastal plains and the islands.",
                    ("Major Physiographic Divisions", "<p>India's major physiographic divisions are the <b>Himalayan mountains</b>, the <b>Northern Plains</b>, the <b>Peninsular Plateau</b>, the Indian Desert, the Coastal Plains and the Islands.</p><p>The Northern Plains are formed by the Indus, Ganga and Brahmaputra river systems and are very fertile. The Peninsular Plateau is the oldest landmass.</p>"),
                    ("Physical Features of India Class 9", "https://www.youtube.com/watch?v=cv_DwtW0c-Q"),
                    [
                        ("Which is the oldest landmass among India's physical divisions?", ["*Peninsular Plateau", "Himalayas", "Northern Plains", "Coastal Plains"]),
                        ("The Lakshadweep islands are located in the?", ["*Arabian Sea", "Bay of Bengal", "Andaman Sea", "Gulf of Mannar"]),
                    ],
                ),
            ],
        },
        {
            "subject": "Information Technology",
            "description": "CBSE IT (402): communication skills, ICT skills, digital documentation and electronic spreadsheets.",
            "periods": 2,
            "criteria": COMPUTER_CRITERIA,
            "topics": [
                (
                    "Digital Documentation",
                    "Creating, formatting and saving documents in a word processor (LibreOffice Writer).",
                    ("Working with a Word Processor", "<p>A word processor such as <b>LibreOffice Writer</b> is used to create letters, reports and notices. You can format text (bold, italic, font size), insert tables and images, and apply styles.</p><p>Writer saves files in the OpenDocument Text format with the extension <b>.odt</b>.</p>"),
                    ("LibreOffice Writer Tutorial for Beginners", "https://www.youtube.com/watch?v=YvXNivbKiS4"),
                    [
                        ("The default file extension of LibreOffice Writer documents is?", ["*.odt", ".ods", ".odp", ".txt"]),
                        ("Which keyboard shortcut makes the selected text bold?", ["*Ctrl + B", "Ctrl + I", "Ctrl + U", "Ctrl + P"]),
                    ],
                ),
                (
                    "Electronic Spreadsheets",
                    "Cells, formulas and functions in LibreOffice Calc.",
                    ("Spreadsheet Basics", "<p>A <b>spreadsheet</b> is a grid of rows and columns. The intersection of a row and a column is a <b>cell</b>, named by its address such as B3.</p><p>Formulas start with <b>=</b>; for example <code>=SUM(B2:B10)</code> adds a range of cells and <code>=AVERAGE(C2:C6)</code> finds their mean.</p>"),
                    ("LibreOffice Calc Basics", "https://www.youtube.com/watch?v=_q3K1rYQCiw"),
                    [
                        ("In a spreadsheet, a formula always begins with?", ["*=", "+", "#", "@"]),
                        ("Which function adds the values in a range of cells?", ["*SUM", "COUNT", "MAX", "AVERAGE"]),
                    ],
                ),
            ],
        },
    ],
}


def _cancel_and_delete(doctype, names):
    for name in names:
        doc = frappe.get_doc(doctype, name)
        if doc.docstatus == 1:
            doc.cancel()
        frappe.delete_doc(doctype, name, ignore_permissions=True)


@section("Migrate shared courses to per-class curriculum")
def migrate_to_per_class_courses():
    """Convert a site seeded with the old shared courses (Mathematics, Science,
    English, Hindi, Social Studies used by every Standard) to the per-class
    curriculum.

    Everything that references the legacy courses is removed here; the regular
    seed sections that run afterwards rebuild it against the per-class courses
    (program courses, enrollments, course groups, schedules, assessments,
    learning activity, timetable). Students, enrollments, attendance, leaves,
    fees and invoices are kept. A no-op once the legacy courses are gone.
    """
    legacy = [c for c in LEGACY_COURSES if frappe.db.exists("Course", c)]
    if not legacy:
        log("       no legacy shared courses found - nothing to migrate")
        return
    log(f"       migrating legacy courses: {', '.join(legacy)}")
    in_legacy = ["in", legacy]

    # Learning content owned by the legacy courses (collected before they go)
    topics = sorted(set(frappe.get_all(
        "Course Topic", filters={"parenttype": "Course", "parent": in_legacy}, pluck="topic"
    )))
    contents = frappe.get_all(
        "Topic Content",
        filters={"parenttype": "Topic", "parent": ["in", topics or ["-"]]},
        fields=["content_type", "content"],
    )
    quizzes = sorted({c.content for c in contents if c.content_type == "Quiz"})
    questions = sorted(set(frappe.get_all(
        "Quiz Question", filters={"parent": ["in", quizzes or ["-"]]}, pluck="question_link"
    )))

    # 1. Learning activity and course enrollments of the legacy courses
    enrollments = frappe.get_all("Course Enrollment", filters={"course": in_legacy}, pluck="name")
    for dt in ("Quiz Activity", "Course Activity"):
        names = set(frappe.get_all(dt, filters={"course": in_legacy}, pluck="name"))
        if enrollments:
            names |= set(frappe.get_all(dt, filters={"enrollment": ["in", enrollments]}, pluck="name"))
        if dt == "Quiz Activity" and quizzes:
            names |= set(frappe.get_all(dt, filters={"quiz": ["in", quizzes]}, pluck="name"))
        for n in sorted(names):
            frappe.delete_doc(dt, n, ignore_permissions=True)
    for n in enrollments:
        frappe.delete_doc("Course Enrollment", n, ignore_permissions=True)

    # 2. Course rows of the (submitted) program enrollments - the enrollments
    #    themselves are kept; seed_enrollments adds the per-class course rows.
    frappe.db.delete("Program Enrollment Course", {"course": in_legacy})

    # 3. Assessment results and plans (submitted: cancel, then delete)
    plans = frappe.get_all("Assessment Plan", filters={"course": in_legacy}, pluck="name")
    results = set(frappe.get_all("Assessment Result", filters={"course": in_legacy}, pluck="name"))
    if plans:
        results |= set(frappe.get_all(
            "Assessment Result", filters={"assessment_plan": ["in", plans]}, pluck="name"
        ))
    _cancel_and_delete("Assessment Result", sorted(results))
    _cancel_and_delete("Assessment Plan", plans)

    # 4. Course schedules and course-based student groups of the legacy courses
    legacy_groups = frappe.get_all(
        "Student Group", filters={"group_based_on": "Course", "course": in_legacy}, pluck="name"
    )
    schedules = set(frappe.get_all("Course Schedule", filters={"course": in_legacy}, pluck="name"))
    if legacy_groups:
        schedules |= set(frappe.get_all(
            "Course Schedule", filters={"student_group": ["in", legacy_groups]}, pluck="name"
        ))
    if schedules:
        # schedule-based attendance / leave would point at deleted schedules
        _cancel_and_delete("Student Attendance", frappe.get_all(
            "Student Attendance", filters={"course_schedule": ["in", list(schedules)]}, pluck="name"
        ))
        for la in frappe.get_all(
            "Student Leave Application",
            filters={"course_schedule": ["in", list(schedules)]},
            fields=["name", "student"],
        ):
            frappe.db.set_value("Student Leave Application", la.name, "course_schedule", None)
    for n in sorted(schedules):
        frappe.delete_doc("Course Schedule", n, ignore_permissions=True)
    for g in legacy_groups:
        frappe.delete_doc("Student Group", g, ignore_permissions=True)

    # 5. Child rows pointing at the legacy courses: instructor logs, program
    #    courses, timetable generator settings, tool singles
    for dt, field in (
        ("Instructor Log", "course"),
        ("Program Course", "course"),
        ("Student Group Creation Tool Course", "course"),
        ("Subject Rules", "subject"),
        ("Teacher Preference", "subject"),
        ("Teaching Rooms", "subject"),
    ):
        frappe.db.delete(dt, {field: in_legacy})
    frappe.db.delete("Singles", {"field": "course", "value": in_legacy})

    # Timetable generation snapshots that show the legacy courses
    for r in frappe.get_all(
        "Timetable Generation Result", fields=["name", "timetable_snapshot", "unscheduled_subjects"]
    ):
        try:
            entries = (frappe.parse_json(r.timetable_snapshot or "{}") or {}).get("entries") or []
        except Exception:
            entries = []
        if any(e.get("course") in legacy for e in entries) or any(
            c in (r.unscheduled_subjects or "") for c in legacy
        ):
            frappe.delete_doc("Timetable Generation Result", r.name, ignore_permissions=True)

    # 6. The legacy courses and the learning content only they used
    for c in legacy:
        frappe.delete_doc("Course", c, ignore_permissions=True)
    for t in topics:
        if not frappe.db.exists("Course Topic", {"topic": t}):
            frappe.delete_doc("Topic", t, ignore_permissions=True)
    for c in contents:
        if frappe.db.exists(c.content_type, c.content) and not frappe.db.exists(
            "Topic Content", {"content_type": c.content_type, "content": c.content}
        ):
            frappe.delete_doc(c.content_type, c.content, ignore_permissions=True)
    for q in questions:
        if frappe.db.exists("Question", q) and not frappe.db.exists("Quiz Question", {"question_link": q}):
            frappe.delete_doc("Question", q, ignore_permissions=True)
    log(
        f"       removed {len(legacy)} courses, {len(topics)} topics, {len(contents)} contents, "
        f"{len(questions)} questions, {len(enrollments)} course enrollments, {len(plans)} assessment plans, "
        f"{len(results)} results, {len(schedules)} schedules, {len(legacy_groups)} course groups"
    )


def _quiz_options(question, options):
    """Options marked with a leading "*" are correct; rotate deterministically so
    the correct answer is not always the first option."""
    rows = [(o.lstrip("*"), 1 if o.startswith("*") else 0) for o in options]
    k = sum(map(ord, question)) % len(rows)
    return rows[k:] + rows[:k]


def _ensure_quiz(title, questions):
    if frappe.db.exists("Quiz", title):
        return title
    q_rows = []
    for q_text, options in questions:
        qname = frappe.db.get_value("Question", {"question": q_text}, "name")
        if not qname:
            qname = (
                frappe.get_doc(
                    {
                        "doctype": "Question",
                        "question": q_text,
                        "options": [
                            {"option": o, "is_correct": c} for o, c in _quiz_options(q_text, options)
                        ],
                    }
                )
                .insert(ignore_permissions=True)
                .name
            )
        q_rows.append({"question_link": qname, "question": q_text})
    frappe.get_doc(
        {
            "doctype": "Quiz",
            "title": title,
            "question": q_rows,
            "passing_score": 50,
            "max_attempts": 3,
            "grading_basis": "Latest Highest Score",
            "is_time_bound": 1,
            "duration": 600,
        }
    ).insert(ignore_permissions=True)
    return title


@section("Learning content: articles, videos, questions, quizzes, topics, courses")
def seed_curriculum():
    for t_idx, (program, spec, course) in enumerate(iter_courses()):
        teacher = instructor_for_course(course)
        topic_rows = []
        for i, (topic_name, topic_desc, (art_title, art_body), (vid_title, vid_url), questions) in enumerate(
            spec["topics"]
        ):
            article = get_or_insert(
                "Article",
                {"title": art_title},
                {
                    "author": teacher,
                    "content": art_body,
                    "publish_date": add_days("2026-10-05", (t_idx + i) % 20),
                },
            )
            video = get_or_insert(
                "Video",
                {"title": vid_title},
                {
                    "provider": "YouTube",
                    "url": vid_url,
                    "youtube_video_id": vid_url.split("v=")[-1],
                    "publish_date": add_days("2026-10-06", (t_idx + i) % 20),
                    "duration": 600,
                    "description": f"<p>{vid_title} - video lesson on <b>{topic_name}</b> for {program} {spec['subject']}.</p>",
                },
            )
            quiz = _ensure_quiz(quiz_title(topic_name, program), questions)
            get_or_insert(
                "Topic",
                {"topic_name": topic_name},
                {
                    "description": topic_desc,
                    "topic_content": [
                        {"content_type": "Article", "content": article},
                        {"content_type": "Video", "content": video},
                        {"content_type": "Quiz", "content": quiz},
                    ],
                },
            )
            topic_rows.append({"topic": topic_name, "topic_name": topic_name})

        get_or_insert(
            "Course",
            {"course_name": course},
            {
                "program": program,
                "description": spec["description"],
                "department": CTX.get("department"),
                "default_grading_scale": "CBSE Grading",
                "topics": topic_rows,
                "assessment_criteria": [
                    {"assessment_criteria": crit, "weightage": w} for crit, w in spec["criteria"]
                ],
            },
        )
        if frappe.db.get_value("Course", course, "program") != program:
            frappe.db.set_value("Course", course, "program", program)


@section("Programs")
def seed_programs():
    for p in PROGRAMS:
        wanted = program_courses(p)
        rows = [{"course": c, "course_name": c, "required": 1} for c in wanted]
        if not frappe.db.exists("Program", p):
            frappe.get_doc(
                {
                    "doctype": "Program",
                    "program_name": p,
                    "program_abbreviation": "STD" + class_no(p),
                    "department": CTX.get("department"),
                    "courses": rows,
                }
            ).insert(ignore_permissions=True)
            continue
        doc = frappe.get_doc("Program", p)
        current = [(r.course, r.required) for r in doc.courses]
        if current != [(c, 1) for c in wanted]:
            doc.set("courses", rows)
            doc.save(ignore_permissions=True)


@section("Instructors (users, employees, instructors)")
def seed_instructors():
    CTX.instructors = []
    for idx, (first, last, email, gender, course) in enumerate(INSTRUCTORS):
        ensure_user(email, first, last, ["Instructor", "Academics User", "Employee"], gender)
        emp = frappe.db.get_value("Employee", {"user_id": email}, "name")
        if not emp:
            e = frappe.get_doc(
                {
                    "doctype": "Employee",
                    "first_name": first,
                    "last_name": last,
                    "gender": gender,
                    "date_of_birth": f"198{idx}-0{idx + 2}-1{idx}",
                    "date_of_joining": "2020-06-01",
                    "company": COMPANY,
                    "status": "Active",
                    "user_id": email,
                    "create_user_permission": 0,
                    "department": CTX.get("department"),
                    "designation": "Teacher",
                    "personal_email": email,
                    "cell_number": f"98250{10000 + idx * 1111}",
                    "holiday_list": CTX.get("holiday_list"),
                }
            )
            e.insert(ignore_permissions=True)
            emp = e.name
        ins_name = f"{first} {last}"
        if not frappe.db.exists("Instructor", ins_name) and not frappe.db.exists(
            "Instructor", {"employee": emp}
        ):
            frappe.get_doc(
                {
                    "doctype": "Instructor",
                    "instructor_name": ins_name,
                    "employee": emp,
                    "department": CTX.get("department"),
                    "gender": gender,
                    "status": "Active",
                }
            ).insert(ignore_permissions=True)
        CTX.instructors.append(
            frappe.db.get_value("Instructor", {"employee": emp}, "name") or ins_name
        )


@section("Students and guardians")
def seed_students():
    for i, (first, last, email, gender, dob, program, bg, city) in enumerate(STUDENTS):
        ensure_user(email, first, last, ["Student"], gender, user_type="Website User")
        if not student_id(email):
            frappe.get_doc(
                {
                    "doctype": "Student",
                    "first_name": first,
                    "last_name": last,
                    "student_email_id": email,
                    "user": email,
                    "enabled": 1,
                    "gender": gender,
                    "date_of_birth": dob,
                    "joining_date": AY_START,
                    "blood_group": bg,
                    "nationality": "Indian",
                    "student_mobile_number": f"98980{20000 + i * 1111}",
                    "address_line_1": f"{12 + i * 7}, Shanti Nagar Society",
                    "city": city,
                    "state": "Gujarat",
                    "pincode": f"3800{10 + i}",
                    "country": "India",
                }
            ).insert(ignore_permissions=True)
        else:
            frappe.db.set_value("Student", student_id(email), "user", email)

    for i, (first, last, email, gender, ward, relation, occupation) in enumerate(GUARDIANS):
        ensure_user(email, first, last, ["Guardian"], gender, user_type="Website User")
        gname = frappe.db.get_value("Guardian", {"email_address": email}, "name")
        if not gname:
            gname = (
                frappe.get_doc(
                    {
                        "doctype": "Guardian",
                        "guardian_name": f"{first} {last}",
                        "email_address": email,
                        "user": email,
                        "mobile_number": f"98790{30000 + i * 1111}",
                        "gender": gender,
                        "occupation": occupation,
                        "education": "Graduate",
                        "designation": occupation,
                        "nationality": "Indian",
                        "work_address": f"{occupation} Office, C.G. Road",
                        "date_of_birth": f"198{i}-0{i + 1}-2{i}",
                        "interests": [{"interest": "Reading"}, {"interest": "Sports"}],
                    }
                )
                .insert(ignore_permissions=True)
                .name
            )
        else:
            frappe.db.set_value("Guardian", gname, "user", email)
        stu = frappe.get_doc("Student", student_id(ward))
        if not any(g.guardian == gname for g in stu.guardians):
            stu.append(
                "guardians",
                {"guardian": gname, "guardian_name": f"{first} {last}", "relation": relation},
            )
            stu.save(ignore_permissions=True)


@section("Program enrollments (submitted) and course enrollments")
def seed_enrollments():
    plan = [(e, p) for (_f, _l, e, _g, _d, p, _b, _c) in STUDENTS]
    plan.append(("rahul.sharma@example.com", "Standard 6"))  # second program for Rahul
    houses = ["Red House", "Blue House", "Green House", "Yellow House", "Red House", "Blue House"]
    for i, (email, program) in enumerate(plan):
        stu = student_id(email)
        name = frappe.db.get_value(
            "Program Enrollment",
            {"student": stu, "program": program, "academic_year": AY, "docstatus": ["<", 2]},
            "name",
        )
        if not name:
            pe = frappe.get_doc(
                {
                    "doctype": "Program Enrollment",
                    "student": stu,
                    "program": program,
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "enrollment_date": AY_START,
                    "student_batch_name": "Section A",
                    "student_category": "Scholarship" if i == 3 else "General",
                    "school_house": houses[i],
                }
            )
            pe.insert(ignore_permissions=True)
            pe.submit()
        else:
            pe = frappe.get_doc("Program Enrollment", name)
            if pe.docstatus == 0:
                pe.set("courses", [])  # re-pulled from the program on validate
                pe.submit()
            else:
                sync_enrollment_courses(pe)
                pe.create_course_enrollments()


def sync_enrollment_courses(pe):
    """Make a submitted Program Enrollment's course rows match its program.

    Child rows of a submitted document cannot be edited through save(), so the
    rows are fixed directly; stale Course Enrollments (without any learning
    activity) are removed so they match the rows.
    """
    wanted = program_courses(pe.program)
    have = [r.course for r in pe.courses]
    if have != wanted:
        frappe.db.delete(
            "Program Enrollment Course",
            {"parent": pe.name, "parenttype": "Program Enrollment", "course": ["not in", wanted]},
        )
        pe.reload()
        have = [r.course for r in pe.courses]
        for c in wanted:
            if c not in have:
                row = pe.append("courses", {"course": c, "course_name": c})
                row.docstatus = pe.docstatus
                row.db_insert()
        order = {c: i for i, c in enumerate(wanted)}
        for row in pe.courses:
            frappe.db.set_value(
                "Program Enrollment Course", row.name, "idx", order.get(row.course, 0) + 1,
                update_modified=False,
            )
        pe.reload()

    for ce in frappe.get_all(
        "Course Enrollment",
        filters={"program_enrollment": pe.name, "course": ["not in", wanted]},
        pluck="name",
    ):
        if not frappe.db.exists("Course Activity", {"enrollment": ce}) and not frappe.db.exists(
            "Quiz Activity", {"enrollment": ce}
        ):
            frappe.delete_doc("Course Enrollment", ce, ignore_permissions=True)


# Course-based groups (remedial / lab sessions): name, course, program, students
COURSE_GROUPS = [
    ("Standard 5 - Mathematics", "Mathematics - Std 5", "Standard 5",
     ["rahul.sharma@example.com", "priya.patel@example.com"]),
    ("Standard 5 - EVS", "EVS - Std 5", "Standard 5",
     ["rahul.sharma@example.com", "priya.patel@example.com"]),
]


def _group_students(emails):
    rows = []
    for e in emails:
        sid = student_id(e)
        rows.append(
            {
                "student": sid,
                "student_name": frappe.db.get_value("Student", sid, "student_name"),
                "active": 1,
            }
        )
    return rows


@section("Student groups")
def seed_groups():
    by_program = {}
    for (_f, _l, email, _g, _d, program, _b, _c) in STUDENTS:
        by_program.setdefault(program, []).append(email)
    all_instructors = [{"instructor": f"{f} {l}"} for (f, l, *_r) in INSTRUCTORS]
    for i, program in enumerate(PROGRAMS):
        gname = batch_group(program)
        if not frappe.db.exists("Student Group", gname):
            frappe.get_doc(
                {
                    "doctype": "Student Group",
                    "student_group_name": gname,
                    "group_based_on": "Batch",
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "program": program,
                    "batch": "Section A",
                    "max_strength": 40,
                    "default_room": CTX.rooms[i],
                    "students": _group_students(by_program.get(program, [])),
                    "instructors": all_instructors,
                }
            ).insert(ignore_permissions=True)

    for gname, course, program, emails in COURSE_GROUPS:
        ins = [instructor_for_course(course)]
        if frappe.db.exists("Student Group", gname):
            sg = frappe.get_doc("Student Group", gname)
            if sg.course != course or [i.instructor for i in sg.instructors] != ins:
                sg.program = program
                sg.course = course
                sg.set("instructors", [{"instructor": x} for x in ins])
                sg.save(ignore_permissions=True)
        else:
            frappe.get_doc(
                {
                    "doctype": "Student Group",
                    "student_group_name": gname,
                    "group_based_on": "Course",
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "program": program,
                    "course": course,
                    "max_strength": 40,
                    "students": _group_students(emails),
                    "instructors": [{"instructor": x} for x in ins],
                }
            ).insert(ignore_permissions=True)

    if not frappe.db.exists("Student Group", "Chess Club"):
        frappe.get_doc(
            {
                "doctype": "Student Group",
                "student_group_name": "Chess Club",
                "group_based_on": "Activity",
                "academic_year": AY,
                "academic_term": CTX.t2,
                "max_strength": 20,
                "students": _group_students(
                    ["rahul.sharma@example.com", "aarav.mehta@example.com", "kavya.joshi@example.com"]
                ),
                "instructors": [{"instructor": "Arjun Nair"}],
            }
        ).insert(ignore_permissions=True)


@section("Instructor logs and subject stream assignments")
def seed_instructor_logs():
    for (first, last, *_rest) in INSTRUCTORS:
        ins_name = f"{first} {last}"
        ins = frappe.get_doc("Instructor", ins_name)
        existing = {(r.program, r.course, r.student_group) for r in ins.instructor_log}
        changed = False
        for program, _spec, course in iter_courses():
            if instructor_for_course(course) != ins_name:
                continue
            key = (program, course, batch_group(program))
            if key not in existing:
                ins.append(
                    "instructor_log",
                    {
                        "academic_year": AY,
                        "academic_term": CTX.t2,
                        "department": CTX.get("department"),
                        "program": program,
                        "course": course,
                        "student_group": batch_group(program),
                    },
                )
                changed = True
        if changed:
            ins.save(ignore_permissions=True)

    # Each per-class course is taught to its own class (stream) only
    for program, _spec, course in iter_courses():
        c = frappe.get_doc("Course", course)
        existing = {(r.academic_term, r.stream) for r in c.stream_assignments}
        if (CTX.t2, batch_group(program)) not in existing:
            c.append(
                "stream_assignments",
                {
                    "academic_term": CTX.t2,
                    "stream": batch_group(program),
                    "teacher": instructor_for_course(course),
                },
            )
            c.save(ignore_permissions=True)


def _schedule(group, course, instructor, room, date, ft, tt, program=None):
    if frappe.db.exists(
        "Course Schedule",
        {"student_group": group, "schedule_date": date, "from_time": ft},
    ):
        return
    frappe.get_doc(
        {
            "doctype": "Course Schedule",
            "naming_series": "EDU-CSH-.YYYY.-",
            "student_group": group,
            "course": course,
            "instructor": instructor,
            "room": room,
            "schedule_date": date,
            "from_time": ft,
            "to_time": tt,
            "program": program,
            "company": COMPANY,
            "class_schedule_color": SUBJECT_COLORS.get(subject_of(course), "green"),
        }
    ).insert(ignore_permissions=True)


def build_week_plan():
    """Deterministic weekly timetable: {(weekday, period index, program): course or None}.

    Each class gets its own subjects ("periods" per week from CURRICULUM) and a
    teacher is never booked for two classes in the same period. Every slot is
    filled by searching all subject combinations for the five classes and
    picking the best-scoring one (spread subjects over the week, avoid
    repeating a subject on the same day, keep the busiest teachers busy).
    Periods that cannot be filled stay free.
    """
    remaining = {p: {course_title(s["subject"], p): s["periods"] for s in CURRICULUM[p]} for p in PROGRAMS}
    teacher = {c: instructor_for_course(c) for p in PROGRAMS for c in remaining[p]}
    n_days, n_periods = 5, len(PERIODS)
    plan = {}
    for d in range(n_days):
        taught_today = {p: set() for p in PROGRAMS}
        for p_idx in range(n_periods):
            slots_left = (n_days - d) * n_periods - p_idx
            load = {}
            for p in PROGRAMS:
                for c, n in remaining[p].items():
                    load[teacher[c]] = load.get(teacher[c], 0) + n
            best = [None, None]

            def search(i, used, choice, score):
                if i == len(PROGRAMS):
                    if best[0] is None or score > best[0]:
                        best[0], best[1] = score, list(choice)
                    return
                prog = PROGRAMS[i]
                need = sum(remaining[prog].values()) / slots_left
                for c, n in remaining[prog].items():
                    if n <= 0 or teacher[c] in used:
                        continue
                    s = (
                        40 * need
                        + 10 * n / (n_days - d)
                        + 15 * load[teacher[c]] / slots_left
                        - (100 if c in taught_today[prog] else 0)
                    )
                    search(i + 1, used | {teacher[c]}, choice + [c], score + s)
                search(i + 1, used, choice + [None], score)

            search(0, frozenset(), [], 0)
            for prog, c in zip(PROGRAMS, best[1]):
                plan[(d, p_idx, prog)] = c
                if c:
                    remaining[prog][c] -= 1
                    taught_today[prog].add(c)
    return plan


@section("Course schedules (current and next week)")
def seed_schedules():
    start = TODAY - timedelta(days=TODAY.weekday())  # Monday of current week
    days = list(weekdays_between(start, start + timedelta(days=11)))
    plan = build_week_plan()
    for date in days:
        for g_idx, program in enumerate(PROGRAMS):
            for p_idx, (ft, tt) in enumerate(PERIODS):
                course = plan.get((date.weekday(), p_idx, program))
                if not course:
                    continue  # free / library period
                _schedule(
                    batch_group(program),
                    course,
                    instructor_for_course(course),
                    CTX.rooms[g_idx],
                    date,
                    ft,
                    tt,
                    program,
                )
        # Course-based remedial / lab sessions after regular periods
        gname, course, program, _students = COURSE_GROUPS[0 if date.weekday() in (0, 2, 4) else 1]
        _schedule(gname, course, instructor_for_course(course),
                  CTX.rooms[0] if date.weekday() in (0, 2, 4) else CTX.rooms[4],
                  date, "13:00:00", "13:45:00", program)


@section("Student attendance (past two weeks)")
def seed_attendance():
    from erpnext.setup.doctype.holiday_list.holiday_list import is_holiday

    start = TODAY - timedelta(days=14)
    end = TODAY - timedelta(days=1)
    absent_pattern = {0: [3], 1: [6], 2: [1, 8], 3: [], 4: [5]}
    for s_idx, (_f, _l, email, _g, _d, program, _b, _c) in enumerate(STUDENTS):
        stu = student_id(email)
        group = batch_group(program)
        for d_idx, date in enumerate(weekdays_between(start, end)):
            if is_holiday(CTX.holiday_list, date):
                continue
            if frappe.db.exists(
                "Student Attendance",
                {"student": stu, "student_group": group, "date": date, "docstatus": ["!=", 2]},
            ):
                continue
            status = "Absent" if d_idx in absent_pattern.get(s_idx, []) else "Present"
            att = frappe.get_doc(
                {
                    "doctype": "Student Attendance",
                    "student": stu,
                    "student_group": group,
                    "date": date,
                    "status": status,
                    "link_nvfk": program,
                }
            )
            att.insert(ignore_permissions=True)
            att.submit()


@section("Student leave applications")
def seed_leaves():
    leaves = [
        # email, from, to, reason, action, mark_as_present
        ("priya.patel@example.com", "2026-11-12", "2026-11-13", "Fever and cold, doctor advised rest.", "submit", 0),
        ("ananya.shah@example.com", "2026-11-17", "2026-11-17", "Representing school at inter-school quiz competition.", "submit", 1),
        ("aarav.mehta@example.com", "2026-11-26", "2026-11-27", "Attending cousin's wedding in Udaipur.", "draft", 0),
        ("kavya.joshi@example.com", "2026-12-01", "2026-12-02", "Dental surgery appointment.", "submit", 0),
        ("rahul.sharma@example.com", "2026-12-03", "2026-12-04", "Family trip (plan cancelled).", "cancel", 0),
    ]
    program_of = {s[2]: s[5] for s in STUDENTS}
    for email, fd, td, reason, action, mark_present in leaves:
        stu = student_id(email)
        name = frappe.db.get_value(
            "Student Leave Application", {"student": stu, "from_date": fd}, "name"
        )
        if name:
            continue
        doc = frappe.get_doc(
            {
                "doctype": "Student Leave Application",
                "student": stu,
                "from_date": fd,
                "to_date": td,
                "reason": reason,
                "mark_as_present": mark_present,
                "attendance_based_on": "Student Group",
                "student_group": batch_group(program_of[email]),
            }
        )
        doc.insert(ignore_permissions=True)
        if action in ("submit", "cancel"):
            doc.submit()
        if action == "cancel":
            doc.cancel()


ASSESSMENTS = [
    # assessment_name, program, course, group, date, from, to, room idx
    ("Unit Test 1 - Mathematics (Std 5)", "Standard 5", "Mathematics - Std 5", "Unit Test 1", "2026-11-10", "09:00:00", "10:00:00", 0),
    ("Unit Test 1 - EVS (Std 5)", "Standard 5", "EVS - Std 5", "Unit Test 1", "2026-11-11", "09:00:00", "10:00:00", 0),
    ("Unit Test 1 - English (Std 5)", "Standard 5", "English - Std 5", "Unit Test 1", "2026-11-12", "09:00:00", "10:00:00", 0),
    ("Unit Test 1 - Mathematics (Std 6)", "Standard 6", "Mathematics - Std 6", "Unit Test 1", "2026-11-10", "10:30:00", "11:30:00", 1),
    ("Unit Test 1 - Hindi (Std 7)", "Standard 7", "Hindi - Std 7", "Unit Test 1", "2026-11-13", "09:00:00", "10:00:00", 2),
    ("Unit Test 1 - Social Science (Std 8)", "Standard 8", "Social Science - Std 8", "Unit Test 1", "2026-11-13", "10:30:00", "11:30:00", 3),
    ("Half Yearly - Mathematics (Std 5)", "Standard 5", "Mathematics - Std 5", "Half Yearly Exam", "2026-12-07", "09:00:00", "11:00:00", 0),
]

SCORES = {
    "rahul.sharma@example.com": [(36, 9), (31, 8), (38, 10), (27, 7)],
    "priya.patel@example.com": [(39, 10), (35, 9), (29, 6)],
    "aarav.mehta@example.com": [(24, 6)],
    "ananya.shah@example.com": [(33, 9)],
    "kavya.joshi@example.com": [(18, 5)],
}


@section("Assessment plans and results")
def seed_assessments():
    score_idx = {}
    for name, program, course, agroup, date, ft, tt, r_idx in ASSESSMENTS:
        group = batch_group(program)
        instructor = instructor_for_course(course)
        is_final = agroup == "Half Yearly Exam"
        theory, oral = (80, 20) if is_final else (40, 10)
        plan = frappe.db.get_value("Assessment Plan", {"assessment_name": name, "docstatus": ["<", 2]}, "name")
        if not plan:
            ap = frappe.get_doc(
                {
                    "doctype": "Assessment Plan",
                    "assessment_name": name,
                    "student_group": group,
                    "assessment_group": agroup,
                    "grading_scale": "CBSE Grading",
                    "course": course,
                    "program": program,
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "schedule_date": date,
                    "room": CTX.rooms[r_idx],
                    "examiner": instructor,
                    "supervisor": instructor,
                    "from_time": ft,
                    "to_time": tt,
                    "maximum_assessment_score": theory + oral,
                    "assessment_criteria": [
                        {"assessment_criteria": "Theory", "maximum_score": theory},
                        {"assessment_criteria": "Oral", "maximum_score": oral},
                    ],
                }
            )
            ap.insert(ignore_permissions=True)
            ap.submit()
            plan = ap.name
        else:
            ap = frappe.get_doc("Assessment Plan", plan)
            if ap.docstatus == 0:
                ap.submit()

        if is_final:
            continue  # upcoming exam - no results yet

        students = [s[2] for s in STUDENTS if s[5] == program]
        for email in students:
            stu = student_id(email)
            i = score_idx.get(email, 0)
            score_idx[email] = i + 1
            if frappe.db.exists(
                "Assessment Result",
                {"student": stu, "assessment_plan": plan, "docstatus": ["!=", 2]},
            ):
                continue
            t, o = SCORES[email][i % len(SCORES[email])]
            res = frappe.get_doc(
                {
                    "doctype": "Assessment Result",
                    "assessment_plan": plan,
                    "student": stu,
                    "student_group": group,
                    "program": program,
                    "course": course,
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "assessment_group": agroup,
                    "grading_scale": "CBSE Grading",
                    "maximum_score": theory + oral,
                    "comment": "Good effort." if t + o >= 35 else "Needs more practice.",
                    "details": [
                        {"assessment_criteria": "Theory", "score": t},
                        {"assessment_criteria": "Oral", "score": o},
                    ],
                }
            )
            res.insert(ignore_permissions=True)
            res.submit()


FEE_CATEGORIES = [
    ("Tuition Fee", "Term tuition fee", 18000),
    ("Library Fee", "Library and reading room", 1200),
    ("Examination Fee", "Unit tests and term exams", 1500),
    ("Activity Fee", "Sports, arts and clubs", 2000),
    ("Transport Fee", "School bus (optional)", 4500),
]


@section("Fees: accounts, categories, structures, schedules, invoices, payments")
def seed_fees():
    income_account = f"Fee Income - {ABBR}"
    if not frappe.db.exists("Account", income_account):
        frappe.get_doc(
            {
                "doctype": "Account",
                "account_name": "Fee Income",
                "parent_account": f"Direct Income - {ABBR}",
                "company": COMPANY,
                "account_type": "Income Account",
                "root_type": "Income",
                "report_type": "Profit and Loss",
            }
        ).insert(ignore_permissions=True)
    cost_center = f"Main - {ABBR}"
    receivable = f"Debtors - {ABBR}"

    for cat, desc, _amt in FEE_CATEGORIES:
        if not frappe.db.exists("Fee Category", cat):
            frappe.get_doc(
                {
                    "doctype": "Fee Category",
                    "category_name": cat,
                    "description": desc,
                    "item_defaults": [
                        {
                            "company": COMPANY,
                            "selling_cost_center": cost_center,
                            "income_account": income_account,
                        }
                    ],
                }
            ).insert(ignore_permissions=True)

    multiplier = {"Standard 5": 1.0, "Standard 6": 1.05, "Standard 7": 1.1, "Standard 8": 1.15, "Standard 9": 1.2}
    CTX.fee_structures = {}
    for program in PROGRAMS:
        fs = frappe.db.get_value(
            "Fee Structure",
            {"program": program, "academic_year": AY, "academic_term": CTX.t2, "docstatus": ["<", 2]},
            "name",
        )
        if not fs:
            components = []
            for cat, desc, amt in FEE_CATEGORIES:
                comp = {
                    "fees_category": cat,
                    "description": desc,
                    "amount": round(amt * multiplier[program]),
                    "discount": 0,
                }
                components.append(comp)
            doc = frappe.get_doc(
                {
                    "doctype": "Fee Structure",
                    "naming_series": "EDU-FST-.YYYY.-",
                    "program": program,
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "company": COMPANY,
                    "receivable_account": receivable,
                    "cost_center": cost_center,
                    "components": components,
                }
            )
            doc.insert(ignore_permissions=True)
            doc.submit()
            fs = doc.name
        else:
            doc = frappe.get_doc("Fee Structure", fs)
            if doc.docstatus == 0:
                doc.submit()
        CTX.fee_structures[program] = fs

    # Fee schedules for the programs that have students
    from education.education.doctype.fee_schedule.fee_schedule import create_sales_invoice

    due_dates = {
        "Standard 5": ("2026-10-05", "2026-10-31"),
        "Standard 6": ("2026-10-05", "2026-11-15"),
        "Standard 7": ("2026-11-01", "2026-12-10"),
        "Standard 8": ("2026-11-01", "2026-12-15"),
    }
    CTX.invoices = {}
    for program, (posting, due) in due_dates.items():
        fs_name = CTX.fee_structures[program]
        sched = frappe.db.get_value(
            "Fee Schedule", {"fee_structure": fs_name, "docstatus": ["<", 2]}, "name"
        )
        if not sched:
            fs_doc = frappe.get_doc("Fee Structure", fs_name)
            sd = frappe.get_doc(
                {
                    "doctype": "Fee Schedule",
                    "naming_series": "EDU-FSH-.YYYY.-",
                    "fee_structure": fs_name,
                    "program": program,
                    "academic_year": AY,
                    "academic_term": CTX.t2,
                    "company": COMPANY,
                    "currency": "INR",
                    "receivable_account": receivable,
                    "cost_center": cost_center,
                    "posting_date": posting,
                    "due_date": due,
                    "student_groups": [{"student_group": batch_group(program)}],
                    "components": [
                        {
                            "fees_category": c.fees_category,
                            "description": c.description,
                            "amount": c.amount,
                            "discount": c.discount,
                            "total": c.total,
                            "item": c.item,
                        }
                        for c in fs_doc.components
                    ],
                }
            )
            sd.insert(ignore_permissions=True)
            sd.submit()
            sched = sd.name

        students = [s[2] for s in STUDENTS if s[5] == program]
        for email in students:
            stu = student_id(email)
            si = frappe.db.get_value(
                "Sales Invoice",
                {"fee_schedule": sched, "student": stu, "docstatus": ["<", 2]},
                "name",
            )
            if not si:
                si = create_sales_invoice(sched, stu)
            si_doc = frappe.get_doc("Sales Invoice", si)
            if si_doc.docstatus == 0:
                si_doc.submit()
            CTX.invoices[email] = si
        frappe.db.set_value("Fee Schedule", sched, "status", "Invoice Created")

    # Payments: Rahul & Aarav fully paid, Priya partially paid, others outstanding
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

    payments = {
        "rahul.sharma@example.com": (None, "2026-10-20", "UPI-REF-RS-1020"),
        "aarav.mehta@example.com": (None, "2026-11-10", "UPI-REF-AM-1110"),
        "priya.patel@example.com": (10000, "2026-10-28", "CHQ-004512"),
    }
    for email, (amount, date, ref) in payments.items():
        si = CTX.invoices.get(email)
        if not si:
            continue
        if frappe.db.exists(
            "Payment Entry Reference",
            {"reference_doctype": "Sales Invoice", "reference_name": si, "docstatus": 1},
        ):
            continue
        pe = get_payment_entry("Sales Invoice", si, party_amount=amount)
        pe.posting_date = date
        pe.reference_no = ref
        pe.reference_date = date
        pe.mode_of_payment = "Cash"
        if amount:
            pe.paid_amount = amount
            pe.received_amount = amount
            for ref_row in pe.references:
                ref_row.allocated_amount = amount
        pe.insert(ignore_permissions=True)
        pe.submit()


APPLICANTS = [
    ("Ishaan", "Verma", "ishaan.verma@example.com", "Male", "2016-02-11", "Standard 5", "Applied", 0),
    ("Diya", "Reddy", "diya.reddy@example.com", "Female", "2015-06-03", "Standard 6", "Approved", 1),
    ("Vihaan", "Gupta", "vihaan.gupta@example.com", "Male", "2014-09-27", "Standard 7", "Rejected", 1),
    ("Saanvi", "Iyer", "saanvi.iyer@example.com", "Female", "2012-12-15", "Standard 9", "Admitted", 1),
    ("Reyansh", "Kumar", "reyansh.kumar@example.com", "Male", "2013-04-08", "Standard 8", "Applied", 1),
]


@section("Student admission and applicants")
def seed_applicants():
    adm_title = "Admissions 2026-27 (Mid-Year Intake)"
    if not frappe.db.exists("Student Admission", adm_title):
        frappe.get_doc(
            {
                "doctype": "Student Admission",
                "title": adm_title,
                "academic_year": AY,
                "admission_start_date": "2026-11-01",
                "admission_end_date": "2027-02-28",
                "published": 1,
                "enable_admission_application": 1,
                "introduction": "<p>Applications are open for Standards 5 to 9 for the Term 2 intake.</p>",
                "program_details": [
                    {"program": p, "application_fee": 500, "description": f"Admission to {p}"}
                    for p in PROGRAMS
                ],
            }
        ).insert(ignore_permissions=True)

    for i, (first, last, email, gender, dob, program, status, paid) in enumerate(APPLICANTS):
        if frappe.db.exists("Student Applicant", {"student_email_id": email}):
            continue
        frappe.get_doc(
            {
                "doctype": "Student Applicant",
                "first_name": first,
                "last_name": last,
                "student_email_id": email,
                "gender": gender,
                "date_of_birth": dob,
                "program": program,
                "academic_year": AY,
                "academic_term": CTX.t2,
                "student_admission": adm_title,
                "application_status": status,
                "application_date": add_days("2026-11-02", i * 3),
                "paid": paid,
                "nationality": "Indian",
                "student_mobile_number": f"97230{40000 + i * 1111}",
                "address_line_1": f"{5 + i}, Navrangpura",
                "city": "Ahmedabad",
                "state": "Gujarat",
                "pincode": "380009",
                "country": "India",
                "student_category": "General",
            }
        ).insert(ignore_permissions=True)


STUDENT_LOGS = [
    ("rahul.sharma@example.com", "Achievement", "2026-11-14", "<p>Won <b>1st prize</b> in the inter-school Mathematics Olympiad (junior category).</p>"),
    ("priya.patel@example.com", "Achievement", "2026-11-05", "<p>Selected for the district-level <b>science exhibition</b> with her solar cooker model.</p>"),
    ("aarav.mehta@example.com", "Achievement", "2026-10-22", "<p>Gold medal in the 100 m sprint at the annual sports day.</p>"),
    ("ananya.shah@example.com", "Achievement", "2026-11-17", "<p>Runner-up in the inter-school quiz competition.</p>"),
    ("kavya.joshi@example.com", "Achievement", "2026-10-30", "<p>Awarded <b>Best Speaker</b> in the English elocution competition.</p>"),
    ("rahul.sharma@example.com", "Academic", "2026-11-18", "<p>Needs to improve handwriting and neatness in Hindi notebook.</p>"),
    ("kavya.joshi@example.com", "Academic", "2026-11-19", "<p>Scored below expectations in Social Studies unit test; remedial classes recommended.</p>"),
    ("priya.patel@example.com", "Medical", "2026-11-12", "<p>Absent due to viral fever; medical certificate submitted.</p>"),
    ("aarav.mehta@example.com", "General", "2026-11-20", "<p>Elected class monitor for Standard 6 Section A.</p>"),
]


# Real school details (public listing). Email/website/street/PIN are not known yet:
# leave them empty rather than inventing placeholders.
SCHOOL_CONTACT = {
    "phone_no": "+91 82001 33031",
}
SCHOOL_ADDRESS = {
    "address_title": SCHOOL_NAME,
    "address_type": "Billing",
    "address_line1": SCHOOL_NAME,
    "city": "Visnagar",
    "state": "Gujarat",
    "country": "India",
    "is_primary_address": 1,
    "is_your_company_address": 1,
}
# (program, min_age, max_age) shown on the public admissions section
ADMISSION_AGES = {
    "Standard 5": (9, 11),
    "Standard 6": (10, 12),
    "Standard 7": (11, 13),
    "Standard 8": (12, 14),
    "Standard 9": (13, 15),
}
# public circulars for the landing page / portal notice board:
# (title, html content, pinned, expires on)
PUBLIC_NOTICES = [
    (
        "Winter Break: 25 December to 1 January",
        "<p>The school will remain closed for winter break from 25 December 2026 to "
        "1 January 2027. Classes resume on Monday, 4 January 2027.</p>",
        1,
        "2027-01-05",
    ),
    (
        "Parent-Teacher Meeting on 5 December",
        "<p>The Term 2 parent-teacher meeting for Standards 5 to 9 will be held on "
        "Saturday, 5 December 2026 from 9:00 AM to 12:30 PM in the respective classrooms.</p>",
        0,
        "2026-12-06",
    ),
    (
        "Annual Sports Day - 18 December",
        "<p>Annual Sports Day will be held on the school ground on 18 December 2026. "
        "Parents are welcome to attend from 8:30 AM.</p>",
        0,
        "2026-12-19",
    ),
    (
        "Term 2 Unit Tests from 14 December",
        "<p>Unit Test 2 for all classes begins on 14 December 2026. The subject-wise "
        "timetable is available on EduPortal under My Timetable.</p>",
        0,
        "2026-12-24",
    ),
    (
        "Admissions open for the 2026-27 mid-year intake",
        "<p>Applications for Standards 5 to 9 are open until 28 February 2027. "
        "Apply online from the school website or visit the admissions office.</p>",
        0,
        "2027-03-01",
    ),
]


@section("Public site: school contact, address, notices, admission ages")
def seed_public_site():
    company = frappe.get_doc("Company", COMPANY)
    changed = False
    for field, value in SCHOOL_CONTACT.items():
        if not company.get(field):
            company.set(field, value)
            changed = True
    if changed:
        company.save(ignore_permissions=True)

    has_address = frappe.get_all(
        "Dynamic Link",
        filters={"link_doctype": "Company", "link_name": COMPANY, "parenttype": "Address"},
        limit=1,
    )
    if not has_address:
        frappe.get_doc(
            {
                "doctype": "Address",
                **SCHOOL_ADDRESS,
                "phone": SCHOOL_CONTACT["phone_no"],
                "email_id": SCHOOL_CONTACT.get("email"),
                "links": [{"link_doctype": "Company", "link_name": COMPANY}],
            }
        ).insert(ignore_permissions=True)

    for title, content, pinned, expires in PUBLIC_NOTICES:
        get_or_insert(
            "Note",
            {"title": title},
            {
                "public": 1,
                "notify_on_login": pinned,
                "content": content,
                "expire_notification_on": expires,
            },
        )

    for adm in frappe.get_all("Student Admission", filters={"published": 1}, pluck="name"):
        doc = frappe.get_doc("Student Admission", adm)
        dirty = False
        for row in doc.program_details:
            ages = ADMISSION_AGES.get(row.program)
            if ages and not (row.min_age or row.max_age):
                row.min_age, row.max_age = ages
                dirty = True
        if dirty:
            doc.save(ignore_permissions=True)


@section("Student logs (achievements, academic, medical, general)")
def seed_logs():
    program_of = {s[2]: s[5] for s in STUDENTS}
    for email, ltype, date, text in STUDENT_LOGS:
        stu = student_id(email)
        if frappe.db.exists("Student Log", {"student": stu, "type": ltype, "date": date}):
            continue
        frappe.get_doc(
            {
                "doctype": "Student Log",
                "student": stu,
                "type": ltype,
                "date": date,
                "academic_year": AY,
                "academic_term": CTX.t2,
                "program": program_of[email],
                "student_batch": "Section A",
                "log": text,
            }
        ).insert(ignore_permissions=True)


@section("Learning activity: course activities and quiz attempts")
def seed_activity():
    attempts = [
        # email, course, topic whose quiz was attempted, answers correct flags, status, when
        ("rahul.sharma@example.com", "Mathematics - Std 5", "Fractions", [1, 1], "Pass", "2026-11-16 18:20:00"),
        ("priya.patel@example.com", "Mathematics - Std 5", "Large Numbers", [1, 0], "Pass", "2026-11-17 17:05:00"),
        ("rahul.sharma@example.com", "EVS - Std 5", "Plants and Animals", [0, 1], "Pass", "2026-11-18 19:10:00"),
        ("priya.patel@example.com", "English - Std 5", "Nouns, Pronouns and Adjectives", [0, 0], "Fail", "2026-11-19 16:45:00"),
        ("aarav.mehta@example.com", "Hindi - Std 6", "Vah Chidiya Jo (Kavita)", [1, 1], "Pass", "2026-11-20 18:00:00"),
        ("rahul.sharma@example.com", "Science - Std 6", "Food and Nutrition", [1, 1], "Pass", "2026-11-20 19:30:00"),
        ("ananya.shah@example.com", "Science - Std 7", "Nutrition in Plants", [1, 1], "Pass", "2026-11-19 18:40:00"),
        ("kavya.joshi@example.com", "Computer Science - Std 8", "Algorithms and Flowcharts", [1, 0], "Pass", "2026-11-21 11:15:00"),
    ]
    for email, course, topic, flags, status, dt in attempts:
        stu = student_id(email)
        program = frappe.db.get_value("Course", course, "program")
        pe = frappe.db.get_value(
            "Program Enrollment",
            {"student": stu, "program": program, "docstatus": 1},
            "name",
        )
        enrollment = frappe.db.get_value(
            "Course Enrollment",
            {"student": stu, "course": course, "program_enrollment": pe},
            "name",
        )
        if not enrollment:
            continue
        quiz = quiz_title(topic, program)
        if not frappe.db.exists("Quiz Activity", {"enrollment": enrollment, "quiz": quiz}):
            qdoc = frappe.get_doc("Quiz", quiz)
            result = []
            for row, ok in zip(qdoc.question, flags):
                q = frappe.get_doc("Question", row.question_link)
                correct = next(o.option for o in q.options if o.is_correct)
                wrong = next(o.option for o in q.options if not o.is_correct)
                result.append(
                    {
                        "question": q.name,
                        "selected_option": correct if ok else wrong,
                        "quiz_result": "Correct" if ok else "Wrong",
                    }
                )
            frappe.get_doc(
                {
                    "doctype": "Quiz Activity",
                    "enrollment": enrollment,
                    "student": stu,
                    "course": course,
                    "quiz": quiz,
                    "status": status,
                    "result": result,
                    "activity_date": dt,
                    "score": str(int(100 * sum(flags) / len(flags))),
                    "time_taken": 240 + 30 * len(result),
                }
            ).insert(ignore_permissions=True)

        # Course activity: the student read the topic's article and watched its video
        for tc in frappe.get_doc("Topic", topic).topic_content:
            if tc.content_type not in ("Article", "Video"):
                continue
            if frappe.db.exists(
                "Course Activity",
                {"enrollment": enrollment, "content_type": tc.content_type, "content": tc.content},
            ):
                continue
            frappe.get_doc(
                {
                    "doctype": "Course Activity",
                    "enrollment": enrollment,
                    "course": course,
                    "student": stu,
                    "content_type": tc.content_type,
                    "content": tc.content,
                    "activity_date": dt,
                }
            ).insert(ignore_permissions=True)


@section("Timetable generator configuration and generation result")
def seed_timetable():
    tg = frappe.get_single("Timetable Generator")
    tg.academic_year = AY
    tg.academic_term = CTX.t2
    tg.company = COMPANY
    tg.lesson_starts = PERIODS[0][0]
    tg.lesson_ends = PERIODS[-1][1]
    tg.default_time_slot = 45
    tg.default_maximum_lessons_per_day = 4
    tg.default_maximum_lessons_per_week = 20
    tg.set("time_slots", [])
    for i, (s, e) in enumerate(PERIODS, start=1):
        tg.append("time_slots", {"period": i, "start_time": s, "end_time": e, "duration": 45})
    tg.set("breaks", [])
    tg.append(
        "breaks",
        {"break_name": "Morning Break", "start_time": "10:35:00", "end_time": "10:50:00", "duration": 900},
    )
    tg.set("subject_rules", [])
    tg.set("teachers_preference", [])
    tg.set("teaching_rooms", [])
    for program, spec, c in iter_courses():
        g_idx = PROGRAMS.index(program)
        tg.append(
            "subject_rules",
            {
                "subject": c,
                "frequency_per_week": spec["periods"],
                "double_lessons_per_week": 0,
                "allow_double": 0,
                "max_time": "00:45:00",
            },
        )
        tg.append(
            "teachers_preference",
            {
                "teacher": instructor_for_course(c),
                "subject": c,
                "stream": batch_group(program),
                "max_period_per_week": 20,
                "max_period_per_day": 5,
            },
        )
        tg.append(
            "teaching_rooms",
            {"subject": c, "room": CTX.rooms[g_idx], "stream": batch_group(program)},
        )
    tg.save(ignore_permissions=True)

    if not frappe.db.exists("Timetable Generation Result", {"academic_term": CTX.t2}):
        from education.education.doctype.timetable_generator.timetable_generator import (
            build_timetable_snapshot,
        )

        start = TODAY - timedelta(days=TODAY.weekday())
        rows = frappe.get_all(
            "Course Schedule",
            filters={
                "schedule_date": ["between", [start, start + timedelta(days=4)]],
                "student_group": ["in", [batch_group(p) for p in PROGRAMS]],
            },
            fields=["schedule_date", "from_time", "to_time", "course", "instructor", "student_group", "room"],
        )
        base = [dict(r, schedule_date=str(r.schedule_date)) for r in rows]
        snapshot = build_timetable_snapshot(base, tg)
        total = sum(len(CURRICULUM[p]) for p in PROGRAMS)
        frappe.get_doc(
            {
                "doctype": "Timetable Generation Result",
                "status": "Complete",
                "academic_term": CTX.t2,
                "posting_date": TODAY,
                "total_subjects": total,
                "scheduled_count": total,
                "unscheduled_count": 0,
                "saved_count": len(base),
                "failed_count": 0,
                "timetable_snapshot": frappe.as_json(snapshot),
            }
        ).insert(ignore_permissions=True)


# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------


def execute():
    frappe.flags.mute_emails = True
    frappe.flags.in_demo_seed = True
    RESULTS.clear()
    CTX.clear()

    # values needed by later sections even if an earlier one fails
    CTX.t1 = f"{AY} ({T1_NAME})"
    CTX.t2 = f"{AY} ({T2_NAME})"
    CTX.holiday_list = frappe.db.get_value("Company", COMPANY, "default_holiday_list")
    CTX.department = frappe.db.get_value(
        "Department", {"department_name": "Academics", "company": COMPANY}, "name"
    )
    CTX.rooms = [frappe.db.get_value("Room", {"room_name": r[0]}, "name") for r in ROOMS]

    for fn in (seed_setup, seed_masters, seed_assessment_masters, migrate_to_per_class_courses):
        fn()
    leftover = [c for c in LEGACY_COURSES if frappe.db.exists("Course", c)]
    if leftover:
        # never mix the shared and the per-class curriculum
        log(f"[ABORT] legacy courses still present ({', '.join(leftover)}); fix the migration error above")
        return {"ok": 0, "failed": [r[0] for r in RESULTS if r[1] != "OK"] or ["migration"]}

    for fn in (
        seed_curriculum,
        seed_programs,
        seed_instructors,
        seed_students,
        seed_enrollments,
        seed_groups,
        seed_instructor_logs,
        seed_schedules,
        seed_attendance,
        seed_leaves,
        seed_assessments,
        seed_fees,
        seed_applicants,
        seed_public_site,
        seed_logs,
        seed_activity,
        seed_timetable,
    ):
        fn()

    frappe.db.commit()

    log("\n==== Education demo data summary ====")
    for title, status, msg in RESULTS:
        log(f"{status:7} {title}" + (f"  -> {msg}" if msg else ""))
    failed = [r for r in RESULTS if r[1] != "OK"]
    log(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} sections OK")
    return {"ok": len(RESULTS) - len(failed), "failed": [r[0] for r in failed]}
