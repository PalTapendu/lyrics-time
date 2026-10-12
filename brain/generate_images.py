import math
from PIL import Image, ImageDraw, ImageFont

def draw_squircle_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer radius
    radius = int(size * 0.25)
    border_w = max(1, int(size * 0.03))
    
    # Draw background gradient-like rounded rect
    # Background: deep emerald green #0a3d24 to #041a0f
    for i in range(size):
        t = i / float(size)
        r = int(14 * (1 - t) + 4 * t)
        g = int(75 * (1 - t) + 26 * t)
        b = int(48 * (1 - t) + 15 * t)
        # Line gradient clipped to rounded rectangle
    
    draw.rounded_rectangle([border_w, border_w, size - border_w, size - border_w], 
                           radius=radius, fill=(10, 58, 36, 255), outline=(31, 138, 91, 255), width=border_w)
    
    # Draw 8 waveform bars
    # Bar heights in fraction of size
    # heights: [0.08, 0.40, 0.78, 0.32, 0.94, 0.52, 0.28, 0.08]
    bar_heights = [0.08, 0.40, 0.78, 0.32, 0.94, 0.52, 0.28, 0.08]
    stroke_w = max(2, int(size * 0.07))
    start_x = size * 0.17
    end_x = size * 0.83
    step_x = (end_x - start_x) / 7.0
    center_y = size * 0.5
    
    for i, h_frac in enumerate(bar_heights):
        x = start_x + i * step_x
        bar_h = size * 0.7 * h_frac
        y0 = center_y - bar_h / 2.0
        y1 = center_y + bar_h / 2.0
        
        # Color transition from teal/mint (#34d399) to white (#ffffff)
        col = (235, 250, 242, 255) if i % 2 == 0 else (52, 211, 153, 255)
        if bar_h < stroke_w:
            draw.ellipse([x - stroke_w/2, center_y - stroke_w/2, x + stroke_w/2, center_y + stroke_w/2], fill=col)
        else:
            draw.line([(x, y0), (x, y1)], fill=col, width=stroke_w)
            draw.ellipse([x - stroke_w/2, y0 - stroke_w/2, x + stroke_w/2, y0 + stroke_w/2], fill=col)
            draw.ellipse([x - stroke_w/2, y1 - stroke_w/2, x + stroke_w/2, y1 + stroke_w/2], fill=col)
            
    return img

# Generate Favicons
icon_32 = draw_squircle_icon(32)
icon_32.save("assets/favicon-32x32.png")

icon_180 = draw_squircle_icon(180)
icon_180.save("assets/apple-touch-icon.png")

icon_192 = draw_squircle_icon(192)
icon_192.save("assets/icon-192.png")

icon_512 = draw_squircle_icon(512)
icon_512.save("assets/icon-512.png")

# Generate 1200x630 Social Share Preview Image
og = Image.new('RGBA', (1200, 630), (7, 18, 13, 255))
og_draw = ImageDraw.Draw(og)

# Rich radial glow behind card
for r in range(450, 0, -10):
    alpha = int(45 * (1 - r / 450.0))
    og_draw.ellipse([800 - r, 315 - r * 0.7, 800 + r, 315 + r * 0.7], fill=(16, 185, 129, alpha))
for r in range(350, 0, -10):
    alpha = int(35 * (1 - r / 350.0))
    og_draw.ellipse([250 - r, 200 - r * 0.7, 250 + r, 200 + r * 0.7], fill=(226, 179, 74, alpha))

# Large brand icon on top left
large_icon = draw_squircle_icon(96)
og.paste(large_icon, (80, 70), large_icon)

# Load fonts
try:
    font_brand = ImageFont.truetype("arialbd.ttf", 36)
    font_title = ImageFont.truetype("arialbd.ttf", 52)
    font_sub = ImageFont.truetype("arial.ttf", 22)
    font_pill = ImageFont.truetype("arialbd.ttf", 16)
    font_stat = ImageFont.truetype("arialbd.ttf", 26)
    font_stat_lbl = ImageFont.truetype("arial.ttf", 14)
except Exception:
    font_brand = font_title = font_sub = font_pill = font_stat = font_stat_lbl = ImageFont.load_default()

# Top Branding
og_draw.text((192, 85), "SyncLines", fill=(253, 247, 236, 255), font=font_brand)
og_draw.rounded_rectangle([370, 92, 452, 120], radius=6, fill=(226, 179, 74, 40), outline=(226, 179, 74, 180), width=1)
og_draw.text((382, 96), "PRO v8", fill=(245, 223, 154, 255), font=font_pill)

# Eyebrow Pill
og_draw.rounded_rectangle([80, 200, 430, 236], radius=18, fill=(16, 120, 75, 50), outline=(52, 211, 153, 120), width=1)
og_draw.text((98, 208), "NEXT-GEN AUDIO SYNC ENGINE  /  ZERO LATENCY", fill=(52, 211, 153, 255), font=font_pill)

# Main Title
og_draw.text((80, 260), "Timing Console", fill=(253, 247, 236, 255), font=font_title)

# Subtitle
og_draw.text((80, 335), "Precision timing for music production & video subtitles.", fill=(167, 197, 180, 255), font=font_sub)
og_draw.text((80, 370), "Tap-to-sync lyrics, scrub live waveforms, and export .LRC, .SRT, .VTT.", fill=(167, 197, 180, 255), font=font_sub)

# Badges strip
badges = ["100% Client-Side", "Zero Cloud Upload", "Microsecond Accuracy", "Free Web App"]
bx = 80
for b in badges:
    bw = len(b) * 10 + 28
    og_draw.rounded_rectangle([bx, 430, bx + bw, 468], radius=10, fill=(14, 34, 25, 220), outline=(32, 98, 64, 200), width=1)
    og_draw.text((bx + 14, 440), b, fill=(220, 240, 230, 255), font=font_pill)
    bx += bw + 14

# Console Graphic Card on Right side (660 to 1120, 150 to 520)
og_draw.rounded_rectangle([680, 160, 1130, 520], radius=24, fill=(12, 28, 20, 240), outline=(45, 125, 85, 180), width=2)

# Card header bar
og_draw.rounded_rectangle([695, 175, 1115, 215], radius=10, fill=(18, 42, 30, 255))
og_draw.ellipse([710, 190, 720, 200], fill=(239, 68, 68, 255))
og_draw.ellipse([730, 190, 740, 200], fill=(245, 158, 11, 255))
og_draw.ellipse([750, 190, 760, 200], fill=(16, 185, 129, 255))
og_draw.text((780, 186), "TIMING CONSOLE  —  LIVE AUDIO SPECTRUM", fill=(140, 180, 160, 255), font=font_pill)

# Waveform representation
wave_x0 = 705
for w_idx in range(48):
    wx = wave_x0 + w_idx * 8.6
    t_val = w_idx / 48.0
    h_val = 14 + 75 * math.sin(t_val * math.pi) * (0.6 + 0.4 * math.sin(t_val * 12))
    # Wave color
    r_c = int(45 + 180 * t_val)
    g_c = int(212 - 40 * t_val)
    b_c = int(191 - 100 * t_val)
    og_draw.line([(wx, 300 - h_val/2), (wx, 300 + h_val/2)], fill=(r_c, g_c, b_c, 240), width=4)

# Playhead line
og_draw.line([(880, 235), (880, 365)], fill=(255, 255, 255, 255), width=2)
og_draw.rounded_rectangle([855, 230, 905, 248], radius=4, fill=(16, 185, 129, 255))
og_draw.text((860, 232), "00:11.5", fill=(255, 255, 255, 255), font=font_pill)

# Mock Lyric rows inside console card
lyrics = [
    ("00:08.200", "I hear the echo in the wire"),
    ("00:11.500", "A signal rising through the sound"),
    ("00:16.800", "Every second locked in time")
]
ly_y = 380
for l_idx, (l_time, l_text) in enumerate(lyrics):
    is_active = (l_idx == 1)
    row_bg = (24, 75, 48, 200) if is_active else (15, 36, 26, 150)
    border_c = (52, 211, 153, 200) if is_active else (25, 55, 40, 100)
    og_draw.rounded_rectangle([705, ly_y, 1105, ly_y + 36], radius=8, fill=row_bg, outline=border_c, width=1)
    txt_col = (255, 255, 255, 255) if is_active else (160, 190, 175, 255)
    time_col = (52, 211, 153, 255) if is_active else (110, 145, 130, 255)
    og_draw.text((720, ly_y + 10), l_time, fill=time_col, font=font_pill)
    og_draw.text((810, ly_y + 10), l_text, fill=txt_col, font=font_pill)
    ly_y += 44

# Bottom bar
og_draw.text((80, 560), "synclines.app", fill=(226, 179, 74, 255), font=font_pill)
og_draw.text((210, 560), "•  Export to .LRC / .SRT / .VTT / .TXT  •  Local Web Audio Engine", fill=(120, 150, 135, 255), font=font_pill)

og.convert('RGB').save("assets/synclines-preview.png", "PNG", optimize=True)
print("All assets successfully generated!")
