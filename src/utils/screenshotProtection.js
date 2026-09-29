/**
 * Returns true when the viewer should block screenshots for the given user
 * (they enabled screenshot protection on their account).
 */
export function userRequiresScreenshotProtection(userLike) {
  return userLike?.privacy?.screenshotProtection === true;
}

/**
 * True when a group has at least one member (other than viewerId) with
 * screenshot protection enabled.
 */
export function groupHasProtectedMember(group, viewerId, usersList = []) {
  if (!group?.members?.length) return false;
  const me = String(viewerId || '');
  for (const member of group.members) {
    const id = String(member?.id || member?._id || member || '');
    if (!id || id === me) continue;
    const privacy =
      member?.privacy ||
      usersList.find((u) => String(u.id) === id)?.privacy;
    if (userRequiresScreenshotProtection({ privacy })) return true;
  }
  return false;
}

/**
 * Whether the current viewer should enforce screenshot protection.
 *
 * Only the chat/profile of someone who enabled protection is protected.
 * Enabling the setting on your account does NOT protect every chat you open —
 * it protects *your* chats on other people's devices when they view you.
 */
export function shouldEnforceScreenshotProtection({
  viewerId,
  selected,
  profileUserId,
  users = [],
  groups = [],
  resolveDmPeer,
}) {
  if (
    profileUserId &&
    String(profileUserId) !== String(viewerId)
  ) {
    const profileUser = users.find(
      (u) => String(u.id) === String(profileUserId),
    );
    if (userRequiresScreenshotProtection(profileUser)) return true;
  }

  if (!selected) return false;

  if (selected.type === 'dm') {
    // Your own / notes chat is never "someone else's protected chat".
    if (
      selected.isSelfChat ||
      String(selected.id) === String(viewerId)
    ) {
      return false;
    }
    const peer = resolveDmPeer?.(selected) || selected.peer;
    return userRequiresScreenshotProtection(peer);
  }

  if (selected.type === 'group') {
    const group =
      selected.group ||
      groups.find((g) => String(g.id) === String(selected.id));
    return groupHasProtectedMember(group, viewerId, users);
  }

  return false;
}
