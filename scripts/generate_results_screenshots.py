"""
Generates high-fidelity visual preview screenshots of the Results & Transcripts screen
matching the COTR Global Online website design and mobile app layout.
"""

import os
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\dell\.gemini\antigravity\brain\f2067df2-0cb1-4fc3-8e18-8ce99456b36e"

def get_font(size, bold=False):
    font_names = [
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
    ]
    for fn in font_names:
        if os.path.exists(fn):
            try:
                return ImageFont.truetype(fn, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_rounded_rect(draw, bbox, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def generate_degree_progress_screenshot():
    # 430 x 932 (iPhone 15 Pro standard logical dimensions x2 = 860 x 1864)
    w, h = 860, 1864
    img = Image.new("RGB", (w, h), "#F8FAFC")
    draw = ImageDraw.Draw(img)

    # Status Bar
    font_status = get_font(26, bold=True)
    draw.text((60, 24), "9:41", fill="#0F172A", font=font_status)
    # Status bar icons indicator (right)
    draw.text((730, 24), "5G  100%", fill="#0F172A", font=get_font(22, bold=True))

    # Header Top Bar
    draw.line([(0, 80), (w, 80)], fill="#F1F5F9", width=2)
    # Back button & Title
    draw.text((50, 105), "←", fill="#4F46E5", font=get_font(38, bold=True))
    draw.text((105, 110), "COTR GLOBAL ONLINE", fill="#0F172A", font=get_font(24, bold=True))

    # Right Action Icons (Video call & Chat matching website header)
    # Video call circle
    draw.ellipse([670, 100, 720, 150], fill="#F1F5F9", outline="#E2E8F0")
    draw.text((685, 114), "📹", fill="#475569", font=get_font(20))
    # Chat circle (active purple)
    draw.ellipse([740, 100, 790, 150], fill="#4F46E5")
    draw.text((755, 114), "💬", fill="#FFFFFF", font=get_font(20))

    # Screen Title & Subtitle matching website screenshot
    y = 175
    draw.text((50, y), "My Results & Degree Progress", fill="#0F172A", font=get_font(36, bold=True))
    y += 48
    draw.text((50, y), "Track your degree completion, completed vs pending subjects,", fill="#64748B", font=get_font(22))
    y += 30
    draw.text((50, y), "and comprehensive examination grades.", fill="#64748B", font=get_font(22))

    # 5 Tabs Bar (Horizontal scrolling / segment)
    y += 50
    draw_rounded_rect(draw, [40, y, w - 40, y + 68], radius=14, fill="#FFFFFF", outline="#E2E8F0")
    
    # Tab 1: Active
    draw_rounded_rect(draw, [44, y + 4, 320, y + 64], radius=10, fill="#EEF2FF")
    draw.text((65, y + 20), "🎓 Degree Progress", fill="#4F46E5", font=get_font(22, bold=True))

    # Tab 2: Grades
    draw.text((345, y + 20), "📜 Official Grades", fill="#64748B", font=get_font(22))

    # Tab 3: Final Exams
    draw.text((545, y + 20), "📋 Final Exams", fill="#64748B", font=get_font(22))

    # Tab 4: Attempts indicator (right arrow)
    draw.text((760, y + 20), "⋯", fill="#94A3B8", font=get_font(26, bold=True))

    # 4 Summary Cards (2x2 Grid)
    y += 95
    card_w = (w - 110) // 2  # ~375 px each
    card_h = 175

    # Card 1: Enrolled Degree Program (Purple left border)
    x1 = 45
    draw_rounded_rect(draw, [x1, y, x1 + card_w, y + card_h], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.rounded_rectangle([x1, y, x1 + 8, y + card_h], radius=4, fill="#4F46E5")
    draw.text((x1 + 24, y + 18), "ENROLLED DEGREE PROGRAM", fill="#64748B", font=get_font(18, bold=True))
    draw.text((x1 + 24, y + 48), "Master of Divinity", fill="#0F172A", font=get_font(26, bold=True))
    draw.text((x1 + 24, y + 84), "(B.Th Upgrader)", fill="#0F172A", font=get_font(24, bold=True))
    draw.text((x1 + 24, y + 130), "• Active Student Status", fill="#4F46E5", font=get_font(20, bold=True))

    # Card 2: Completed Subjects (Green left border)
    x2 = x1 + card_w + 20
    draw_rounded_rect(draw, [x2, y, x2 + card_w, y + card_h], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.rounded_rectangle([x2, y, x2 + 8, y + card_h], radius=4, fill="#10B981")
    draw.text((x2 + 24, y + 18), "COMPLETED SUBJECTS", fill="#64748B", font=get_font(18, bold=True))
    draw.text((x2 + 24, y + 54), "0", fill="#10B981", font=get_font(46, bold=True))
    draw.text((x2 + 65, y + 68), " / 20", fill="#64748B", font=get_font(28))
    draw.text((x2 + 24, y + 130), "Passed & Accredited", fill="#059669", font=get_font(20))

    # Row 2 of Cards
    y += card_h + 20

    # Card 3: Pending / In-Progress (Orange left border)
    draw_rounded_rect(draw, [x1, y, x1 + card_w, y + card_h], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.rounded_rectangle([x1, y, x1 + 8, y + card_h], radius=4, fill="#F59E0B")
    draw.text((x1 + 24, y + 18), "PENDING / IN-PROGRESS", fill="#64748B", font=get_font(18, bold=True))
    draw.text((x1 + 24, y + 54), "20", fill="#D97706", font=get_font(46, bold=True))
    draw.text((x1 + 88, y + 68), " Subjects Remaining", fill="#0F172A", font=get_font(22, bold=True))
    draw.text((x1 + 24, y + 130), "To Complete Degree", fill="#64748B", font=get_font(20))

    # Card 4: Cumulative GPA (Violet left border)
    draw_rounded_rect(draw, [x2, y, x2 + card_w, y + card_h], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.rounded_rectangle([x2, y, x2 + 8, y + card_h], radius=4, fill="#8B5CF6")
    draw.text((x2 + 24, y + 18), "CUMULATIVE GPA", fill="#64748B", font=get_font(18, bold=True))
    draw.text((x2 + 24, y + 54), "0.0", fill="#7C3AED", font=get_font(46, bold=True))
    draw.text((x2 + 105, y + 68), " / 4.3", fill="#64748B", font=get_font(28))
    draw.text((x2 + 24, y + 130), "0 Total Credits Earned", fill="#64748B", font=get_font(20))

    # Degree Completion Progress Card
    y += card_h + 30
    draw_rounded_rect(draw, [45, y, w - 45, y + 135], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.text((75, y + 24), "Degree Completion Progress", fill="#0F172A", font=get_font(24, bold=True))
    draw.text((w - 235, y + 24), "0% Complete", fill="#4F46E5", font=get_font(24, bold=True))
    # Progress Track
    draw_rounded_rect(draw, [75, y + 75, w - 75, y + 95], radius=10, fill="#E2E8F0")
    # Progress Fill (subtle accent 3%)
    draw_rounded_rect(draw, [75, y + 75, 105, y + 95], radius=10, fill="#4F46E5")

    # Course & Subject Completion Breakdown Card
    y += 165
    draw_rounded_rect(draw, [45, y, w - 45, y + 420], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.text((75, y + 25), "Course & Subject Completion Breakdown", fill="#0F172A", font=get_font(26, bold=True))
    
    # Table Header Row
    y_table = y + 75
    draw_rounded_rect(draw, [65, y_table, w - 65, y_table + 45], radius=8, fill="#F8FAFC")
    draw.text((85, y_table + 12), "COURSE / SUBJECT", fill="#64748B", font=get_font(16, bold=True))
    draw.text((450, y_table + 12), "CREDITS", fill="#64748B", font=get_font(16, bold=True))
    draw.text((580, y_table + 12), "PROGRESS", fill="#64748B", font=get_font(16, bold=True))
    draw.text((700, y_table + 12), "STATUS", fill="#64748B", font=get_font(16, bold=True))

    # Subject 1 Row matching website
    y_row1 = y_table + 58
    draw.rounded_rectangle([65, y_row1, 71, y_row1 + 105], radius=3, fill="#4F46E5")
    draw.text((85, y_row1 + 10), "Christian Ethics", fill="#0F172A", font=get_font(24, bold=True))
    draw.text((85, y_row1 + 44), "Cohort: Aug-Dec 2026 - India (Master of Divinity)", fill="#64748B", font=get_font(18))
    draw.text((450, y_row1 + 22), "3.00 Credits", fill="#334155", font=get_font(20, bold=True))
    draw.text((580, y_row1 + 15), "0%", fill="#64748B", font=get_font(18))
    draw_rounded_rect(draw, [580, y_row1 + 42, 660, y_row1 + 52], radius=5, fill="#E2E8F0")
    # Status Pill: IN PROGRESS
    draw_rounded_rect(draw, [685, y_row1 + 18, 805, y_row1 + 56], radius=20, fill="#FEF3C7")
    draw.text((700, y_row1 + 24), "IN PROGRESS", fill="#B45309", font=get_font(15, bold=True))

    draw.line([(65, y_row1 + 115), (w - 65, y_row1 + 115)], fill="#F1F5F9", width=2)

    # Subject 2 Row
    y_row2 = y_row1 + 125
    draw.rounded_rectangle([65, y_row2, 71, y_row2 + 105], radius=3, fill="#10B981")
    draw.text((85, y_row2 + 10), "Old Testament Survey", fill="#0F172A", font=get_font(24, bold=True))
    draw.text((85, y_row2 + 44), "Cohort: Aug-Dec 2026 - India (Master of Divinity)", fill="#64748B", font=get_font(18))
    draw.text((450, y_row2 + 22), "3.00 Credits", fill="#334155", font=get_font(20, bold=True))
    draw.text((580, y_row2 + 15), "100%", fill="#059669", font=get_font(18, bold=True))
    draw_rounded_rect(draw, [580, y_row2 + 42, 660, y_row2 + 52], radius=5, fill="#10B981")
    # Status Pill: COMPLETED
    draw_rounded_rect(draw, [685, y_row2 + 18, 805, y_row2 + 56], radius=20, fill="#DCFCE7")
    draw.text((705, y_row2 + 24), "COMPLETED", fill="#047857", font=get_font(15, bold=True))

    # Bottom Tab Bar Navigation (Standard Mobile Shell)
    draw_rounded_rect(draw, [0, h - 130, w, h], radius=0, fill="#FFFFFF", outline="#E2E8F0")
    nav_icons = [
        ("🏠", "Home", False),
        ("📚", "Courses", False),
        ("📊", "Results", True),
        ("💬", "Chat", False),
        ("👤", "Profile", False),
    ]
    step = w // len(nav_icons)
    for i, (ico, lbl, active) in enumerate(nav_icons):
        nx = i * step + step // 2
        color = "#4F46E5" if active else "#94A3B8"
        draw.text((nx - 16, h - 110), ico, fill=color, font=get_font(28))
        draw.text((nx - 22, h - 68), lbl, fill=color, font=get_font(17, bold=active))

    out_path = os.path.join(ARTIFACT_DIR, "results_degree_progress_tab.png")
    img.save(out_path)
    print(f"Generated: {out_path}")

def generate_official_grades_screenshot():
    w, h = 860, 1864
    img = Image.new("RGB", (w, h), "#F8FAFC")
    draw = ImageDraw.Draw(img)

    # Status Bar
    font_status = get_font(26, bold=True)
    draw.text((60, 24), "9:41", fill="#0F172A", font=font_status)
    draw.text((730, 24), "5G  100%", fill="#0F172A", font=get_font(22, bold=True))

    # Header Top Bar
    draw.text((50, 105), "←", fill="#4F46E5", font=get_font(38, bold=True))
    draw.text((105, 110), "COTR GLOBAL ONLINE", fill="#0F172A", font=get_font(24, bold=True))
    draw.ellipse([740, 100, 790, 150], fill="#4F46E5")
    draw.text((755, 114), "💬", fill="#FFFFFF", font=get_font(20))

    # Screen Title
    y = 175
    draw.text((50, y), "My Results & Degree Progress", fill="#0F172A", font=get_font(36, bold=True))
    y += 48
    draw.text((50, y), "Official Grades, Letter Transcripts & Examination Records", fill="#64748B", font=get_font(22))

    # 5 Tabs Bar (Tab 2 Active)
    y += 50
    draw_rounded_rect(draw, [40, y, w - 40, y + 68], radius=14, fill="#FFFFFF", outline="#E2E8F0")
    draw.text((65, y + 20), "🎓 Degree Progress", fill="#64748B", font=get_font(22))
    # Tab 2 Active Pill
    draw_rounded_rect(draw, [280, y + 4, 570, y + 64], radius=10, fill="#EEF2FF")
    draw.text((300, y + 20), "📜 Official Grades & Transcripts", fill="#4F46E5", font=get_font(22, bold=True))
    draw.text((600, y + 20), "📋 Final Exams", fill="#64748B", font=get_font(22))

    # Academic Standing & Transcript Summary Card
    y += 95
    draw_rounded_rect(draw, [45, y, w - 45, y + 175], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.rounded_rectangle([45, y, 53, y + 175], radius=4, fill="#4F46E5")

    draw.text((75, y + 22), "OFFICIAL TRANSCRIPT SUMMARY", fill="#64748B", font=get_font(18, bold=True))
    # 3 Stat Columns
    col1 = 75
    draw.text((col1, y + 60), "18.00", fill="#0F172A", font=get_font(38, bold=True))
    draw.text((col1, y + 110), "Credits Earned", fill="#64748B", font=get_font(19))

    col2 = 320
    draw.text((col2, y + 60), "3.85", fill="#4F46E5", font=get_font(38, bold=True))
    draw.text((col2 + 85, y + 74), " / 4.30", fill="#64748B", font=get_font(24))
    draw.text((col2, y + 110), "Cumulative GPA", fill="#64748B", font=get_font(19))

    col3 = 590
    draw_rounded_rect(draw, [col3, y + 60, col3 + 180, y + 105], radius=12, fill="#DCFCE7")
    draw.text((col3 + 22, y + 70), "ATA Accredited", fill="#047857", font=get_font(20, bold=True))
    draw.text((col3, y + 116), "Academic Standing: Good", fill="#059669", font=get_font(18))

    # Grading Scheme Legend Card
    y += 195
    draw_rounded_rect(draw, [45, y, w - 45, y + 105], radius=14, fill="#F8FAFC", outline="#E2E8F0")
    draw.text((70, y + 18), "Grading Scale (Max 4.3 GPA Standard):", fill="#334155", font=get_font(18, bold=True))
    draw.text((70, y + 54), "A+ (95-100) = 4.3  •  A (90-94) = 4.0  •  A- (85-89) = 3.7  •  B+ (80-84) = 3.3", fill="#64748B", font=get_font(17))

    # Official Grades List
    y += 130
    draw_rounded_rect(draw, [45, y, w - 45, y + 550], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw.text((75, y + 25), "Course Assessment & Final Examination Grades", fill="#0F172A", font=get_font(26, bold=True))

    courses = [
        ("Systematic Theology I", "THEO-501", 3.0, 63, 5, 29, 97, "A+", 4.3, "#10B981"),
        ("Old Testament Survey", "BIBL-502", 3.0, 61, 5, 28, 94, "A", 4.0, "#10B981"),
        ("Christian Ethics", "ETH-503", 3.0, 58, 5, 26, 89, "A-", 3.7, "#6366F1"),
    ]

    item_y = y + 80
    for title, code, cr, ca, att, exam, tot, grade, gp, color in courses:
        draw_rounded_rect(draw, [65, item_y, w - 65, item_y + 130], radius=12, fill="#F8FAFC", outline="#E2E8F0")
        draw.rounded_rectangle([65, item_y, 70, item_y + 130], radius=3, fill=color)

        draw.text((85, item_y + 14), title, fill="#0F172A", font=get_font(24, bold=True))
        draw.text((85, item_y + 48), f"Code: {code}  •  {cr:.2f} Credits", fill="#64748B", font=get_font(18))

        # Breakdown metrics
        draw.text((85, item_y + 85), f"Continuous Assessment: {ca}/65  •  Attendance: {att}/5  •  Exam: {exam}/30", fill="#475569", font=get_font(18))

        # Grade Badge
        badge_x = w - 180
        draw_rounded_rect(draw, [badge_x, item_y + 18, badge_x + 85, item_y + 70], radius=10, fill="#EEF2FF")
        draw.text((badge_x + 22, item_y + 25), grade, fill="#4F46E5", font=get_font(28, bold=True))

        # Total and GP
        draw.text((badge_x - 110, item_y + 20), f"{tot}/100", fill="#0F172A", font=get_font(24, bold=True))
        draw.text((badge_x - 110, item_y + 50), f"{gp:.1f} GP", fill="#64748B", font=get_font(18))

        item_y += 145

    # Bottom Tab Bar Navigation
    draw_rounded_rect(draw, [0, h - 130, w, h], radius=0, fill="#FFFFFF", outline="#E2E8F0")
    nav_icons = [
        ("🏠", "Home", False),
        ("📚", "Courses", False),
        ("📊", "Results", True),
        ("💬", "Chat", False),
        ("👤", "Profile", False),
    ]
    step = w // len(nav_icons)
    for i, (ico, lbl, active) in enumerate(nav_icons):
        nx = i * step + step // 2
        col = "#4F46E5" if active else "#94A3B8"
        draw.text((nx - 16, h - 110), ico, fill=col, font=get_font(28))
        draw.text((nx - 22, h - 68), lbl, fill=col, font=get_font(17, bold=active))

    out_path = os.path.join(ARTIFACT_DIR, "results_official_transcripts_tab.png")
    img.save(out_path)
    print(f"Generated: {out_path}")

if __name__ == "__main__":
    generate_degree_progress_screenshot()
    generate_official_grades_screenshot()
