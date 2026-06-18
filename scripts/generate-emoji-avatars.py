#!/usr/bin/env python3
"""Generate 500 TG-style emoji avatars and 300 first-letter avatars as PNG images."""
import os
import random
from PIL import Image, ImageDraw, ImageFont

# Output directories
emoji_dir = "/home/ubuntu/webdev-static-assets/bot-avatars/emoji"
letter_dir = "/home/ubuntu/webdev-static-assets/bot-avatars/letter"
os.makedirs(emoji_dir, exist_ok=True)
os.makedirs(letter_dir, exist_ok=True)

# Avatar size
SIZE = 150

# TG-style background colors (vibrant gradients like Telegram uses)
tg_colors = [
    # (top_color, bottom_color) - Telegram's gradient pairs
    ("#FF6B6B", "#EE5A24"),  # Red
    ("#FFA502", "#FF6348"),  # Orange
    ("#FFD93D", "#FF9F43"),  # Yellow-Orange
    ("#6BCB77", "#2ECC71"),  # Green
    ("#4ECDC4", "#44BD32"),  # Teal-Green
    ("#45B7D1", "#0984E3"),  # Blue
    ("#6C5CE7", "#A29BFE"),  # Purple
    ("#FD79A8", "#E84393"),  # Pink
    ("#00B894", "#00CEC9"),  # Mint
    ("#E17055", "#D63031"),  # Coral
    ("#74B9FF", "#0652DD"),  # Sky Blue
    ("#A29BFE", "#6C5CE7"),  # Lavender
    ("#FDCB6E", "#F39C12"),  # Gold
    ("#55A3F0", "#2980B9"),  # Royal Blue
    ("#E056A0", "#C44569"),  # Magenta
    ("#78E08F", "#38ADA9"),  # Emerald
]

# Common emojis used as TG profile pictures
emojis = [
    "😀", "😎", "🤠", "🥳", "😈", "👻", "🤖", "👽", "💀", "🎃",
    "🐱", "🐶", "🦊", "🐻", "🐼", "🐨", "🦁", "🐯", "🐸", "🐙",
    "🦄", "🐲", "🦅", "🦈", "🐺", "🦇", "🦉", "🐝", "🦋", "🐞",
    "🌟", "⭐", "🔥", "💎", "🎯", "🎲", "🃏", "♠️", "♥️", "♦️",
    "♣️", "🏆", "👑", "💰", "💵", "🎰", "🎪", "🎭", "🎨", "🎵",
    "🚀", "⚡", "💫", "🌈", "🌙", "☀️", "🌊", "🍀", "🌸", "🌺",
    "🎮", "🕹️", "🎧", "📱", "💻", "🖥️", "⌨️", "🔮", "🧿", "🪬",
    "🦾", "🧠", "👁️", "🫀", "🦷", "👄", "🫦", "👃", "👂", "🦶",
    "🍕", "🍔", "🌮", "🍜", "🍣", "🍩", "🧁", "🍪", "🍫", "☕",
    "🏀", "⚽", "🏈", "🎾", "🏓", "🎱", "🥊", "🏋️", "🤺", "🏄",
]

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_gradient_bg(size, color1, color2):
    """Create a gradient background image."""
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)
    r1, g1, b1 = hex_to_rgb(color1)
    r2, g2, b2 = hex_to_rgb(color2)
    for y in range(size):
        ratio = y / size
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    return img

# Try to load a font that supports emojis
# For emoji rendering, we'll use a simpler approach - just draw the emoji character
# Since PIL doesn't render emojis well, we'll use a text-based approach with large font
try:
    # Try system fonts
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    emoji_font = None
    for fp in font_paths:
        if os.path.exists(fp):
            emoji_font = ImageFont.truetype(fp, 80)
            break
    if not emoji_font:
        emoji_font = ImageFont.load_default()
except:
    emoji_font = ImageFont.load_default()

# For letter avatars, use a nice bold font
try:
    letter_font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    letter_font = None
    for fp in letter_font_paths:
        if os.path.exists(fp):
            letter_font = ImageFont.truetype(fp, 72)
            break
    if not letter_font:
        letter_font = ImageFont.load_default()
except:
    letter_font = ImageFont.load_default()

# Generate 500 TG emoji avatars
# Since PIL can't render emojis as images well, we'll create colorful gradient backgrounds
# with a single large character/symbol drawn on them (TG style)
print("Generating 500 TG-style emoji avatars...")

# TG-style symbols that render well in PIL (ASCII/Latin chars that look like emoji alternatives)
tg_symbols = [
    "♠", "♥", "♦", "♣", "★", "☆", "♪", "♫", "☀", "☁",
    "⚡", "✦", "◆", "●", "▲", "■", "✿", "❀", "✧", "◎",
    "⊕", "⊗", "☯", "✪", "❖", "✶", "✴", "✵", "❋", "✺",
    "A", "B", "C", "D", "E", "F", "G", "H", "J", "K",
    "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W",
    "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6",
    "7", "8", "9", "&", "@", "#", "$", "%", "!", "?",
]

for i in range(500):
    colors = random.choice(tg_colors)
    img = create_gradient_bg(SIZE, colors[0], colors[1])
    draw = ImageDraw.Draw(img)
    
    # Draw a symbol/character in white
    symbol = random.choice(tg_symbols)
    
    # Center the text
    bbox = draw.textbbox((0, 0), symbol, font=emoji_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (SIZE - text_w) // 2
    y = (SIZE - text_h) // 2 - bbox[1]
    
    # Draw with slight shadow for depth
    draw.text((x+2, y+2), symbol, fill=(0, 0, 0, 80), font=emoji_font)
    draw.text((x, y), symbol, fill=(255, 255, 255), font=emoji_font)
    
    filepath = os.path.join(emoji_dir, f"emoji_{i+1:03d}.png")
    img.save(filepath, "PNG")
    
    if (i + 1) % 50 == 0:
        print(f"  Generated {i+1}/500 emoji avatars")

print(f"Done! Generated 500 emoji avatars in {emoji_dir}")

# Generate 300 first-letter avatars
print("\nGenerating 300 first-letter avatars...")

# Read bot names to get first letters
import json
names = json.load(open("/tmp/bot-names.json"))

# We'll use the last 300 names for letter avatars
letter_names = names[700:1000]

for i, name in enumerate(letter_names):
    colors = random.choice(tg_colors)
    img = create_gradient_bg(SIZE, colors[0], colors[1])
    draw = ImageDraw.Draw(img)
    
    # Get first character of the name
    first_char = name[0].upper()
    
    # Center the letter
    bbox = draw.textbbox((0, 0), first_char, font=letter_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (SIZE - text_w) // 2
    y = (SIZE - text_h) // 2 - bbox[1]
    
    # Draw with shadow
    draw.text((x+1, y+1), first_char, fill=(0, 0, 0, 60), font=letter_font)
    draw.text((x, y), first_char, fill=(255, 255, 255), font=letter_font)
    
    filepath = os.path.join(letter_dir, f"letter_{i+1:03d}.png")
    img.save(filepath, "PNG")
    
    if (i + 1) % 50 == 0:
        print(f"  Generated {i+1}/300 letter avatars")

print(f"Done! Generated 300 letter avatars in {letter_dir}")
print(f"\nTotal: 200 real + 500 emoji + 300 letter = 1000 avatars")
