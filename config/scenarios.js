/* ============================================================
 * 情境展示配置
 *
 * 情境的内容（名称、目标、每一轮的问题、词块、目标句、任务卡模板）
 * 全部由后端 config/scenarios.json 提供，前端不再保存一份。
 *
 * 这里只放后端没有、但儿童端界面需要的「怎么显示」：
 *   emoji       图片没到位时的兜底视觉
 *   themeColor  卡片底色
 *   cover       本地场景图路径（后端只返回 image 文件名，不提供图片服务）
 *   sceneDesc   给孩子看的一句话场景说明（后端的 goal 是写给家长的，偏书面）
 *   options     点选作答时的候选句。语音识别接好之前，孩子靠点这些来回答。
 *               每轮至少放一句能被后端判为「有效」的说法。
 *
 * key 必须和后端情境 id 一致。后端新增情境但这里没配时，
 * 会用 DEFAULT_DISPLAY 兜底，界面不会坏。
 * ============================================================ */

export const SCENARIO_DISPLAY = {
  build_blocks: {
    emoji: '🧱',
    themeColor: '#f5cd5c',
    cover: '/static/scenarios/build_blocks.png',
    sceneDesc: '小朋友们在搭积木，邀请你一起来玩。',
    options: {
      1: ['好啊，我想和你们一起玩积木。', '我可以加入吗？', '谢谢，我想先自己玩一会儿。'],
      2: ['我想搭一个城堡。', '我想搭房子。', '我想搭小车。'],
      3: ['我想再来一次。', '不想了，谢谢。']
    }
  },
  outdoor_needs: {
    emoji: '🌤️',
    themeColor: '#b9d94a',
    cover: '/static/scenarios/outdoor_needs.png',
    sceneDesc: '在外面玩了好久，有点累了，也有点渴。',
    options: {
      1: ['我想喝水。', '我想休息一下。', '我想去厕所。'],
      2: ['我想喝水。', '我想休息一下。', '我想去厕所。'],
      3: ['我想休息一下。', '我想喝水。', '我想去厕所。']
    }
  }
}

export const DEFAULT_DISPLAY = {
  emoji: '💬',
  themeColor: '#3d7edb',
  cover: '',
  sceneDesc: '',
  options: {}
}

/** 取某个情境的展示配置 */
export function getDisplay(scenarioId) {
  return SCENARIO_DISPLAY[scenarioId] || DEFAULT_DISPLAY
}

/**
 * 某一轮的点选候选句。
 * 本地没配时退回后端给的目标句，至少保证有一个可选项。
 */
export function getOptions(scenarioId, round, fallbackSentence) {
  const list = getDisplay(scenarioId).options[round]
  if (list && list.length) return list
  return fallbackSentence ? [fallbackSentence] : []
}
