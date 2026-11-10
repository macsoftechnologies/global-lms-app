from PIL import Image, ImageDraw, ImageFont

artifact_path = r"C:\Users\dell\.gemini\antigravity\brain\f2067df2-0cb1-4fc3-8e18-8ce99456b36e\course_details_locked_buynow.png"

def generate_locked_course_screen():
    width, height = 400, 820
    img = Image.new("RGB", (width, height), "#0B1120")
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("arialbd.ttf", 16)
        font_sub = ImageFont.truetype("arial.ttf", 12)
        font_bold = ImageFont.truetype("arialbd.ttf", 13)
        font_normal = ImageFont.truetype("arial.ttf", 13)
        font_badge = ImageFont.truetype("arialbd.ttf", 11)
        font_btn = ImageFont.truetype("arialbd.ttf", 14)
    except:
        font_title = font_sub = font_bold = font_normal = font_badge = font_btn = ImageFont.load_default()

    # Status Bar
    draw.rectangle([0, 0, width, 40], fill="#0B1120")
    draw.text((20, 12), "9:41", fill="#FFFFFF", font=font_sub)
    draw.text((330, 12), "5G  100%", fill="#FFFFFF", font=font_sub)

    # Top Bar
    draw.rectangle([0, 40, width, 90], fill="#0F172A")
    draw.text((20, 56), "<", fill="#FFFFFF", font=font_title)
    draw.text((50, 56), "History of Christianity", fill="#FFFFFF", font=font_title)

    # Course Description
    draw.text((20, 105), "Course Description", fill="#94A3B8", font=font_bold)
    draw.text((20, 125), "Comprehensive academic subject curriculum\nprepared for Global LMS students.", fill="#E2E8F0", font=font_sub)

    # Curriculum box
    draw.rounded_rectangle([20, 175, 380, 235], radius=10, fill="#1E293B")
    draw.text((35, 190), "Course Curriculum (1 Modules)", fill="#FFFFFF", font=font_bold)
    draw.text((35, 210), "Module 1 • Church History Foundation", fill="#94A3B8", font=font_sub)

    # Academic Information Card
    draw.rounded_rectangle([20, 255, 380, 480], radius=12, fill="#1E293B", outline="#334155", width=1)
    draw.text((35, 270), "Academic Information", fill="#38BDF8", font=font_bold)

    info_items = [
        ("Program ID:", "c1c039b9-62cf-4a93-b9b4-c464ef2f8409", "#94A3B8"),
        ("Semester ID:", "cd260d75-7cb4-4e1d-9b3d-fab645f6176a", "#94A3B8"),
        ("Instructors (1):", "9638c289-e36b-41f1-9d15-ece8d4becfc2", "#94A3B8"),
        ("Course ID:", "9638c289-e36b-41f1-9d15-ece8d4becfc2", "#94A3B8"),
        ("Credits:", "3.00", "#FFFFFF"),
        ("Access Entitlement:", "Not Enrolled (Locked)", "#F59E0B"), # Amber/Orange
    ]

    curr_y = 300
    for label, val, color in info_items:
        draw.text((35, curr_y), label, fill="#64748B", font=font_sub)
        val_disp = val if len(val) < 26 else val[:23] + "..."
        draw.text((160, curr_y), val_disp, fill=color, font=font_bold if label.startswith("Access") else font_sub)
        curr_y += 26

    # Regional Pricing Section
    draw.rounded_rectangle([20, 500, 380, 570], radius=12, fill="#1E293B", outline="#334155", width=1)
    draw.text((35, 515), "Regional Pricing", fill="#38BDF8", font=font_bold)
    draw.text((35, 540), "India Region Config", fill="#E2E8F0", font=font_sub)
    draw.text((270, 540), "INR 6000.00", fill="#10B981", font=font_bold)

    # Bottom Action Button: BUY NOW – INR 6000.00
    draw.rounded_rectangle([20, 720, 380, 775], radius=12, fill="#4F46E5") # Blue/Purple Buy Now button
    draw.text((115, 740), "🛒  BUY NOW – INR 6000.00", fill="#FFFFFF", font=font_btn)

    img.save(artifact_path)
    print("Saved:", artifact_path)

if __name__ == "__main__":
    generate_locked_course_screen()

