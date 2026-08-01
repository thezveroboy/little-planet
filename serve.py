import http.server
import socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(('', 7000), NoCacheHandler) as httpd:
        print('Serving http://localhost:7000 (no-cache) — Ctrl+C to stop')
        httpd.serve_forever()
