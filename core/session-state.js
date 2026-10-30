/**
 * 已废弃。
 *
 * 训练状态机（轮次、重试几次、何时给词块、何时结束）现在由后端负责，
 * 见后端仓库 server/dialogue.go 的 decideAction。
 * 前端只按后端返回的 next_action 切换界面，逻辑在 store/session.js。
 *
 * 这个文件保留为空，方便你确认后手动删除：
 *   del core\session-state.js
 */
export {}
