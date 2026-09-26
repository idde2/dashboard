// Helper function to animate SVG progress circles
function updateGauge(circleId, textId, value) {
    const circle = document.getElementById(circleId);
    const text = document.getElementById(textId);
    if (!circle || !text) return;

    const val = Math.min(Math.max(parseInt(value) || 0, 0), 100);
    const circumference = 251.2;
    const offset = circumference - (val / 100) * circumference;
    
    circle.style.strokeDashoffset = offset;
    text.innerText = val + "%";
}

// Helper to style ping boxes based on latency
function updatePingBox(elementId, valueId, ms) {
    const box = document.getElementById(elementId);
    const valSpan = document.getElementById(valueId);
    if (!box || !valSpan) return;

    if (ms === null || ms === undefined || ms === false || ms < 0) {
        valSpan.innerText = "Offline";
        box.className = "ping-element critical";
        return;
    }

    valSpan.innerText = ms + " ms";
    
    if (ms <= 30) {
        box.className = "ping-element good";
    } else if (ms <= 100) {
        box.className = "ping-element warning";
    } else {
        box.className = "ping-element critical";
    }
}

// Main Stats and Ping Update Loop
async function refreshStats() {
    try {
        const response = await fetch("/eddi/api/stats");
        if (response.ok) {
            const stats = await response.json();
            
            // Update Gauges
            updateGauge("ram-circle", "ram-text", stats.ram);
            updateGauge("cpu-circle", "cpu-text", stats.cpu);
            updateGauge("rom-circle", "rom-text", stats.rom);

            // Update Backend -> Cloudflare and WG pings
            updatePingBox("ping-cloudflare", "ping-cf-val", stats.ping_cf);
            updatePingBox("ping-wg", "ping-wg-val", stats.ping_wg);
        }
    } catch (error) {
        console.error("Error fetching system stats:", error);
    }

    // Measure Client -> Backend latency
    try {
        const clientMs = await ping(window.location.origin + "/eddi/static/docs");
        updatePingBox("ping-client", "ping-client-val", clientMs);
    } catch (error) {
        console.error("Error measuring client-to-backend latency:", error);
        updatePingBox("ping-client", "ping-client-val", null);
    }
}

// Initialize and start refresh loop
document.addEventListener("DOMContentLoaded", () => {
    // Initial Render of Gauges using data supplied by Flask Jinja context
    const ramText = document.getElementById("ram-text");
    const cpuText = document.getElementById("cpu-text");
    const romText = document.getElementById("rom-text");

    if (ramText) updateGauge("ram-circle", "ram-text", ramText.innerText.replace("%", ""));
    if (cpuText) updateGauge("cpu-circle", "cpu-text", cpuText.innerText.replace("%", ""));
    if (romText) updateGauge("rom-circle", "rom-text", romText.innerText.replace("%", ""));

    // Check Cloudflare & WG status from Jinja2 values on load
    const cfVal = document.getElementById("ping-cf-val");
    const wgVal = document.getElementById("ping-wg-val");
    if (cfVal) updatePingBox("ping-cloudflare", "ping-cf-val", parseInt(cfVal.innerText) || null);
    if (wgVal) updatePingBox("ping-wg", "ping-wg-val", parseInt(wgVal.innerText) || null);

    // Initial loop execution
    refreshStats();
    
    // Set interval for every 10 seconds
    setInterval(refreshStats, 10000);
});