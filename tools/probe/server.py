#!/usr/bin/env python3
"""Probe server: serves the repository, and collects what a probe page
reports. GET or POST /report?m=… appends a line to probe.log; POST
/shot?n=NAME with a data-URL body saves NAME.jpg (or .png) under shots/.

    server.py OUT_DIR [PORT]
"""
import base64, http.server, os, sys, time, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.abspath(sys.argv[1])
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
os.makedirs(os.path.join(OUT, 'shots'), exist_ok=True)
LOG = os.path.join(OUT, 'probe.log')


def log(line):
    with open(LOG, 'a') as f:
        f.write('%.1f %s\n' % (time.time(), line))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def _query(self, key, default=''):
        q = urllib.parse.urlparse(self.path).query
        return urllib.parse.parse_qs(q).get(key, [default])[0]

    def do_GET(self):
        if self.path.startswith('/report'):
            log(self._query('m'))
            self.send_response(204)
            self.end_headers()
            return
        return super().do_GET()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path.startswith('/report'):
            log(self._query('m') or body.decode(errors='replace'))
        elif self.path.startswith('/shot'):
            name = os.path.basename(self._query('n', 'shot'))
            head, data = body.decode().split(',', 1)
            ext = 'png' if 'png' in head else 'jpg'
            with open(os.path.join(OUT, 'shots', name + '.' + ext), 'wb') as f:
                f.write(base64.b64decode(data))
            log('SHOT ' + name)
        self.send_response(204)
        self.end_headers()


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
