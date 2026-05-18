/**
 * Wrapper para framer-motion que força a inclusão no bundle.
 * O Rolldown tem problemas com a re-export chain do framer-motion v12,
 * resultando em "motion is not defined" no runtime.
 * 
 * Este ficheiro importa diretamente e re-exporta, garantindo que
 * o bundler não tree-shake as exportações necessárias.
 */
export { AnimatePresence, motion } from "framer-motion";
