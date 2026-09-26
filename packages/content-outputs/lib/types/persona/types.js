/**
 * Wire vocabulary of the persona write face on the content-outputs Remote:
 * the account-persona entries behind the 画像 view, their `_personas.json`
 * manifest at the library root, and the persona AI operations (field fill,
 * résumé extraction, report generation). Client-safe by construction — no
 * Node or filesystem imports. Entry text is embedded in the manifest, so a
 * persona never references an external file and the manifest is the whole
 * backup. Enum label tables live here (not in locales) so the browser
 * dropdowns, the packed prompt preview, and the gateway-side digest all read
 * one home.
 */
/** Every persona platform, frozen for wire validation and picker order. */
export const PERSONA_PLATFORMS = ['xhs', 'douyin', 'bili', 'zhihu', 'wechat', 'channels', 'weibo', 'toutiao'];
/** Chinese label of one persona platform; shared by the picker, the packed prompt, and the digest. */
export const PERSONA_PLATFORM_LABELS = {
    xhs: '小红书',
    douyin: '抖音',
    bili: 'B 站',
    zhihu: '知乎',
    wechat: '公众号',
    channels: '视频号',
    weibo: '微博',
    toutiao: '今日头条',
};
/** Every persona field key, frozen for wire validation and form order. */
export const PERSONA_FIELD_KEYS = ['whoAmI', 'audience', 'oneLiner', 'niche', 'goal', 'monetize', 'contentValue', 'cadence', 'phrases'];
/** Chinese label of one persona field; shared by the wizard, the preview, and the AI prompts. */
export const PERSONA_FIELD_LABELS = {
    whoAmI: '我是谁（主体背景）',
    audience: '目标受众',
    oneLiner: '人设一句话简介',
    niche: '赛道 / 行业',
    goal: '核心目标',
    monetize: '变现方式',
    contentValue: '内容核心价值',
    cadence: '更新节奏',
    phrases: '推荐句式 / 表达习惯',
};
/** Field keys the generic fill operation must never produce: the subject background is a fact only the user or the résumé face supplies. */
export const PERSONA_FILL_PROHIBITED = ['whoAmI'];
/** Every style preset, frozen for wire validation and picker order. */
export const PERSONA_STYLE_PRESETS = ['professional', 'friendly', 'humor', 'concise', 'narrative', 'hardcore', 'empathy'];
/** Chinese label of one style preset; shared by the picker, the packed prompt, and the digest. */
export const PERSONA_STYLE_PRESET_LABELS = {
    professional: '专业严谨',
    friendly: '亲切接地气',
    humor: '幽默网感',
    concise: '简洁干练',
    narrative: '故事叙事',
    hardcore: '硬核干货',
    empathy: '温柔共情',
};
//# sourceMappingURL=types.js.map