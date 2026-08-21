"use strict";

const OUTPUT_THRESHOLD = 60;
const STABILITY_THRESHOLD = 80;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  app: document.querySelector("#app"),
  stage: document.querySelector("#flight-stage"),
  rocket: document.querySelector("#rocket"),
  boardingCrew: document.querySelector("#boarding-crew"),
  crewCharacters: [...document.querySelectorAll(".crew-character")],
  explosion: document.querySelector("#explosion"),
  debris: document.querySelector("#debris"),
  celebration: document.querySelector("#celebration"),
  confetti: document.querySelector("#confetti"),
  flightEvent: document.querySelector("#flight-event"),
  eventLabel: document.querySelector("#event-label"),
  eventAltitude: document.querySelector("#event-altitude"),
  altitudeLive: document.querySelector("#altitude-live"),
  panelAltitude: document.querySelector("#panel-altitude"),
  telemetryProgress: document.querySelector("#telemetry-progress"),
  missionStatus: document.querySelector("#mission-status"),
  trajectoryLabel: document.querySelector("#trajectory-label"),
  engineLabel: document.querySelector("#engine-label"),
  setupPanel: document.querySelector("#setup-panel"),
  flightPanel: document.querySelector("#flight-panel"),
  resultPanel: document.querySelector("#result-panel"),
  power: document.querySelector("#power"),
  stability: document.querySelector("#stability"),
  powerValue: document.querySelector("#power-value"),
  stabilityValue: document.querySelector("#stability-value"),
  powerCard: document.querySelector("#power-card"),
  stabilityCard: document.querySelector("#stability-card"),
  thresholdHint: document.querySelector("#threshold-hint"),
  readinessTitle: document.querySelector("#readiness-title"),
  launchButton: document.querySelector("#launch-button"),
  retryButton: document.querySelector("#retry-button"),
  resultIcon: document.querySelector("#result-icon"),
  resultKicker: document.querySelector("#result-kicker"),
  resultTitle: document.querySelector("#result-title"),
  resultMessage: document.querySelector("#result-message"),
  flightTitle: document.querySelector("#flight-title"),
  flightDescription: document.querySelector("#flight-description"),
  resultPower: document.querySelector("#result-power"),
  resultStability: document.querySelector("#result-stability"),
  resultAltitude: document.querySelector("#result-altitude")
};

let animationFrame = 0;
let resultTimer = 0;
let boardingTimer = 0;
let crewProgressTimers = [];
let currentState = "idle";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function formatAltitude(value) {
  return Math.max(0, Math.round(value)).toLocaleString("ja-JP");
}

function updateParameter(input, output, card, threshold) {
  const value = Number(input.value);
  output.textContent = `${value}%`;
  input.style.setProperty("--fill", `${value}%`);
  card.classList.toggle("is-ready", value >= threshold);
  return value;
}

function updateControls() {
  const power = updateParameter(
    elements.power,
    elements.powerValue,
    elements.powerCard,
    OUTPUT_THRESHOLD
  );
  const stability = updateParameter(
    elements.stability,
    elements.stabilityValue,
    elements.stabilityCard,
    STABILITY_THRESHOLD
  );
  const powerSteps = Math.max(0, OUTPUT_THRESHOLD - power);
  const stabilitySteps = Math.max(0, STABILITY_THRESHOLD - stability);
  const ready = powerSteps === 0 && stabilitySteps === 0;

  elements.thresholdHint.classList.toggle("is-ready", ready);
  if (ready) {
    elements.readinessTitle.textContent = "軌道投入の準備完了";
  } else if (powerSteps > 0 && stabilitySteps > 0) {
    elements.readinessTitle.textContent = `出力あと${powerSteps}・安定性あと${stabilitySteps}`;
  } else if (powerSteps > 0) {
    elements.readinessTitle.textContent = `出力強度をあと${powerSteps}ポイント`;
  } else {
    elements.readinessTitle.textContent = `安定性をあと${stabilitySteps}ポイント`;
  }
}

function calculateOutcome(power, stability) {
  const success = power >= OUTPUT_THRESHOLD && stability >= STABILITY_THRESHOLD;

  if (success) {
    return {
      success,
      altitude: Math.round(4200 + power * 38 + stability * 18),
      travel: 1
    };
  }

  const weakest = Math.min(power, stability);
  const average = (power + stability) / 2;
  const travel = clamp(0.25 + average * 0.0032 + weakest * 0.0015, 0.25, 0.7);
  const potentialAltitude = 1200 + power * 62 + stability * 24;

  return {
    success,
    altitude: Math.round(potentialAltitude * travel),
    travel
  };
}

function setPanels(panelName) {
  elements.setupPanel.hidden = panelName !== "setup";
  elements.flightPanel.hidden = panelName !== "flight";
  elements.resultPanel.hidden = panelName !== "result";
}

function setState(state) {
  currentState = state;
  elements.app.dataset.state = state;
}

function setAltitude(value) {
  const formatted = formatAltitude(value);
  elements.altitudeLive.textContent = formatted;
  elements.panelAltitude.textContent = formatted;
}

function clearCrewProgressTimers() {
  crewProgressTimers.forEach((timer) => window.clearTimeout(timer));
  crewProgressTimers = [];
}

function stopBoardingSequence() {
  window.clearTimeout(boardingTimer);
  boardingTimer = 0;
  clearCrewProgressTimers();
  elements.boardingCrew.classList.remove("is-boarding");
}

function prepareCrewBoarding() {
  const stageRect = elements.stage.getBoundingClientRect();
  const rocketRect = elements.rocket.getBoundingClientRect();
  const stageWidth = stageRect.width;
  const startOffsets = [-0.32, -0.18, 0.18, 0.32];
  const delayStep = prefersReducedMotion.matches ? 0.065 : 0.55;

  elements.crewCharacters.forEach((character, index) => {
    const characterRect = character.getBoundingClientRect();
    const startX = stageWidth * startOffsets[index];
    const targetWindowY = rocketRect.top - stageRect.top + rocketRect.height * 0.32;
    const characterCenterY = stageRect.height - stageRect.height * 0.06 - characterRect.height * 0.5;
    const boardY = targetWindowY - characterCenterY;
    const lean = startX < 0 ? 6 : -6;

    character.style.setProperty("--crew-start-x", `${startX.toFixed(1)}px`);
    character.style.setProperty("--crew-mid-x", `${(startX * 0.46).toFixed(1)}px`);
    character.style.setProperty("--crew-board-y", `${boardY.toFixed(1)}px`);
    character.style.setProperty("--crew-delay", `${(index * delayStep).toFixed(3)}s`);
    character.style.setProperty("--crew-lean", `${lean}deg`);
    character.style.setProperty("--crew-lean-back", `${lean * -1}deg`);
  });

  elements.boardingCrew.classList.remove("is-boarding");
  void elements.boardingCrew.offsetWidth;
  elements.boardingCrew.classList.add("is-boarding");

  elements.crewCharacters.forEach((character, index) => {
    const progressDelay = prefersReducedMotion.matches
      ? 15 + index * 65
      : 900 + index * 550;
    const timer = window.setTimeout(() => {
      if (currentState !== "boarding") return;
      elements.trajectoryLabel.textContent = `CREW ${index + 1}/4`;
      elements.telemetryProgress.style.width = `${(index + 1) * 25}%`;
    }, progressDelay);
    crewProgressTimers.push(timer);
  });
}

function createEffectPieces() {
  const debrisColors = ["#ff8a4c", "#ffdd75", "#ff5e66", "#cbd8df", "#7de8ed"];
  const confettiColors = ["#c9f765", "#7de8ed", "#ff8a4c", "#f3f8f5", "#ff6d83"];

  for (let index = 0; index < 18; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--angle", `${index * 20 + (index % 3) * 5}deg`);
    piece.style.setProperty("--distance", `${46 + (index % 5) * 12}px`);
    piece.style.setProperty("--delay", `${(index % 4) * 0.018}s`);
    piece.style.setProperty("--piece-color", debrisColors[index % debrisColors.length]);
    elements.debris.append(piece);
  }

  for (let index = 0; index < 34; index += 1) {
    const piece = document.createElement("i");
    const x = 4 + ((index * 29) % 92);
    const fall = 70 + ((index * 17) % 30);
    const sway = -42 + ((index * 23) % 84);
    piece.style.setProperty("--x", `${x}%`);
    piece.style.setProperty("--fall", `${fall}%`);
    piece.style.setProperty("--sway", `${sway}px`);
    piece.style.setProperty("--rotate", `${220 + (index % 5) * 110}deg`);
    piece.style.setProperty("--duration", `${1.15 + (index % 6) * 0.13}s`);
    piece.style.setProperty("--delay", `${(index % 10) * 0.055}s`);
    piece.style.setProperty("--confetti-color", confettiColors[index % confettiColors.length]);
    elements.confetti.append(piece);
  }
}

function resetEffects() {
  stopBoardingSequence();
  elements.explosion.classList.remove("is-active");
  elements.celebration.classList.remove("is-active");
  elements.celebration.setAttribute("aria-hidden", "true");
  elements.flightEvent.classList.remove("is-visible");
  elements.flightEvent.setAttribute("aria-hidden", "true");
  elements.stage.style.setProperty("--rocket-bottom", "6%");
  elements.stage.style.setProperty("--rocket-drift", "0px");
  elements.stage.style.setProperty("--rocket-tilt", "0deg");
  elements.stage.style.setProperty("--scene-travel", "0px");
  elements.stage.style.setProperty("--explosion-bottom", "45%");
  elements.stage.style.setProperty("--path-height", "0px");
  elements.stage.style.setProperty("--path-angle", "0deg");
  elements.rocket.style.opacity = "1";
  elements.telemetryProgress.style.width = "0%";
}

function updateFlightVisual(travel, altitude, stability, elapsed, routeProgress) {
  const bottom = 6 + travel * 104;
  const diagonalStrength = clamp((STABILITY_THRESHOLD - stability) / 50, 0, 1);
  const stageWidth = elements.stage.clientWidth;
  const stageHeight = elements.stage.clientHeight;
  const diagonalDrift = stageWidth * 0.3 * diagonalStrength * Math.pow(routeProgress, 1.2);
  const flightWobble = Math.sin(elapsed / 130) * (1 + diagonalStrength * 7) * Math.sin(Math.PI * routeProgress);
  const drift = diagonalDrift + flightWobble;
  const tilt = diagonalStrength * 18 * Math.pow(routeProgress, 0.7)
    + Math.sin(elapsed / 105) * diagonalStrength * 3;
  const verticalDistance = travel * stageHeight * 1.04;
  const pathHeight = Math.hypot(verticalDistance, diagonalDrift);
  const pathAngle = verticalDistance > 0
    ? Math.atan2(diagonalDrift, verticalDistance) * (180 / Math.PI)
    : 0;

  elements.stage.style.setProperty("--rocket-bottom", `${bottom}%`);
  elements.stage.style.setProperty("--rocket-drift", `${drift.toFixed(2)}px`);
  elements.stage.style.setProperty("--rocket-tilt", `${tilt.toFixed(2)}deg`);
  elements.stage.style.setProperty("--scene-travel", `${Math.min(130, travel * 130).toFixed(1)}px`);
  elements.stage.style.setProperty("--path-height", `${pathHeight.toFixed(1)}px`);
  elements.stage.style.setProperty("--path-angle", `${pathAngle.toFixed(2)}deg`);
  elements.telemetryProgress.style.width = `${Math.min(100, travel * 100)}%`;
  setAltitude(altitude);

  if (travel > 0.82) {
    elements.rocket.style.opacity = String(clamp(1 - (travel - 0.82) / 0.18, 0, 1));
  }
}

function getChallengeMessage(power, stability) {
  if (power < OUTPUT_THRESHOLD && stability < STABILITY_THRESHOLD) {
    return "空いっぱいにカラフルなスパークが広がりました。出力60%以上・安定性80%以上で軌道到達コースへ進めます。";
  }

  if (power < OUTPUT_THRESHOLD) {
    return "カラフルなスパークを記録しました。出力強度を60%以上にすると軌道到達コースへ進めます。";
  }

  return "カラフルなスパークを記録しました。安定性を80%以上にすると垂直の軌道到達コースへ進めます。";
}

function populateResult(snapshot, outcome) {
  elements.resultPower.textContent = snapshot.power;
  elements.resultStability.textContent = snapshot.stability;
  elements.resultAltitude.textContent = formatAltitude(outcome.altitude);
  elements.resultPanel.classList.toggle("is-challenge", !outcome.success);

  if (outcome.success) {
    elements.resultIcon.textContent = "✓";
    elements.resultKicker.textContent = "MISSION COMPLETE";
    elements.resultTitle.textContent = "打ち上げ成功";
    elements.resultMessage.textContent = "ロケットは安定した軌道へ到達しました。";
  } else {
    elements.resultIcon.textContent = "★";
    elements.resultKicker.textContent = "FLIGHT COMPLETE";
    elements.resultTitle.textContent = "ナイスチャレンジ！";
    elements.resultMessage.textContent = getChallengeMessage(snapshot.power, snapshot.stability);
  }
}

function finishSuccess(snapshot, outcome) {
  setState("success");
  elements.missionStatus.textContent = "SUCCESS";
  elements.trajectoryLabel.textContent = "ORBIT";
  elements.engineLabel.textContent = "CUTOFF";
  elements.eventLabel.textContent = "ORBIT ALTITUDE";
  elements.eventAltitude.textContent = formatAltitude(outcome.altitude);
  elements.celebration.classList.add("is-active");
  elements.celebration.setAttribute("aria-hidden", "false");

  resultTimer = window.setTimeout(() => {
    populateResult(snapshot, outcome);
    setPanels("result");
  }, prefersReducedMotion.matches ? 80 : 700);
}

function finishChallenge(snapshot, outcome, finalTravel) {
  setState("challenge");
  elements.missionStatus.textContent = "SPARK!";
  elements.trajectoryLabel.textContent = "RECORDED";
  elements.engineLabel.textContent = "COMPLETE";
  elements.stage.style.setProperty("--explosion-bottom", `${6 + finalTravel * 104 + 6}%`);
  elements.eventLabel.textContent = "SPARK ALTITUDE";
  elements.eventAltitude.textContent = formatAltitude(outcome.altitude);
  elements.explosion.classList.add("is-active");

  window.setTimeout(() => {
    if (currentState !== "challenge") return;
    elements.flightEvent.classList.add("is-visible");
    elements.flightEvent.setAttribute("aria-hidden", "false");
  }, prefersReducedMotion.matches ? 20 : 260);

  resultTimer = window.setTimeout(() => {
    populateResult(snapshot, outcome);
    setPanels("result");
  }, prefersReducedMotion.matches ? 90 : 850);
}

function startFlight(snapshot, outcome) {
  if (currentState !== "boarding") return;

  const duration = prefersReducedMotion.matches
    ? 350
    : outcome.success
      ? 4300
      : 2350 + outcome.travel * 1500;

  window.clearTimeout(boardingTimer);
  boardingTimer = 0;
  clearCrewProgressTimers();
  elements.boardingCrew.classList.remove("is-boarding");
  setState("launching");
  elements.missionStatus.textContent = "LIFTOFF";
  const followsVerticalCourse = snapshot.stability >= STABILITY_THRESHOLD;
  elements.trajectoryLabel.textContent = followsVerticalCourse ? "VERTICAL" : "DIAGONAL";
  elements.engineLabel.textContent = "BURNING";
  elements.flightTitle.textContent = followsVerticalCourse ? "垂直上昇中" : "斜め上昇中";
  elements.flightDescription.innerHTML = followsVerticalCourse
    ? "軌道到達コースを飛行中です。<br>パラメーターはロックされています。"
    : "ダイナミックな斜め軌道を飛行中です。<br>安定性80%以上で垂直コースが開きます。";
  elements.telemetryProgress.style.width = "0%";

  const startedAt = performance.now();

  function animate(now) {
    const elapsed = now - startedAt;
    const timeProgress = clamp(elapsed / duration, 0, 1);
    const eased = outcome.success ? easeInOutCubic(timeProgress) : easeOutCubic(timeProgress);
    const travel = outcome.success ? eased : outcome.travel * eased;
    const currentAltitude = outcome.altitude * eased;

    updateFlightVisual(travel, currentAltitude, snapshot.stability, elapsed, eased);

    if (timeProgress < 1) {
      animationFrame = window.requestAnimationFrame(animate);
      return;
    }

    setAltitude(outcome.altitude);
    if (outcome.success) {
      finishSuccess(snapshot, outcome);
    } else {
      finishChallenge(snapshot, outcome, travel);
    }
  }

  animationFrame = window.requestAnimationFrame(animate);
}

function launch() {
  if (currentState !== "idle") return;

  const snapshot = {
    power: Number(elements.power.value),
    stability: Number(elements.stability.value)
  };
  const outcome = calculateOutcome(snapshot.power, snapshot.stability);
  const boardingDuration = prefersReducedMotion.matches ? 320 : 2850;

  window.clearTimeout(resultTimer);
  window.cancelAnimationFrame(animationFrame);
  resetEffects();
  setState("boarding");
  setPanels("flight");
  elements.power.disabled = true;
  elements.stability.disabled = true;
  elements.launchButton.disabled = true;
  elements.missionStatus.textContent = "BOARDING";
  elements.trajectoryLabel.textContent = "CREW 0/4";
  elements.engineLabel.textContent = "READY";
  elements.flightTitle.textContent = "クルー搭乗中";
  elements.flightDescription.innerHTML = "赤・青・黄・緑のクルーが順番に乗り込みます。<br>まもなく打ち上げです。";
  elements.flightEvent.classList.remove("is-visible");
  elements.explosion.classList.remove("is-active");
  elements.celebration.classList.remove("is-active");
  elements.rocket.style.opacity = "1";
  elements.telemetryProgress.style.width = "0%";
  setAltitude(0);
  prepareCrewBoarding();

  boardingTimer = window.setTimeout(() => {
    startFlight(snapshot, outcome);
  }, boardingDuration);
}

function resetMission() {
  window.cancelAnimationFrame(animationFrame);
  window.clearTimeout(resultTimer);
  stopBoardingSequence();
  setState("idle");
  setPanels("setup");
  resetEffects();
  elements.power.disabled = false;
  elements.stability.disabled = false;
  elements.launchButton.disabled = false;
  elements.missionStatus.textContent = "STANDBY";
  elements.trajectoryLabel.textContent = "LOCKED";
  elements.engineLabel.textContent = "IDLE";
  setAltitude(0);
  updateControls();
  elements.launchButton.focus({ preventScroll: true });
}

elements.power.addEventListener("input", updateControls);
elements.stability.addEventListener("input", updateControls);
elements.launchButton.addEventListener("click", launch);
elements.retryButton.addEventListener("click", resetMission);

createEffectPieces();
updateControls();
setAltitude(0);
