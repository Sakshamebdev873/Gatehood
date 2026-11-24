/** Direction A ("Notice board") design tokens. */
export const colors = {
  forest: '#2D6A4F',
  forestDk: '#214E3A',
  amber: '#F4A261',
  amberDk: '#C2651A',
  ivory: '#FBF8F2',
  card: '#FFFFFF',
  inset: '#F2F0EB',
  ink: '#1A1A1A',
  muted: '#6B6B6B',
  faint: '#9E9E9E',
  line: '#E8E4DC',
  /** Off-state switch track: dark enough to read on white cards. */
  switchOff: '#CFC9BD',
  error: '#BE123C',
  dot: '#E07A2F',
  white: '#FFFFFF',
} as const;

/** Font family names, as registered by useFonts in the root layout. */
export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayItalic: 'CormorantGaramond_500Medium_Italic',
  body: 'DMSans_400Regular',
  bodyLight: 'DMSans_300Light',
  bodyMedium: 'DMSans_500Medium',
  bodySemibold: 'DMSans_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const space = { 4: 4, 6: 6, 8: 8, 10: 10, 14: 14, 18: 18, 22: 22, 28: 28 } as const;

export const radius = { card: 14, pill: 999 } as const;
