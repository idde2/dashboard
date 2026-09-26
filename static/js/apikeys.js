// Clipboard copying utility
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        if (typeof showToast === "function") {
            showToast("API-Key in die Zwischenablage kopiert!");
        } else {
            alert("API-Key kopiert!");
        }
    } catch (err) {
        console.error("Failed to copy key:", err);
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            if (typeof showToast === "function") {
                showToast("API-Key in die Zwischenablage kopiert!");
            }
        } catch (e) {
            alert("Kopieren fehlgeschlagen.");
        }
        document.body.removeChild(textarea);
    }
}

// API Key Creation
async function createKey(username) {
    if (typeof showToast === "function") {
        showToast("Erstelle API-Key...");
    }
    
    try {
        const response = await fetch("/eddi/apikeys/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ target_user: username })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.key) {
                // Show modal with the full key
                const modal = document.getElementById("key-modal");
                const keyVal = document.getElementById("new-key-value");
                if (modal && keyVal) {
                    keyVal.innerText = data.key;
                    modal.style.display = "flex";
                } else {
                    alert("API-Key erstellt: " + data.key);
                }
            } else {
                if (typeof showToast === "function") showToast("Key erfolgreich erstellt! Lade neu...");
                setTimeout(() => window.location.reload(), 1500);
            }
        } else {
            const errText = await response.text();
            if (typeof showToast === "function") {
                showToast("Fehler: " + errText);
            } else {
                alert("Fehler: " + errText);
            }
        }
    } catch (error) {
        console.error("Error creating API key:", error);
        if (typeof showToast === "function") showToast("Netzwerkfehler beim Erstellen des Keys.");
    }
}

// API Key Revocation
async function confirmRevoke(username) {
    const confirmed = confirm(`Möchtest du den API-Key für "${username}" wirklich unwiderruflich löschen?`);
    if (!confirmed) return;
    
    if (typeof showToast === "function") {
        showToast("Widerrufe API-Key...");
    }
    
    try {
        const response = await fetch("/eddi/apikeys/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ target_user: username })
        });
        
        if (response.ok) {
            if (typeof showToast === "function") {
                showToast("API-Key erfolgreich gelöscht!");
            }
            setTimeout(() => window.location.reload(), 1500);
        } else {
            const errText = await response.text();
            if (typeof showToast === "function") {
                showToast("Fehler: " + errText);
            } else {
                alert("Fehler: " + errText);
            }
        }
    } catch (error) {
        console.error("Error revoking API key:", error);
        if (typeof showToast === "function") showToast("Netzwerkfehler beim Löschen des Keys.");
    }
}

// Open Edit Key Modal
function editKey(username) {
    const unameElem = document.getElementById("edit-username");
    if (unameElem) unameElem.textContent = `Benutzer: ${username}`;
    const container = document.getElementById("perms-checkboxes");
    if (!container) return;
    container.innerHTML = "";
    
    // Use modern grid container
    container.className = "perms-grid";

    permsList.forEach(perm => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `perm-${perm}`;
        checkbox.value = perm;

        const currentPerms = (apikeysData[username] && apikeysData[username].perms) || [];
        if (currentPerms.includes(perm)) {
            checkbox.checked = true;
        }
        
        const critical = ["admin", "api", "users", "log", "cmd", "wg", "files"];
        const isCritical = critical.includes(perm);
        const isDisabled = !hasApiPerm && isCritical;
        
        if (isDisabled) {
            checkbox.disabled = true;
        }
        
        const label = document.createElement("label");
        label.className = "perm-card";
        if (checkbox.checked) label.classList.add("checked");
        if (isDisabled) label.classList.add("disabled");
        
        const contentSpan = document.createElement("span");
        contentSpan.className = "perm-card-content";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "perm-name";
        nameSpan.textContent = perm;
        contentSpan.appendChild(nameSpan);
        
        if (isCritical) {
            const critBadge = document.createElement("span");
            critBadge.className = "perm-badge-crit";
            critBadge.textContent = "Kritisch";
            contentSpan.appendChild(critBadge);
        }
        
        //label.appendChild(checkbox);
        checkbox.appendChild(label)
        label.appendChild(contentSpan);
        
        if (!isDisabled) {
            label.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    label.classList.add("checked");
                } else {
                    label.classList.remove("checked");
                }
            });
            
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    label.classList.add("checked");
                } else {
                    label.classList.remove("checked");
                }
            });
        }
        
        container.appendChild(label);
    });
    
    container.setAttribute('data-target-user', username);
    document.getElementById("edit-key-modal").style.display = "flex";
}


async function savePermissions() {
    const container = document.getElementById("perms-checkboxes");
    if (!container) return;
    const username = container.getAttribute('data-target-user');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach(cb => {
        if (cb.checked) selected.push(cb.value);
    });
    
    if (typeof showToast === "function") {
        showToast("Berechtigungen werden gespeichert...");
    }
    
    try {
        const response = await fetch("/eddi/apikeys/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_user: username, new_perms: selected })
        });
        if (response.ok) {
            if (typeof showToast === "function") showToast("Berechtigungen erfolgreich gespeichert!");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            const err = await response.text();
            if (typeof showToast === "function") showToast("Fehler: " + err);
        }
    } catch (e) {
        console.error(e);
        if (typeof showToast === "function") showToast("Netzwerkfehler beim Speichern.");
    }
}

function closeEditModal() {
    document.getElementById("edit-key-modal").style.display = "none";
}

// Modal helper functions
function copyModalKey() {
    const keyVal = document.getElementById("new-key-value");
    if (keyVal) {
        copyToClipboard(keyVal.innerText);
        const btn = document.getElementById("btn-modal-copy-action");
        if (btn) {
            btn.innerText = "Kopiert!";
            btn.style.background = "#2ecc71";
            btn.style.color = "#fff";
            setTimeout(() => {
                btn.innerText = "Kopieren";
                btn.style.background = "#ff9f43";
                btn.style.color = "#111";
            }, 2000);
        }
    }
}

function closeKeyModal() {
    const modal = document.getElementById("key-modal");
    if (modal) {
        modal.style.display = "none";
    }
    window.location.reload();
}
