"""Package the extension with only the Python standard library."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
extension = root / "extension"
version = json.loads((extension / "manifest.json").read_text())["version"]
output = root / "dist" / f"slack-unslop-{version}.zip"
output.parent.mkdir(exist_ok=True)
files = [(file, Path("slack-unslop") / file.name) for file in sorted(extension.iterdir()) if file.is_file()]
files += [(root / name, Path("slack-unslop") / name) for name in ["README.md", "LICENSE", "docs/README.fr.md", "docs/PRIVACY.md", "docs/DEVELOPMENT.md"]]
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for file, target in files:
        entry = ZipInfo(target.as_posix(), (1980, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, file.read_bytes())
with ZipFile(output) as archive:
    assert archive.testzip() is None
print(f"Packaged dist/{output.name}")
