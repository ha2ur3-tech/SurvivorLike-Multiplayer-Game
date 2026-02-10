import Phaser from "phaser";
import { COLORS } from "../constants";

export function makeLabel(scene: Phaser.Scene, x: number, y: number, text: string, fontSize = 28) {
  return scene.add
    .text(x, y, text, {
      fontFamily: "Arial",
      fontSize: `${fontSize}px`,
      color: `#${COLORS.text.toString(16).padStart(6, "0")}`
    })
    .setOrigin(0.5, 0.5);
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onClick: () => void
) {
  const container = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, COLORS.accent, 0.9).setStrokeStyle(2, 0xffffff, 0.25);
  const label = makeLabel(scene, 0, 0, text, 30);
  container.add([bg, label]);
  container.setSize(w, h);
  container.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  container.on("pointerup", () => onClick());
  container.on("pointerover", () => bg.setFillStyle(COLORS.accent, 1));
  container.on("pointerout", () => bg.setFillStyle(COLORS.accent, 0.9));
  return { container, bg, label };
}

export function makePanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.85) {
  return scene.add.rectangle(x, y, w, h, COLORS.panel, alpha).setStrokeStyle(2, 0xffffff, 0.12);
}

