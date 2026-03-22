import type { ConflictScenario } from '../types/room';

// ============================================================
// 扩展场景 — 赌城风云 / 体育博彩 / 德州扑克 / 生活情感
// ============================================================

export const EXPANDED_SCENARIOS: ConflictScenario[] = [
  // ══════════════════════════════════════════
  // 赌城风云 — 全球赌博目的地
  // ══════════════════════════════════════════

  {
    id: 'dest_macau_001',
    topic: '澳门赌场为什么总让人想再去？',
    category: '赌城风云',
    subcategory: '澳门',
    characters: ['aqiang', 'ajie', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['澳门', '葡京', '威尼斯人', '金沙', '永利', '新濠', '路氹', '赌厅'],
    userEmotionMatch: ['怀念', '好奇', '向往'],
    openingLines: {
      aqiang: '澳门那氛围你去了就知道 灯光筹码美女 一进去血就热了 根本停不下来',
      ajie: '澳门赌场的设计就是为了让你忘记时间——没窗户、没时钟、免费酒水、到处是ATM。每个细节都在剥你的钱',
      junshi: '澳门博彩业2023年收入超过330亿美元。这笔钱从哪来？每一个"想再去"的赌客贡献的',
    },
    escalation: [
      { characterId: 'aqiang', line: '但澳门确实能赢钱啊 我上次去赢了三万块 吃了顿好的 那感觉爽翻了', emotion: '得意' },
      { characterId: 'ajie', line: '你赢三万的那次，前后去了几次？总账算过吗？', emotion: '揭穿' },
      { characterId: 'aqiang', line: '……那不一样 赢的时候是技术 输的时候是运气不好', emotion: '狡辩' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '澳门赌场用的是"间歇性强化"——偶尔让你赢，让你大脑分泌多巴胺。这跟老虎机的设计原理一模一样。你觉得是"想再去"，其实是大脑成瘾回路在驱动你',
    },
  },

  {
    id: 'dest_macau_vip_001',
    topic: '澳门贵宾厅和普通厅差别有多大？',
    category: '赌城风云',
    subcategory: '澳门',
    characters: ['ajie', 'aqiang', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['贵宾厅', 'VIP', '叠码', '洗码', '转码', '普通厅', '大厅', '高端厅'],
    userEmotionMatch: ['好奇', '向往', '质疑'],
    openingLines: {
      ajie: '贵宾厅的水深得你想不到。叠码仔拿佣金、放高利贷、还帮你"安排"一切——本质是让你借更多输更多',
      aqiang: '哥们进过一次贵宾厅 那待遇真不一样 专人伺候 茶水点心 赢了直接转账',
      kellyprof: '贵宾厅的庄家优势和普通厅完全一样，但最低下注额高10-100倍。高端体验的本质是加速你的资金消耗速度',
    },
    escalation: [
      { characterId: 'aqiang', line: '但贵宾厅返水高啊 赌得多返得多 等于打折赌', emotion: '精明' },
      { characterId: 'kellyprof', line: '返水0.8%-1.2%，庄家优势1.06%-5.26%。你返回来的永远比你多输的少。这就是数学', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '贵宾厅的商业模式：用豪华体验降低你对输钱的敏感度。你以为自己是VIP被优待，其实你是被精准收割的大鱼',
    },
  },

  {
    id: 'dest_vegas_001',
    topic: '第一次去拉斯维加斯该怎么玩？',
    category: '赌城风云',
    subcategory: '拉斯维加斯',
    characters: ['aqiang', 'gailv', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['拉斯维加斯', 'vegas', 'las vegas', '美国赌场', '大道', 'strip', 'MGM', '凯撒', '百乐宫'],
    userEmotionMatch: ['兴奋', '计划', '好奇'],
    openingLines: {
      aqiang: 'Vegas是男人的天堂！我建议带个预算 输完就停 不要用信用卡取现 切记切记',
      gailv: '拉斯维加斯的赌场数学和澳门一样——庄家永远赢。但Vegas的真正价值是秀、美食和体验。把赌当娱乐预算就行',
      junshi: '统计显示去Vegas的游客平均赌博预算是580美元，但实际平均花费超过800美元。设预算容易，守预算难',
    },
    escalation: [
      { characterId: 'aqiang', line: '对对对 千万别去Vegas大道两头的小赌场 赔率低得离谱 要玩就去百乐宫MGM这种大的', emotion: '老练' },
      { characterId: 'gailv', line: '你说的"赔率低"其实区别不大。大赌场老虎机RTP 92-95%，小赌场88-92%，都是负期望值', emotion: '纠正' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'Vegas的正确打开方式：把赌博预算当"门票钱"，输完不补。重点享受演出、美食、沙漠风光。你交的"门票钱"正好是赌场给你提供这些体验的成本',
    },
  },

  {
    id: 'dest_singapore_001',
    topic: '新加坡赌场对本地人收入场费，为什么？',
    category: '赌城风云',
    subcategory: '新加坡',
    characters: ['gailv', 'kellyprof', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['新加坡', '金沙', '圣淘沙', '入场费', 'marina bay', '滨海湾'],
    userEmotionMatch: ['好奇', '了解', '讨论'],
    openingLines: {
      gailv: '新加坡本地人进赌场要交150新元入场费。这是政府用经济手段抑制赌博的典型案例',
      kellyprof: '入场费本质上是一种"后悔税"——它提高了赌博的沉没成本，但对重度赌客来说这点门槛根本没用',
      junshi: '新加坡模式值得研究：允许赌场存在以吸引旅游收入，但用入场费+自我排除机制保护本国公民。算是一种平衡',
    },
    escalation: [
      { characterId: 'gailv', line: '数据显示入场费实施后新加坡本地赌客确实减少了。但重度赌客该去的还是去——150块对他们来说就是一把百家乐的事', emotion: '客观' },
      { characterId: 'kellyprof', line: '而且外国游客不收费，赌场的主要利润来源是高端外国赌客。入场费对赌场营收影响有限', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '新加坡的做法是现实主义：既不禁赌（禁不了），也不放任（代价太大）。入场费把轻度赌客挡在门外，但对真正有赌瘾的人，这是杯水车薪',
    },
  },

  {
    id: 'dest_manila_001',
    topic: '马尼拉赌场安全吗？值得去吗？',
    category: '赌城风云',
    subcategory: '马尼拉',
    characters: ['aqiang', 'ajie', 'junshi'],
    type: '混战',
    triggerKeywords: ['马尼拉', '菲律宾', '岷里拉', 'okada', 'solaire', 'city of dreams', '云顶世界'],
    userEmotionMatch: ['担心', '好奇', '计划'],
    openingLines: {
      aqiang: '马尼拉赌场便宜啊 消费低 赌桌最低100比索就能玩 穷人的Vegas',
      ajie: '马尼拉赌场的安全问题真不是开玩笑——抢劫、绑架、高利贷追债。2017年Resorts World放火事件还记得吗',
      junshi: '菲律宾PAGCOR监管的正规赌场安全性可以保证，但周边环境和非法赌场是真正的风险区',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你去大赌场不就行了嘛 Solaire Okada 跟澳门一样正规的', emotion: '反驳' },
      { characterId: 'ajie', line: '赌场内安全，但你出了门呢？半夜打车回酒店的路上呢？赢了钱被人盯上呢？', emotion: '警告' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '马尼拉的大型正规赌场（Solaire/Okada/COD）安全标准和澳门差不多。但周边治安、交通、以及被人尾随的风险确实存在。如果去，住赌场酒店、别炫富、别单独行动',
    },
  },

  {
    id: 'dest_cambodia_001',
    topic: '柬埔寨赌场的水有多深？',
    category: '赌城风云',
    subcategory: '柬埔寨',
    characters: ['ajie', 'xiaotian', 'junshi'],
    type: '混战',
    triggerKeywords: ['柬埔寨', '金边', '西港', '西哈努克', '园区', '电诈', '诈骗园区'],
    userEmotionMatch: ['震惊', '好奇', '恐惧'],
    openingLines: {
      ajie: '柬埔寨的赌场分两种：正规的金界娱乐城，和西港那些跟电诈园区混在一起的黑赌场。后者去了可能出不来',
      xiaotian: '很多人不知道 西港那些"赌场"其实是电信诈骗公司的掩护。招聘"荷官"进去就被控制了',
      junshi: '柬埔寨赌博业和电信诈骗的纠缠是这几年东南亚最大的安全议题之一。2023年柬埔寨关闭了数十家非法网赌',
    },
    escalation: [
      { characterId: 'ajie', line: '有朋友被人骗去柬埔寨"做客服" 其实是去诈骗园区 护照被收走 打人关小黑屋', emotion: '愤怒' },
      { characterId: 'xiaotian', line: '不光柬埔寨 缅甸老挝都是重灾区。只要看到"月薪3万、包吃住、做客服"就要小心', emotion: '警告' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '柬埔寨赌博业的问题不是赌博本身，而是它和有组织犯罪、人口贩卖、电信诈骗的深度绑定。如果非要去赌，只去金边的正规持牌赌场。西港和其他小城镇的"赌场"，远离',
    },
  },

  {
    id: 'dest_vietnam_001',
    topic: '越南赌场为什么那么多中国人？',
    category: '赌城风云',
    subcategory: '越南',
    characters: ['aqiang', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['越南', '下龙湾', '岘港', '芒街', '越南赌场', '皇冠', 'corona'],
    userEmotionMatch: ['好奇', '了解'],
    openingLines: {
      aqiang: '越南赌场离中国近啊 广西过去几个小时 芒街那边一堆中国赌客',
      ajie: '越南赌场很多是中国资本投的。本地人不让赌，目标客户就是中国人和韩国人',
      gailv: '越南赌博市场2019年估计超过10亿美元。Corona赌场2019年才开始允许越南本地人进入——之前只对外国人开放',
    },
    escalation: [
      { characterId: 'aqiang', line: '边境那些小赌场我劝你别去 全是套路 赢了不让走 输了还借你钱', emotion: '警告' },
      { characterId: 'ajie', line: '对 正规的就那几家 边境的基本都是中国人开的灰色赌场 出了事没人管你', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '越南赌场市场的本质：利用地理优势吸引中国赌客消费。正规赌场（如富国岛Corona）是合法经营；但边境地区的小赌场大多处于监管灰色地带，风险很高',
    },
  },

  {
    id: 'dest_cruise_001',
    topic: '赌船/邮轮赌场是什么体验？',
    category: '赌城风云',
    subcategory: '赌船',
    characters: ['aqiang', 'gailv', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['赌船', '邮轮', '公海', '云顶梦号', '游轮赌场', '公海赌博'],
    userEmotionMatch: ['好奇', '兴奋'],
    openingLines: {
      aqiang: '赌船那是真舒服 出了公海就开赌 吃喝玩乐全包 跟度假一样',
      gailv: '邮轮赌场的赔率通常比陆地赌场更差。RTP更低、规则更偏向庄家，因为你没法去隔壁比价',
      kellyprof: '邮轮赌场利用了"封闭环境效应"——你在海上无处可去，闲得无聊就会赌。这和赌场不放窗户是一个道理',
    },
    escalation: [
      { characterId: 'aqiang', line: '但邮轮的好处是你的赌博预算自然被限制了——船上又不能取现', emotion: '乐观' },
      { characterId: 'kellyprof', line: '别天真了。邮轮赌场现在都有刷卡消费系统，信用卡分分钟刷爆', emotion: '拆穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌船的商业逻辑：用低价船票吸引你上船，然后在封闭环境中最大化你的消费。赌博收入是邮轮公司第二大利润来源。真想享受邮轮，把赌场预算设死然后去看海',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩
  // ══════════════════════════════════════════

  {
    id: 'sports_profit_001',
    topic: '体育博彩能不能长期盈利？',
    category: '体育博彩',
    subcategory: '综合',
    characters: ['gailv', 'aqiang', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['体育博彩', '赌球', '盈利', '长期赢', '职业玩家', '水位', '赔率'],
    userEmotionMatch: ['幻想', '好奇', '不服'],
    openingLines: {
      gailv: '体育博彩和赌场游戏有本质区别——你赌的是信息差而不是纯随机。理论上存在正期望值的机会',
      aqiang: '赌球我也玩过 分析了一堆数据还是输 感觉全靠运气 什么分析都白搭',
      kellyprof: '职业体育博彩者存在但极少。他们靠的是：赔率建模、海量数据、纪律性下注、和利用菠菜公司的定价失误',
    },
    escalation: [
      { characterId: 'aqiang', line: '那些自称职业赌球的 十个有九个是骗人的 真赢钱的谁会到处说', emotion: '怀疑' },
      { characterId: 'kellyprof', line: '正确。但不代表不存在。关键区别在于：业余玩家赌比赛结果，职业玩家赌赔率的定价错误', emotion: '精准' },
      { characterId: 'gailv', line: '而且菠菜公司也不傻。一旦发现你持续盈利，就会限制你的投注额或者封号', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '体育博彩长期盈利理论上可能但实践中极难：你要比菠菜公司更会定价、要有足够本金承受方差、还要面对被限额封号的风险。99%的人做不到。把它当娱乐，设预算，别当投资',
    },
  },

  {
    id: 'sports_football_001',
    topic: '足球让球盘怎么看？新手能不能玩？',
    category: '体育博彩',
    subcategory: '足球',
    characters: ['aqiang', 'gailv', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['足球', '让球', '让球盘', '亚盘', '欧赔', '半球', '一球', '盘口'],
    userEmotionMatch: ['困惑', '学习', '好奇'],
    openingLines: {
      aqiang: '让球盘我研究了好久 什么半球、一球、球半 看得头都大了 但搞明白了确实比猜输赢有意思',
      gailv: '亚洲让球盘的设计目的是让两队的投注比例接近50/50。菠菜公司通过调整盘口来平衡两边的资金',
      kellyprof: '新手常犯的错误：把让球盘当成预测。实际上盘口反映的不是比赛结果的概率，而是市场资金的流向',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你说为什么有时候强队让球却输了？是不是有人操盘？', emotion: '怀疑' },
      { characterId: 'gailv', line: '不一定操盘。足球比赛的随机性很高。一个红牌、一个点球就能改变结果。这就是为什么赌球难', emotion: '理性' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '足球让球盘是亚洲博彩市场的核心产品。新手要明白：盘口不是预测，是价格。你赌的不是谁赢，是当前价格是不是高估或低估了。如果你连这都没想清楚，那你就是在盲猜',
    },
  },

  {
    id: 'sports_nba_001',
    topic: 'NBA篮球博彩有没有稳赢的方法？',
    category: '体育博彩',
    subcategory: '篮球',
    characters: ['gailv', 'aqiang', 'junshi'],
    type: '混战',
    triggerKeywords: ['NBA', '篮球', '让分', '大小分', '总分', '季后赛', '常规赛', '球星'],
    userEmotionMatch: ['幻想', '好奇', '信心'],
    openingLines: {
      gailv: 'NBA的数据量巨大——每场有几百项统计。但菠菜公司的数据分析团队比你做得更好更快',
      aqiang: '我赌NBA有个心得：跟球星走 詹姆斯库里这种硬实力在那 买他们赢没错',
      junshi: '有一种方法叫"追蒸汽"——跟踪职业玩家的下注方向。但这需要极快的反应速度和多个账户',
    },
    escalation: [
      { characterId: 'aqiang', line: '不对 我有个朋友专赌大小分 说数据模型很准 一个赛季赢了好几万', emotion: '不服' },
      { characterId: 'gailv', line: '一个赛季？NBA常规赛82场×30队=1230场。赢好几万的样本量完全可能是运气', emotion: '拆穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'NBA博彩的"稳赢"方法不存在。最接近的是：建立统计模型→寻找赔率偏差→小额分散下注→严格资金管理。但即使这样，扣掉菠菜公司的抽水（通常5-10%），长期盈利的门槛非常高',
    },
  },

  {
    id: 'sports_esports_001',
    topic: '电竞博彩和传统体育博彩有什么不同？',
    category: '体育博彩',
    subcategory: '电竞',
    characters: ['xiaotian', 'gailv', 'ajie'],
    type: '混战',
    triggerKeywords: ['电竞', 'LOL', 'CS2', 'DOTA', '英雄联盟', '电子竞技', '菠菜', '外围'],
    userEmotionMatch: ['好奇', '年轻', '兴奋'],
    openingLines: {
      xiaotian: '电竞博彩这几年爆炸式增长。年轻人不看足球但看LOL，自然就赌到电竞了',
      gailv: '电竞博彩的赔率定价比传统体育更不成熟，理论上信息差更大。但同时假赛的风险也高得多',
      ajie: '电竞假赛是真的多。二三线战队收入低，被人收买打假赛太常见了',
    },
    escalation: [
      { characterId: 'xiaotian', line: '而且电竞的数据不像足球那么透明 很多比赛连回放都看不到 你怎么验证？', emotion: '担忧' },
      { characterId: 'gailv', line: '正因如此，电竞博彩的市场效率极低。有能力的人能找到套利机会，但普通人更容易被假赛坑', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '电竞博彩三大风险：假赛泛滥（尤其小比赛）、数据不透明、市场定价不稳定。如果你因为喜欢看电竞就想赌，请把预算控制在"门票钱"水平',
    },
  },

  {
    id: 'sports_parlay_001',
    topic: '串关（连串）为什么几乎不可能赢？',
    category: '体育博彩',
    subcategory: '综合',
    characters: ['gailv', 'kellyprof', 'aqiang'],
    type: '混战',
    triggerKeywords: ['串关', '连串', '复式', '过关', '多串一', '高赔率', '小博大'],
    userEmotionMatch: ['疑问', '不服', '好奇'],
    openingLines: {
      gailv: '串关是菠菜公司最赚钱的产品。4串1的实际中奖概率大约6.25%，但赔率折算后期望值远低于单场',
      kellyprof: '每多串一场，菠菜公司的抽水就乘一次。3串1抽水约15%，5串1约25%，10串1可以超过50%',
      aqiang: '但串关赔率高啊 我朋友10块钱中了8000 你说气不气人',
    },
    escalation: [
      { characterId: 'aqiang', line: '偶尔中一次那种快感 你不赌你体会不到', emotion: '兴奋' },
      { characterId: 'kellyprof', line: '你朋友中了一次8000，之前买了多少个10块？统计一下总投入总回报你就明白了', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '串关的数学本质：把多个低抽水的赌注叠加成一个高抽水的赌注，同时用高赔率的视觉吸引力掩盖极低的中奖概率。菠菜公司推串关的原因很简单——它是利润率最高的产品',
    },
  },

  {
    id: 'sports_worldcup_001',
    topic: '世界杯/大赛期间赌球为什么特别疯狂？',
    category: '体育博彩',
    subcategory: '足球',
    characters: ['aqiang', 'gailv', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['世界杯', '欧洲杯', '大赛', '决赛', '冠军', '买球', '看球赌球'],
    userEmotionMatch: ['兴奋', '从众', '冲动'],
    openingLines: {
      aqiang: '世界杯期间不赌两把都不好意思说自己看球！朋友圈都在晒单 群里天天分析',
      gailv: '大赛期间是菠菜公司的收割节。新用户涌入、冲动下注增加、信息质量却反而下降',
      laoliu: '我当年就是世界杯入的坑。本来就看个热闹 朋友说买个冠军玩玩 结果一发不可收拾 赌了四年才清醒',
    },
    escalation: [
      { characterId: 'aqiang', line: '大赛有什么不好？至少大赛的比赛质量高 数据多 总比赌二三线联赛靠谱', emotion: '辩解' },
      { characterId: 'laoliu', line: '我当年也是这么想的。从赌世界杯到赌欧冠，再到赌英超，最后连越南联赛都赌上了', emotion: '痛悔' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '大赛期间的博彩陷阱：社交压力（朋友都在赌）、过度自信（觉得自己懂球）、情感投入（支持的球队下注）。这三重偏差叠加，让人做出平时不会做的冲动决策',
    },
  },

  // ══════════════════════════════════════════
  // 德州扑克
  // ══════════════════════════════════════════

  {
    id: 'poker_gambling_001',
    topic: '德州扑克到底算不算赌博？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['kellyprof', 'aqiang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['德州扑克', '德扑', '技术', '技巧', '扑克', '不算赌', '牌技'],
    userEmotionMatch: ['辩论', '好奇', '不服'],
    openingLines: {
      kellyprof: '德州扑克是唯一一种长期数学期望值可以为正的"赌博"——前提是你的技术强于对手',
      aqiang: '扯淡 打德州也是赌钱 输了一样心痛 赢了一样上瘾 跟百家乐有什么区别',
      gailv: '区别在于：百家乐你对赌场，期望值永远为负。德扑你对其他玩家，赌场只收抽水。技术差距可以创造正期望',
    },
    escalation: [
      { characterId: 'aqiang', line: '那为什么打德州的人也有倾家荡产的？技术派不是应该赢吗', emotion: '质疑' },
      { characterId: 'kellyprof', line: '因为大部分人高估自己的技术。在低级别赢钱≠有技术。你可能只是比鱼大一点的鱼', emotion: '犀利' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '德州扑克的本质是"有技术成分的赌博"。职业玩家靠技术差距盈利——但你是不是职业水平？如果不是，那对你来说它就是纯赌博，而且抽水率还不低',
    },
  },

  {
    id: 'poker_online_offline_001',
    topic: '线上德州和线下牌局差别有多大？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['kellyprof', 'ajie', 'aqiang'],
    type: '混战',
    triggerKeywords: ['线上德州', '线下', '牌局', '私局', 'APP', '扑克之星', 'PokerStars'],
    userEmotionMatch: ['好奇', '比较'],
    openingLines: {
      kellyprof: '线上德州速度是线下的3-6倍——一小时能打100多手。这意味着你的盈亏速度也快6倍',
      ajie: '线上德州的问题是作弊太容易了。多开账号、使用辅助软件、甚至合谋。你根本不知道对手在用什么',
      aqiang: '线下打牌有感觉 能看到对手表情 抖腿啊摸鼻子啊 这些线上都没有',
    },
    escalation: [
      { characterId: 'ajie', line: '我知道有人用HUD软件实时分析对手的数据 你以为你在打牌 其实你在跟AI打', emotion: '揭露' },
      { characterId: 'kellyprof', line: '正规平台禁止辅助软件 但执行力参差不齐。这也是为什么线上扑克的生态在恶化', emotion: '客观' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '线上vs线下核心区别：速度（线上快得多→方差更大）、信息（线上无表情读取）、公平性（线上作弊风险更高）。新手建议从低额线下开始，理解基本策略再上线',
    },
  },

  {
    id: 'poker_private_game_001',
    topic: '打私人德州局容易遇到什么坑？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['ajie', 'aqiang', 'junshi'],
    type: '混战',
    triggerKeywords: ['私局', '私人局', '朋友局', '地下', '组局', '出老千', '做局'],
    userEmotionMatch: ['警惕', '好奇', '受骗'],
    openingLines: {
      ajie: '私人局是赌博圈最大的坑之一。组局的人抽水高、有人出老千、赢了钱收不回来',
      aqiang: '我打过几次私人局 有好有坏 关键是看谁组的。朋友介绍的一般还行 陌生人的别去',
      junshi: '私人局没有任何监管，一切靠人品。而在赌桌上，人品是最不可靠的东西',
    },
    escalation: [
      { characterId: 'ajie', line: '最常见的坑：组局的人和某个玩家是一伙的 合谋夹你。你以为在跟5个人打 其实在跟2个人打', emotion: '揭穿' },
      { characterId: 'aqiang', line: '还有一种 看你赢多了就不让走 说要给大家机会翻本。你不打就撕破脸', emotion: '经历' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '私人局三大风险：合谋（组局者和某人串通）、出老千（标记牌、底牌交换）、收不回钱（赢了对方赖账或翻脸）。如果要打，只打自己组的局，且金额别超过你愿意送人的额度',
    },
  },

  // ══════════════════════════════════════════
  // 赌徒情感/生活
  // ══════════════════════════════════════════

  {
    id: 'life_bigwin_001',
    topic: '赌博赢了大钱之后会怎样？',
    category: '赌徒心理',
    subcategory: '心态',
    characters: ['aqiang', 'laoliu', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['赢了大钱', '赢钱', '暴富', '赢了十万', '赢了百万', '大赢'],
    userEmotionMatch: ['幻想', '经历', '好奇'],
    openingLines: {
      aqiang: '赢大钱那一刻 真的觉得自己是天选之人 世界都亮了 觉得以后可以靠赌发财了',
      laoliu: '我赢过最多一次是五十万。然后用了三年全部输回去 还倒贴了二十万',
      junshi: '研究显示：赌博早期的一次大赢是最危险的事件——它植入了"我能赢"的信念，成为日后成瘾的种子',
    },
    escalation: [
      { characterId: 'aqiang', line: '反正赢了的感觉是真的好 比工作赚钱爽一百倍 一个月工资一把就赚到了', emotion: '沉迷' },
      { characterId: 'laoliu', line: '你说的那种感觉 就是多巴胺在骗你。等你输的时候 那种痛苦是赢的快乐的两倍', emotion: '过来人' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '心理学上把这叫"初始大赢效应"。早期赢钱→建立"能赢"信念→增加投注→遇到必然的均值回归→追损→螺旋下坠。大部分病理性赌徒的故事都始于一次令人难忘的大赢',
    },
  },

  {
    id: 'life_spouse_001',
    topic: '另一半知道你赌博了怎么办？',
    category: '赌债人生',
    subcategory: '家庭关系',
    characters: ['xiaofang', 'laoliu', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['老婆知道', '老公知道', '被发现', '瞒不住', '坦白', '隐瞒', '吵架'],
    userEmotionMatch: ['恐惧', '绝望', '纠结'],
    openingLines: {
      xiaofang: '被发现的那一刻比输钱更痛苦。信任碎了就是碎了 不是你说几句好话能粘回来的',
      laoliu: '我当年被老婆发现的时候 她整个人都崩了。不是因为钱 是因为我骗了她三年',
      laozhang: '坦白虽然痛苦但是戒赌的第一步。很多人就是因为一直瞒着 越陷越深 因为没人拉你一把',
    },
    escalation: [
      { characterId: 'xiaofang', line: '最可怕的不是赌输了多少 是他还在骗我"已经戒了" 然后又去赌', emotion: '心寒' },
      { characterId: 'laoliu', line: '说实话 赌博的人骗家人跟喝水一样自然。不是我们想骗 是停不下来了 说出来也没用', emotion: '羞愧' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '被发现后最重要的事：1. 承认全部事实（不要只承认一部分）2. 主动交出财务控制权 3. 寻求专业帮助（GA/心理咨询）4. 接受对方的愤怒和失望——这是修复信任的必经之路',
    },
  },

  {
    id: 'life_lonely_001',
    topic: '赌博的人为什么越来越孤僻？',
    category: '赌徒心理',
    subcategory: '情绪',
    characters: ['laoliu', 'laozhang', 'xiaofang'],
    type: '圆桌',
    triggerKeywords: ['孤僻', '孤独', '不想社交', '一个人', '封闭', '朋友少了', '不出门'],
    userEmotionMatch: ['孤独', '共鸣', '自省'],
    openingLines: {
      laoliu: '赌到后来 朋友一个个远离你。不是他们薄情 是你借了太多钱没还 谁还敢跟你来往',
      laozhang: '赌博造成的社交退缩有两个原因：羞耻感让人回避社交、赌博本身占用了所有的时间和注意力',
      xiaofang: '赌博的人最后都活在自己的世界里。家里的事不管、孩子不问、朋友不联系。整个人就像被赌场吸走了灵魂',
    },
    escalation: [
      { characterId: 'laoliu', line: '到后来我只有两种状态：在赌 或者在想怎么搞到钱去赌。其他一切都变成了障碍', emotion: '反思' },
      { characterId: 'laozhang', line: '社交退缩是赌博成瘾的信号之一。如果你发现自己开始找借口不见朋友 要警觉', emotion: '专业' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博→负债→羞耻→隐瞒→社交退缩→孤独→用赌博填补孤独→继续赌博。这是一个自我强化的恶性循环。打破它的方法不是靠意志力，是靠外部支持——家人、朋友、专业咨询',
    },
  },

  {
    id: 'life_insomnia_001',
    topic: '输了钱晚上睡不着怎么办？',
    category: '赌徒心理',
    subcategory: '情绪',
    characters: ['laoliu', 'laozhang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['睡不着', '失眠', '焦虑', '辗转反侧', '心烦', '后悔', '想不开'],
    userEmotionMatch: ['焦虑', '痛苦', '失眠'],
    openingLines: {
      laoliu: '输了钱那种感觉 躺在床上翻来覆去 脑子里全是"如果当时……" 恨不得时间倒流',
      laozhang: '赌后失眠非常常见。大脑处于应激状态——皮质醇升高、交感神经兴奋、无法进入放松模式',
      junshi: '这个时候千万不要做的事：在深夜打开手机去"翻本"。90%的灾难性决策都在失眠的深夜做出的',
    },
    escalation: [
      { characterId: 'laoliu', line: '最可怕的是半夜三点爬起来继续赌。想着输都输了不差这点 结果越输越多', emotion: '痛悔' },
      { characterId: 'laozhang', line: '这种冲动来自大脑的"行动倾向"——焦虑状态下人倾向于做点什么来缓解不适。但赌博只会加剧焦虑', emotion: '解释' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '输钱失眠的应对：1. 把手机锁到另一个房间 2. 接受"已经输了"这个事实（改变不了的事不值得焦虑）3. 算一笔总账让自己清醒 4. 如果连续失眠超过一周，去看医生',
    },
  },

  {
    id: 'life_casino_friends_001',
    topic: '赌场里交到的朋友是真朋友吗？',
    category: '赌徒心理',
    subcategory: '社交',
    characters: ['aqiang', 'ajie', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['赌友', '赌场朋友', '牌友', '赌桌朋友', '一起赌', '借钱'],
    userEmotionMatch: ['困惑', '失望', '反思'],
    openingLines: {
      aqiang: '赌场里的兄弟 赢的时候一起喝酒庆祝 输的时候一起骂娘。这不是真感情是什么？',
      ajie: '赌场友谊的保质期等于你口袋里钱的数量。钱没了 友谊也就没了',
      laoliu: '我在赌场认识的所谓兄弟 有三个跟我借了钱消失的 有两个带我去更大的赌局坑我的',
    },
    escalation: [
      { characterId: 'aqiang', line: '那也不能一棍子打死啊 我确实有几个赌场认识的好兄弟 到现在还来往', emotion: '不服' },
      { characterId: 'laoliu', line: '你等着吧。等你输到底的时候 看看这些好兄弟还在不在', emotion: '过来人' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌场社交的本质是"共同利益绑定"——你们分享的是赌博这个活动，而不是真正的情感连接。真正的友谊经得起"不赌了还能不能做朋友"这个测试',
    },
  },

  // ══════════════════════════════════════════
  // 骗局揭秘 — 新增
  // ══════════════════════════════════════════

  {
    id: 'scam_betting_tips_001',
    topic: '收费"内幕消息"和赌球推荐靠谱吗？',
    category: '骗局揭秘',
    subcategory: '带单诈骗',
    characters: ['dashiwang', 'gailv', 'ajie'],
    type: '混战',
    triggerKeywords: ['内幕', '推荐', '收费', '包赢', '带单', '料', '内部消息', '老师'],
    userEmotionMatch: ['怀疑', '受骗', '好奇'],
    openingLines: {
      dashiwang: '我跟你讲 这行有真料的 关键是找对人。免费的当然不行 付费的才靠谱——你懂的 好东西要付费',
      gailv: '如果有人真有稳赢的内幕消息 他为什么不自己下注而要卖给你？因为他卖消息比赌博赚得更多更稳',
      ajie: '这些所谓的"老师"套路都一样：先给你几个免费的赢了建立信任 然后收费推荐 最后你输了他拉黑你',
    },
    escalation: [
      { characterId: 'dashiwang', line: '有些是真有渠道的 你不能因为有骗子就否认整个行业', emotion: '狡辩' },
      { characterId: 'gailv', line: '逻辑很简单：如果一个人每天推荐5场 随机推50%也能对2-3场。然后他只展示对的那几场给你看', emotion: '数学' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '收费推荐的商业模式：大量推荐→筛选展示→建立虚假信任→收费→你输了他不负责。这不是信息服务，是概率游戏+营销骗局的结合体',
    },
  },

  // ══════════════════════════════════════════
  // 网赌江湖 — 新增
  // ══════════════════════════════════════════

  {
    id: 'online_live_dealer_001',
    topic: '网赌的"真人荷官"到底是不是真人？',
    category: '网赌江湖',
    subcategory: '平台套路',
    characters: ['xiaotian', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['真人荷官', '视频', '直播', '实时', '真人百家乐', '录像'],
    userEmotionMatch: ['怀疑', '好奇'],
    openingLines: {
      xiaotian: '大部分正规平台的真人荷官确实是真人——从菲律宾或柬埔寨的摄影棚直播。但视频延迟可以被利用',
      ajie: '有些小平台用的是录播视频+RNG结果。你以为在看直播 其实在看录像 结果是系统算好的',
      gailv: '即使是真人荷官 结果也是随机的——跟RNG没有数学差别。区别在于你心理上更信任"看到真人发牌"',
    },
    escalation: [
      { characterId: 'ajie', line: '更狠的是有些平台 同一个荷官画面同时给不同用户显示不同结果。技术上完全做得到', emotion: '揭露' },
      { characterId: 'gailv', line: '所以你信不信真人根本不重要。重要的是平台有没有合规牌照和第三方审计', emotion: '理性' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '真人荷官的信任感是营销工具。无论真人还是RNG 结果都是随机的 庄家优势都存在。区别在于：正规持牌平台有第三方审计 结果可追溯；无牌平台则可以随意操控',
    },
  },

  {
    id: 'online_withdrawal_tricks_001',
    topic: '网赌平台为什么总是提现困难？',
    category: '网赌江湖',
    subcategory: '灰控提款',
    characters: ['ajie', 'xiaotian', 'aqiang'],
    type: '混战',
    triggerKeywords: ['提现', '提不出来', '出金', '流水', '审核', '风控', '冻结', '维护'],
    userEmotionMatch: ['愤怒', '受骗', '无助'],
    openingLines: {
      ajie: '提现难是网赌平台的核心套路。它靠的就是你的钱进来出不去',
      xiaotian: '常见手段：流水不够不让提、风控审核无限期、银行维护、账户异常需验证……总之就是拖到你把钱赌完',
      aqiang: '我有一次赢了八千 提现时让我完成15倍流水 算了一下要再赌12万才能提 不是逗我吗',
    },
    escalation: [
      { characterId: 'aqiang', line: '最气人的是 充钱的时候秒到 提钱的时候3-5个工作日 到了又说系统维护', emotion: '愤怒' },
      { characterId: 'ajie', line: '设计如此。充值通道是自动化的 提现通道是人工审核的。速度不对称就是为了让你等不及继续赌', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '提现困难不是技术问题 是商业模式。网赌平台的利润公式：充值额 - 提现额 = 利润。所以它的一切设计都在最大化充值、最小化提现。如果一个平台让你提现很困难 说明它根本不打算让你拿到钱',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 新增（轮盘、骰宝）
  // ══════════════════════════════════════════

  {
    id: 'casino_roulette_001',
    topic: '轮盘赌有没有必赢的投注策略？',
    category: '赌场游戏',
    subcategory: '轮盘',
    characters: ['gailv', 'kellyprof', 'aqiang'],
    type: '混战',
    triggerKeywords: ['轮盘', '轮盘赌', '红黑', '单双', '马丁格尔', '倍投'],
    userEmotionMatch: ['好奇', '幻想', '不服'],
    openingLines: {
      gailv: '轮盘赌的庄家优势来自那个绿色的0（欧式2.7%，美式5.26%两个0）。任何策略都改变不了这个基础数学',
      kellyprof: '马丁格尔策略（输了翻倍）在轮盘上特别流行也特别致命——因为桌面上限会在你翻倍到第7-8次时封顶',
      aqiang: '红黑交替下注 看趋势打 连开5个红就压黑 这招我试过挺准',
    },
    escalation: [
      { characterId: 'gailv', line: '连开5个红之后 下一把开红和开黑的概率完全相同 都是48.6%。轮盘没有记忆', emotion: '纠正' },
      { characterId: 'aqiang', line: '但我亲眼看到连开15个红的！这不正常吧？赌场是不是做了手脚？', emotion: '怀疑' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '连开15个红的概率约1/32768 看起来极小但轮盘每天转几千次 偶尔出现极端序列完全正常。你觉得"不正常"是因为赌徒谬误——认为随机事件应该"均衡"',
    },
  },

  {
    id: 'casino_sicbo_001',
    topic: '骰宝（大小）是不是最简单的赌博？',
    category: '赌场游戏',
    subcategory: '骰宝',
    characters: ['aqiang', 'gailv', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['骰宝', '大小', '骰子', '三粒骰', '买大买小', '围骰'],
    userEmotionMatch: ['好奇', '简单', '新手'],
    openingLines: {
      aqiang: '骰宝最简单了 买大买小 50/50 新手入门最好的赌博',
      gailv: '骰宝买大小看起来50/50 但围骰（三个一样）通杀。实际赔率不是50/50 是48.6% 庄家优势2.78%',
      junshi: '"简单"恰恰是骰宝的设计意图——降低参与门槛 让更多人更快地坐下来赌',
    },
    escalation: [
      { characterId: 'aqiang', line: '围骰多少年遇不到一次 不用担心这个 大小基本就是对半开', emotion: '不以为然' },
      { characterId: 'gailv', line: '围骰出现概率2.78% 大约每36局出一次。如果你玩一个小时 大概率遇到2-3次', emotion: '数据' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '骰宝"简单"的代价：下注种类多但高赔率选项的庄家优势极高（围骰特定赔率的庄家优势超过30%）。新手被"大小"吸引进来 然后被高赔率选项诱惑 这是经典的漏斗设计',
    },
  },

  // ══════════════════════════════════════════
  // 赌债人生 — 新增
  // ══════════════════════════════════════════

  {
    id: 'debt_recovery_001',
    topic: '赌博欠的钱到底能不能还清？',
    category: '赌债人生',
    subcategory: '债务危机',
    characters: ['laoliu', 'xiaofang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['还钱', '还债', '债务', '欠款', '分期', '还清', '窟窿'],
    userEmotionMatch: ['绝望', '求助', '焦虑'],
    openingLines: {
      laoliu: '我欠了四十多万 现在每月工资一分不剩全还债。还了两年才还了十万多。有时候真想不开',
      xiaofang: '他欠的钱一半是借的一半是网贷。利息比本金都高 越还越多 我看不到头',
      junshi: '还清债务的关键不是赚更多钱 而是：停止赌博+理清所有债务+制定可执行的还款计划+必要时寻求法律帮助协商减免',
    },
    escalation: [
      { characterId: 'laoliu', line: '有时候会想 要不再赌一次 赢了就能一次还清。这种想法挥之不去', emotion: '挣扎' },
      { characterId: 'junshi', line: '这就是赌博成瘾的核心陷阱——"再赌一次就能解决所有问题"。你的债务就是这么从5万变成40万的', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌债能还清 但前提是彻底停赌。实际步骤：1.列出所有债务（金额+利率+还款期限）2.优先还高利率的 3.和债主协商减免或延期 4.网贷利率超过法定标准的可以不还超出部分 5.每月留出基本生活费 剩余全部还债',
    },
  },

  {
    id: 'life_quit_relapse_001',
    topic: '戒赌为什么总是失败？怎么才能不复赌？',
    category: '赌债人生',
    subcategory: '戒赌故事',
    characters: ['laozhang', 'laoliu', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['戒赌', '复赌', '又赌了', '忍不住', '戒不掉', '坚持', '复发'],
    userEmotionMatch: ['挫败', '求助', '痛苦'],
    openingLines: {
      laozhang: '赌博成瘾和药物成瘾的复发率差不多——约40-60%。戒赌失败不代表你没希望 它只是治疗过程的一部分',
      laoliu: '我戒过七次 每次都觉得这次是真的 最长坚持了八个月 然后一次吵架就复赌了',
      aqiang: '说实话 我不觉得自己有瘾。我就是偶尔玩玩 控制得住……大部分时候',
    },
    escalation: [
      { characterId: 'laoliu', line: '阿强你那就是典型的否认阶段。我以前也说过一模一样的话——"我控制得住"', emotion: '共情' },
      { characterId: 'laozhang', line: '复赌的常见触发因素：情绪波动、无聊、接触赌博相关信息、酒精。识别你的触发因素是防复赌的关键', emotion: '专业' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '戒赌成功的关键：1.承认自己有瘾 2.切断所有赌博渠道（删APP、自我排除）3.找到替代活动 4.建立支持系统（GA/家人/治疗师）5.接受复发不等于失败——重要的是每次复发后更快回到正轨',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 百家乐专题
  // ══════════════════════════════════════════

  {
    id: 'casino_bac_road_001',
    topic: '百家乐看路打法有没有用？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['aqiang', 'gailv', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['看路', '大路', '珠盘路', '小路', '大眼仔', '曱甴路', '路纸', '趋势'],
    userEmotionMatch: ['好奇', '信仰', '不服'],
    openingLines: {
      aqiang: '看路是百家乐的基本功 大路小路大眼仔 连庄跳庄一目了然 不看路等于瞎赌',
      gailv: '百家乐每一靴牌都是独立事件。路纸只是历史记录 不能预测未来 跟天气预报看昨天穿什么衣服一样荒谬',
      kellyprof: '从信息论角度看 百家乐路纸的互信息量接近零。也就是说 过去的结果几乎不包含关于未来结果的信息',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你解释为什么有时候连庄连十几把？这不是趋势是什么？', emotion: '不服' },
      { characterId: 'gailv', line: '随机序列本来就会出现连串。抛硬币也会连续正面10次 这不代表第11次更可能正面', emotion: '教育' },
      { characterId: 'kellyprof', line: '数学上叫"聚类错觉"——人脑天生会在随机数据中找模式 即使模式不存在', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '百家乐看路的心理价值大于实际价值：它给你一种"有策略"的感觉 降低了赌博的焦虑感。但它改变不了庄家优势。路纸是赌场提供的工具——赌场会提供帮你赢钱的工具吗？',
    },
  },

  {
    id: 'casino_bac_banker_001',
    topic: '百家乐一直买庄是不是最优策略？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['gailv', 'aqiang', 'junshi'],
    type: '对峙',
    triggerKeywords: ['买庄', '庄赢', '庄家优势', '抽水', '闲赢', '庄闲', '佣金'],
    userEmotionMatch: ['好奇', '精明', '求证'],
    openingLines: {
      gailv: '纯数学角度 庄赢概率45.86% 闲赢44.62% 和局9.52%。买庄扣掉5%佣金后庄家优势1.06% 买闲1.24%。所以买庄确实更优',
      aqiang: '一直买庄多无聊啊 百家乐的乐趣就在于判断这把该买什么 你一直买庄跟机器人有什么区别',
    },
    escalation: [
      { characterId: 'aqiang', line: '而且你一直买庄 遇到闲连开十把 你受得了吗？心态早崩了', emotion: '实战' },
      { characterId: 'gailv', line: '受不了恰恰说明你不适合赌博。如果你连数学最优策略都执行不了 任何策略对你来说都没用', emotion: '犀利' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '一直买庄在数学上最优 但在心理上最难执行。这恰恰揭示了赌博的核心矛盾：最理性的策略往往最反人性。而赌场正是利用你的人性来赚钱的',
    },
  },

  {
    id: 'casino_bac_commission_001',
    topic: '免佣百家乐是不是更划算？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['ajie', 'gailv', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['免佣', '免水', '超级六', '免佣百家乐', '不抽水', '赔一半'],
    userEmotionMatch: ['好奇', '精明', '比较'],
    openingLines: {
      ajie: '免佣百家乐是赌场的障眼法。不收5%佣金但庄赢6点只赔一半 算下来庄家优势反而更高',
      gailv: '数据说话：传统百家乐庄家优势1.06% 免佣百家乐庄家优势1.46%。免佣反而多收你0.4%',
      kellyprof: '免佣设计利用了"损失厌恶"——人们对"被抽佣金"的厌恶大于对"偶尔少赔"的感知。行为经济学的经典应用',
    },
    escalation: [
      { characterId: 'ajie', line: '赌场推免佣桌是因为利润更高 不是因为对你更好。记住：赌场不做亏本生意', emotion: '揭穿' },
      { characterId: 'kellyprof', line: '而且免佣桌节奏更快——不用算佣金 每小时多打几手 赌场单位时间收入更高', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '免佣百家乐就是一个营销话术。"免佣"听起来是福利 实际上是加价。赌场用"免费"吸引你 然后用隐藏成本收割你。跟"免费WiFi"的商业逻辑一模一样',
    },
  },

  {
    id: 'casino_bac_counting_001',
    topic: '百家乐能不能像21点那样算牌？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['kellyprof', 'aqiang', 'gailv'],
    type: '混战',
    triggerKeywords: ['算牌', '记牌', '数牌', '牌计数', '优势赌博', '剩余牌'],
    userEmotionMatch: ['好奇', '幻想', '学习'],
    openingLines: {
      kellyprof: '理论上百家乐可以算牌 但效率极低。21点算牌的玩家优势可达1-2% 百家乐算牌的优势不到0.01%',
      aqiang: '我听说有人百家乐算牌赢了大钱 是不是真的？',
      gailv: '百家乐每靴8副牌 出到75%才切牌 剩余牌的信息量太小。你需要连续坐几百靴才可能有微弱优势 完全不现实',
    },
    escalation: [
      { characterId: 'aqiang', line: '那为什么赌场还是怕算牌的人？很多赌场禁止算牌', emotion: '质疑' },
      { characterId: 'kellyprof', line: '赌场禁的是21点算牌 不是百家乐。百家乐算牌赌场根本不在乎 因为数学上没威胁', emotion: '纠正' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '百家乐算牌在理论上可行但在实践中毫无意义。投入产出比太低——你花几百小时算牌获得的微小优势 还不如去打工赚得多。这不是技术问题 是经济学问题',
    },
  },

  {
    id: 'casino_bac_dragon_001',
    topic: '百家乐"龙"出现的时候该怎么打？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['aqiang', 'gailv', 'junshi'],
    type: '混战',
    triggerKeywords: ['龙', '长龙', '断龙', '跟龙', '追龙', '连庄', '连闲', '连开'],
    userEmotionMatch: ['兴奋', '纠结', '好奇'],
    openingLines: {
      aqiang: '出龙的时候一定要跟！我见过最长的龙连开23把庄 跟到底的人都赚翻了',
      gailv: '每一把开庄的概率都是独立的。前面开了10把庄 第11把开庄的概率还是45.86% 不多也不少',
      junshi: '龙的出现是概率的自然现象 不是趋势信号。但问题是：人在连胜中会过度自信 加大注码 一旦断龙亏损会很大',
    },
    escalation: [
      { characterId: 'aqiang', line: '你们书呆子不懂 赌场有气场 龙出来的时候整个桌子的能量都不一样', emotion: '玄学' },
      { characterId: 'gailv', line: '能量？气场？你要不要顺便算一卦？', emotion: '嘲讽' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '龙是随机序列中的正常现象 不是可预测的模式。真正的危险是"跟龙心态"——越赢越大胆 把前面赢的全压上去 一把断龙就回到原点甚至倒亏。赌场最喜欢的就是这种赌客',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 21点/BlackJack
  // ══════════════════════════════════════════

  {
    id: 'casino_bj_basic_001',
    topic: '21点的基本策略真的管用吗？',
    category: '赌场游戏',
    subcategory: '21点',
    characters: ['kellyprof', 'aqiang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['21点', 'blackjack', '基本策略', '策略表', '要牌', '停牌', '分牌', '双倍'],
    userEmotionMatch: ['学习', '好奇', '认真'],
    openingLines: {
      kellyprof: '21点基本策略是数学上已经证明的最优决策表。严格执行可以把庄家优势降到0.5%以下 是赌场游戏中最低的',
      aqiang: '策略表我看过 太复杂了 谁记得住啊。我一般就看感觉 16点以上就停',
      gailv: '16点以上就停？如果庄家明牌是7以上 你16点不要牌 长期胜率只有23%。策略表告诉你必须要牌',
    },
    escalation: [
      { characterId: 'aqiang', line: '要牌爆了怎么办？16点要牌十有八九爆掉', emotion: '恐惧' },
      { characterId: 'kellyprof', line: '16点要牌的爆率确实高 但不要牌的输率更高。基本策略选的是"两害相权取其轻"', emotion: '数学' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '21点基本策略是赌场中少数经过严格数学证明的工具。它不保证你赢 但保证你在每一手牌上做出期望值最高的决策。不学基本策略就打21点 等于白送赌场2-3%的额外利润',
    },
  },

  {
    id: 'casino_bj_insurance_001',
    topic: '21点的保险值不值得买？',
    category: '赌场游戏',
    subcategory: '21点',
    characters: ['gailv', 'kellyprof', 'aqiang'],
    type: '对峙',
    triggerKeywords: ['保险', 'insurance', '庄家A', '黑杰克', '买保险', '赔2比1'],
    userEmotionMatch: ['纠结', '好奇', '保守'],
    openingLines: {
      gailv: '21点保险是赌场设计的最大陷阱之一。庄家明牌A时 买保险的庄家优势超过7% 是正常下注的十倍',
      kellyprof: '保险本质是一个独立的side bet——你赌的是庄家暗牌是不是10点。16张10点牌vs36张非10点 赔率2:1 但概率只有30.8%',
    },
    escalation: [
      { characterId: 'aqiang', line: '但我有blackjack的时候总想买保险啊 万一庄家也是blackjack不就白拿了嘛', emotion: '纠结' },
      { characterId: 'gailv', line: '即使你有blackjack 买保险的期望值也是负的。你放弃的是3:2的可能赢面 换取一个确定的1:1', emotion: '坚定' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '永远不要买保险——这是21点基本策略的铁律。唯一的例外是你在算牌 且知道剩余牌中10点的比例超过1/3。对99%的玩家来说 保险就是在赌场优势最高的地方送钱',
    },
  },

  {
    id: 'casino_bj_counting_001',
    topic: '21点算牌到底能不能赚钱？',
    category: '赌场游戏',
    subcategory: '21点',
    characters: ['kellyprof', 'ajie', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['算牌', 'Hi-Lo', '计数', '真数', '牌组渗透', '反算牌', 'MIT'],
    userEmotionMatch: ['幻想', '好奇', '学习'],
    openingLines: {
      kellyprof: '21点算牌是赌场历史上唯一被数学证明有效的优势赌博技术。MIT团队和各种算牌队用它赢了数千万美元',
      ajie: '但现在赌场的反算牌措施已经非常成熟了——面部识别、行为分析、频繁洗牌、限制加注幅度',
      junshi: '算牌的数学原理没问题 问题在于执行环境。2024年的赌场和1990年代完全不同 算牌的生存空间被压缩得很小',
    },
    escalation: [
      { characterId: 'kellyprof', line: '但亚洲赌场的反算牌措施相对薄弱 这也是为什么很多算牌队转战澳门和马尼拉', emotion: '信息' },
      { characterId: 'ajie', line: '别天真了。澳门大赌场现在都有专门的算牌检测团队 被发现直接列入黑名单', emotion: '泼冷水' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '21点算牌在理论上仍然有效 但实践门槛极高：需要几百小时练习、几万美元本金、团队配合、以及面对被ban的风险。对个人来说 投入产出比可能还不如找份好工作。但它确实是赌博史上最优雅的数学应用',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 老虎机专题
  // ══════════════════════════════════════════

  {
    id: 'casino_slot_myth_001',
    topic: '老虎机有"吃分吐分"周期吗？',
    category: '赌场游戏',
    subcategory: '老虎机',
    characters: ['aqiang', 'gailv', 'ajie'],
    type: '混战',
    triggerKeywords: ['吃分', '吐分', '周期', '冷机', '热机', '时机', '老虎机规律'],
    userEmotionMatch: ['好奇', '信仰', '怀疑'],
    openingLines: {
      aqiang: '老虎机绝对有周期 吃够了分就会吐 关键是你要找到那个节点 在它要吐的时候坐上去',
      gailv: '现代老虎机用的是RNG——每次旋转完全独立 没有记忆 没有周期。你觉得有周期是因为大脑在随机数据中找规律',
      ajie: '以前的机械老虎机确实有周期 因为物理齿轮有固定组合。但电子老虎机？每次按键都是全新的随机数',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你解释为什么有人坐了两小时没中 我坐上去第三把就中了大奖？', emotion: '得意' },
      { characterId: 'gailv', line: '因为你坐上去的那一刻 RNG生成的随机数恰好是中奖组合。跟前面那人坐了多久毫无关系', emotion: '耐心' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '老虎机没有周期 这是确定的科学事实。每次旋转都是独立随机事件。"吃分吐分"是人脑的模式识别本能在随机数据上制造的幻觉。赌场不阻止这种迷信——因为它让你坐得更久',
    },
  },

  {
    id: 'casino_slot_jackpot_001',
    topic: '累积奖池老虎机值不值得玩？',
    category: '赌场游戏',
    subcategory: '老虎机',
    characters: ['gailv', 'kellyprof', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['累积奖池', 'jackpot', '头奖', '彩池', '百万大奖', '进阶奖池'],
    userEmotionMatch: ['幻想', '好奇', '贪婪'],
    openingLines: {
      gailv: '累积奖池老虎机的RTP通常比普通老虎机低2-5% 因为一部分投注被抽去填奖池了',
      kellyprof: '有趣的是 当奖池累积到一定高度时 理论期望值可以变正。但那个金额通常是几百万 你等得到吗？',
      aqiang: '我就是冲着头奖去的 万一呢？买彩票都有人中 老虎机怎么不行',
    },
    escalation: [
      { characterId: 'kellyprof', line: '中累积头奖的概率通常在1/500万到1/5000万之间 跟被雷劈的概率差不多', emotion: '数据' },
      { characterId: 'aqiang', line: '但总有人中啊！那个人为什么不能是我？', emotion: '幻想' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '累积奖池是老虎机中最具诱惑力也最危险的产品。它用天文数字的头奖金额吸引你 但同时RTP更低 每一把你亏得更多。你为了那个千万分之一的机会 每一把都在多付"保费"',
    },
  },

  {
    id: 'casino_slot_online_001',
    topic: '线上老虎机和实体老虎机哪个更容易赢？',
    category: '赌场游戏',
    subcategory: '老虎机',
    characters: ['ajie', 'xiaotian', 'gailv'],
    type: '混战',
    triggerKeywords: ['线上老虎机', '网上老虎机', '手机老虎机', 'APP老虎机', '电子游戏'],
    userEmotionMatch: ['比较', '好奇', '怀疑'],
    openingLines: {
      ajie: '线上老虎机的RTP通常比实体高——因为运营成本低 不需要占实体空间。但问题是 你怎么验证它的RTP是真的？',
      xiaotian: '我们平台的老虎机RTP都有第三方审计报告哦 完全透明 玩家可以随时查看~',
      gailv: '正规持牌平台的线上老虎机RTP确实公开可查 通常96-98%。但没牌照的平台？RTP可以后台随便调',
    },
    escalation: [
      { characterId: 'ajie', line: '更大的问题是线上老虎机的速度——你一分钟可以转30-40次 实体机可能只有10次。速度×次数=亏损速度', emotion: '警告' },
      { characterId: 'xiaotian', line: '速度快也是为了提升玩家体验呀 谁愿意等呢~', emotion: '甜蜜' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '线上老虎机RTP更高是事实 但速度也更快。单次亏损少×次数多=总亏损可能更大。再加上24小时可玩 没有物理距离限制 线上老虎机的成瘾风险远高于实体机',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 扑克策略
  // ══════════════════════════════════════════

  {
    id: 'casino_poker_bluff_001',
    topic: '德州扑克诈唬（bluff）怎么用才有效？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['kellyprof', 'aqiang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['诈唬', 'bluff', '偷鸡', '半诈唬', '代表', '读牌', '过牌加注'],
    userEmotionMatch: ['学习', '好奇', '提升'],
    openingLines: {
      kellyprof: '有效的诈唬需要满足三个条件：你的行动线要讲得通故事 对手能弃掉好牌 以及底池赔率要合理',
      aqiang: '诈唬就是胆量！对面犹豫的时候你直接全推 气势压过去就赢了',
      ajie: '新手最大的错误是诈唬太多。好的玩家诈唬频率只有15-20% 不是每手都偷鸡',
    },
    escalation: [
      { characterId: 'aqiang', line: '我上次拿着空气全推 对面AK都弃了 那种感觉比拿好牌赢还爽', emotion: '兴奋' },
      { characterId: 'kellyprof', line: '你记住了成功的诈唬 忘记了被抓的十次。这又是选择性记忆', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '诈唬是德州扑克中最被高估的技术。在低级别游戏中 对手不会弃牌 诈唬毫无意义。把精力放在位置意识和价值下注上 比学诈唬重要十倍',
    },
  },

  {
    id: 'casino_poker_tilt_001',
    topic: '打德州"上头"了怎么办？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['laozhang', 'aqiang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['上头', 'tilt', '情绪失控', '追损', '冲动', '打疯了', '红眼了'],
    userEmotionMatch: ['失控', '愤怒', '求助'],
    openingLines: {
      laozhang: '上头是扑克玩家最大的敌人。你技术再好 一旦tilt 决策质量会下降到新手水平',
      aqiang: '被bad beat了谁能不上头？AA被72翻盘 你告诉我怎么冷静？',
      kellyprof: '职业玩家处理tilt的方法：设定止损线 情绪波动时立刻离桌 永远不在愤怒状态做决策',
    },
    escalation: [
      { characterId: 'aqiang', line: '离桌？我刚输了一万 你让我走？我要把它赢回来！', emotion: '疯狂' },
      { characterId: 'laozhang', line: '你现在的状态就是tilt。你想赢回来的欲望越强 你的决策就越差 输得就越多', emotion: '平静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'Tilt是扑克玩家和赌徒共同的敌人。解决方案不是"控制情绪"而是"建立规则"——设死止损线 触发就走。因为你tilt的时候 你的理性大脑已经下线了 靠意志力没用',
    },
  },

  {
    id: 'casino_poker_bankroll_001',
    topic: '打德州需要多少本金才够？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['kellyprof', 'gailv', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['本金', 'bankroll', '买入', '资金管理', '几个买入', '够不够'],
    userEmotionMatch: ['实际', '学习', '计划'],
    openingLines: {
      kellyprof: '职业扑克玩家的标准bankroll管理：现金桌至少30个买入 锦标赛至少100个买入。低于这个 你随时可能因为正常方差破产',
      gailv: '方差是扑克中最被低估的因素。即使你是赢家 连输10-20个买入也是完全正常的统计波动',
      aqiang: '管那么多干嘛 带多少打多少 输了就不打了呗',
    },
    escalation: [
      { characterId: 'gailv', line: '输了就不打了？那你永远在最差的时候退出 最好的时候也不在场。这叫"不对称取样" 会系统性高估你的亏损', emotion: '分析' },
      { characterId: 'kellyprof', line: '资金管理的核心不是赢多少 是确保你在运气差的时候还能留在牌桌上等到运气好', emotion: '关键' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'Bankroll管理是区分业余和职业的分水岭。没有足够的本金缓冲 即使你是赢家 方差也会在某个低谷期把你淘汰。本金不够就降级打 这不丢人 丢人的是倾家荡产',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 轮盘进阶 / 其他赌场游戏
  // ══════════════════════════════════════════

  {
    id: 'casino_roulette_system_001',
    topic: '轮盘的"倍投法"为什么最终一定输？',
    category: '赌场游戏',
    subcategory: '轮盘',
    characters: ['kellyprof', 'dashiwang', 'gailv'],
    type: '混战',
    triggerKeywords: ['倍投', '马丁格尔', '翻倍下注', '追回', '倍投系统', '必胜法'],
    userEmotionMatch: ['幻想', '不服', '好奇'],
    openingLines: {
      kellyprof: '马丁格尔策略的致命缺陷：赌桌有上限 你的钱有上限。连输7次需要128倍初始注码 连输10次需要1024倍 数学上必然爆仓',
      dashiwang: '我教学员用的是"改良马丁" 不是无脑翻倍 有止损点的！关键是节奏控制💰',
      gailv: '任何形式的马丁格尔 不管怎么"改良" 期望值都是负的。你改变的只是输钱的分布 不是输赢的结果',
    },
    escalation: [
      { characterId: 'dashiwang', line: '那为什么我的学员用倍投法一个月赚了两万？你怎么解释？', emotion: '反击' },
      { characterId: 'kellyprof', line: '幸存者偏差。你展示赢的学员 不展示爆仓的。我敢打赌你的学员总体是亏损的', emotion: '冷酷' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '倍投法的数学真相：它把"频繁小赢+偶尔大亏"包装成"稳赚"的假象。你可能连赢20天 第21天一次爆仓就把前面全部吐回去 还倒亏。任何"必胜系统"都是骗局 无一例外',
    },
  },

  {
    id: 'casino_craps_001',
    topic: '骰子游戏（Craps）为什么在亚洲不火？',
    category: '赌场游戏',
    subcategory: '骰子',
    characters: ['aqiang', 'ajie', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['craps', '骰子', '花旗骰', 'pass line', '美式骰子', '掷骰'],
    userEmotionMatch: ['好奇', '了解', '比较'],
    openingLines: {
      aqiang: 'Craps在Vegas超火的 一桌人围着喊 气氛爆棚 但亚洲赌场几乎看不到',
      ajie: '亚洲赌客更喜欢百家乐和骰宝 因为规则简单直接。Craps的下注选项太复杂 亚洲人不买账',
      gailv: '有意思的是Craps的Pass Line庄家优势只有1.41% 加上odds bet甚至接近零。数学上它是赌场中最公平的游戏之一',
    },
    escalation: [
      { characterId: 'aqiang', line: '等等 庄家优势接近零？那赌场怎么赚钱？', emotion: '震惊' },
      { characterId: 'gailv', line: 'Odds bet确实是零优势 但赌场限制了它的倍数。而且大部分玩家会下庄家优势更高的Prop Bet', emotion: '解释' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'Craps是赌场中数学上最友好的游戏 但也是最复杂的。赌场靠复杂性赚钱——大部分玩家不懂最优下注方式 会被高赔率的Prop Bet吸引 那些的庄家优势高达16%',
    },
  },

  {
    id: 'casino_bac_squeeze_001',
    topic: '百家乐"咪牌"有什么讲究？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['aqiang', 'ajie', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['咪牌', '揭牌', '搓牌', '看牌', '仪式', '手气', '慢慢揭'],
    userEmotionMatch: ['好奇', '传统', '文化'],
    openingLines: {
      aqiang: '咪牌是百家乐的灵魂！慢慢搓出来那种紧张感 比什么都刺激 这才叫赌博',
      ajie: '咪牌的设计目的是延长每一手的时间 增加情感投入。你越兴奋 就越想加注 赌场就越赚',
      junshi: '咪牌是百家乐文化中最有趣的心理学现象。它完全不影响结果 但能把多巴胺分泌量提高三倍',
    },
    escalation: [
      { characterId: 'aqiang', line: '你不懂！咪牌是有技巧的 看到边花就知道大概是什么牌了 这叫读牌', emotion: '自豪' },
      { characterId: 'junshi', line: '你在咪自己的牌时确实能看到信息 但这信息对结果没有任何影响——牌已经发了 结果已经定了', emotion: '点醒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '咪牌是赌场设计的"情绪放大器"。它不改变结果 但改变你的体验——让你觉得自己在"参与"而不是"等待"。这种参与感是成瘾的催化剂',
    },
  },

  {
    id: 'casino_bac_tie_001',
    topic: '百家乐买"和"到底值不值？',
    category: '赌场游戏',
    subcategory: '百家乐',
    characters: ['gailv', 'aqiang', 'kellyprof'],
    type: '对峙',
    triggerKeywords: ['和局', '买和', '和', '8赔1', '打和', '平局'],
    userEmotionMatch: ['幻想', '贪婪', '好奇'],
    openingLines: {
      gailv: '买和的赔率8:1看起来很诱人 但实际庄家优势高达14.36% 是百家乐中最坑的下注选项',
      aqiang: '但和局8赔1啊 中一次顶好几把 偶尔买一下碰碰运气有什么不好？',
    },
    escalation: [
      { characterId: 'kellyprof', line: '和局的真实概率是9.52% 赔8:1的话公平赔率应该是9.5:1。差出来的1.5就是赌场额外拿走的', emotion: '精算' },
      { characterId: 'aqiang', line: '但我上次买和 三把中了两把 赚了十六个注码！', emotion: '得意' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '买和是百家乐中的"彩票陷阱"——高赔率低概率 庄家优势是庄闲的十倍以上。偶尔中一次的兴奋感会让你忘记长期亏损的事实。所有职业赌客的第一条规则：永远不买和',
    },
  },

  {
    id: 'casino_poker_position_001',
    topic: '德州扑克的"位置"到底有多重要？',
    category: '赌场游戏',
    subcategory: '德州扑克',
    characters: ['kellyprof', 'aqiang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['位置', '按钮位', '小盲', '大盲', '枪口位', '后位', 'CO', 'BTN'],
    userEmotionMatch: ['学习', '好奇', '提升'],
    openingLines: {
      kellyprof: '位置是德州扑克中最重要的单一因素。后位玩家比前位玩家有15-20%的胜率优势 仅仅因为他们后行动',
      aqiang: '位置有那么重要吗？我拿到好牌在哪都赢 拿到烂牌在哪都输',
      gailv: '数据不说谎：按钮位（最后行动）的平均盈利率是枪口位的3-5倍。好牌烂牌都需要位置来放大价值',
    },
    escalation: [
      { characterId: 'aqiang', line: '那每次都坐按钮位不就行了？', emotion: '天真' },
      { characterId: 'kellyprof', line: '位置是轮转的 你不能选择。但你可以选择在前位打更紧 后位打更松 这就是位置意识', emotion: '教学' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '位置的价值在于信息——后行动的人看到了前面所有人的决策。信息就是筹码 就是利润。不理解位置的扑克玩家 就像蒙着眼睛打拳击',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 足球进阶
  // ══════════════════════════════════════════

  {
    id: 'sports_football_fix_001',
    topic: '假球到底有多普遍？能不能利用假球赚钱？',
    category: '体育博彩',
    subcategory: '足球',
    characters: ['ajie', 'gailv', 'junshi'],
    type: '混战',
    triggerKeywords: ['假球', '操纵比赛', '默契球', '打假球', '买球', '控制比分'],
    userEmotionMatch: ['怀疑', '愤怒', '好奇'],
    openingLines: {
      ajie: '假球在二三线联赛非常普遍。东南亚、东欧的低级别联赛 假球率估计在5-10%',
      gailv: '即使你知道哪场是假球 你也很难利用它赚钱——因为盘口会提前反映异常投注 赔率会急剧变化',
      junshi: '假球产业链的利润不在赌球本身 而在操控赔率。庄家通过假球获利 散户即使知道也吃不到',
    },
    escalation: [
      { characterId: 'ajie', line: '我知道有人买到假球信息 但那些信息本身可能就是假的——骗你花钱买"假球料"的人比打假球的还多', emotion: '讽刺' },
      { characterId: 'junshi', line: '而且参与假球投注是犯罪。即使你赢了钱 洗钱环节也会让你承担巨大法律风险', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '假球是体育博彩中最大的灰色地带。它确实存在 但普通赌客几乎无法从中获利——信息不对称、赔率反应快、法律风险高。卖"假球料"的人比打假球的人赚得更多 因为前者零风险',
    },
  },

  {
    id: 'sports_football_inplay_001',
    topic: '足球滚球（走地盘）是不是更容易赢？',
    category: '体育博彩',
    subcategory: '足球',
    characters: ['aqiang', 'gailv', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['滚球', '走地', '实时投注', '半场', '进球后', 'live bet', '即时投注'],
    userEmotionMatch: ['兴奋', '好奇', '冲动'],
    openingLines: {
      aqiang: '滚球才刺激 边看边赌 看到球队状态好就买 感觉比赛前下注靠谱多了',
      gailv: '滚球的庄家抽水通常比赛前高2-3%。你看到的"实时信息"赌场也看到了 而且它的算法比你快',
      kellyprof: '滚球的真正问题是诱导冲动下注。比赛进行中情绪波动大 你的决策质量会大幅下降',
    },
    escalation: [
      { characterId: 'aqiang', line: '但看球的时候不赌多无聊啊 滚球让比赛更有意思', emotion: '享受' },
      { characterId: 'kellyprof', line: '这正是菠菜公司想要的——把观赛体验和赌博绑定 让你以后看球就想赌', emotion: '警告' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '滚球是菠菜公司利润最高的产品：抽水更高、冲动下注更多、情绪化决策更严重。你觉得自己在利用信息 其实你在被情绪操控。最好的滚球策略是不玩滚球',
    },
  },

  {
    id: 'sports_football_overunder_001',
    topic: '足球大小球怎么判断？有没有规律？',
    category: '体育博彩',
    subcategory: '足球',
    characters: ['gailv', 'aqiang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['大小球', '总进球', '大球', '小球', '2.5球', '进球数', '大2.5'],
    userEmotionMatch: ['学习', '分析', '好奇'],
    openingLines: {
      gailv: '大小球的关键数据：球队场均进球、场均失球、交手记录、近期状态。但菠菜公司的模型用了上百个变量 你用几个怎么跟它比',
      aqiang: '我赌大小球有个心得：雨天买小球 决赛买小球 保级战买大球 屡试不爽',
      junshi: '阿强的"心得"有一定道理——天气和比赛性质确实影响进球数。但这些因素菠菜公司早就建模了 反映在赔率里了',
    },
    escalation: [
      { characterId: 'aqiang', line: '那菠菜公司也不是神啊 冷门不是天天有吗？', emotion: '不服' },
      { characterId: 'gailv', line: '冷门是赔率的一部分 不是赔率的失败。2.5球大球赔1.8意味着菠菜公司认为55%概率开大——45%的时候它确实不开大 这不叫冷门 这叫正常', emotion: '教育' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '大小球的"规律"都已经被赔率消化了。你能想到的因素 菠菜公司的量化团队早想到了。唯一的机会在于你比市场更了解某个特定联赛或球队——这需要专业级的深度研究',
    },
  },

  {
    id: 'sports_horse_001',
    topic: '赛马博彩是不是最古老的赌博？有什么门道？',
    category: '体育博彩',
    subcategory: '赛马',
    characters: ['aqiang', 'junshi', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['赛马', '马会', '跑马', '马经', '骑师', '练马师', '独赢', '连赢', '位置'],
    userEmotionMatch: ['好奇', '传统', '了解'],
    openingLines: {
      aqiang: '赛马是真正的技术活 看马匹状态看骑师看赛道 比赌球有意思多了',
      junshi: '赛马博彩的历史超过300年 是现代博彩业的鼻祖。它的赔率系统（parimutuel）跟体育博彩的固定赔率完全不同',
      gailv: '赛马的parimutuel系统意味着赔率由所有投注者决定 不是庄家定价。马会抽15-25%的水 剩下的在赢家之间分配',
    },
    escalation: [
      { characterId: 'aqiang', line: '所以赛马不是跟庄家对赌 是跟其他赌客对赌？那是不是更公平？', emotion: '精明' },
      { characterId: 'gailv', line: '15-25%的抽水比足球菠菜的5-8%高得多。你赢了其他赌客的钱 但马会拿走了四分之一', emotion: '冷水' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赛马博彩的抽水率是主流博彩中最高的。加上信息不对称（练马师和大户掌握更多内幕信息） 散户在赛马中的劣势比其他博彩更大。把赛马当娱乐可以 当投资绝对不行',
    },
  },

  {
    id: 'sports_boxing_001',
    topic: '拳击/UFC博彩有没有内幕？',
    category: '体育博彩',
    subcategory: '拳击格斗',
    characters: ['aqiang', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['拳击', 'UFC', 'MMA', '格斗', '搏击', 'KO', '点数', '回合'],
    userEmotionMatch: ['好奇', '兴奋', '怀疑'],
    openingLines: {
      aqiang: '拳击赌KO太刺激了 赔率高 看对了一把就翻倍',
      ajie: '搏击类运动的假赛风险比团队运动低 因为只涉及两个人。但也不是没有——低级别拳击赛假拳不少',
      gailv: '格斗博彩的特殊性在于变量少——两个人、一个结果。菠菜公司的定价相对不精确 有经验的分析师确实能找到价值',
    },
    escalation: [
      { characterId: 'aqiang', line: '我有个朋友专赌UFC KO 说只赌他研究过的选手 一年赚了好几万', emotion: '羡慕' },
      { characterId: 'gailv', line: '格斗的样本量太小 一个选手一年最多打3-4场。赚了好几万可能只是几次运气好', emotion: '怀疑' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '格斗博彩有信息差的空间 但样本量太小导致方差巨大。一个回合的运气就能决定胜负 再好的分析也架不住一记幸运的拳头',
    },
  },

  {
    id: 'sports_handicap_001',
    topic: '让球盘突然变化说明什么？',
    category: '体育博彩',
    subcategory: '足球',
    characters: ['gailv', 'ajie', 'aqiang'],
    type: '混战',
    triggerKeywords: ['变盘', '升盘', '降盘', '盘口变化', '水位变化', '临场变盘', '初盘', '终盘'],
    userEmotionMatch: ['紧张', '分析', '好奇'],
    openingLines: {
      gailv: '盘口变化反映的是市场资金流向 不一定是"内幕信息"。大额投注会推动盘口 菠菜公司也会主动调整',
      ajie: '有种情况要注意：临场突然大幅变盘 可能是知情资金入场。但你看到变盘的时候 赔率已经调过了 你追不上',
      aqiang: '我关注变盘已经两年了 确实有规律 但很难赚钱 因为变完盘赔率就不划算了',
    },
    escalation: [
      { characterId: 'aqiang', line: '有没有可能在变盘之前就下注？提前拿到好赔率？', emotion: '精明' },
      { characterId: 'gailv', line: '那叫"抢水" 职业玩家确实这么做。但你需要比市场快 通常意味着你需要内幕信息或极快的下注系统', emotion: '实际' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '盘口变化是博彩市场中最有价值的信息之一 但普通赌客几乎无法利用它。因为你看到变化时赔率已经调整完毕 最佳下注时机已过。这就是信息时代的残酷：信息有价值 但免费信息没有价值',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 篮球 / 电竞 / 综合
  // ══════════════════════════════════════════

  {
    id: 'sports_nba_prop_001',
    topic: 'NBA球员特殊盘口（Prop Bet）能不能赚钱？',
    category: '体育博彩',
    subcategory: '篮球',
    characters: ['gailv', 'aqiang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['球员盘', 'prop bet', '得分盘', '篮板', '助攻', '球员数据', '特殊盘口'],
    userEmotionMatch: ['好奇', '分析', '精明'],
    openingLines: {
      gailv: '球员Prop Bet是近年来增长最快的博彩市场。菠菜公司对球员数据的定价精度低于比赛胜负 理论上信息差更大',
      aqiang: '我赌球员得分盘 感觉挺准的 了解球员状态就行 比猜比赛结果简单',
      kellyprof: '球员Prop Bet的关键变量是出场时间。伤病和轮休是最大的风险因素 这些信息往往在临场前才公布',
    },
    escalation: [
      { characterId: 'aqiang', line: '所以关键是关注伤病报告？我每天都看NBA新闻 应该有优势吧？', emotion: '自信' },
      { characterId: 'kellyprof', line: '你看的新闻 菠菜公司也看。而且它们有专人24小时跟踪 反应速度比你快得多', emotion: '现实' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '球员Prop Bet确实是信息差最大的市场之一 但这个差距在迅速缩小。菠菜公司投入大量资源优化定价 个人玩家的优势窗口越来越小。如果你没有独家信息源 你就是在跟机构对赌',
    },
  },

  {
    id: 'sports_tennis_001',
    topic: '网球博彩为什么容易出假赛？',
    category: '体育博彩',
    subcategory: '网球',
    characters: ['ajie', 'gailv', 'junshi'],
    type: '混战',
    triggerKeywords: ['网球', '假赛', '让盘', '网球博彩', 'ATP', 'WTA', '退赛'],
    userEmotionMatch: ['震惊', '怀疑', '好奇'],
    openingLines: {
      ajie: '网球是假赛重灾区。一个人的运动 买通一个人就行。低排名选手奖金低 被收买的成本很低',
      gailv: '数据显示每年有数百场网球比赛被标记为可疑。国际网球廉政机构（ITIA）每年处理几十起案件',
      junshi: '网球假赛的经济学：排名100以外的选手年收入可能不到5万美元 一场假赛的报酬可能是这个的两倍',
    },
    escalation: [
      { characterId: 'ajie', line: '最难防的是"部分假赛"——不是输整场 而是输一盘或一个发球局。这种几乎无法检测', emotion: '内幕' },
      { characterId: 'gailv', line: '菠菜公司也不傻 异常投注模式会触发警报。但跨平台分散下注 小金额操作 确实很难追踪', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网球假赛问题揭示了体育博彩的结构性风险：你赌的比赛可能是假的 而你根本无法知道。这不是个别现象 而是低收入运动员+巨大博彩市场的必然产物',
    },
  },

  {
    id: 'sports_esports_csgo_001',
    topic: '电竞皮肤赌博是不是专门坑年轻人？',
    category: '体育博彩',
    subcategory: '电竞',
    characters: ['xiaotian', 'junshi', 'laozhang'],
    type: '混战',
    triggerKeywords: ['皮肤赌博', 'CSGO', '开箱', '饰品交易', '皮肤博彩', 'Steam'],
    userEmotionMatch: ['好奇', '担忧', '年轻'],
    openingLines: {
      xiaotian: '皮肤赌博是灰色地带 用虚拟物品代替现金 规避了大部分赌博法规。年轻人觉得是"游戏"不是赌博',
      junshi: '2024年全球皮肤赌博市场估计超过100亿美元。参与者平均年龄比传统赌博低10岁 很多未成年人参与',
      laozhang: '我接触过好几个因为皮肤赌博成瘾的年轻人。他们不觉得自己在赌博——"只是游戏饰品嘛"——但行为模式跟赌博成瘾完全一样',
    },
    escalation: [
      { characterId: 'xiaotian', line: '而且皮肤赌博网站大多没有任何监管 RTP可以随便设。比正规赌场还黑', emotion: '揭露' },
      { characterId: 'laozhang', line: '最危险的是开箱系统——它就是老虎机 但包装成了"惊喜盲盒"。同样的成瘾机制 不同的外衣', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '皮肤赌博是这个时代最隐蔽的赌博形式。它用游戏外衣包裹赌博本质 精准瞄准年轻人群体 且几乎不受监管。如果你在玩 请承认它就是赌博 然后按赌博的规则来对待它',
    },
  },

  {
    id: 'sports_arbitrage_001',
    topic: '体育博彩套利（对冲）真的无风险吗？',
    category: '体育博彩',
    subcategory: '综合',
    characters: ['kellyprof', 'gailv', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['套利', '对冲', 'arb', '对打', '搬砖', '两头下注', '无风险'],
    userEmotionMatch: ['精明', '学习', '好奇'],
    openingLines: {
      kellyprof: '体育博彩套利是利用不同菠菜公司的赔率差异 在同一场比赛的不同结果上下注 锁定无风险利润。理论上完美 实践中困难重重',
      gailv: '套利机会确实存在 但通常利润率只有1-3% 存在时间几分钟甚至几秒。你需要多个账户 快速下注 还要躲避封号',
      ajie: '菠菜公司恨套利客。一旦检测到你在套利 轻则限额 重则封号没收余额。这不是"无风险" 有运营风险',
    },
    escalation: [
      { characterId: 'kellyprof', line: '更大的风险是"一腿落地"——你在A平台下了注 去B平台下的时候赔率已经变了 变成了单边赌博', emotion: '警告' },
      { characterId: 'gailv', line: '还有资金效率问题。1-3%的利润率 意味着你需要几十万本金才能赚到有意义的金额', emotion: '实际' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '体育博彩套利在数学上是"无风险"的 但在执行中有大量运营风险：封号、限额、一腿落地、资金冻结。把它当成一门生意来评估——投入大、利润薄、随时可能被"下架"。绝不是躺赚',
    },
  },

  {
    id: 'sports_betting_app_001',
    topic: '手机赌球APP为什么让人越赌越多？',
    category: '体育博彩',
    subcategory: '综合',
    characters: ['junshi', 'laozhang', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['赌球APP', '手机赌', '随时赌', '推送', '通知', '方便', '快速下注'],
    userEmotionMatch: ['反思', '成瘾', '担忧'],
    openingLines: {
      junshi: '手机赌球APP的设计融合了社交媒体和老虎机的成瘾机制：即时反馈、推送通知、简化下注流程、现金奖励循环',
      laozhang: '我戒赌最困难的部分就是手机。删了一个APP换另一个 都在浏览器里 没法彻底断掉',
      xiaotian: '赌博APP的用户留存团队和游戏公司一样专业。每一个按钮的颜色和位置都是A/B测试出来的 目的是最大化你的下注频率',
    },
    escalation: [
      { characterId: 'laozhang', line: '最可怕的是"一键下注"功能 从看到比赛到下注只要3秒。以前去赌场至少还有路上冷静的时间', emotion: '感慨' },
      { characterId: 'junshi', line: '研究显示移动端赌博的决策时间比桌面端短60% 冲动下注比例高40%。方便=危险', emotion: '数据' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '手机赌球APP是赌博成瘾的加速器。它消除了所有"摩擦力"——不用出门、不用排队、不用面对人。而这些摩擦力恰恰是防止冲动赌博的最后一道防线',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 更多地区
  // ══════════════════════════════════════════

  {
    id: 'dest_korea_001',
    topic: '韩国赌场为什么对外国人免费但本国人不让进？',
    category: '赌城风云',
    subcategory: '韩国',
    characters: ['ajie', 'gailv', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['韩国', '济州岛', '江原', '韩国赌场', '外国人专用', '七乐'],
    userEmotionMatch: ['好奇', '了解', '比较'],
    openingLines: {
      ajie: '韩国17家赌场只有1家（江原乐园）允许本国人进。其他全是外国人专用 主要瞄准中国和日本游客',
      gailv: '韩国政府的逻辑很清楚：赚外国人的钱 保护自己的国民。跟新加坡收入场费是同一思路',
      junshi: '但江原乐园的数据很有意思：开放后韩国赌博成瘾率上升了22% 证明限制政策确实有保护作用',
    },
    escalation: [
      { characterId: 'ajie', line: '中国赌客对韩国赌场的贡献超过60%。疫情后中国游客减少 很多韩国赌场快倒闭了', emotion: '信息' },
      { characterId: 'gailv', line: '依赖单一客源是商业风险 但这也说明中国赌客的消费力有多惊人', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '韩国赌场模式的启示：赌博可以是产业 但需要保护性监管。只允许外国人赌 既获得旅游收入又减少国民受害。但对中国赌客来说 韩国赌场跟任何赌场没区别——庄家优势不会因为你是外国人就消失',
    },
  },

  {
    id: 'dest_online_vs_land_001',
    topic: '网上赌场和实体赌场到底哪个更坑？',
    category: '赌城风云',
    subcategory: '综合对比',
    characters: ['ajie', 'xiaotian', 'junshi'],
    type: '混战',
    triggerKeywords: ['网上赌场', '实体赌场', '线上线下', '对比', '哪个好', '哪个坑'],
    userEmotionMatch: ['比较', '好奇', '选择'],
    openingLines: {
      ajie: '实体赌场至少是受监管的公平游戏。网赌平台？天知道后台是怎么设置的',
      xiaotian: '正规网上赌场也有牌照和审计呀~ 马耳他、直布罗陀、库拉索的牌照都是有公信力的',
      junshi: '核心区别：实体赌场的游戏结果由物理过程决定 网赌由代码决定。物理过程很难操控 代码可以随时改',
    },
    escalation: [
      { characterId: 'xiaotian', line: '但网上赌场的RTP通常更高 因为没有实体成本。玩家从数学上讲输得更少', emotion: '辩解' },
      { characterId: 'ajie', line: '理论RTP高有什么用？如果平台改了代码 你看到的RTP和实际RTP可能完全不同', emotion: '反击' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '实体赌场更公平但更贵（庄家优势+高消费+交通住宿）。网赌更方便但更危险（可能被操控+24小时可玩+成瘾风险高）。如果非要选——正规实体赌场至少保证游戏公平',
    },
  },

  {
    id: 'dest_japan_001',
    topic: '日本柏青哥算不算赌博？',
    category: '赌城风云',
    subcategory: '日本',
    characters: ['gailv', 'ajie', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['柏青哥', 'pachinko', '日本赌博', '钢珠', '景品', '三店方式'],
    userEmotionMatch: ['好奇', '了解', '文化'],
    openingLines: {
      gailv: '日本柏青哥年产值超过20万亿日元 是日本最大的娱乐产业。但法律上它"不是赌博"——因为你赢的是"景品"不是现金',
      ajie: '所谓"三店方式"就是个法律漏洞：赢钢珠→换景品→隔壁小店收景品换现金。人人都知道是赌博 但法律假装不知道',
      junshi: '柏青哥的社会问题很严重：日本估计有500万赌博成瘾者 其中大部分是柏青哥玩家',
    },
    escalation: [
      { characterId: 'ajie', line: '柏青哥店的成瘾性不亚于老虎机。噪音、闪光、快速反馈——全是成瘾设计', emotion: '严肃' },
      { characterId: 'gailv', line: '日本2018年通过IR法案准备开设综合度假村赌场。柏青哥行业强烈反对——因为会抢它的生意', emotion: '讽刺' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '柏青哥是世界上最大的"不是赌博的赌博"。它证明了一个道理：法律可以假装某种东西不是赌博 但大脑的成瘾回路不会被法律定义所欺骗',
    },
  },

  {
    id: 'dest_macau_decline_001',
    topic: '澳门赌业为什么在走下坡路？',
    category: '赌城风云',
    subcategory: '澳门',
    characters: ['ajie', 'junshi', 'aqiang'],
    type: '圆桌',
    triggerKeywords: ['澳门衰退', '转型', '非博彩', '贵宾厅关闭', '博彩收入下降', '限制'],
    userEmotionMatch: ['好奇', '了解', '讨论'],
    openingLines: {
      ajie: '澳门这几年变化太大了。贵宾厅一个个关 叠码仔基本消失 中介人制度彻底改革',
      junshi: '澳门博彩收入从2019年的2920亿到2022年暴跌至420亿 虽然2023年恢复到1800亿 但结构已经变了',
      aqiang: '我前两年去澳门 感觉冷清了很多。以前人挤人的赌场 现在空了好多桌',
    },
    escalation: [
      { characterId: 'ajie', line: '核心原因：反洗钱加强+贵宾厅整顿+网赌分流。大赌客不来了 光靠大众赌客撑不起来', emotion: '分析' },
      { characterId: 'junshi', line: '澳门政府在推"非博彩元素"转型——会展、演出、体育赛事。想从赌城变成综合度假目的地', emotion: '客观' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '澳门赌业的衰退不是暂时的低谷 而是结构性转变。反腐、反洗钱、网赌竞争、消费降级 四重压力下 澳门正在被迫从赌城转型。对赌客来说 去澳门不如以前"值"了——因为优惠和返水都大幅缩水',
    },
  },

{
    id: 'psych_addiction_001',
    topic: '为什么赢了还想继续赌？多巴胺是怎么劫持大脑的？',
    category: '赌徒心理',
    subcategory: '成瘾机制',
    characters: ['gailv', 'aqiang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['停不下来', '多巴胺', '上瘾', '越赢越想赌'],
    userEmotionMatch: ['困惑', '焦虑', '好奇'],
    openingLines: {
      gailv: '从神经科学角度来说，赌博时大脑释放的多巴胺量跟吸毒几乎一样。更可怕的是，不是赢钱让你爽——是"期待赢钱"让你爽。',
      aqiang: '别跟我扯什么多巴胺，我就是手气来了不想断！你们不懂那种连赢的感觉，整个人都飘了！',
      kellyprof: '阿强说的"飘了"恰恰就是多巴胺在作怪。大脑的奖赏回路被激活后，理性前额叶皮层的声音会被压制。这跟意志力无关，是生物化学层面的劫持。',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你们说我是瘾君子？我只是喜欢刺激而已！我随时能停！', emotion: '愤怒' },
      { characterId: 'gailv', line: '"随时能停"是成瘾者说得最多的一句话。数据显示，说这话的人里有78%在一周内会复赌。', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '多巴胺成瘾回路不认识"赢够了"三个字。它只会让你觉得下一把更刺激。承认大脑被劫持不是丢人，是自救的第一步。',
    },
  },
  {
    id: 'psych_sunk_002',
    topic: '已经输了这么多，不继续赌怎么捞回来？沉没成本为什么让人越陷越深？',
    category: '赌徒心理',
    subcategory: '认知偏差',
    characters: ['junshi', 'aqiang', 'laozhang'],
    type: '对峙',
    triggerKeywords: ['捞回来', '输了很多', '沉没成本', '不甘心'],
    userEmotionMatch: ['焦虑', '不甘', '绝望'],
    openingLines: {
      junshi: '沉没成本谬误是赌场最大的帮凶。你已经输掉的钱，无论你再下多少注，都不会回来。每一把都是独立事件。',
      aqiang: '你站着说话不腰疼！我输了二十万，不赌怎么办？打工要还到猴年马月？',
      laozhang: '阿强，我当年也说过一模一样的话。结果从二十万输到了八十万。你猜怎么着？想"捞回来"的那个念头，才是你最大的敌人。',
    },
    escalation: [
      { characterId: 'aqiang', line: '老张你是运气不好！我不一样，我有方法的！', emotion: '执拗' },
      { characterId: 'laozhang', line: '每个在深渊里的人都觉得自己"不一样"。这不是方法的问题，是数学的问题。', emotion: '感慨' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '沉没成本已经沉没了。你现在做的每一个决定，都应该只看未来的期望值，而不是试图弥补过去。止损不是认输，是止血。',
    },
  },
  {
    id: 'psych_fallacy_003',
    topic: '连开了六把大，下一把一定开小吧？赌徒谬误到底骗了多少人？',
    category: '赌徒心理',
    subcategory: '认知偏差',
    characters: ['kellyprof', 'dashiwang', 'gailv'],
    type: '对峙',
    triggerKeywords: ['赌徒谬误', '连开', '该反转了', '规律'],
    userEmotionMatch: ['自信', '好奇', '困惑'],
    openingLines: {
      kellyprof: '赌徒谬误是概率论里最经典的认知错误。硬币没有记忆，骰子没有记忆，轮盘也没有记忆。每一次都是独立事件。',
      dashiwang: '教授你太死板了！万物有气场，连开六把大，那股"大"的气已经泄了，阴阳要平衡，下一把小的概率更大！',
      gailv: '王大师，你每次用这套"气场论"忽悠人，我都替你脸红。1913年蒙特卡洛赌场连开26次黑，赌客们因为相信"该红了"，输掉了数百万法郎。',
    },
    escalation: [
      { characterId: 'dashiwang', line: '那是他们不懂风水！你让我在场，我能感应到第几把反转！', emotion: '吹嘘' },
      { characterId: 'kellyprof', line: '如果你真能感应，你早就是世界首富了。概率不会因为你的感觉而改变。', emotion: '讽刺' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '独立事件没有"该轮到了"这回事。每次下注的概率都是全新的。相信"规律"的人，只是给自己的赌瘾找了一个好听的借口。',
    },
  },
  {
    id: 'psych_chase_004',
    topic: '输了一把就想马上追回来，追损为什么是最快的破产方式？',
    category: '赌徒心理',
    subcategory: '情绪管理',
    characters: ['junshi', 'xiaofang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['追损', '翻本', '加注', '一把回来'],
    userEmotionMatch: ['冲动', '愤怒', '不甘'],
    openingLines: {
      junshi: '追损是赌场设计里最精妙的陷阱。你输了之后肾上腺素飙升，判断力下降，这时候你加大的每一注，都是在给赌场送钱。',
      xiaofang: '我在网上玩的时候就是这样，输了500就想下1000追回来，结果一晚上从500变成了输5万。那种感觉就是停不下来。',
      ajie: '我在赌场做过荷官，见过太多追损的人。他们的眼神从一开始的紧张变成最后的麻木。赌场最欢迎的就是追损客，因为他们一定会输光。',
    },
    escalation: [
      { characterId: 'xiaofang', line: '但是如果我运气好呢？有时候加注确实追回来了啊！', emotion: '侥幸' },
      { characterId: 'ajie', line: '你只记得追回来的那一次。追损成功的记忆比失败深刻十倍，这就是大脑在骗你。', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '追损的数学期望永远是负的。情绪化加注只会让赌场优势成倍放大。赢了是偶然，输光是必然。设定止损线然后严格执行，才是唯一正确的策略。',
    },
  },
  {
    id: 'psych_memory_005',
    topic: '为什么赌客只记得赢的那次，却忘了输过多少次？选择性记忆有多可怕？',
    category: '赌徒心理',
    subcategory: '自我欺骗',
    characters: ['gailv', 'aqiang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['只记得赢', '选择性记忆', '忘了输', '那次赢了'],
    userEmotionMatch: ['回忆', '得意', '迷茫'],
    openingLines: {
      gailv: '心理学上叫"确认偏误"。赌客的大脑会自动高亮赢钱的记忆，把输钱的经历标记为"意外"然后淡化。结果就是你觉得自己总体是赢的，但银行卡余额不会骗人。',
      aqiang: '我上个月百家乐赢了一万八！你们别老说我输，我是有赢过的！',
      laozhang: '阿强，你上个月总共去了几次赌场？花了多少时间？输了多少？你只记得那个一万八，其他的呢？',
    },
    escalation: [
      { characterId: 'aqiang', line: '其他……其他不重要！重点是证明我的方法有用！', emotion: '闪躲' },
      { characterId: 'gailv', line: '我帮你算过，你上个月去了七次，总投入约四万二。赢了一次一万八，净亏两万四。这才是真实数据。', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '大脑是最会自我保护的器官。它会让你只记住辉煌的那一刻，忘记痛苦的全过程。对抗选择性记忆最好的方法就是记账——让数字替你记住真相。',
    },
  },
  {
    id: 'psych_superstition_006',
    topic: '穿红内裤、摸貔貅、选吉时下注——迷信到底能不能帮你赢钱？',
    category: '赌徒心理',
    subcategory: '侥幸心理',
    characters: ['dashiwang', 'kellyprof', 'laoliu'],
    type: '混战',
    triggerKeywords: ['迷信', '风水', '吉时', '运气', '貔貅', '红内裤'],
    userEmotionMatch: ['好奇', '信任', '犹豫'],
    openingLines: {
      dashiwang: '我跟你们说，赌前三天吃素，当天穿红内裤，左手进门，先拜财神再入座。我的客户照做了，十个有七个赢了第一把！',
      kellyprof: '七个赢了第一把？第一把的胜率本来就接近50%。你把随机结果包装成了因果关系。这叫"虚假相关"。',
      laoliu: '话说回来，我们一帮朋友打牌，谁穿红那天确实手气好欸！你说没用，但大家心里都信，至少心态好嘛。',
    },
    escalation: [
      { characterId: 'dashiwang', line: '心态好就是气场正！气场正财运就旺！这是几千年的智慧，比你那些公式管用！', emotion: '激动' },
      { characterId: 'kellyprof', line: '安慰剂效应确实能让人暂时放松，但它改变不了概率。放松的心态加上错误的信念，只会让你更大胆地输钱。', emotion: '严谨' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '迷信给人的是"控制感幻觉"。当你觉得自己能通过仪式影响随机事件时，你就低估了风险、高估了胜算。骰子不认识你的内裤是什么颜色。',
    },
  },
  {
    id: 'psych_nearmiss_007',
    topic: '差一点就中了！"差一点"为什么反而让人赌得更凶？',
    category: '赌徒心理',
    subcategory: '成瘾机制',
    characters: ['gailv', 'xiaofang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['差一点', '差一个号', '险些中了', '近失效应'],
    userEmotionMatch: ['兴奋', '遗憾', '不甘'],
    openingLines: {
      gailv: '近失效应是赌博设计中最邪恶的心理陷阱。老虎机故意让你经常看到"差一个符号"就中大奖，其实那跟差十个没有任何区别。',
      xiaofang: '我玩线上老虎机的时候天天碰到这种！三个7差一个就中了，我就觉得我已经很接近了，再来几把肯定能中！',
      junshi: '这正是赌场工程师想让你有的感觉。研究显示，"差一点中奖"激活的大脑区域跟"真的中奖"几乎一样。你的大脑把失败处理成了半个成功。',
    },
    escalation: [
      { characterId: 'xiaofang', line: '但是差一个跟差十个确实不一样吧？差一个说明我的运气在上升啊！', emotion: '执念' },
      { characterId: 'gailv', line: '不一样。老虎机的每次旋转都是随机数生成器决定的。"差一个"是视觉效果，不是概率提示。你被表象骗了。', emotion: '耐心' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '"差一点"在数学上等于"没中"。赌场花了几十亿研发费用让你产生"下次就中了"的错觉。看清近失效应，才不会被假希望拖入深渊。',
    },
  },
  {
    id: 'psych_control_008',
    topic: '我有自己的系统和策略，这跟盲目赌博不一样吧？控制幻觉是怎么害人的？',
    category: '赌徒心理',
    subcategory: '认知偏差',
    characters: ['kellyprof', 'aqiang', 'ajie'],
    type: '对峙',
    triggerKeywords: ['系统', '策略', '不一样', '有方法', '控制'],
    userEmotionMatch: ['自信', '骄傲', '防备'],
    openingLines: {
      kellyprof: '控制幻觉是指人们高估自己对随机事件的影响力。当赌客可以自己投骰子时，他们会下更大的注——好像用力的方式能改变概率似的。',
      aqiang: '我不是盲目的！我有一套马丁格尔加倍法，输了就翻倍，数学上迟早能赢回来！',
      ajie: '阿强，我在赌场见过几百个用马丁格尔的人。没有一个活过一个月的。因为你的资金是有限的，但赌场的资金是无限的。',
    },
    escalation: [
      { characterId: 'aqiang', line: '那是他们资金管理没做好！我设了上限的！', emotion: '倔强' },
      { characterId: 'kellyprof', line: '设上限的马丁格尔等于截断了唯一的优势。有上限的加倍法，期望收益是负的。你以为你在控制，其实你在用更复杂的方式输钱。', emotion: '学术' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '有"策略"的赌客往往输得更多，因为策略给了他们虚假的安全感。在负期望值的游戏里，没有任何下注策略能把亏损变成盈利。唯一赢的方法是不玩。',
    },
  },
  {
    id: 'psych_emotional_009',
    topic: '心情不好就想赌一把？情绪化赌博为什么最危险？',
    category: '赌徒心理',
    subcategory: '情绪管理',
    characters: ['xiaotian', 'junshi', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['心情差', '借酒浇愁', '情绪赌博', '发泄'],
    userEmotionMatch: ['低落', '愤怒', '压抑'],
    openingLines: {
      xiaotian: '我每次心情不好就想赌。工作被骂了想赌，跟女朋友吵架了想赌，甚至无聊了也想赌。赌桌上那种紧张感能让我暂时忘掉一切。',
      junshi: '你描述的是典型的情绪调节型赌博。赌博在这里已经不是为了赢钱，而是成了你的"情绪止痛药"。但这种止痛药的副作用会让你的生活更痛苦。',
      laoliu: '说实话我也有这种感觉。周末约兄弟们打牌，更多是图热闹、逃避无聊。但小天你那个程度好像有点不一样了……',
    },
    escalation: [
      { characterId: 'xiaotian', line: '我知道不对，但我找不到别的方式啊！除了赌，没有什么能让我这么快从情绪里出来。', emotion: '无助' },
      { characterId: 'junshi', line: '速效的逃避手段往往代价最高。跑步、冥想、甚至打游戏的多巴胺回路都比赌博健康得多，只是见效没那么快。', emotion: '关切' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '情绪化赌博的本质是用更大的问题掩盖当前的问题。你逃避了一个小时的坏心情，换来了可能几个月的经济和精神创伤。找到健康的情绪出口，才是真正的解药。',
    },
  },
  {
    id: 'psych_social_010',
    topic: '朋友都在赌，不参加就被排挤？社交压力下怎么拒绝赌博？',
    category: '赌徒心理',
    subcategory: '社交压力',
    characters: ['laoliu', 'xiaotian', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['朋友都赌', '合群', '面子', '社交', '排挤'],
    userEmotionMatch: ['纠结', '焦虑', '无奈'],
    openingLines: {
      laoliu: '在我们那个圈子里，不赌就是不合群。每周五兄弟们打牌，你不来几次人家就不叫你了。很多时候我赌不是因为想赢钱，是因为不想失去这群朋友。',
      xiaotian: '我就是这样开始的。一开始只是陪朋友玩玩小的，后来越来越大。等我想退出的时候，发现朋友圈里除了赌就没有别的社交了。',
      laozhang: '所谓的赌友，90%在你输光的时候不会借你一分钱。我输到最惨的时候，牌桌上的"兄弟"一个都找不到了。真正的朋友不会因为你不赌就抛弃你。',
    },
    escalation: [
      { characterId: 'laoliu', line: '话是这么说，但你让我周末一个人待着我受不了啊。总得有个社交活动吧？', emotion: '矛盾' },
      { characterId: 'laozhang', line: '你可以约他们吃饭、打球、钓鱼。如果除了赌什么都不愿意做的朋友，那本身就值得你重新审视这段关系。', emotion: '真诚' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '社交压力型赌博的核心问题不是赌博，是你的社交圈结构。当你唯一的社交方式是赌博时，戒赌就等于社会性死亡。先建立非赌博的社交替代方案，才能真正脱身。',
    },
  },
  {
    id: 'psych_denial_011',
    topic: '我没有赌瘾啊，我只是偶尔玩玩！否认心理是怎么一步步毁掉你的？',
    category: '赌徒心理',
    subcategory: '自我欺骗',
    characters: ['ajie', 'aqiang', 'kellyprof'],
    type: '对峙',
    triggerKeywords: ['没有赌瘾', '偶尔', '玩玩', '否认', '我能控制'],
    userEmotionMatch: ['防备', '抵触', '否认'],
    openingLines: {
      ajie: '在赌场工作的时候，我听过最多的一句话就是"我没有赌瘾"。说这话的人里面，有一半每周至少来三次。',
      aqiang: '我确实没有赌瘾！我只是周末来放松一下。你们不能因为我喜欢赌就说我有瘾吧？喝咖啡的人也没人说他们有瘾。',
      kellyprof: '判断是否成瘾有几个标准：是否越赌越大、输了是否想追、是否对家人隐瞒、是否因赌影响工作生活、是否戒过又复赌。阿强，你中了几条？',
    },
    escalation: [
      { characterId: 'aqiang', line: '……那些标准太宽泛了！按这个标准，喜欢打游戏的人也算有瘾！', emotion: '抗拒' },
      { characterId: 'ajie', line: '你现在这个反应本身就是否认的典型表现。真正"偶尔玩玩"的人，不会这么激动地为自己辩护。', emotion: '平静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '否认是成瘾最坚固的护城河。它不让你看见问题，也不让别人帮你。承认自己可能有问题，不是软弱，是觉醒。最勇敢的赌客是敢对自己说实话的人。',
    },
  },
  {
    id: 'psych_onemore_012',
    topic: '"最后一把就走"——为什么这句话是赌场里最大的谎言？',
    category: '赌徒心理',
    subcategory: '自控力',
    characters: ['laozhang', 'xiaofang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['最后一把', '再玩一把', '走了走了', '收手'],
    userEmotionMatch: ['犹豫', '挣扎', '自欺'],
    openingLines: {
      laozhang: '我赌了二十年，"最后一把"这句话我说了不下一万次。每次说出口的时候我是真心的，但每次都食言了。后来我明白了——这句话不是说给别人听的，是说给自己的良心听的。',
      xiaofang: '太真实了。我每次在线上玩，说好打完这一局就睡觉，结果一抬头天都亮了。手指就是不听话，自动就点了"再来一局"。',
      gailv: '这涉及到即时满足和延迟满足的博弈。赌博的即时反馈太强了，"再来一把"的诱惑在神经层面上会碾压"该走了"的理性判断。',
    },
    escalation: [
      { characterId: 'xiaofang', line: '有没有什么办法真的能让自己停下来？设闹钟、限额度我都试过了，没用。', emotion: '求助' },
      { characterId: 'laozhang', line: '真正有效的办法是物理隔离。不带钱包进赌场，网赌就注销账号。靠意志力对抗多巴胺，你永远赢不了。', emotion: '经验' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '"最后一把"是大脑跟你做的交易——它假装答应你停下来，换取你现在继续的许可。最有效的止损不是"最后一把"，而是"我不开始"。',
    },
  },
  {
    id: 'psych_escape_013',
    topic: '现实太苦了，赌桌上至少还有希望？用赌博逃避现实的人最后怎么样了？',
    category: '赌徒心理',
    subcategory: '沉迷心理',
    characters: ['xiaotian', 'laozhang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['逃避', '现实太苦', '赌桌有希望', '不想面对'],
    userEmotionMatch: ['绝望', '逃避', '麻木'],
    openingLines: {
      xiaotian: '我知道赌不好，但你们不了解我的生活。房贷压得喘不过气，工作被领导针对，回家跟老婆也说不上话。只有在赌桌上，我才觉得自己还有翻身的可能。',
      laozhang: '小天，你说的每一个字我都经历过。赌桌上的"希望"就像海市蜃楼——你走得越近，它退得越远。最后你不但没逃掉现实，还给现实加了一座大山。',
      junshi: '逃避型赌博是最难戒的类型，因为赌博在这里满足的是情感需求而不是经济需求。你真正需要解决的问题不在赌桌上。',
    },
    escalation: [
      { characterId: 'xiaotian', line: '那我怎么办？面对现实只会更痛苦。至少赌博的时候我还能感觉活着。', emotion: '绝望' },
      { characterId: 'laozhang', line: '当你只能通过赌博感觉"活着"的时候，你已经在用最昂贵的方式自我伤害了。痛苦的现实可以改变，但债务和赌瘾只会让改变更难。', emotion: '沉重' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博的"希望感"是有价格标签的——每一次兴奋都要用金钱和心理健康来买单。真正的出路不是逃进赌桌，而是在现实中找到哪怕很小的、可以改善的事情，然后从那里开始。',
    },
  },
  {
    id: 'psych_normalize_014',
    topic: '买股票、买彩票、玩德州不也是赌吗？赌博正常化为什么这么危险？',
    category: '赌徒心理',
    subcategory: '自我欺骗',
    characters: ['junshi', 'laoliu', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['正常化', '买股票也是赌', '大家都赌', '彩票', '德州'],
    userEmotionMatch: ['合理化', '辩解', '困惑'],
    openingLines: {
      junshi: '风险正常化是赌瘾的保护色。把赌博跟投资、彩票、德州混为一谈，是为了让自己觉得"大家都在做，所以没问题"。但这些东西的风险结构完全不同。',
      laoliu: '但你说实话，炒A股跟赌博有什么区别？散户不也是凭感觉买卖？德州扑克还算有技术含量的呢！',
      kellyprof: '关键区别在于：投资有正期望值的可能性，而赌场游戏的数学结构保证了庄家长期必赢。德州扑克对极少数顶尖玩家有正期望值，但99%的人高估了自己的水平。',
    },
    escalation: [
      { characterId: 'laoliu', line: '那你不让我赌，我连个娱乐都没了？人活着不就图个乐嘛！', emotion: '不满' },
      { characterId: 'junshi', line: '娱乐可以，但你要清楚娱乐的成本。看电影两百块，吃顿好的五百块。你的"娱乐"一个月花多少？', emotion: '犀利' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '把赌博正常化是大脑的自我保护机制。但"大家都做"不等于"安全"。真正重要的问题是：你能不能承受最坏的结果？如果答案是不能，那无论怎么包装，它都不只是"娱乐"。',
    },
  },
  {
    id: 'psych_overconfidence_015',
    topic: '我赢过大钱，说明我有赌博天赋？过度自信是怎么掏空你钱包的？',
    category: '赌徒心理',
    subcategory: '认知偏差',
    characters: ['gailv', 'aqiang', 'ajie'],
    type: '对峙',
    triggerKeywords: ['天赋', '赢过大钱', '有感觉', '过度自信', '我跟别人不一样'],
    userEmotionMatch: ['自信', '骄傲', '膨胀'],
    openingLines: {
      gailv: '过度自信偏差在赌客身上表现得最明显。统计数据显示，超过80%的赌客认为自己的赌技高于平均水平——这在数学上是不可能的。',
      aqiang: '你们不信我没关系。去年世界杯我连中了五场比分，赢了八万块。这不是运气，是我对足球的理解够深！',
      ajie: '阿强，你连中五场的概率是多少你算过吗？那是不到万分之一的小概率事件。你把极端运气当成了能力，从那以后你是不是投注越来越大？',
    },
    escalation: [
      { characterId: 'aqiang', line: '你们就是嫉妒！我后来确实输了一些，但那是因为状态不好，不是方法有问题！', emotion: '傲慢' },
      { characterId: 'gailv', line: '"状态好就赢、状态不好就输"——这套解释体系是不可证伪的。它让你永远可以维持"我有天赋"的幻觉，直到输完为止。', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博没有天赋一说。在负期望值游戏里，短期赢钱是概率的必然分布，不是能力的证明。过度自信让你加大赌注、降低警惕，最终把偶然的好运兑现成必然的亏损。',
    },
  },
  {
    id: 'psych_anchoring_016',
    topic: '我上次赢了十万，这次至少也要赢到十万才走！锚定效应如何扭曲你的目标？',
    category: '赌徒心理',
    subcategory: '认知偏差',
    characters: ['kellyprof', 'xiaofang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['上次赢了', '目标', '至少赢到', '锚定', '不够'],
    userEmotionMatch: ['贪婪', '不满足', '执念'],
    openingLines: {
      kellyprof: '锚定效应是指人们过度依赖第一个接收到的信息来做后续判断。在赌博中，你过去赢的最大金额会成为你心理上的"锚点"，让你觉得赢得少了就是"亏"。',
      xiaofang: '我就是这样！有一次在线上中了五万，从那以后赢个三五千我都觉得不过瘾。结果越押越大，想重现那次的感觉。',
      laozhang: '我年轻时候赢过三十万。那之后的十年，我一直在追那个三十万的影子。最后输掉的何止三十万，连房子都差点搭进去。',
    },
    escalation: [
      { characterId: 'xiaofang', line: '但是知道自己能赢到那个数，就说明那个目标不是不可能啊？', emotion: '不甘' },
      { characterId: 'kellyprof', line: '你混淆了"曾经发生过"和"可以重复发生"。中彩票的人也"发生过"，但你不会指望自己再中一次。那次大赢是统计噪声，不是你的基准线。', emotion: '理性' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '锚定效应让你把偶然的峰值当成了应得的标准。从此你每次赌博都是在追一个不存在的目标，永远觉得赢得不够。放下那个锚，才能停止追逐海市蜃楼。',
    },
  },
  {
    id: 'psych_magical_017',
    topic: '我感觉今天手气特别好，是不是老天给我暗示？神奇思维为什么是赌客最爱的毒药？',
    category: '赌徒心理',
    subcategory: '侥幸心理',
    characters: ['dashiwang', 'gailv', 'aqiang'],
    type: '混战',
    triggerKeywords: ['手气', '暗示', '感觉', '预感', '神奇思维'],
    userEmotionMatch: ['兴奋', '确信', '迷信'],
    openingLines: {
      dashiwang: '我跟你说，你那个感觉是对的！宇宙会给你发信号。今天出门看到喜鹊了吧？路上红灯少了吧？这些都是财运来了的征兆！',
      gailv: '王大师，你这套"宇宙信号论"害了多少人？你让赌客把随机事件解读成命运暗示，他们带着"今天一定赢"的信念去赌，输了你负责吗？',
      aqiang: '我倒觉得王大师说得有点道理。有时候确实能感觉到手气。我上个月有一天特别顺，走路都捡到钱了，那天果然赢了！',
    },
    escalation: [
      { characterId: 'gailv', line: '阿强，那天之前你"感觉很顺"但输了的日子呢？你只记得灵验的那次。', emotion: '无奈' },
      { characterId: 'dashiwang', line: '那是他那几次信号读错了！要跟我学的话准确率能到八成！', emotion: '狡辩' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '神奇思维的本质是把随机事件强行赋予意义。喜鹊跟骰子之间没有因果关系。当你开始从日常琐事里寻找"赌运信号"时，你已经把理性判断的大门关上了。',
    },
  },
  {
    id: 'psych_medication_018',
    topic: '赌博是我唯一能放松的方式。用赌博自我治疗，最后会变成什么样？',
    category: '赌徒心理',
    subcategory: '沉迷心理',
    characters: ['xiaotian', 'junshi', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['放松', '解压', '自我治疗', '唯一的出口', '焦虑'],
    userEmotionMatch: ['疲惫', '焦虑', '依赖'],
    openingLines: {
      xiaotian: '你们不知道我有多焦虑。睡不着觉、心跳加速、手抖。只有在赌的时候，脑子里那些乱七八糟的声音才会安静下来。赌博就是我的安眠药。',
      junshi: '你描述的症状已经不只是赌瘾了，这可能涉及焦虑症或其他心理健康问题。用赌博自我治疗就像用汽油灭火——短暂有效，但后果灾难性。',
      kellyprof: '从心理学角度说，赌博刺激时释放的肾上腺素和多巴胺确实能暂时压制焦虑信号。但这种"治疗"需要越来越大的剂量，跟药物成瘾的耐受性机制一模一样。',
    },
    escalation: [
      { characterId: 'xiaotian', line: '看心理医生要钱，吃药有副作用。赌博至少有可能赢钱回来，一举两得。', emotion: '合理化' },
      { characterId: 'junshi', line: '看医生一次几百块，赌博一次亏几千几万。你说哪个贵？而且医生真的能帮到你，赌博只会让焦虑越来越严重。', emotion: '直接' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '用赌博治焦虑就像用信用卡还信用卡——暂时缓解了压力，但债务越滚越大。焦虑需要专业的帮助，不是更大的刺激。第一步是承认赌博不是药，而是病的一部分。',
    },
  },
  {
    id: 'psych_identity_019',
    topic: '如果我不赌了，我还是谁？当"赌客"变成你的身份，戒赌为什么那么难？',
    category: '赌徒心理',
    subcategory: '沉迷心理',
    characters: ['laozhang', 'aqiang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['身份', '赌客', '不赌了干嘛', '戒赌', '我是谁'],
    userEmotionMatch: ['迷茫', '空虚', '恐惧'],
    openingLines: {
      laozhang: '赌了二十年，我所有的社交、所有的谈资、所有的情绪起伏都跟赌有关。有一天我真的停下来了，突然发现——我不知道自己除了赌还会什么、还能聊什么。',
      aqiang: '你说的这个我有点感觉。朋友们都叫我"阿强赌神"，虽然是开玩笑，但我还挺享受的。如果不赌了，大家还会记得我吗？',
      ajie: '这就是赌博最隐蔽的捆绑。它不只偷你的钱，还偷你的身份。当你的自我认知变成了"赌客"，戒赌就等于自我否定。这比戒掉行为本身难得多。',
    },
    escalation: [
      { characterId: 'aqiang', line: '但是我真的除了赌什么都不擅长啊。不赌了我就是个普通打工仔，谁还搭理我。', emotion: '自卑' },
      { characterId: 'laozhang', line: '阿强，"赌神"这个身份是你自己给的枷锁。你赌博的分析能力，用到股票研究、体育分析、数据行业，哪个不比赌强？', emotion: '真诚' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '戒赌最难的不是放下筹码，是重建自我。当"赌"变成你名字的一部分，戒赌就像在删除自己。但真相是：你远比"赌客"这两个字丰富得多。新身份需要时间来建立，但你值得拥有一个不被赌定义的人生。',
    },
  },
  {
    id: 'psych_fomo_020',
    topic: '不赌就怕错过大机会？戒赌后的FOMO恐惧到底怎么克服？',
    category: '赌徒心理',
    subcategory: '自控力',
    characters: ['xiaofang', 'junshi', 'gailv'],
    type: '对峙',
    triggerKeywords: ['错过', 'FOMO', '怕错过', '万一赢了', '戒赌后'],
    userEmotionMatch: ['焦虑', '恐惧', '犹豫'],
    openingLines: {
      xiaofang: '我戒了两个月了，但每天都在想"万一今天那场比赛我要是买了呢？"。看到群里有人晒单赢钱了，我就心里发慌，觉得自己错过了一个亿。',
      junshi: '这种FOMO是戒赌最大的复发诱因。你的大脑只会给你看"错过的赢"，但不会提醒你"避开的输"。你戒的这两个月，统计上你至少避免了多少亏损？',
      gailv: '我帮你算一笔账。按你之前的投注频率和金额，这两个月你大概避免了一到两万的亏损。群里晒单的人呢？他们只晒赢的，输的截图你永远看不到。',
    },
    escalation: [
      { characterId: 'xiaofang', line: '道理我都懂，但看到别人赢了我就觉得那本来应该是我的钱！', emotion: '焦躁' },
      { characterId: 'junshi', line: '那些不是"你的钱"。那是随机事件在别人身上的体现。你如果参与了，大概率的结果是你也输了，然后后悔没继续戒。', emotion: '坚定' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'FOMO是赌瘾最后的武器。它让你觉得不赌就是在亏。但数学不说谎——你每不赌的一天，都在赚你本来会输的钱。把"怕错过机会"换成"庆幸避开了陷阱"，这个心理转换才是戒赌能否成功的关键。',
    },
  },

// ══════════════════════════════════════════
  // 赌债人生 — 家庭破裂 / 债务危机 / 戒赌故事 / 借贷陷阱 / 心理健康
  // ══════════════════════════════════════════

  {
    id: 'debt_family_001',
    topic: '老婆发现了我的赌债，婚姻还能挽回吗？',
    category: '赌债人生',
    subcategory: '家庭破裂',
    characters: ['xiaotian', 'laozhang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['老婆发现', '离婚', '瞒着', '赌债', '婚姻', '家庭', '欺骗'],
    userEmotionMatch: ['绝望', '愧疚', '恐惧', '求助'],
    openingLines: {
      xiaotian: '我老婆翻到我的借贷记录了……四十多万的窟窿，她坐在那哭了一整夜，一句话没说。我觉得天塌了',
      laozhang: '当年我老伴也是这么发现的。不是金额让她崩溃，是被骗了这么久。信任碎了，比债还难补',
      junshi: '婚姻危机的核心不是钱——是信任的系统性崩塌。你需要先想清楚一个问题：你是真想戒，还是想先稳住老婆？',
    },
    escalation: [
      { characterId: 'xiaotian', line: '我真的想戒啊 但她说信不过我了 要带孩子回娘家……我连解释的机会都没有', emotion: '崩溃' },
      { characterId: 'laozhang', line: '别急着解释。你现在说什么她都觉得是骗她。你得用行动——把所有账号注销、银行卡交出来、主动去做心理咨询', emotion: '沉稳' },
      { characterId: 'xiaotian', line: '可是四十万怎么还？房贷还没还完呢……我感觉这辈子完了', emotion: '绝望' },
      { characterId: 'junshi', line: '先把情绪和财务分开处理。情绪上你需要真诚认错不推卸；财务上我们一笔一笔理清——哪些是高利贷、哪些是信用卡、哪些能协商分期', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '婚姻能不能挽回取决于三个条件：第一，你必须100%坦白所有债务，不能再藏一分钱；第二，你要建立外部监督机制——戒赌热线、心理咨询、财务透明；第三，你要给对方时间和选择的权利。挽回不是靠嘴说的，是靠系统性地重建信任',
      compromise: '小天承认过去三年一直在骗老婆，老张说当年自己也是这么过来的，最终花了两年才重新获得信任',
    },
  },

  {
    id: 'debt_family_002',
    topic: '父母的退休金被赌博败光了，怎么面对他们？',
    category: '赌债人生',
    subcategory: '家庭破裂',
    characters: ['xiaotian', 'laozhang', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['父母', '退休金', '养老钱', '败光', '面对', '愧疚', '老人'],
    userEmotionMatch: ['自责', '羞耻', '痛苦', '无颜面对'],
    openingLines: {
      xiaotian: '我偷了我爸妈攒了一辈子的退休金去赌……三十二万，全没了。我现在连家门都不敢进',
      laozhang: '年轻人啊……你爸妈攒那三十二万，可能是几十年的省吃俭用。我也年轻时干过这种事，到现在想起来心还在疼',
      laoliu: '我也借过家里的钱赌，但退休金这个性质太严重了。老人家没有时间再攒回来了，这不是简单的"借钱"',
    },
    escalation: [
      { characterId: 'xiaotian', line: '我知道我是畜生……我妈身体还不好 要是知道了不知道能不能撑住', emotion: '自我厌恶' },
      { characterId: 'laozhang', line: '别先给自己贴标签。你现在最重要的是制定一个还款计划，然后坦白。越拖越痛苦，而且老人迟早会发现', emotion: '严厉' },
      { characterId: 'laoliu', line: '兄弟说实话 你先别回家 找个朋友冷静一下 想好怎么说再回去', emotion: '实际' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '挪用父母退休金是赌博最恶劣的后果之一。你没有资格选择"不说"——这是他们的钱，他们有知情权。坦白之后，制定月还款计划，哪怕每月只能还两三千。同时，必须立刻寻求专业戒赌帮助，不是为了赎罪，是为了不让这种事再发生',
    },
  },

  {
    id: 'debt_family_003',
    topic: '孩子在学校被同学嘲笑"你爸是赌鬼"，怎么办？',
    category: '赌债人生',
    subcategory: '家庭破裂',
    characters: ['laozhang', 'xiaotian', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['孩子', '学校', '嘲笑', '赌鬼', '影响', '孩子心理', '儿女'],
    userEmotionMatch: ['心痛', '自责', '无助', '保护'],
    openingLines: {
      laozhang: '赌博最大的受害者不是赌徒自己，是孩子。我孙女上小学时，有一次回来问我："爷爷，你以前是不是坏人？"我心都碎了',
      xiaotian: '我儿子昨天回来不说话 关在房间里哭。后来他妈问出来说同学骂他爸是赌鬼……才八岁啊 他懂什么',
      junshi: '赌博造成的家庭创伤会通过代际传递。研究显示，赌徒子女成年后出现赌博问题的概率是普通人的2-4倍',
    },
    escalation: [
      { characterId: 'xiaotian', line: '我现在戒了快半年了 可是过去的事已经传出去了 邻居都知道……孩子怎么在这个环境生活', emotion: '绝望' },
      { characterId: 'laozhang', line: '你能戒半年已经很不容易了。但你欠孩子的不是道歉，是一个稳定的、可预期的父亲。孩子不怕你曾经犯错，怕的是你还会再犯', emotion: '沉痛' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '对孩子最好的弥补不是解释，是改变。第一，坚持戒赌并让孩子看到你的改变；第二，不要回避孩子的问题，用他能理解的方式承认"爸爸以前做了错事，现在在改"；第三，必要时寻求儿童心理咨询。孩子的心理健康是你戒赌的最大动力',
    },
  },

  {
    id: 'debt_loan_001',
    topic: '网贷借了十几个平台还赌债，越还越多怎么办？',
    category: '赌债人生',
    subcategory: '借贷陷阱',
    characters: ['xiaofang', 'junshi', 'ajie'],
    type: '混战',
    triggerKeywords: ['网贷', '以贷养贷', '借贷', '平台', '利息', '催收', '逾期', '信用'],
    userEmotionMatch: ['焦虑', '绝望', '恐惧', '求助'],
    openingLines: {
      xiaofang: '我现在十三个网贷平台轮着借 拆东补西 每个月光利息就要还一万多 工资根本不够……感觉掉进无底洞了',
      junshi: '以贷养贷是赌债恶化最常见的模式。你借的不是钱，是时间——而且每借一次，代价指数级增长',
      ajie: '你知道那些网贷平台靠什么赚钱吗？就靠你这种拆东补西的人。利滚利加上罚息手续费，你借10万最后可能要还30万',
    },
    escalation: [
      { characterId: 'xiaofang', line: '可是不借的话旧的马上逾期啊 催收电话已经打到我爸妈那了 我不能让他们知道', emotion: '恐慌' },
      { characterId: 'ajie', line: '催收打电话吓你是常规操作 很多是违法的。你别怕他们——先了解哪些是正规借贷、哪些是高利贷', emotion: '冷静揭穿' },
      { characterId: 'junshi', line: '停。先不要再借任何新的了。我们需要做一件事：把所有平台的本金、利率、剩余期数列出来，看看哪些超过法定利率上限——超过的部分你依法可以不还', emotion: '理性' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '处理网贷债务的正确顺序：第一步，停止一切新借贷；第二步，列出所有债务清单分清合法与非法借贷；第三步，年化利率超过24%的部分可以依法不还，超过36%的是高利贷；第四步，和正规平台协商延期或减免；第五步，制定3-5年还款计划。记住：催收恐吓不等于法律后果',
    },
  },

  {
    id: 'debt_loan_002',
    topic: '为了赌博借了高利贷，现在被威胁恐吓，怎么办？',
    category: '赌债人生',
    subcategory: '借贷陷阱',
    characters: ['ajie', 'junshi', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['高利贷', '威胁', '恐吓', '暴力催收', '上门', '砍手', '泼漆', '报警'],
    userEmotionMatch: ['恐惧', '绝望', '求助', '愤怒'],
    openingLines: {
      ajie: '高利贷的催收我太了解了。恐吓电话、上门泼漆、骚扰家人——这些都是套路。他们赌的就是你怕，你越怕越好拿捏',
      junshi: '首先明确一点：年化利率超过36%的民间借贷不受法律保护。暴力催收本身就是违法犯罪行为，你有权利报警',
      xiaotian: '我当年也借过高利贷……那段日子暗无天日。每天手机响我都全身发抖，觉得他们随时会来找我',
    },
    escalation: [
      { characterId: 'xiaotian', line: '他们说再不还就去我单位闹 还要把我赌博的事发到网上……我该怎么办', emotion: '恐惧' },
      { characterId: 'ajie', line: '这是标准的软暴力催收。记住三件事：录音保留证据、把威胁信息截图、去派出所报案。他们最怕的就是你真报警', emotion: '强硬' },
      { characterId: 'junshi', line: '高利贷的本质是非法金融。你借的钱超出法律保护部分可以不还。但你合法借贷的部分仍然要还。把两者分清楚', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '应对高利贷催收的核心策略：不跑、不躲、不再借新债还旧债。保留所有催收证据向警方报案，同时咨询律师确认合法债务金额。暴力催收者最怕法律——你越懂法，他们越怂。同时记住，你赌出来的债是真实的教训，合法部分该还的必须还',
    },
  },

  {
    id: 'debt_work_001',
    topic: '为了赌博挪用了公司的钱，被发现了怎么办？',
    category: '赌债人生',
    subcategory: '职场影响',
    characters: ['junshi', 'laozhang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['挪用公款', '公司', '贪污', '职务侵占', '挪用', '发现', '坐牢'],
    userEmotionMatch: ['恐惧', '绝望', '慌张', '后悔'],
    openingLines: {
      junshi: '挪用公款赌博是刑事犯罪——这不是道德问题了，是法律问题。你现在需要的不是安慰，是律师',
      laozhang: '当年我认识一个会计，挪了八万块去赌，想赢回来补上。结果越补越大，最后六十多万，判了七年',
      gailv: '赌博让人做出荒谬的决策：挪用公款赌博的"翻盘概率"接近于零，但下场的严重性是100%确定的。这是最糟糕的赌注',
    },
    escalation: [
      { characterId: 'laozhang', line: '你现在最重要的决定是：主动坦白还是等被发现。主动坦白+全额归还，量刑差别非常大', emotion: '严肃' },
      { characterId: 'junshi', line: '法律上，挪用资金罪数额较大的处3年以下。如果能在被发现前归还并自首，通常可以争取缓刑或从轻处理', emotion: '理性' },
      { characterId: 'gailv', line: '你现在面临的是一个清晰的决策树：自首+还款=最小代价，隐瞒+继续赌=指数级恶化。从任何角度看，止损点都是"现在"', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '挪用公款赌博没有"赌回来"的可能——你在用自由和前途做筹码。现在唯一理性的选择是：立即停止赌博，想办法筹钱归还挪用金额，然后找律师评估是否主动坦白。每多拖一天，后果都在加重。这是你人生中最重要的一次"止损"',
    },
  },

  {
    id: 'debt_work_002',
    topic: '因为赌博经常旷工迟到，快被辞退了怎么办？',
    category: '赌债人生',
    subcategory: '职场影响',
    characters: ['laoliu', 'xiaotian', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['上班', '旷工', '迟到', '辞退', '工作', '通宵赌', '精神不好'],
    userEmotionMatch: ['焦虑', '疲惫', '麻木', '后悔'],
    openingLines: {
      laoliu: '我之前也是这样 晚上打牌到凌晨三四点 第二天上班困得要死 领导找我谈了好几次话了',
      xiaotian: '我更惨 通宵玩网赌 已经连续旷工三天了 手机十几个未接来电都是公司的 我不敢接',
      laozhang: '工作是你翻身的唯一退路。赌博把钱赌没了不算最惨，把工作也赌没了才是真的万劫不复',
    },
    escalation: [
      { characterId: 'xiaotian', line: '可是一想到欠的债 根本没心思上班 就想着赢一把大的把债还了 然后好好工作', emotion: '幻想' },
      { characterId: 'laozhang', line: '"赢一把大的"——这句话我说了二十年，结果呢？赢了继续赌，输了更想赌。工作没了连最后的还债能力都没了', emotion: '痛心' },
      { characterId: 'laoliu', line: '老实说 你现在的状态上班也是行尸走肉。但至少去——哪怕在工位上坐着发呆 也比在家里赌强', emotion: '实际' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博摧毁职业生涯的路径很清晰：通宵→疲惫→迟到→旷工→辞退→失去收入→更疯狂赌博→彻底崩盘。打断这个循环只有一个办法：强制切断赌博入口。注销所有赌博账号，把手机赌博APP全删，然后逼自己回到工作岗位。工资是你唯一的合法现金流，失去它等于失去一切',
    },
  },

  {
    id: 'debt_quit_001',
    topic: '戒赌一年了又复赌了，是不是永远戒不掉？',
    category: '赌债人生',
    subcategory: '戒赌故事',
    characters: ['xiaotian', 'laozhang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['复赌', '戒赌', '复发', '忍不住', '又赌了', '戒不掉', '瘾'],
    userEmotionMatch: ['沮丧', '自我怀疑', '绝望', '无力'],
    openingLines: {
      xiaotian: '我戒了整整一年零三个月……上周朋友请吃饭 饭后有人说"小赌怡情" 我就跟着去了。一晚上输了两万八 我恨死自己了',
      laozhang: '戒赌最危险的时刻不是刚开始，是你觉得自己"已经没问题了"的时候。一年多不赌 你放松警惕了',
      kellyprof: '从行为成瘾的研究来看，复发不代表失败——戒赌平均需要5-7次尝试才能稳定。关键是从每次复发中找到触发点',
    },
    escalation: [
      { characterId: 'xiaotian', line: '可是每次复赌我都恨不得去死……一年多的努力白费了 我是不是就是个废物', emotion: '自我否定' },
      { characterId: 'kellyprof', line: '一年不赌不是"白费"——你的大脑奖赏回路已经在修复了。复赌是一次事件，不是定义你的标签。酗酒者平均复饮4-5次才能长期戒断，赌博成瘾也一样', emotion: '科学' },
      { characterId: 'laozhang', line: '我戒了三次才真正戒掉。第一次戒了半年、第二次一年、第三次到现在已经八年了。每次复赌都让我更清楚自己的弱点在哪', emotion: '鼓励' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '复赌不等于戒赌失败——它是戒赌过程的一部分。关键行动：第一，不要因为复赌就放弃，"破罐破摔"才是真正的失败；第二，分析这次的触发因素——社交场合、朋友怂恿、情绪低落？把触发点记下来设防；第三，重新设定从今天开始的戒赌日期。你不需要完美，你需要的是每次复发后站起来的能力',
    },
  },

  {
    id: 'debt_quit_002',
    topic: '戒赌后生活太无聊了，整天不知道干什么',
    category: '赌债人生',
    subcategory: '戒赌故事',
    characters: ['laoliu', 'laozhang', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['无聊', '空虚', '戒赌后', '没事干', '不知道干什么', '替代', '多巴胺'],
    userEmotionMatch: ['空虚', '迷茫', '无聊', '怀念'],
    openingLines: {
      laoliu: '我以前每天都有赌局 朋友天天约 生活有盼头。现在戒了 晚上下班回家就是刷手机 活着跟行尸走肉一样',
      laozhang: '戒赌后的空虚期我太懂了。赌博把你大脑的多巴胺阈值拉高了，正常的快乐根本满足不了你',
      xiaotian: '我也是……戒赌之后感觉什么都没意思 上班没意思 吃饭没意思 甚至跟老婆孩子在一起也没什么感觉',
    },
    escalation: [
      { characterId: 'laoliu', line: '有时候想 是不是偶尔打打小牌就好 不去赌场 就跟朋友玩玩 又不算赌博', emotion: '纠结' },
      { characterId: 'laozhang', line: '这是最经典的复赌前兆。"小赌怡情"就是你当年入坑的第一步 你忘了吗？', emotion: '警告' },
      { characterId: 'xiaotian', line: '老张说得对。我就是因为"偶尔打打小牌"复赌了两次了。你大脑骗你呢——它在找借口重启多巴胺回路', emotion: '经验之谈' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '戒赌后的空虚是大脑多巴胺系统重新校准的过程，通常需要3-6个月。解决方案不是"找替代刺激"，而是培养稳定的正反馈活动：运动（跑步、健身）、学一门新技能、做志愿者、重建正常社交圈。你的大脑会慢慢恢复对正常快乐的感知能力，但前提是你不给它"捷径"',
    },
  },

  {
    id: 'debt_crisis_001',
    topic: '房子被赌债逼得要卖了，一家人住哪？',
    category: '赌债人生',
    subcategory: '债务危机',
    characters: ['xiaotian', 'junshi', 'laozhang'],
    type: '对峙',
    triggerKeywords: ['卖房', '房子', '赌债', '无家可归', '抵押', '贷款', '住哪'],
    userEmotionMatch: ['绝望', '恐惧', '愧疚', '无助'],
    openingLines: {
      xiaotian: '催债的说再不还就走法律程序冻结房产……这是我全家唯一的住处 老婆孩子老人都靠这套房子',
      junshi: '房产是你最后的底线资产。在法律上，唯一住房有一定的保护条款——不是所有情况下都能被强制执行。你需要马上咨询律师',
      laozhang: '我当年把房子卖了还赌债 一家人租了三年的房子。那三年是我这辈子最黑暗的日子 但也是我真正清醒的开始',
    },
    escalation: [
      { characterId: 'xiaotian', line: '我老婆说如果房子没了她就带着孩子走……我不能失去这个家啊', emotion: '崩溃' },
      { characterId: 'junshi', line: '先冷静。你欠的是正规银行还是民间借贷？如果是民间高利贷，很多催收手段本身不合法。别被恐吓吓住', emotion: '冷静' },
      { characterId: 'laozhang', line: '孩子 听我说句难听的：你已经在失去这个家了 不是因为房子 是因为赌博。房子卖不卖是其次 你不戒赌 有十套房也不够赔的', emotion: '痛心' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '保住房产的优先级措施：第一，确认债务合法性，高利贷超出法律保护部分坚决不认；第二，核实"唯一住房"的执行豁免条件；第三，与债权人协商分期偿还方案；第四，如果必须处置房产，考虑抵押而非出售。但最核心的问题是：即使保住了这次，不戒赌就还会有下次。止血不等于治病',
    },
  },

  {
    id: 'debt_crisis_002',
    topic: '信用卡套现赌博，已经逾期半年了怎么处理？',
    category: '赌债人生',
    subcategory: '债务危机',
    characters: ['xiaofang', 'junshi', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['信用卡', '套现', '逾期', '征信', '银行', '刷卡', '最低还款', '分期'],
    userEmotionMatch: ['焦虑', '恐惧', '求助', '迷茫'],
    openingLines: {
      xiaofang: '五张信用卡全刷爆了 总共欠了十八万 已经逾期半年 天天接催收电话 征信估计完了',
      junshi: '信用卡逾期是有明确法律后果的：逾期90天以上会被记入征信黑名单，恶意透支超过5万元可能构成信用卡诈骗罪',
      gailv: '十八万信用卡债如果按最低还款利滚利，两年后可能变成二十五万以上。时间在这件事上是你的敌人',
    },
    escalation: [
      { characterId: 'xiaofang', line: '那我现在该怎么办？有人说可以跟银行协商停息挂账 是真的吗？', emotion: '求助' },
      { characterId: 'junshi', line: '停息挂账是有法律依据的——《商业银行信用卡业务监督管理办法》第七十条。你可以申请个性化分期，最长60期', emotion: '指导' },
      { characterId: 'gailv', line: '协商成功率取决于你的态度和方案。你要证明自己确实没有还款能力但有还款意愿——准备好收入证明和困难说明', emotion: '务实' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '处理信用卡赌债的关键步骤：第一，主动联系发卡行信用卡中心说明困难情况，申请个性化分期还款；第二，先还金额最小的卡来减少心理压力；第三，绝对不要"以贷还卡"；第四，征信修复需要结清后等5年自动消除。这是一场3-5年的持久战，但只要你停止赌博开始还债，每一天都在好起来',
    },
  },

  {
    id: 'debt_mental_001',
    topic: '因为赌债已经想过不活了，该找谁帮忙？',
    category: '赌债人生',
    subcategory: '心理健康',
    characters: ['junshi', 'laozhang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['不想活', '自杀', '跳楼', '活着没意思', '结束', '解脱', '绝望'],
    userEmotionMatch: ['绝望', '痛苦', '想死', '麻木'],
    openingLines: {
      junshi: '如果你现在有自杀的想法，请先拨打24小时心理危机热线：400-161-9995 或 010-82951332。债可以慢慢还，命只有一条',
      laozhang: '我当年站在天台上过。是一个陌生人拉住了我——他说"你死了债不会消失 只是转嫁给你家人了"。这句话救了我',
      kellyprof: '赌债导致的自杀风险是真实的临床问题。研究显示赌博障碍患者的自杀企图率是普通人群的3-4倍。你需要立刻寻求专业帮助',
    },
    escalation: [
      { characterId: 'laozhang', line: '听我说 你现在觉得走投无路 是因为你的大脑被赌债的压力和赌博成瘾同时绑架了。这不是你真正的想法 是病在说话', emotion: '温暖' },
      { characterId: 'kellyprof', line: '赌博成瘾是世卫组织认定的精神疾病（ICD-11 6C50），不是意志力问题。你不是"坏人"或"废物"，你是一个需要治疗的病人', emotion: '专业' },
      { characterId: 'junshi', line: '把生命和债务放在天平上是不对的。破产可以重来、征信五年能恢复、亲人可以重新信任——但死了什么都没有了', emotion: '郑重' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '如果你正在经历自杀念头，请记住三件事：第一，立刻联系专业人士（心理危机热线400-161-9995）；第二，债务问题100%有法律解决方案，没有任何一笔债值得用命去抵；第三，你现在的极端想法是赌博成瘾+债务压力造成的暂时性认知扭曲，不是客观现实。活着，才有翻盘的可能',
    },
  },

  {
    id: 'debt_mental_002',
    topic: '赌博让我得了抑郁症，吃药也没用怎么办？',
    category: '赌债人生',
    subcategory: '心理健康',
    characters: ['kellyprof', 'xiaotian', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['抑郁', '抑郁症', '吃药', '精神科', '心理咨询', '失眠', '焦虑', '治疗'],
    userEmotionMatch: ['痛苦', '无力', '绝望', '麻木'],
    openingLines: {
      kellyprof: '赌博障碍和抑郁症的共病率高达50-75%。如果只治一个不治另一个，效果当然不好。你需要同时治疗赌瘾和抑郁',
      xiaotian: '我吃了半年的抗抑郁药 每天还是不想起床。医生说要配合心理治疗 可是我觉得跟人说我赌博很丢人',
      laozhang: '丢人？你得了病不治才丢人。我当年也觉得去精神科丢脸 结果拖了两年差点把命搭进去',
    },
    escalation: [
      { characterId: 'xiaotian', line: '有时候我想 如果没赌博我不会抑郁 如果不抑郁我也不会靠赌博逃避……到底哪个先开始的', emotion: '困惑' },
      { characterId: 'kellyprof', line: '这就是所谓的"双向驱动"——赌博加重抑郁，抑郁又驱动赌博寻求多巴胺。药物治疗只能解决生理基础，心理治疗才能打破这个循环', emotion: '专业' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博+抑郁的治疗方案需要三管齐下：第一，药物治疗（遵医嘱不要自行停药或调整剂量）；第二，认知行为治疗（CBT），专门针对赌博成瘾的非理性信念；第三，生活方式干预——规律作息、有氧运动、切断赌博渠道。"吃药没用"很可能是药物还没到起效期（通常4-6周），或者需要调整方案，跟医生如实沟通',
    },
  },

  {
    id: 'debt_relation_001',
    topic: '最好的兄弟借了我二十万去赌，现在人消失了',
    category: '赌债人生',
    subcategory: '人际关系',
    characters: ['laoliu', 'laozhang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['借钱', '朋友', '兄弟', '跑路', '消失', '不还', '友情', '信任'],
    userEmotionMatch: ['愤怒', '心寒', '失望', '纠结'],
    openingLines: {
      laoliu: '十几年的兄弟 说做生意要周转 我把积蓄借给他了。后来才知道全拿去赌了 现在电话关机人找不到',
      laozhang: '赌徒借钱有一套标准话术：说做生意、说急用、说很快还——但从不说去赌。这不是因为他想骗你，是因为赌瘾让他相信自己能赢回来还你',
      junshi: '借钱给赌徒是"帮助"的反面——行为学上叫做"使能行为"。你的钱不是帮了他，是帮他继续赌',
    },
    escalation: [
      { characterId: 'laoliu', line: '我现在又气又心疼……气的是他骗我 心疼的是那可是我的血汗钱 本来准备买车的', emotion: '愤怒' },
      { characterId: 'laozhang', line: '你找不到他 他不一定是故意跑路。很多赌徒输光后是因为羞耻和恐惧才消失的 他可能比你更痛苦', emotion: '理解' },
      { characterId: 'junshi', line: '情感上可以理解 但经济上你得做最坏打算。有借条吗？有转账记录吗？如果要走法律途径需要这些证据', emotion: '理性' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '处理这种情况需要分开两条线：法律线——保留借条和转账记录，必要时起诉（虽然执行困难但至少保留追偿权利）；情感线——认清一个事实：你的兄弟不是"坏人"，他是一个被成瘾控制的病人。但这不意味着你要继续为他买单。设定边界：可以原谅，但绝不再借钱',
    },
  },

  {
    id: 'debt_relation_002',
    topic: '赌博输光后所有朋友都疏远了我，感觉被全世界抛弃',
    category: '赌债人生',
    subcategory: '人际关系',
    characters: ['xiaotian', 'laoliu', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['孤立', '没朋友', '疏远', '被抛弃', '社交', '丢人', '抬不起头'],
    userEmotionMatch: ['孤独', '自卑', '绝望', '委屈'],
    openingLines: {
      xiaotian: '以前赌的时候天天有人约我 一帮兄弟出入赌场。现在输光了欠了一屁股债 一个人都找不到了',
      laoliu: '说实话有些"朋友"本来就是赌桌上认识的 有钱一起嗨 没钱就散了 这种不叫友情叫"牌搭子"',
      laozhang: '真正的朋友会在你最难的时候还在。但你也得给他们理由留下来——你得让他们看到你在改变 而不是继续赌',
    },
    escalation: [
      { characterId: 'xiaotian', line: '连我发小都不理我了……他说怕我又找他借钱。我真的已经在戒赌了 可是没人信', emotion: '委屈' },
      { characterId: 'laozhang', line: '信任崩塌后的重建比还钱更难。你发小不是不理你 是被你伤怕了。给他时间 用持续的行动证明你变了', emotion: '慈悲' },
      { characterId: 'laoliu', line: '我建议你去找戒赌互助的圈子 那里的人不会看不起你 因为大家都经历过。你需要一个不评判你的环境', emotion: '建议' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博后的社交重建分三步：第一，接受现实——"赌桌朋友"散了不是损失，是净化社交圈；第二，加入戒赌互助组织（GA匿名戒赌会），获得理解你的同伴支持；第三，用时间和行动重建旧友关系，不要急——他们需要看到你至少稳定戒赌半年以上才会慢慢恢复信任',
    },
  },

  {
    id: 'debt_recover_001',
    topic: '欠了一百多万赌债，还有可能翻身吗？',
    category: '赌债人生',
    subcategory: '东山再起',
    characters: ['junshi', 'laozhang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['翻身', '还债', '百万', '东山再起', '还有希望', '重新开始', '计划'],
    userEmotionMatch: ['绝望中求希望', '求助', '迷茫', '决心'],
    openingLines: {
      junshi: '一百万赌债是沉重的 但不是不可逆的。关键问题是：你有稳定收入吗？你愿意花5-10年来还吗？',
      laozhang: '我当年欠了六十多万。花了整整七年还清 中间没一天好过。但还清的那天 我站在银行门口哭了半小时',
      gailv: '简单算一笔账：如果你月收入一万 每月还五千 不算利息也需要将近17年。但如果提升收入到两万 就变成不到9年。关键变量是你的赚钱能力',
    },
    escalation: [
      { characterId: 'laozhang', line: '我告诉你我怎么过来的：白天正常上班 晚上去跑网约车 周末去工地搬砖。三份收入全用来还债 一分不留', emotion: '坚定' },
      { characterId: 'junshi', line: '还债策略有两种："雪球法"先还小额建立信心，"雪崩法"先还高利率减少总利息。一百万的体量建议用雪崩法', emotion: '理性' },
      { characterId: 'gailv', line: '还有一个关键数据：你的债务中多少是高利贷？超过法律保护的部分可以通过法律手段减免 先把总额降下来', emotion: '务实' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '百万赌债翻身的路线图：第一，梳理债务——区分合法和非法部分，非法的依法减免；第二，开源——在保住主业的基础上找副业增收；第三，节流——制定最低生活标准的预算；第四，设里程碑——每还清一笔就庆祝一次；第五，最重要的——永远不碰赌博。翻身不是一天的事，是几千个不赌的日子累加出来的',
      compromise: '老张分享了自己七年还债的经历，概率哥用数据帮助分析了最优还款顺序',
    },
  },

  {
    id: 'debt_recover_002',
    topic: '有人说"赌债赌还"，靠赌博赢回来可能吗？',
    category: '赌债人生',
    subcategory: '东山再起',
    characters: ['aqiang', 'gailv', 'junshi'],
    type: '对峙',
    triggerKeywords: ['赌回来', '翻本', '赌债赌还', '赢回来', '一把翻盘', '最后一把'],
    userEmotionMatch: ['侥幸', '不甘', '冲动', '幻想'],
    openingLines: {
      aqiang: '有时候真想豁出去赌一把大的 赢了一切都解决了 输了大不了跑路。反正已经这样了还能怎么更差',
      gailv: '我来告诉你"更差"是什么概念：你现在欠五十万 如果"最后一把"输了 可能变一百万。你的下限远比你想象的低得多',
      junshi: '"赌债赌还"是赌博成瘾最危险的认知陷阱。从概率上说 这句话等于"把负期望值事件重复执行来获得正收益"——在数学上不成立',
    },
    escalation: [
      { characterId: 'aqiang', line: '可是确实有人赢回来了啊！我认识一个哥们欠了三十万 去澳门三天赢了四十万 全还清了', emotion: '侥幸' },
      { characterId: 'gailv', line: '幸存者偏差。你认识一个赢回来的 但你不知道有一千个试图"赌回来"结果越陷越深的。你只看到了活着回来吹牛的那一个', emotion: '冷静戳穿' },
      { characterId: 'junshi', line: '就算你这次运气逆天赢回来了——然后呢？你会觉得自己"手气回来了"，继续赌。赢回来不是结束 是新一轮灾难的开始', emotion: '一针见血' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '"赌债赌还"在概率上、心理上和现实案例中都被证明是死路一条。概率上，负期望值游戏不会因为你"需要赢"就变成正期望值；心理上，即使偶尔赢了也会继续赌直到输光；现实中，99%试图"赌回来"的人最终债务翻倍。唯一靠谱的"翻盘"方式是：停止赌博 + 努力工作 + 系统还债',
    },
  },

  {
    id: 'debt_family_004',
    topic: '赌博离婚后前妻不让我见孩子，该怎么争取？',
    category: '赌债人生',
    subcategory: '家庭破裂',
    characters: ['laozhang', 'junshi', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['离婚', '探视', '孩子', '抚养权', '前妻', '见孩子', '监护'],
    userEmotionMatch: ['痛苦', '想念', '自责', '求助'],
    openingLines: {
      laozhang: '孩子是你戒赌最大的动力。我跟老伴分开那几年 不让我见孙子 那种感觉比欠债还痛苦',
      junshi: '从法律上说 离婚后非抚养方有探视权 这是法定权利。但你需要证明你目前的状态适合接触孩子——也就是说 你必须先证明自己戒赌了',
      xiaotian: '我也在经历这个……前妻说我是"定时炸弹" 不戒赌就别想见孩子。说实话 她说得对 我当时那个状态确实不适合带孩子',
    },
    escalation: [
      { characterId: 'xiaotian', line: '可是不让见孩子我更难受 越难受越想赌来麻痹自己……这是死循环啊', emotion: '痛苦' },
      { characterId: 'laozhang', line: '打破这个循环只有一个方向：先戒赌 再争取。你带着赌瘾去争探视权 法官也不会支持你', emotion: '严肃' },
      { characterId: 'junshi', line: '建议你做三件事：第一 参加正式的戒赌治疗并保留证明；第二 每月按时支付抚养费；第三 通过律师正式申请探视。你需要用制度化的方式证明自己', emotion: '策略' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '争取探视权的前提是重建你作为父亲的可信度。法院会看三个维度：经济能力（按时支付抚养费）、行为改善（戒赌治疗记录）、稳定性（有固定工作和住所）。这不是一两个月能解决的事 但每一天的坚持都在为你积累筹码。为了孩子 这是你此生最值得的投资',
    },
  },

  {
    id: 'debt_loan_003',
    topic: '大学生用学费去赌博输光了，下学期开不了学',
    category: '赌债人生',
    subcategory: '借贷陷阱',
    characters: ['xiaofang', 'kellyprof', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['学费', '大学生', '学生', '休学', '开除', '校园贷', '学业'],
    userEmotionMatch: ['恐惧', '羞耻', '后悔', '迷茫'],
    openingLines: {
      xiaofang: '我是大三的学生……把下学期的学费一万二拿去网赌了 两天就输完了。再过一个月就要交学费 我不敢跟家里说',
      kellyprof: '校园赌博是一个严峻的社会问题。数据显示大学生问题赌博率高达5-8% 远超成年人群。你不是个案 但你现在的处理方式决定了未来走向',
      junshi: '一万二不是天文数字 但对学生来说确实是巨大的数目。好消息是：大多数学校有学费减免、缓交、助学贷款等机制 你不一定会失学',
    },
    escalation: [
      { characterId: 'xiaofang', line: '可是如果去申请缓交 学校会不会知道我赌博？会不会处分我？', emotion: '害怕' },
      { characterId: 'kellyprof', line: '申请学费缓交只需要说明"家庭经济困难" 学校不会追查原因。但我更建议你同时联系学校心理咨询中心 他们有保密义务', emotion: '温和' },
      { characterId: 'junshi', line: '你现在有两条路：A 跟家里坦白 这很痛苦但是最快的解决方案；B 申请缓交+助学贷款+找兼职自己补上。无论走哪条路 第一步都是立刻注销所有赌博账号', emotion: '清晰' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '大学生赌博的黄金处理窗口就是现在——你还没有欠外债、没有犯罪记录、学业还能挽救。立刻行动：注销所有赌博平台账号、联系学校学生资助中心了解缓交和贷款政策、预约心理咨询。如果选择跟家长坦白 记住：他们会生气但不会不管你。一万二的教训换来一辈子不赌 这是最便宜的学费',
    },
  },

  {
    id: 'debt_mental_003',
    topic: '赌博的时候觉得自己是另一个人，正常吗？',
    category: '赌债人生',
    subcategory: '心理健康',
    characters: ['kellyprof', 'xiaotian', 'dashiwang'],
    type: '混战',
    triggerKeywords: ['人格', '变了一个人', '控制不住', '上头', '附体', '着魔', '失控'],
    userEmotionMatch: ['困惑', '恐惧', '不理解', '求解释'],
    openingLines: {
      kellyprof: '你描述的"变成另一个人"在临床上叫做"解离状态"——赌博时前额叶皮层活动降低 导致理性决策功能被抑制 情绪和冲动系统接管大脑',
      xiaotian: '太准了……我每次赌的时候感觉不是我在操作 像是有什么东西在控制我的手 明明知道该停 但身体不听使唤',
      dashiwang: '这就是命运在召唤你 你的运势到了 手感来了的时候就要跟着感觉走 不要违背天意',
    },
    escalation: [
      { characterId: 'kellyprof', line: '大师你这是最典型的迷信误导。赌博时的"心流状态"不是什么天意 是多巴胺系统劫持了前额叶的结果 和吸毒的神经机制几乎一样', emotion: '愤怒' },
      { characterId: 'dashiwang', line: '哎 科学也不是万能的嘛 有些东西科学解释不了 你看他赢的时候确实有一种气场在……', emotion: '狡辩' },
      { characterId: 'xiaotian', line: '大师别扯了 就是你这种人害得我觉得自己"有运气" 结果越赌越深 我现在才知道那是脑子出了问题不是运气', emotion: '醒悟' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博时的"失控感"有明确的神经科学解释：赌博刺激多巴胺大量释放 同时抑制前额叶的"刹车"功能 导致你做出清醒时不可能做的决定。这不是性格缺陷 不是命运 更不是什么"气场"——这是可以通过药物和心理治疗改善的脑功能失调。认识到这一点 是戒赌的关键第一步',
    },
  },

// ══════════════════════════════════════════
  // 骗局揭秘 — 15 scenarios
  // ══════════════════════════════════════════

  // ── 带单诈骗 ──

  {
    id: 'scam_daidian_001',
    topic: 'Telegram带单老师喊单到底是不是骗局？',
    category: '骗局揭秘',
    subcategory: '带单诈骗',
    characters: ['ajie', 'dashiwang', 'aqiang'],
    type: '混战',
    triggerKeywords: ['带单', '喊单', '老师', 'Telegram', '跟单', '分析师', '内幕消息'],
    userEmotionMatch: ['好奇', '半信半疑', '贪心'],
    openingLines: {
      ajie: '带单老师？我以前就干这行的。一个群500人，前三天免费喊单故意让你赢，第四天开始收费，第五天带你进假平台。流水线作业',
      dashiwang: '我认识几个"老师"，说白了就是平台的托。他们拿你亏损的30%当佣金，你输得越多他赚得越多',
      aqiang: '但我朋友跟了一个老师确实赚了啊 前两个月赚了一万多 后来……后来好像就不行了',
    },
    escalation: [
      { characterId: 'ajie', line: '你朋友那叫养猪。前期让你赢建立信任，后期加大仓位一把收割。这套路我见过不下一百次', emotion: '冷酷' },
      { characterId: 'aqiang', line: '操 那我朋友后来确实追加了五万进去 全没了……', emotion: '震惊' },
      { characterId: 'dashiwang', line: '五万算少的。我知道有个群把一个老板骗了两百万，那老板到现在还以为是自己运气不好', emotion: '嘲讽' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '带单诈骗的商业模式：前期用小额盈利建立信任（成本），后期引导大额投入收割（回报）。识别特征：保证收益、晒单截图、催你加仓、只推荐特定平台。记住：真能赚钱的人不会在Telegram免费教你',
    },
  },

  {
    id: 'scam_daidian_002',
    topic: '为什么带单骗局能骗到那么多人？',
    category: '骗局揭秘',
    subcategory: '带单诈骗',
    characters: ['ajie', 'gailv', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['为什么上当', '带单套路', '心理', '骗术', '信任'],
    userEmotionMatch: ['困惑', '反思', '警觉'],
    openingLines: {
      ajie: '带单骗局之所以有效，是因为它利用了三个心理弱点：贪婪、从众和沉没成本。你看500人的群都在晒盈利截图，你怎么可能不心动？',
      gailv: '从概率上说，任何随机喊单在短期内都有接近50%的正确率。前几天赢了不代表老师有本事，只是随机波动',
      xiaotian: '我就是被带单骗过的人……那个老师每天早上问我"今天感觉怎么样"，比我爸妈还关心我。后来才知道他同时跟几百个人说一样的话',
    },
    escalation: [
      { characterId: 'xiaotian', line: '最可怕的是你输了之后他说"没关系，我们回本"，然后让你加更多钱进去', emotion: '痛苦' },
      { characterId: 'gailv', line: '这就是沉没成本谬误。你已经投了三万，他告诉你再投两万就能回本，你的大脑会觉得"不投白亏了"', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '带单骗局的成功率高达30%以上，远超普通诈骗。原因在于它不像传统骗局那样要你直接转账，而是让你"自主交易"——你觉得钱是自己操作亏的，不是被骗的。这种认知错觉让很多人亏光了还不报警',
    },
  },

  // ── 赢利计划 ──

  {
    id: 'scam_yingli_001',
    topic: '"保证日入500"的赌博赢利计划可信吗？',
    category: '骗局揭秘',
    subcategory: '赢利计划',
    characters: ['dashiwang', 'gailv', 'junshi'],
    type: '对峙',
    triggerKeywords: ['日入', '保证盈利', '赢利计划', '稳赚', '包赢', '回本方案'],
    userEmotionMatch: ['贪心', '怀疑', '急躁'],
    openingLines: {
      dashiwang: '日入500？太保守了。我有个客户用我的方案月入三万，但这种事不能公开说，怕同行眼红',
      gailv: '任何保证正收益的赌博方案在数学上都不可能存在。如果真有，发明者自己用就行了，为什么要卖给你？',
      junshi: '这个问题的答案其实很简单：卖方案比用方案赚钱。一个方案卖1000块，卖100个人就是10万，零风险',
    },
    escalation: [
      { characterId: 'dashiwang', line: '你们这些人就是不信 我的方案是结合了易经八卦和AI算法的 跟普通方案不一样', emotion: '狡辩' },
      { characterId: 'gailv', line: '易经加AI？这两个词放在一起本身就是骗局标志。你能告诉我你的"AI"用的什么模型吗？', emotion: '嘲讽' },
      { characterId: 'dashiwang', line: '核心算法是商业机密 我凭什么告诉你 你想白嫖我的研究成果？', emotion: '恼怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '识别赢利计划骗局的铁律：1）保证收益=必定是骗；2）"商业机密"=没有逻辑经不起推敲；3）卖方案的人如果真能赢钱，他卖方案的动机是什么？答案只有一个——方案本身就是他的赢利方式',
    },
  },

  {
    id: 'scam_yingli_002',
    topic: '朋友圈天天晒盈利截图的人是真赚钱还是骗人？',
    category: '骗局揭秘',
    subcategory: '赢利计划',
    characters: ['ajie', 'xiaofang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['晒单', '朋友圈', '盈利截图', '晒收益', '战绩', '截图'],
    userEmotionMatch: ['羡慕', '怀疑', '心动'],
    openingLines: {
      ajie: '朋友圈晒单？十张截图里九张半是P的。剩下半张是真赢了，但他不会告诉你前面输了多少',
      xiaofang: '我之前也信了一个天天晒单的人 加了他VIP群 交了2000块会费 进去才发现全是托在互相吹',
      laozhang: '我赌了二十年 从没见过一个真正赢钱的人需要在朋友圈晒的。真正赢钱的人怕被人知道 怕借钱的上门',
    },
    escalation: [
      { characterId: 'ajie', line: '我教你一招：让他打开交易记录看总盈亏。只晒单笔不晒总账的 百分之百是骗子', emotion: '老练' },
      { characterId: 'xiaofang', line: '还有那种截图软件 输入数字自动生成各种平台的盈利截图 淘宝几块钱就能买到', emotion: '愤怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '晒单经济学：展示盈利的目的从来不是炫耀，而是引流。每一张盈利截图背后都是一条变现链——要么卖课、要么拉人头、要么推荐假平台。免费的午餐后面，是你看不到的账单',
    },
  },

  // ── 假平台 ──

  {
    id: 'scam_jiapingtai_001',
    topic: '怎么分辨网赌平台是真的还是假的？',
    category: '骗局揭秘',
    subcategory: '假平台',
    characters: ['ajie', 'junshi', 'xiaofang'],
    type: '圆桌',
    triggerKeywords: ['假平台', '黑平台', '正规平台', '牌照', '是不是真的', '骗子网站'],
    userEmotionMatch: ['警觉', '怀疑', '求助'],
    openingLines: {
      ajie: '简单一句话：所有中文网赌平台都是假的。没有例外。中国法律不允许在线赌博，所以任何中文平台都没有合法牌照',
      junshi: '阿杰说得对。就算它声称有"菲律宾牌照"或"马恩岛牌照"，也要去监管机构官网核实。90%的牌照号是编的',
      xiaofang: '我之前玩的那个平台做得特别像 APP下载 客服24小时在线 充值秒到 提现的时候才发现问题……',
    },
    escalation: [
      { characterId: 'xiaofang', line: '它要我先交20%的"税"才能提现 交了之后又说要"流水验证" 又要充钱……', emotion: '绝望' },
      { characterId: 'ajie', line: '经典套路。这叫"提现门槛"——设置无限循环的提现条件 目的就是让你不断充钱', emotion: '愤怒' },
      { characterId: 'junshi', line: '识别假平台最简单的方法：试小额提现。真平台500块以下秒到，假平台会找各种理由拖延', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '假平台的五大特征：1）没有可查证的牌照；2）客服催你充值但提现困难；3）界面抄袭知名平台但域名奇怪；4）只接受加密货币或微信转账；5）提现要求交"税"或"手续费"。记住：在中国，所有网赌都违法，不存在"正规"中文赌博平台',
    },
  },

  {
    id: 'scam_jiapingtai_002',
    topic: '我在一个平台赢了十万但提不出来怎么办？',
    category: '骗局揭秘',
    subcategory: '假平台',
    characters: ['ajie', 'aqiang', 'laozhang'],
    type: '混战',
    triggerKeywords: ['提不出来', '提现失败', '冻结', '审核中', '不让提现', '赢了但'],
    userEmotionMatch: ['焦急', '愤怒', '无助'],
    openingLines: {
      ajie: '醒醒吧 那十万从一开始就不存在。假平台上的数字只是数据库里的一行代码 跟你银行卡里的钱没有任何关系',
      aqiang: '我也遇到过！它说什么流水不够 让我再充五万打流水 我差点信了……',
      laozhang: '年轻人 这钱你就当买教训了。能追回来当然好 但大概率追不回来。最重要的是别再充钱进去了',
    },
    escalation: [
      { characterId: 'aqiang', line: '最气的是客服还装好人 说"您的情况我很理解 我帮您向上面申请" 结果申请了三天回复说还是要充钱', emotion: '愤怒' },
      { characterId: 'ajie', line: '那个客服跟你聊天的时候同时在应付另外50个人 用的是同一套话术模板。他们每天的KPI是让你多充钱', emotion: '揭穿' },
      { characterId: 'laozhang', line: '我见过最惨的 一个小伙子为了提现反复充钱 从赢十万变成亏五十万。别重蹈覆辙', emotion: '心痛' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '如果你在假平台遇到提现困难：1）立即停止充值；2）截图保存所有聊天记录和交易记录；3）向当地公安网络犯罪部门报案；4）不要相信任何"帮你追回"的人——追损骗局是二次收割。已经损失的钱可能追不回来，但至少不要再亏更多',
    },
  },

  // ── 群控杀猪盘 ──

  {
    id: 'scam_shazhu_001',
    topic: '"杀猪盘"是怎么一步步把人骗进去的？',
    category: '骗局揭秘',
    subcategory: '群控杀猪盘',
    characters: ['ajie', 'dashiwang', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['杀猪盘', '网恋', '交友', '感情骗局', '东南亚', '缅甸', '园区'],
    userEmotionMatch: ['好奇', '警觉', '恐惧'],
    openingLines: {
      ajie: '杀猪盘的流程：找猪（物色目标）→养猪（建立感情）→喂猪（小额盈利）→杀猪（大额收割）。整个周期通常2-3个月',
      dashiwang: '我认识做这行的人……不 我听说过。他们在缅甸、柬埔寨的园区里 一个人同时养几十头"猪" 用统一的话术模板',
      xiaotian: '我差点被杀猪盘骗了。一个"女孩"在交友软件上加我 聊了两个月 突然说她有个投资渠道……',
    },
    escalation: [
      { characterId: 'xiaotian', line: '她甚至会跟你视频 但后来我才知道那是AI换脸。声音也是变声器。一切都是假的', emotion: '后怕' },
      { characterId: 'ajie', line: '现在的杀猪盘已经升级了 用AI生成照片和语音 一个人能同时操作上百个"角色"。成本极低 利润极高', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '杀猪盘是赌博诈骗中最残忍的形式——它不仅骗你的钱 还骗你的感情。识别要点：1）网上认识的人主动聊投资/赌博；2）带你去特定平台；3）前期你赢钱了对方比你还高兴；4）催你追加投资。一旦有人在感情里谈钱 立刻拉黑',
    },
  },

  {
    id: 'scam_shazhu_002',
    topic: '为什么高学历的人也会被杀猪盘骗？',
    category: '骗局揭秘',
    subcategory: '群控杀猪盘',
    characters: ['gailv', 'laozhang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['高学历', '聪明人', '上当', '为什么被骗', '博士', '教授'],
    userEmotionMatch: ['困惑', '反思', '震惊'],
    openingLines: {
      gailv: '高学历不等于高情商 也不等于识骗能力强。杀猪盘攻击的不是你的智商 是你的情感需求——孤独、渴望被理解、需要陪伴',
      laozhang: '我见过大学教授被骗两百万的。不是他笨 是人在感情里会自动关掉理性判断。这是人性 跟学历没关系',
      ajie: '骗子筛选的就是有钱又孤独的人。高学历往往意味着高收入但社交时间少——完美的目标',
    },
    escalation: [
      { characterId: 'gailv', line: '心理学上这叫"情感预注"——你在一段关系里投入了大量感情 就不愿意承认对方是骗子 因为那意味着你的感情投入全白费了', emotion: '分析' },
      { characterId: 'ajie', line: '而且骗子会用"我只信任你"来孤立你 让你不跟家人朋友商量。等你发现上当 已经亏了几十万', emotion: '沉重' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '杀猪盘的本质是社会工程学攻击 跟黑客入侵系统一样——找到人类心理的漏洞 然后利用它。学历保护不了你 唯一的防御是规则：网上认识的人谈钱就拉黑 无论你多喜欢对方',
    },
  },

  // ── 合法赌场骗局 ──

  {
    id: 'scam_hefaduchang_001',
    topic: '合法赌场里有没有骗人的套路？',
    category: '骗局揭秘',
    subcategory: '合法赌场骗局',
    characters: ['ajie', 'kellyprof', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['合法赌场', '赌场套路', '正规赌场骗人', 'VIP', '积分', '免费房间'],
    userEmotionMatch: ['好奇', '警觉', '精明'],
    openingLines: {
      ajie: '合法赌场不需要"骗"你——整个环境设计就是让你多花钱。没窗户没时钟 免费酒水 ATM到处都是 走廊设计成迷宫让你路过更多赌台',
      kellyprof: '赌场的环境心理学非常精密。地毯颜色、灯光色温、背景音乐节奏都经过严格测试 目的是让你放松警惕 延长停留时间',
      laoliu: '我每次去赌场都说玩两小时就走 结果一坐下就忘了时间。出来一看天都亮了 输了一万多',
    },
    escalation: [
      { characterId: 'ajie', line: '最阴的是VIP积分制度。你以为你在攒积分换免费房间 其实你为了那个"免费"房间多输了十倍的钱', emotion: '揭穿' },
      { characterId: 'laoliu', line: '对 我就为了保住金卡会员 每个月必须去赌满20小时。结果越赌越亏 但我不敢不去 怕降级', emotion: '无奈' },
      { characterId: 'kellyprof', line: '这叫"忠诚度陷阱"——赌场用身份认同绑架你。你不是在赌博 你是在"维护VIP身份"。心理成本远大于经济收益', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '合法赌场的"骗局"不是违法行为 而是精密的行为设计。每一项"福利"——免费酒水、积分、VIP待遇——都是经过ROI计算的投资。你以为赌场在讨好你 其实你在为这些"福利"支付数倍的溢价。合法不等于公平',
    },
  },

  {
    id: 'scam_hefaduchang_002',
    topic: '赌场发牌员会不会故意让你输？',
    category: '骗局揭秘',
    subcategory: '合法赌场骗局',
    characters: ['ajie', 'aqiang', 'gailv'],
    type: '混战',
    triggerKeywords: ['发牌员', '荷官', '出千', '控牌', '换牌', '做手脚'],
    userEmotionMatch: ['怀疑', '愤怒', '不服'],
    openingLines: {
      aqiang: '别跟我说赌场不出千 我亲眼看到荷官发牌速度变了之后我就开始输 这不是巧合',
      ajie: '正规赌场的荷官不会出千——因为他们没有动机。荷官拿固定工资加小费 你输赢跟他无关。出千被抓他直接坐牢',
      gailv: '阿强你说的"速度变了"是典型的确认偏差。你赢的时候不关注发牌速度 输的时候开始找原因 然后把任何微小变化都当成"证据"',
    },
    escalation: [
      { characterId: 'aqiang', line: '那你解释一下为什么我连输十五把！概率上说 这几乎不可能！', emotion: '暴怒' },
      { characterId: 'gailv', line: '百家乐连续输15把的概率大约是0.003%。听起来很小 但全世界每天有几十万人在赌 每天都有人遇到这种极端序列。你只是那个倒霉的人', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '正规赌场不需要出千——数学优势已经保证它长期盈利。怀疑荷官作弊的心理根源是"我不应该输这么多"的否认。接受随机性的残酷 比寻找阴谋论更健康。但注意：这只适用于持牌正规赌场 网赌平台完全是另一回事',
    },
  },

  // ── 返水骗局 ──

  {
    id: 'scam_fanshui_001',
    topic: '"高返水"平台是不是更值得玩？',
    category: '骗局揭秘',
    subcategory: '返水骗局',
    characters: ['ajie', 'gailv', 'dashiwang'],
    type: '对峙',
    triggerKeywords: ['返水', '返利', '回扣', '洗码费', '返佣', '高返水'],
    userEmotionMatch: ['精明', '贪心', '算计'],
    openingLines: {
      ajie: '高返水是最经典的钓鱼手段。返你1%的水 让你多赌10倍的量。算总账你亏得更多',
      gailv: '数学上很简单：假设平台庄家优势3% 返水1%。你以为净亏损变成2%了 但因为返水你会加大投注量 实际总亏损反而增加',
      dashiwang: '返水高说明平台有实力嘛 小平台哪有钱返给你 这恰恰说明它是正规的',
    },
    escalation: [
      { characterId: 'ajie', line: '王大师你又在帮骗子说话。高返水的钱从哪来？从你多输的钱里来。平台不是慈善机构', emotion: '愤怒' },
      { characterId: 'dashiwang', line: '你这人怎么这么负能量 人家给你返钱你还不乐意 那你别赌啊', emotion: '狡辩' },
      { characterId: 'gailv', line: '大师 你是不是拿了平台的推广佣金？你推荐一个人过去 平台给你多少？', emotion: '质问' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '返水的经济学本质：它是赌场的获客成本 不是给你的福利。高返水→你赌更多→平台赚更多。返水1%但你投注量翻3倍 平台净赚反而更多。真正聪明的做法是算总盈亏 而不是盯着返水比例',
    },
  },

  {
    id: 'scam_fanshui_002',
    topic: '有人靠"刷返水"赚钱是真的吗？',
    category: '骗局揭秘',
    subcategory: '返水骗局',
    characters: ['ajie', 'kellyprof', 'xiaofang'],
    type: '圆桌',
    triggerKeywords: ['刷水', '打流水', '套利', '刷返水', '对冲', '薅羊毛'],
    userEmotionMatch: ['精明', '好奇', '贪心'],
    openingLines: {
      ajie: '刷返水在理论上可行——用最小风险的下注方式跑流水 赚返水差价。但平台不是傻子 它有风控系统专门抓这种人',
      kellyprof: '对冲套利在合法博彩市场确实存在 但利润空间极小 通常不到0.1%。考虑到资金成本和风控风险 普通人根本做不了',
      xiaofang: '我试过刷返水 刚开始确实赚了几百块。然后平台直接冻结了我的账号 里面两万块提不出来',
    },
    escalation: [
      { characterId: 'xiaofang', line: '客服说我"异常投注"违反了平台规则 返水取消 本金也扣了。这比直接赌还亏', emotion: '崩溃' },
      { characterId: 'ajie', line: '这就是平台的套路——返水条款写得模糊 解释权归平台。你刷水它就说你违规 怎么都是它赢', emotion: '冷酷' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '刷返水是一个看似聪明实则危险的策略。合法平台有强大的风控 非法平台随时可以修改规则。无论哪种 你都在用自己的本金去赌平台的底线。结论：能靠刷返水稳定赚钱的人 数量趋近于零',
    },
  },

  // ── 带单诈骗（补充）──

  {
    id: 'scam_daidian_003',
    topic: '社交媒体上的"赌博大神"值得关注吗？',
    category: '骗局揭秘',
    subcategory: '带单诈骗',
    characters: ['dashiwang', 'ajie', 'gailv'],
    type: '混战',
    triggerKeywords: ['大神', '网红', '博主', '直播', '抖音', 'YouTube', '赌博博主'],
    userEmotionMatch: ['追随', '好奇', '崇拜'],
    openingLines: {
      dashiwang: '关注我的粉丝都知道 我每周直播预测赛果 准确率超过70%。不信你去看我的历史记录',
      ajie: '王大师 你的历史记录里删了多少错误预测？我截图都还在呢。你上个月预测错了12场 只发了对的那5场',
      gailv: '任何声称准确率超过60%的体育预测都是统计造假。如果真有70% 直接押注就能成为亿万富翁 何必做直播',
    },
    escalation: [
      { characterId: 'dashiwang', line: '你们就是嫉妒我有粉丝！我免费分享预测 碍着你们什么了', emotion: '恼怒' },
      { characterId: 'ajie', line: '免费？你的直播间挂着三个赌博平台的推广链接 每个注册用户你拿200块佣金 你一个月靠推广赚多少？', emotion: '揭穿' },
      { characterId: 'dashiwang', line: '那是平台赞助 跟我预测准不准没关系', emotion: '心虚' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '社交媒体赌博博主的盈利模式：流量→推广→佣金。他们的收入来自你点击链接注册 不是来自赌博本身。准确率是精心包装的营销工具——只展示赢的 删除输的。关注他们等于把自己变成他们的提款机',
    },
  },

  // ── 赢利计划（补充）──

  {
    id: 'scam_yingli_003',
    topic: '花钱买"内幕消息"靠谱吗？',
    category: '骗局揭秘',
    subcategory: '赢利计划',
    characters: ['dashiwang', 'ajie', 'kellyprof'],
    type: '对峙',
    triggerKeywords: ['内幕', '消息', '假球', '操盘', '买消息', '内部消息'],
    userEmotionMatch: ['贪心', '好奇', '精明'],
    openingLines: {
      dashiwang: '我手上有渠道 能拿到东南亚联赛的内幕消息。一条消息收你两千 赢了你赚十倍 输了我退款',
      ajie: '卖内幕消息是最古老的骗术之一。他同时卖给200个人 一半说主队赢 一半说客队赢。赢的那一半会觉得消息是真的 然后继续买',
      kellyprof: '这叫"二分法骗局"——每轮淘汰一半人 三轮之后剩下的25个人深信不疑 每人愿意花几万块买"独家消息"',
    },
    escalation: [
      { characterId: 'dashiwang', line: '我的消息是真的！上周阿联酋联赛那场我不是说中了吗', emotion: '急辩' },
      { characterId: 'kellyprof', line: '你说中一场不能证明任何事。我随机猜也有50%概率猜中。请展示你过去100条消息的完整记录', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '内幕消息骗局的核心：信息不对称。你无法验证消息的真实性 只能事后看结果。而骗子利用概率保证总有一部分人"验证成功"。真正的内幕操盘不需要卖消息——操盘者自己下注利润远超卖消息',
    },
  },

  // ── 群控杀猪盘（补充）──

  {
    id: 'scam_shazhu_003',
    topic: '微信赌博群里的"真人玩家"是真的吗？',
    category: '骗局揭秘',
    subcategory: '群控杀猪盘',
    characters: ['ajie', 'xiaofang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['微信群', '赌博群', '红包', '群控', '机器人', '托'],
    userEmotionMatch: ['怀疑', '好奇', '警觉'],
    openingLines: {
      ajie: '微信赌博群里500个人 可能400个是机器人。群控软件一台电脑可以操作几百个微信号 自动发消息 自动晒单',
      xiaofang: '我加过一个群 里面全是人在讨论 看起来特别真实。直到有一天两个"不同的人"发了一模一样的消息 我才知道是脚本',
      junshi: '群控技术已经非常成熟了——AI生成头像、自动化聊天脚本、甚至能根据你的发言定制回复。一个运营团队可以同时管理上百个群',
    },
    escalation: [
      { characterId: 'xiaofang', line: '最恐怖的是有人私聊我说"哥 我跟了这个老师三个月赚了八万" 后来发现这个人的朋友圈全是一天之内发的', emotion: '后怕' },
      { characterId: 'ajie', line: '批量注册微信号 买朋友圈素材 一个"真实"的身份成本不到50块钱。但骗你一次就是几万', emotion: '揭穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '微信赌博群的真相：它是一个精心搭建的"剧场"。群主是导演 机器人是演员 你是唯一的观众。所有的"热闹讨论"和"盈利截图"都是演给你一个人看的。识别方法：群里的人你一个都不认识但都很"热情"——这本身就不正常',
    },
  },

  // ══════════════════════════════════════════
  // 网赌江湖 — 15 scenarios
  // ══════════════════════════════════════════

  // ── 平台套路 ──

  {
    id: 'online_pingtai_001',
    topic: '网赌平台是怎么让你一步步上瘾的？',
    category: '网赌江湖',
    subcategory: '平台套路',
    characters: ['ajie', 'gailv', 'xiaofang'],
    type: '圆桌',
    triggerKeywords: ['上瘾', '套路', '引诱', '新手福利', '首充', '充值优惠'],
    userEmotionMatch: ['好奇', '警觉', '反思'],
    openingLines: {
      ajie: '网赌平台的用户生命周期设计：注册送彩金→首充翻倍→连续登录奖励→VIP等级制度→提现门槛。每一步都在加深你的沉没成本',
      gailv: '他们用的是行为心理学里的"变比率强化"——跟老虎机一个原理。不定期给你小奖励 让你的多巴胺系统持续期待',
      xiaofang: '我第一次充了100块 平台送了我100 瞬间变200。当时觉得太划算了 完全没想到后面会充进去两万多……',
    },
    escalation: [
      { characterId: 'xiaofang', line: '最阴的是它凌晨给你推送"限时充值翻倍" 那个时间段人最脆弱 判断力最差 我好几次半夜充钱都是因为这个', emotion: '懊悔' },
      { characterId: 'ajie', line: '推送时间是数据驱动的。平台知道你什么时候在线、什么时候输钱最容易追、什么时候最冲动。每条推送都是精准计算', emotion: '揭穿' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌平台的产品设计借鉴了社交媒体和游戏行业的成瘾机制——但更极端。它不仅要你花时间 还要你花钱。每一个"福利"都是经过ROI计算的获客/留存成本 本质上是从你未来的亏损里预支的',
    },
  },

  {
    id: 'online_pingtai_002',
    topic: '网赌平台的"提现秒到"是真的吗？',
    category: '网赌江湖',
    subcategory: '平台套路',
    characters: ['ajie', 'aqiang', 'junshi'],
    type: '混战',
    triggerKeywords: ['提现', '秒到', '到账', '出金', '提款', '取钱'],
    userEmotionMatch: ['怀疑', '焦虑', '精明'],
    openingLines: {
      ajie: '"提现秒到"是钓鱼广告。前几次小额确实秒到——这是建立信任的成本。等你充了大钱想提的时候 各种理由就来了',
      aqiang: '我玩的那个平台 500块以下确实秒到 我试了三四次没问题。但后来赢了八千想提 它说要审核 一审就是三天',
      junshi: '小额秒到 大额拖延 这是网赌平台的标准操作。它赌的是：审核期间你会忍不住继续玩 然后把赢的钱输回去',
    },
    escalation: [
      { characterId: 'aqiang', line: '三天之后我确实又玩了几把 结果八千变三千 提了三千出来。平台赢了五千', emotion: '憋屈' },
      { characterId: 'ajie', line: '这就是提现延迟策略的目的——利用你的冲动。数据显示 提现审核期间有超过60%的玩家会继续下注', emotion: '冷酷' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '判断平台提现是否靠谱的方法：1）注册后立刻试提最小金额；2）赢了钱立刻提 不要"再玩几把"；3）提现有任何附加条件（流水要求、手续费、审核期）的平台立刻离开。但最根本的建议是：不要玩网赌',
    },
  },

  {
    id: 'online_pingtai_003',
    topic: '网赌平台跑路前有什么征兆？',
    category: '网赌江湖',
    subcategory: '平台套路',
    characters: ['ajie', 'xiaofang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['跑路', '关站', '倒闭', '提不了', '平台关了', '卷款'],
    userEmotionMatch: ['恐慌', '焦虑', '警觉'],
    openingLines: {
      ajie: '网赌平台的平均寿命不到两年。跑路前的征兆：提现越来越慢、客服回复变少、突然搞大促活动（最后一波收割）、域名频繁更换',
      xiaofang: '我经历过两次平台跑路。第一次平台提前一周搞了个"充值返200%"的活动 当时觉得赚大了 一周后网站打不开了',
      laozhang: '年轻人记住一句话：平台突然变得特别大方的时候 就是它准备跑的时候。这跟骗子临走前请你吃大餐是一个道理',
    },
    escalation: [
      { characterId: 'xiaofang', line: '平台跑路之后我在群里看到 光我们那个群就有五十多人没提出来 加起来几百万', emotion: '绝望' },
      { characterId: 'ajie', line: '平台跑路前通常会把钱洗到加密货币里。等你报警 钱已经通过混币器消失了 基本追不回来', emotion: '冷酷' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌平台跑路五大预警：1）提现审核时间延长到48小时以上；2）客服从秒回变成排队；3）突然推出"超高返利"活动；4）网址/APP频繁更新；5）推广力度突然加大。看到任何一条 立刻提走所有余额。但最好的策略永远是不充钱进去',
    },
  },

  // ── 技术作弊 ──

  {
    id: 'online_jishu_001',
    topic: '网赌平台的随机数生成器是公平的吗？',
    category: '网赌江湖',
    subcategory: '技术作弊',
    characters: ['gailv', 'ajie', 'kellyprof'],
    type: '对峙',
    triggerKeywords: ['RNG', '随机数', '公平', '算法', '控制结果', '概率调整'],
    userEmotionMatch: ['怀疑', '好奇', '技术控'],
    openingLines: {
      gailv: '合法赌场的RNG由第三方审计机构认证 比如eCOGRA和GLI。但没有牌照的网赌平台？它们的"随机数"可以随时被后台修改',
      ajie: '我以前在一个小平台工作过。老板的原话是"赢得太多的就调他的RTP 从96%调到88%"。一行代码的事',
      kellyprof: '技术上来说 真正的随机数生成极其复杂 需要硬件随机源。大部分网赌平台用的是伪随机算法 理论上确实可以被操控',
    },
    escalation: [
      { characterId: 'ajie', line: '更高级的做法是"动态RTP"——整体保持95% 但对盈利玩家降低到85% 对新玩家提高到105%。从统计上看全局RTP正常 但个体被针对了', emotion: '冷酷' },
      { characterId: 'gailv', line: '这种操控在统计学上很难检测。你需要至少十万手数据才能发现异常 普通玩家根本没有这个样本量', emotion: '无奈' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'RNG公平性的判断标准：有没有第三方审计报告？审计机构是否可信？牌照是否可查？如果三个问题任何一个答案是"不确定" 那你面对的可能就不是真正的随机。在没有监管的平台赌博 等于把规则的制定权交给你的对手',
    },
  },

  {
    id: 'online_jishu_002',
    topic: '用外挂或机器人赌博能赢钱吗？',
    category: '网赌江湖',
    subcategory: '技术作弊',
    characters: ['gailv', 'xiaofang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['外挂', '机器人', '自动下注', '脚本', '辅助', 'bot'],
    userEmotionMatch: ['精明', '好奇', '技术控'],
    openingLines: {
      gailv: '自动投注机器人在数学上不能改变期望值。负期望值的游戏 不管你手动还是自动 长期结果一样——亏',
      xiaofang: '我花了3000块买了一个百家乐自动投注软件 号称AI分析路子。用了一周 亏了八千',
      ajie: '外挂市场本身就是一个骗局中的骗局。卖外挂的人赚的是你买软件的钱 他根本不关心软件有没有用',
    },
    escalation: [
      { characterId: 'xiaofang', line: '那个软件其实就是按照固定的缆法自动下注 跟我手动打没区别 还不如我自己控制节奏', emotion: '后悔' },
      { characterId: 'gailv', line: '而且用外挂有法律风险。很多司法管辖区把赌博辅助软件归类为诈骗工具 你买了可能连自己都摊上事', emotion: '警告' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博外挂的真相：1）不能改变概率——负期望值的游戏没有正期望值的策略；2）多数外挂就是自动化的缆法 穿上了"科技"外衣；3）卖外挂比用外挂赚钱 这本身就说明了一切。真正的优势赌博（如扑克AI）技术门槛极高 不是花几千块能买到的',
    },
  },

  // ── 直播赌场 ──

  {
    id: 'online_zhibo_001',
    topic: '真人荷官直播赌场是不是比电脑版更公平？',
    category: '网赌江湖',
    subcategory: '直播赌场',
    characters: ['ajie', 'aqiang', 'kellyprof'],
    type: '混战',
    triggerKeywords: ['真人荷官', '直播', '实时', '视频', '真人百家乐', '真人发牌'],
    userEmotionMatch: ['好奇', '信任', '精明'],
    openingLines: {
      aqiang: '真人荷官的至少能看到发牌过程 比电脑随机的靠谱多了。我现在只玩真人的',
      ajie: '你看到的"直播"未必是实时的。有些平台用预录视频 或者在视频流里加延迟 根据下注结果选择播放哪个版本',
      kellyprof: '即便是真正的真人荷官 庄家优势也跟电脑版完全一样。百家乐庄家优势1.06% 不会因为荷官是真人就变成0',
    },
    escalation: [
      { characterId: 'aqiang', line: '起码看得到牌啊 电脑的我怎么知道它有没有改结果', emotion: '固执' },
      { characterId: 'ajie', line: '阿强 你看到的牌是通过视频传给你的。视频可以被处理——延迟、替换、合成。你以为你看到的是现实 其实是平台想让你看到的', emotion: '揭穿' },
      { characterId: 'kellyprof', line: '合法的真人荷官平台（如Evolution Gaming）确实有严格监管。但如果平台本身没有牌照 真人荷官只是增加了一层"信任感"的包装', emotion: '严谨' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '真人荷官的价值取决于平台是否合法。合法平台的真人荷官确实更透明——有多机位、有监管、有审计。但非法平台的"真人荷官"可能是另一种欺骗手段。核心问题不是荷官是真人还是电脑 而是平台有没有牌照和监管',
    },
  },

  {
    id: 'online_zhibo_002',
    topic: '直播赌场里的"美女荷官"是什么套路？',
    category: '网赌江湖',
    subcategory: '直播赌场',
    characters: ['ajie', 'laoliu', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['美女荷官', '互动', '性感', '女荷官', '聊天', '打赏'],
    userEmotionMatch: ['好奇', '欲望', '娱乐'],
    openingLines: {
      ajie: '美女荷官的作用只有一个：让你待更久。你以为自己在赌博 其实你在为"跟美女互动"的体验买单',
      laoliu: '说实话 我有时候就是为了跟荷官聊天才去的。输个几百块当聊天费也行吧',
      laozhang: '老六你算过一个月花多少"聊天费"了吗？我猜至少五千。这钱够你去很多次高级酒吧了',
    },
    escalation: [
      { characterId: 'laoliu', line: '……没算过。但应该没那么多吧？也就每次输个两三百……一个月去二十几次……操', emotion: '尴尬' },
      { characterId: 'ajie', line: '平台雇美女荷官的成本每月大概3000-5000美金。一个荷官同时面对几百个玩家 每个玩家每月贡献几千。这笔生意太赚了', emotion: '冷酷' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '美女荷官是赌场的"用户留存工具"——延长在线时间 增加下注次数。你在桌上多待一分钟 赌场就多赚一点期望值。如果你发现自己去直播赌场的理由是"荷官好看" 而不是"我想赌博"——说明你已经掉进了另一个陷阱',
    },
  },

  // ── 代理制度 ──

  {
    id: 'online_daili_001',
    topic: '做网赌平台代理真的能赚钱吗？',
    category: '网赌江湖',
    subcategory: '代理制度',
    characters: ['ajie', 'dashiwang', 'junshi'],
    type: '混战',
    triggerKeywords: ['代理', '推广', '拉人', '佣金', '下线', '发展代理'],
    userEmotionMatch: ['贪心', '好奇', '犹豫'],
    openingLines: {
      ajie: '网赌代理的本质就是传销——你拉人进来赌 赌场分你一杯。你赚的每一分钱都是你朋友的血汗钱',
      dashiwang: '做代理很轻松的 发发链接就行 每个月躺赚几千块。我有个朋友做代理月入三万',
      junshi: '网赌代理在中国是刑事犯罪——组织赌博罪 最高七年。你觉得月入几千值得用自由来换吗？',
    },
    escalation: [
      { characterId: 'dashiwang', line: '用VPN啊 谁查得到 而且我人在海外', emotion: '不以为然' },
      { characterId: 'junshi', line: '公安跨国追逃的案例越来越多。2023年光从缅甸遣返的就超过4万人。你以为在海外就安全？', emotion: '严肃' },
      { characterId: 'ajie', line: '更重要的是：你拉进来的是你的朋友和家人。他们输光了找你算账 你怎么办？为了几千块佣金毁掉所有人际关系 值吗？', emotion: '沉重' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌代理的风险收益比极差：收益是每月几千到几万的佣金 风险是刑事责任和所有社会关系的崩塌。更何况 大部分代理拿到的佣金远低于承诺——平台随时可以修改规则 克扣佣金 甚至不付款。你在帮骗子数钱 最后连自己的那份都拿不到',
    },
  },

  {
    id: 'online_daili_002',
    topic: '网赌代理为什么专门找大学生？',
    category: '网赌江湖',
    subcategory: '代理制度',
    characters: ['ajie', 'xiaofang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['大学生', '校园', '学生代理', '兼职', '校园推广', '大学'],
    userEmotionMatch: ['震惊', '好奇', '警觉'],
    openingLines: {
      ajie: '大学生是网赌代理的完美目标：社交圈大、缺钱、法律意识薄弱、且身边都是潜在客户。一个学生代理能渗透整个宿舍楼',
      xiaofang: '我就是大二的时候被同学拉进去的。他说做兼职推广APP 每个注册用户给50块。我推了二十几个同学……后来他们都亏了',
      gailv: '数据显示 中国大学生赌博参与率约15% 其中网赌占70%以上。校园代理是这个数字的主要推手',
    },
    escalation: [
      { characterId: 'xiaofang', line: '现在那些同学都不理我了。有个人借了网贷去赌 到现在还没还清。我每次想起来都特别内疚', emotion: '痛苦' },
      { characterId: 'ajie', line: '更恶劣的是平台会利用学生的社交关系链——你的通讯录、你的朋友圈、你的同学群。一个学生能帮平台触达几百个同龄人', emotion: '愤怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '校园网赌代理是一种社会毒瘤。它利用年轻人的无知和社交信任 把赌博扩散到整个校园。如果有人跟你说"推广APP兼职"——先问自己：这个APP是干什么的？为什么需要通过私人关系推广？答不上来就别碰',
    },
  },

  // ── 洗钱通道 ──

  {
    id: 'online_xiqian_001',
    topic: '网赌平台是怎么被用来洗钱的？',
    category: '网赌江湖',
    subcategory: '洗钱通道',
    characters: ['ajie', 'junshi', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['洗钱', '黑钱', '资金', '转账', '非法', '地下钱庄'],
    userEmotionMatch: ['好奇', '震惊', '了解'],
    openingLines: {
      ajie: '网赌平台天然适合洗钱：充值→装作赌博→提现。一进一出 黑钱变白钱。这就是为什么那么多非法平台即使赔钱也要开',
      junshi: '全球每年通过赌博洗钱的金额估计超过1000亿美元。网赌平台因为跨境、匿名、难追踪 成了洗钱的首选渠道',
      kellyprof: '从反洗钱的角度看 加密货币赌场更危险——资金从加密钱包到平台再到另一个钱包 全程几乎无法追踪',
    },
    escalation: [
      { characterId: 'ajie', line: '有些平台甚至主动提供"洗钱服务"——你充进去100万 扣10%手续费 90万变成"合法赌博收入"提走。这是明码标价的', emotion: '冷酷' },
      { characterId: 'junshi', line: '普通玩家要警惕的是：如果你的账号被用来走资金 你可能在不知情的情况下成为洗钱共犯。银行账户被冻结、公安找上门都不是开玩笑', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌洗钱对普通玩家的风险：1）你的身份信息可能被平台用于开户洗钱；2）你的银行卡流水异常会触发反洗钱监控；3）即使你只是普通赌客 账户被牵连也会冻结。远离网赌不仅是为了不输钱 也是为了不踩法律红线',
    },
  },

  {
    id: 'online_xiqian_002',
    topic: '为什么有人愿意帮网赌平台"跑分"？',
    category: '网赌江湖',
    subcategory: '跑分平台',
    characters: ['ajie', 'xiaofang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['跑分', '走账', '收款', '二维码', '银行卡', '出借'],
    userEmotionMatch: ['好奇', '贪心', '无知'],
    openingLines: {
      ajie: '跑分就是用你的银行卡或支付宝帮赌博平台收钱。你赚个百分之几的手续费 平台用你的身份洗钱。出了事 你背锅',
      xiaofang: '我室友就干过跑分 每天在宿舍躺着收几百块。后来有一天银行卡被冻结了 公安局打电话让他去做笔录',
      junshi: '跑分在法律上构成"帮助信息网络犯罪活动罪" 也就是帮信罪。2024年全国帮信罪起诉超过12万人 其中大量是跑分人员',
    },
    escalation: [
      { characterId: 'xiaofang', line: '我室友后来被拘留了15天 银行卡冻结半年 所有银行都不给他开新卡了。为了赚那几千块', emotion: '后怕' },
      { characterId: 'ajie', line: '更惨的是那些被骗去柬埔寨缅甸做线下跑分的——人身自由都没了 被关在园区里强迫工作', emotion: '愤怒' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '跑分的风险远大于收益：赚几千块佣金 换来的可能是银行卡冻结、征信污染、刑事拘留甚至判刑。你的银行卡和身份信息一旦进入洗钱链条 影响的不只是现在 是你未来几十年的金融生活。任何人让你出借银行卡或二维码——直接拒绝',
    },
  },

  // ── 洗钱通道（补充）──

  {
    id: 'online_xiqian_003',
    topic: '加密货币赌场比传统网赌更安全吗？',
    category: '网赌江湖',
    subcategory: '洗钱通道',
    characters: ['gailv', 'ajie', 'junshi'],
    type: '对峙',
    triggerKeywords: ['加密货币', '比特币', 'USDT', '币赌', 'crypto', '区块链赌场'],
    userEmotionMatch: ['好奇', '精明', '技术控'],
    openingLines: {
      gailv: '加密货币赌场的优势是匿名和即时到账。但匿名意味着没有监管 出了问题你找谁？',
      ajie: '加密赌场是洗钱的天堂 也是骗局的温床。我见过一个平台用USDT收款 运营了三个月卷了8000万就跑了 连域名都注销了',
      junshi: '从玩家角度看 加密赌场的风险更高：1）无监管；2）无投诉渠道；3）资金一旦转入就不可逆；4）平台随时可以消失',
    },
    escalation: [
      { characterId: 'gailv', line: '技术上说 区块链确实可以实现可验证公平（provably fair）。但问题是 大部分加密赌场根本没有实现这个功能 或者实现了但有后门', emotion: '客观' },
      { characterId: 'ajie', line: '所谓"provably fair"大部分玩家根本不会验证。这就像超市说"每件商品都有合格证"——谁真的去查了？', emotion: '嘲讽' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '加密货币赌场用"去中心化"和"匿名"作为卖点 但对玩家来说 这些"优势"恰恰是最大的风险。没有监管意味着没有保护 匿名意味着无法追责。你的USDT转进去那一刻 就已经不受任何法律保护了',
    },
  },

  // ── 直播赌场（补充）──

  {
    id: 'online_zhibo_003',
    topic: '网赌APP为什么做得越来越像游戏？',
    category: '网赌江湖',
    subcategory: '直播赌场',
    characters: ['gailv', 'xiaofang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['游戏化', 'APP', '界面', '任务', '成就', '排行榜', '皮肤'],
    userEmotionMatch: ['好奇', '反思', '沉迷'],
    openingLines: {
      gailv: '赌博APP游戏化的目的是模糊"赌博"和"娱乐"的边界。当你觉得自己在"玩游戏"而不是"赌博"时 你的风险警觉会大幅下降',
      xiaofang: '我玩的那个APP有日常任务、成就徽章、排行榜、VIP等级……跟打游戏一模一样。输钱了也不觉得是在赌 觉得是"游戏币"',
      ajie: '这是故意的。赌博APP的UI/UX设计团队有一半人是从游戏公司挖来的。他们知道怎么让你上瘾',
    },
    escalation: [
      { characterId: 'xiaofang', line: '最狠的是"差一点就赢了"的设计。老虎机转出两个7 第三个差一格——其实概率上这跟完全没中一样 但你会觉得"下次一定中"', emotion: '清醒' },
      { characterId: 'gailv', line: '这叫"近失效应"。研究证明 "差一点赢"比"完全输"更能激发继续赌的冲动。赌博APP把这个心理机制运用到了极致', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '赌博APP游戏化的终极目的：降低你对亏损的感知 增加你的参与频率和时长。当筹码变成"金币"、亏损变成"积分下降"、赌博变成"完成任务"——你的大脑不再把它当赌博处理。这比传统赌场更危险 因为它直接欺骗你的认知系统',
    },
  },

  // ── 代理制度（补充）──

  {
    id: 'online_daili_003',
    topic: '网赌平台的"合伙人计划"是不是传销？',
    category: '网赌江湖',
    subcategory: '代理制度',
    characters: ['ajie', 'dashiwang', 'gailv'],
    type: '混战',
    triggerKeywords: ['合伙人', '多级', '下线', '传销', '层级', '团队'],
    userEmotionMatch: ['怀疑', '好奇', '警觉'],
    openingLines: {
      ajie: '什么"合伙人计划"？就是传销换了个名字。你拉人→你的人再拉人→每一层你都抽佣。经典的金字塔结构',
      dashiwang: '这不叫传销 这叫分销。正规公司也这么干 安利、完美、无限极……',
      gailv: '区别在于：正规分销有实体产品 赌博代理的"产品"是让人亏钱。你的收入来源是下线的亏损 这在道德上和法律上都有本质区别',
    },
    escalation: [
      { characterId: 'dashiwang', line: '那你说做代理不行 推广也不行 怎么赚钱？', emotion: '反问' },
      { characterId: 'ajie', line: '不靠害人赚钱就行。你卖的不是产品 是毒品——你的每个下线都可能因此倾家荡产。你拿的佣金是他们的血', emotion: '愤怒' },
      { characterId: 'gailv', line: '从数学上看 多级代理制度的利润只有两个来源：1）底层玩家的持续亏损；2）新代理的"入门费"。两者都不可持续 最后一定崩盘', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '网赌代理的"合伙人计划"满足传销的所有特征：多层级分佣、靠拉人头获利、底层参与者承担所有风险。区别只在于传销卖假产品 赌博代理卖的是"输钱的机会"。无论怎么包装 本质都是金字塔骗局——越晚进入 越可能成为牺牲品',
    },
  },

  // ── 跑分平台（补充）──

  {
    id: 'online_paofen_001',
    topic: '"高薪兼职收款"背后是什么？',
    category: '网赌江湖',
    subcategory: '跑分平台',
    characters: ['ajie', 'xiaofang', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['兼职', '高薪', '收款', '转账兼职', '日结', '轻松赚钱'],
    userEmotionMatch: ['好奇', '缺钱', '警觉'],
    openingLines: {
      ajie: '招聘广告写"日入500 只需提供收款码" 你以为是兼职 其实是帮赌博平台跑分洗钱。你的支付宝和银行卡成了洗钱工具',
      xiaofang: '我在贴吧看到这种广告 差点就干了。后来搜了一下发现好多人做完就被警察找了 银行卡全冻结',
      laozhang: '年轻人缺钱我理解 但天上不会掉馅饼。给你日结500让你收款 这钱从哪来？从赌客充值里来——这就是赃款',
    },
    escalation: [
      { characterId: 'ajie', line: '跑分平台的操作流程：你注册→绑定银行卡→接单收款→扣除手续费后转出。整个过程你的银行卡就是过水管道 流过的全是赌博资金', emotion: '严肃' },
      { characterId: 'xiaofang', line: '有个学长做了两个月跑分赚了一万多 第三个月银行卡全部冻结 连花呗借呗都用不了 征信直接黑了', emotion: '后怕' },
      { characterId: 'laozhang', line: '最可怕的不是被冻结 是被定性为帮信罪共犯。一旦有案底 考公务员、进国企、出国全受影响 一辈子的事', emotion: '语重心长' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '跑分兼职的本质：你用自己的身份和信用为犯罪分子承担法律风险 换取极少的报酬。银行卡冻结是最轻的后果 刑事追诉才是最大的风险。记住一条铁律：任何让你用个人账户收转不明资金的"兼职" 都是违法行为',
    },
  },

// ══════════════════════════════════════════
  // 赌场游戏 — 麻将
  // ══════════════════════════════════════════
  {
    id: 'game_mahjong_001',
    topic: '打麻将算不算赌博？朋友局和赌场局的界限在哪？',
    category: '赌场游戏',
    subcategory: '麻将',
    characters: ['laoliu', 'gailv', 'laozhang'],
    type: '圆桌',
    triggerKeywords: ['麻将', '麻雀', '打牌', '搓麻', '自摸', '胡牌', '番', '牌局'],
    userEmotionMatch: ['好奇', '辩解', '困惑'],
    openingLines: {
      laoliu: '麻将哪算赌博啊 朋友聚会搓两把 一块钱一番 纯粹社交嘛',
      gailv: '只要涉及金钱和不确定性就是赌博行为——区别只在于赌注大小和频率。心理机制是一样的',
      laozhang: '年轻时我也觉得打麻将不算赌 后来从一块钱一番打到一百块一番 再到抵押房子 你猜中间花了多久？三年',
    },
    escalation: [
      { characterId: 'laoliu', line: '你们也太严肃了吧 退休大爷大妈都在打 难道全是赌徒？', emotion: '不屑' },
      { characterId: 'laozhang', line: '大爷大妈打五毛的和你打五百的能一样吗？你上次打多大的？', emotion: '追问' },
      { characterId: 'laoliu', line: '……也就一二百一番 偶尔嘛', emotion: '心虚' },
      { characterId: 'gailv', line: '一二百一番 一局四圈下来输赢过万很正常。这已经不是"娱乐消费"的量级了', emotion: '冷静' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '麻将本身是技巧性很强的博弈游戏。但问题在于：绝大多数人打麻将的动力不是切磋技术而是赢钱的快感。当赌注大到影响生活质量时 朋友局和赌场局的本质区别就消失了',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 斗地主
  // ══════════════════════════════════════════
  {
    id: 'game_doudizhu_001',
    topic: '线上斗地主欢乐豆不算钱，但为什么越打越上瘾？',
    category: '赌场游戏',
    subcategory: '斗地主',
    characters: ['xiaofang', 'gailv', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['斗地主', '欢乐豆', '癞子', '春天', '炸弹', '地主', '农民', '抢地主'],
    userEmotionMatch: ['好奇', '不以为然', '自省'],
    openingLines: {
      xiaofang: '我就打个欢乐豆斗地主 又不花钱 怎么可能上瘾 你们想多了',
      gailv: '欢乐豆的设计是经典的代币机制——把真实价值抽象化 让你的大脑忽略损失感。等你习惯了豆子的刺激 下一步就是充值买豆',
      junshi: '中国最大的棋牌App用户3亿 其中超过60%有过付费行为。免费斗地主是漏斗的入口 不是终点',
    },
    escalation: [
      { characterId: 'xiaofang', line: '我充过几十块买豆子 但那是为了道具效果 不是赌博吧', emotion: '辩解' },
      { characterId: 'gailv', line: '你充了多少你自己记得清吗？很多人以为自己就充了几十 实际查账单是几千', emotion: '揭穿' },
      { characterId: 'xiaofang', line: '……我查查看 应该没那么多吧', emotion: '犹豫' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '欢乐豆斗地主的成瘾机制和老虎机完全一致：可变比率强化。你永远不知道下一局会不会拿到王炸 这种不确定性就是成瘾的核心驱动力。钱不钱的是次要的 多巴胺才是真正的赌注',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 牌九
  // ══════════════════════════════════════════
  {
    id: 'game_paigow_001',
    topic: '牌九是最公平的赌博游戏吗？庄家优势到底多大？',
    category: '赌场游戏',
    subcategory: '牌九',
    characters: ['ajie', 'kellyprof', 'aqiang'],
    type: '混战',
    triggerKeywords: ['牌九', '排九', '天牌', '地牌', '至尊', '对子', '扑克牌九', 'pai gow'],
    userEmotionMatch: ['好奇', '研究', '质疑'],
    openingLines: {
      ajie: '牌九在赌场里算是庄家优势最小的游戏之一 但那只是理论上——真正进到赌场 你会发现规则里全是坑',
      kellyprof: '扑克牌九的庄家优势约2.84% 中国牌九看排列组合约2.5% 确实比老虎机和轮盘低 但低不等于零',
      aqiang: '我就喜欢牌九 节奏慢 有策略空间 不像百家乐那么快就输完了',
    },
    escalation: [
      { characterId: 'aqiang', line: '牌九至少我能当庄啊 当庄我就有优势了', emotion: '得意' },
      { characterId: 'kellyprof', line: '你当庄确实有微弱优势 但前提是你有足够的资本承受方差。很多人当庄一把被通杀直接崩盘', emotion: '纠正' },
      { characterId: 'ajie', line: '赌场允许你当庄是因为你当庄输得更快——你以为占了便宜 其实赌场在笑', emotion: '讽刺' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '牌九确实是庄家优势较低的游戏 但"较低"依然是负期望值。更关键的是：牌九节奏慢让赌客待在赌场的时间更长 赌场赚的是"时间×下注量×庄家优势"这个乘积 你慢慢玩 它慢慢收',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 花旗骰
  // ══════════════════════════════════════════
  {
    id: 'game_craps_002',
    topic: '花旗骰为什么被称为"赌场里最刺激的游戏"？',
    category: '赌场游戏',
    subcategory: '花旗骰',
    characters: ['aqiang', 'gailv', 'laoliu'],
    type: '混战',
    triggerKeywords: ['花旗骰', 'craps', '骰子', '掷骰', 'pass line', '不过线', '自然数', '点数'],
    userEmotionMatch: ['兴奋', '好奇', '向往'],
    openingLines: {
      aqiang: '花旗骰那个氛围你没体验过就别说！全桌人一起喊 赢了所有人欢呼 那种感觉比什么都爽',
      gailv: 'Pass Line的庄家优势只有1.41% 是赌场里最低的之一。但问题是 大多数人不只下Pass Line 那些花式下注庄家优势高达16.67%',
      laoliu: '我喜欢花旗骰就是因为热闹！赌场里唯一一个所有人站着玩、一起喊的游戏 比坐着打百家乐有意思多了',
    },
    escalation: [
      { characterId: 'laoliu', line: '上次在Vegas玩花旗骰 我旁边的老外连掷了二十把不出7 全桌疯了 我跟着赢了两千刀', emotion: '兴奋' },
      { characterId: 'gailv', line: '那叫幸存者偏差。你只记得连赢的那次 不记得之前三次每次都输光了走人', emotion: '冷静' },
      { characterId: 'aqiang', line: '别听他的 花旗骰的妙处就是你能感受到运气的流动 这不是数学能解释的', emotion: '神秘' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '花旗骰的"刺激感"是精心设计的：群体效应放大情绪、快节奏增加决策失误、花式下注诱导偏离最优策略。1.41%的Pass Line是诱饵 真正赚钱的是那些赔率恐怖的Proposition Bet',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 彩票
  // ══════════════════════════════════════════
  {
    id: 'game_lottery_001',
    topic: '买彩票是"穷人税"还是"希望的投资"？',
    category: '赌场游戏',
    subcategory: '彩票',
    characters: ['laozhang', 'kellyprof', 'xiaotian'],
    type: '圆桌',
    triggerKeywords: ['彩票', '双色球', '大乐透', '刮刮乐', '中奖', '头奖', '彩民', '福彩', '体彩'],
    userEmotionMatch: ['好奇', '辩解', '共鸣'],
    openingLines: {
      laozhang: '我这辈子见过太多人买彩票 从来没见过谁靠彩票翻身 倒是见了不少因为彩票倾家荡产的',
      kellyprof: '彩票的期望回报率约50% 意味着你每花100块 平均只能拿回50块。这是所有赌博形式中庄家优势最大的',
      xiaotian: '我以前每天买两百块彩票 觉得万一中了呢……后来发现三年下来花了二十多万 一分没中过',
    },
    escalation: [
      { characterId: 'xiaotian', line: '最可怕的是 你中了个小奖反而更疯狂——中了五块就觉得自己离头奖更近了', emotion: '自嘲' },
      { characterId: 'kellyprof', line: '这就是"近错效应"——彩票故意设计大量小奖和差一个号码的结果 让你觉得自己"差一点就中了"', emotion: '分析' },
      { characterId: 'laozhang', line: '穷人买彩票不是因为笨 是因为绝望。当正常途径看不到希望 彩票就变成了唯一的幻想', emotion: '沉思' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '彩票既是"穷人税"也是"希望产业"——但问题是 这种希望是虚假的。中头奖的概率比被雷劈两次还低。如果你把买彩票的钱用来定投指数基金 十年后的收益远超你中小奖的总和',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 刮刮乐
  // ══════════════════════════════════════════
  {
    id: 'game_scratchcard_001',
    topic: '刮刮乐为什么让人停不下来？一张又一张的魔力在哪？',
    category: '赌场游戏',
    subcategory: '刮刮乐',
    characters: ['xiaofang', 'dashiwang', 'gailv'],
    type: '对峙',
    triggerKeywords: ['刮刮乐', '即开票', '刮奖', '中奖率', '连刮', '刮卡', '即开型'],
    userEmotionMatch: ['好奇', '上瘾', '自省'],
    openingLines: {
      xiaofang: '刮刮乐才十块钱一张 我每次路过彩票店就顺手买两张 算什么大事',
      dashiwang: '我跟你说 刮刮乐要看编号 尾数是8的中奖率高 这是风水原理',
      gailv: '刮刮乐的中奖率和编号没有任何关系 大师你又在骗人。刮刮乐的期望回报率约60% 比双色球稍好但依然是负期望值',
    },
    escalation: [
      { characterId: 'dashiwang', line: '你不信风水没关系 但我上次就是按编号挑的 中了一百块！', emotion: '吹嘘' },
      { characterId: 'gailv', line: '你买了多少张才中的一百？我猜你那天至少买了二十张以上', emotion: '揭穿' },
      { characterId: 'xiaofang', line: '说实话 我确实有一次在便利店连刮了三十张……越刮越不甘心 总觉得下一张就中', emotion: '坦白' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '刮刮乐的成瘾设计在于"即时反馈+低门槛+近错效应"。十块钱的低价让你放下戒心 刮开的瞬间多巴胺飙升 差一个号的设计让你"再来一张"。便利店收银台旁放刮刮乐 是精心计算过的消费心理陷阱',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 宾果
  // ══════════════════════════════════════════
  {
    id: 'game_bingo_001',
    topic: '宾果游戏为什么在欧美老年人中这么流行？是无害的娱乐还是隐形赌博？',
    category: '赌场游戏',
    subcategory: '宾果',
    characters: ['laozhang', 'laoliu', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['宾果', 'bingo', '连线', '开号', '宾果厅', '电子宾果'],
    userEmotionMatch: ['好奇', '轻视', '讨论'],
    openingLines: {
      laozhang: '我在美国见过宾果厅 一屋子老太太 每人面前铺十几张卡 眼睛盯着屏幕 那认真劲和赌场里的赌客一模一样',
      laoliu: '宾果不就是消遣嘛 大家坐一起玩玩 赢点小钱 总比在家看电视强吧',
      kellyprof: '宾果看似无害 但它符合赌博的所有定义：金钱投入、不确定结果、无法控制。英国每年宾果产业收入超过10亿英镑 这可不是小钱',
    },
    escalation: [
      { characterId: 'laoliu', line: '那打麻将也是赌博咯？老年人活动中心都是赌场？你这逻辑也太极端了', emotion: '反驳' },
      { characterId: 'kellyprof', line: '我没说宾果和赌场一样危险。我是说 任何利用不确定性和金钱奖励的活动都有成瘾风险 不能因为参与者是老年人就忽视', emotion: '严谨' },
      { characterId: 'laozhang', line: '英国有个数据：宾果上瘾者的平均年龄是67岁 其中80%是女性。她们不会去赌场 但每周在宾果厅花的钱可能比生活费还多', emotion: '感慨' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '宾果是"低烈度赌博"的典型代表：门槛低、社交性强、看似无害。但正因为这些特点 它对老年人的渗透力反而更强。问题不在于单次投入多少 而在于频率和依赖程度。有些人每天都去宾果厅 这和每天去赌场本质上没有区别',
    },
  },

  // ══════════════════════════════════════════
  // 赌场游戏 — 基诺
  // ══════════════════════════════════════════
  {
    id: 'game_keno_001',
    topic: '基诺是赌场里最坑的游戏吗？庄家优势凭什么那么高？',
    category: '赌场游戏',
    subcategory: '基诺',
    characters: ['gailv', 'aqiang', 'ajie'],
    type: '对峙',
    triggerKeywords: ['基诺', 'keno', '选号', '开奖', '彩球', '快速开奖', '视频基诺'],
    userEmotionMatch: ['好奇', '质疑', '不信'],
    openingLines: {
      gailv: '基诺的庄家优势高达25%-29% 是赌场里最高的。你每下100块 平均只拿回71-75块。这比老虎机还狠',
      aqiang: '但基诺简单啊 选几个号等着开 不用动脑子 输赢也不大 当消遣挺好',
      ajie: '赌场把基诺放在休息区和餐厅旁边不是偶然——就是让你吃饭等位的时候顺手玩 不知不觉就花了几百块',
    },
    escalation: [
      { characterId: 'aqiang', line: '我觉得基诺有策略的 我只选冷号 很久没出的号肯定快出了', emotion: '自信' },
      { characterId: 'gailv', line: '这叫赌徒谬误 每次开奖都是独立事件 之前没出的号不代表之后更容易出 概率永远一样', emotion: '无奈' },
      { characterId: 'ajie', line: '视频基诺更恐怖 三分钟一局 一小时能玩20局 就算每局只下10块 一小时也输了50多块', emotion: '警告' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '基诺是赌场的"现金奶牛"——低投入让赌客放松警惕 高频次快速收割 超高庄家优势保证利润。它之所以还有人玩 是因为人类天生低估"小额高频"的累积效应。一小时输50块 听起来不多 一个月就是1500 一年就是18000',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 蒙特卡洛
  // ══════════════════════════════════════════
  {
    id: 'dest_montecarlo_001',
    topic: '蒙特卡洛赌场为什么被称为"贵族赌场"？真的比拉斯维加斯高级吗？',
    category: '赌城风云',
    subcategory: '蒙特卡洛',
    characters: ['ajie', 'laozhang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['蒙特卡洛', 'monte carlo', '摩纳哥', '蒙地卡罗', '大赌场', 'casino de monte-carlo'],
    userEmotionMatch: ['向往', '好奇', '讨论'],
    openingLines: {
      ajie: '蒙特卡洛赌场的门槛就不一样——西装革履才能进 最低下注比Vegas高好几倍。它卖的是阶层感 不是赌博',
      laozhang: '1913年蒙特卡洛赌场的轮盘连出26次黑色 赌客们疯了一样押红 结果继续出黑。这就是著名的"蒙特卡洛谬误"的由来',
      kellyprof: '蒙特卡洛大赌场是摩纳哥政府的主要收入来源之一。一个国家靠赌场维持运转——这本身就说明赌场有多赚钱',
    },
    escalation: [
      { characterId: 'ajie', line: '蒙特卡洛的本地居民不允许进赌场赌博 只有外国人能赌。政府太清楚赌博的危害了 所以保护自己人 收割外国人', emotion: '讽刺' },
      { characterId: 'kellyprof', line: '这和新加坡的入场费策略异曲同工 但更极端——直接禁止本国公民参与 只开放给游客', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '蒙特卡洛赌场的"高级感"是最精明的营销。穿西装赌和穿短裤赌 庄家优势一样 但前者让你觉得自己是在"投资"而非"赌博"。摩纳哥禁止本地人赌博 恰恰证明了——最了解赌场的人 绝不会让自己人去赌',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 伦敦
  // ══════════════════════════════════════════
  {
    id: 'dest_london_001',
    topic: '伦敦的赌场文化和亚洲赌场有什么本质区别？',
    category: '赌城风云',
    subcategory: '伦敦',
    characters: ['ajie', 'gailv', 'laoliu'],
    type: '圆桌',
    triggerKeywords: ['伦敦', '英国赌场', '会员制', 'mayfair', '梅费尔', '博彩', '英国博彩'],
    userEmotionMatch: ['好奇', '讨论', '比较'],
    openingLines: {
      ajie: '伦敦赌场最大的特点是会员制——你得提前24小时申请 不能像Vegas那样路过就进。这个设计看似门槛 其实是筛选有钱人',
      gailv: '英国博彩业2023年总收入超过140亿英镑 但有趣的是 大部分来自在线博彩和体育投注 不是传统赌场',
      laoliu: '伦敦的赌场氛围和澳门完全不同——安静、低调、有礼貌。输了钱你也得保持风度 不能像阿强那样摔杯子',
    },
    escalation: [
      { characterId: 'laoliu', line: '我觉得伦敦赌场的会员制挺好的 至少过滤掉了一些冲动型赌客', emotion: '认可' },
      { characterId: 'ajie', line: '你太天真了。会员制的真正目的是建立客户档案——你的消费习惯、赌博偏好、输钱承受力 全在赌场的数据库里', emotion: '揭穿' },
      { characterId: 'gailv', line: '而且英国的博彩广告渗透到了体育的每个角落 球衣赞助、赛前广告、手机App推送。管住了赌场的门 但管不住手机里的赌', emotion: '补充' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '伦敦赌场的"绅士文化"掩盖了一个事实：英国是全球问题赌博最严重的国家之一。会员制和高门槛让线下赌场显得克制 但线上博彩的泛滥让赌博渗透到了每个人的手机。表面文明 底层野蛮',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 印度
  // ══════════════════════════════════════════
  {
    id: 'dest_india_001',
    topic: '印度赌博为什么这么分裂？果阿合法 其他邦违法？',
    category: '赌城风云',
    subcategory: '印度',
    characters: ['kellyprof', 'dashiwang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['印度', '果阿', '板球博彩', '锡金', '达曼', 'goa', '印度赌场', '地下赌博'],
    userEmotionMatch: ['好奇', '讨论', '了解'],
    openingLines: {
      kellyprof: '印度的赌博法律是殖民时代的遗产——1867年的《公共赌博法》把赌博权下放给各邦 导致全国标准不统一',
      dashiwang: '印度人最爱赌板球 那可是全民运动 地下盘口比正规投注大好几倍。我认识的印度朋友说 排灯节不赌钱就像春节不放鞭炮',
      junshi: '印度有13亿人口 在线博彩渗透率每年增长30%以上。但监管几乎空白——这是一个即将爆发的社会问题',
    },
    escalation: [
      { characterId: 'dashiwang', line: '果阿的赌场全开在船上 离岸停着 说是国际水域不受邦法管辖 你说这算不算钻空子', emotion: '佩服' },
      { characterId: 'kellyprof', line: '这就是典型的监管套利。法律说陆地上不行 赌场就搬到船上。法律说线下不行 就搬到线上。哪里有利润哪里就有创新', emotion: '冷静' },
      { characterId: 'junshi', line: '更值得警惕的是 印度的地下板球博彩和假球产业深度绑定。2000年汉西·克罗耶案只是冰山一角', emotion: '严肃' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '印度的赌博困境是：文化上有深厚的博弈传统 法律上一刀切禁止 实践上地下赌博泛滥。不如学新加坡模式——合法化+强监管 至少把地下活动拉到阳光下。一味禁止只会把赌客推向更不受保护的灰色地带',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 澳大利亚
  // ══════════════════════════════════════════
  {
    id: 'dest_australia_001',
    topic: '澳大利亚人均赌博消费全球第一，为什么这个国家赌得这么凶？',
    category: '赌城风云',
    subcategory: '澳大利亚',
    characters: ['gailv', 'laozhang', 'xiaotian'],
    type: '混战',
    triggerKeywords: ['澳大利亚', '澳洲', 'pokies', '老虎机', '墨尔本杯', 'crown', '皇冠赌场', 'TAB'],
    userEmotionMatch: ['震惊', '好奇', '讨论'],
    openingLines: {
      gailv: '澳大利亚人均年赌博消费超过1200美元 全球第一。全国有超过20万台老虎机 平均每114个成年人就有一台',
      laozhang: '我在墨尔本住过两年 那里的酒吧、超市、加油站旁边都有老虎机。你喝杯咖啡的功夫就能输掉一百刀 太容易了',
      xiaotian: '听说墨尔本杯赛马日是全国公共假日 全民下注。这种文化氛围下想不赌都难',
    },
    escalation: [
      { characterId: 'xiaotian', line: '我要是生在澳洲 肯定更早上瘾。到处都是老虎机 就像把酒放在酒鬼嘴边', emotion: '后怕' },
      { characterId: 'gailv', line: '澳洲的pokies行业每年营收超过120亿澳元 主要来自问题赌客。5%的人贡献了超过40%的收入', emotion: '愤怒' },
      { characterId: 'laozhang', line: '最讽刺的是 澳洲政府每年从赌博税收里赚几十亿 然后拿出一小部分来治疗赌瘾。这是制造问题再治疗问题的生意', emotion: '讽刺' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '澳大利亚是赌博合法化+弱监管的反面教材。当赌博渗透到社区每个角落时 "个人自制力"就成了笑话。环境的力量远大于意志力——这也是为什么戒赌最有效的方法之一就是物理隔离赌博环境',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 非洲
  // ══════════════════════════════════════════
  {
    id: 'dest_africa_001',
    topic: '非洲手机博彩为什么爆发式增长？年轻人的赌博危机有多严重？',
    category: '赌城风云',
    subcategory: '非洲',
    characters: ['junshi', 'xiaofang', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['非洲', '肯尼亚', '尼日利亚', '手机博彩', 'sportpesa', 'betway africa', '移动支付博彩'],
    userEmotionMatch: ['好奇', '震惊', '讨论'],
    openingLines: {
      junshi: '非洲的手机博彩增长速度令人震惊——肯尼亚18-35岁人群中超过75%参与过手机投注。在一个青年失业率超过30%的大陆 赌博正在成为"经济绝望"的出口',
      xiaofang: '我看过一个纪录片 肯尼亚的年轻人每天在手机上赌足球 赢了就能吃顿好的 输了就饿肚子。太惨了',
      kellyprof: '手机博彩在非洲爆发有三个条件：智能手机普及、移动支付成熟、传统赌场缺乏。技术跳过了实体赌场阶段 直接进入数字赌博时代',
    },
    escalation: [
      { characterId: 'xiaofang', line: '这不就是跟我一样吗 手机上赌太容易了 随时随地 根本没有冷静期', emotion: '共鸣' },
      { characterId: 'kellyprof', line: '更可怕的是 非洲很多博彩平台不受监管。没有自我排除机制 没有损失限额 没有年龄验证。完全是野蛮生长', emotion: '忧虑' },
      { characterId: 'junshi', line: '肯尼亚政府2019年一度禁了Sportpesa等平台 但很快又放开了——因为税收太重要了。这就是赌博产业的政治绑架', emotion: '无奈' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '非洲的手机博彩危机是全球赌博产业扩张的缩影：哪里有绝望 哪里就有赌博市场。当年轻人看不到通过正常劳动改善生活的可能 赌博就变成了"理性选择"。解决赌博问题的根本 不是禁赌 而是提供替代性的希望',
    },
  },

  // ══════════════════════════════════════════
  // 赌城风云 — 中东
  // ══════════════════════════════════════════
  {
    id: 'dest_mideast_001',
    topic: '中东伊斯兰国家全面禁赌，但地下赌博真的消失了吗？',
    category: '赌城风云',
    subcategory: '中东',
    characters: ['ajie', 'laozhang', 'gailv'],
    type: '圆桌',
    triggerKeywords: ['中东', '迪拜', '沙特', '伊斯兰', '禁赌', '地下赌场', '赛马', '骆驼赛'],
    userEmotionMatch: ['好奇', '讨论', '比较'],
    openingLines: {
      ajie: '中东国家表面上零赌博 但地下赌博活动从来没断过。迪拜的高端私人扑克局 赌注都是百万美元起步',
      laozhang: '有意思的是 伊斯兰教义禁止赌博 但很多中东土豪是拉斯维加斯和蒙特卡洛的VIP大客户。在国外赌就不算违规了？',
      gailv: '中东赛马和骆驼赛事每年的地下投注额估计超过数十亿美元。文化和宗教禁令挡不住人类对不确定性的渴望',
    },
    escalation: [
      { characterId: 'ajie', line: '迪拜为了吸引旅游收入 已经在讨论是否引入合法赌场。Wynn在当地的度假村项目据说会包含博彩设施', emotion: '爆料' },
      { characterId: 'laozhang', line: '如果迪拜真的开放赌场 那就是中东赌博产业的转折点。一旦开了口子 其他酋长国也会跟进', emotion: '预判' },
      { characterId: 'gailv', line: '历史反复证明：禁止型政策只能把赌博推入地下 合法化+监管的效果反而更好。但宗教因素让中东的选择更复杂', emotion: '客观' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '中东的禁赌实验证明了一件事：法律能禁止赌场 但禁不了赌博欲望。地下赌博因为缺乏监管 对参与者的危害反而更大——没有自我排除机制、没有投诉渠道、输了可能被黑吃黑。完全禁止和完全放开都是极端 最优解永远在中间',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 棒球
  // ══════════════════════════════════════════
  {
    id: 'sports_baseball_001',
    topic: '棒球博彩的"Run Line"和"Money Line"哪个更值得下？',
    category: '体育博彩',
    subcategory: '棒球',
    characters: ['gailv', 'aqiang', 'junshi'],
    type: '圆桌',
    triggerKeywords: ['棒球', 'MLB', '大联盟', 'run line', 'money line', '胜负盘', '让分', '投手'],
    userEmotionMatch: ['研究', '好奇', '讨论'],
    openingLines: {
      gailv: '棒球是最适合数据分析的体育博彩品种——样本量大、数据公开、投手因素可量化。Money Line的庄家抽水约4.5% 相对较低',
      aqiang: '棒球我看先发投手就够了 王牌投手上场 买主队 稳得很',
      junshi: '棒球博彩和其他体育最大的区别：它没有让分盘主导。Money Line是核心 这意味着冷门赔率更有价值 因为棒球的偶然性比足球篮球都高',
    },
    escalation: [
      { characterId: 'aqiang', line: '我上个赛季跟着ESPN的预测买 十场中了七场 这不就是有规律嘛', emotion: '得意' },
      { characterId: 'gailv', line: '十场太小了 不具有统计意义。而且你中七场但赔率呢？买热门赔率低 你算算实际收益率是正还是负', emotion: '质疑' },
      { characterId: 'junshi', line: 'Run Line的-1.5对强队来说是个陷阱——看似赔率更好 但棒球一分胜负的比例超过30% 你等于主动增加了风险', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '棒球博彩的正确思维方式：不要预测谁赢 而要判断市场赔率有没有定价错误。当你认为某队真实胜率是55%但赔率隐含胜率只有45%时 这才是有正期望值的下注。但这需要的分析能力远超绝大多数赌客的水平',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 高尔夫
  // ══════════════════════════════════════════
  {
    id: 'sports_golf_001',
    topic: '高尔夫博彩赔率超高但中奖率超低，到底是不是智商税？',
    category: '体育博彩',
    subcategory: '高尔夫',
    characters: ['kellyprof', 'aqiang', 'laoliu'],
    type: '对峙',
    triggerKeywords: ['高尔夫', 'PGA', '美巡赛', '四大满贯', '高球', '博彩', '夺冠赔率', '老虎伍兹'],
    userEmotionMatch: ['好奇', '贪心', '讨论'],
    openingLines: {
      kellyprof: '高尔夫博彩的夺冠盘通常有150+名选手 赔率从+500到+50000不等。庄家抽水可以高达30-40% 是体育博彩里最暴利的品种',
      aqiang: '但你看那个赔率啊 +10000就是一百倍！我下一百块中了就是一万 这诱惑谁扛得住',
      laoliu: '我有个朋友在高尔夫比赛押了个冷门 赢了三万块。虽然他之前输了至少十万 但那次赢的感觉让他一直在追',
    },
    escalation: [
      { characterId: 'aqiang', line: '我研究过 高尔夫关注球员状态和球场适配性就能找到价值。不像足球那么多变量', emotion: '自信' },
      { characterId: 'kellyprof', line: '一场72洞的高尔夫有超过280次击球 每次击球都引入随机变量。你说高尔夫变量少 恰恰说明你不懂这项运动', emotion: '反驳' },
      { characterId: 'laoliu', line: '但赌高尔夫有一点好——比赛四天 你有四天的期待和紧张感 比赌一场足球九十分钟过瘾多了', emotion: '享受' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '高尔夫博彩是"彩票心态"的体育版——低概率高回报吸引你 但庄家的超高抽水保证你长期亏损。如果你非要玩 对赌盘和前20名盘的庄家优势远低于夺冠盘。但说到底 这依然是负期望值游戏',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — F1赛车
  // ══════════════════════════════════════════
  {
    id: 'sports_f1_001',
    topic: 'F1赛车博彩有没有内幕？车队战术会不会影响赌局？',
    category: '体育博彩',
    subcategory: 'F1赛车',
    characters: ['ajie', 'gailv', 'xiaofang'],
    type: '混战',
    triggerKeywords: ['F1', '赛车', '一级方程式', '车队指令', '维斯塔潘', '汉密尔顿', '围场', '博彩'],
    userEmotionMatch: ['好奇', '质疑', '兴奋'],
    openingLines: {
      ajie: 'F1博彩最大的坑是车队指令——两个车手谁让谁 车队内部早就商量好了 但赔率不会提前反映这个',
      gailv: 'F1赛季只有24站左右 样本量太小 根本不足以建立可靠的统计模型。加上赛车机械故障的随机性 这是最难预测的体育项目之一',
      xiaofang: '我在网上看到有人卖F1内幕消息 说能提前知道车队策略 是不是真的？',
    },
    escalation: [
      { characterId: 'ajie', line: '卖内幕消息99%是骗子。真有内幕的人会自己下注 不会卖给你赚那点信息费', emotion: '警告' },
      { characterId: 'xiaofang', line: '但他晒了很多中奖截图 而且收费不贵 才两百块一场', emotion: '犹豫' },
      { characterId: 'gailv', line: '中奖截图可以P图 也可以只展示赢的不展示输的。这是最基本的幸存者偏差营销 你别上当', emotion: '劝阻' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'F1博彩的特殊性在于：少量参与者、大量不可控变量（天气、机械故障、安全车）、车队政治因素。这意味着赔率的定价效率较低 理论上有利可图——但你需要的专业知识远超普通赌客。买"内幕消息"？不如把钱省下来',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 板球
  // ══════════════════════════════════════════
  {
    id: 'sports_cricket_001',
    topic: '板球博彩是全球最大的地下赌博市场？假球问题有多严重？',
    category: '体育博彩',
    subcategory: '板球',
    characters: ['ajie', 'junshi', 'kellyprof'],
    type: '圆桌',
    triggerKeywords: ['板球', 'cricket', 'IPL', '假球', '点球', '地下盘', '印度板球', 'T20'],
    userEmotionMatch: ['震惊', '好奇', '讨论'],
    openingLines: {
      ajie: '板球地下博彩的规模据估计每年超过1500亿美元 比全球合法体育博彩的总和还大。这个数字你敢信？',
      junshi: 'IPL板球联赛是全球最受关注的体育联赛之一 也是假球丑闻的重灾区。2013年的假球案直接导致两支球队被停赛',
      kellyprof: '板球假球的操作方式很特别——不是操控胜负 而是操控单个事件 比如某一局的跑数、某个投手的无球。这种"点球"式操控更隐蔽',
    },
    escalation: [
      { characterId: 'ajie', line: '我在东南亚见过操控板球比赛的人 他们在比赛前一天就把脚本写好了。球员收的贿赂是他工资的十倍', emotion: '爆料' },
      { characterId: 'kellyprof', line: '板球的数据化程度非常高 理论上AI可以检测异常投注模式。但问题是 大部分投注发生在不受监管的地下市场', emotion: '无奈' },
      { characterId: 'junshi', line: '板球假球的根源是球员薪资不平等——顶级球星年薪数百万 但国内联赛球员可能一年只赚几万。这给了庄家收买的空间', emotion: '分析' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '板球博彩揭示了体育博彩最黑暗的一面：当赌注大到一定程度 运动本身就变成了赌博工具。你以为自己在分析比赛 其实你看到的可能是一场精心编排的表演。在一个假球泛滥的领域下注 就是和庄家对赌谁更了解剧本',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 奥运会
  // ══════════════════════════════════════════
  {
    id: 'sports_olympics_001',
    topic: '奥运会博彩合法吗？运动员操控比赛的可能性有多大？',
    category: '体育博彩',
    subcategory: '奥运会',
    characters: ['gailv', 'laozhang', 'ajie'],
    type: '圆桌',
    triggerKeywords: ['奥运', '奥运会', '奥林匹克', '金牌', '博彩', '操控', '禁赛', '兴奋剂'],
    userEmotionMatch: ['好奇', '质疑', '讨论'],
    openingLines: {
      gailv: '奥运会博彩在很多国家是合法的 但IOC一直试图限制——2022年估计全球奥运博彩投注额超过200亿美元',
      laozhang: '奥运会的纯洁性已经被各种丑闻侵蚀了。兴奋剂、裁判受贿、假赛……当金牌和国家荣誉挂钩 作弊的诱惑就更大',
      ajie: '奥运会最容易被操控的不是大项目 而是冷门项目——比如某些小国的举重、射击。关注度低 监控少 操控成本也低',
    },
    escalation: [
      { characterId: 'ajie', line: '2004年雅典奥运会体操裁判打分丑闻、2002年盐湖城花样滑冰裁判交易……这些都是公开的案例', emotion: '列举' },
      { characterId: 'gailv', line: '奥运博彩最大的风险是信息不对称——业余运动员的状态几乎无法追踪 你根本不知道他伤没伤、练没练', emotion: '分析' },
      { characterId: 'laozhang', line: '最讽刺的是 IOC一边反对赌博 一边接受博彩公司的赞助费。这和赌场一边推广负责任赌博一边拼命吸引赌客一样虚伪', emotion: '讽刺' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: '奥运博彩的本质矛盾：体育精神和商业利益不可调和。当一场比赛的投注额是运动员一辈子收入的一万倍 操控的诱惑就无法靠道德约束。作为赌客 你在奥运博彩中面对的不确定性比常规联赛大得多 因为你无法判断你看到的是真实竞技还是被操控的结果',
    },
  },

  // ══════════════════════════════════════════
  // 体育博彩 — 综合格斗
  // ══════════════════════════════════════════
  {
    id: 'sports_mma_001',
    topic: 'UFC/MMA博彩为什么被称为"最刺激的体育赌博"？冷门翻盘率有多高？',
    category: '体育博彩',
    subcategory: '综合格斗',
    characters: ['aqiang', 'gailv', 'laoliu'],
    type: '混战',
    triggerKeywords: ['UFC', 'MMA', '综合格斗', '格斗', '拳击', 'KO', '降服', '八角笼', '冷门'],
    userEmotionMatch: ['兴奋', '好奇', '刺激'],
    openingLines: {
      aqiang: 'UFC赌起来太爽了！一拳KO直接翻盘 那种肾上腺素飙升的感觉 其他运动给不了',
      gailv: 'MMA的冷门率约30%——意味着将近三分之一的比赛结果是"不应该赢的人赢了"。这对博彩公司来说是挑战 对赌客来说是陷阱',
      laoliu: '我上次赌UFC 押了个冷门 +800的赔率 第三回合KO逆转！那一晚我请所有朋友喝酒 花了赢的一半',
    },
    escalation: [
      { characterId: 'laoliu', line: '后来我想复制那次成功 连着押了十个冷门 全输了。一晚上把之前赢的全还回去还多', emotion: '懊悔' },
      { characterId: 'gailv', line: '这就是MMA博彩的毒——偶然性太高 让你产生"我能看透比赛"的幻觉。实际上一记幸运拳就能改变一切', emotion: '冷静' },
      { characterId: 'aqiang', line: '但你不觉得正是这种不确定性才好看吗！确定的比赛谁看啊 赌的就是心跳', emotion: '亢奋' },
    ],
    resolution: {
      junshiTrigger: true,
      junshiVerdict: 'MMA博彩的核心矛盾：高不确定性让赔率更"有价值" 但同样让预测更不靠谱。30%的冷门率意味着即使你分析得再好 也有将近三成的概率被"一记幸运拳"推翻。这种高波动性让赢的时候极其兴奋 输的时候极其痛苦——完美的成瘾配方',
    },
  }
];
