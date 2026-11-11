// Material Symbols Outlined stylesheet for app/layout.tsx.
//
// `icon_names` makes Google Fonts serve a font that holds only these icons
// (about 68 KB for this list instead of the full 4 MB font). A name that is not
// listed is not in the font and shows as its letters instead of an icon, so the
// list covers every name a component can pass to <Icon name>: literal names,
// nav items, and the glyph maps with their fallbacks (account types,
// transaction types, goal icons in lib/goals.ts, theme options, the transaction
// type switcher, quick actions).
const MATERIAL_SYMBOL_NAMES = [
  "account_balance",
  "account_balance_wallet",
  "add",
  "analytics",
  "archive",
  "arrow_back",
  "arrow_downward",
  "arrow_forward",
  "arrow_upward",
  "backup",
  "bar_chart",
  "block",
  "calendar_month",
  "calendar_today",
  "category",
  "check",
  "check_circle",
  "chevron_left",
  "chevron_right",
  "close",
  "content_copy",
  "credit_card",
  "dark_mode",
  "data_object",
  "delete",
  "desktop_windows",
  "download",
  "edit",
  "error",
  "event_repeat",
  "expand_less",
  "expand_more",
  "flag",
  "flight",
  "forward_to_inbox",
  "home",
  "inbox",
  "inventory_2",
  "light_mode",
  "lock",
  "logout",
  "mail",
  "more_vert",
  "notes",
  "notifications",
  "palette",
  "payments",
  "person",
  "pie_chart",
  "play_arrow",
  "receipt_long",
  "redeem",
  "repeat",
  "savings",
  "school",
  "search",
  "search_off",
  "settings",
  "store",
  "swap_horiz",
  "sync",
  "sync_alt",
  "table_view",
  "target",
  "track_changes",
  "trending_up",
  "tune",
  "unarchive",
  "visibility",
  "visibility_off",
  "warning",
];

// The axis ranges are the same as before the subset: <Icon> maps `size` to
// opsz, accepts `weight`, toggles FILL, and sets GRAD 0. Pinning GRAD at 0
// would save about 25 KB, but it changed edge pixels slightly when measured,
// so the range stays.
// The names are deduplicated and sorted here because the API expects a sorted
// list and answers a repeated name with HTTP 400, which would break every icon.
// display=block keeps an icon blank while the font loads instead of showing its
// name as text.
export const MATERIAL_SYMBOLS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" +
  ":opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" +
  `&icon_names=${[...new Set(MATERIAL_SYMBOL_NAMES)].sort().join(",")}` +
  "&display=block";
