let currentUsername = "";

function user(name, infos) {
    const m_cont = document.getElementById("message-container");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    currentUsername = name;
    
    if (usernameInput) usernameInput.value = name;
    if (passwordInput) passwordInput.value = infos.passw || "";

    document.getElementById("content").style.display = "none";
    m_cont.style.display = "flex";

    document.querySelectorAll('.user-block').forEach(block => {
        block.style.display = 'none';
    });

    const targetBlock = document.querySelector(`.user-block[data-user="${name}"]`);
    if (targetBlock) {
        targetBlock.style.display = 'block';

        // Verhindert das Race-Condition-Problem beim Öffnen des Modals
        setTimeout(() => {
            initTomSelectOnDemand(targetBlock);
        }, 50);
    }
}

function closeModal() {
    document.getElementById("message-container").style.display = "none";
    document.getElementById("content").style.display = "grid";
}

function openCreateUserModal() {
    document.getElementById("content").style.display = "none";
    const modal = document.getElementById("create-user-modal");
    modal.style.display = "flex";
    
    setTimeout(() => {
        const selectEl = document.getElementById("new-perms-select");
        if (selectEl && !selectEl.tomselect) {
            const ts = new TomSelect(selectEl, {
                plugins: ['remove_button'],
                create: false,
                controlInput: null,
                sortField: {
                    field: "text",
                    direction: "asc"
                }
            });
            
            ts.wrapper.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            ts.control.addEventListener('click', (e) => {
                e.stopPropagation();
                if (ts.isOpen) {
                    ts.close();
                } else {
                    ts.focus();
                }
            });

            const arrow = modal.querySelector('.gruppen-dropdown-arrow');
            if (arrow) {
                arrow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (ts.isOpen) {
                        ts.close();
                    } else {
                        ts.focus();
                    }
                });
            }
        }
    }, 50);
}

function closeCreateUserModal() {
    document.getElementById("create-user-modal").style.display = "none";
    document.getElementById("content").style.display = "grid";
}

async function createUser() {
    const username = document.getElementById("new-username").value.trim();
    const password = document.getElementById("new-password").value;
    
    if (!username) {
        showToast("Benutzername darf nicht leer sein!");
        return;
    }
    if (!password) {
        showToast("Passwort darf nicht leer sein!");
        return;
    }

    showToast("Benutzer wird erstellt…");

    const selectEl = document.getElementById("new-perms-select");
    let selectedPerms = [];
    if (selectEl && selectEl.tomselect) {
        selectedPerms = selectEl.tomselect.getValue();
        if (typeof selectedPerms === 'string') {
            selectedPerms = selectedPerms ? selectedPerms.split(',') : [];
        }
    } else if (selectEl) {
        selectedPerms = Array.from(selectEl.selectedOptions).map(opt => opt.value);
    }

    try {
        const response = await fetch("/eddi/users/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password,
                perms: selectedPerms
            })
        });

        if (response.ok) {
            closeCreateUserModal();
            showToast("Benutzer erfolgreich erstellt!");

            setTimeout(() => {
                window.location.reload();
            }, 2500);
        } else {
            const errText = await response.text();
            showToast("Fehler: " + errText);
        }
    } catch (error) {
        console.error(error);
        showToast("Netzwerkfehler beim Erstellen des Benutzers.");
    }
}

function initTomSelectOnDemand(blockElement) {
    const selectEl = blockElement.querySelector('.perms-select-field');

    if (!selectEl || selectEl.tomselect) return;

    const ts = new TomSelect(selectEl, {
        plugins: ['remove_button'],
        create: false,
        controlInput: null,
        sortField: {
            field: "text",
            direction: "asc"
        }
    });

    ts.wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    ts.control.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ts.isOpen) {
            ts.close();
        } else {
            ts.focus();
        }
    });

    const arrow = blockElement.querySelector('.gruppen-dropdown-arrow');
    if (arrow) {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (ts.isOpen) {
                ts.close();
            } else {
                ts.focus();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.element').forEach(element => {
        element.addEventListener('click', () => {
            const name = element.getAttribute('data-name');
            const infosRaw = element.getAttribute('data-infos');

            let infos = {};
            try {
                if (infosRaw) {
                    infos = JSON.parse(infosRaw);
                }
            } catch (e) {
                console.error(e);
            }

            user(name, infos);
        });
    });

    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const newUsername = document.getElementById("username").value.trim();
            const newPassword = document.getElementById("password").value;
            
            if (!newUsername) {
                showToast("Benutzername darf nicht leer sein!");
                return;
            }

            showToast("Änderungen werden gespeichert…");

            const targetBlock = document.querySelector(`.user-block[data-user="${currentUsername}"]`);
            let selectedPerms = [];
            if (targetBlock) {
                const selectEl = targetBlock.querySelector('.perms-select-field');
                if (selectEl && selectEl.tomselect) {
                    selectedPerms = selectEl.tomselect.getValue();
                    if (typeof selectedPerms === 'string') {
                        selectedPerms = selectedPerms ? selectedPerms.split(',') : [];
                    }
                } else if (selectEl) {
                    selectedPerms = Array.from(selectEl.selectedOptions).map(opt => opt.value);
                }
            }

            try {
                const response = await fetch("/eddi/users/update", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        target_user: currentUsername,
                        new_username: newUsername,
                        new_password: newPassword,
                        new_perms: selectedPerms
                    })
                });

                if (response.ok) {
                    closeModal();
                    showToast("Benutzer erfolgreich aktualisiert!");

                    setTimeout(() => {
                        window.location.reload();
                    }, 2500);
                } else {
                    const errText = await response.text();
                    showToast("Fehler: " + errText);
                }
            } catch (error) {
                console.error(error);
                showToast("Netzwerkfehler beim Aktualisieren des Benutzers.");
            }
        });
    }
});