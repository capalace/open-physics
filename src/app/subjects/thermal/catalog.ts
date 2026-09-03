import { SUBJECT_SANDBOX_TITLE, validateSubjectDefinition, type SubjectDefinition, type SubjectLabDefinition } from "../subject-experience";

export const THERMAL_LAB_IDS = [
  "particles", "heat-transfer", "thermal-expansion", "phase-change", "gas", "heat-energy", "heat-engine", "entropy",
] as const;

export type ThermalLabId = typeof THERMAL_LAB_IDS[number];

const lab = (definition: SubjectLabDefinition): SubjectLabDefinition => definition;

const termsByLab: Record<ThermalLabId, NonNullable<SubjectLabDefinition["terms"]>> = {
  particles: [
    { name: "절대온도", description: "입자의 열운동 에너지와 직접 연결되는 켈빈 단위의 온도예요." },
    { name: "열운동", description: "물질을 이루는 입자들이 끊임없이 불규칙하게 움직이는 운동이에요." },
    { name: "평균 운동에너지", description: "많은 입자가 가진 운동에너지를 입자 수로 나눈 평균값이에요." },
  ],
  "heat-transfer": [
    { name: "열전도", description: "물질 자체가 이동하지 않아도 입자 사이 상호작용으로 열이 전달되는 현상이에요." },
    { name: "열전도율", description: "재료가 열을 얼마나 잘 전달하는지 나타내는 물질의 성질이에요." },
    { name: "열평형", description: "맞닿은 물체들의 온도가 같아져 더는 알짜 열이 이동하지 않는 상태예요." },
  ],
  "thermal-expansion": [
    { name: "열팽창", description: "물체의 온도가 오를 때 평균 길이나 부피가 커지는 현상이에요." },
    { name: "선팽창계수", description: "물질마다 온도 1도 변화에 길이가 늘어나는 비율이에요." },
    { name: "기준 길이", description: "온도를 바꾸기 전 비교 기준으로 삼는 처음 길이예요." },
  ],
  "phase-change": [
    { name: "잠열", description: "온도 변화 없이 물질의 상태를 바꾸는 데 드나드는 열이에요." },
    { name: "녹는점", description: "주어진 압력에서 고체와 액체가 함께 존재하며 녹고 어는 온도예요." },
    { name: "상태 변화", description: "물질이 고체·액체·기체 사이에서 상태를 바꾸는 현상이에요." },
  ],
  gas: [
    { name: "압력", description: "기체 입자가 벽에 충돌하여 단위 면적에 미치는 힘이에요." },
    { name: "부피", description: "기체 입자가 움직일 수 있는 공간의 크기예요." },
    { name: "이상 기체", description: "입자 자체 부피와 입자 사이 힘을 무시해 간단한 법칙으로 나타낸 기체 모형이에요." },
  ],
  "heat-energy": [
    { name: "비열", description: "물질 1 kg의 온도를 1 K 높이는 데 필요한 열량이에요." },
    { name: "열량", description: "온도 차이 때문에 물체 사이에 이동한 에너지의 양이에요." },
    { name: "온도 변화", description: "나중 온도에서 처음 온도를 뺀 값으로, 받은 열과 질량·비열에 따라 달라져요." },
  ],
  "heat-engine": [
    { name: "열기관", description: "뜨거운 곳에서 받은 열의 일부를 일로 바꾸는 장치예요." },
    { name: "열효율", description: "기관이 받은 열 가운데 유용한 일로 바꾼 비율이에요." },
    { name: "열저장고", description: "열을 주고받아도 온도가 거의 변하지 않는 매우 큰 계예요." },
  ],
  entropy: [
    { name: "엔트로피", description: "에너지가 얼마나 넓고 고르게 퍼질 수 있는지를 나타내는 상태량이에요." },
    { name: "고립계", description: "주변과 물질도 에너지도 주고받지 않는 계예요." },
    { name: "열역학 제2법칙", description: "고립계의 전체 엔트로피는 자연 과정에서 줄어들지 않는다는 법칙이에요." },
  ],
};

export const thermalDefinition: SubjectDefinition = {
  id: "thermal",
  label: "열",
  eyebrow: "열",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
  sandboxDescription: "입자 용기와 열원, 재료, 피스톤, 온도계를 조합해 열의 이동을 만들어요.",
  labs: [
    lab({ id: "particles", title: "온도와 입자", category: "입자", icon: "●", question: "온도를 높이면 용기 속 입자들의 속력 분포는 어떻게 달라질까요?", steps: ["주황색 위아래 조절 핸들을 끌어요.", "차갑게와 뜨겁게를 번갈아 만들어요.", "입자 속력 분포를 서로 비교해요."], observe: "온도계뿐 아니라 입자 사이 간격과 움직이는 속도를 함께 보세요.", controls: ["particle-temperature"], law: { title: "입자의 열운동", description: "절대온도가 높을수록 입자의 평균 운동에너지와 제곱평균제곱근 속력이 커져요.", equation: "Ē = 3kT/2, vᵣₘₛ ∝ √T" }, graph: { kind: "distribution", title: "입자 속력 분포", xLabel: "속력 (상대값)", yLabel: "입자 수 (개)", series: [{ label: "현재 입자", color: "#ef7a45" }] } }),
    lab({ id: "heat-transfer", title: "열 전달", category: "전달", icon: "↝", question: "두 물체를 잇는 재료를 바꾸면 열이 전달되는 빠르기는 어떻게 달라질까요?", steps: ["연결 막대 위 주황색 좌우 조절 핸들을 끌어요.", "단열체와 전도체를 번갈아 골라요.", "양쪽 온도와 열 흐름을 비교해요."], observe: "뜨거운 쪽에서 차가운 쪽으로 이동하는 에너지 알갱이 수를 보세요.", controls: ["material"], law: { title: "열전도", description: "온도 차와 단면적이 클수록, 길이가 짧고 열전도율이 큰 재료일수록 열이 빠르게 전도돼요.", equation: "Q̇ = kAΔT/L" }, graph: { kind: "line", title: "재료별 열 전달량", xLabel: "시간 (s)", yLabel: "누적 열 (kJ)", series: [{ label: "뜨거운 쪽이 잃은 열", color: "#ed6a3a" }, { label: "차가운 쪽이 얻은 열", color: "#3e87d8" }] } }),
    lab({ id: "thermal-expansion", title: "열팽창", category: "전달", icon: "↔", question: "금속 막대의 온도를 올리면 길이는 눈으로 확인할 만큼 얼마나 늘어날까요?", steps: ["주황색 좌우 조절 핸들을 끌어요.", "차갑게와 뜨겁게를 번갈아 만들어요.", "기준선과 늘어난 길이를 비교해요."], observe: "막대를 이루는 입자의 평균 간격이 커지면서 끝점이 기준선 밖으로 이동하는지 보세요.", controls: ["temperature"], law: { title: "고체의 선팽창", description: "길이 변화는 처음 길이, 온도 변화, 물질의 선팽창계수에 비례해요.", equation: "ΔL = αL₀ΔT" }, graph: { kind: "line", title: "온도에 따른 막대의 길이 변화", xLabel: "온도 (°C)", yLabel: "길이 변화 (mm)", series: [{ label: "금속 막대", color: "#e58b37" }] } }),
    lab({ id: "phase-change", title: "상태 변화", category: "물질", icon: "❄", question: "얼음에 계속 열을 주는데도 온도가 멈추는 구간은 언제 나타날까요?", steps: ["주황색 위아래 조절 핸들을 끌어요.", "고체가 액체로 바뀌는 모습을 봐요.", "온도-에너지 그래프의 평평한 곳을 찾아요."], observe: "녹는 동안 들어온 에너지가 온도 대신 액체 비율을 바꾸는지 보세요.", controls: ["added-heat"], law: { title: "잠열", description: "상태가 바뀌는 동안 열은 입자 결합을 푸는 데 쓰여 온도가 일정하게 유지돼요.", equation: "Q = mL" }, graph: { kind: "line", title: "가열 곡선", xLabel: "가한 열 (kJ)", yLabel: "온도 (°C)", series: [{ label: "물질 온도", color: "#7f76d9" }] } }),
    lab({ id: "gas", title: "기체", category: "기체", icon: "▣", question: "온도를 그대로 두고 피스톤을 누르면 기체의 압력은 어떻게 달라질까요?", steps: ["주황빛으로 강조된 피스톤을 직접 끌어요.", "압축과 팽창을 번갈아 봐요.", "입자 충돌과 P-V 경로를 비교해요."], observe: "같은 수의 입자가 좁은 공간의 벽에 더 자주 부딪히는지 보세요.", controls: ["piston"], law: { title: "이상 기체 법칙", description: "입자 수와 온도가 같다면 부피가 줄어들수록 압력이 커져요.", equation: "PV = nRT" }, graph: { kind: "pv", title: "압력-부피 경로", xLabel: "부피 (L)", yLabel: "압력 (kPa)", series: [{ label: "기체 상태", color: "#e58b37" }] } }),
    lab({ id: "heat-energy", title: "열과 에너지", category: "에너지", icon: "♨", question: "같은 열을 주어도 물질의 양이 달라지면 온도 변화는 어떻게 달라질까요?", steps: ["주황색 좌우 조절 핸들을 끌어요.", "적은 양과 많은 양을 번갈아 골라요.", "흡수한 열과 온도 변화를 비교해요."], observe: "입자 수가 많은 물체가 같은 에너지를 나누어 갖는 모습을 보세요.", controls: ["mass"], law: { title: "비열과 열량", description: "같은 물질은 질량이 클수록 같은 열로 올라가는 온도가 작아요.", equation: "Q = mcΔT" }, graph: { kind: "line", title: "질량에 따른 온도 변화", xLabel: "질량 (kg)", yLabel: "온도 변화 (°C)", series: [{ label: "온도 변화", color: "#ef7b3b" }] } }),
    lab({ id: "heat-engine", title: "열기관", category: "기관", icon: "⚙", question: "뜨거운 곳과 차가운 곳의 온도 차가 커지면 꺼낼 수 있는 일은 얼마나 늘까요?", steps: ["주황색 위아래 조절 핸들을 끌어요.", "온도 차를 크고 작게 바꿔요.", "피스톤의 P-V 순환과 효율을 비교해요."], observe: "들어온 열 가운데 일부만 일이 되고 나머지는 차가운 곳으로 가는지 보세요.", controls: ["hot-reservoir"], law: { title: "열기관 효율", description: "이상적인 기관도 받은 열 전부를 일로 바꿀 수 없고 온도 차가 효율의 한계를 정해요.", equation: "ηₘₐₓ = 1 - T꜀/Tₕ" }, graph: { kind: "pv", title: "열기관 P-V 순환", xLabel: "부피 (L)", yLabel: "압력 (kPa)", series: [{ label: "한 순환", color: "#cf5f3f" }] } }),
    lab({ id: "entropy", title: "엔트로피", category: "방향", icon: "⇄", question: "뜨거운 입자와 차가운 입자를 섞으면 에너지의 퍼짐 정도는 어떻게 변할까요?", steps: ["주황빛으로 강조된 칸막이를 직접 끌어요.", "칸막이를 열어 두 입자를 섞어요.", "온도 차와 엔트로피 변화를 비교해요."], observe: "전체 에너지는 유지되면서 입자 속력이 고르게 섞이는 방향을 보세요.", controls: ["mixing-divider"], law: { title: "열역학 제2법칙", description: "고립된 계는 가능한 에너지 배치가 더 많은 방향, 즉 전체 엔트로피가 커지는 방향으로 변해요.", equation: "ΔS전체 ≥ 0" }, graph: { kind: "line", title: "섞임과 엔트로피", xLabel: "섞인 정도 (%)", yLabel: "엔트로피 변화 (J/K)", series: [{ label: "전체 엔트로피", color: "#9069d4" }] } }),
  ].map((definition) => ({ ...definition, terms: termsByLab[definition.id as ThermalLabId] })),
};

validateSubjectDefinition(thermalDefinition, THERMAL_LAB_IDS);

export const thermalLab = (id: ThermalLabId): SubjectLabDefinition =>
  thermalDefinition.labs.find((item) => item.id === id)!;
