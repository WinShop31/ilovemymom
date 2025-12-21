(function () {
    const intro = document.getElementById("intro-screen");
    const canvas = document.getElementById("intro-shards");
    const ctx = canvas.getContext("2d");

    let shards = [];
    let started = false;

    /* -----------------------------
       CANVAS SIZE FIX
    ----------------------------- */
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();

        canvas.style.width = "100%";
        canvas.style.height = "100%";

        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;

        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /* -----------------------------
       CREATE SHARDS
    ----------------------------- */
    function createShards() {
        shards = [];
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        for (let i = 0; i < 35; i++) {
            shards.push({
                x: w / 2 + (Math.random() - 0.5) * 30,
                y: h / 2 + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 2,
                size: 4 + Math.random() * 10,
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.3,
                life: 0,
                maxLife: 25 + Math.random() * 25,
                color: Math.random() > 0.5 ? "#4f46e5" : "#818cf8"
            });
        }
    }

    /* -----------------------------
       DRAW SHARDS
    ----------------------------- */
    function drawShards() {
        if (!started) return;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        ctx.clearRect(0, 0, w, h);

        shards.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.18;
            s.rot += s.vr;
            s.life++;

            let alpha = 1 - s.life / s.maxLife;
            if (alpha < 0) alpha = 0;

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.color;

            ctx.beginPath();
            ctx.moveTo(-s.size, -s.size * 0.4);
            ctx.lineTo(s.size * 1.1, -s.size * 0.2);
            ctx.lineTo(s.size * 0.7, s.size * 0.9);
            ctx.lineTo(-s.size * 0.6, s.size * 0.4);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        });

        shards = shards.filter(s => s.life < s.maxLife);

        requestAnimationFrame(drawShards);
    }

    /* -----------------------------
       START INTRO
    ----------------------------- */
    function startIntro() {
        if (!intro) return;

        resizeCanvas();

        // Запуск осколков после разрыва буквы
        setTimeout(() => {
            started = true;
            createShards();
            drawShards();
        }, 2100);

        // Полное время интро ~6 секунд
        const totalDuration = 6000;

        setTimeout(() => {
            intro.classList.add("hidden");

            // Показ сайта
            const root = document.querySelector(".root");
            setTimeout(() => {
                if (root) root.style.opacity = 1;
            }, 200);

            // Удаление интро из DOM
            setTimeout(() => {
                if (intro && intro.parentNode) {
                    intro.parentNode.removeChild(intro);
                }
            }, 700);

        }, totalDuration);
    }

    /* -----------------------------
       EVENTS
    ----------------------------- */
    window.addEventListener("load", startIntro);
    window.addEventListener("resize", resizeCanvas);
})();
