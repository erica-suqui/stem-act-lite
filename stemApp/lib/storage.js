export function getStoredItem(key) {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
}

export function clearStoredAuth() {
    localStorage.removeItem('role');
    localStorage.removeItem('userID');
    localStorage.removeItem('orgId');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userID');
    sessionStorage.removeItem('orgId');
}