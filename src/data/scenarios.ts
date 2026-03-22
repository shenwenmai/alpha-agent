import type { ConflictScenario } from '../types/room';
import { EXPANDED_SCENARIOS } from './scenariosExpanded';

const BASE_SCENARIOS: ConflictScenario[] = [
  // ──────────────────────────────────────────
  // 场景1：百家乐打缆法 — 阿强 vs 概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_bac_cable_001',
    topic: '百家乐打缆法到底能不能赢？',
    characters: ['aqiang', 'gailv'],
    type: '对峙',
    triggerKeywords: ['打缆', '缆法', '楼梯缆', '马丁', '翻倍', '追损', '倍投'],
    userEmotionMatch: ['好奇', '不服', '求证'],
    openingLines: {
      aqiang: '缆法我用了五年了 关键是要会止损 不是无脑追 你们这些没赌过的人懂什么',
      gailv: '任何缆法的长期期望值都是负的，这不是经验问题，是数学。马丁策略在有限赌本下破产概率趋近100%',
    },
    escalation: [
      { characterId: 'aqiang', line: '你赌过吗？纸上谈兵谁不会 老子靠缆法赢过不知道多少次', emotion: '激怒' },
      { characterId: 'gailv', line: '我不需要赌，我只需要算。你赌了五年，给我看看你的总盈亏呗？', emotion: '冷嘲' },
      { characterId: 'aqiang', line: '老子赢的时候你在哪！那时候你还在算你的破概率呢', emotion: '吹牛' },
      { characterId: 'gailv', line: '你只记得赢的时候，输的时候你的大脑自动帮你过滤了。心理学上这叫选择性记忆', emotion: '揭穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '缆法的核心问题不在于止损点设在哪，而在于每一手的期望值就是负的。不管你怎么组合负期望值的赌注，总期望值还是负的。阿强说的短期赢是真的——方差允许短期偏离，但长期回归均值是铁律',
      compromise: '阿强承认长期确实亏，但坚持短期能用来控制节奏',
    },
    provocations: {
      user_agrees_aqiang: '概率哥冷笑：又一个被经验骗的。你知道赌场最喜欢什么样的赌客吗？就是觉得自己找到了"方法"的那种',
      user_agrees_gailv: '阿强急了：你们这些键盘侠 自己不赌站着说话不腰疼 有本事你去赌桌上算你的概率啊',
      user_neutral: '概率哥叹气：数据摆在这儿，信不信由你。百家乐庄家优势1.06%，缆法改变不了这个底层赔率',
    },
  },

  // ──────────────────────────────────────────
  // 场景2：赌场灰控 — 阿强+概率哥+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_grey_control_001',
    topic: '赌场灰控到底存不存在？',
    characters: ['aqiang', 'gailv', 'junshi'],
    type: '混战',
    triggerKeywords: ['灰控', '控牌', '作弊', '洗牌机', '出千', '控路', '杀猪', '杀大'],
    userEmotionMatch: ['怀疑', '愤怒', '好奇', '不信'],
    openingLines: {
      aqiang: '灰控？你以为赌场是白莲花啊？我跟你说 赢多了它绝对控你 我亲身经历过',
      gailv: '所谓灰控大部分是赌徒的被害妄想。赌场根本不需要作弊——数学优势已经保证它赢了',
      junshi: '两边都有对的地方。线下实体赌场基本不需要灰控，数学优势足够。但线上网赌平台，灰控是真实存在的产业链',
    },
    escalation: [
      { characterId: 'aqiang', line: '我他妈亲眼看到洗牌机换了我就开始输 你跟我说这是巧合？', emotion: '愤怒' },
      { characterId: 'gailv', line: '你"看到"的不是证据，是确认偏差。你赢的时候不会注意洗牌机换没换', emotion: '纠正' },
      { characterId: 'aqiang', line: '那你解释一下 为什么我赢到五万的时候系统就不让我提现了？', emotion: '质问' },
      { characterId: 'gailv', line: '等等，你说的是线上？那完全是另一回事了。网赌平台确实有灰控机制', emotion: '让步' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '关键区分：实体赌场靠数学优势赚钱，不需要作弊。但网赌平台是完全不同的生意——它们可以控制RNG，调整中奖概率，杀大赔小。所以问题不是"灰控存不存在"，而是"你在哪赌"',
    },
    provocations: {
      user_agrees_aqiang: '概率哥承认：线上的话你说得对，我刚才说的是实体赌场。网赌那就是纯骗',
      user_agrees_gailv: '阿强不服：你去网赌试试 赢了钱你能提出来算我输',
      user_neutral: '军师补充：不管灰控存不存在，结论都一样——赌场在结构上就是赢你的。纠结灰控不如纠结怎么保护自己',
    },
  },

  // ──────────────────────────────────────────
  // 场景3：经验vs数据 — 阿强 vs 概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_exp_vs_data_001',
    topic: '赌博到底该靠经验还是靠数据？',
    characters: ['aqiang', 'gailv'],
    type: '对峙',
    triggerKeywords: ['经验', '直觉', '手感', '感觉', '数据', '理论', '实战', '纸上谈兵'],
    userEmotionMatch: ['好奇', '选边站', '中立'],
    openingLines: {
      aqiang: '赌博这东西 你得上桌才知道 看再多书也没用 实战经验比什么都重要',
      gailv: '经验在随机事件面前一文不值。你的"经验"只是幸存者偏差+选择性记忆的产物',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你来赌啊 带着你的数据来 看你能赢几把', emotion: '挑衅' },
      { characterId: 'gailv', line: '我为什么要赌？我已经知道结果了——负期望值。你赌十年证明的恰好是我的结论', emotion: '嘲讽' },
      { characterId: 'aqiang', line: '你知道个屁！你连牌都没摸过 跟我谈什么赌博', emotion: '暴怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '经验在赌博中的作用：它能帮你读牌桌氛围、控制情绪节奏，但改变不了底层赔率。数据告诉你"长期必输"是事实，经验告诉你"怎么输少一点"也是事实。两者不矛盾，矛盾的是阿强用经验来否认数学',
    },
  },

  // ──────────────────────────────────────────
  // 场景4：老虎机RTP — 概率哥+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_slot_rtp_001',
    topic: '老虎机RTP96%是什么意思？真的能赢吗？',
    characters: ['gailv', 'junshi'],
    type: '对峙',
    triggerKeywords: ['老虎机', 'RTP', '吃分', '吐分', '返奖率', '中奖', '权重', '累积奖池', 'jackpot'],
    userEmotionMatch: ['好奇', '疑惑', '求知'],
    openingLines: {
      gailv: 'RTP 96%的意思是：你每投100块，长期平均只能拿回96块。注意是"长期平均"，不是"每次"',
      junshi: '概率哥说的没错，但更关键的是：这个96%是在数百万次旋转后的理论值。你一个晚上可能只转几百次，方差会让你的实际体验跟96%完全不同',
    },
    escalation: [
      { characterId: 'gailv', line: '而且不同符号的权重完全不同。看起来差一个就中大奖？那个"差一个"是故意设计的，叫near-miss效应', emotion: '科普' },
      { characterId: 'junshi', line: '补充一点：现代老虎机的RNG（随机数生成器）在你按下按钮的瞬间就决定了结果。转轮动画只是表演', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '两人达成共识：RTP是长期统计指标，短期体验完全由方差决定。用户不应该把RTP当成"能赢"的证据',
    },
    provocations: {
      user_neutral: '概率哥总结：简单说——RTP96%不是说你能赢4%，是说赌场每次从你口袋里掏走4%。玩得越久，亏得越精确',
    },
  },

  // ──────────────────────────────────────────
  // 场景5：职业赌客 — 全员圆桌
  // ──────────────────────────────────────────
  {
    id: 'conflict_pro_gambler_001',
    topic: '职业赌客到底存不存在？',
    characters: ['aqiang', 'gailv', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['职业赌客', '职业', '算牌', '优势玩家', 'AP', '套利', '以赌为生', '赢钱为生'],
    userEmotionMatch: ['好奇', '羡慕', '质疑'],
    openingLines: {
      aqiang: '职业赌客肯定有啊 我认识一个哥们 就靠赌吃饭 活得滋润得很',
      gailv: '真正意义上的职业赌客存在，但不是你想的那种。算牌客、体育博彩套利者——这些人本质上是在做量化交易，不是在"赌"',
      junshi: '职业赌客存在，但存活率极低。能长期盈利的人，干的事跟普通赌客完全不同——他们在找赌场的定价错误，不是在跟赌场对赌',
    },
    escalation: [
      { characterId: 'aqiang', line: '你看 军师都说有 我那哥们就是靠百家乐赢的', emotion: '得意' },
      { characterId: 'gailv', line: '靠百家乐？百家乐没有任何可利用的优势。你那哥们要么在吹牛，要么只是暂时运气好', emotion: '反驳' },
      { characterId: 'aqiang', line: '人家开着宝马你开着什么？少在这酸', emotion: '攻击' },
      { characterId: 'gailv', line: '我见过太多"开宝马"的赌客了。三年后你再看看他在开什么', emotion: '冷笑' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '总结：职业赌客存在但有严格条件——①只在有数学优势的场景下注（如21点算牌、体育套利）②严格的资金管理③当赌场发现你时随时被ban。靠百家乐做职业？数学上不成立。阿强那个哥们，要么是套利型的真职业，要么只是还没到回归均值的时候',
    },
    provocations: {
      user_agrees_aqiang: '概率哥摇头：你要是相信靠百家乐能当职业赌客，那我建议你先去查一下"幸存者偏差"这个词',
      user_agrees_gailv: '阿强不爽：行行行 你们说的都对 反正在你们嘴里就是不可能赢 那赌场怎么还天天有人赢着走？',
    },
  },

  // ──────────────────────────────────────────
  // 场景6：赌场内幕 — 阿杰 vs 小甜
  // ──────────────────────────────────────────
  {
    id: 'conflict_casino_insider_001',
    topic: '赌场/网赌平台到底有没有猫腻？',
    characters: ['ajie', 'xiaotian', 'junshi'],
    type: '混战',
    triggerKeywords: ['赌场内幕', '猫腻', '平台', '后台', '正规', '牌照', '控制', '暗箱'],
    userEmotionMatch: ['怀疑', '好奇', '愤怒'],
    openingLines: {
      ajie: '呵呵，我在赌场干了三年...你们看到的和真实发生的，完全是两回事',
      xiaotian: '亲，我们平台是有正规牌照的哦，所有游戏都经过第三方认证，绝对公平~',
    },
    escalation: [
      { characterId: 'ajie', line: '第三方认证？呵呵 你知道那个认证是怎么拿到的吗...算了我不说了', emotion: '暗示' },
      { characterId: 'xiaotian', line: '每个行业都有个别不合规的，但不能因此否定整个行业呀~ 我们的客户满意度98%呢', emotion: '转移' },
      { characterId: 'ajie', line: '98%满意度？那剩下2%是不是都是赢了钱提不出来的？懂的都懂', emotion: '揭穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '实体赌场和网赌平台要分开看。正规实体赌场受严格监管，作弊成本极高。但网赌平台——特别是没有主流监管牌照的——确实存在灰控、杀大赔小等操作。阿杰说的不全对但方向对，小甜的话术倒是标准的平台话术套路',
    },
  },

  // ──────────────────────────────────────────
  // 场景7：带单骗局 — 大师王被拆穿
  // ──────────────────────────────────────────
  {
    id: 'conflict_scam_master_001',
    topic: '带单大师到底是不是骗子？',
    characters: ['dashiwang', 'gailv', 'ajie'],
    type: '混战',
    triggerKeywords: ['带单', '大师', '跟单', '包赢', '导师', '学员', '预测', '回血', '系统'],
    userEmotionMatch: ['好奇', '怀疑', '上当'],
    openingLines: {
      dashiwang: '我的智能跟单系统胜率87%，上期学员三天回血15万！限时免费体验名额还剩3个💰',
      gailv: '87%胜率？在赌场优势1-5%的游戏里？这从数学上就不可能。你要么在说谎，要么统计方法有问题',
    },
    escalation: [
      { characterId: 'dashiwang', line: '你懂什么？我的系统用的是AI算法+大数据分析 不是你那种土法概率📈', emotion: '反驳' },
      { characterId: 'ajie', line: '我在赌场见过太多你这种人了...学员赚钱的截图是P的吧？呵呵', emotion: '揭穿' },
      { characterId: 'dashiwang', line: '你一个前荷官懂什么系统？我学员的提款记录都是真的！不信我可以发群里', emotion: '狡辩' },
      { characterId: 'gailv', line: '发来看看呗。顺便解释一下为什么你不自己用这个"87%胜率系统"去赚钱，而要收学费？', emotion: '致命一问' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '所有"带单""跟单"本质都是相同的骗局：1）展示精选的赢钱截图 2）免费体验让你尝甜头 3）收费后胜率骤降 4）亏了怪你执行力。识别方法很简单——真能稳赢的人不需要收学费',
    },
  },

  // ──────────────────────────────────────────
  // 场景8：负债故事 — 老刘+小芳
  // ──────────────────────────────────────────
  {
    id: 'conflict_debt_story_001',
    topic: '赌博欠了债该怎么办？',
    characters: ['laoliu', 'xiaofang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['欠债', '负债', '借钱', '网贷', '还不上', '催收', '信用卡', '房子', '家人', '跑路'],
    userEmotionMatch: ['绝望', '求助', '焦虑'],
    openingLines: {
      laoliu: '兄弟...我知道你现在的感觉。我当时欠了200多万，每天睁眼就是恐惧',
      xiaofang: '你欠了债？你想过你家里人吗？你老婆孩子知道吗？',
    },
    escalation: [
      { characterId: 'laoliu', line: '最难的不是还钱...是面对家人的那个瞬间。我到现在都记得我老婆看到账单时的表情', emotion: '痛苦' },
      { characterId: 'xiaofang', line: '每次他说"最后一次" 我都信了...你知道被骗了八百次是什么感觉吗', emotion: '心碎' },
      { characterId: 'laozhang', line: '别逼他...他现在需要的不是骂。我当年也是先面对了，才开始慢慢还的', emotion: '调和' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '面对赌债，最重要的步骤：1）停止赌博，不要试图翻本 2）全面梳理债务，分清合法债务和高利贷 3）跟家人坦白 4）制定还款计划 5）必要时寻求法律援助。翻本是最大的陷阱',
    },
  },

  // ──────────────────────────────────────────
  // 场景9：凯利公式 — 教授 vs 阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_kelly_formula_001',
    topic: '凯利公式能不能帮赌客赢钱？',
    characters: ['kellyprof', 'aqiang', 'gailv'],
    type: '混战',
    triggerKeywords: ['凯利', '公式', '资金管理', '下注比例', '最优', '仓位', '数学模型'],
    userEmotionMatch: ['好奇', '求知', '技术流'],
    openingLines: {
      kellyprof: '凯利准则 f* = (bp-q)/b 是数学上证明了的最优下注比例。但前提是——你得有正期望值的赌注',
      aqiang: '说人话！什么bp减q除以b 你以为赌桌上有人拿计算器？',
    },
    escalation: [
      { characterId: 'kellyprof', line: '这正是问题所在——凯利公式在赌场几乎没有应用场景，因为赌场游戏对赌客来说是负期望值的', emotion: '科普' },
      { characterId: 'aqiang', line: '那你说这个有啥用？能赢钱吗 不能赢钱你说它干嘛', emotion: '不耐烦' },
      { characterId: 'gailv', line: '教授的意思是：就算你有最优的资金管理，在负期望值游戏里也只能让你输得慢一点', emotion: '翻译' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '凯利公式在赌博中的真正意义：它证明了在没有正期望值的情况下，最优下注比例是零——也就是不赌。它更多用于投资领域而非赌博',
    },
  },

  // ──────────────────────────────────────────
  // 场景10：网赌出金难 — 阿杰+小甜+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_withdrawal_001',
    topic: '网赌赢了钱为什么提不出来？',
    characters: ['ajie', 'xiaotian', 'aqiang'],
    type: '混战',
    triggerKeywords: ['提现', '出金', '提不出来', '审核', '流水', '打码', '冻结', '维护'],
    userEmotionMatch: ['愤怒', '求助', '被坑'],
    openingLines: {
      aqiang: '我他妈赢了五万块 提了三天还在审核！这不是明摆着吞钱吗',
      xiaotian: '亲，您的提款正在加急处理中哦~ 因为金额较大需要安全审核，预计3-5个工作日😊',
    },
    escalation: [
      { characterId: 'ajie', line: '3-5个工作日？呵呵 这是标准拖延话术。他们在等你把钱输回去', emotion: '揭穿' },
      { characterId: 'xiaotian', line: '阿杰先生请不要散布不实信息~ 我们平台出金效率行业领先的', emotion: '否认' },
      { characterId: 'aqiang', line: '领先个屁！充值秒到 提现等三天 这叫领先？', emotion: '暴怒' },
      { characterId: 'ajie', line: '告诉你个套路：他们会在审核期间给你发优惠券，引诱你继续玩...然后你懂的', emotion: '爆料' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌平台出金难是常见套路：1）拖延审核让你等不及继续玩 2）设置流水要求（如充值金额3倍流水才能提现）3）大额赢利直接封号 4）以"安全审核"为名无限期冻结。如果一个平台充值秒到但提现要审核，基本可以确定有问题',
    },
  },

  // ──────────────────────────────────────────
  // 场景11：赌博家庭冲突 — 小芳+阿强+老刘
  // ──────────────────────────────────────────
  {
    id: 'conflict_family_001',
    topic: '赌博的人到底有没有想过家里人？',
    characters: ['xiaofang', 'aqiang', 'laoliu'],
    type: '混战',
    triggerKeywords: ['家人', '老婆', '离婚', '孩子', '骗', '瞒着', '家庭', '最后一次'],
    userEmotionMatch: ['同情', '愤怒', '反思'],
    openingLines: {
      xiaofang: '你们天天在这讨论怎么赢钱，有没有想过家里人？信用卡催收打到家里来，孩子以为爸爸是坏人！',
      aqiang: '我...我知道。但我不是不想管家里，我就是想赢了把钱还了让家里过好日子',
    },
    escalation: [
      { characterId: 'laoliu', line: '阿强...你说的话我当年一字不差地说过。"赢了就收手"——这句话我说了八年', emotion: '痛苦' },
      { characterId: 'xiaofang', line: '过好日子？你赌了这么多年 家里过好了吗！', emotion: '愤怒' },
      { characterId: 'aqiang', line: '你以为我不知道吗！我只是...停不下来...', emotion: '崩溃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博成瘾不是道德问题，是大脑奖赏回路的问题。赌客不是不爱家人——多巴胺系统让他们在明知道后果的情况下仍然无法停止。理解这一点不是为了开脱，是为了找到真正有效的应对方式',
    },
  },

  // ──────────────────────────────────────────
  // 场景12：杀猪盘揭秘 — 大师王+阿杰+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_pig_butchering_001',
    topic: '杀猪盘是怎么骗人的？',
    characters: ['dashiwang', 'ajie', 'junshi'],
    type: '混战',
    triggerKeywords: ['杀猪盘', '骗局', '网恋', '投资', '拉人', '诈骗', '交友', '感情骗'],
    userEmotionMatch: ['好奇', '警惕', '上当'],
    openingLines: {
      dashiwang: '什么杀猪盘？我们这是正规投资社群好吧！学员都是自愿的💰',
      ajie: '呵呵...标准杀猪盘三步曲：交友→建信任→拉你上平台。你信的那个"分析师"可能在缅北',
    },
    escalation: [
      { characterId: 'dashiwang', line: '你这是污蔑！我们有实体公司的 你去查！', emotion: '狡辩' },
      { characterId: 'ajie', line: '实体公司？注册在哪 柬埔寨还是菲律宾？域名注册几个月了？', emotion: '步步追问' },
      { characterId: 'dashiwang', line: '你...你一个前荷官凭什么质疑我的公司！', emotion: '恼羞成怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '杀猪盘识别要点：1）网上认识的人主动聊投资/赌博 2）让你注册不知名平台 3）前几次让你赢（养猪）4）让你加大投入后无法提现（杀猪）5）平台域名新、无主流监管牌照。遇到这种情况直接拉黑举报',
    },
  },

  // ──────────────────────────────────────────
  // 场景13：戒赌有多难 — 老张+老刘
  // ──────────────────────────────────────────
  {
    id: 'conflict_quit_gambling_001',
    topic: '戒赌到底有多难？能不能戒成功？',
    characters: ['laozhang', 'laoliu', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['戒赌', '戒', '不赌了', '自控', '复赌', '坚持', '方法', '戒不了'],
    userEmotionMatch: ['求助', '绝望', '好奇'],
    openingLines: {
      laozhang: '我戒了三年了...但我不敢说自己"戒成了"。只能说今天没赌',
      laoliu: '我戒了两次都复赌了...第二次更惨 因为觉得自己能控制了',
    },
    escalation: [
      { characterId: 'aqiang', line: '所以你们觉得我也该戒？我又没输多少', emotion: '防御' },
      { characterId: 'laozhang', line: '我没说你该戒。每个人的路不一样...我只是说 如果有一天你想停 真的很难', emotion: '平和' },
      { characterId: 'laoliu', line: '阿强 你说的"没输多少" 我当年也这么说的...', emotion: '警告' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博成瘾的复发率高达40-60%，和物质成瘾类似。有效的方法包括：认知行为疗法、互助小组（如GA）、替代活动、远离触发环境。但最核心的一点——承认自己有问题，这往往是最难的第一步',
    },
  },

  // ──────────────────────────────────────────
  // 场景14：赌场免费酒的秘密 — 阿杰+教授
  // ──────────────────────────────────────────
  {
    id: 'conflict_casino_tricks_001',
    topic: '赌场为什么给你免费喝酒？',
    characters: ['ajie', 'kellyprof', 'aqiang'],
    type: '混战',
    triggerKeywords: ['免费酒', '赌场套路', 'VIP', '筹码', '心理', '赌场设计', '没有钟', '灯光'],
    userEmotionMatch: ['好奇', '恍然大悟'],
    openingLines: {
      ajie: '赌场给你免费酒？呵呵 你以为是因为好客？酒精让你判断力下降 下注更大 这笔账赌场算得清清楚楚',
      kellyprof: '从行为经济学角度看，赌场的每一个设计都是在降低你的理性决策能力。酒精只是其中之一',
    },
    escalation: [
      { characterId: 'ajie', line: '还有没有窗户没有钟这事...赌场就是不让你知道时间 你在里面赌着赌着天都亮了', emotion: '爆料' },
      { characterId: 'kellyprof', line: '这叫"环境操控"。筹码也是同样道理——把钱变成塑料片，你的损失厌恶反应就会显著降低', emotion: '分析' },
      { characterId: 'aqiang', line: '卧槽 这我还真没注意过...难怪每次去都停不下来', emotion: '恍然大悟' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '阿杰和教授从不同角度揭示了赌场的心理操控手段，连阿强都有所触动',
    },
  },

  // ──────────────────────────────────────────
  // 场景15：赌博心理——追损 — 概率哥+老刘+教授
  // ──────────────────────────────────────────
  {
    id: 'conflict_chasing_losses_001',
    topic: '为什么输了总想追回来？追损的心理陷阱',
    characters: ['gailv', 'laoliu', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['追损', '翻本', '回血', '沉没成本', '不甘心', '赢回来', '再来一把'],
    userEmotionMatch: ['不甘心', '好奇', '反思'],
    openingLines: {
      gailv: '追损是赌客最致命的行为模式。输了1万想赢回来，结果越追越多——因为你的判断已经被情绪劫持了',
      laoliu: '我就是追损追到200万的...每次都觉得"再来一把就回来了"',
    },
    escalation: [
      { characterId: 'kellyprof', line: '这在行为经济学上叫损失厌恶——人对损失的痛苦感约是同等收益快感的2.5倍。所以输1万的痛苦需要赢2.5万才能抵消', emotion: '科普' },
      { characterId: 'laoliu', line: '什么2.5倍...我只知道输了1万 脑子里只有一个念头：赢回来。什么理性全没了', emotion: '真实' },
      { characterId: 'gailv', line: '而且追损时你会做出正常情况下绝对不会做的决定——加大赌注、换高风险游戏、借钱继续', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '追损的本质是情绪决策替代了理性决策。大脑在亏损状态下会切换到"赌博模式"——冒更大的险试图回本。唯一有效的应对方式：设定止损线，到了就走。但说起来容易做起来难——这恰恰是为什么赌博成瘾如此危险',
    },
  },

  // ──────────────────────────────────────────
  // 场景16：充值优惠陷阱 — 小甜+阿杰+概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_deposit_bonus_001',
    topic: '网赌平台的充值优惠是不是陷阱？',
    characters: ['xiaotian', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['充值', '优惠', '首充', '返水', '送金', '活动', '流水要求', '打码'],
    userEmotionMatch: ['心动', '怀疑', '好奇'],
    openingLines: {
      xiaotian: '亲~ 新人首充100送100！充值越多送越多哦，还有每周返水活动🎁',
      ajie: '又来了...免费的才是最贵的。你仔细看看流水要求——充100送100，但要完成30倍流水才能提现',
    },
    escalation: [
      { characterId: 'gailv', line: '30倍流水意味着你要下注6000块才能提现那100的赠金。按2%的赌场优势，你在完成流水过程中平均会亏120块', emotion: '算账' },
      { characterId: 'xiaotian', line: '流水要求是行业标准啦~ 很多老客户都轻松达标的呢😊', emotion: '话术' },
      { characterId: 'ajie', line: '轻松达标？你没说的是大部分人在完成流水之前就输光了吧 呵呵', emotion: '拆穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌优惠活动的数学真相：所有赠金都附带流水要求，而流水要求的设计确保了赌场优势在完成流水过程中已经吃掉了赠金甚至更多。简单说——你以为占了便宜，其实是被设计了',
    },
  },

  // ──────────────────────────────────────────
  // 场景17：赌徒谬误 — 概率哥+教授+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_gamblers_fallacy_001',
    topic: '连开10把庄，下一把是不是该闲了？',
    characters: ['gailv', 'kellyprof', 'aqiang'],
    type: '混战',
    triggerKeywords: ['连开', '该出', '规律', '长龙', '转向', '赌徒谬误', '概率', '随机'],
    userEmotionMatch: ['好奇', '不服', '求证'],
    openingLines: {
      aqiang: '连开10把庄了 下一把闲的概率肯定大了吧？这不是常识吗',
      gailv: '不。每一手都是独立事件，庄闲概率不变。之前开了多少把庄对下一把没有任何影响',
    },
    escalation: [
      { characterId: 'aqiang', line: '不可能吧 连开20把庄的概率多低啊 总得回来的', emotion: '不信' },
      { characterId: 'kellyprof', line: '你混淆了两个概率：连续20把全庄的概率很低没错，但在已经开了10把庄的条件下，第11把庄的概率还是约51%', emotion: '纠正' },
      { characterId: 'aqiang', line: '...你们说的我听不太懂 但我的感觉就是连庄太多了该转了', emotion: '坚持' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '这就是经典的"赌徒谬误"——以为过去的结果会影响未来的独立随机事件。骰子没有记忆，百家乐牌靴的每一手都接近独立。"看路"的本质就是在随机中寻找不存在的规律',
    },
  },

  // ──────────────────────────────────────────
  // 场景18：全员圆桌——赌博是不是一种病
  // ──────────────────────────────────────────
  {
    id: 'conflict_gambling_disease_001',
    topic: '赌博成瘾到底算不算一种病？',
    characters: ['aqiang', 'gailv', 'laoliu', 'laozhang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['成瘾', '病', '生病', '控制不住', '自制力', '意志力', '心理', '多巴胺'],
    userEmotionMatch: ['好奇', '反思', '求助'],
    openingLines: {
      aqiang: '什么病不病的 就是自控力差而已 想戒随时能戒',
      laoliu: '我以前也这么说...后来才知道 真的是控制不住。跟意志力没关系',
      laozhang: '我觉得算不算病不重要...重要的是承认它确实很难停下来',
    },
    escalation: [
      { characterId: 'gailv', line: '从神经科学角度看，赌博成瘾跟毒瘾激活的大脑区域几乎相同。WHO已经把它归为行为成瘾', emotion: '科普' },
      { characterId: 'aqiang', line: '那我赌了十年都没成瘾啊 说明有些人能控制', emotion: '反驳' },
      { characterId: 'laoliu', line: '阿强...我当年说的跟你一模一样', emotion: '沉重' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '世界卫生组织2019年已将赌博障碍纳入ICD-11。它不是"意志力弱"，而是大脑奖赏系统的功能性改变。和物质成瘾一样，它有明确的生理基础。认识到这一点不是给赌客开脱，而是找到正确的应对方式——靠"意志力"戒赌的成功率很低，专业干预效果好得多',
    },
  },

  // ──────────────────────────────────────────
  // 场景19：网赌vs实体赌场 — 阿杰+小甜+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_online_vs_offline_001',
    topic: '网赌和实体赌场哪个更坑？',
    characters: ['ajie', 'xiaotian', 'aqiang'],
    type: '混战',
    triggerKeywords: ['网赌', '线上', '线下', '实体', '澳门', '菲律宾', '比较', '哪个'],
    userEmotionMatch: ['好奇', '选择困难'],
    openingLines: {
      ajie: '都坑。但网赌更坑——至少实体赌场还受监管，网赌连公平性都没法保证',
      xiaotian: '我们线上平台方便快捷，随时随地都能玩，而且优惠活动比实体赌场多得多~',
    },
    escalation: [
      { characterId: 'aqiang', line: '我两个都赌过 网赌确实怪怪的 有时候赢多了就开始各种不顺', emotion: '亲身经历' },
      { characterId: 'ajie', line: '因为实体赌场靠概率赢你就够了 网赌是直接改概率赢你 完全不是一个级别', emotion: '揭示' },
      { characterId: 'xiaotian', line: '请不要恶意中伤我们平台哦~ 我们的RNG是经过认证的呢', emotion: '否认' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '关键区别：正规实体赌场（如澳门、拉斯维加斯）受严格监管，游戏公平性有保障——但赌场优势本身就够赢你了。网赌平台，特别是无主流牌照的，公平性完全无法验证。结论：都不建议赌，但如果非要选，离网赌远一点',
    },
  },

  // ──────────────────────────────────────────
  // 场景20：预测软件骗局 — 大师王+概率哥+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_prediction_software_001',
    topic: '网上卖的赌博预测软件能信吗？',
    characters: ['dashiwang', 'gailv', 'junshi'],
    type: '混战',
    triggerKeywords: ['预测软件', '软件', '破解', 'AI预测', '大数据', '分析工具', '算法', '自动'],
    userEmotionMatch: ['好奇', '心动', '怀疑'],
    openingLines: {
      dashiwang: '我们的AI智能预测系统接入了全球赌场数据，准确率高达90%！现在买终身版打五折📈',
      gailv: '90%准确率？我来算一下——如果真有这种软件，用1000块本金，每天赌10把，一年就能变成几千万。你觉得可能吗？',
    },
    escalation: [
      { characterId: 'dashiwang', line: '你不懂技术就别瞎评论！我们用的是深度学习神经网络 你知道什么是GPT吗', emotion: '唬人' },
      { characterId: 'gailv', line: '我知道什么是GPT，所以我更知道它预测不了随机数生成器的输出。RNG的定义就是不可预测', emotion: '打脸' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '所有赌博预测软件都是骗局，无一例外。原因很简单：赌场游戏的结果由RNG决定，它的设计目标就是不可预测。所谓"AI预测""大数据分析"在数学上等价于算命。如果真能预测，发明者早就自己赌发财了，不会来卖软件',
    },
  },
  // ──────────────────────────────────────────
  // 场景21：百家乐看路 — 阿强 vs 概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_bac_roadmap_001',
    topic: '百家乐看路到底有没有用？',
    characters: ['aqiang', 'gailv', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['看路', '大路', '珠盘路', '小路', '大眼仔', '路单', '路纸', '跟路'],
    userEmotionMatch: ['好奇', '不服', '求证'],
    openingLines: {
      aqiang: '看路是基本功好吧！大路、珠盘路、大眼仔...几条路对着看 趋势就出来了',
      gailv: '路单只是历史记录的可视化——它告诉你过去发生了什么，但对预测未来没有任何作用',
    },
    escalation: [
      { characterId: 'aqiang', line: '那赌场干嘛提供路单？就是让你看的啊', emotion: '反问' },
      { characterId: 'kellyprof', line: '赌场提供路单恰恰是因为它无害——它给赌客一种"有规律可循"的错觉，延长赌博时间', emotion: '揭示' },
      { characterId: 'aqiang', line: '我靠看路赢过不知道多少次了 你们光说理论有个屁用', emotion: '暴躁' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '路单是赌场的心理工具，不是赌客的分析工具。百家乐每一手接近独立事件，过去的结果不影响未来。赌场乐于提供路单，因为它让赌客更投入、坐得更久',
    },
  },

  // ──────────────────────────────────────────
  // 场景22：百家乐保险 — 概率哥+阿强+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_bac_insurance_001',
    topic: '百家乐买保险/对子值不值？',
    characters: ['gailv', 'aqiang', 'junshi'],
    type: '混战',
    triggerKeywords: ['保险', '对子', '龙宝', '和局', '边注', '赔率', '11倍'],
    userEmotionMatch: ['好奇', '心动', '求证'],
    openingLines: {
      aqiang: '对子11倍赔率！买中一把顶十把 偶尔买买碰碰运气挺好的',
      gailv: '对子的庄家优势高达10%以上，和局更离谱——14.36%。主注的庄家优势才1%出头，买边注就是在给赌场送钱',
    },
    escalation: [
      { characterId: 'aqiang', line: '又来了 1%10%的 赌博不是数学考试 有手感的时候就该加码', emotion: '不耐烦' },
      { characterId: 'gailv', line: '高赔率边注的设计目的就是利用你的"万一赢了就发了"心理。赔率高是因为概率低，而且赔率还没低到公平', emotion: '科普' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '百家乐边注是赌场利润最高的区域。主注庄家优势1.06%，对子约10.4%，和局14.36%。边注的高赔率是诱饵——真正聪明的赌客只押主注，但赌场知道人类天生对"以小博大"没有抵抗力',
    },
  },

  // ──────────────────────────────────────────
  // 场景23：老虎机选机器 — 阿强+概率哥+阿杰
  // ──────────────────────────────────────────
  {
    id: 'conflict_slot_selection_001',
    topic: '老虎机选机器有讲究吗？',
    characters: ['aqiang', 'gailv', 'ajie'],
    type: '混战',
    triggerKeywords: ['选机器', '哪台', '冷机', '热机', '吃分期', '吐分期', '位置', '入口'],
    userEmotionMatch: ['好奇', '迷信', '求技巧'],
    openingLines: {
      aqiang: '选机器有讲究的！门口的机器吐分多 因为赌场要让路过的人看到有人赢',
      gailv: '每台机器的RTP是固定的，不会因为位置变化。你说的"冷机热机"只是随机波动的不同阶段',
    },
    escalation: [
      { characterId: 'ajie', line: '阿强说的位置论其实有点过时了...但赌场确实会在高流量区域放RTP略高的机器 这个我在内部见过', emotion: '半证实' },
      { characterId: 'gailv', line: '就算RTP差1-2个百分点，单个玩家在短期内根本感受不到差别。方差远远大于RTP差异', emotion: '纠正' },
      { characterId: 'aqiang', line: '阿杰你看 你也说有区别了吧！', emotion: '得意' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '阿杰承认赌场会做位置策略，但概率哥指出对个人赌客来说差别可以忽略不计',
    },
  },

  // ──────────────────────────────────────────
  // 场景24：老虎机累积奖池 — 概率哥+阿强+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_slot_jackpot_001',
    topic: '老虎机累积奖池真的能中吗？',
    characters: ['gailv', 'aqiang', 'junshi'],
    type: '混战',
    triggerKeywords: ['jackpot', '累积', '奖池', '头奖', '大奖', '百万', '中大奖', '梦想'],
    userEmotionMatch: ['好奇', '幻想', '心动'],
    openingLines: {
      aqiang: '我亲眼见过有人中了两百万的jackpot！万一呢对不对',
      gailv: '累积奖池的中奖概率通常在千万分之一到数亿分之一之间。你被雷劈中的概率都比中jackpot高',
    },
    escalation: [
      { characterId: 'aqiang', line: '但总有人中啊！买彩票不也这样 万一轮到我呢', emotion: '幻想' },
      { characterId: 'gailv', line: '累积奖池还有个你不知道的秘密——为了筹集奖池，这类机器的基础RTP比普通老虎机低得多', emotion: '揭示' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '累积奖池是赌场最精妙的心理武器——它让你每次投币都觉得"离大奖又近了一步"。事实是：你的每次投币跟大奖的距离完全没有关系。而且为了养奖池，这类机器从你每次下注中抽走的比例更高',
    },
  },

  // ──────────────────────────────────────────
  // 场景25：赌博和投资的区别 — 教授+概率哥+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_gambling_vs_investing_001',
    topic: '赌博和投资有什么区别？',
    characters: ['kellyprof', 'gailv', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['投资', '股票', '炒股', '期货', '区别', '赌博和投资', '一样', '赌场和股市'],
    userEmotionMatch: ['好奇', '辩论', '求知'],
    openingLines: {
      aqiang: '炒股不就是赌博吗？买涨买跌 跟买大买小有什么区别',
      kellyprof: '从数学结构上看，赌博是负和游戏（赌场抽水），投资是正和游戏（企业创造价值）。这是本质区别',
    },
    escalation: [
      { characterId: 'gailv', line: '教授说的对，但要补充一点：很多人炒股的方式——追涨杀跌、加杠杆、听消息——本质上就是在赌', emotion: '补充' },
      { characterId: 'aqiang', line: '你看 连概率哥都说炒股跟赌差不多', emotion: '断章取义' },
      { characterId: 'kellyprof', line: '不，区别在于行为方式。长期持有指数基金是投资，满仓加杠杆炒短线就是赌博。同一个市场，不同的行为导致不同的结果', emotion: '纠正' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博vs投资的核心区别：期望值。赌场游戏对赌客是负期望值（长赌必输），而分散化的长期投资是正期望值（经济增长的受益者）。但如果你用赌博的心态做投资（短线、杠杆、孤注一掷），那你其实还是在赌',
    },
  },

  // ──────────────────────────────────────────
  // 场景26：运气和迷信 — 阿强+概率哥+老刘
  // ──────────────────────────────────────────
  {
    id: 'conflict_luck_superstition_001',
    topic: '赌博讲不讲运气？迷信有没有用？',
    characters: ['aqiang', 'gailv', 'laoliu'],
    type: '混战',
    triggerKeywords: ['运气', '风水', '迷信', '手气', '转运', '拜佛', '吉日', '红色', '忌讳'],
    userEmotionMatch: ['好奇', '迷信', '不服'],
    openingLines: {
      aqiang: '运气是真实的！有些天手气就是好 有些天怎么下都是输 这你不承认？',
      gailv: '"运气"只是你给随机波动起的名字。骰子不知道你今天心情好不好',
    },
    escalation: [
      { characterId: 'laoliu', line: '我以前赌之前一定要穿红内裤...现在想想 亏的那200万穿什么颜色都挡不住', emotion: '自嘲' },
      { characterId: 'aqiang', line: '红内裤是扯淡 但手气是真的 你没赌过你不懂那种感觉', emotion: '坚持' },
      { characterId: 'gailv', line: '"手气好"的感觉来自大脑对随机序列中连续性的过度解读。跟彩票中奖者觉得自己"被选中了"一样', emotion: '解释' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '概率哥从科学角度解释了"运气感觉"的来源，老刘用亲身经历佐证了迷信没用，阿强虽然不全信但也笑了',
    },
  },

  // ──────────────────────────────────────────
  // 场景27：体育博彩能不能赢 — 概率哥+阿强+教授
  // ──────────────────────────────────────────
  {
    id: 'conflict_sports_betting_001',
    topic: '体育博彩比赌场游戏更容易赢吗？',
    characters: ['gailv', 'aqiang', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['体育', '足球', '篮球', '比赛', '让球', '盘口', '水位', '博彩', '竞猜', '世界杯'],
    userEmotionMatch: ['好奇', '技术流', '球迷'],
    openingLines: {
      aqiang: '体育博彩跟赌场不一样吧？这个是有技术含量的 你懂球就能赢',
      gailv: '体育博彩确实有一点不同——理论上存在信息优势的可能性。但博彩公司的赔率已经包含了大量分析，你很难比他们更准',
    },
    escalation: [
      { characterId: 'kellyprof', line: '从学术角度看，体育博彩市场效率大约在95-97%。剩下3-5%的低效率确实存在套利空间，但需要大量数据分析能力和资金', emotion: '科普' },
      { characterId: 'aqiang', line: '我看球二十年了 内幕消息也有一些 这就是我的优势', emotion: '自信' },
      { characterId: 'gailv', line: '你的"内幕消息"十有八九是过时的或者假的。博彩公司的情报网络比你强一万倍', emotion: '打击' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '体育博彩vs赌场游戏：赌场游戏的赔率是固定的负期望值，没有任何技术可以改变。体育博彩理论上存在信息不对称的赢面，但99%的人不具备战胜博彩公司赔率模型的能力。真正的体育套利者是量化团队，不是"懂球的球迷"',
    },
  },

  // ──────────────────────────────────────────
  // 场景28：赌博借钱 — 老刘+小芳+老张
  // ──────────────────────────────────────────
  {
    id: 'conflict_borrowing_001',
    topic: '赌博借钱是不是无底洞？',
    characters: ['laoliu', 'xiaofang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['借钱', '借贷', '网贷', '高利贷', '信用卡', '套现', '花呗', '借呗', '以贷还贷'],
    userEmotionMatch: ['焦虑', '求助', '绝望'],
    openingLines: {
      laoliu: '千万别借钱赌...我从借5万开始 三年借到了200多万 借钱赌是最快的死法',
      xiaofang: '我老公瞒着我办了十几张信用卡 催收电话打到我单位 我才知道他又赌了',
    },
    escalation: [
      { characterId: 'laozhang', line: '借钱赌的逻辑是这样的：输了→借钱翻本→输更多→借更多。这个循环一旦开始 就停不下来了', emotion: '平和' },
      { characterId: 'laoliu', line: '最可怕的是网贷太容易了...手机点几下就到账 根本没有思考的时间', emotion: '痛苦' },
      { characterId: 'xiaofang', line: '他每次都说"借最后一次" 你猜猜他说了多少次？', emotion: '心碎' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '借钱赌博是加速毁灭的催化剂。赌博本身是负期望值，借钱赌等于用杠杆放大亏损。加上利息成本，你需要赢得更多才能回本——而赢得更多在数学上更不可能。如果你已经在借钱赌，现在停止是损失最小的时刻',
    },
  },

  // ──────────────────────────────────────────
  // 场景29：赌场贵宾厅 — 阿杰+阿强+教授
  // ──────────────────────────────────────────
  {
    id: 'conflict_vip_room_001',
    topic: '赌场VIP贵宾厅是什么套路？',
    characters: ['ajie', 'aqiang', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['VIP', '贵宾厅', '高端', '叠码仔', '返佣', '洗码', '积分', '贵宾'],
    userEmotionMatch: ['好奇', '向往', '了解'],
    openingLines: {
      ajie: '贵宾厅...呵呵 那是赌场最赚钱的地方。也是赌客输得最惨的地方',
      aqiang: 'VIP厅待遇好啊 免费酒店免费机票 还有返佣 赌得越多返得越多',
    },
    escalation: [
      { characterId: 'kellyprof', line: '返佣的本质是把你输的钱退一小部分给你，让你觉得"亏得少了"。但你思考一下——为什么赌场愿意返佣？因为你输的远比返的多', emotion: '分析' },
      { characterId: 'ajie', line: '我告诉你们贵宾厅的真相——叠码仔拉你进去不是因为你是VIP，是因为你是提款机', emotion: '爆料' },
      { characterId: 'aqiang', line: '但高端厅至少公平吧？那么多有钱人赌 赌场不敢搞鬼', emotion: '天真' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '贵宾厅不需要搞鬼——它用更高效的方式赚你的钱：更高的最低下注额、更长的赌博时间、"返佣"制造的虚假安全感。你以为自己是VIP，其实你是赌场最优质的"客户"——下注大、坐得久、亏得多',
    },
  },

  // ──────────────────────────────────────────
  // 场景30：21点算牌 — 教授+概率哥+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_card_counting_001',
    topic: '21点算牌能不能真的赢赌场？',
    characters: ['kellyprof', 'gailv', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['算牌', '21点', '黑杰克', 'blackjack', '记牌', 'Hi-Lo', '真数', '大小牌'],
    userEmotionMatch: ['好奇', '技术流', '求方法'],
    openingLines: {
      kellyprof: '算牌是21点中唯一经过数学证明的可行优势策略。Hi-Lo系统在理想条件下可以给玩家约0.5-1.5%的优势',
      aqiang: '真的假的？那我去学算牌不就完了？',
    },
    escalation: [
      { characterId: 'gailv', line: '理论上可行，实践中极难。你需要在高压环境下完美执行，同时不能被赌场发现。而且现代赌场用6-8副牌+频繁洗牌来对抗算牌', emotion: '现实' },
      { characterId: 'kellyprof', line: '还有一个关键：即使算牌成功，优势只有1%左右。你需要巨大的本金和几千小时的游戏时间才能让统计优势显现。方差会让你经历极其痛苦的下行期', emotion: '补充' },
      { characterId: 'aqiang', line: '那电影里那些算牌团队是怎么回事？MIT那帮人', emotion: '追问' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '算牌是极少数数学上可行的赌场策略，但它是一份艰苦的"工作"而非快钱捷径。需要：完美的技术执行、巨额本金、数千小时训练、承受巨大方差、以及被赌场ban的风险。99.9%的人不适合这条路。它的意义更在于证明了一件事——除了算牌，赌场游戏真的赢不了',
    },
  },

  // ──────────────────────────────────────────
  // 场景31：赌博和酒精/毒品 — 老张+老刘+概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_addiction_comparison_001',
    topic: '赌瘾和毒瘾/酒瘾是一回事吗？',
    characters: ['laozhang', 'laoliu', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['毒瘾', '酒瘾', '上瘾', '瘾', '戒断', '复发', '行为成瘾', '物质'],
    userEmotionMatch: ['好奇', '求知', '反思'],
    openingLines: {
      laozhang: '我觉得赌瘾比酒瘾更隐蔽...因为你看不出来 没有味道没有痕迹 直到爆雷',
      gailv: '从神经科学看，赌博成瘾和物质成瘾激活的脑区高度重叠——都涉及伏隔核和前额叶皮层的多巴胺通路',
    },
    escalation: [
      { characterId: 'laoliu', line: '我戒赌比我爸戒酒还难...至少酒你可以不买 但赌 一个手机就够了', emotion: '真实' },
      { characterId: 'laozhang', line: '而且赌瘾有个特殊的地方——你每次戒赌成功后 都会觉得"这次我能控制了" 然后就复赌了', emotion: '经验' },
      { characterId: 'gailv', line: '这叫"控制错觉"。戒断期过后大脑会欺骗你，让你觉得可以"适度赌博"——这在所有成瘾中都是最危险的想法', emotion: '科普' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博成瘾的特殊性：①无物质摄入却产生类似毒瘾的脑变化 ②极度隐蔽，旁人难以察觉 ③手机时代触发条件无处不在 ④"控制错觉"导致复发率极高。治疗路径与物质成瘾类似：专业干预+互助支持+环境控制',
    },
  },

  // ──────────────────────────────────────────
  // 场景32：赌博直播 — 大师王+阿杰+概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_gambling_stream_001',
    topic: '赌博直播间的主播是真赢还是演的？',
    characters: ['dashiwang', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['直播', '主播', '直播赌', '表演', '托', '真赢', '直播间'],
    userEmotionMatch: ['好奇', '怀疑', '上瘾'],
    openingLines: {
      dashiwang: '我直播间每天几万人看着 赢的都是现场直播 造不了假的💰',
      ajie: '直播赌博90%是跟平台合作的。你看他赢得漂亮 其实后台给他开了特殊账号',
    },
    escalation: [
      { characterId: 'gailv', line: '就算是真赌——你只看到他赢的直播，输的时候他会播给你看吗？这就是幸存者偏差的直播版', emotion: '分析' },
      { characterId: 'dashiwang', line: '我输也播的！只是赢的时候观众多而已...这叫市场规律', emotion: '狡辩' },
      { characterId: 'ajie', line: '市场规律？你说说你的平台推广链接分成是多少？每拉一个人充值你抽几个点？', emotion: '追问' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博直播的商业模式：①跟平台合作拿推广分成（你输的钱他抽成）②特殊账号享受更高胜率（演给你看）③选择性展示赢钱画面。观看赌博直播是走向赌博成瘾的高危行为——它让你觉得赢钱很容易',
    },
  },

  // ──────────────────────────────────────────
  // 场景33：赌场筹码心理 — 教授+阿杰+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_chips_psychology_001',
    topic: '为什么赌场要用筹码而不是现金？',
    characters: ['kellyprof', 'ajie', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['筹码', '换钱', '现金', '塑料', '颜色', '面值'],
    userEmotionMatch: ['好奇', '恍然大悟'],
    openingLines: {
      kellyprof: '筹码的核心功能是"去货币化"——把真实的钱变成抽象的圆片，大幅降低你的损失厌恶反应',
      ajie: '这是赌场最基础的套路之一。你摸着一堆塑料片的时候 根本不觉得那是钱',
    },
    escalation: [
      { characterId: 'aqiang', line: '确实...我有一次输了五万块筹码 当时没感觉 出门算账才慌了', emotion: '后怕' },
      { characterId: 'kellyprof', line: '实验表明，用筹码下注时人的平均下注额比用等值现金时高出20-30%。这就是去货币化的威力', emotion: '数据' },
      { characterId: 'ajie', line: '更高级的是信用额度——连筹码都不用换 直接借给你玩。那时候你连"我在花钱"的感觉都没了', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '三人从不同角度揭示了筹码的心理操控作用——它让赌客在不知不觉中花更多的钱',
    },
  },

  // ──────────────────────────────────────────
  // 场景34：催收与法律 — 老刘+小芳+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_debt_collection_001',
    topic: '赌债被催收了该怎么办？合法吗？',
    characters: ['laoliu', 'xiaofang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['催收', '讨债', '威胁', '恐吓', '上门', '律师', '法律', '报警', '合法'],
    userEmotionMatch: ['恐惧', '求助', '焦虑'],
    openingLines: {
      laoliu: '催收的手段你们想不到...打电话给你所有联系人 半夜上门 在你家门口泼油漆',
      xiaofang: '催收电话打到单位 领导找我谈话...那种耻辱你们不会懂的',
    },
    escalation: [
      { characterId: 'laoliu', line: '网贷催收更狠 他们有你的通讯录 所有亲朋好友都会被骚扰', emotion: '恐惧' },
      { characterId: 'xiaofang', line: '有些催收的上门来 吓得孩子做噩梦哭了一个星期', emotion: '愤怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '面对催收的关键知识：①赌债（尤其是网赌/高利贷）在法律上不受保护 ②暴力催收是违法的，可以报警 ③正规银行/信用卡的债务应该协商还款计划 ④不要因为恐惧而借新债还旧债。建议：保留催收威胁的证据，必要时寻求法律援助',
    },
  },

  // ──────────────────────────────────────────
  // 场景35：赌博与自杀 — 老张+老刘+军师（危机场景）
  // ──────────────────────────────────────────
  {
    id: 'conflict_crisis_001',
    topic: '因为赌博不想活了怎么办？',
    characters: ['laozhang', 'laoliu', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['不想活', '想死', '自杀', '跳楼', '割腕', '活着', '没意义', '解脱'],
    userEmotionMatch: ['绝望', '危机', '求助'],
    openingLines: {
      laozhang: '兄弟...我不会跟你说"想开点"这种废话。我当年也站在阳台上过...但我现在还在这',
      laoliu: '我有过同样的念头...那时候觉得死了就不用还债了。但...活着才有可能',
    },
    escalation: [
      { characterId: 'laozhang', line: '你现在觉得走投无路 但你看看我们——欠过两百万的、差点离婚的、家散了的...都还在', emotion: '共情' },
      { characterId: 'laoliu', line: '债是数字 人命不是。你死了 你家里人怎么办？债还是在 人却没了', emotion: '真实' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '如果你现在有自杀的念头，请立即拨打心理援助热线：全国24小时心理危机干预热线 400-161-9995。你的困境是暂时的，但死亡是永久的。赌债可以处理——协商还款、法律保护、家人支持，路没有断。先让自己安全，然后我们一起想办法',
    },
  },

  // ──────────────────────────────────────────
  // 场景36：女性赌客 — 小芳+老张+概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_female_gambler_001',
    topic: '女性赌客和男性有什么不同？',
    characters: ['xiaofang', 'laozhang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['女赌客', '女性', '老婆赌', '妈妈赌', '女人', '性别'],
    userEmotionMatch: ['好奇', '共情', '反思'],
    openingLines: {
      xiaofang: '别以为只有男人才赌。我有个闺蜜 在手机上玩老虎机 半年输了三十万 老公到现在不知道',
      gailv: '研究数据显示，女性赌客的增长速度比男性快。网赌的匿名性让更多女性在不被发现的情况下赌博',
    },
    escalation: [
      { characterId: 'laozhang', line: '在GA互助会上我见过不少女性...她们面临的羞耻感往往更强 因为社会对女性赌博的评判更严厉', emotion: '观察' },
      { characterId: 'xiaofang', line: '是的...男人输了钱大家说"赌鬼" 女人输了钱大家说"不要脸"。同样是赌 评价完全不同', emotion: '愤怒' },
      { characterId: 'gailv', line: '研究也发现，女性赌客从开始赌博到成瘾的时间通常比男性短——这叫"伸缩效应"', emotion: '科普' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '女性赌博是一个被严重忽视的问题。网赌的便利性让女性赌客数量激增，但社会偏见让她们更难寻求帮助。无论性别，赌博成瘾的机制是一样的，需要的支持也是一样的',
    },
  },

  // ──────────────────────────────────────────
  // 场景37：虚拟货币赌博 — 小甜+阿杰+概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_crypto_gambling_001',
    topic: '用虚拟货币赌博更安全吗？',
    characters: ['xiaotian', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['虚拟货币', '比特币', 'BTC', '加密', 'USDT', '币圈', '区块链赌场', '匿名'],
    userEmotionMatch: ['好奇', '技术流', '心动'],
    openingLines: {
      xiaotian: '我们也支持USDT充值哦~ 到账更快 手续费更低 还更安全呢😊',
      ajie: '更安全？用虚拟货币赌博才是最没保障的。出了问题你连投诉的地方都没有',
    },
    escalation: [
      { characterId: 'gailv', line: '虚拟货币赌场几乎不受任何监管。它们甚至不需要公布RTP——你怎么知道那个骰子不是假的？', emotion: '质疑' },
      { characterId: 'xiaotian', line: '我们是经过区块链验证的可证明公平系统~ 每一把都可以验证的', emotion: '话术' },
      { characterId: 'ajie', line: '"可证明公平"？那你把合约地址发出来让大家验证啊。十个说自己可证明公平的，九个都是自己写的合约', emotion: '拆穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '虚拟货币赌博的风险比传统赌博更高：①完全匿名意味着跑路成本为零 ②所谓"可证明公平"大多无法独立验证 ③出金需要经过平台，照样可以卡你 ④没有任何监管保护。用USDT赌博=在无人区裸奔',
    },
  },

  // ──────────────────────────────────────────
  // 场景38：赌博税和概率 — 教授+概率哥
  // ──────────────────────────────────────────
  {
    id: 'conflict_house_edge_001',
    topic: '不同赌博游戏的庄家优势差多少？',
    characters: ['kellyprof', 'gailv', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['庄家优势', '赌场优势', '胜率', '赢率', '哪个游戏', '最容易', '抽水'],
    userEmotionMatch: ['好奇', '求知', '选择'],
    openingLines: {
      kellyprof: '让我列一下常见赌场游戏的庄家优势：21点(基本策略)约0.5%，百家乐庄1.06%，轮盘(单零)2.7%，老虎机2-15%，彩票30-50%',
      gailv: '注意看差距——21点用基本策略庄家只有0.5%优势，而彩票的庄家优势高达50%。选错游戏等于选错战场',
    },
    escalation: [
      { characterId: 'aqiang', line: '那我赌21点不就行了？庄家优势最低', emotion: '天真' },
      { characterId: 'kellyprof', line: '0.5%是使用完美基本策略的结果。大多数赌客不会基本策略，实际庄家优势在2-5%。而且赌场的各种规则变体也会影响这个数字', emotion: '纠正' },
      { characterId: 'gailv', line: '而且不管庄家优势多低，只要是负的，长期赌就必输。差别只在于输的速度', emotion: '结论' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '教授和概率哥用数据展示了不同游戏的庄家优势，结论是：无论选哪个游戏，长赌必输',
    },
  },

  // ──────────────────────────────────────────
  // 场景39：代理推广 — 小甜+阿杰+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_affiliate_001',
    topic: '网赌代理推广是怎么运作的？',
    characters: ['xiaotian', 'ajie', 'junshi'],
    type: '混战',
    triggerKeywords: ['代理', '推广', '拉人', '佣金', '下线', '团队', '代理费', '分成'],
    userEmotionMatch: ['好奇', '心动', '怀疑'],
    openingLines: {
      xiaotian: '我们平台代理政策很优厚哦~ 推荐好友注册就有奖金，他们输的钱你还能拿分成😊',
      ajie: '听清楚了——"他们输的钱你拿分成"。你赚的每一分钱，都是你朋友输的血汗钱',
    },
    escalation: [
      { characterId: 'xiaotian', line: '这是正常的商业推广啊~ 很多行业都有推荐奖励的', emotion: '合理化' },
      { characterId: 'ajie', line: '正常商业？你推荐的产品是赌博——一个被设计来让你的朋友输钱的产品。这跟传销有什么区别', emotion: '揭露' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌代理推广的本质：用你的社交关系为赌博平台导流。你的"佣金"来自朋友的损失。更大的风险：在很多地区，推广赌博平台本身就是违法行为。一旦平台被查，代理是最先被追查的环节',
    },
  },

  // ──────────────────────────────────────────
  // 场景40：赌博与抑郁 — 老张+老刘+教授
  // ──────────────────────────────────────────
  {
    id: 'conflict_depression_001',
    topic: '赌博和抑郁症有关系吗？',
    characters: ['laozhang', 'laoliu', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['抑郁', '焦虑', '失眠', '心理', '精神', '看医生', '药', '心理咨询'],
    userEmotionMatch: ['求助', '迷茫', '痛苦'],
    openingLines: {
      laozhang: '赌博那几年...说实话我一直在吃抗抑郁药。戒赌后好了很多 但偶尔还是会犯',
      kellyprof: '赌博障碍和抑郁症的共病率约为50-75%。两者互为因果——赌博导致抑郁，抑郁又驱动赌博寻求刺激',
    },
    escalation: [
      { characterId: 'laoliu', line: '我赌博最疯的那段时间...连续三个月没睡过好觉。输了钱睡不着，赢了钱兴奋得也睡不着', emotion: '真实' },
      { characterId: 'laozhang', line: '对我来说赌博是"自我药疗"——用赌博的刺激来填补抑郁的空虚。但这只会让两个问题都更严重', emotion: '反思' },
      { characterId: 'kellyprof', line: '这在临床上叫双重诊断——同时治疗成瘾和心理障碍效果最好。只戒赌不治抑郁，复发率非常高', emotion: '建议' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博和心理健康是双向关系：赌博恶化心理状态，心理问题又加剧赌博冲动。如果你同时面对赌博问题和情绪困扰，请寻求专业的双重治疗——单独戒赌或单独治疗心理问题效果都有限',
    },
  },

  // ──────────────────────────────────────────
  // 场景41：赌博合法化辩论 — 全员圆桌
  // ──────────────────────────────────────────
  {
    id: 'conflict_legalization_001',
    topic: '赌博应不应该合法化？',
    characters: ['aqiang', 'gailv', 'xiaofang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['合法', '非法', '禁赌', '开放', '监管', '政府', '澳门', '合法化'],
    userEmotionMatch: ['辩论', '好奇', '思考'],
    openingLines: {
      aqiang: '都合法化不就完了？禁也禁不住 不如让政府管起来',
      xiaofang: '合法化？让更多家庭破碎？让更多孩子没有爸爸？你们说得轻巧',
    },
    escalation: [
      { characterId: 'gailv', line: '从经济学角度看，全面禁赌确实效果有限——地下赌博市场反而更不受监管。但合法化需要极其完善的监管体系', emotion: '理性' },
      { characterId: 'xiaofang', line: '你们光算经济账不算人命账！每个数字后面都是一个家庭', emotion: '情绪' },
      { characterId: 'aqiang', line: '但不合法网赌更猖獗啊 至少合法了能管一管', emotion: '务实' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博合法化不是简单的是非题。完全禁赌→地下赌博猖獗、毫无保护。完全放开→成瘾问题加剧、社会成本增大。最佳方案在中间：有限度合法化+严格监管+强制成瘾预防+问题赌博救助体系。但没有完美答案',
    },
  },

  // ──────────────────────────────────────────
  // 场景42：赌博回忆触发 — 老张+阿强+老刘
  // ──────────────────────────────────────────
  {
    id: 'conflict_trigger_001',
    topic: '什么东西会触发赌博冲动？',
    characters: ['laozhang', 'aqiang', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['冲动', '触发', '想赌', '忍不住', '诱惑', '广告', '朋友叫', '环境'],
    userEmotionMatch: ['求助', '挣扎', '分享'],
    openingLines: {
      laozhang: '你问什么会触发？太多了...路过棋牌室、看到体育比赛、甚至听到赌场那种音效...三年了还是会心跳加速',
      aqiang: '我是看到别人赢钱的消息就忍不住...微信群里有人晒赢钱截图 我手就痒',
    },
    escalation: [
      { characterId: 'laoliu', line: '我最怕发工资那天...手里有钱的感觉 整个人都不对了', emotion: '坦白' },
      { characterId: 'laozhang', line: '所以我发工资当天就把钱转给老婆。不是不信任自己 是我知道自己在那种状态下不靠谱', emotion: '方法' },
      { characterId: 'aqiang', line: '你们说的这些...我其实也有。只是不想承认', emotion: '松动' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '三人分享了各自的触发因素和应对方法——识别触发因素是预防复赌的关键一步',
    },
  },

  // ──────────────────────────────────────────
  // 场景43：家人该怎么做 — 小芳+老张+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_family_help_001',
    topic: '家人怎么帮赌客戒赌？',
    characters: ['xiaofang', 'laozhang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['家人帮', '怎么办', '管不住', '帮他', '该怎么做', '放弃', '不管了'],
    userEmotionMatch: ['求助', '疲惫', '绝望'],
    openingLines: {
      xiaofang: '我真的累了...管也管不住 不管又不忍心。到底该怎么办？',
      laozhang: '嫂子...我跟你说实话 有些事情只有他自己想通了才有用。你能做的 是保护好你自己和孩子',
    },
    escalation: [
      { characterId: 'xiaofang', line: '保护自己？他是我老公啊 我怎么能不管他', emotion: '纠结' },
      { characterId: 'laozhang', line: '不管和不纵容是两回事。帮他还债、替他隐瞒、借钱给他——这些都是在帮他继续赌', emotion: '直言' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '家人帮助赌客的关键原则：①不替他承担后果（还债、隐瞒）——让他面对真实后果 ②管好家庭财务，切断赌资渠道 ③了解赌博成瘾——这是病，不是品德问题 ④寻求Gam-Anon等家属互助组织 ⑤设定底线——什么是你不能接受的 ⑥照顾好自己的身心健康',
    },
  },

  // ──────────────────────────────────────────
  // 场景44：百家乐最佳策略 — 教授+概率哥+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_bac_strategy_001',
    topic: '百家乐有没有最佳下注策略？',
    characters: ['kellyprof', 'gailv', 'aqiang'],
    type: '混战',
    triggerKeywords: ['策略', '下注', '买庄', '买闲', '怎么下', '最优', '技巧', '方法'],
    userEmotionMatch: ['求技巧', '好奇', '不服'],
    openingLines: {
      aqiang: '百家乐老手都知道要买庄 因为庄赢概率高一点嘛',
      kellyprof: '这是对的——庄的庄家优势1.06%，闲是1.24%。但差别只有0.18个百分点，对单次游戏来说几乎没有影响',
    },
    escalation: [
      { characterId: 'gailv', line: '所谓"最佳策略"就是：①只买庄或闲（不买和/对子）②每把下注金额固定 ③设好止损线 ④到了就走。就这么简单——也就这么无聊', emotion: '总结' },
      { characterId: 'aqiang', line: '这也叫策略？直接不赌不就完了', emotion: '嘲讽' },
      { characterId: 'kellyprof', line: '从数学最优的角度看...确实，最佳策略就是不赌。任何正期望值策略在百家乐中都不存在', emotion: '笑' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '教授和概率哥用数学证明了百家乐的"最佳策略"就是减少损失——但不可能盈利。阿强虽然不爽但也无话可说',
    },
  },

  // ──────────────────────────────────────────
  // 场景45：网赌洗钱 — 阿杰+小甜+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_money_laundering_001',
    topic: '网赌平台为什么会跟洗钱有关？',
    characters: ['ajie', 'xiaotian', 'junshi'],
    type: '混战',
    triggerKeywords: ['洗钱', '黑钱', '非法', '犯罪', '跨境', '转账', '地下钱庄'],
    userEmotionMatch: ['好奇', '震惊', '警惕'],
    openingLines: {
      ajie: '很多网赌平台本质上就是洗钱工具。黑钱进去 "赢钱"出来 干干净净',
      xiaotian: '这种说法太不负责任了~ 我们是合法运营的正规平台呢',
    },
    escalation: [
      { characterId: 'ajie', line: '你知道为什么有些平台对大额充值特别热情、但对大额提现百般刁难？因为"充值"那笔钱可能根本不是赌客的', emotion: '揭示' },
      { characterId: 'xiaotian', line: '大额交易需要审核是为了符合反洗钱规定哦 这是国际标准~', emotion: '掩盖' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌与洗钱的关联是真实的——部分平台被犯罪集团用作洗钱渠道。作为普通赌客你面临的风险：①你的充值可能被用于违法交易 ②平台被查封时你的资金不可追回 ③在某些地区，使用这类平台本身就可能涉及法律问题',
    },
  },

  // ──────────────────────────────────────────
  // 场景46：孩子发现父母赌博 — 小芳+老刘+老张
  // ──────────────────────────────────────────
  {
    id: 'conflict_children_impact_001',
    topic: '赌博对孩子有什么影响？',
    characters: ['xiaofang', 'laoliu', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['孩子', '小孩', '儿子', '女儿', '学校', '成绩', '影响', '童年'],
    userEmotionMatch: ['心疼', '愧疚', '反思'],
    openingLines: {
      xiaofang: '我女儿有一次在学校被同学说"你爸是赌鬼"...她回来哭了一晚上',
      laoliu: '我最对不起的就是我儿子。他小学时最怕听到敲门声 因为催收的经常来',
    },
    escalation: [
      { characterId: 'laozhang', line: '研究说赌客的孩子长大后赌博的概率是普通人的2-4倍...这个数字让我害怕了好久', emotion: '沉重' },
      { characterId: 'xiaofang', line: '我现在最大的恐惧不是债 是我女儿长大后会不会重蹈覆辙', emotion: '担忧' },
      { characterId: 'laoliu', line: '所以我现在拼命工作也要给孩子一个正常的环境...虽然已经迟了很多', emotion: '愧疚' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博对子女的影响深远且隐蔽：①情绪不安全感（害怕冲突、经济焦虑）②社交羞耻感 ③赌博行为的代际传递风险 ④信任问题。但改变从来不嫌晚——承认问题、稳定家庭环境、必要时寻求家庭心理咨询，都能帮助修复对孩子的影响',
    },
  },

  // ──────────────────────────────────────────
  // 场景47：假冒平台与钓鱼 — 阿杰+小甜+大师王
  // ──────────────────────────────────────────
  {
    id: 'conflict_phishing_001',
    topic: '怎么识别假冒的赌博平台？',
    characters: ['ajie', 'xiaotian', 'dashiwang'],
    type: '混战',
    triggerKeywords: ['假冒', '钓鱼', '仿冒', '假平台', '假网站', '盗号', '骗钱'],
    userEmotionMatch: ['警惕', '好奇', '被骗'],
    openingLines: {
      ajie: '市面上80%的网赌平台都是套壳的——同一套代码换个皮肤就是一个新平台',
      dashiwang: '我认识靠谱的平台 可以推荐给你们 绝对正规的💰',
    },
    escalation: [
      { characterId: 'xiaotian', line: '建议您认准官方域名哦~ 很多仿冒站会用相似的域名来骗人', emotion: '表演' },
      { characterId: 'ajie', line: '你说的"官方域名"三个月前还是另一个平台的呢...网赌平台换域名比换衣服还快', emotion: '揭穿' },
      { characterId: 'dashiwang', line: '所以才要跟着有经验的人嘛！跟着我的渠道走保证安全💎', emotion: '趁虚而入' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '假冒赌博平台的识别要点：①域名注册时间短（几周到几个月）②无法查到主流监管牌照 ③充值渠道只有个人转账 ④客服只有微信/Telegram ⑤没有第三方审计报告。但最安全的识别方法：不赌就不会被骗',
    },
  },

  // ──────────────────────────────────────────
  // 场景48：GA互助会 — 老张+老刘+军师
  // ──────────────────────────────────────────
  {
    id: 'conflict_ga_meeting_001',
    topic: 'GA赌博匿名互助会是什么？有用吗？',
    characters: ['laozhang', 'laoliu', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['GA', '互助', '互助会', '匿名', '戒赌会', '12步', '分享', '支持'],
    userEmotionMatch: ['好奇', '求助', '犹豫'],
    openingLines: {
      laozhang: 'GA改变了我的人生。不是因为它教了我什么方法 而是我第一次发现"原来不是只有我这样"',
      laoliu: '我去过两次...说实话第一次去的时候很不舒服 听到别人的故事就像在照镜子',
    },
    escalation: [
      { characterId: 'laozhang', line: '最重要的规则是匿名——在那个房间里说的话不会出去。这让你能真正地说实话', emotion: '推荐' },
      { characterId: 'laoliu', line: '但要坚持去...我就是因为觉得"好了"就不去了 然后复赌了', emotion: '教训' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'GA（Gamblers Anonymous）是全球最大的赌博成瘾互助组织，基于12步戒瘾法。研究显示，参加GA的赌客复发率比独自戒赌低30-40%。它不是万能药，但"被理解"和"不孤单"本身就是巨大的力量。如果你在考虑戒赌，参加GA是成本最低、门槛最低的第一步',
    },
  },

  // ──────────────────────────────────────────
  // 场景49：赌场时间感 — 阿杰+教授+阿强
  // ──────────────────────────────────────────
  {
    id: 'conflict_time_distortion_001',
    topic: '为什么一进赌场就不知道时间了？',
    characters: ['ajie', 'kellyprof', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['时间', '几点了', '通宵', '不知道', '天亮了', '一整夜', '赌场设计'],
    userEmotionMatch: ['好奇', '恍然大悟'],
    openingLines: {
      ajie: '赌场没有窗户、没有钟、灯光永远是一样的亮度——这不是巧合 每一个设计都是为了让你忘记时间',
      kellyprof: '时间知觉扭曲是赌场环境设计的核心。研究表明，赌场中的赌客平均低估自己的赌博时间40%以上',
    },
    escalation: [
      { characterId: 'aqiang', line: '靠...确实 有一次我进去的时候是下午 出来天都亮了 我还以为才过了两三个小时', emotion: '震惊' },
      { characterId: 'ajie', line: '还有一个你不知道的——赌场的空气里会加入高浓度氧气 让你精神亢奋不容易疲劳', emotion: '爆料' },
      { characterId: 'kellyprof', line: '氧气那个说法有争议 但确实有赌场使用特定气味来增强兴奋感。更确定的是：赌场的声光效果——中奖的音效和闪光——会持续刺激你的多巴胺系统', emotion: '科学' },
    ],
    resolution: {
      junshiTrigger: false,
      compromise: '三人从内部经验、行为科学、个人体验三个维度揭示了赌场如何通过环境设计来操控赌客的时间感知和行为',
    },
  },

  // ──────────────────────────────────────────
  // 场景50：最后一个问题——你还会赌吗 — 全员圆桌
  // ──────────────────────────────────────────
  {
    id: 'conflict_final_question_001',
    topic: '说实话，你以后还会赌吗？',
    characters: ['aqiang', 'laoliu', 'laozhang', 'gailv', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['还会赌', '以后', '未来', '打算', '计划', '怎么想', '接下来'],
    userEmotionMatch: ['反思', '好奇', '总结'],
    openingLines: {
      aqiang: '...你问我？我说不赌了你信吗？连我自己都不信',
      laozhang: '我不敢说"不会"。我只能说今天没赌。明天的事...明天再说',
      laoliu: '我不想赌了。真的不想了。但我不确定我能不能做到',
    },
    escalation: [
      { characterId: 'gailv', line: '从统计上看，问题赌客的终身复发率超过50%。这不是意志力问题，是生理和心理的双重困境', emotion: '冷静' },
      { characterId: 'aqiang', line: '你这么说让人更绝望啊...', emotion: '沮丧' },
      { characterId: 'laozhang', line: '50%也意味着另外50%的人做到了。关键是——你得真心想停 而不是"应该"停', emotion: '智慧' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '没有人能保证"永远不赌"。但你可以做的是：理解赌博的数学真相、识别自己的触发因素、建立支持系统、寻求专业帮助。戒赌不是一个终点，是一个每天都要做的选择。你不需要完美——你只需要今天不赌',
    },
  },
];

// 合并所有场景
export const SEED_SCENARIOS: ConflictScenario[] = [...BASE_SCENARIOS, ...EXPANDED_SCENARIOS];

// 场景匹配函数
export function matchScenario(
  userMessage: string,
  roomCharacters: string[],
  _recentMessages?: unknown[],
): ConflictScenario | null {
  const msg = userMessage.toLowerCase();
  let bestMatch: ConflictScenario | null = null;
  let bestScore = 0;

  for (const scenario of SEED_SCENARIOS) {
    // 场景中的角色必须在房间里
    const charsInRoom = scenario.characters.filter(c => roomCharacters.includes(c));
    if (charsInRoom.length < 2) continue;

    // 关键词匹配计分
    let score = 0;
    for (const kw of scenario.triggerKeywords) {
      if (msg.includes(kw)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = scenario;
    }
  }

  // 至少命中1个关键词才返回
  return bestScore >= 1 ? bestMatch : null;
}
