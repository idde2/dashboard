// Log page specific JavaScript
document.addEventListener("DOMContentLoaded", () => {
    // Scroll to the bottom of the log box
    const logBox = document.querySelector(".log-box");
    if (logBox) {
        logBox.scrollTop = logBox.scrollHeight;
    }
});
