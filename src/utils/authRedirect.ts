export function getAuthRedirectUrl(path = '/login') {
  return `${window.location.origin}${path}`;
}
