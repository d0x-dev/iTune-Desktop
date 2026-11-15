import os
import json
import base64
import sqlite3
import shutil
import subprocess

# Decrypt master key using powershell DPAPI
def get_master_key(local_state_path):
    with open(local_state_path, 'r', encoding='utf-8') as f:
        local_state = json.load(f)
    enc_key = base64.b64decode(local_state['os_crypt']['encrypted_key'])
    # Strip DPAPI (5 bytes)
    enc_key = enc_key[5:]
    
    # Decrypt via powershell DPAPI
    ps_cmd = f'''
    Add-Type -AssemblyName System.Security
    $enc = [System.Convert]::FromBase64String("{base64.b64encode(enc_key).decode()}")
    $dec = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [System.Convert]::ToBase64String($dec)
    '''
    out = subprocess.check_output(['powershell', '-Command', ps_cmd]).decode().strip()
    return base64.b64decode(out)

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def decrypt_cookie(enc_val, key):
    try:
        # Check v10 / v11 prefix
        if enc_val.startswith(b'v10') or enc_val.startswith(b'v11'):
            iv = enc_val[3:15]
            ciphertext = enc_val[15:]
            aesgcm = AESGCM(key)
            return aesgcm.decrypt(iv, ciphertext, None).decode('utf-8', errors='ignore')
    except Exception as e:
        pass
    return None

def check_browser(name, base_dir):
    local_state = os.path.join(base_dir, 'Local State')
    cookies_db = os.path.join(base_dir, 'Default', 'Network', 'Cookies')
    if not os.path.exists(local_state) or not os.path.exists(cookies_db):
        print(f"[{name}] Files not found")
        return None
    
    try:
        key = get_master_key(local_state)
    except Exception as e:
        print(f"[{name}] Failed to get key: {e}")
        return None

    # Copy to temp file to avoid file locks
    temp_db = os.path.join(os.environ.get('TEMP', '.'), f'{name}_cookies.tmp')
    try:
        shutil.copy2(cookies_db, temp_db)
    except Exception as e:
        print(f"[{name}] Copy error: {e}")
        return None

    conn = sqlite3.connect(temp_db)
    cur = conn.cursor()
    cur.execute("SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%youtube.com%'")
    rows = cur.fetchall()
    conn.close()
    try: os.remove(temp_db)
    except: pass

    cookies = {}
    for n, enc in rows:
        val = decrypt_cookie(enc, key)
        if val:
            cookies[n] = val

    print(f"[{name}] Extracted {len(cookies)} YouTube cookies! Keys: {list(cookies.keys())}")
    has_auth = 'SAPISID' in cookies or '__Secure-3PAPISID' in cookies or 'LOGIN_INFO' in cookies
    print(f"[{name}] Has auth session: {has_auth}")
    if has_auth:
        cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
        return cookie_str
    return None

chrome_dir = os.path.join(os.environ['LOCALAPPDATA'], 'Google', 'Chrome', 'User Data')
edge_dir = os.path.join(os.environ['LOCALAPPDATA'], 'Microsoft', 'Edge', 'User Data')

c = check_browser('Chrome', chrome_dir)
if not c:
    c = check_browser('Edge', edge_dir)
