import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * `prefers-reduced-motion` reativo — devolve `true` enquanto o sistema pede
 * movimento reduzido e reage a alterações da preferência em tempo real.
 *
 * @returns {boolean} true quando o sistema pede movimento reduzido.
 */
export function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(
		() =>
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia(REDUCED_MOTION_QUERY).matches,
	);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia(REDUCED_MOTION_QUERY);
		const onChange = (e) => setReduced(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	return reduced;
}

export default usePrefersReducedMotion;
