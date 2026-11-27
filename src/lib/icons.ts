// src/lib/icons.ts
//
// The site's icon set: simple line icons (24x24, drawn with strokes in `currentColor`), used INSTEAD of emojis everywhere:
// in the interface, the chat, the admin and inside the websites the builder generates (inline SVG, so no icon font or CDN is needed).
// Isomorphic: plain strings, so it also runs on the server and inside generated sites. Add an icon = add one line to ICONS.

export const ICONS: Record<string, string> = {
  'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>', 'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>', 'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', check: '<polyline points="20 6 9 17 4 12"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/>',
  'alert-triangle': '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ban: '<circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>',
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><line x1="10.8" y1="12.2" x2="20" y2="3"/><line x1="17" y1="6" x2="20" y2="9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 6 12 13 22 6"/>',
  'message-circle': '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 3.1 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  paperclip: '<path d="m21 11-9.2 9.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'map-pin': '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><polygon points="22 8 16 12 22 16 22 8"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  'thumbs-up': '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  'thumbs-down': '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.7A2.3 2.3 0 0 1 22 4v7a2 2 0 0 1-2 2h-3"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.2 13.9 7 23 12 20 17 23 15.8 13.9"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2a2.8 2.8 0 0 0-3-3z"/><path d="M12 15l-3-3a22 22 0 0 1 2-4 12.8 12.8 0 0 1 11-6c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  cloud: '<path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-4 3 0-3-1-6-4-9 0 4-3 6-3 11 0 5 3 9 7 9z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16z"/><path d="M4 20c3-6 6-9 10-11"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  'shopping-cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><line x1="1" y1="20" x2="23" y2="20"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  palette: '<path d="M12 2a10 10 0 1 0 0 20c1.7 0 2.5-1 2-2.5-.5-1.4.2-2.5 1.7-2.5H18a4 4 0 0 0 4-4C22 6 17.5 2 12 2z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  brush: '<path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/><path d="M8 16c-2 0-4 1-4 3 0 1-1 2-2 3 4 .5 8 0 8-4"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M1.4 9a15 15 0 0 1 21.2 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  graduation: '<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/><line x1="22" y1="10" x2="22" y2="16"/>',
  lightbulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  utensils: '<path d="M4 3v7a3 3 0 0 0 3 3v8"/><path d="M7 3v7M10 3v7a3 3 0 0 1-3 3"/><path d="M18 21V3c-2.5 1-4 4-4 8 0 2 1 3 4 3"/>',
  wine: '<path d="M8 22h8M12 15v7"/><path d="M7 2h10l-.8 6a4.2 4.2 0 0 1-8.4 0z"/>',
  car: '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  plane: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  'heart-pulse': '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/><polyline points="3 12 8 12 10 9 13 15 15 12 21 12"/>',
  'bar-chart': '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  'trending-up': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  redo: '<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>',
  grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5H3v8h4"/><path d="M14 21c3 0 7-1 7-8V5h-7v8h4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  filter: '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
  crown: '<path d="M2 18l2-11 6 5 2-8 2 8 6-5 2 11z"/><line x1="2" y1="21" x2="22" y2="21"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>',
  wand: '<path d="M15 4l5 5L9 20l-5-5z"/><line x1="3" y1="3" x2="5" y2="5"/><line x1="19" y1="3" x2="21" y2="5"/>',
};

export const ICON_NAMES = Object.keys(ICONS);

/** Inline SVG markup (string) for server-side / generated-site use. */
export function iconSvg(name: string, opts: { size?: number; stroke?: number; cls?: string; label?: string } = {}): string {
  const body = ICONS[name] ?? ICONS.star;
  const { size = 24, stroke = 2, cls = '', label } = opts;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>${body}</svg>`;
}

/** A small circular favicon (icon on a coloured disc) as a data URL: replaces the old emoji favicon. */
export function iconFavicon(name: string, color = '#0d6efd'): string {
  const body = ICONS[name] ?? ICONS.star;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${color}"/><g transform="translate(6 6) scale(.833)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body.replace(/currentColor/g, '#fff')}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ───────── emoji → icon (so text containing emojis shows icons instead) ───────── */
export const EMOJI_TO_ICON: Record<string, string> = {
  '💬': 'message-circle', '🗨': 'message-square', '🎨': 'palette', '⬇': 'download', '⬆': 'upload', '👋': 'smile', '👍': 'thumbs-up', '👎': 'thumbs-down',
  '🚀': 'rocket', '😊': 'smile', '😄': 'smile', '🙂': 'smile', '😃': 'smile', '😀': 'smile', '📅': 'calendar', '📆': 'calendar', '📱': 'smartphone', '🗑': 'trash', '🔒': 'lock', '🔐': 'lock', '📞': 'phone', '☎': 'phone',
  '🗂': 'folder', '📂': 'folder', '📁': 'folder', '💰': 'dollar', '💵': 'dollar', '✅': 'check-circle', '✔': 'check', '☑': 'check', '✓': 'check', '✗': 'x', '✕': 'x', '✖': 'x', '❓': 'help-circle', '❔': 'help-circle', '🌐': 'globe', '💾': 'save',
  '🎉': 'sparkles', '🎊': 'sparkles', '🖼': 'image', '📝': 'file-text', '📄': 'file-text', '✉': 'mail', '📬': 'mail', '📨': 'mail', '📧': 'mail', '📎': 'paperclip', '⚠': 'alert-triangle',
  '⚙': 'settings', '👁': 'eye', '⭐': 'star', '🌟': 'star', '💡': 'lightbulb', '💻': 'laptop', '🖥': 'monitor', '⚡': 'zap', '✨': 'sparkles', '🧭': 'compass', '🚫': 'ban', '❌': 'x',
  '✎': 'edit', '✏': 'edit', '🔧': 'wrench', '🛠': 'wrench', '🍲': 'utensils', '🍽': 'utensils', '🥗': 'leaf', '🍰': 'gift', '🍕': 'utensils', '🍔': 'utensils', '🔔': 'bell', '🖨': 'printer', '⧉': 'copy', '📦': 'package', '🛒': 'shopping-cart', '🛍': 'shopping-bag',
  '🏢': 'building', '📈': 'trending-up', '📊': 'bar-chart', '📸': 'camera', '📷': 'camera', '☕': 'coffee', '🎓': 'graduation', '💼': 'briefcase', '❤': 'heart', '💖': 'heart', '🔑': 'key', '⏰': 'clock', '🕒': 'clock', '⏱': 'clock',
  '🔥': 'flame', '🌿': 'leaf', '🌱': 'leaf', '🏠': 'home', '🔍': 'search', '🔎': 'search', '🎯': 'target', '✂': 'scissors', '🚚': 'truck', '🎁': 'gift', '🏆': 'trophy', '🎵': 'music', '🎬': 'film', '🎥': 'video',
  '📍': 'map-pin', '🗺': 'map', '☀': 'sun', '🌙': 'moon', '☁': 'cloud', '🚗': 'car', '✈': 'plane', '🏋': 'dumbbell', '💪': 'dumbbell', '🍷': 'wine', '👤': 'user', '👥': 'users', '🤝': 'users',
  '🛡': 'shield', '💳': 'credit-card', '🏷': 'tag', '📋': 'clipboard', '📚': 'book', '📖': 'book', '🔗': 'link', '🔄': 'refresh', '↩': 'undo', '↪': 'redo', '🧩': 'layers', '🗄': 'database', '🪄': 'wand', '👑': 'crown', '🏁': 'flag',
  '💎': 'sparkles', '🔖': 'tag', '📌': 'map-pin', '🧾': 'file-text', '🤖': 'cpu', '🎤': 'mic', '▶': 'play', '🆕': 'sparkles', '🆓': 'gift', '🔓': 'key', '🔊': 'music', '👗': 'scissors', '💇': 'scissors', '💅': 'sparkles', '🏥': 'heart-pulse', '⚽': 'target', '🎮': 'wand',
};

/** One regex matching emoji and pictographic symbols (so unknown ones can be dropped and never show as a coloured emoji). */
export const EMOJI_RE = /(?:[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u2B50\u2B06\u2B07\u23F0\u23F1\u23F3\u231A\u2705\u274C\u2753\u2757\u2764\u21A9\u21AA\u29C9\u270E])\uFE0F?/gu;

/** Emoji that have no entry above, mapped to the nearest icon. Anything still unknown is dropped, never shown as an emoji. */
const EXTRA: Record<string, string> = {
  '♡': 'heart', '♥': 'heart', '💜': 'heart', '💛': 'heart', '💚': 'heart', '💙': 'heart', '🧡': 'heart', '💌': 'mail', '★': 'star', '☆': 'star',
  '🌍': 'globe', '🌎': 'globe', '🌏': 'globe', '🧮': 'bar-chart', '📐': 'edit', '🔢': 'list', '🔤': 'edit', '🔠': 'edit', '✍': 'edit',
  '🧪': 'sparkles', '🧬': 'sparkles', '⚛': 'sparkles', '🪐': 'moon', '🌕': 'moon', '🌗': 'moon', '☾': 'moon', '⏳': 'clock', '⌚': 'clock', '🗓': 'calendar',
  '🗣': 'mic', '💧': 'cloud', '🌊': 'cloud', '🌧': 'cloud', '🌈': 'cloud', '🌀': 'cloud', '❄': 'cloud', '🌅': 'sun', '🏔': 'map', '☰': 'menu',
  '👀': 'eye', '🩺': 'heart-pulse', '💉': 'heart-pulse', '💊': 'heart-pulse', '🩸': 'heart-pulse', '🌡': 'heart-pulse', '🔌': 'zap', '🔋': 'zap',
  '🎂': 'gift', '🧁': 'gift', '🥧': 'gift', '🧠': 'cpu', '🙏': 'smile', '🙌': 'smile', '🖖': 'smile', '🤫': 'smile', '🤓': 'smile', '🤔': 'help-circle',
  '🙅': 'ban', '👨': 'user', '👦': 'user', '🧔': 'user', '👔': 'user', '🧑': 'user', '🧒': 'user', '🧍': 'user', '👶': 'user', '💃': 'user', '📺': 'monitor',
  '📻': 'music', '🧹': 'wrench', '🧼': 'wrench', '🧰': 'wrench', '🧵': 'scissors', '📶': 'wifi', '📲': 'smartphone', '🖱': 'monitor', '🪲': 'code',
  '🎲': 'target', '🏀': 'trophy', '🏏': 'trophy', '🏐': 'trophy', '🏓': 'trophy', '🎣': 'target', '🪙': 'dollar', '💸': 'dollar', '💱': 'dollar',
  '🥐': 'utensils', '🥪': 'utensils', '🥡': 'utensils', '🍞': 'utensils', '🌽': 'leaf', '🥚': 'utensils', '🍅': 'leaf', '🌯': 'utensils', '🥂': 'wine',
  '💍': 'sparkles', '💒': 'sparkles', '⛪': 'building', '🏫': 'graduation', '🏪': 'store', '🎛': 'sliders', '🛟': 'shield', '🚲': 'car', '💆': 'heart',
  '💄': 'sparkles', '📣': 'megaphone', '🔻': 'arrow-down', '📑': 'file-text', '❗': 'alert-circle', '❚': 'minus', '✆': 'phone', '✚': 'plus',
  '🎆': 'sparkles', '🎃': 'sparkles', '🎄': 'sparkles', '🧧': 'gift', '🪔': 'flame', '♨': 'flame', '🐣': 'leaf', '🕊': 'leaf', '👾': 'code',
  '🦟': 'leaf', '🐝': 'leaf', '🐱': 'leaf', '🐦': 'leaf', '🦍': 'leaf', '🐋': 'leaf', '🐘': 'leaf', '🐆': 'leaf', '🦒': 'leaf', '🦇': 'leaf', '🦴': 'heart-pulse',
  '🗳': 'check-circle', '🔽': 'arrow-down',
};

const RANGES: Array<[number, number, string]> = [
  [0x1f600, 0x1f64f, 'smile'], [0x1f910, 0x1f92f, 'smile'], [0x1f970, 0x1f97f, 'smile'], [0x1f400, 0x1f43f, 'leaf'], [0x1f980, 0x1f9af, 'leaf'],
  [0x1f32d, 0x1f37f, 'utensils'], [0x1f950, 0x1f96f, 'utensils'], [0x1f680, 0x1f6ff, 'car'],
];

export function emojiToIcon(e: string): string | null {
  const key = e.replace(/\uFE0F/g, '');
  const direct = EMOJI_TO_ICON[key] ?? EXTRA[key];
  if (direct) return direct;
  const cp = key.codePointAt(0) ?? 0;
  for (const [a, b, n] of RANGES) if (cp >= a && cp <= b) return n;
  return null;
}

/** Remove every emoji / pictograph from a string (for titles, labels and other places that cannot hold an icon). */
export function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, '').replace(/\uFE0F/g, '').replace(/ {2,}/g, ' ').trim();
}

/** A stored "icon" value (an icon name, or an emoji saved by an older version) -> an inline SVG. Unknown values give ''. */
export function iconHtml(value: string, size: string | number = '1em'): string {
  const v = (value || '').trim();
  if (!v) return '';
  const draw = (n: string) => iconSvg(n, { cls: 'ico' }).replace(/width="24" height="24"/, `width="${size}" height="${size}"`);
  if (ICONS[v]) return draw(v);
  const m = v.match(new RegExp(EMOJI_RE.source, EMOJI_RE.flags));
  const n = m ? emojiToIcon(m[0]) : null;
  return n && ICONS[n] ? draw(n) : '';
}

/** Icon names that can be picked for a card (shown in the builder's icon picker). */
export const PICKABLE_ICONS = ['star', 'rocket', 'lightbulb', 'wrench', 'smartphone', 'laptop', 'palette', 'shopping-cart', 'heart', 'check-circle', 'phone', 'trophy', 'utensils', 'coffee', 'lock', 'zap', 'globe', 'users', 'trending-up', 'graduation', 'camera', 'truck', 'gift', 'shield', 'mail', 'map-pin', 'calendar', 'clock', 'scissors', 'home', 'briefcase', 'leaf'];

/** A stored favicon value (icon name, or an emoji from an older project) -> a data-URL icon. */
export function faviconFor(value: string, color?: string): string {
  const v = (value || '').trim();
  let n = ICONS[v] ? v : '';
  if (!n) { const m = v.match(new RegExp(EMOJI_RE.source, EMOJI_RE.flags)); n = (m && emojiToIcon(m[0])) || 'star'; }
  return iconFavicon(n, color);
}
