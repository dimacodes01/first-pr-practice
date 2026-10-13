#!/bin/bash
# Double-click this file to open ScholarPath at http://localhost:8000/index.html
cd "$(dirname "$0")" || exit 1
if python3 -c 'pass' >/dev/null 2>&1; then
  echo
  echo "  ScholarPath is running at:  http://localhost:8000/index.html"
  echo
  echo "  Keep this window open while you use ScholarPath."
  echo "  Close this window when you are finished."
  echo
  (sleep 2; open "http://localhost:8000/index.html") &
  python3 -m http.server 8000 --bind 127.0.0.1
  echo "ScholarPath stopped. If it says the address is already in use, close the other ScholarPath window first."
else
  echo "Python is not installed, so the localhost address cannot start."
  echo "ScholarPath will open straight from the file instead. It works the same way."
  open index.html
fi
