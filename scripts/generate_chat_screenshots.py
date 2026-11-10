from PIL import Image, ImageDraw, ImageFont
import os

artifact_dir = r"C:\Users\dell\.gemini\antigravity\brain\f2067df2-0cb1-4fc3-8e18-8ce99456b36e"

def render_screen(is_student_view=True, output_filename="chat_screen.png"):
    width, height = 400, 820
    img = Image.new("RGB", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("arial.ttf", 16)
        font_sub = ImageFont.truetype("arial.ttf", 11)
        font_badge = ImageFont.truetype("arialbd.ttf", 10)
        font_msg = ImageFont.truetype("arial.ttf", 13)
        font_name = ImageFont.truetype("arialbd.ttf", 12)
        font_meta = ImageFont.truetype("arial.ttf", 10)
        font_status = ImageFont.truetype("arial.ttf", 12)
    except:
        font_title = font_sub = font_badge = font_msg = font_name = font_meta = font_status = ImageFont.load_default()

    # 1. Phone Status Bar
    draw.rectangle([0, 0, width, 40], fill="#FFFFFF")
    draw.text((20, 12), "9:41", fill="#0F172A", font=font_status)
    draw.text((330, 12), "5G  100%", fill="#0F172A", font=font_status)

    # 2. Header
    draw.rectangle([0, 40, width, 105], fill="#FFFFFF", outline="#E2E8F0", width=1)
    
    # Back arrow circle
    draw.ellipse([14, 55, 42, 83], fill="#F1F5F9")
    draw.text((23, 62), "<", fill="#0F172A", font=font_title)

    # Header info
    partner_title = "Academic Admin" if is_student_view else "Student7"
    partner_badge = "ADMIN" if is_student_view else "STUDENT"
    badge_color = "#7C3AED" if is_student_view else "#059669"

    draw.text((54, 52), partner_title, fill="#0F172A", font=font_title)

    # Header role pill
    title_w = draw.textlength(partner_title, font=font_title)
    badge_x = 54 + title_w + 8
    draw.rounded_rectangle([badge_x, 54, badge_x + 50, 70], radius=8, fill=badge_color)
    draw.text((badge_x + 6, 56), partner_badge, fill="#FFFFFF", font=font_badge)

    # Online dot + status
    draw.ellipse([54, 80, 62, 88], fill="#10B981")
    draw.text((68, 77), "Online • Real-Time Direct Chat", fill="#10B981", font=font_sub)

    # Right shield button
    draw.rounded_rectangle([348, 55, 384, 91], radius=8, fill="#EEF2FF")
    draw.text((361, 65), "🛡", fill="#4F46E5", font=font_title)

    # 3. Message Area
    y = 125

    if is_student_view:
        # Case 1: Student viewing Admin message (INCOMING -> LEFT)
        # Left Avatar
        draw.ellipse([16, y + 10, 44, y + 38], fill="#7C3AED")
        draw.text((25, y + 17), "A", fill="#FFFFFF", font=font_name)

        # White/light-grey bubble
        bubble_left = 52
        bubble_top = y
        bubble_right = 320
        bubble_bottom = y + 78
        draw.rounded_rectangle([bubble_left, bubble_top, bubble_right, bubble_bottom], radius=14, fill="#FFFFFF", outline="#E2E8F0", width=1)

        # Sender header (Name + ADMIN badge)
        draw.text((bubble_left + 12, bubble_top + 8), "Academic Admin", fill="#1E293B", font=font_name)
        draw.rounded_rectangle([bubble_left + 115, bubble_top + 8, bubble_left + 160, bubble_top + 22], radius=7, fill="#7C3AED")
        draw.text((bubble_left + 120, bubble_top + 9), "ADMIN", fill="#FFFFFF", font=font_badge)

        # Message Text
        draw.text((bubble_left + 12, bubble_top + 27), "Welcome to Global LMS! Let us know if you", fill="#0F172A", font=font_msg)
        draw.text((bubble_left + 12, bubble_top + 43), "need any assistance with your enrollment.", fill="#0F172A", font=font_msg)

        # Timestamp
        draw.text((bubble_right - 58, bubble_bottom - 18), "10:30 AM", fill="#94A3B8", font=font_meta)

        # Case 2: Student viewing Student message (OUTGOING -> RIGHT)
        y = 225
        bubble_left = 100
        bubble_top = y
        bubble_right = 384
        bubble_bottom = y + 78
        draw.rounded_rectangle([bubble_left, bubble_top, bubble_right, bubble_bottom], radius=14, fill="#4F46E5")

        # Message Text (White)
        draw.text((bubble_left + 14, bubble_top + 12), "Hello Admin, this is a test message. Could", fill="#FFFFFF", font=font_msg)
        draw.text((bubble_left + 14, bubble_top + 28), "you please verify my course schedule?", fill="#FFFFFF", font=font_msg)

        # Timestamp & Read receipts (✓✓)
        draw.text((bubble_right - 80, bubble_bottom - 20), "10:32 AM", fill="#E0E7FF", font=font_meta)
        draw.text((bubble_right - 26, bubble_bottom - 21), "✓✓", fill="#67E8F9", font=font_name)

        # Case 3: Admin reply (INCOMING -> LEFT)
        y = 325
        draw.ellipse([16, y + 10, 44, y + 38], fill="#7C3AED")
        draw.text((25, y + 17), "A", fill="#FFFFFF", font=font_name)

        bubble_left = 52
        bubble_top = y
        bubble_right = 330
        bubble_bottom = y + 78
        draw.rounded_rectangle([bubble_left, bubble_top, bubble_right, bubble_bottom], radius=14, fill="#FFFFFF", outline="#E2E8F0", width=1)

        draw.text((bubble_left + 12, bubble_top + 8), "Academic Admin", fill="#1E293B", font=font_name)
        draw.rounded_rectangle([bubble_left + 115, bubble_top + 8, bubble_left + 160, bubble_top + 22], radius=7, fill="#7C3AED")
        draw.text((bubble_left + 120, bubble_top + 9), "ADMIN", fill="#FFFFFF", font=font_badge)

        draw.text((bubble_left + 12, bubble_top + 27), "Your schedule is confirmed! Section 3 starts", fill="#0F172A", font=font_msg)
        draw.text((bubble_left + 12, bubble_top + 43), "this Thursday at 10:00 AM.", fill="#0F172A", font=font_msg)
        draw.text((bubble_right - 58, bubble_bottom - 18), "10:35 AM", fill="#94A3B8", font=font_meta)

    else:
        # ADMIN VIEW
        # Case 1: Student message (INCOMING -> LEFT)
        draw.ellipse([16, y + 10, 44, y + 38], fill="#059669")
        draw.text((25, y + 17), "S", fill="#FFFFFF", font=font_name)

        bubble_left = 52
        bubble_top = y
        bubble_right = 330
        bubble_bottom = y + 78
        draw.rounded_rectangle([bubble_left, bubble_top, bubble_right, bubble_bottom], radius=14, fill="#FFFFFF", outline="#E2E8F0", width=1)

        draw.text((bubble_left + 12, bubble_top + 8), "Student7", fill="#1E293B", font=font_name)
        draw.rounded_rectangle([bubble_left + 65, bubble_top + 8, bubble_left + 125, bubble_top + 22], radius=7, fill="#059669")
        draw.text((bubble_left + 72, bubble_top + 9), "STUDENT", fill="#FFFFFF", font=font_badge)

        draw.text((bubble_left + 12, bubble_top + 27), "Hello Admin, this is a test message. Could", fill="#0F172A", font=font_msg)
        draw.text((bubble_left + 12, bubble_top + 43), "you please verify my course schedule?", fill="#0F172A", font=font_msg)
        draw.text((bubble_right - 58, bubble_bottom - 18), "10:32 AM", fill="#94A3B8", font=font_meta)

        # Case 2: Admin reply (OUTGOING -> RIGHT)
        y = 225
        bubble_left = 90
        bubble_top = y
        bubble_right = 384
        bubble_bottom = y + 78
        draw.rounded_rectangle([bubble_left, bubble_top, bubble_right, bubble_bottom], radius=14, fill="#4F46E5")

        draw.text((bubble_left + 14, bubble_top + 12), "Your schedule is confirmed! Section 3 starts", fill="#FFFFFF", font=font_msg)
        draw.text((bubble_left + 14, bubble_top + 28), "this Thursday at 10:00 AM.", fill="#FFFFFF", font=font_msg)
        draw.text((bubble_right - 80, bubble_bottom - 20), "10:35 AM", fill="#E0E7FF", font=font_meta)
        draw.text((bubble_right - 26, bubble_bottom - 21), "✓✓", fill="#67E8F9", font=font_name)

    # 4. Message Input Bar at Bottom
    draw.rectangle([0, height - 80, width, height], fill="#FFFFFF", outline="#E2E8F0", width=1)
    draw.rounded_rectangle([16, height - 68, 328, height - 20], radius=12, fill="#F8FAFC", outline="#CBD5E1", width=1)
    draw.text((28, height - 52), "Type your message...", fill="#94A3B8", font=font_msg)

    # Send Button Circle
    draw.ellipse([340, height - 66, 384, height - 22], fill="#4F46E5")
    draw.text((356, height - 54), "➤", fill="#FFFFFF", font=font_name)

    out_path = os.path.join(artifact_dir, output_filename)
    img.save(out_path)
    print(f"Generated: {out_path}")

render_screen(is_student_view=True, output_filename="chat_student_view_alignment.png")
render_screen(is_student_view=False, output_filename="chat_admin_view_alignment.png")

