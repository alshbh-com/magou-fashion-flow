const ADMIN_PASSWORD = "0127800624801204486263";

export const checkAdminAuth = (password: string): boolean => {
  return password === ADMIN_PASSWORD;
};

export const isAdminAuthenticated = (): boolean => {
  return localStorage.getItem("adminAuth") === "true";
};

export const setAdminAuth = (authenticated: boolean): void => {
  if (authenticated) {
    localStorage.setItem("adminAuth", "true");
  } else {
    localStorage.removeItem("adminAuth");
  }
};
