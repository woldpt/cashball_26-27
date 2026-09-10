import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";

/** Número de partículas do fundo animado. */
const PARTICLE_COUNT = 32;

/**
 * Fundo de partículas em canvas (`fixed`, decorativo). Desenha uma única frame
 * estática quando o sistema pede movimento reduzido, e escala o buffer pelo
 * `devicePixelRatio` (máx. 2) para não ficar desfocado em ecrãs retina.
 *
 * @returns {JSX.Element}
 */
const ParticleCanvas = () => {
	const canvasRef = useRef(null);
	const reduced = usePrefersReducedMotion();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animId;
		let width = window.innerWidth;
		let height = window.innerHeight;

		const resize = () => {
			width = window.innerWidth;
			height = window.innerHeight;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener("resize", resize);

		const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			r: Math.random() * 1.4 + 0.3,
			dx: (Math.random() - 0.5) * 0.25,
			dy: (Math.random() - 0.5) * 0.25,
			alpha: Math.random() * 0.5 + 0.15,
		}));

		const draw = () => {
			ctx.clearRect(0, 0, width, height);
			for (const p of particles) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(74,222,128,${p.alpha})`;
				ctx.fill();
				if (reduced) continue;
				p.x += p.dx;
				p.y += p.dy;
				if (p.x < 0) p.x = width;
				if (p.x > width) p.x = 0;
				if (p.y < 0) p.y = height;
				if (p.y > height) p.y = 0;
			}
			if (!reduced) animId = requestAnimationFrame(draw);
		};
		draw();

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener("resize", resize);
		};
	}, [reduced]);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none fixed inset-0 z-0 opacity-25"
		/>
	);
};

export default ParticleCanvas;
