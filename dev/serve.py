"""Banc d'essai local de rz-tablet (hors FiveM).

Lance :  python serve.py   (ou double-clic sur lancer.bat)
Ouvre :  http://localhost:8787/dev/

Sert le dossier de la ressource, et /__version renvoie les dates de derniere
modification de html/ pour que la page recharge toute seule a chaque sauvegarde
(le CSS est remplace a chaud, sans perdre l'ecran en cours).
Ce dossier dev/ n'est pas declare dans fxmanifest.lua : FiveM ne l'envoie pas aux joueurs.
"""
import http.server
import json
import os
import re
import socketserver
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "config.lua")


# ---------- Lecture de config.lua (tables litterales seulement : textes, nombres, booleens, tables) ----------
class LuaReader:
    def __init__(self, s):
        self.s, self.i = s, 0

    def ws(self):
        s = self.s
        while self.i < len(s):
            if s[self.i].isspace():
                self.i += 1
            elif s.startswith("--[[", self.i):
                j = s.find("]]", self.i)
                self.i = len(s) if j < 0 else j + 2
            elif s.startswith("--", self.i):
                j = s.find("\n", self.i)
                self.i = len(s) if j < 0 else j + 1
            else:
                break

    def string(self):
        s, q = self.s, self.s[self.i]
        if s.startswith("[[", self.i):
            j = s.index("]]", self.i)
            v = s[self.i + 2:j]; self.i = j + 2
            return v
        self.i += 1
        out = []
        esc = {"n": "\n", "t": "\t", "\\": "\\", "'": "'", '"': '"'}
        while s[self.i] != q:
            c = s[self.i]
            if c == "\\":
                self.i += 1; out.append(esc.get(s[self.i], s[self.i]))
            else:
                out.append(c)
            self.i += 1
        self.i += 1
        return "".join(out)

    def value(self):
        self.ws()
        s, c = self.s, self.s[self.i]
        if c == "{":
            return self.table()
        if c in "'\"`" or s.startswith("[[", self.i):
            return self.string()
        m = re.match(r"-?\d+(\.\d+)?", s[self.i:])
        if m:
            self.i += m.end()
            return float(m.group()) if m.group(1) else int(m.group())
        m = re.match(r"[A-Za-z_][\w.]*", s[self.i:])
        if m:
            self.i += m.end()
            w = m.group()
            if w in ("true", "false"):
                return w == "true"
            if w == "nil":
                return None
            self.ws()
            if self.i < len(s) and s[self.i] == "(":   # appel (vec3(...)) : ignore
                depth = 0
                while True:
                    depth += {"(": 1, ")": -1}.get(s[self.i], 0); self.i += 1
                    if depth == 0:
                        break
            return None
        raise ValueError("valeur inattendue a la position %d" % self.i)

    def table(self):
        self.i += 1
        arr, obj = [], {}
        while True:
            self.ws()
            if self.s[self.i] == "}":
                self.i += 1
                break
            m = re.match(r"([A-Za-z_]\w*)\s*=(?!=)", self.s[self.i:])
            if m:
                self.i += m.end(); obj[m.group(1)] = self.value()
            elif self.s[self.i] == "[" and not self.s.startswith("[[", self.i):
                self.i += 1; k = self.value(); self.ws(); self.i += 1   # ]
                self.ws(); self.i += 1                                     # =
                obj[str(k)] = self.value()
            else:
                arr.append(self.value())
            self.ws()
            if self.s[self.i] in ",;":
                self.i += 1
        if obj:
            return {k: v for k, v in obj.items() if v is not None}
        return arr


def read_config():
    """Config.Store et Config.AppIcons de config.lua, comme les recoit la tablette en jeu."""
    try:
        src = open(CONFIG, encoding="utf-8").read()
    except OSError:
        return {}
    out = {}
    for name, key in (("Store", "store"), ("AppIcons", "icons")):
        m = re.search(r"^\s*Config\.%s\s*=\s*" % name, src, re.M)
        if not m:
            continue
        try:
            r = LuaReader(src); r.i = m.end()
            out[key] = r.value()
        except Exception as e:  # noqa: BLE001 - on signale sans bloquer le banc
            out.setdefault("errors", []).append("Config.%s : %s" % (name, e))
    return out


def version():
    """css = html/*.css (rechargee sans perdre l'etat), html = le reste de html/, dev = ce dossier, cfg = config.lua."""
    out = {"css": 0.0, "html": 0.0, "dev": 0.0}
    try:
        out["cfg"] = os.path.getmtime(CONFIG)
    except OSError:
        out["cfg"] = 0.0
    for top, key in (("html", "html"), ("dev", "dev")):
        for base, _, files in os.walk(os.path.join(ROOT, top)):
            for f in files:
                try:
                    t = os.path.getmtime(os.path.join(base, f))
                except OSError:
                    continue
                k = "css" if key == "html" and f.endswith(".css") else key
                out[k] = max(out[k], t)
    return out


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/__version") or self.path.startswith("/__config"):
            body = json.dumps(version() if self.path.startswith("/__version") else read_config()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if self.path in ("/", ""):
            self.send_response(302)
            self.send_header("Location", "/dev/")
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        if "/__version" not in (args[0] if args else ""):
            sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    url = "http://localhost:%d/dev/" % PORT
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print("rz-tablet : banc d'essai sur %s  (Ctrl+C pour arreter)" % url)
        if "--no-open" not in sys.argv:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
