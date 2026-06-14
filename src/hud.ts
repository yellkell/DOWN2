/*
 * Heads-up display.
 *
 * Two billboarded canvas-texture planes parented to the camera: a compact status
 * strip (score / combo / phase) high in view, and a large centre panel for
 * prompts ("LOOK DOWN — DODGE", "SLIDE!", "GAME OVER"). Canvas textures keep the
 * HUD self-contained and avoid pulling in the spatial-UI toolchain for what is
 * essentially flat text.
 */

import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

interface Panel {
  mesh: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
}

function makePanel(
  widthPx: number,
  heightPx: number,
  worldW: number,
  worldH: number,
): Panel {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  const mesh = new Mesh(
    new PlaneGeometry(worldW, worldH),
    new MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  mesh.renderOrder = 999;
  return { mesh, canvas, ctx, texture };
}

export class Hud {
  private status: Panel;
  private center: Panel;
  private centerVisibleUntil = 0;

  constructor(camera: PerspectiveCamera) {
    // Status strip — top of view, always on during play.
    this.status = makePanel(1024, 192, 1.6, 0.3);
    this.status.mesh.position.set(0, 0.55, -2);
    camera.add(this.status.mesh);

    // Centre prompt — large, fades in for phase calls and end states.
    this.center = makePanel(1024, 768, 1.7, 1.28);
    this.center.mesh.position.set(0, 0.05, -2.2);
    this.center.mesh.visible = false;
    camera.add(this.center.mesh);
  }

  setStatus(score: number, combo: number, phaseLabel: string): void {
    const { ctx, canvas, texture } = this.status;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 24;
    ctx.fillText(score.toString().padStart(6, '0'), 40, 96);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff00ff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(phaseLabel, canvas.width / 2, 96);

    ctx.textAlign = 'right';
    ctx.fillStyle = combo > 1 ? '#ffff00' : '#888888';
    ctx.shadowColor = '#ffaa00';
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.fillText(`x${combo}`, canvas.width - 40, 96);

    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  }

  /** Draw the centre panel. `lines` are [bigTitle, subtitle?, footnote?]. */
  showCenter(
    lines: string[],
    color: string,
    holdSeconds: number,
    now: number,
  ): void {
    const { ctx, canvas, texture, mesh } = this.center;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const [title, sub, foot] = lines;
    ctx.shadowBlur = 30;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = 'bold 130px system-ui, sans-serif';
    ctx.fillText(title ?? '', canvas.width / 2, 250);

    if (sub) {
      ctx.shadowColor = '#00ffff';
      ctx.fillStyle = '#ffffff';
      ctx.font = '56px system-ui, sans-serif';
      // Allow \n-separated subtitle lines.
      const subLines = sub.split('\n');
      subLines.forEach((s, i) =>
        ctx.fillText(s, canvas.width / 2, 430 + i * 70),
      );
    }
    if (foot) {
      ctx.shadowColor = '#ffff00';
      ctx.fillStyle = '#ffdd55';
      ctx.font = 'bold 60px system-ui, sans-serif';
      ctx.fillText(foot, canvas.width / 2, 680);
    }
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
    mesh.visible = true;
    this.centerVisibleUntil = holdSeconds <= 0 ? Infinity : now + holdSeconds;
  }

  hideCenter(): void {
    this.center.mesh.visible = false;
    this.centerVisibleUntil = 0;
  }

  /** Call each frame to auto-hide timed centre prompts. */
  update(now: number): void {
    if (this.center.mesh.visible && now >= this.centerVisibleUntil) {
      this.center.mesh.visible = false;
    }
  }
}
