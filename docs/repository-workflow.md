# 仓库与分支

## 目录职责

| 位置 | 用途 |
| --- | --- |
| `/home/ann/Anncatto` | 本机主要检出，文章与源码维护 |
| `docs/README.md` | 工作流、证据清单与交接索引 |
| `/home/ann/Anncatto_workspace` | 迁移备份、未发布工作快照、原始记录和预览产物 |
| `content/`、`public/`、`src/` | 经过整理、可随对应功能发布的文章、资产和实现 |

原始实验数据、凭据、模型权重、报告导出和未获发布授权的 RP1 源模型保留在工作区。`exports/` 已加入忽略规则。

## 分支职责

| 分支 | 用途 |
| --- | --- |
| `main` / `origin/main` | 日常博客写作、图表和修订直接在此维护；推送触发 Pages 发布 |
| `article/<主题>` | 既有文章分支，合入后清理；日常写作不再新建 |
| `tool/<主题>` | 未完成的交互工具或功能，独立验收 |
| `local/d20-homepage` | 保留原 D20 首页工作，按原约定单独发布 |
| `refs/archive/buck/*` | 从 buck 取回的历史引用；用于核查和恢复 |

日常博客直接在主要检出的 `main` 编写、检查、提交和推送，不另建文章分支或 worktree。用户明确要求草稿或本地预览时，按其要求保留；较大的未完成工具需要隔离时再用独立分支。

多会话修改不同文章时保留各自的未提交和暂存内容，只提交本任务的文件或片段。Git 提交、切换与合并串行执行；共享样式、导航和构建入口先核对正在进行的修改。

提交文章时沿用 `<文章准确标题> YYYY-MM-DD`，日期使用 Asia/Tokyo。发布前完成构建、内部链接检查和相应页面检查；文章编辑与公开发布分别记录状态。

## 网页编辑

- 文章标题下的“在 GitHub 编辑”打开源文件；分章节文章先选择要修改的章节。PPT 顶栏的“编辑”随当前页切换，直接打开该页的源文件。
- 使用 GitHub 自带的登录与文件编辑器。中文位于 `lang="zh-CN"`，英文位于 `lang="en"`，两种语言分别维护；保留 HTML 标签、章节 ID、公式和图片路径。文章标题、摘要与日期在 `content/posts.json` 中维护。
- 在 GitHub 提交到 `main` 后，现有 Pages 工作流自动构建和发布。网页入口直接连接仓库，不增加后台、登录服务或翻译服务。

## 同步

```bash
git fetch origin
git status --short --branch
git switch main
git pull --ff-only origin main
```

先检查未提交内容，保留其他任务的文件与暂存内容；目录被其他会话占用时不擅自切换、stash、reset 或覆盖。当前处于旧文章分支时，核对并合回 `main`，而不是继续增加文章分支。

工作流与来源文档统一维护在主要目录的 `docs/`，通过 Git 随分支保存。分支切换前应完成当前任务的提交或明确交接，避免依靠外部 worktree 维持独有文档。

## 迁移保留

2026-11-19 核对：GitHub 仅有 `main`，没有打开的 PR；公共基线为 `19c9393`。buck 的主要检出落后 7 个提交，其未提交内容以工具与 RP1 工作为主。

- 12 个原分支已读取到本机 `refs/archive/buck/*`。`local/d20-homepage` 有 3 个独有补丁；其余引用已进入主线，或提交与主线补丁等价。
- 原 `article/gr00t2` 与主线提交相同，但工作目录还有 8 项未提交内容，已随迁移快照保留。
- 原主要检出中的 65 项状态记录，以及全部工作流和未跟踪导出，已保存到 `/home/ann/Anncatto_workspace/migration-20261119/buck-unpublished.tar.gz`。
- 本机迁移前的文档另存于同目录 `preexisting-local/`。两台机器的工作流内容相同，已保留本机 `/home/ann` 路径。

旧检出和历史引用作为恢复来源保留。清理分支前，分别检查提交可达性、补丁等价、工作目录和忽略文件，不能只按分支名称或 ahead/behind 判断。

本机当前只以 `origin` 同步 GitHub。历史引用使用 `git for-each-ref refs/archive/buck` 查看，D20 的三个独有补丁另保留在本地 `local/d20-homepage` 分支；所有引用的完整对象备份位于迁移目录 `repository-history.bundle`。

## GR00T 与博客对话同步

2026-11-20：从 buck 的 `article/gr00t2` 取回三个提交，来源末提交为 `560c0a8`，保存在 `refs/archive/buck/20261120/article/gr00t2`。GR00T、OpenWAM 和 SmolVLA 更新已一起合入本机 `main`，纳入本轮 Pages 发布；源机器工作树未改动。页面与检查入口见 [GR00T 来源记录](gr00t2-presentation.md#本机同步)。

博客历史已导入本机 Codex：2 个主对话、18 个关联子会话，包含 334 个 turn 条目和 33,914 个历史 item。既有本机对话保留；原始 rollout 文件按 SHA256 核对，历史文字保留旧路径，当前工作目录映射为 `/home/ann/Anncatto`。旧的远端托管工作树关联留在原始快照中，本机按普通检出使用。

```bash
# 网站文章编辑，包含 GR00T 2
codex -C /home/ann/Anncatto resume 01a14dc6-8029-79a1-8d82-0fea7231537c

# 轻量化工具及相关设计讨论
codex -C /home/ann/Anncatto resume 01a1975a-982b-7991-ba97-ffa199228061
```

私有导出、导入前备份、校验记录和同步脚本保存在 `/home/ann/Anncatto_workspace/codex-blog-sync-20261120/`，不进入 Git。Codex 实际接口已验证两个主对话可列出，历史 turn/item 可分页读取；未迁移登录凭据或配置。后续增量同步先核对相同对话 ID 的分歧，避免用旧库覆盖本机历史。
