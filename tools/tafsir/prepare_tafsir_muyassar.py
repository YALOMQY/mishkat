#!/usr/bin/env python3
"""
tools/tafsir/prepare_tafsir_muyassar.py

Deterministic build-time preparation script for Mishkat Quran Phase Q4.
Extracts, validates, and formats Al-Tafsir Al-Muyassar (مجمع الملك فهد لطباعة المصحف الشريف)
from QuranEnc official SQLite database into assets/data/tafsir-muyassar.json.

Verification Rules:
1. Exactly 6,236 Ayahs.
2. Zero duplicate global Ayah keys.
3. 100% alignment with assets/data/quran.json (surah 1..114, ayah 1..N, global 1..6236).
4. No empty or missing entries.
5. Original text preserved without modifications.
6. Zero duplication of Arabic Quran verses or Surah names.
7. Full attribution and metadata preserved.
"""

import hashlib
import json
import os
import sqlite3
import sys

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_root = os.path.abspath(os.path.join(script_dir, "../.."))
    quran_json_path = os.path.join(app_root, "assets/data/quran.json")
    sqlite_path = os.path.join(script_dir, "raw/arabic_moyassar.sqlite")
    output_json_path = os.path.join(app_root, "assets/data/tafsir-muyassar.json")

    print("[1/5] Verifying inputs...")
    if not os.path.isfile(quran_json_path):
        print(f"ERROR: Missing canonical quran.json at {quran_json_path}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(sqlite_path):
        print(f"Downloading SQLite database from QuranEnc to {sqlite_path}...")
        os.makedirs(os.path.dirname(sqlite_path), exist_ok=True)
        import urllib.request
        req = urllib.request.Request(
            "https://quranenc.com/downloads/sqlite/arabic_moyassar.sqlite",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req) as resp, open(sqlite_path, "wb") as out_f:
            out_f.write(resp.read())
        print("Download complete.")

    with open(quran_json_path, "r", encoding="utf-8") as f:
        quran_data = json.load(f)

    conn = sqlite3.connect(sqlite_path)
    cur = conn.cursor()

    print("[2/5] Validating SQLite database integrity...")
    cur.execute("SELECT COUNT(*) FROM translations;")
    total_db_rows = cur.fetchone()[0]
    if total_db_rows != 6236:
        print(f"ERROR: Expected 6236 rows, found {total_db_rows}", file=sys.stderr)
        sys.exit(1)

    cur.execute("SELECT COUNT(*) FROM translations WHERE translation IS NULL OR trim(translation) = '';")
    empty_rows = cur.fetchone()[0]
    if empty_rows != 0:
        print(f"ERROR: Found {empty_rows} empty translation rows", file=sys.stderr)
        sys.exit(1)

    print("[3/5] Cross-validating against quran.json (surahs, ayahs, global indices)...")
    cur.execute("SELECT sura, aya, translation FROM translations ORDER BY sura, aya;")
    db_rows = cur.fetchall()

    entries = {}
    row_idx = 0

    for chapter in quran_data["surahs"]:
        sura_num = chapter["n"]
        ayah_count = len(chapter["ayahs"])
        global_start = chapter["start"]

        for a_idx in range(ayah_count):
            expected_ayah = a_idx + 1
            expected_global = global_start + a_idx

            db_sura, db_aya, db_text = db_rows[row_idx]
            row_idx += 1

            if db_sura != sura_num:
                print(f"ERROR: Surah mismatch at global {expected_global}: expected surah {sura_num}, got {db_sura}", file=sys.stderr)
                sys.exit(1)

            if db_aya != expected_ayah:
                print(f"ERROR: Ayah mismatch in Surah {sura_num}: expected ayah {expected_ayah}, got {db_aya}", file=sys.stderr)
                sys.exit(1)

            cleaned_text = db_text.strip()
            if not cleaned_text:
                print(f"ERROR: Empty text at Surah {sura_num} Ayah {expected_ayah}", file=sys.stderr)
                sys.exit(1)

            global_key = str(expected_global)
            if global_key in entries:
                print(f"ERROR: Duplicate globalAyah key {global_key}", file=sys.stderr)
                sys.exit(1)

            entries[global_key] = cleaned_text

    if len(entries) != 6236:
        print(f"ERROR: Expected 6236 entries in final map, got {len(entries)}", file=sys.stderr)
        sys.exit(1)

    print(f"[4/5] Constructing deterministic payload for {len(entries)} Ayahs...")
    payload = {
        "schemaVersion": 1,
        "source": {
            "id": "arabic_moyassar",
            "name": "التفسير الميسر",
            "language": "ar",
            "author": "نخبة من العلماء بإشراف مجمع الملك فهد لطباعة المصحف الشريف",
            "publisher": "مجمع الملك فهد لطباعة المصحف الشريف",
            "description": "تفسير ميسر أعدته نخبة من العلماء وصدر عن مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة وفق منهج أهل السنة والجماعة.",
            "attribution": "مأخوذ وموثق من مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة عبر موسوعة القرآن الكريم (QuranEnc.com)",
            "license": "شروط النشر الحر المعتمدة لموسوعة القرآن الكريم (QuranEnc)",
            "version": "1.0.0",
            "sourceUrl": "https://quranenc.com/ar/browse/arabic_moyassar",
            "totalAyahs": 6236
        },
        "entries": entries
    }

    # Deterministic JSON serialization
    serialized = json.dumps(payload, ensure_ascii=False, indent=None, separators=(",", ":"))
    raw_bytes = serialized.encode("utf-8")
    sha256 = hashlib.sha256(raw_bytes).hexdigest()

    print(f"[5/5] Writing output to {output_json_path}...")
    with open(output_json_path, "w", encoding="utf-8") as f:
        f.write(serialized)

    print("============================================================")
    print("TAFSIR PREPARATION SUCCESSFUL")
    print(f"Output File:     {output_json_path}")
    print(f"Total Ayahs:     {len(entries)} / 6,236")
    print(f"Total Bytes:     {len(raw_bytes):,} bytes ({len(raw_bytes)/(1024*1024):.2f} MB)")
    print(f"SHA-256 Digest:  {sha256}")
    print("============================================================")

if __name__ == "__main__":
    main()
