export type MotionDirection = "left" | "stop" | "right";

export interface CollisionPrediction {
  readonly a: MotionDirection | null;
  readonly b: MotionDirection | null;
}

export function horizontalMotionDirection(velocityX: number, stopThreshold = 0.15): MotionDirection {
  if (!Number.isFinite(velocityX)) throw new RangeError("Horizontal velocity must be finite.");
  if (!Number.isFinite(stopThreshold) || stopThreshold < 0) throw new RangeError("Stop threshold must be non-negative.");
  if (Math.abs(velocityX) <= stopThreshold) return "stop";
  return velocityX < 0 ? "left" : "right";
}

export function motionDirectionLabel(direction: MotionDirection): string {
  if (direction === "left") return "왼쪽 ←";
  if (direction === "right") return "오른쪽 →";
  return "멈춤";
}

export function collisionPredictionSummary(
  prediction: CollisionPrediction,
  actual: Readonly<{ a: MotionDirection; b: MotionDirection }> | null,
): string {
  if (!prediction.a || !prediction.b) return "두 물체의 충돌 뒤 방향을 먼저 골라 보세요.";
  if (!actual) return "예측을 저장했어요. 이제 충돌 결과를 확인해요.";
  const matches = Number(prediction.a === actual.a) + Number(prediction.b === actual.b);
  if (matches === 2) return "두 물체 모두 예상과 같아요! 운동량 화살표로 이유를 확인해 보세요.";
  if (matches === 1) return "한 물체는 예상과 달라요. 질량과 충돌 전 운동량을 비교해 보세요.";
  return "둘 다 예상과 달라요. 무게를 바꿔 다시 예측해 보면 차이가 더 잘 보여요.";
}
