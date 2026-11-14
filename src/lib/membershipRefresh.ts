export const MEMBERSHIP_REFRESH_EVENT = "ether-membership-refresh";

export function requestMembershipRefresh() {
  window.dispatchEvent(new Event(MEMBERSHIP_REFRESH_EVENT));
}
