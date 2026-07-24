// Pure goal-line adjudication for the autonomous hockey broadcast.
//
// Crossing the line inside the mouth is terminal and always wins. A goalie may
// gather a slow puck only while it is still on or in front of the line. Keeping
// this decision outside the renderer makes the edge directly regression-testable.

export const HOCKEY_GOAL_LINE_VERSION = '1.0.0';

export const HOCKEY_GOAL_LINE_DECISION = Object.freeze({
  LIVE: 'LIVE',
  CREASE_COVER: 'CREASE_COVER',
  GOAL: 'GOAL',
});

const finite = value => value !== null && value !== ''
  && Number.isFinite(Number(value));

export function decideHockeyGoalLine({
  side,
  x,
  previousX,
  z,
  y,
  velocityX,
  goalLine,
  netWidth,
  goalieZ = null,
  saveChecked = false,
  coverDepth = 0.65,
  coverWidth = 1.65,
  coverSpeed = 9,
  crossbarHeight = 1.1,
} = {}) {
  const values = [side, x, previousX, z, y, velocityX, goalLine, netWidth];
  if (!values.every(finite) || Math.abs(Number(side)) !== 1) {
    return HOCKEY_GOAL_LINE_DECISION.LIVE;
  }

  const direction = Number(side);
  const current = direction * Number(x);
  const previous = direction * Number(previousX);
  const line = Number(goalLine);
  const mouth = Math.abs(Number(z)) < Number(netWidth) / 2
    && Number(y) < Number(crossbarHeight);

  if (mouth && current > line && previous <= line) {
    return HOCKEY_GOAL_LINE_DECISION.GOAL;
  }

  const goalieCanCover = !saveChecked
    && finite(goalieZ)
    && mouth
    && current >= line - Number(coverDepth)
    && current <= line
    && Math.abs(Number(velocityX)) <= Number(coverSpeed)
    && Math.abs(Number(z) - Number(goalieZ)) < Number(coverWidth);

  return goalieCanCover
    ? HOCKEY_GOAL_LINE_DECISION.CREASE_COVER
    : HOCKEY_GOAL_LINE_DECISION.LIVE;
}
