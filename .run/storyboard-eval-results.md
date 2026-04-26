# Storyboard Eval Results

## 本轮验证

- `tsc --noEmit`: 通过
- 本轮真实回跑样本：B、C
- 核心检查点：不再由外部时长牵引；scene 数由内容密度决定；review 不再出现 `normalizedTargetDurationSec / targetDurationSec` 旧口径

## 样本 A

- 状态：本轮未回跑，保留上一轮有效结果
- Project ID: `video_project_1777075910558_fp05cc`
- Review Score: `88`

## 样本 B

- Topic ID: `topic_1776994206533_rhd3ow`
- Script ID: `script_1777073113682_3r0wca`
- Project ID: `video_project_1777081915529_ialdmg`
- Review Score: `93`
- Scene Count: `12`
- Total Duration: `163s`
- Review Issues: `scene 5/6` 的案例临场感偏弱；CTA 与前面的自测框架有轻微概念重叠；结尾收束层级还能再拉开
- Review Notes: 新 review 已不再讨论目标秒数或 `normalizedTargetDurationSec`。整片按内容自然长成 `12` 个 scene，主链路覆盖了三大困惑、根源分析、智能体误区、自测框架、三步路径、避坑提醒和 CTA，说明 scene 数不再被外部时长硬压。

## 样本 C

- Topic ID: `topic_1777034705367_saoi6j`
- Script ID: `script_1777073553275_ujuedz`
- Latest Passing Project ID: `video_project_1777082561087_wbydwi`
- Review Score: `92`
- Scene Count: `15`
- Total Duration: `100s`
- Review Issues: 扣子 `5` 步演示已经完整，但豆包 AI 编程 `4` 步仍偏“结果展示”，缺少豆包 App 内 `AI 编程` 入口级操作画面
- Review Notes: 第一轮回跑曾掉到 `68` 分，暴露出“后半段内容漏讲、脚本外案例脑补、CTA 被中途步骤顶替”的问题。补强 prompt 后，第二轮已把“三个不适用场景”和真实 CTA 补回，scene 数恢复到 `15`，review 也不再出现 `normalizedTargetDurationSec / targetDurationSec` 噪声。

## 结论

- 这轮改动后，`targetDurationSec` 已退化为 scene 汇总摘要，不再是本地先给模型的目标值
- B/C 的最新 review 都不再使用旧的时长目标评审口径
- C 说明当前方向有效，但长教程型样本仍需继续加强“工具入口级操作演示”的 prompt 约束
