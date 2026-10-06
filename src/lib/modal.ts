import type { MouseEvent } from "react";

/**
 * Props pour le fond d'une fenêtre modale : ferme seulement si l'appui ET le relâchement du
 * bouton ont lieu sur le fond lui-même.
 *
 * Avec un simple onClick, sélectionner du texte dans un champ puis relâcher la souris sur le
 * fond (à gauche ou à droite du formulaire) déclenche un « click » sur le fond — ancêtre commun
 * des deux éléments — et ferme la fenêtre en perdant la saisie.
 */
export function backdropClose(onClose: () => void) {
  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.dataset.pressOnBackdrop = String(e.target === e.currentTarget);
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const pressedOnBackdrop = e.currentTarget.dataset.pressOnBackdrop === "true";
      delete e.currentTarget.dataset.pressOnBackdrop;
      if (pressedOnBackdrop && e.target === e.currentTarget) onClose();
    },
  };
}
