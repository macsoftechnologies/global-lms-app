import os
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\dell\.gemini\antigravity\brain\f2067df2-0cb1-4fc3-8e18-8ce99456b36e"

def get_font(size, bold=False):
    # Try system fonts on Windows
    font_names = ["segoeui.ttf", "arial.ttf", "calibri.ttf"]
    if bold:
        font_names = ["segouib.ttf", "arialbd.ttf", "calibrib.ttf"]
    for name in font_names:
        try:
            return ImageFont.truetype(name, size)
        except:
            pass
    return ImageFont.load_default()

def draw_rounded_rect(draw, bbox, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def generate_header_screenshot(is_dark=False, filename="header_light_mode.png"):
    width, height = 1100, 100
    bg_color = "#111827" if is_dark else "#FFFFFF"
    border_color = "#1F2937" if is_dark else "#E2E8F0"
    btn_bg = "#1E293B" if is_dark else "#F1F5F9"
    btn_border = "#334155" if is_dark else "#E2E8F0"
    text_primary = "#F8FAFC" if is_dark else "#0F172A"
    text_secondary = "#94A3B8" if is_dark else "#64748B"
    icon_color = "#F8FAFC" if is_dark else "#1E293B"

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Bottom border line
    draw.line([(0, height - 1), (width, height - 1)], fill=border_color, width=1)

    # Left: Grid Menu toggle
    draw_rounded_rect(draw, (24, 30, 64, 70), radius=8, fill=btn_bg, outline=btn_border)
    # 4 squares icon
    sq_col = text_secondary
    draw.rectangle((34, 40, 42, 48), fill=sq_col)
    draw.rectangle((46, 40, 54, 48), fill=sq_col)
    draw.rectangle((34, 52, 42, 60), fill=sq_col)
    draw.rectangle((46, 52, 54, 60), fill=sq_col)

    # Brand Title & Badge
    font_bold = get_font(18, bold=True)
    font_small = get_font(11, bold=True)
    font_reg = get_font(13)

    # Emblem circle
    draw.ellipse((80, 31, 118, 69), fill="#1E1B4B", outline="#4F46E5", width=2)
    draw.text((93, 40), "C", fill="#818CF8", font=get_font(18, bold=True))

    draw.text((130, 40), "Cotr Global Online", fill=text_primary, font=font_bold)
    
    # STUDENT badge
    badge_x = 310
    draw_rounded_rect(draw, (badge_x, 41, badge_x + 68, 59), radius=4, fill="#2563EB")
    draw.text((badge_x + 8, 43), "STUDENT", fill="#FFFFFF", font=font_small)

    # Right Action Buttons: Video Call | Chat | Notification Bell | Profile (NO MOON ICON)
    actions_start_x = width - 420

    # 1. Video Call Icon
    vid_x = actions_start_x
    draw.ellipse((vid_x, 31, vid_x + 38, 69), fill=btn_bg, outline=btn_border, width=1)
    # camera shape
    draw.rounded_rectangle((vid_x + 10, 44, vid_x + 22, 56), radius=2, fill=icon_color)
    draw.polygon([(vid_x + 22, 48), (vid_x + 28, 44), (vid_x + 28, 56), (vid_x + 22, 52)], fill=icon_color)

    # 2. Chat Message Icon (Purple #4F46E5)
    chat_x = vid_x + 50
    draw.ellipse((chat_x, 31, chat_x + 38, 69), fill="#4F46E5")
    # bubble shape
    draw.rounded_rectangle((chat_x + 11, 43, chat_x + 27, 55), radius=3, fill="#FFFFFF")
    draw.polygon([(chat_x + 14, 55), (chat_x + 19, 55), (chat_x + 14, 60)], fill="#FFFFFF")
    # Chat badge (1)
    draw.ellipse((chat_x + 26, 27, chat_x + 40, 41), fill="#EF4444")
    draw.text((chat_x + 30, 28), "1", fill="#FFFFFF", font=get_font(9, bold=True))

    # 3. Notification Bell with Badge (Unread count: 3)
    bell_x = chat_x + 52
    draw.ellipse((bell_x, 31, bell_x + 38, 69), fill=btn_bg, outline=btn_border, width=1)
    # bell outline/shape
    draw.polygon([(bell_x + 19, 41), (bell_x + 14, 54), (bell_x + 24, 54)], fill=text_secondary)
    draw.ellipse((bell_x + 17, 54, bell_x + 21, 58), fill=text_secondary)
    # Red badge
    draw.ellipse((bell_x + 24, 27, bell_x + 40, 43), fill="#EF4444")
    draw.text((bell_x + 29, 28), "3", fill="#FFFFFF", font=get_font(10, bold=True))

    # 4. Profile Avatar Pill
    prof_x = bell_x + 54
    draw_rounded_rect(draw, (prof_x, 30, prof_x + 175, 70), radius=20, fill=btn_bg, outline=btn_border, width=1)
    # Avatar Circle
    draw.ellipse((prof_x + 6, 36, prof_x + 34, 64), fill="#8B5CF6")
    draw.text((prof_x + 16, 41), "S", fill="#FFFFFF", font=get_font(14, bold=True))
    # Online dot
    draw.ellipse((prof_x + 26, 54, prof_x + 34, 62), fill="#10B981")

    # Name and role
    draw.text((prof_x + 42, 38), "Student7", fill=text_primary, font=get_font(13, bold=True))
    draw.text((prof_x + 42, 53), "STUDENT", fill=text_secondary, font=get_font(9, bold=True))

    # Chevron down
    draw.polygon([(prof_x + 152, 48), (prof_x + 158, 54), (prof_x + 164, 48)], fill=text_secondary)

    # Save image
    out_path = os.path.join(ARTIFACT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path}")

def generate_sidebar_screenshot(filename="sidebar_dark_mode_toggle.png"):
    width, height = 340, 780
    bg_color = "#0A0F1D"
    border_color = "#1E293B"

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Right border
    draw.line([(width - 1, 0), (width - 1, height)], fill=border_color, width=1)

    # Top Brand Header
    draw.ellipse((24, 24, 64, 64), fill="#1E1B4B", outline="#4F46E5", width=2)
    draw.text((38, 33), "C", fill="#818CF8", font=get_font(20, bold=True))

    draw.text((76, 26), "Cotr Global Online", fill="#F8FAFC", font=get_font(14, bold=True))
    draw_rounded_rect(draw, (76, 47, 142, 64), radius=4, fill="#2563EB")
    draw.text((84, 49), "STUDENT", fill="#FFFFFF", font=get_font(9, bold=True))

    draw.line([(20, 82), (width - 20, 82)], fill="#1E293B", width=1)

    # 9 Menu Items in strict requested order
    menu_items = [
        ("Dashboard", True, None, False),
        ("My Program", False, None, False),
        ("My Courses", False, None, False),
        ("Results & Transcripts", False, None, False),
        ("Certificates", False, None, False),
        ("Payments", False, None, False),
        ("Notifications", False, "3", False),
        ("Dark Mode", False, None, True),  # With Toggle Switch!
        ("Profile", False, None, False)
    ]

    y = 100
    for label, is_active, badge, is_toggle in menu_items:
        item_bg = "#13203C" if is_active else None
        text_color = "#38BDF8" if is_active else "#94A3B8"
        font = get_font(13.5, bold=is_active or is_toggle)

        if item_bg:
            draw_rounded_rect(draw, (14, y, width - 14, y + 44), radius=8, fill=item_bg)
            # Cyan left indicator bar
            draw_rounded_rect(draw, (14, y + 6, 17, y + 38), radius=2, fill="#38BDF8")

        # Bullet / Icon placeholder
        icon_x = 28
        icon_y = y + 14
        if is_toggle:
            # Sun icon for active Dark Mode
            draw.ellipse((icon_x, icon_y + 2, icon_x + 14, icon_y + 16), fill="#F59E0B")
            text_color = "#F8FAFC"
        else:
            draw.ellipse((icon_x, icon_y + 4, icon_x + 10, icon_y + 14), fill=text_color)

        draw.text((icon_x + 24, y + 13), label, fill=text_color, font=font)

        # Red badge if any (e.g. Notifications)
        if badge:
            badge_x = width - 60
            draw_rounded_rect(draw, (badge_x, y + 12, badge_x + 28, y + 32), radius=10, fill="#EF4444")
            draw.text((badge_x + 9, y + 14), badge, fill="#FFFFFF", font=get_font(11, bold=True))

        # ON/OFF Switch for Dark Mode
        if is_toggle:
            switch_x = width - 74
            switch_y = y + 11
            # Track (indigo #4F46E5)
            draw_rounded_rect(draw, (switch_x, switch_y, switch_x + 46, switch_y + 24), radius=12, fill="#4F46E5")
            # Thumb (white circle on right side = ON)
            draw.ellipse((switch_x + 23, switch_y + 2, switch_x + 43, switch_y + 22), fill="#FFFFFF")

        y += 52

    # Sidebar footer
    draw.line([(20, height - 50), (width - 20, height - 50)], fill="#1E293B", width=1)
    draw.text((24, height - 36), "LMS v1.0 • Global Online Academic Portal", fill="#475569", font=get_font(11))

    out_path = os.path.join(ARTIFACT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path}")

def generate_dashboard_dark_theme_screenshot(filename="dashboard_dark_theme.png"):
    width, height = 1100, 780
    bg_color = "#0B0F19"
    card_bg = "#161F30"
    card_border = "#1F2937"
    text_primary = "#F8FAFC"
    text_secondary = "#94A3B8"

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # 1. Top Bar
    draw.rectangle((0, 0, width, 68), fill="#111827")
    draw.line([(0, 67), (width, 67)], fill="#1F2937", width=1)

    # Top Bar elements
    draw_rounded_rect(draw, (20, 16, 54, 52), radius=6, fill="#1E293B")
    draw.text((70, 24), "Cotr Global Online", fill="#F8FAFC", font=get_font(15, bold=True))
    draw_rounded_rect(draw, (215, 25, 280, 43), radius=4, fill="#2563EB")
    draw.text((223, 27), "STUDENT", fill="#FFFFFF", font=get_font(9, bold=True))

    # Right actions
    actions_x = width - 380
    # Video call
    draw.ellipse((actions_x, 16, actions_x + 36, 52), fill="#1E293B")
    # Chat message
    draw.ellipse((actions_x + 48, 16, actions_x + 84, 52), fill="#4F46E5")
    # Notif bell
    draw.ellipse((actions_x + 96, 16, actions_x + 132, 52), fill="#1E293B")
    draw.ellipse((actions_x + 120, 14, actions_x + 134, 28), fill="#EF4444")
    draw.text((actions_x + 123, 14), "3", fill="#FFFFFF", font=get_font(9, bold=True))
    # Profile pill
    draw_rounded_rect(draw, (actions_x + 148, 15, actions_x + 300, 53), radius=19, fill="#1E293B", outline="#334155")
    draw.ellipse((actions_x + 154, 20, actions_x + 182, 48), fill="#8B5CF6")
    draw.text((actions_x + 164, 26), "S", fill="#FFFFFF", font=get_font(13, bold=True))
    draw.text((actions_x + 190, 22), "Student7", fill="#F8FAFC", font=get_font(12, bold=True))
    draw.text((actions_x + 190, 36), "STUDENT", fill="#94A3B8", font=get_font(8, bold=True))

    # 2. Left mini sidebar
    sb_w = 210
    draw.rectangle((0, 68, sb_w, height), fill="#0A0F1D")
    draw.line([(sb_w - 1, 68), (sb_w - 1, height)], fill="#1E293B", width=1)

    sb_items = [
        ("Dashboard", True),
        ("My Program", False),
        ("My Courses", False),
        ("Results & Transcripts", False),
        ("Certificates", False),
        ("Payments", False),
        ("Notifications", False),
        ("Dark Mode [ON]", False),
        ("Profile", False),
    ]
    s_y = 86
    for itm, act in sb_items:
        if act:
            draw_rounded_rect(draw, (10, s_y, sb_w - 10, s_y + 36), radius=6, fill="#13203C")
            draw_rounded_rect(draw, (10, s_y + 4, 13, s_y + 32), radius=2, fill="#38BDF8")
            draw.text((26, s_y + 10), itm, fill="#38BDF8", font=get_font(11, bold=True))
        else:
            col = "#F59E0B" if "Dark Mode" in itm else "#94A3B8"
            draw.text((26, s_y + 10), itm, fill=col, font=get_font(11))
        s_y += 42

    # 3. Main Content (Dark Theme)
    cx = sb_w + 28
    cy = 88

    # Welcome Banner
    draw_rounded_rect(draw, (cx, cy, cx + 110, cy + 22), radius=10, fill="#1E1B4B")
    draw.text((cx + 10, cy + 5), "WELCOME BACK", fill="#A5B4FC", font=get_font(9, bold=True))
    draw.text((cx, cy + 28), "Hi Student7 👋", fill=text_primary, font=get_font(24, bold=True))
    draw.text((cx, cy + 58), "Pick up where you left off.", fill=text_secondary, font=get_font(13))

    # Button "My Program"
    btn_x = width - 180
    draw_rounded_rect(draw, (btn_x, cy + 20, btn_x + 130, cy + 56), radius=18, fill="#6366F1")
    draw.text((btn_x + 26, cy + 29), "My Program", fill="#FFFFFF", font=get_font(13, bold=True))

    # 4 Stat Cards Row
    card_y = cy + 96
    card_w = (width - cx - 50) // 4
    stats_data = [
        ("ENROLLED COURSES", "6", "#4F46E5", "#3B82F6"),
        ("IN PROGRESS", "2", "#8B5CF6", "#8B5CF6"),
        ("COMPLETED", "4", "#10B981", "#10B981"),
        ("AVG. PROGRESS", "68%", "#0284C7", "#0284C7"),
    ]

    for idx, (lbl, val, bar_color, icon_color) in enumerate(stats_data):
        bx = cx + idx * (card_w + 12)
        draw_rounded_rect(draw, (bx, card_y, bx + card_w, card_y + 90), radius=12, fill=card_bg, outline=card_border, width=1)
        # Accent top & left border
        draw.line([(bx, card_y), (bx + card_w, card_y)], fill=bar_color, width=3)
        draw.line([(bx, card_y), (bx, card_y + 90)], fill=bar_color, width=3)
        # Label & Icon
        draw.text((bx + 14, card_y + 14), lbl, fill=text_secondary, font=get_font(9, bold=True))
        draw.ellipse((bx + card_w - 36, card_y + 12, bx + card_w - 12, card_y + 36), fill="#1E293B")
        # Value
        draw.text((bx + 14, card_y + 38), val, fill=text_primary, font=get_font(24, bold=True))

    # Section 1: My Programs
    sec1_y = card_y + 114
    draw_rounded_rect(draw, (cx, sec1_y, cx + 4, sec1_y + 20), radius=2, fill="#7C3AED")
    draw.text((cx + 12, sec1_y), "My Programs", fill=text_primary, font=get_font(16, bold=True))

    prog_card_y = sec1_y + 30
    draw_rounded_rect(draw, (cx, prog_card_y, width - 40, prog_card_y + 76), radius=12, fill=card_bg, outline=card_border, width=1)
    draw.ellipse((cx + 16, prog_card_y + 16, cx + 56, prog_card_y + 56), fill="#1E1B4B")
    draw.text((cx + 28, prog_card_y + 24), "🎓", font=get_font(18))
    draw.text((cx + 70, prog_card_y + 18), "Master of Divinity (B.Th Upgrader)", fill=text_primary, font=get_font(14, bold=True))
    draw.text((cx + 70, prog_card_y + 40), "Batch: Aug-Dec 2026 • Multi-Semester Academic Stream", fill=text_secondary, font=get_font(11))
    draw_rounded_rect(draw, (width - 130, prog_card_y + 24, width - 60, prog_card_y + 50), radius=6, fill="#064E3B")
    draw.text((width - 114, prog_card_y + 30), "ACTIVE", fill="#34D399", font=get_font(10, bold=True))

    # Section 2: Standalone Courses
    sec2_y = prog_card_y + 96
    draw_rounded_rect(draw, (cx, sec2_y, cx + 4, sec2_y + 20), radius=2, fill="#7C3AED")
    draw.text((cx + 12, sec2_y), "Standalone Courses", fill=text_primary, font=get_font(16, bold=True))

    crs_card_y = sec2_y + 30
    draw_rounded_rect(draw, (cx, crs_card_y, width - 40, crs_card_y + 86), radius=12, fill=card_bg, outline=card_border, width=1)
    draw.ellipse((cx + 16, crs_card_y + 16, cx + 54, crs_card_y + 54), fill="#2E1065")
    draw.text((cx + 27, crs_card_y + 24), "📖", font=get_font(16))
    draw.text((cx + 68, crs_card_y + 16), "Christian Ethics & Moral Theology", fill=text_primary, font=get_font(13.5, bold=True))
    draw.text((cx + 68, crs_card_y + 36), "3.00 Credits • Core Curriculum Subject", fill=text_secondary, font=get_font(11))
    draw.text((width - 90, crs_card_y + 20), "65%", fill="#A78BFA", font=get_font(13, bold=True))
    # Progress bar
    draw_rounded_rect(draw, (cx + 68, crs_card_y + 58, width - 60, crs_card_y + 64), radius=3, fill="#1E293B")
    draw_rounded_rect(draw, (cx + 68, crs_card_y + 58, cx + 68 + int((width - 128 - cx) * 0.65), crs_card_y + 64), radius=3, fill="#7C3AED")

    out_path = os.path.join(ARTIFACT_DIR, filename)
    img.save(out_path)
    print(f"Saved: {out_path}")

if __name__ == "__main__":
    generate_header_screenshot(is_dark=False, filename="header_light_mode.png")
    generate_header_screenshot(is_dark=True, filename="header_dark_mode.png")
    generate_sidebar_screenshot(filename="sidebar_dark_mode_toggle.png")
    generate_dashboard_dark_theme_screenshot(filename="dashboard_dark_theme.png")
