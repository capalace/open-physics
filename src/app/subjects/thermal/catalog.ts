import { SUBJECT_SANDBOX_TITLE, validateSubjectDefinition, type SubjectDefinition, type SubjectLabDefinition } from "../subject-experience";

export const THERMAL_LAB_IDS = [
  "particles", "heat-transfer", "phase-change", "gas", "heat-energy", "heat-engine", "entropy",
] as const;

export type ThermalLabId = typeof THERMAL_LAB_IDS[number];

const lab = (definition: SubjectLabDefinition): SubjectLabDefinition => definition;

export const thermalDefinition: SubjectDefinition = {
  id: "thermal",
  label: "열",
  eyebrow: "THERMAL LAB",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
  sandboxDescription: "입자 용기와 열원, 재료, 피스톤, 온도계를 조합해 열의 이동을 만들어요.",
  labs: [
    lab({ id: "particles", title: "온도와 입자", category: "입자", icon: "●", question: "온도를 높이면 용기 속 입자들의 속력 분포는 어떻게 달라질까요?", steps: ["불꽃 손잡이를 잡아 움직여요.", "차갑게와 뜨겁게를 번갈아 만들어요.", "입자 속력 분포를 서로 비교해요."], observe: "온도계뿐 아니라 입자 사이 간격과 움직이는 속도를 함께 보세요.", controls: ["heat-handle"], law: { title: "입자의 열운동", description: "절대온도가 높을수록 입자의 평균 운동에너지와 제곱평균제곱근 속력이 커져요.", equation: "Ē = 3kT/2, vᵣₘₛ ∝ √T" }, graph: { kind: "distribution", title: "입자 속력 분포", xLabel: "속력 (상대값)", yLabel: "입자 수 (개)", series: [{ label: "현재 입자", color: "#ef7a45" }] } }),
    lab({ id: "heat-transfer", title: "열 전달", category: "전달", icon: "↝", question: "두 물체를 잇는 재료를 바꾸면 열이 전달되는 빠르기는 어떻게 달라질까요?", steps: ["가운데 재료 손잡이를 잡아요.", "단열체와 전도체를 번갈아 골라요.", "양쪽 온도와 열 흐름을 비교해요."], observe: "뜨거운 쪽에서 차가운 쪽으로 이동하는 에너지 알갱이 수를 보세요.", controls: ["material"], law: { title: "열전도", description: "온도 차와 단면적이 클수록, 길이가 짧고 열전도율이 큰 재료일수록 열이 빠르게 전도돼요.", equation: "Q̇ = kAΔT/L" }, graph: { kind: "line", title: "재료별 열 전달량", xLabel: "시간 (s)", yLabel: "누적 열 (kJ)", series: [{ label: "뜨거운 쪽이 잃은 열", color: "#ed6a3a" }, { label: "차가운 쪽이 얻은 열", color: "#3e87d8" }] } }),
    lab({ id: "phase-change", title: "상태 변화", category: "물질", icon: "❄", question: "얼음에 계속 열을 주는데도 온도가 멈추는 구간은 언제 나타날까요?", steps: ["열원 손잡이를 오른쪽으로 밀어요.", "고체가 액체로 바뀌는 모습을 봐요.", "온도-에너지 그래프의 평평한 곳을 찾아요."], observe: "녹는 동안 들어온 에너지가 온도 대신 액체 비율을 바꾸는지 보세요.", controls: ["added-heat"], law: { title: "잠열", description: "상태가 바뀌는 동안 열은 입자 결합을 푸는 데 쓰여 온도가 일정하게 유지돼요.", equation: "Q = mL" }, graph: { kind: "line", title: "가열 곡선", xLabel: "가한 열 (kJ)", yLabel: "온도 (°C)", series: [{ label: "물질 온도", color: "#7f76d9" }] } }),
    lab({ id: "gas", title: "기체", category: "기체", icon: "▣", question: "온도를 그대로 두고 피스톤을 누르면 기체의 압력은 어떻게 달라질까요?", steps: ["피스톤 손잡이를 잡아요.", "천천히 눌렀다가 다시 늘려요.", "입자 충돌과 P-V 경로를 비교해요."], observe: "같은 수의 입자가 좁은 공간의 벽에 더 자주 부딪히는지 보세요.", controls: ["piston"], law: { title: "이상 기체 법칙", description: "입자 수와 온도가 같다면 부피가 줄어들수록 압력이 커져요.", equation: "PV = nRT" }, graph: { kind: "pv", title: "압력-부피 경로", xLabel: "부피 (L)", yLabel: "압력 (kPa)", series: [{ label: "기체 상태", color: "#e58b37" }] } }),
    lab({ id: "heat-energy", title: "열과 에너지", category: "에너지", icon: "♨", question: "같은 열을 주어도 물질의 양이 달라지면 온도 변화는 어떻게 달라질까요?", steps: ["물질 양 손잡이를 잡아요.", "적은 양과 많은 양을 번갈아 골라요.", "흡수한 열과 온도 변화를 비교해요."], observe: "입자 수가 많은 물체가 같은 에너지를 나누어 갖는 모습을 보세요.", controls: ["mass"], law: { title: "비열과 열량", description: "같은 물질은 질량이 클수록 같은 열로 올라가는 온도가 작아요.", equation: "Q = mcΔT" }, graph: { kind: "line", title: "질량에 따른 온도 변화", xLabel: "질량 (kg)", yLabel: "온도 변화 (°C)", series: [{ label: "온도 변화", color: "#ef7b3b" }] } }),
    lab({ id: "heat-engine", title: "열기관", category: "기관", icon: "⚙", question: "뜨거운 곳과 차가운 곳의 온도 차가 커지면 꺼낼 수 있는 일은 얼마나 늘까요?", steps: ["뜨거운 저장고 손잡이를 잡아요.", "온도 차를 크고 작게 바꿔요.", "피스톤의 P-V 순환과 효율을 비교해요."], observe: "들어온 열 가운데 일부만 일이 되고 나머지는 차가운 곳으로 가는지 보세요.", controls: ["hot-reservoir"], law: { title: "열기관 효율", description: "이상적인 기관도 받은 열 전부를 일로 바꿀 수 없고 온도 차가 효율의 한계를 정해요.", equation: "ηₘₐₓ = 1 - T꜀/Tₕ" }, graph: { kind: "pv", title: "열기관 P-V 순환", xLabel: "부피 (L)", yLabel: "압력 (kPa)", series: [{ label: "한 순환", color: "#cf5f3f" }] } }),
    lab({ id: "entropy", title: "엔트로피", category: "방향", icon: "⇄", question: "뜨거운 입자와 차가운 입자를 섞으면 에너지의 퍼짐 정도는 어떻게 변할까요?", steps: ["가운데 칸막이 손잡이를 잡아요.", "칸막이를 열어 두 입자를 섞어요.", "온도 차와 엔트로피 변화를 비교해요."], observe: "전체 에너지는 유지되면서 입자 속력이 고르게 섞이는 방향을 보세요.", controls: ["mixing-divider"], law: { title: "열역학 제2법칙", description: "고립된 계는 가능한 에너지 배치가 더 많은 방향, 즉 전체 엔트로피가 커지는 방향으로 변해요.", equation: "ΔS전체 ≥ 0" }, graph: { kind: "line", title: "섞임과 엔트로피", xLabel: "섞인 정도 (%)", yLabel: "엔트로피 변화 (J/K)", series: [{ label: "전체 엔트로피", color: "#9069d4" }] } }),
  ],
};

validateSubjectDefinition(thermalDefinition, THERMAL_LAB_IDS);

export const thermalLab = (id: ThermalLabId): SubjectLabDefinition =>
  thermalDefinition.labs.find((item) => item.id === id)!;
