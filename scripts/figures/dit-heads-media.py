#!/usr/bin/env python3
"""Prepare rollout videos without re-encoding their picture streams."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def probe(path):
    data = json.loads(run("ffprobe", "-v", "error", "-select_streams", "v:0",
                          "-show_streams", "-of", "json", str(path)))
    return data["streams"][0]


def picture_hash(path):
    return run("ffmpeg", "-nostdin", "-v", "error", "-i", str(path),
               "-map", "0:v:0", "-c:v", "copy", "-f", "hash", "-hash", "sha256", "-")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nas25", type=Path, required=True)
    parser.add_argument("--nas30", type=Path, required=True)
    args = parser.parse_args()
    output = ROOT / "content/images/dit-heads"
    provenance_path = output / "asset-sources.json"
    provenance = json.loads(provenance_path.read_text())
    entries = {item["asset"]: item for item in provenance["assets"]}

    with tempfile.TemporaryDirectory(prefix="dit-media-") as directory:
        temporary = Path(directory)
        for name in ("nas25", "nas30"):
            source = getattr(args, name).resolve()
            info = probe(source)
            entry = entries[name + ".mp4"]
            if sha256(source) != entry["sourceSHA256"]:
                raise ValueError(f"{name}: source differs from the recorded rollout")
            video = temporary / (name + ".mp4")
            subprocess.run([
                "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source),
                "-map", "0:v:0", "-c:v", "copy", "-an", "-sn", "-dn",
                "-map_metadata", "-1", "-map_chapters", "-1",
                "-movflags", "+faststart", str(video)
            ], check=True)
            result = probe(video)
            original_hash = picture_hash(source)
            if picture_hash(video) != original_hash:
                raise ValueError(f"{name}: encoded picture stream changed")
            for key in ("codec_name", "width", "height", "nb_frames",
                        "avg_frame_rate", "side_data_list"):
                if result.get(key) != info.get(key):
                    raise ValueError(f"{name}: {key} changed during remux")
            poster = temporary / (name + ".webp")
            subprocess.run([
                "ffmpeg", "-nostdin", "-v", "error", "-y",
                "-ss", str(float(result["duration"]) * 0.1), "-i", str(video),
                "-map", "0:v:0", "-frames:v", "1", "-c:v", "libwebp",
                "-lossless", "1", str(poster)
            ], check=True)
            (output / video.name).write_bytes(video.read_bytes())
            (output / poster.name).write_bytes(poster.read_bytes())
            entry.update({
                "durationSeconds": float(result["duration"]),
                "width": result["width"],
                "height": result["height"],
                "averageFrameRate": result["avg_frame_rate"],
                "frameCount": int(result["nb_frames"]),
                "processing": "Original H.264 picture stream copied; audio and other tracks removed.",
                "pictureStreamSHA256": original_hash.removeprefix("SHA256="),
                "sha256": sha256(output / video.name),
                "posterWidth": result["width"],
                "posterHeight": result["height"],
                "posterSHA256": sha256(output / poster.name),
            })
            print(f"{name}: {result['width']}x{result['height']}, "
                  f"{result['nb_frames']} original frames, picture stream preserved")
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
