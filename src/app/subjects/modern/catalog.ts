import { SUBJECT_SANDBOX_TITLE, validateSubjectDefinition, type SubjectDefinition, type SubjectLabDefinition } from "../subject-experience";

export const MODERN_LAB_IDS = ["relativity", "gravity-spacetime", "atoms", "photoelectric", "matter-waves", "quantum", "tunneling", "nuclei", "mass-energy", "semiconductors"] as const;
export type ModernLabId = (typeof MODERN_LAB_IDS)[number];

const labs: readonly SubjectLabDefinition[] = [
  {
    id: "relativity", title: "상대성이론", category: "시공간", icon: "⌚",
    question: "우주선 속도가 빛의 속도에 가까워질수록 두 시계의 시간은 얼마나 달라질까요?",
    steps: ["청록색 속도 손잡이를 잡아요.", "빛의 속도에 가깝게 옮겨요.", "두 시계와 시간 그래프를 비교해요."],
    observe: "지구 시계와 움직이는 우주선 시계가 가리키는 시간이 달라지는지 보세요.",
    terms: [
      { name: "광속 불변", description: "진공에서 빛의 속력은 광원이나 관찰자의 운동과 관계없이 같다는 원리예요." },
      { name: "시간 지연", description: "빠르게 움직이는 시계가 정지한 관찰자의 시계보다 느리게 가는 현상이에요." },
      { name: "로런츠 인자", description: "상대론적 속도에서 시간과 길이의 변화를 계산하는 비율 γ예요." },
    ],
    controls: ["속도 · 빛의 속력을 1로 본 비율 (c)"],
    law: { title: "시간 지연", description: "빠르게 움직이는 시계의 고유 시간은 지구에서 잰 시간보다 적게 흘러요.", equation: "γ = 1/√(1-v²/c²)" },
    graph: { kind: "line", title: "속도에 따른 시간 지연", xLabel: "속도 (c)", yLabel: "로런츠 인자 γ", series: [{ label: "시간 지연", color: "#2dd4bf" }] },
  },
  {
    id: "gravity-spacetime", title: "중력과 시공간", category: "일반 상대성", icon: "⌛",
    question: "중력이 강한 곳의 시계는 멀리 있는 시계와 비교해 얼마나 느리게 갈까요?",
    steps: ["보라색 중력 손잡이를 잡아요.", "좌우로 옮겨 질량이 만드는 중력을 바꿔요.", "휘어진 격자와 두 시계의 속도를 비교해요."],
    observe: "중력이 강해질수록 질량 가까이의 시계가 더 천천히 가고 시공간 격자가 더 크게 휘는지 보세요.",
    terms: [
      { name: "등가 원리", description: "좁은 영역에서는 중력의 효과와 가속 운동의 효과를 구별할 수 없다는 원리예요." },
      { name: "휘어진 시공간", description: "질량과 에너지가 주변의 공간과 시간의 기하를 바꾼 상태예요." },
      { name: "중력 시간 지연", description: "중력이 강한 곳의 시간이 약한 곳보다 느리게 흐르는 현상이에요." },
    ],
    controls: ["중력 세기 · 시공간이 휘어진 정도를 비교하는 모형값"],
    law: { title: "등가 원리와 중력 시간 지연", description: "중력은 시공간을 휘게 하며, 중력이 강한 곳에서는 시간이 더 느리게 흘러요. 화면의 값은 관계를 비교하기 위한 정규화 모형이에요.", equation: "강한 중력 → 느린 시계" },
    graph: { kind: "line", title: "중력 세기와 시계 속도", xLabel: "중력 세기 (상댓값)", yLabel: "가까운 시계 속도 (%)", series: [{ label: "시계 속도", color: "#c084fc" }] },
  },
  {
    id: "atoms", title: "원자", category: "에너지 준위", icon: "≡",
    question: "전자가 다른 에너지 준위로 전이할 때 방출 광자의 에너지는 어떻게 달라질까요?",
    steps: ["보라색 준위 손잡이를 잡아요.", "다른 에너지 선으로 옮겨요.", "전이 화살표와 스펙트럼을 비교해요."],
    observe: "전자는 선 사이를 도는 대신 허용된 에너지 준위에서만 검출된다고 보세요.",
    terms: [
      { name: "에너지 준위", description: "원자 속 전자가 가질 수 있도록 양자화된 불연속적인 에너지 값이에요." },
      { name: "양자화", description: "어떤 물리량이 연속값이 아니라 정해진 값만 가질 수 있는 성질이에요." },
      { name: "선스펙트럼", description: "원자가 특정 에너지의 빛만 방출하거나 흡수해 나타나는 밝고 어두운 선이에요." },
    ],
    controls: ["주양자수 · 수소 원자의 허용 에너지 준위 n"],
    law: { title: "수소 에너지 준위", description: "수소 원자의 에너지는 연속이 아니라 n으로 정해진 값만 가질 수 있어요.", equation: "Eₙ = -13.6 eV/n²" },
    graph: { kind: "spectrum", title: "준위 전이 에너지", xLabel: "주양자수 n", yLabel: "에너지 (eV)", series: [{ label: "허용 준위", color: "#a78bfa" }] },
  },
  {
    id: "photoelectric", title: "광전 효과", category: "광자", icon: "✦",
    question: "빛의 주파수를 문턱보다 높이면 튀어나온 전자의 최대 운동에너지는 어떻게 변할까요?",
    steps: ["노란 광자원 손잡이를 잡아요.", "좌우로 옮겨 주파수를 바꿔요.", "전자 검출과 에너지 그래프를 봐요."],
    observe: "문턱 아래에서는 전자가 나오지 않고 그 위에서만 검출 사건이 생기는지 보세요.",
    terms: [
      { name: "광자", description: "빛의 에너지가 진동수에 따라 정해진 덩어리로 전달될 때의 한 단위예요." },
      { name: "일함수", description: "금속 표면에서 전자 하나를 떼어 내는 데 필요한 최소 에너지예요." },
      { name: "문턱 진동수", description: "광전자가 방출되기 시작하는 가장 낮은 빛의 진동수예요." },
    ],
    controls: ["빛 주파수 · 1초 동안 진동하는 횟수 (PHz)"],
    law: { title: "광전 방정식", description: "광자 에너지가 금속의 일함수를 넘어선 나머지가 전자의 최대 운동에너지가 돼요.", equation: "Kₘₐₓ = hf - φ" },
    graph: { kind: "line", title: "광자 주파수와 전자 에너지", xLabel: "주파수 (PHz)", yLabel: "최대 운동에너지 (eV)", series: [{ label: "광전자", color: "#facc15" }] },
  },
  {
    id: "matter-waves", title: "물질파", category: "파동-입자", icon: "≈",
    question: "입자의 운동량을 크게 하면 검출 확률 무늬의 파장은 어떻게 변할까요?",
    steps: ["파란 운동량 손잡이를 잡아요.", "좌우로 옮겨 운동량을 바꿔요.", "확률 파장과 검출점을 비교해요."],
    observe: "입자는 한 궤적이 아니라 반복 검출로 드러나는 확률 무늬를 만든다고 보세요.",
    terms: [
      { name: "물질파", description: "전자 같은 입자도 운동량에 따른 파장을 가지고 파동처럼 행동하는 성질이에요." },
      { name: "드브로이 파장", description: "입자의 운동량에 반비례하는 물질파의 파장이에요." },
      { name: "파동-입자 이중성", description: "빛과 물질이 실험 조건에 따라 파동과 입자 성질을 모두 보이는 성질이에요." },
    ],
    controls: ["운동량 · 입자의 운동 상태를 나타내는 양 (10⁻²⁴ kg·m/s)"],
    law: { title: "드브로이 파장", description: "입자의 운동량이 커질수록 물질파의 파장은 짧아져요.", equation: "λ = h/p" },
    graph: { kind: "waveform", title: "물질파 확률 무늬", xLabel: "검출 위치 (nm)", yLabel: "검출 확률", series: [{ label: "확률밀도", color: "#60a5fa" }] },
  },
  {
    id: "quantum", title: "양자 물리", category: "확률", icon: "Ψ",
    question: "파동묶음을 더 좁게 준비하면 위치와 운동량의 불확정성은 각각 어떻게 달라질까요?",
    steps: ["분홍색 폭 손잡이를 잡아요.", "좌우로 옮겨 위치 퍼짐을 바꿔요.", "위치 확률분포와 운동량 불확정성을 비교해요."],
    observe: "위치 분포를 좁힐수록 운동량의 불확정성은 커지며, 한 번의 확정 궤적 대신 여러 검출 위치의 분포가 나타나는지 보세요.",
    terms: [
      { name: "파동함수", description: "양자 상태와 각 위치에서의 검출 가능성을 담고 있는 수학적 표현이에요." },
      { name: "확률밀도", description: "파동함수의 절댓값 제곱으로 나타내는 위치별 검출 가능성의 분포예요." },
      { name: "불확정성 원리", description: "위치와 운동량을 동시에 임의의 정밀도로 정할 수 없다는 양자역학의 원리예요." },
    ],
    controls: ["파동묶음 폭 · 위치 확률이 퍼진 정도 σ (nm)"],
    law: { title: "확률밀도와 불확정성", description: "파동함수의 절댓값 제곱은 검출 확률밀도를 나타내며, 위치를 더 정확히 정할수록 운동량은 더 불확실해져요.", equation: "P(x) = |ψ(x)|² · ΔxΔp ≥ ℏ/2" },
    graph: { kind: "distribution", title: "위치 검출 확률분포", xLabel: "위치 (nm)", yLabel: "확률밀도 (1/nm)", series: [{ label: "검출 확률", color: "#f472b6" }] },
  },
  {
    id: "tunneling", title: "양자 터널링", category: "장벽", icon: "▥",
    question: "같은 입자 에너지에서 장벽을 넓히면 반대편 검출 확률은 얼마나 줄어들까요?",
    steps: ["주황색 장벽 끝을 잡아요.", "좌우로 끌어 폭을 바꿔요.", "장벽 뒤 검출과 확률을 비교해요."],
    observe: "에너지가 장벽보다 낮아도 장벽 뒤에서 작은 검출 확률이 남는지 보세요.",
    terms: [
      { name: "양자 터널링", description: "입자가 고전적으로 넘을 수 없는 장벽 반대편에서 검출될 수 있는 현상이에요." },
      { name: "퍼텐셜 장벽", description: "입자가 통과하려면 일정한 에너지가 필요한 공간 영역이에요." },
      { name: "투과 확률", description: "입자를 반복해서 보냈을 때 장벽 반대편에서 검출되는 비율이에요." },
    ],
    controls: ["장벽 폭 · 통과해야 하는 영역의 두께 (nm)"],
    law: { title: "터널링 확률", description: "장벽 안에서 파동함수가 지수적으로 줄어 장벽이 넓을수록 통과 확률이 작아져요.", equation: "T ≈ e⁻²κa" },
    graph: { kind: "line", title: "장벽 폭과 투과 확률", xLabel: "장벽 폭 (nm)", yLabel: "투과 확률", series: [{ label: "투과", color: "#fb923c" }] },
  },
  {
    id: "nuclei", title: "원자핵", category: "붕괴 통계", icon: "✺",
    question: "반감기가 지날 때마다 아직 붕괴하지 않은 핵의 수는 어떤 비율로 줄어들까요?",
    steps: ["초록색 시간 손잡이를 잡아요.", "오른쪽으로 옮겨 시간을 흘려요.", "핵 표본과 붕괴 곡선을 비교해요."],
    observe: "개별 핵의 정확한 붕괴 순간 대신 많은 핵의 남은 개수 통계를 보세요.",
    terms: [
      { name: "방사성 붕괴", description: "불안정한 원자핵이 입자나 에너지를 내보내며 다른 상태로 변하는 현상이에요." },
      { name: "반감기", description: "많은 방사성 핵 가운데 붕괴하지 않은 핵이 절반으로 줄어드는 시간이에요." },
      { name: "붕괴 상수", description: "단위 시간 동안 원자핵이 붕괴할 확률을 나타내는 값이에요." },
    ],
    controls: ["경과 시간 · 핵 표본을 관찰한 시간 (년)"],
    law: { title: "방사성 붕괴", description: "반감기마다 많은 핵 표본의 절반이 통계적으로 남아요.", equation: "N = N₀·2⁻ᵗ⁄ᵀ½" },
    graph: { kind: "line", title: "시간에 따른 남은 원자핵", xLabel: "시간 (년)", yLabel: "남은 핵 (개)", series: [{ label: "미붕괴 핵", color: "#4ade80" }] },
  },
  {
    id: "mass-energy", title: "질량과 에너지", category: "핵에너지", icon: "☀",
    question: "핵반응 전후의 질량 차이가 커지면 방출되는 에너지는 얼마나 커질까요?",
    steps: ["하늘색 질량 결손 손잡이를 잡아요.", "좌우로 옮겨 반응 전후 질량 차이를 바꿔요.", "방출 광자와 에너지 그래프를 비교해요."],
    observe: "아주 작은 질량 결손도 빛의 속력 제곱과 곱해져 큰 결합 에너지로 바뀌는지 보세요.",
    terms: [
      { name: "질량 결손", description: "결합한 원자핵의 질량이 따로 떨어진 핵자들의 질량 합보다 작은 차이예요." },
      { name: "결합 에너지", description: "원자핵을 핵자들로 완전히 떼어 놓는 데 필요한 에너지예요." },
      { name: "핵융합", description: "가벼운 원자핵들이 결합해 더 무거운 핵을 만들며 에너지를 내는 반응이에요." },
    ],
    controls: ["질량 결손 · 핵반응 전후 줄어든 질량 (u)"],
    law: { title: "질량-에너지 등가", description: "핵융합이나 핵분열에서 줄어든 질량은 결합 에너지와 입자의 운동에너지로 방출돼요.", equation: "E = Δmc²" },
    graph: { kind: "line", title: "질량 결손과 방출 에너지", xLabel: "질량 결손 (u)", yLabel: "방출 에너지 (MeV)", series: [{ label: "방출 에너지", color: "#38bdf8" }] },
  },
  {
    id: "semiconductors", title: "반도체", category: "에너지 띠", icon: "▰",
    question: "다이오드에 순방향 전압을 높이면 흐르는 전류는 어떤 모양으로 증가할까요?",
    steps: ["빨간 전압 손잡이를 잡아요.", "좌우로 옮겨 전압을 바꿔요.", "전하 흐름과 전류 곡선을 비교해요."],
    observe: "p-n 접합의 장벽이 낮아지면서 검출되는 전하 흐름이 급격히 늘어나는지 보세요.",
    terms: [
      { name: "에너지띠", description: "고체 속 많은 원자가 모이면서 전자가 가질 수 있는 에너지들이 띠를 이룬 것이에요." },
      { name: "p-n 접합", description: "정공이 많은 p형과 전자가 많은 n형 반도체가 맞닿은 경계예요." },
      { name: "순방향 바이어스", description: "p-n 접합의 장벽을 낮춰 전류가 잘 흐르게 하는 전압 연결 방향이에요." },
    ],
    controls: ["전압 · p-n 접합 양끝의 전위차 (V)"],
    law: { title: "다이오드 전류", description: "순방향 전압이 커지면 접합을 지나는 전류가 지수적으로 증가해요.", equation: "I = Iₛ(eⱽ⁄ⱽᵀ-1)" },
    graph: { kind: "line", title: "다이오드 전압-전류", xLabel: "전압 (V)", yLabel: "전류 (mA)", series: [{ label: "순방향 전류", color: "#fb7185" }] },
  },
];

export const modernDefinition: SubjectDefinition = {
  id: "modern", label: "현대물리", eyebrow: "현대물리",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
  sandboxDescription: "광자원, 금속, 원자, 장벽, 검출기와 핵 표본을 직접 놓아 실험을 구성해요.",
  labs,
};

validateSubjectDefinition(modernDefinition, MODERN_LAB_IDS);
