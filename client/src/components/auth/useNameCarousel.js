import { useState, useEffect } from "react";

/**
 * Rola periodicamente por uma lista de nomes, devolvendo o nome atual.
 * Começa num índice aleatório para que cada visita comece com um nome diferente.
 *
 * @param {string[]} names - Lista de nomes a rodar.
 * @param {number} [interval=2500] - Milissegundos entre trocas de nome.
 * @returns {{ current: string, index: number }}
 */
export default function useNameCarousel(names, interval = 2500) {
	const [index, setIndex] = useState(() =>
		names.length > 0 ? Math.floor(Math.random() * names.length) : 0
	);

	useEffect(() => {
		if (names.length <= 1) return;
		const timer = setInterval(() => {
			setIndex((i) => (i + 1) % names.length);
		}, interval);
		return () => clearInterval(timer);
	}, [names.length, interval]);

	return { current: names[index], index };
}
