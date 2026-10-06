"""Build report/CDF-Bootcamp-Report.html from report/cdf-bootcamp-report.src.html.

Usage: python scripts/build_report.py <skill_dir>
  <skill_dir> is the folder of the eos-dashboard-branding skill (it holds scripts/embed_branding.py).

Two steps: apply the EOS branding, then replace every <img src="img/..."> by a data URI so the
generated page is a single file that can be shared without its img/ folder.
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "report" / "cdf-bootcamp-report.src.html"
OUT = ROOT / "report" / "CDF-Bootcamp-Report.html"
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def inline_images(html: str) -> tuple[str, int]:
    count = 0

    def repl(match: re.Match) -> str:
        nonlocal count
        path = SRC.parent / match.group(1)
        if not path.is_file():
            raise SystemExit(f"Missing image: {path}")
        count += 1
        data = base64.b64encode(path.read_bytes()).decode("ascii")
        return f'src="data:{MIME[path.suffix.lower()]};base64,{data}"'

    return re.sub(r'src="(img/[^"]+)"', repl, html), count


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    sys.path.insert(0, str(Path(sys.argv[1]) / "scripts"))
    from embed_branding import brand_html, check

    html = brand_html(SRC.read_text(encoding="utf-8"))
    problems = check(html)
    if problems:
        raise SystemExit("Branding problems: " + "; ".join(problems))
    html, count = inline_images(html)
    OUT.write_text(html, encoding="utf-8")
    print(f"Written {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB), branding OK, {count} image(s) embedded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
