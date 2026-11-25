const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const experiment = document.querySelector(".experiment");
const runway = document.querySelector(".experiment-runway");
const scrollFinish = document.querySelector(".scroll-finish");
const board = document.querySelector(".scene-board");
const boardDescription = document.querySelector("#board-desc");
const game = document.querySelector("#zadachka");
const progressBar = document.querySelector(".scene-progress");
const sceneInstruction = document.querySelector(".scene-instruction");
const question = game.querySelector("[data-question]");
const success = game.querySelector("[data-success]");
const successHeading = success.querySelector("h3");
const hint = question.querySelector("[data-hint]");
const hintMasha = question.querySelector(".hint-masha");
const choices = [...question.querySelectorAll(".answer")];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const stickyScene = matchMedia(
  "(min-width: 58rem) and (min-height: 42rem) and (prefers-reduced-motion: no-preference)"
);
const pieces = [
  { name: "north-west", center: [284, 135], offset: [-105, -31], angle: -28, scale: .77, enter: 0, settle: [.22, .53] },
  { name: "south-west", center: [287, 265], offset: [-100, 89], angle: 32, scale: .67, enter: .04, settle: [.28, .59] },
  { name: "south-east", center: [401, 266], offset: [106, -34], angle: 31, scale: .71, enter: .08, settle: [.34, .65] },
  { name: "base", center: [345, 375], offset: [15, 65], angle: -12, scale: .84, enter: .12, settle: [.32, .63] }
].map(piece => ({
  ...piece,
  layer: board.querySelector(`[data-piece="${piece.name}"]`)
}));
const slotGuide = board.querySelector(".slot-guide");
const looseGuide = board.querySelector(".loose-guide");
const lastPiece = board.querySelector(".answer-assembly");
const puzzleDescription = boardDescription.textContent;

let frame = 0;
let sceneVisible = false;
let solved = false;

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function easeBetween(start, end, value) {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

function sceneProgress() {
  if (reducedMotion.matches) return 1;

  if (stickyScene.matches && scrollFinish.offsetTop > 0) {
    const distance = header.offsetHeight - runway.getBoundingClientRect().top;
    return clamp(distance / scrollFinish.offsetTop);
  }

  const viewport = window.innerHeight;
  return clamp((viewport * .95 - board.getBoundingClientRect().top) / (viewport * .51));
}

function renderMotion() {
  const progress = sceneProgress();
  const reveal = easeBetween(.65, .91, progress);
  const interactive = !stickyScene.matches || reveal >= .57;
  const lit = solved && progress >= .67;

  for (const { layer, center, offset, angle, scale, enter, settle } of pieces) {
    const arrival = easeBetween(enter, enter + .15, progress);
    const remaining = 1 - easeBetween(...settle, progress);
    const drift = remaining * (1.14 - .14 * arrival);
    const x = offset[0] * drift;
    const y = offset[1] * drift;
    const rotation = angle * remaining;
    const size = 1 - (1 - scale) * remaining;

    layer.style.transformOrigin = `${center[0]}px ${center[1]}px`;
    layer.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${size})`;
    layer.style.opacity = .65 + .35 * arrival;
  }

  progressBar.value = Math.round(progress * 100);
  experiment.style.setProperty("--puzzle-reveal", reveal);
  experiment.dataset.solved = String(lit);
  slotGuide.style.opacity = easeBetween(.23, .65, progress);
  looseGuide.style.opacity = reveal;
  lastPiece.style.opacity = .12 + .88 * reveal;
  game.inert = !interactive;
  sceneInstruction.setAttribute("aria-hidden", String(interactive));
}

function scheduleMotion() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderMotion();
  });
}

function jumpToGame(moveFocus) {
  if (stickyScene.matches) {
    const target = window.scrollY + scrollFinish.getBoundingClientRect().top - header.offsetHeight + 1;
    window.scrollTo({ top: target, behavior: "instant" });
  } else {
    board.scrollIntoView({ block: "start" });
  }

  renderMotion();
  if (moveFocus) game.focus({ preventScroll: true });
}

function setMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
}

menuToggle.addEventListener("click", () => {
  setMenu(menuToggle.getAttribute("aria-expanded") === "false");
});

nav.addEventListener("click", event => {
  const link = event.target.closest("a");
  if (!link || menuToggle.getAttribute("aria-expanded") !== "true") return;

  setMenu(false);
  const target = document.querySelector(link.hash);
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
});

header.addEventListener("keydown", event => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    menuToggle.focus();
  }
});

document.querySelectorAll("[data-play-link]").forEach(link => {
  link.addEventListener("click", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    jumpToGame(true);
  });
});

function clearHint() {
  for (const choice of choices) delete choice.dataset.attempt;
  hint.textContent = "";
  hintMasha.hidden = true;
}

function chooseAnswer(choice) {
  if (solved) return;

  clearHint();
  if (choice.dataset.choice !== "2") {
    choice.dataset.attempt = "true";
    hintMasha.hidden = false;
    hint.textContent = "Посмотри, с какой стороны выемка";
    return;
  }

  solved = true;
  boardDescription.textContent = "Детали образуют целую лампочку. Лампочка светится зелёным.";
  question.hidden = true;
  success.hidden = false;
  renderMotion();
  successHeading.focus({ preventScroll: true });
}

for (const choice of choices) {
  choice.addEventListener("click", () => chooseAnswer(choice));
  choice.disabled = false;
}

success.querySelector("[data-reset]").addEventListener("click", () => {
  solved = false;
  boardDescription.textContent = puzzleDescription;
  success.hidden = true;
  question.hidden = false;
  renderMotion();
  choices[0].focus({ preventScroll: true });
});

const observer = new IntersectionObserver(([entry]) => {
  sceneVisible = entry.isIntersecting;
  if (sceneVisible) scheduleMotion();
}, { rootMargin: "120px 0px" });
observer.observe(runway);

window.addEventListener("scroll", () => {
  if (sceneVisible && !reducedMotion.matches) scheduleMotion();
}, { passive: true });
window.addEventListener("resize", scheduleMotion);
reducedMotion.addEventListener("change", scheduleMotion);
stickyScene.addEventListener("change", scheduleMotion);
window.addEventListener("hashchange", () => {
  if (location.hash === "#zadachka") jumpToGame(false);
});

document.documentElement.classList.add("motion-ready");
if (location.hash === "#zadachka") {
  jumpToGame(false);
} else {
  renderMotion();
}

function storyPosition(steps) {
  const guide = header.offsetHeight + (window.innerHeight - header.offsetHeight) * .46;
  for (let index = 0; index < steps.length; index++) {
    const { top, bottom, height } = steps[index].getBoundingClientRect();
    if (guide <= bottom) return index + clamp((guide - top) / height);
  }
  return steps.length;
}

function moveWorkshopPieces(art, amount) {
  const attempt = easeBetween(.03, .29, amount) * (1 - easeBetween(.37, .60, amount));
  art.style.setProperty("--workshop-motion", easeBetween(.04, .75, amount));
  art.style.setProperty("--workshop-attempt", attempt);
  art.style.setProperty("--workshop-miss", easeBetween(.24, .34, amount));
  art.style.setProperty("--workshop-next", easeBetween(.56, .95, amount));
}

function renderWorkshop(story) {
  if (!stickyScene.matches) {
    story.frames.forEach(art => {
      if (reducedMotion.matches) {
        art.removeAttribute("style");
        return;
      }

      const viewport = window.innerHeight;
      const top = art.getBoundingClientRect().top;
      const amount = clamp((viewport * .94 - top) / (viewport * .31));
      moveWorkshopPieces(art, amount);
    });
    return;
  }

  const position = storyPosition(story.steps);
  story.layers.forEach((layer, index) => {
    const incoming = index === 0 ? 1 : easeBetween(index - .09, index + .16, position);
    const outgoing = index === story.layers.length - 1 ? 1 : 1 - easeBetween(index + .91, index + 1.16, position);
    layer.style.setProperty("--story-opacity", incoming * outgoing);
    moveWorkshopPieces(layer, clamp(position - index));
  });
  markStoryStep(story.steps, position);
}

function renderProcess(story) {
  if (!stickyScene.matches) return;

  const position = storyPosition(story.steps);
  const revealed = easeBetween(.9, 1.23, position);
  story.box.style.setProperty("--story-opacity", 1 - revealed);
  story.box.style.setProperty("--box-offset", `${-22 * revealed}px`);
  story.parts.style.setProperty("--story-opacity", revealed);
  story.parts.style.setProperty("--assembly-progress", easeBetween(1.92, 2.64, position));
  markStoryStep(story.steps, position);
}

function markStoryStep(steps, position) {
  const active = Math.min(steps.length - 1, Math.floor(position));
  steps.forEach((step, index) => step.classList.toggle("is-current", index === active));
}

function setupScrollStories() {
  const workshop = document.querySelector('[data-story="workshop"]');
  const process = document.querySelector('[data-story="process"]');
  const storyData = new Map([
    [workshop, {
      steps: [...workshop.querySelectorAll(".story-step")],
      frames: [...workshop.querySelectorAll(".story-frame")],
      layers: [...workshop.querySelectorAll("[data-workshop-layer]")],
      render: renderWorkshop
    }],
    [process, {
      steps: [...process.querySelectorAll(".story-step")],
      box: process.querySelector("[data-process-box]"),
      parts: process.querySelector("[data-process-pieces]"),
      render: renderProcess
    }]
  ]);

  const nearby = new Set();
  let storyFrame = 0;
  function scheduleStories() {
    if (storyFrame) return;
    storyFrame = requestAnimationFrame(() => {
      storyFrame = 0;
      for (const element of nearby) {
        const story = storyData.get(element);
        story.render(story);
      }
    });
  }

  const storyObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        nearby.add(entry.target);
      } else {
        nearby.delete(entry.target);
      }
    }
    scheduleStories();
  }, { rootMargin: "140px 0px" });

  for (const element of storyData.keys()) storyObserver.observe(element);
  window.addEventListener("scroll", () => {
    if (nearby.size && !reducedMotion.matches) scheduleStories();
  }, { passive: true });
  window.addEventListener("resize", scheduleStories);
  stickyScene.addEventListener("change", scheduleStories);
  reducedMotion.addEventListener("change", scheduleStories);
}

setupScrollStories();
