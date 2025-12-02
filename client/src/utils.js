// Cookie utility functions
export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

export function getStoredUserId() {
  const COOKIE_NAME = 'chat_user_id';
  const userId = getCookie(COOKIE_NAME);
  return userId ? parseInt(userId) : null;
}

export function setStoredUserId(userId) {
  const COOKIE_NAME = 'chat_user_id';
  setCookie(COOKIE_NAME, userId.toString());
}

