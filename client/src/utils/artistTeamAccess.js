export function isUserOnArtistTeam(user, team = []) {
  if (!user || !team?.length) return false;
  const uid = String(user._id || user.id);
  return team.some((member) => String(member?._id || member) === uid);
}
