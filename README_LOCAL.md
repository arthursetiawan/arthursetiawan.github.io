Local run instructions

To preview the static portfolio site locally, you can use Python's built-in HTTP server.

Requirements
- Python 3 installed and available as `python` (or `py -3` on Windows).

Options

1) Using the included shell script (recommended if you have Git Bash / WSL):

    ./serve.sh 8000

2) Using PowerShell (Windows):

    .\serve.ps1 -Port 8000

3) Direct command (any shell):

    python -m http.server 8000 --bind 127.0.0.1

Open your browser at http://127.0.0.1:8000 to view the site.

Notes
- The server serves files from the repository root. Ensure you run the command from the `arthursetiawan.github.io` folder.
- To publish changes, push to your GitHub Pages branch (usually `main` or `gh-pages`) and enable GitHub Pages in the repo settings.
