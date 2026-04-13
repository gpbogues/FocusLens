export const getGreeting = (username?: string): string => {
  const h = new Date().getHours();
  const name = username ? `, ${username}` : '';
  if (h >= 1 && h < 4) return 'Still at it this late?';
  if (h >= 4 && h < 12) return `Good morning${name}.`;
  if (h >= 12 && h < 18) return `Good afternoon${name}.`;
  return `Good evening${name}.`;
};
