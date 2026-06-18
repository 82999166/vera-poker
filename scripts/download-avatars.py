#!/usr/bin/env python3
"""Download 200 real-looking avatar images from free avatar APIs."""
import os
import requests
import time
import random

output_dir = "/home/ubuntu/webdev-static-assets/bot-avatars/real"
os.makedirs(output_dir, exist_ok=True)

# Use multiple avatar sources for variety
# 1. pravatar.cc - real photos
# 2. randomuser.me - real photos
# 3. i.pravatar.cc with different sizes

downloaded = 0
target = 200

# Source 1: pravatar.cc (IDs 1-70 are unique faces)
print("Downloading from pravatar.cc...")
for i in range(1, 71):
    if downloaded >= target:
        break
    url = f"https://i.pravatar.cc/150?img={i}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200 and len(resp.content) > 1000:
            filepath = os.path.join(output_dir, f"avatar_{downloaded+1:03d}.jpg")
            with open(filepath, "wb") as f:
                f.write(resp.content)
            downloaded += 1
            if downloaded % 10 == 0:
                print(f"  Downloaded {downloaded}/{target}")
    except Exception as e:
        print(f"  Error downloading img={i}: {e}")
    time.sleep(0.2)

# Source 2: randomuser.me API for more variety
print(f"\nDownloading from randomuser.me... (have {downloaded} so far)")
remaining = target - downloaded
if remaining > 0:
    try:
        # Get batch of random users
        batch_size = min(remaining, 50)
        for batch in range(0, remaining, batch_size):
            count = min(batch_size, remaining - batch)
            resp = requests.get(f"https://randomuser.me/api/?results={count}&inc=picture", timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                for user in data.get("results", []):
                    pic_url = user.get("picture", {}).get("large", "")
                    if pic_url:
                        try:
                            pic_resp = requests.get(pic_url, timeout=10)
                            if pic_resp.status_code == 200 and len(pic_resp.content) > 1000:
                                filepath = os.path.join(output_dir, f"avatar_{downloaded+1:03d}.jpg")
                                with open(filepath, "wb") as f:
                                    f.write(pic_resp.content)
                                downloaded += 1
                                if downloaded % 10 == 0:
                                    print(f"  Downloaded {downloaded}/{target}")
                        except:
                            pass
                    if downloaded >= target:
                        break
            time.sleep(1)
            if downloaded >= target:
                break
    except Exception as e:
        print(f"  Error with randomuser.me: {e}")

# Source 3: UI Avatars as fallback for remaining
print(f"\nFallback with generated faces... (have {downloaded} so far)")
if downloaded < target:
    # Use DiceBear API for realistic avatars
    styles = ["adventurer", "avataaars", "bottts", "micah", "miniavs", "personas"]
    while downloaded < target:
        seed = random.randint(1000, 99999)
        style = random.choice(styles)
        url = f"https://api.dicebear.com/7.x/{style}/png?seed={seed}&size=150"
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200 and len(resp.content) > 500:
                filepath = os.path.join(output_dir, f"avatar_{downloaded+1:03d}.jpg")
                with open(filepath, "wb") as f:
                    f.write(resp.content)
                downloaded += 1
                if downloaded % 10 == 0:
                    print(f"  Downloaded {downloaded}/{target}")
        except:
            pass
        time.sleep(0.3)

print(f"\nDone! Downloaded {downloaded} avatars to {output_dir}")
