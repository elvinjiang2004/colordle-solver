export type GameProfile = 'ryan' | 'osmanyo';
let activeProfile: GameProfile = 'ryan';

export const gameProfile = () => activeProfile;
export function setGameProfile(profile: GameProfile) {
  if (profile !== 'ryan' && profile !== 'osmanyo') throw new Error('Unknown Colordle version.');
  activeProfile = profile;
}
export const normalizeName = (name: string) => activeProfile === 'ryan'
  ? name.trim().toLowerCase().replace(/ /g, '') : name.trim().toLowerCase();
