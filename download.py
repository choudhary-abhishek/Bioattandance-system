import os
import urllib.request

base_url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
models = [
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
]

os.makedirs("models", exist_ok=True)
os.makedirs("js", exist_ok=True)

print("Downloading models...")
for m in models:
    if not os.path.exists(f"models/{m}"):
        print(f"Downloading {m}...")
        urllib.request.urlretrieve(base_url + m, f"models/{m}")

print("Downloading face-api.min.js...")
js_url = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"
if not os.path.exists("js/face-api.min.js"):
    urllib.request.urlretrieve(js_url, "js/face-api.min.js")

print("Done!")
