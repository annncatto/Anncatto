import { language, onLanguageChange, setLanguage } from './language.js';

const requested = new URLSearchParams(location.search).get('lang');
if (requested === 'en' || requested === 'zh') setLanguage(requested);

// 1. Slide 4: Exact Theorem 1 vs Theorem 2 step-count variance explorer.
// Under constant unit sensitivity (Phi_i = I, ||J^theta Sigma^{1/2}||_F = sigma_0):
//   BayesDiff (C_i = 0): tr P_T = T * (dt * sigma_0)^2 = (1 / T) * sigma_0^2.
//   CoMP (carries C_i):  tr P_T = (T * dt * sigma_0)^2 = 1.00 * sigma_0^2.
interface DecayPoint {
  t: number;
  markerX: number;
  empNoteEn: string;
  empNoteZh: string;
}

const DECAY_POINTS: DecayPoint[] = [
  { t: 10, markerX: 1180, empNoteEn: 'Coarse grid (default in π0.5 / SmolVLA): collapse is already 10× on constant fields, though partly masked at small T.', empNoteZh: '粗网格（π0.5 / SmolVLA 默认步数）：常数场已缩小 10 倍，但步数少时坍缩较隐蔽。' },
  { t: 25, markerX: 1278.5, empNoteEn: 'Refining from 10 → 25 shrinks BayesDiff by 2.5×; on LIBERO-10 (Table 6), BayesDiff fine-tuning gain drops from +2.7 to +0.5 pp.', empNoteZh: '从 10 加密到 25 步，BayesDiff 再缩 2.5 倍；LIBERO-10（表 6）上其微调增益从 +2.7 跌至 +0.5 pp。' },
  { t: 50, markerX: 1353, empNoteEn: 'Robomimic default grid: BayesDiff recovers only 6%–23% of variance (Fig. 2) and turns negative (−2.9 pp) on LIBERO-10 selection.', empNoteZh: 'robomimic 默认网格：BayesDiff 仅恢复 6%–23% 方差（图 2），LIBERO-10 选数增益跌至 −2.9 pp。' },
  { t: 100, markerX: 1427.5, empNoteEn: 'Fig. 1(a–c) slice: BayesDiff returns tr Pₜ = 4.0×10⁻⁴ (1/46 of reference 1.8×10⁻²); CoMP-EKF recovers 99% and CoMP-UKF 100%.', empNoteZh: '图 1(a–c) 对应切片：BayesDiff 返回 4.0×10⁻⁴（仅参考值 1.8×10⁻² 的 1/46）；CoMP-EKF 恢复 99%、UKF 恢复 100%。' },
  { t: 200, markerX: 1502, empNoteEn: 'Doubling T halves BayesDiff again while ODE integration error shrinks; ranking accuracy on robomimic drops to 37% (Fig. 7).', empNoteZh: '步数再翻倍，积分更准但 BayesDiff 方差再减半；robomimic 排序准确率跌至 37%（图 7）。' },
  { t: 400, markerX: 1577, empNoteEn: 'Finest grid: BayesDiff is 400× smaller on constant fields (ranking accuracy falls to 23% on Fig. 7), while CoMP stays invariant at O(1).', empNoteZh: '最细网格：常数场下缩为 1/400（图 7 高不确定样本排序仅 23% 正确），CoMP 保持 O(1) 稳定。' },
];

const decayBox = document.querySelector<HTMLElement>('[data-comp-decay]');
if (decayBox) {
  let activeT = 100;
  const pills = [...decayBox.querySelectorAll<HTMLButtonElement>('[data-decay-t]')];
  const bdFill = decayBox.querySelector<HTMLElement>('[data-decay-bd-fill]');
  const bdVal = decayBox.querySelector<HTMLElement>('[data-decay-bd-val]');
  const compFill = decayBox.querySelector<HTMLElement>('[data-decay-comp-fill]');
  const compVal = decayBox.querySelector<HTMLElement>('[data-decay-comp-val]');
  const summary = decayBox.querySelector<HTMLElement>('[data-decay-summary]');
  const marker = document.querySelector<SVGLineElement>('[data-decay-marker]');

  const updateDecay = () => {
    const pt = DECAY_POINTS.find(p => p.t === activeT) || DECAY_POINTS[3];
    for (const b of pills) b.setAttribute('aria-pressed', String(Number(b.dataset.decayT) === activeT));
    const ratioPct = 100 / pt.t;
    const barPct = Math.max(1.2, Math.min(100, ratioPct * 4)); // scale 10% -> 40% visual span while preserving monotone halving
    if (bdFill) bdFill.style.width = `${barPct.toFixed(1)}%`;
    if (compFill) compFill.style.width = '100%';
    if (bdVal) bdVal.textContent = `1 / ${pt.t} (${ratioPct >= 1 ? ratioPct.toFixed(1) : ratioPct.toFixed(2)}%)`;
    if (compVal) compVal.textContent = language === 'zh' ? '1.00（与 T 无关）' : '1.00 (O(1))';
    if (summary) {
      const dtStr = (1 / pt.t).toFixed(pt.t >= 200 ? 4 : 3);
      summary.textContent = language === 'zh'
        ? `T = ${pt.t}（Δt = ${dtStr}）：${pt.empNoteZh}`
        : `T = ${pt.t} (Δt = ${dtStr}): ${pt.empNoteEn}`;
    }
    if (marker) {
      marker.setAttribute('x1', String(pt.markerX));
      marker.setAttribute('x2', String(pt.markerX));
    }
  };

  for (const b of pills) {
    b.addEventListener('click', () => {
      activeT = Number(b.dataset.decayT);
      updateDecay();
    });
  }
  onLanguageChange(updateDecay);
  updateDecay();
}

// 2. Slide 6: CoMP-EKF vs CoMP-UKF mechanism inspector
const modeBox = document.querySelector<HTMLElement>('[data-comp-mode]');
if (modeBox) {
  let activeMode: 'ekf' | 'ukf' = 'ukf';
  const buttons = [...modeBox.querySelectorAll<HTMLButtonElement>('[data-mode-choice]')];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-mode-panel]')];
  const readout = modeBox.querySelector<HTMLElement>('[data-mode-readout]');

  const updateMode = () => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.modeChoice === activeMode));
    for (const c of cards) c.setAttribute('data-active', String(c.dataset.modePanel === activeMode));
    if (readout) {
      readout.textContent = activeMode === 'ekf'
        ? (language === 'zh'
          ? 'CoMP-EKF：在均值轨迹 mᵢ 处反向求精确状态雅可比 Jᵢˣ（每欧拉步 D 次反传）。在 2D 与 robomimic 校准精确，但在高维非线性策略上累积线性化误差（LIBERO-90 TWA 0.575；SmolVLA 10.98 s/步）。'
          : 'CoMP-EKF: exact state Jacobian Jᵢˣ via D backward passes at mᵢ per Euler step. Matches reference on 2D/robomimic, but accumulates linearization error on complex policies (LIBERO-90 TWA 0.575; SmolVLA 10.98 s/decision).')
        : (language === 'zh'
          ? 'CoMP-UKF：以 2D+1 个确定性 sigma 点单批前向穿过非线性欧拉映射 hᵢ，保留二阶曲率 Σᵢʸʸ 并反解仿射代理 Aᵢ。LIBERO-90 全面第一（TWA 0.643 / Acc 0.794 / DT 0.474），SmolVLA 仅需 3.38 s（快于 EKF 3.2 倍）。'
          : 'CoMP-UKF: batches 2D+1 deterministic sigma points through nonlinear hᵢ, keeping curvature Σᵢʸʸ and least-squares surrogate Aᵢ. Leads all LIBERO-90 metrics (TWA 0.643 / Acc 0.794 / DT 0.474) and runs 3.2× faster than EKF on SmolVLA (3.38 s).');
    }
  };

  for (const b of buttons) {
    b.addEventListener('click', () => {
      activeMode = b.dataset.modeChoice === 'ekf' ? 'ekf' : 'ukf';
      updateMode();
    });
  }
  onLanguageChange(updateMode);
  updateMode();
}
