const numberFormat = new Intl.NumberFormat("fa-IR");

/** @param {number} value */
export function formatNumber(value) {
  return numberFormat.format(value);
}

export const strings = {
  title: "سفر بی‌پایان هیولا",
  englishTitle: "Endless Monster Journey",
  creatureName: "شبنمک",
  tagline: "هر نوبت یک تصمیم است. نتیجه را لبه حساب می‌کند.",
  intro:
    "با یک موجود کوچک راه می‌افتی. در هر مرحله یک مسیر انتخاب می‌کنی، یا می‌جنگی یا کنار چشمه نفس می‌گیری. دشمن قوی‌تر می‌شود و با صفر شدن جان، سفر تمام می‌شود.",
  newGame: "سفر تازه",
  continueGame: "ادامه سفر",
  playAgain: "سفر دوباره",
  retry: "تلاش دوباره",
  loading: "در حال خواندن سفر ذخیره‌شده…",
  calculating: "لبه در حال محاسبه نتیجه است…",
  storageWarning: "حافظه محلی در دسترس نیست. اگر صفحه را ببندی، این سفر از بین می‌رود.",
  stage: "مرحله",
  completed: "مرحله‌های تمام‌شده",
  routesTitle: "کدام راه را می‌روی؟",
  combatTitle: "نوبت توست",
  rewardTitle: "یک پاداش انتخاب کن",
  gameOverTitle: "شبنمک از پا درآمد",
  gameOverNote: "این عدد فقط روی همین دستگاه مانده است و یک رکورد تأییدشده جهانی نیست.",
  localLog: "گزارش این نبرد",
  enemyIntent: "نیت دشمن",
  edgeSummary: "محاسبه لبه",
  edgeEmpty: "هنوز درخواستی به رابط بازی فرستاده نشده است.",
  edgeAction: "آخرین کنش",
  edgeRevision: "نسخه وضعیت",
  edgeRoundTrip: "زمان رفت‌وبرگشت",
  edgeRoundTripNote: "این زمان در مرورگر اندازه گرفته شده و زمان پردازنده یا اجرای لبه نیست.",
  edgeEvents: "رویدادهایی که لبه برگرداند",
  footer: "سلامت، آسیب و پاداش فقط بعد از پاسخ رابط بازی عوض می‌شوند.",
  stats: {
    hp: "جان",
    attack: "حمله",
    defense: "دفاع",
    energy: "انرژی",
    potions: "معجون",
  },
  routes: {
    forest: {
      title: "جنگل",
      summary: "نبردی معمولی با پاداش استاندارد.",
      detail: "همیشه باز است. دشمن از میان لیزابه‌ها و خفاش‌ها می‌آید.",
    },
    cave: {
      title: "غار",
      summary: "نبردی سخت‌تر با پاداش بیشتر.",
      detail: "بیشینه جان دشمن ۲۰٪ زیاد می‌شود و اثر عددی پاداش‌ها یک‌ونیم برابر می‌گردد.",
    },
    spring: {
      title: "چشمه",
      summary: "۳۰٪ از بیشینه جان و ۲ انرژی برمی‌گردد.",
      detail: "مرحله همین‌جا تمام می‌شود و پاداش نبرد ندارد.",
    },
  },
  routeReasons: {
    wrong_phase: "الان وقت انتخاب راه نیست.",
    spring_unavailable: "چشمه هر سه مرحله یک‌بار باز می‌شود.",
  },
  moves: {
    attack: "حمله",
    defend: "دفاع",
    special: "ضربه ویژه",
    potion: "معجون",
  },
  moveHints: {
    attack: "آسیب معمولی و یک انرژی",
    defend: "این نوبت نیمی از آسیب، و دو انرژی",
    special: "هزینه ۳ انرژی، آسیب دو برابر",
    potion: "۳۵٪ از بیشینه جان",
  },
  actionReasons: {
    wrong_phase: "این کنش الان در دسترس نیست.",
    insufficient_energy: "انرژی کافی نیست.",
    no_potions: "معجونی نمانده است.",
    health_full: "جان پر است.",
  },
  enemies: {
    forest_slime: "لیزابه جنگلی",
    cave_bat: "خفاش غار",
    stone_golem: "گولم سنگی",
  },
  intentions: {
    attack: "حمله",
    heavy_attack: "حمله سنگین",
    recover: "بازیابی",
  },
  rewards: {
    vitality: "سرزندگی",
    power: "قدرت",
    armor: "زره",
    energy: "انرژی",
    supplies: "تدارکات",
  },
  errors: {
    NETWORK: "ارتباط با رابط بازی قطع است. پیشرفت تازه‌ای ساخته نشد.",
    INVALID_REQUEST: "درخواست پذیرفته نشد.",
    INVALID_TOKEN: "ذخیره قابل تأیید نیست.",
    TOKEN_EXPIRED: "مهلت این ذخیره تمام شده است.",
    UNSUPPORTED_VERSION: "این ذخیره با قواعد فعلی سازگار نیست.",
    INVALID_ACTION: "این کنش در وضعیت فعلی مجاز نیست.",
    NUMERIC_LIMIT: "سفر از محدوده عددی پشتیبانی‌شده گذشت.",
    CONFIGURATION_ERROR: "پیکربندی رابط بازی ناقص است.",
    INTERNAL_ERROR: "رابط بازی با خطای داخلی جواب داد.",
  },
};

/** @param {object} effects */
export function describeEffects(effects) {
  const parts = [];
  if (effects.maxHp) parts.push(`بیشینه جان +${formatNumber(effects.maxHp)}`);
  if (effects.hp) parts.push(`جان فعلی +${formatNumber(effects.hp)}`);
  if (effects.attack) parts.push(`حمله +${formatNumber(effects.attack)}`);
  if (effects.defense) parts.push(`دفاع +${formatNumber(effects.defense)}`);
  if (effects.maxEnergy) parts.push(`بیشینه انرژی +${formatNumber(effects.maxEnergy)}`);
  if (effects.energy) parts.push(`انرژی فعلی +${formatNumber(effects.energy)}`);
  if (effects.potions) parts.push(`معجون +${formatNumber(effects.potions)}`);
  return parts.join("، ");
}

/** @param {object} event */
export function describeEvent(event) {
  switch (event.type) {
    case "game_started":
      return "سفر تازه‌ای روی لبه ساخته شد.";
    case "encounter_started":
      return `${strings.enemies[event.enemy.archetype] || "دشمن"} ظاهر شد. نیتش: ${strings.intentions[event.enemy.intention]}.`;
    case "player_attacked":
      return event.move === "special"
        ? `ضربه ویژه ${formatNumber(event.damage)} آسیب زد.`
        : `حمله ${formatNumber(event.damage)} آسیب زد.`;
    case "enemy_attacked":
      return event.defended
        ? `دشمن ${formatNumber(event.damage)} آسیب زد؛ دفاع آن را از ${formatNumber(event.rawDamage)} کم کرد.`
        : `دشمن ${formatNumber(event.damage)} آسیب زد.`;
    case "health_restored":
      if (event.target === "enemy") return `دشمن ${formatNumber(event.amount)} جان بازیابی کرد.`;
      return `${formatNumber(event.amount)} جان بازگشت.`;
    case "energy_changed":
      return `انرژی به ${formatNumber(event.energyAfter)} رسید.`;
    case "enemy_defeated":
      return "دشمن از پا درآمد و نتوانست جواب بدهد.";
    case "player_defeated":
      return "جان شبنمک به صفر رسید.";
    case "reward_selected":
      return `${strings.rewards[event.category] || "پاداش"} انتخاب شد.`;
    case "stage_completed":
      return `مرحله تمام شد. مرحله‌های کامل: ${formatNumber(event.completedStages)}.`;
    case "enemy_intention":
      return `نیت بعدی دشمن: ${strings.intentions[event.intention]}.`;
    case "rewards_ready":
      return "سه پاداش روی لبه ساخته شد.";
    default:
      return "لبه یک رویداد برگرداند.";
  }
}

/** @param {string | undefined} code */
export function errorText(code) {
  return strings.errors[code] || strings.errors.NETWORK;
}
