document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search");
    const sortSelect = document.getElementById("search-select");

    const container = document.querySelector(".element")?.parentElement;

    if (!container) return;

    // --- 1. FUNKTION: SORTIEREN ---
    if (sortSelect) {
        sortSelect.onchange = () => {
            const method = sortSelect.value;

            const elements = Array.from(container.querySelectorAll(".element"));

            elements.sort((a, b) => {

                const nameA = (a.dataset.name || a.textContent).trim().toLowerCase();
                const nameB = (b.dataset.name || b.textContent).trim().toLowerCase();
                const timeA = a.dataset.time || "";
                const timeB = b.dataset.time || "";

                switch (method) {
                    case "time":
                        return timeB.localeCompare(timeA);
                    case "time2":
                        return timeA.localeCompare(timeB);
                    case "name":
                        return nameA.localeCompare(nameB);
                    case "name2":
                        return nameB.localeCompare(nameA);
                    default:
                        return 0;
                }
            });
            elements.forEach(el => container.appendChild(el));
        };
    }

    // --- 2. FUNKTION: SUCHEN (Deine funktionierende Suche) ---
    if (searchInput) {
        searchInput.oninput = () => {
            const filterValue = searchInput.value.toLowerCase();
            container.querySelectorAll(".element").forEach(element => {
                const contentText = element.textContent.toLowerCase();
                element.style.display = contentText.includes(filterValue) ? "" : "none";
            });
        };
    }
});


function showMessage(text) {
    const m_cont = document.getElementById("message-container");
    const m = document.getElementById("message");
    m.textContent = text;
    m_cont.style.display = "block";
}

async function deleteMessage(file) {
req = await fetch("/eddi/kontakt/delete/" + file);
if (req.ok) {
    showToast("Message deleted");
    document.getElementById(file).remove();
} else {
    showToast("Error deleting message");
}
}