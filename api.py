import requests
import subprocess
import re
import qrcode
import json
from pythonping import ping

def test_user(user="", token=""):
    req = requests.get(f"http://eddi.cowdie.com/api/token/{user}/{token}")
    data = req.json()
    return data.get("error") == "true"




def wireguard_peer_delete(
        server_conf="/etc/wireguard/wg1.conf",
        public_key=None,
        ip=None
):
    import os
    ip_cidr = f"{ip}/32"

    # --- Clean up data.json ---
    try:
        with open(f"/data/wg/data.json", "r") as f:
            data = json.load(f)

        if ip in data:
            del data[ip]

        with open(f"/data/wg/data.json", "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

    # --- Delete client .conf file ---
    conf_path = f"/data/wg/wg_client_{ip}.conf"
    if os.path.exists(conf_path):
        os.remove(conf_path)

    # --- Delete QR code image ---
    qr_path = f"/home/eddi/dashboard/static/img/wg_client_{ip}.png"
    if os.path.exists(qr_path):
        os.remove(qr_path)

    # --- Remove peer from WireGuard server config ---
    try:
        with open(server_conf, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except FileNotFoundError:
        return True

    new_lines = []
    inside_peer = False
    delete_block = False
    current_block = []

    for line in lines:
        stripped = line.strip()

        if stripped == "[Peer]":
            inside_peer = True
            delete_block = False
            current_block = [line]
            continue

        if inside_peer:
            current_block.append(line)

            if public_key and stripped.startswith("PublicKey =") and public_key in stripped:
                delete_block = True
            if ip_cidr and stripped.startswith("AllowedIPs =") and ip_cidr in stripped:
                delete_block = True

            if stripped.startswith("[Interface]") or stripped.startswith("[Peer]") or line == lines[-1]:
                if not delete_block:
                    new_lines.extend(current_block)
                inside_peer = False

            continue

        new_lines.append(line)

    with open(server_conf, "w") as f:
        f.writelines(new_lines)

    subprocess.run(["sudo", "wg-quick", "down", "wg1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["sudo", "wg-quick", "up", "wg1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return True


def wireguard(
    server_conf="/etc/wireguard/wg1.conf",
    allowed_ips="0.0.0.0/0",
    keepalive=25,
    endpoint="eddi.cowdie.com:51821"
):
    with open(server_conf, "r", encoding="utf-8", errors="ignore") as f:
        data = f.read()

    private_raw = None
    listen_port = None

    for line in data.splitlines():
        if line.strip().startswith("PrivateKey"):
            private_raw = line.split("=", 1)[1]
        if line.strip().startswith("ListenPort"):
            listen_port = line.split("=", 1)[1].strip()

    private_clean = re.sub(r'[^A-Za-z0-9+/=]', '', private_raw)

    server_public = subprocess.check_output(
        ["wg", "pubkey"], input=private_clean.encode()
    ).strip().decode()

    used_ips = []
    for line in data.splitlines():
        if "AllowedIPs" in line:
            ip = line.split("=", 1)[1].strip()
            if ip.endswith("/32") and ip.startswith("10.8.1."):
                used_ips.append(int(ip.split(".")[3].split("/")[0]))

    next_ip = max(used_ips) + 1 if used_ips else 2
    client_ip = f"10.8.1.{next_ip}/32"

    client_private = subprocess.check_output(["wg", "genkey"]).strip().decode()
    client_public = subprocess.check_output(
        ["wg", "pubkey"], input=client_private.encode()
    ).strip().decode()

    new_peer = f"""
[Peer]
PublicKey = {client_public}
AllowedIPs = {client_ip}
PersistentKeepalive = {keepalive}
"""

    with open(server_conf, "a") as f:
        f.write("\n" + new_peer)

    client_conf = f"""
[Interface]
PrivateKey = {client_private}
Address = {client_ip}

[Peer]
PublicKey = {server_public}
Endpoint = {endpoint}
AllowedIPs = {allowed_ips}
PersistentKeepalive = {keepalive}
""".strip()

    img = qrcode.make(client_conf)
    client_ip = client_ip.replace("/32","")
    qr_path = f"/home/eddi/dashboard/static/img/wg_client_{client_ip}.png"
    img.save(qr_path)

    qr_path = qr_path.replace("/home/eddi/dashboard", "/eddi")

    with open(f"/data/wg/wg_client_{client_ip}.conf", "w") as f:
        f.write(client_conf)

    with open(f"/data/wg/data.json", "r") as f:
        data = json.load(f)

    data[client_ip] = [f"/data/wg/wg_client_{client_ip}.conf",qr_path]

    with open(f"/data/wg/data.json", "w") as f:
        json.dump(data, f, indent=2)

    subprocess.run(["sudo", "wg-quick", "down", "wg1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["sudo", "wg-quick", "up", "wg1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return data[client_ip]

def load_wg(ip):
    with open(f"/data/wg/data.json", "r") as f:
        data = json.load(f)
    return data[ip]


def ping_ip(ip):
    if not ip or ip in ("0.0.0.0", "None", None):
        return False
    response = ping(ip, count=1)
    return response.rtt_avg_ms



