// ============================================================
// Enkel ljudspelare med vågform
// Varje .audio-player består av en <audio>-tagg, en playknapp
// (.play-btn) och en <canvas> (.waveform) där vågformen ritas.
// ============================================================

window.addEventListener("load", () => {

	// ---- Lösenordsskydd ----
	// Startsidan (#start) visar ett lösenordsfält. Rätt lösenord
	// navigerar vidare till sidan med ljudspelarna (#page1).

	const PASSWORD = "testa123";
	const passwordInput = document.getElementById("password-input");
	const passwordError = document.querySelector(".password-error");

	function checkPassword() {
		if (passwordInput.value === PASSWORD) {
			passwordError.classList.remove("show");
			window.location = "#page1";
		} else {
			passwordError.classList.add("show");
			passwordInput.value = "";
			passwordInput.focus();
		}
	}

	// Enter-tangenten i fältet fungerar som inloggning
	passwordInput.addEventListener("keydown", event => {
		if (event.key === "Enter") checkPassword();
	});

	// ---- Ljudspelare ----

	// AudioContext används för att avkoda ljudfilerna och rita vågformerna
	const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

	document.querySelectorAll(".audio-player").forEach(player => {

		const audio = player.querySelector("audio");
		const button = player.querySelector(".play-btn");
		const canvas = player.querySelector(".waveform");
		const ctx = canvas.getContext("2d");

		let peaks = [];   // uträknade toppar (0–1) för vågformen
		let progress = 0; // uppspelningsläge (0–1)

		// ---- Vågform ----

		// Hämta och avkoda ljudfilen, räkna ut topparna och rita vågformen
		fetch(audio.src)
			.then(response => response.arrayBuffer())
			.then(buffer => audioCtx.decodeAudioData(buffer))
			.then(decoded => {
				peaks = getPeaks(decoded, 400);
				draw();
			})
			.catch(() => {
				// Om filen inte kan avkodas ritas en enkel platshållare istället
				peaks = new Array(400).fill(0.3);
				draw();
			});

		// Dela upp ljuddatat i staplar och hämta högsta värdet per stapel
		function getPeaks(buffer, count) {
			const data = buffer.getChannelData(0);
			const blockSize = Math.floor(data.length / count);
			const result = [];
			for (let i = 0; i < count; i++) {
				let max = 0;
				const start = i * blockSize;
				for (let j = 0; j < blockSize; j++) {
					const value = Math.abs(data[start + j]);
					if (value > max) max = value;
				}
				result.push(max);
			}
			// Normalisera så att högsta toppen blir 1
			const peak = Math.max(...result);
			return result.map(value => peak ? value / peak : 0);
		}

		// Rita vågformen – den redan spelade delen ritas med mörk färg.
		// Staplarna snappas till hela pixlar för att de ska bli helt skarpa
		// (halva pixelpositioner skulle annars mjukrenderas).
		function draw() {
			const dpr = window.devicePixelRatio || 1;
			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			if (!width || !peaks.length) return;

			canvas.width = width * dpr;
			canvas.height = height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, height);

			const barWidth = 1;
			const gap = 1;
			const step = barWidth + gap;
			const barCount = Math.floor(width / step);
			const offset = Math.round((width - barCount * step + gap) / 2);

			// Under uppspelning ritas vågformen i orange toner
			const playedColor = audio.paused ? "#111111" : "#E07B39";
			const upcomingColor = audio.paused ? "#4a4a4a" : "#F0B98A";

			for (let i = 0; i < barCount; i++) {
				// Hämta toppvärdet för motsvarande del av ljudet
				const peak = peaks[Math.floor(i / barCount * peaks.length)];
				const barHeight = Math.max(2, Math.round(peak * height));
				const x = offset + i * step;
				const y = Math.round((height - barHeight) / 2);
				ctx.fillStyle = (i / barCount) <= progress ? playedColor : upcomingColor;
				ctx.fillRect(x, y, barWidth, barHeight);
			}
		}

		// ---- Uppspelning ----

		// Playknappen startar/pausar ljudet
		button.addEventListener("click", () => {
			audioCtx.resume(); // vissa webbläsare kräver ett klick innan ljud får spelas
			if (audio.paused) {
				// Pausa övriga spelare så att bara ett ljud spelas åt gången
				document.querySelectorAll(".audio-player audio").forEach(other => {
					if (other !== audio) other.pause();
				});
				audio.play();
			} else {
				audio.pause();
			}
		});

		// Klick på vågformen hoppar till motsvarande position i ljudet
		canvas.addEventListener("click", event => {
			const rect = canvas.getBoundingClientRect();
			const position = (event.clientX - rect.left) / rect.width;
			if (audio.duration) audio.currentTime = position * audio.duration;
		});

		// Uppdatera vågformen allt eftersom ljudet spelas
		audio.addEventListener("timeupdate", () => {
			progress = audio.duration ? audio.currentTime / audio.duration : 0;
			draw();
		});

		// Byt ikon på knappen och rita om vågformen när ljudet startar, pausar eller tar slut
		audio.addEventListener("play", () => {
			button.classList.add("playing");
			// Inforuta (deaktiverad): document.body.classList.add("playing");
			// const title = player.querySelector(".track-title");
			// const infoTitle = document.querySelector(".track-info-title");
			// if (title && infoTitle) infoTitle.textContent = title.textContent;
			draw();
		});
		audio.addEventListener("pause", () => {
			button.classList.remove("playing");
			// Inforuta (deaktiverad): document.body.classList.remove("playing");
			draw();
		});
		audio.addEventListener("ended", () => {
			progress = 0;
			draw();
		});

		// Rita om vågformen om fönstret ändrar storlek
		window.addEventListener("resize", draw);

		// Rita om vågformen när canvas ändrar storlek (t.ex. vid mobil/desktop-byte)
		new ResizeObserver(draw).observe(canvas);
	});
});
