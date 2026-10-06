export function mentorBase() {
  const match = window.location.pathname.match(/^\/mentor\/([^/]+)/);
  const id = match?.[1] || sessionStorage.getItem('userId') || '';
  return `/mentor/${id}`;
}
