import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

# Change working directory to the directory of this script
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Override log_message to reduce terminal clutter
class QuietHandler(Handler):
    def log_message(self, format, *args):
        pass
        
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True

print("==================================================================")
print("🚀 TRENDING LIGHTWEIGHT SECURE SERVER INITIALIZING...")
print(f"Serving files locally from: {script_dir}")
print(f"Opening browser at: http://localhost:{PORT}")
print("Press CTRL+C in this terminal window to stop the server.")
print("==================================================================")

try:
    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        # Open default browser automatically
        webbrowser.open(f"http://localhost:{PORT}/public/index.html")
        httpd.serve_forever()
except Exception as e:
    print(f"\nError starting local server: {e}")
    print("If port 8000 is already in use, you can access the running instance in your browser.")
    sys.exit(1)
except KeyboardInterrupt:
    print("\nStopping local server. Goodbye!")
    sys.exit(0)
