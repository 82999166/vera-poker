#!/usr/bin/env python3
"""Upload all bot avatars and seed 1000 bots into the database via the importBots API."""
import os
import json
import subprocess
import time

# Load bot names
names = json.load(open("/tmp/bot-names.json"))
print(f"Loaded {len(names)} bot names")

# Directories
real_dir = "/home/ubuntu/webdev-static-assets/bot-avatars/real"
emoji_dir = "/home/ubuntu/webdev-static-assets/bot-avatars/emoji"
letter_dir = "/home/ubuntu/webdev-static-assets/bot-avatars/letter"

# Assignment: first 200 names get real avatars, next 500 get emoji, last 300 get letter
avatar_urls = []

def upload_batch(files, batch_label):
    """Upload a batch of files and return their storage paths."""
    urls = []
    # Upload in batches of 20 to avoid command line length issues
    batch_size = 20
    for i in range(0, len(files), batch_size):
        batch = files[i:i+batch_size]
        cmd = ["manus-upload-file", "--webdev"] + batch
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            output = result.stdout
            # Parse storage paths from output
            for line in output.split("\n"):
                if "Storage Path:" in line:
                    path = line.split("Storage Path:")[1].strip()
                    urls.append(path)
        except Exception as e:
            print(f"  Error uploading batch: {e}")
            # Add None for failed uploads
            urls.extend([None] * len(batch))
        
        uploaded = min(i + batch_size, len(files))
        if uploaded % 40 == 0 or uploaded == len(files):
            print(f"  {batch_label}: Uploaded {uploaded}/{len(files)}")
    
    return urls

# Upload real avatars (200)
print("\nUploading 200 real avatars...")
real_files = [os.path.join(real_dir, f"avatar_{i+1:03d}.jpg") for i in range(200)]
real_urls = upload_batch(real_files, "Real")
print(f"  Got {len(real_urls)} URLs")

# Upload emoji avatars (500)
print("\nUploading 500 emoji avatars...")
emoji_files = [os.path.join(emoji_dir, f"emoji_{i+1:03d}.png") for i in range(500)]
emoji_urls = upload_batch(emoji_files, "Emoji")
print(f"  Got {len(emoji_urls)} URLs")

# Upload letter avatars (300)
print("\nUploading 300 letter avatars...")
letter_files = [os.path.join(letter_dir, f"letter_{i+1:03d}.png") for i in range(300)]
letter_urls = upload_batch(letter_files, "Letter")
print(f"  Got {len(letter_urls)} URLs")

# Combine all URLs
all_urls = real_urls + emoji_urls + letter_urls
print(f"\nTotal avatar URLs: {len(all_urls)}")

# Build bot data
bots = []
for i in range(1000):
    name = names[i]
    avatar = all_urls[i] if i < len(all_urls) and all_urls[i] else None
    bots.append({
        "name": name,
        "nickname": name,
        "avatar": avatar,
        "balance": 10000,
    })

# Save bot data for the seed script
output_path = "/tmp/bot-seed-data.json"
with open(output_path, "w") as f:
    json.dump(bots, f, ensure_ascii=False)

print(f"\nBot seed data saved to {output_path}")
print(f"Bots with avatars: {sum(1 for b in bots if b['avatar'])}")
print(f"Bots without avatars: {sum(1 for b in bots if not b['avatar'])}")
print(f"\nSample bots:")
for b in bots[:5]:
    print(f"  {b['name']} -> {b['avatar'][:50] if b['avatar'] else 'NO AVATAR'}...")
