#!/usr/bin/env python3
"""Make a scannable QR PNG for a QA link and, optionally, upload it to Notion.

Ticket QA blocks show each Expo Go link as a QR image right under its check, so Matthew scans it
with the iPhone camera instead of opening a link (see CLAUDE.md -> Workflow -> QA links).

  python3 scripts/qa-qr.py "<exp:// link>" out.png
  python3 scripts/qa-qr.py "<exp:// link>" out.png --upload <upload_url> <authorization header>

Upload flow: call the Notion connector's `notion-create-file-upload` (filename *.png), pass its
`upload_url` and `upload_headers.authorization` here, then place the returned
`<image src="file-upload://...">` on the ticket page under the check (`notion-update-page`).
Needs the `qrcode` package; when missing it is installed into a temp dir (no project dependency).
"""

import json
import subprocess
import sys
import tempfile


def load_qrcode():
    try:
        import qrcode  # noqa: PLC0415
    except ImportError:
        target = tempfile.mkdtemp(prefix="qa-qr-")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "--target", target, "qrcode[pil]"],
            check=True,
        )
        sys.path.insert(0, target)
        import qrcode  # noqa: PLC0415
    return qrcode


def main(argv: list[str]) -> int:
    if len(argv) not in (2, 5) or (len(argv) == 5 and argv[2] != "--upload"):
        print(__doc__)
        return 2
    url, out = argv[0], argv[1]
    if not url.startswith(("exp://", "https://", "trip://")):
        print(f"not a QA link: {url}", file=sys.stderr)
        return 2
    # box_size 8 / border 4: about 400 px, easy to scan from a laptop screen.
    load_qrcode().make(url, box_size=8, border=4).save(out)
    print(f"wrote {out} for {url}")
    if len(argv) == 5:
        upload_url, auth = argv[3], argv[4]
        result = subprocess.run(
            ["curl", "-sS", "-X", "POST", upload_url, "-H", f"authorization: {auth}",
             "-F", f"file=@{out};type=image/png"],
            check=True, capture_output=True, text=True,
        )
        body = json.loads(result.stdout)
        if body.get("status") != "uploaded":
            print(result.stdout, file=sys.stderr)
            return 1
        print(body["suggested_markdown"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
