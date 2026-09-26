function openNav() {
    const nav = document.getElementById("nav");
    const btn = document.getElementById("btn");
    nav.classList.toggle("open");
    btn.classList.toggle("open");
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.innerText = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

let touchStartX = 0;
const sidebar = document.getElementById("nav");

document.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
});

document.addEventListener("touchend", (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 40) openNav();
    if (diff < -40) openNav();
});


async function ping(url) {
    return new Promise(resolve => {
        const start = performance.now();
        const img = new Image();
        img.onload = img.onerror = () =>
            resolve(Math.round(performance.now() - start));
        img.src = url + "?cache=" + Math.random();
    });
}

