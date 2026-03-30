from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1200, 675
BASE = os.path.dirname(os.path.abspath(__file__))

# Create base image with dark gradient
img = Image.new('RGB', (W, H), (15, 17, 35))
draw = ImageDraw.Draw(img)

# Draw gradient background
for y in range(H):
    r = int(10 + (y / H) * 8)
    g = int(12 + (y / H) * 10)
    b = int(25 + (y / H) * 20)
    for x in range(W):
        rx = int(r + (x / W) * 5)
        gx = int(g + (x / W) * 5)
        bx = int(b + (x / W) * 10)
        img.putpixel((x, y), (rx, gx, bx))

draw = ImageDraw.Draw(img)

# Draw subtle grid pattern
grid_color = (25, 30, 55)
for x in range(0, W, 60):
    draw.line([(x, 0), (x, H)], fill=grid_color, width=1)
for y in range(0, H, 60):
    draw.line([(0, y), (W, y)], fill=grid_color, width=1)

# Blue glow effect - top right
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
for i in range(200, 0, -1):
    alpha = int(12 * (i / 200))
    glow_draw.ellipse([W - 200 - i, -100 - i, W - 200 + i, -100 + i],
                       fill=(37, 99, 235, alpha))
glow = glow.filter(ImageFilter.GaussianBlur(80))
img.paste(Image.alpha_composite(Image.new('RGBA', (W, H), (0, 0, 0, 0)), glow).convert('RGB'),
          mask=glow.split()[3])

# Blue glow effect - bottom left
glow2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
glow2_draw = ImageDraw.Draw(glow2)
for i in range(180, 0, -1):
    alpha = int(10 * (i / 180))
    glow2_draw.ellipse([-50 - i, H - 100 - i, -50 + i, H - 100 + i],
                        fill=(59, 130, 246, alpha))
glow2 = glow2.filter(ImageFilter.GaussianBlur(80))
img.paste(Image.alpha_composite(Image.new('RGBA', (W, H), (0, 0, 0, 0)), glow2).convert('RGB'),
          mask=glow2.split()[3])

draw = ImageDraw.Draw(img)

# Top accent line - blue gradient
for x in range(W):
    dist = abs(x - W // 2) / (W // 2)
    alpha = max(0, int(255 * (1 - dist * 1.2)))
    if alpha > 0:
        draw.line([(x, 0), (x, 2)], fill=(37, 99, 235))

# Load fonts
def load_font(size):
    for path in [
        "/System/Library/Fonts/SFCompact.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except:
            continue
    return ImageFont.load_default()

font_title = load_font(44)
font_x = load_font(36)

# --- LOGO BOXES (centered vertically) ---
box_h = 100
box_y = (H - box_h) // 2  # perfectly centered
box_gap = 50
box_radius = 24

shyft_box_w = 320
privy_box_w = 320
total_w = shyft_box_w + box_gap + 36 + box_gap + privy_box_w
start_x = (W - total_w) // 2

# Draw Shyft glass box
shyft_box = [start_x, box_y, start_x + shyft_box_w, box_y + box_h]
draw.rounded_rectangle(shyft_box, radius=box_radius, fill=(22, 26, 48), outline=(50, 55, 80), width=1)

# Load and place Shyft logo
logo_path = os.path.join(BASE, "public", "shyft-logo-full.png")
if os.path.exists(logo_path):
    logo = Image.open(logo_path).convert('RGBA')

    # Invert: dark logo parts → white, white/light bg → transparent
    pixels = logo.load()
    for py in range(logo.height):
        for px in range(logo.width):
            r, g, b, a = pixels[px, py]
            brightness = (r + g + b) / 3
            if brightness < 80 and a > 50:
                pixels[px, py] = (255, 255, 255, 255)
            elif brightness > 200:
                pixels[px, py] = (0, 0, 0, 0)
            else:
                new_a = int((1 - brightness / 255) * 255)
                pixels[px, py] = (255, 255, 255, min(new_a, a))

    # Resize to fit in box
    logo_target_h = 52
    ratio = logo_target_h / logo.height
    logo_target_w = int(logo.width * ratio)
    logo = logo.resize((logo_target_w, logo_target_h), Image.LANCZOS)

    lx = start_x + (shyft_box_w - logo_target_w) // 2
    ly = box_y + (box_h - logo_target_h) // 2
    img.paste(logo, (lx, ly), logo)
else:
    draw.text((start_x + 80, box_y + 28), "Shyft", fill=(255, 255, 255), font=font_title)

# × symbol centered between boxes
x_x = start_x + shyft_box_w + box_gap
x_y = box_y + box_h // 2 - 18
draw.text((x_x, x_y), "×", fill=(110, 115, 145), font=font_x)

# Draw Privy glass box
privy_start = x_x + 36 + box_gap
privy_box = [privy_start, box_y, privy_start + privy_box_w, box_y + box_h]
draw.rounded_rectangle(privy_box, radius=box_radius, fill=(22, 26, 48), outline=(50, 55, 80), width=1)

# --- Privy icon (proper clean version) ---
privy_icon_cx = privy_start + 75
privy_icon_cy = box_y + box_h // 2
icon_r = 24  # bigger radius

# White circle background
draw.ellipse([privy_icon_cx - icon_r, privy_icon_cy - icon_r,
              privy_icon_cx + icon_r, privy_icon_cy + icon_r],
             fill=(255, 255, 255))

# Head (small circle at top)
head_r = 7
draw.ellipse([privy_icon_cx - head_r, privy_icon_cy - icon_r + 5,
              privy_icon_cx + head_r, privy_icon_cy - icon_r + 5 + head_r * 2],
             fill=(15, 17, 35))

# Body (arc / half-circle at bottom)
body_top = privy_icon_cy + 2
body_r = 14
draw.pieslice([privy_icon_cx - body_r, body_top,
               privy_icon_cx + body_r, body_top + body_r * 2],
              start=180, end=360, fill=(15, 17, 35))

# "privy" text - bigger
draw.text((privy_icon_cx + 34, box_y + 26), "privy", fill=(255, 255, 255), font=font_title)

# Save
output_path = os.path.join(BASE, "public", "shyft-x-privy.png")
img.save(output_path, 'PNG', quality=95)
print(f"✅ Saved to: {output_path}")
print(f"   Size: {W}x{H}")
