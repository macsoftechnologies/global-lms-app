"""
Generates high-fidelity visual preview screenshots of the Certificates Screen and Modal
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

def generate_certificates_list_screenshot():
    w, h = 860, 1864
    img = Image.new("RGB", (w, h), "#F8FAFC")
    draw = ImageDraw.Draw(img)

    # Status Bar
    draw.text((60, 24), "9:41", fill="#0F172A", font=get_font(26, bold=True))
    draw.text((730, 24), "5G  100%", fill="#0F172A", font=get_font(22, bold=True))

    # Top Header Bar
    draw.line([(0, 80), (w, 80)], fill="#F1F5F9", width=2)
    draw.text((50, 105), "←", fill="#0F172A", font=get_font(38, bold=True))
    draw.text((105, 100), "My Certificates", fill="#0F172A", font=get_font(32, bold=True))
    draw.text((105, 140), "View and manage your earned certificates.", fill="#64748B", font=get_font(19))

    # Request Button (Top Right)
    draw_rounded_rect(draw, [690, 105, 810, 150], radius=10, fill="#4F46E5")
    draw.text((708, 116), "+ Request", fill="#FFFFFF", font=get_font(18, bold=True))

    y = 195
    # Summary Bar
    draw_rounded_rect(draw, [45, y, w - 45, y + 115], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    # Ribbon Icon Box
    draw_rounded_rect(draw, [65, y + 20, 140, y + 95], radius=12, fill="#EEF2FF")
    draw.text((88, y + 36), "🎖️", fill="#4F46E5", font=get_font(32))

    draw.text((160, y + 28), "2 Certificates", fill="#0F172A", font=get_font(28, bold=True))
    draw.text((160, y + 68), "1 Accredited & Issued • 1 Pending", fill="#64748B", font=get_font(20))

    # Check Eligibility Link
    draw_rounded_rect(draw, [620, y + 35, 790, y + 80], radius=10, fill="#EEF2FF")
    draw.text((638, y + 46), "Check Eligibility →", fill="#4F46E5", font=get_font(18, bold=True))

    # Certificate Card 1: Issued (Green Accent)
    y += 140
    card_h = 245
    draw_rounded_rect(draw, [45, y, w - 45, y + card_h], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    # Green Left Accent Bar
    draw.rounded_rectangle([45, y, 53, y + card_h], radius=4, fill="#10B981")

    # Ribbon Icon Box
    draw_rounded_rect(draw, [70, y + 22, 130, y + 82], radius=12, fill="#FEF3C7")
    draw.text((88, y + 36), "📜", fill="#D97706", font=get_font(28))

    draw.text((150, y + 22), "Certificate of Completion", fill="#0F172A", font=get_font(28, bold=True))
    draw.text((150, y + 58), "Christian Ethics • Master of Divinity", fill="#64748B", font=get_font(20))

    # Status Badge: ISSUED
    draw_rounded_rect(draw, [w - 180, y + 24, w - 70, y + 62], radius=10, fill="#DCFCE7")
    draw.text((w - 165, y + 32), "● Issued", fill="#059669", font=get_font(18, bold=True))

    # Metadata Block (Cert No & Date)
    draw_rounded_rect(draw, [70, y + 95, w - 70, y + 165], radius=10, fill="#F8FAFC", outline="#F1F5F9")
    draw.text((90, y + 105), "CERTIFICATE NO", fill="#94A3B8", font=get_font(14, bold=True))
    draw.text((90, y + 130), "COTR-CERT-2026-0891", fill="#1E293B", font=get_font(19, bold=True))

    draw.line([(w // 2, y + 105), (w // 2, y + 155)], fill="#E2E8F0", width=1)

    draw.text((w // 2 + 25, y + 105), "ISSUE DATE", fill="#94A3B8", font=get_font(14, bold=True))
    draw.text((w // 2 + 25, y + 130), "Oct 24, 2026", fill="#1E293B", font=get_font(19, bold=True))

    # Action Buttons: View Details & Download
    btn_w = (w - 160) // 2
    # View Details (Purple outline)
    draw_rounded_rect(draw, [70, y + 180, 70 + btn_w, y + 228], radius=10, fill="#EEF2FF")
    draw.text((70 + btn_w // 2 - 60, y + 192), "👁️ View Details", fill="#4F46E5", font=get_font(19, bold=True))

    # Download PDF (Purple filled)
    draw_rounded_rect(draw, [70 + btn_w + 20, y + 180, w - 70, y + 228], radius=10, fill="#4F46E5")
    draw.text((70 + btn_w + 20 + btn_w // 2 - 65, y + 192), "⬇ Download PDF", fill="#FFFFFF", font=get_font(19, bold=True))

    # Certificate Card 2: Pending (Orange Accent)
    y += card_h + 24
    draw_rounded_rect(draw, [45, y, w - 45, y + card_h], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    # Amber Left Accent Bar
    draw.rounded_rectangle([45, y, 53, y + card_h], radius=4, fill="#F59E0B")

    draw_rounded_rect(draw, [70, y + 22, 130, y + 82], radius=12, fill="#FEF3C7")
    draw.text((88, y + 36), "📜", fill="#D97706", font=get_font(28))

    draw.text((150, y + 22), "Certificate of Completion", fill="#0F172A", font=get_font(28, bold=True))
    draw.text((150, y + 58), "Old Testament Survey • Master of Divinity", fill="#64748B", font=get_font(20))

    # Status Badge: PENDING
    draw_rounded_rect(draw, [w - 195, y + 24, w - 70, y + 62], radius=10, fill="#FEF3C7")
    draw.text((w - 180, y + 32), "● Pending", fill="#D97706", font=get_font(18, bold=True))

    # Metadata Block
    draw_rounded_rect(draw, [70, y + 95, w - 70, y + 165], radius=10, fill="#F8FAFC", outline="#F1F5F9")
    draw.text((90, y + 105), "CERTIFICATE NO", fill="#94A3B8", font=get_font(14, bold=True))
    draw.text((90, y + 130), "REQ-994182-THEO", fill="#1E293B", font=get_font(19, bold=True))

    draw.line([(w // 2, y + 105), (w // 2, y + 155)], fill="#E2E8F0", width=1)

    draw.text((w // 2 + 25, y + 105), "REQUEST DATE", fill="#94A3B8", font=get_font(14, bold=True))
    draw.text((w // 2 + 25, y + 130), "Nov 02, 2026", fill="#1E293B", font=get_font(19, bold=True))

    # Actions
    draw_rounded_rect(draw, [70, y + 180, 70 + btn_w, y + 228], radius=10, fill="#EEF2FF")
    draw.text((70 + btn_w // 2 - 60, y + 192), "👁️ View Details", fill="#4F46E5", font=get_font(19, bold=True))

    draw_rounded_rect(draw, [70 + btn_w + 20, y + 180, w - 70, y + 228], radius=10, fill="#E2E8F0")
    draw.text((70 + btn_w + 20 + btn_w // 2 - 50, y + 192), "⏳ Processing", fill="#94A3B8", font=get_font(19, bold=True))

    # Bottom Tab Navigation
    draw_rounded_rect(draw, [0, h - 130, w, h], radius=0, fill="#FFFFFF", outline="#E2E8F0")
    nav_icons = [
        ("🏠", "Home", False),
        ("📚", "Courses", False),
        ("📊", "Results", False),
        ("🎖️", "Certs", True),
        ("👤", "Profile", False),
    ]
    step = w // len(nav_icons)
    for i, (ico, lbl, active) in enumerate(nav_icons):
        nx = i * step + step // 2
        col = "#4F46E5" if active else "#94A3B8"
        draw.text((nx - 16, h - 110), ico, fill=col, font=get_font(28))
        draw.text((nx - 20, h - 68), lbl, fill=col, font=get_font(17, bold=active))

    out_path = os.path.join(ARTIFACT_DIR, "certificates_screen_issued.png")
    img.save(out_path)
    print(f"Generated: {out_path}")

def generate_certificates_empty_screenshot():
    w, h = 860, 1864
    img = Image.new("RGB", (w, h), "#F8FAFC")
    draw = ImageDraw.Draw(img)

    # Status Bar
    draw.text((60, 24), "9:41", fill="#0F172A", font=get_font(26, bold=True))
    draw.text((730, 24), "5G  100%", fill="#0F172A", font=get_font(22, bold=True))

    # Top Header Bar
    draw.text((50, 105), "←", fill="#0F172A", font=get_font(38, bold=True))
    draw.text((105, 100), "My Certificates", fill="#0F172A", font=get_font(32, bold=True))
    draw.text((105, 140), "View and manage your earned certificates.", fill="#64748B", font=get_font(19))

    # Summary Bar (0 certificates)
    y = 195
    draw_rounded_rect(draw, [45, y, w - 45, y + 115], radius=16, fill="#FFFFFF", outline="#E2E8F0")
    draw_rounded_rect(draw, [65, y + 20, 140, y + 95], radius=12, fill="#EEF2FF")
    draw.text((88, y + 36), "🎖️", fill="#4F46E5", font=get_font(32))

    draw.text((160, y + 28), "0 Certificates", fill="#0F172A", font=get_font(28, bold=True))
    draw.text((160, y + 68), "0 Accredited & Issued", fill="#64748B", font=get_font(20))

    # Empty State Card (Exact prompt requirement)
    y += 150
    draw_rounded_rect(draw, [45, y, w - 45, y + 480], radius=20, fill="#FFFFFF", outline="#E2E8F0")

    # Circle Ribbon
    draw.ellipse([w // 2 - 60, y + 50, w // 2 + 60, y + 170], fill="#F3E8FF")
    draw.text((w // 2 - 24, y + 80), "🎖️", fill="#7C3AED", font=get_font(52))

    draw.text((w // 2 - 185, y + 205), "No certificates available yet.", fill="#0F172A", font=get_font(28, bold=True))

    desc_lines = [
        "Complete your enrolled degree courses and score passing grades",
        "on final examinations to earn accredited certificates of completion.",
    ]
    dy = y + 255
    for dl in desc_lines:
        draw.text((w // 2 - 270, dy), dl, fill="#64748B", font=get_font(20))
        dy += 30

    # Action Button: Check Course Eligibility
    draw_rounded_rect(draw, [w // 2 - 180, y + 355, w // 2 + 180, y + 420], radius=12, fill="#4F46E5")
    draw.text((w // 2 - 145, y + 372), "🎓 Check Course Eligibility", fill="#FFFFFF", font=get_font(22, bold=True))

    # Bottom Tab Navigation
    draw_rounded_rect(draw, [0, h - 130, w, h], radius=0, fill="#FFFFFF", outline="#E2E8F0")
    nav_icons = [
        ("🏠", "Home", False),
        ("📚", "Courses", False),
        ("📊", "Results", False),
        ("🎖️", "Certs", True),
        ("👤", "Profile", False),
    ]
    step = w // len(nav_icons)
    for i, (ico, lbl, active) in enumerate(nav_icons):
        nx = i * step + step // 2
        col = "#4F46E5" if active else "#94A3B8"
        draw.text((nx - 16, h - 110), ico, fill=col, font=get_font(28))
        draw.text((nx - 20, h - 68), lbl, fill=col, font=get_font(17, bold=active))

    out_path = os.path.join(ARTIFACT_DIR, "certificates_screen_empty.png")
    img.save(out_path)
    print(f"Generated: {out_path}")

def generate_certificate_modal_screenshot():
    w, h = 860, 1864
    img = Image.new("RGB", (w, h), "#0F172A")
    draw = ImageDraw.Draw(img)

    # Sheet modal background
    sheet_y = 520
    draw_rounded_rect(draw, [0, sheet_y, w, h], radius=32, fill="#FFFFFF")

    # Sheet Header
    draw_rounded_rect(draw, [50, sheet_y + 40, 110, sheet_y + 100], radius=14, fill="#FEF3C7")
    draw.text((68, sheet_y + 54), "🎖️", fill="#D97706", font=get_font(28))

    draw.text((130, sheet_y + 42), "Certificate Details", fill="#0F172A", font=get_font(30, bold=True))
    draw.text((130, sheet_y + 80), "Official Academic Credential & Verification", fill="#64748B", font=get_font(18))
    # Close button (X)
    draw_rounded_rect(draw, [w - 100, sheet_y + 46, w - 50, sheet_y + 96], radius=10, fill="#F1F5F9")
    draw.text((w - 82, sheet_y + 56), "✕", fill="#64748B", font=get_font(22, bold=True))

    # Hero Banner
    y = sheet_y + 130
    draw_rounded_rect(draw, [50, y, w - 50, y + 210], radius=18, fill="#F8FAFC", outline="#E2E8F0")
    draw.text((w // 2 - 120, y + 24), "COTR GLOBAL ONLINE", fill="#4F46E5", font=get_font(18, bold=True))
    draw.text((w // 2 - 200, y + 60), "Certificate of Completion", fill="#0F172A", font=get_font(32, bold=True))
    draw.text((w // 2 - 165, y + 105), "Awarded to Student7 (Active Scholar)", fill="#64748B", font=get_font(21))

    # Status Pill
    draw_rounded_rect(draw, [w // 2 - 65, y + 148, w // 2 + 65, y + 188], radius=12, fill="#DCFCE7")
    draw.text((w // 2 - 45, y + 158), "● Issued", fill="#059669", font=get_font(18, bold=True))

    # Key-Value Table
    y += 240
    draw_rounded_rect(draw, [50, y, w - 50, y + 360], radius=16, fill="#FFFFFF", outline="#F1F5F9")

    rows = [
        ("Certificate ID", "COTR-CERT-2026-0891"),
        ("Course / Subject", "Christian Ethics (ETH-503)"),
        ("Program Name", "Master of Divinity (B.Th Upgrader)"),
        ("Issue Date", "October 24, 2026"),
        ("Final Grade", "A (94.0%) • 3.00 Credits"),
        ("Accreditation", "ATA Accredited & Verified"),
        ("Verification Code", "V7X-8829-COTR-2026"),
    ]

    ry = y + 15
    for label, val in rows:
        draw.text((75, ry), label, fill="#64748B", font=get_font(19, bold=True))
        draw.text((w - 380, ry), val, fill="#0F172A", font=get_font(19, bold=True))
        draw.line([(70, ry + 36), (w - 70, ry + 36)], fill="#F8FAFC", width=1)
        ry += 48

    # Download PDF Action Button
    y += 395
    draw_rounded_rect(draw, [50, y, w - 50, y + 65], radius=14, fill="#4F46E5")
    draw.text((w // 2 - 145, y + 18), "⬇ Download PDF Document", fill="#FFFFFF", font=get_font(22, bold=True))

    # Close Link
    draw.text((w // 2 - 25, y + 90), "Close", fill="#64748B", font=get_font(22, bold=True))

    out_path = os.path.join(ARTIFACT_DIR, "certificates_details_modal.png")
    img.save(out_path)
    print(f"Generated: {out_path}")

if __name__ == "__main__":
    generate_certificates_list_screenshot()
    generate_certificates_empty_screenshot()
    generate_certificate_modal_screenshot()
