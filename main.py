import os
import time
import shutil
from pathlib import Path
from flask import Flask, render_template, request, session, redirect, send_file
import requests
from flask_session import Session

from api import test_user, wireguard, wireguard_peer_delete, load_wg, ping_ip
from file import get_file, get_json_files


files = {}
app = Flask(__name__)

# Inject user permissions into all templates for dynamic UI visibility
@app.context_processor
def inject_user_perms():
    try:
        data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session.get("user"), "token": session.get("token")}).json()
        user = session.get("user")
        perms = data.get(user, {}).get("perms", []) if user else []
    except Exception:
        perms = []
    return {"user_perms": perms}

app.secret_key = "§LEf9QXdyfJwu60A3!0YiSxSt7RxN5Dl jnR9#LrnCvrG#JBbqYj2DVxkhR4=u9*4v-V-v0a=qLcpK#YF-mU9*gv+pk7CcPcQxeq"
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_FILE_DIR"] = "./flask_sessions"
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_COOKIE_SECURE"] = False
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_NAME"] = "flask_session"

Session(app)


def get_system_stats():
    # RAM
    ram_usage = 0
    try:
        with open('/proc/meminfo', 'r') as f:
            lines = f.readlines()
        mem_total = 0
        mem_available = 0
        for line in lines:
            if line.startswith('MemTotal:'):
                mem_total = int(line.split()[1])
            elif line.startswith('MemAvailable:'):
                mem_available = int(line.split()[1])
        if mem_total > 0:
            ram_usage = int(((mem_total - mem_available) / mem_total) * 100)
    except Exception:
        pass

    # CPU
    cpu_usage = 0
    try:
        def read_cpu_times():
            with open('/proc/stat', 'r') as f:
                first_line = f.readline()
            parts = first_line.split()
            times = [float(x) for x in parts[1:]]
            idle_time = times[3] + times[4]
            total_time = sum(times)
            return idle_time, total_time

        idle1, total1 = read_cpu_times()
        time.sleep(0.1)
        idle2, total2 = read_cpu_times()
        idle_delta = idle2 - idle1
        total_delta = total2 - total1
        if total_delta > 0:
            cpu_usage = int((1.0 - idle_delta / total_delta) * 100)
    except Exception:
        pass

    # ROM
    rom_usage = 0
    try:
        total, used, free = shutil.disk_usage("/")
        rom_usage = int((used / total) * 100)
    except Exception:
        pass

    return {
        "ram": ram_usage,
        "cpu": cpu_usage,
        "rom": rom_usage
    }


@app.before_request
def before_request():
    if request.endpoint == "static" or request.path == "/logout" or request.path == "/login":
        return

    if "user" in request.args and "token" in request.args:
        session["user"] = request.args["user"]
        session["token"] = request.args["token"]

    user = session.get("user")
    token = session.get("token")

    if not user or not token:
        return redirect("/eddi/login")

    if not test_user(user, token):
        return redirect("/eddi/login")

@app.errorhandler(404)
def page_not_found(e):
    return render_template("error.html"), 444

@app.route('/api/stats')
def api_stats():
    stats = get_system_stats()
    stats["ping_cf"] = ping_ip("1.1.1.1")
    stats["ping_wg"] = ping_ip("10.8.0.2")
    return stats

@app.route('/')
def index():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    user_perms = data.get(session["user"], {}).get("perms", [])
    if "admin" in user_perms:
        pass
    elif not "dashboard" in user_perms:
        return render_template("error.html")

    #ping = [ping_ip("1.1.1.1"), ping_ip("10.8.0.2")]
    ping = [0,0]
    return render_template(
        "dashboard.html",
        name="dashboard",
        ping=ping,
        data=get_system_stats()
    )

@app.route('/apikeys')
def apikeys_route():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    user_perms = data.get(session["user"], {}).get("perms", [])
    
    apikeys = {}
    try:
        r = requests.post("https://eddi.cowdie.com/api/T0kEn/apikeys", json={"user": session["user"], "token": session["token"]})
        if r.status_code == 200:
            apikeys = r.json()
    except Exception as e:
        print("Error fetching static apikeys:", e)

    has_api_perm = "admin" in user_perms or "api" in user_perms

    # Load available permission names for UI
    perms = []
    perms_file = "/data/perms/perms.txt"
    if os.path.exists(perms_file):
        with open(perms_file, "r", encoding="utf-8") as f:
            perms = [line.strip() for line in f if line.strip()]

    # Render template with permission list
    return render_template(
        "apikeys.html",
        name="apikeys",
        apikeys=apikeys,
        has_api_perm=has_api_perm,
        all_users=data,
        current_user=session["user"],
        perms_list=perms
    )

@app.route("/apikeys/create", methods=["POST"])
def dashboard_create_apikey():
    target_user = request.form.get("target_user") or request.json.get("target_user")
    if not target_user:
        return "Ungültiger Benutzer", 400
    
    payload = {
        "token": session["token"],
        "user": session["user"],
        "target_user": target_user
    }
    try:
        r = requests.post("https://eddi.cowdie.com/api/T0kEn/create_apikey", json=payload)
        if r.status_code == 200:
            res_json = r.json()
            if "error" in res_json:
                return res_json["error"], 400
            return res_json, 200
        return "Fehler vom Backend", 500
    except Exception as e:
        return str(e), 500

@app.route("/apikeys/revoke", methods=["POST"])
def dashboard_revoke_apikey():
    # Forward revocation to backend API
    data = request.get_json()
    target_user = data.get("target_user")
    payload = {
        "token": session["token"],
        "user": session["user"],
        "target_user": target_user
    }
    try:
        r = requests.post("https://eddi.cowdie.com/api/T0kEn/revoke_apikey", json=payload)
        if r.status_code == 200:
            return r.json(), 200
        return "Fehler vom Backend", 500
    except Exception as e:
        return str(e), 500

@app.route("/apikeys/update", methods=["POST"])
def dashboard_update_apikey_perms():
    # Forward permission update to backend API
    data = request.get_json()
    target_user = data.get("target_user")
    new_perms = data.get("new_perms", [])
    payload = {
        "token": session["token"],
        "user": session["user"],
        "target_user": target_user,
        "new_perms": new_perms
    }
    try:
        r = requests.post("https://eddi.cowdie.com/api/T0kEn/update_apikey_perms", json=payload)
        if r.status_code == 200:
            return r.json(), 200
        return "Fehler vom Backend", 500
    except Exception as e:
        return str(e), 500

@app.route("/wg")
@app.route("/wg/<path>")
@app.route("/wg/<path>/<path2>")
def wg(path=None,path2=None):
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    if "admin" in data[session["user"]]["perms"]:
        pass
    elif not "wg" in data[session["user"]]["perms"]:
        return render_template("error.html")

    conf, qr = None, None
    selected_ip = None
    if path == "wg":
        conf, qr = wireguard()
    elif path == "sh":
        try:
            conf, qr = load_wg(path2)
        except Exception:
            selected_ip = path2
    elif path == "rm":
        wireguard_peer_delete(ip=path2)
        # Redirect back to WG overview after deletion (not fall-through)
        return redirect("/eddi/wg")
    elif path == "file":
        return send_file(f"/data/wg/{path2}")

    all = [str(f) for f in Path("/data/wg").resolve(strict=True).rglob("*.conf") if f.is_file()]
    ips = []
    for ip in all:
        ip = ip.replace("/data/wg/wg_client_","").replace(".conf","")
        ips.append(ip)

    if not conf == None:
        with open(conf, "r") as f:
            return render_template("wg.html", name="wg", conf=f.read(), qr=qr,conf_raw=conf.replace("/data/wg/",""),ips=ips, selected_ip=None)
    else:
        return render_template("wg.html", name="wg", conf="", qr="", conf_raw="",ips=ips, selected_ip=selected_ip)


@app.route("/log")
def log():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    if "admin" in data[session["user"]]["perms"]:
        pass
    elif not "log" in data[session["user"]]["perms"]:
        return render_template("error.html")
    log_content = ""
    if os.path.exists("/data/log.txt"):
        with open("/data/log.txt", "r", encoding="utf-8") as f:
            log_content = f.read()
        return render_template("log.html", name="log", log_content=log_content)

@app.route("/kontakt")
def kontakt():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    if "admin" in data[session["user"]]["perms"]:
        pass
    elif not "kontakt" in data[session["user"]]["perms"]:
        return render_template("error.html")

    global files
    result_files = get_json_files("/data/contact-form/")
    all_contents = []
    i = 0
    for f in result_files:
        files[str(i)] = f.split("/data/contact-form/")[1]
        all_contents.append(get_file(f,i))
        i = i + 1
    return render_template("kontakt.html",name="kontakt",files=result_files,content=all_contents)
@app.route("/kontakt/delete/<string:file>")
def delete_file(file):
    global files
    req = requests.get(f"http://eddi.cowdie.com/api/delete_form/{files[file]}")
    return redirect("/eddi/kontakt") if req.status_code == 200 else "<h1>Error</h1>"

@app.route("/cmd")
def cmd():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    if "admin" in data[session["user"]]["perms"]:
        pass
    elif not "cmd" in data[session["user"]]["perms"]:
        return render_template("error.html")
    return render_template("cmd.html",name="cmd")

@app.route("/file")
def file():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    if "admin" in data[session["user"]]["perms"]:
        pass
    elif not "file" in data[session["user"]]["perms"]:
        return render_template("error.html")
    return render_template("file.html",name="file")

@app.route("/users/create", methods=["POST"])
def create_user_route():
    # Expect JSON payload with username, password, perms (optional)
    data = request.get_json()
    if not data:
        return "Invalid request", 400
    username = data.get("username")
    password = data.get("password")
    perms = data.get("perms", [])
    if not username or not password:
        return "Username and password required", 400
    payload = {
        "token": session.get("token"),
        "user": session.get("user"),
        "new_username": username,
        "new_password": password,
        "new_perms": perms
    }
    try:
        r = requests.post("https://eddi.cowdie.com/api/T0kEn/create_user", json=payload)
        if r.status_code == 200:
            return "User created", 200
        else:
            return f"Backend error: {r.text}", 500
    except Exception as e:
        return str(e), 500

@app.route("/users")
def users():
    data = requests.post("https://eddi.cowdie.com/api/T0kEn/users", json={"user": session["user"], "token": session["token"]}).json()
    if "admin" in data[session["user"]]["perms"]:
        pass
    elif not "users" in data[session["user"]]["perms"]:
        return render_template("error.html")
    perms = []
    if os.path.exists("/data/perms/perms.txt"):
        with open("/data/perms/perms.txt", "r", encoding="utf-8") as f:
            perms = [zeile.strip() for zeile in f if zeile.strip()]
        return render_template("users.html", name="users", data=data, perms=perms, alle_rechte=perms)

@app.route("/users/update", methods=["POST"])
def update_user_route():
    print("test")
    user = session["user"]
    token = session["token"]
    if not user or not token:
        print("401")
        return "Nicht autorisiert", 401
    
    req_data = request.get_json()
    if not req_data:
        print("400")
        return "Ungültige Anfrage", 400
        
    target_user = req_data.get("target_user")
    new_username = req_data.get("new_username")
    new_password = req_data.get("new_password")
    new_perms = req_data.get("new_perms")
    
    if not target_user or not new_username or not new_password or new_perms is None:
        return "Ungültige Eingabewerte", 400
        
    payload = {
        "token": token,
        "user": user,
        "target_user": target_user,
        "new_username": new_username,
        "new_password": new_password,
        "new_perms": new_perms
    }
    
    try:
        response = requests.post("https://eddi.cowdie.com/api/T0kEn/update_user", json=payload)
        print(response.json())
        if response.status_code == 200:
            res_json = response.json()
            if "error" in res_json:
                return res_json["error"], 400
            
            # If the logged-in admin updated their own username, update the session
            if target_user == user and new_username != user:
                session["user"] = new_username
            return "Success", 200
        else:
            return "Fehler vom Backend", 500
    except Exception as e:
        return str(e), 500

@app.route("/login")
def login():
    return render_template("login.html")
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=2000)
