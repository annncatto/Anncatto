export type Language = "en" | "zh";
const labels: Record<string, string> = {
  "信息量 / bit": "Information / bit", "事件概率 p": "Event probability p",
  "目标分布 P": "Target P", "预测分布 R": "Prediction R", "类别概率": "Class probability",
  "负向": "Negative", "停止": "Stop", "正向": "Positive",
  "L1 损失": "L1 loss", "示范值": "Target", "绝对误差": "Absolute error",
  "预测增大": "Increase prediction", "预测减小": "Decrease prediction", "动作预测值": "Predicted action",
  "先验 p": "Prior p", "后验 q": "Posterior q", "概率密度": "Probability density", "潜变量 z": "Latent z",
  "观测时刻": "Observation", "融合权重": "Ensemble weights",
  "前向计算": "Forward pass", "图像 I": "Image I", "状态 s": "State s", "输入投影": "Projection",
  "ACT 主干": "ACT backbone", "连续值 â": "Prediction â", "分数 u": "Logits u", "概率 R": "Probability R",
  "示范值 a": "Target a", "示范类别 y": "Target class y", "反向传播": "Backward pass",
  "骨干与投影": "Input networks", "动作头": "Action heads", "损失梯度": "Loss gradients",
  "一次正面": "One head", "连续两次正面": "Two heads", "连续五次正面": "Five heads",
  "三类均匀": "Uniform", "偏向负向": "Favor negative", "匹配目标": "Match target",
  "均值不同": "Different means", "宽度不同": "Different widths", "完全匹配": "Exact match",
  "等权 · 0": "Equal · 0", "轻微偏旧 · 0.01": "Slightly older · 0.01", "明显偏旧 · 0.5": "Older · 0.5",
};
const network: Record<string, string> = {
  "TRAIN · image and demonstration": "训练 · 图像与示范动作",
  "Image + demo": "图像 + 示范", "Posterior q": "后验 q", "ACT(I, z)": "ACT(I, z)",
  "Actions": "动作", "Image": "图像", "Prior p": "先验 p", "Match p to q": "KL 对齐先验与后验",
  "for the same image": "条件为同一张图像", "ROLLOUT · image only": "推理 · 只有图像",
  "or use the prior mean": "也可取先验均值",
};
export function translateLabel(value: string, language: Language): string {
  if (language === "zh") return network[value] ?? value;
  return labels[value] ?? value
    .replace(/^预测 (.*)$/, "Predict $1")
    .replace(/^第 (\d+) 步$/, "Step $1")
    .replace(/^(.*) 的预测$/, "From $1")
    .replace(" · 最旧", " · oldest").replace(" · 最新", " · newest");
}
const descriptions: Record<string, [string, string, string, string]> = {
  information: ["Probability and information", "概率与信息量", "Rarer events carry more information. Presets compare consecutive heads from a fair coin.", "事件越少见，信息量越大。比较公平硬币连续正面的概率与信息量。"],
  entropy: ["Cross-entropy and distribution matching", "交叉熵与分布匹配", "Pale outlined bars show the target; blue bars show predictions. Cross-entropy equals target entropy plus KL divergence.", "浅绿空心柱表示目标，蓝色柱表示预测。交叉熵等于目标熵加 KL 散度。"],
  l1: ["L1 and the direction of improvement", "L1 的调整方向", "The demonstrated action is zero. Green arrows show which direction reduces the absolute prediction error.", "示范动作固定为零，绿色箭头标出减小预测误差的方向。"],
  gaussian: ["Posterior and prior", "后验与先验", "The dashed posterior is fixed. KL is zero when both the mean and standard deviation of the solid prior match it.", "虚线后验固定。实线先验的均值和标准差都与后验相同时，KL 为零。"],
  network: ["Training and rollout", "训练与推理", "Training samples z from posterior q using images and demonstrations. Rollout samples z from the image-conditioned prior p. ACT also receives image features in both paths.", "训练从读取图像与示范的后验 q 采样 z；推理从图像条件先验 p 取 z。两条路径中 ACT 都同时读取图像特征。"],
  temporal: ["Predictions for the same execution time", "对齐同一执行时刻的预测", "The highlighted column selects predictions for time t. Bars below show their normalized ensemble weights, from oldest to newest.", "蓝框选中对 t 时刻的预测，下方条形图按从旧到新显示归一化融合权重。"],
  training: ["Action prediction and backpropagation", "动作预测与反向传播", "Images, state, and z enter ACT. Continuous actions are trained with L1; class logits are trained with cross-entropy. Dashed arrows trace action-loss gradients back through the network.", "图像、状态和 z 输入 ACT，连续动作用 L1、类别分数用交叉熵训练。虚线表示动作损失沿网络反传的梯度。"],
};
export function localizeSVG(svg: string, id: string, language: Language): string {
  const d = descriptions[id];
  return svg.replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (_, a, value, b) => a + translateLabel(value, language) + b)
    .replace(/(<title\b[^>]*>)[\s\S]*?(<\/title>)/, `$1${d[language === "en" ? 0 : 1]}$2`)
    .replace(/(<desc\b[^>]*>)[\s\S]*?(<\/desc>)/, `$1${d[language === "en" ? 2 : 3]}$2`);
}
